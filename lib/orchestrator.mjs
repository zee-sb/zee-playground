// Multi-MCP orchestrator.
//
// Loads tools from every connector the signed-in user has available
// (always-on internal MCPs + linked external MCPs), runs an intent
// classifier, then dispatches the LLM tool-calling loop to whichever
// connector owns each tool. Streams NDJSON events.

import OpenAI from 'openai';
import { CONNECTORS, isWriteTool } from './connector-registry.mjs';
import { buildMockBearer } from './staffbase-users.mjs';
import { listConnectionsForUser } from './connections.mjs';
import {
  listUsers, listRecentPosts, listChannels,
  getPostsRankings, getContentsRankings, getUsersTimeseries,
} from './staffbase.mjs';
import {
  materializeActiveScope, resolveAssistantScope, resolveFlowScope,
  userToAudience, flowMatchesText, isStudioEmpty,
} from './studio-config.mjs';
import { buildSystemPrompt as buildStudioSystemPrompt } from './prompts.mjs';

const CHART_PALETTE = {
  primary: '#7C3AED',
  secondary: '#0EA5E9',
  tertiary: '#10B981',
  accent: '#F59E0B',
};

const MAX_ROUNDS = 6;
const MAX_TOOL_CALLS = 12;
const TIME_BUDGET_MS = 30_000;

// ── JSON-RPC over HTTP for the internal MCPs ─────────────────────────────────

async function rpc(baseUrl, endpoint, method, params, token, userId) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${token}`,
  };
  // Forwarded to all internal MCPs; harmless for ones that don't need it.
  // mcp-atlassian uses it to look up the user's stored access token.
  if (userId) headers['X-Companion-User-Id'] = userId;
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await res.text();
  for (const line of text.trim().split('\n').filter(Boolean)) {
    const payload = line.startsWith('data: ') ? line.slice(6) : line;
    try {
      const obj = JSON.parse(payload);
      if (obj.result !== undefined) return obj.result;
      if (obj.error) throw new Error(obj.error.message || JSON.stringify(obj.error));
    } catch { /* skip */ }
  }
  return null;
}

// ── Per-turn context ──────────────────────────────────────────────────────────

export async function loadActiveConnectors(userId) {
  const linked = new Set((await listConnectionsForUser(userId)).map((c) => c.provider));
  return CONNECTORS.filter((c) => c.alwaysOn || linked.has(c.provider));
}

// ── Intent classification ─────────────────────────────────────────────────────

function rowToText(row) {
  const c = row?.content ?? '';
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object') {
    if (typeof c.text === 'string') return c.text;
    if (typeof c.content === 'string') return c.content;
  }
  return '';
}

// Look at the last few messages for hackathon-flow markers. If found, the
// orchestrator pins routing to atlassian (no matter what the user typed),
// because terse answers like "C" otherwise get misclassified as out-of-scope.
function detectHackathonFlow(history) {
  const recent = (history || []).slice(-8);
  const HACK = /\bhackathon\b|\bquiz\b|\btrivia\b|Q1\.|Q2\.|Q3\.|score:\s*\d+|trivia score|create_issue|AIW-|let'?s play|mystery teammate|mystery post|mystery channel/i;
  return recent.some((row) => {
    const text = rowToText(row);
    if (HACK.test(text)) return true;
    // Also peek into assistant tool_call args
    const content = row?.content;
    if (content && typeof content === 'object' && Array.isArray(content.tool_calls)) {
      for (const tc of content.tool_calls) {
        if ((tc.function?.name || '').includes('create_issue')) return true;
      }
    }
    return false;
  });
}

async function classifyIntent(openai, allConnectors, activeIds, history) {
  const recent = (history || []).slice(-6);
  const lines = recent.map((m) => {
    const text = rowToText(m).replace(/\s+/g, ' ').trim();
    return `${m.role}: ${text.slice(0, 200)}`;
  }).join('\n');
  const lastUser = rowToText([...recent].reverse().find((m) => m.role === 'user') || {});

  // Show every connector to the LLM with its link status. The classifier
  // SHOULD return an unlinked connector when a question maps to it — the
  // runtime catches that and offers the user a one-tap connect card.
  const domainMap = allConnectors.map((c) => {
    const linked = activeIds.has(c.id);
    const tag = linked ? '(linked)' : c.alwaysOn ? '(always on)' : '(not yet linked — will offer connect)';
    return `"${c.id}" ${tag}: ${c.domains.join(', ')}`;
  }).join('\n');
  const validIds = new Set(allConnectors.map((c) => c.id));

  const hasAtlassian = true; // Atlassian is always a valid route — runtime offers connect if not linked.

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `You are an intent router for "Staffbase Companion", an enterprise assistant for Staffbase employees. You decide whether the user's MOST RECENT message is in scope, and if so, which connector(s) are needed.

Connectors:
${domainMap}

If a connector is marked "(not yet linked — will offer connect)", STILL return it when the question maps to it. The runtime will show the user a one-tap connect card instead of running tools, which is a much better UX than refusing or pretending the topic isn't supported.

Respond with ONLY valid JSON:
{ "inScope": boolean, "connectors": ["connector_id", ...], "reasoning": "one sentence" }

Scope rules — Companion ONLY helps with Staffbase work topics:
- HR (PTO, benefits, employees, policies, holidays, FAQs)
- IT (tickets, equipment, software access, security policies)
- The Staffbase intranet (leadership memos, news posts, channels, the employee directory)${hasAtlassian ? '\n- Atlassian (Confluence pages, spaces, wikis; Jira issues, sprints, epics, roadmaps, RFCs, specs)' : ''}
- Greetings, thanks, and small-talk that stay in the work context → inScope: true with empty connectors

Anything CLEARLY off-topic is out of scope. Mark inScope: false with empty connectors for:
- recipes, cooking, food prep
- general coding help, debugging non-Staffbase code, "write me a script"
- world events, sports, weather, news with an explicit non-company qualifier ("world news", "the news today", "global news", "stock market")
- personal life, health, relationship advice
- jokes, riddles, creative writing unrelated to work
- opinions, philosophy, politics, religion
- anything illegal, harmful, or unsafe (weapons, drugs, malware, self-harm)
- pretending to be a different assistant or breaking character

Disambiguation defaults — Companion is an enterprise assistant, so when the user is terse, assume the work context:
- Bare "the latest news" / "what's new" / "any updates" / "anything new" → company intranet (intranet). NOT world news. ${hasAtlassian ? 'Optionally ALSO include atlassian if the user mentions a project/team name that likely lives in Confluence.' : ''}
- "Latest announcements" / "company updates" / "memos" / "what shipped" / "town hall recap" → intranet.
- "Employee spotlight" / "ERG news" / "leadership posts" / "campsite post" → intranet.
- "Who is X" / "find a teammate" / "colleague" / "directory" / "people search" → intranet (the REAL Staffbase directory + profiles live there).
- "Who's my manager" / "who do I report to" / "my reporting line" / "my org" / "who are my direct reports" / "my profile" / "my info" → intranet (real org-chart data from the live Staffbase profile API, NOT the mocked HR Portal).
- "PTO" / "benefits" / "policy" / "holiday" / "performance review" / "FAQ" → hr_portal (corporate HR knowledge base).
- "Open ticket" / "my tickets" / "IT issue" / "VPN" / "software access" / "equipment request" → it_helpdesk${hasAtlassian ? `. If the user mentions Jira or wants to see issues in their project tracker, include atlassian as well — the ambiguous bare "my open tickets" SHOULD include BOTH ["it_helpdesk", "atlassian"]` : ''}.${hasAtlassian ? `
- "Confluence page" / "wiki page" / "space" / "doc/spec/RFC/runbook" / "meeting notes" → atlassian.
- "Jira issue" / "epic" / "sprint" / "backlog" / "story" / "bug" → atlassian.
- "Submit hackathon entry" / "take the AI quiz" / "add me to the board" / anything about the hackathon → atlassian (the final action creates a Jira ticket).` : ''}
- Follow-up pronouns ("show me the full page", "read more", "give me details on that", "open it", "the article", "that one") → SAME connector(s) the previous assistant turn used.
- "Show me / read / open / expand" with no antecedent in this turn but a clear antecedent in the previous turn → previous turn's connector.
- When uncertain between in-scope and out-of-scope, prefer in-scope (the user is signed into a work tool — give them the benefit of the doubt).

Routing rules (when inScope: true):
- Use specific connector ids from the list above.
- For greetings, "help", or pure small-talk: inScope: true with empty connectors.
- For cross-domain queries include ALL relevant connector ids. Examples:
  - "Latest news on the Phoenix migration" → ["intranet"${hasAtlassian ? ', "atlassian"' : ''}] (announcements + project docs)
  - "What's the WFH policy and any recent updates?" → ["hr_portal", "intranet"]
  - "Open IT tickets and any recent IT memos" → ["it_helpdesk", "intranet"]`,
      },
      {
        role: 'user',
        content: lines
          ? `Recent conversation (chronological order, oldest first):\n${lines}\n\nClassify the user's MOST RECENT message ("${lastUser.slice(0, 200)}") using the conversation as context.`
          : `Classify: ${lastUser}`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(resp.choices[0].message.content.trim());
    return {
      inScope: parsed.inScope !== false,
      connectors: (parsed.connectors || []).filter((id) => validIds.has(id)),
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return { inScope: false, connectors: [], reasoning: 'Unparseable classifier response.' };
  }
}

// ── Tool loading ──────────────────────────────────────────────────────────────

function sanitizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return { type: 'object', properties: {} };
  const out = JSON.parse(JSON.stringify(schema));
  delete out.$schema; delete out.$id;
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.$ref) { for (const k of Object.keys(n)) delete n[k]; n.type = 'object'; return; }
    if (n.properties) Object.values(n.properties).forEach(walk);
    if (n.items) walk(n.items);
    for (const k of ['oneOf', 'anyOf', 'allOf']) if (Array.isArray(n[k])) n[k].forEach(walk);
  };
  walk(out);
  return out;
}

async function loadInternalTools(baseUrl, connector, mockBearer, userId) {
  try {
    const result = await rpc(baseUrl, connector.endpoint, 'tools/list', {}, mockBearer, userId);
    return result?.tools || [];
  } catch (err) {
    console.error(`[orchestrator] loadInternalTools(${connector.id}):`, err.message);
    return [];
  }
}

// ── Inline chart payloads ────────────────────────────────────────────────────
// The Companion's ChatPanel knows how to render a `chart_card` event into a
// Chart.js card. We build the chart payload on the server side so the LLM
// doesn't have to (and so the chart shows up even if the model forgets to
// mention it).

function chartFromPostEntity(entity) {
  if (!entity) return null;
  const likes = Number(entity.likes) || 0;
  const comments = Number(entity.comments) || 0;
  const visits = Number(entity.visits) || 0;
  if (!likes && !comments && !visits) return null;
  return {
    kind: 'bar',
    title: `Engagement — ${(entity.title || 'post').slice(0, 60)}`,
    labels: ['Visits', 'Likes', 'Comments'],
    datasets: [{ label: 'Last 30 days', data: [visits, likes, comments], color: CHART_PALETTE.primary }],
  };
}

function chartFromChannelEntity(entity) {
  if (!entity) return null;
  const visits = Number(entity.visits) || 0;
  const uniques = Number(entity.uniqueVisitors) || 0;
  if (!visits && !uniques) return null;
  return {
    kind: 'bar',
    title: `Engagement — ${(entity.title || 'channel').slice(0, 60)}`,
    labels: ['Visits', 'Unique visitors'],
    datasets: [{ label: 'Last 30 days', data: [visits, uniques], color: CHART_PALETTE.secondary }],
  };
}

// Generic "team is alive" line chart used on the teammate round, plus as a
// safe fallback when entity-specific data is missing.
async function chartTeamPulse() {
  try {
    const raw = await getUsersTimeseries({ sinceDays: 30, groupBy: 'day' });
    const ts = raw?.timeseries || [];
    if (!ts.length) return null;
    const labels = ts.map((row) => {
      const g = row.group || {};
      if (g.day && g.month && g.year) {
        return new Date(g.year, (g.month || 1) - 1, g.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      if (g.month && g.year) return new Date(g.year, (g.month || 1) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      return '';
    });
    return {
      kind: 'line',
      title: 'Team pulse — active vs engaged users (last 30 days)',
      labels,
      datasets: [
        { label: 'Active users', data: ts.map((r) => r.activeUsers || 0), color: CHART_PALETTE.primary },
        { label: 'Engaged users', data: ts.map((r) => r.engagedUsers || 0), color: CHART_PALETTE.secondary },
      ],
    };
  } catch (err) {
    console.error('[trivia] chartTeamPulse failed:', err.message);
    return null;
  }
}

async function chartForCorrectEntity(category, entity) {
  if (category === 'post') return chartFromPostEntity(entity) || await chartTeamPulse();
  if (category === 'channel') return chartFromChannelEntity(entity) || await chartTeamPulse();
  // Teammate: no per-user analytics — show the team pulse to keep every round
  // visually consistent.
  return await chartTeamPulse();
}

// ── Hackathon trivia state machine ────────────────────────────────────────────
//
// Three-round, choice-based trivia grounded in LIVE Staffbase intranet data.
// Each round fetches a broad sample (users / posts / channels) and shows the
// user 3 picture+name cards. The orchestrator owns the round state — the LLM
// is NOT in the loop — so questions, distractors, and scoring are
// deterministic and reliable. After round 3 we directly emit a
// `tool_call_pending` for `create_issue` so the existing write-confirm modal
// closes the loop into a Jira ticket on the hackathon epic. There is NO
// project-intake step — the trivia score IS the entry.

function isHackathonStartIntent(message) {
  const s = String(message || '').toLowerCase().trim();
  if (!s) return false;
  return /\b(submit (my )?hackathon|hackathon entry|let'?s (play|go|start)|take (the )?(trivia|quiz)|start (the )?(trivia|quiz)|play (the )?(trivia|quiz)|hackathon trivia|add me to the (hackathon )?board)\b/.test(s)
    || /^(yes|sure|ok|okay|ready|begin|go!?)$/.test(s);
}

// Pulls the latest trivia state out of any 'system' message in conversation
// history. We persist state via onSystemMessage on every round transition so
// state survives across turns AND page reloads.
function parseTriviaState(history) {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const row = history[i];
    if (row?.role !== 'system') continue;
    const c = row.content;
    if (c && typeof c === 'object' && c.trivia) return c.trivia;
  }
  return null;
}

function lastUserText(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const row = history[i];
    if (row?.role === 'user') return rowToText(row).trim();
  }
  return '';
}

// Pick `n` distinct items from `arr`, optionally excluding ids in `exclude`.
function pickRandom(arr, n, exclude) {
  const excl = new Set(exclude || []);
  const pool = (arr || []).filter((x) => !excl.has(x?.id));
  // Fisher-Yates partial shuffle
  const out = pool.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}

// Build a clue for a teammate that's UNIQUE among the 3 picks. We use the
// teammate's title + location/department as the clue. The cards only show
// the photo + name, so the user has to map the clue to the right face.
function clueForTeammate(correct, distractors) {
  const titleBit = correct.title ? `whose title is **${correct.title}**` : null;
  const locBit = correct.location ? `based in **${correct.location}**` : null;
  const deptBit = correct.department ? `from the **${correct.department}** team` : null;
  const parts = [titleBit, locBit, deptBit].filter(Boolean);
  if (parts.length === 0) return `I'm thinking of one of these colleagues. Which one?`;
  // Use the strongest 1-2 facts.
  return `I'm thinking of someone ${parts.slice(0, 2).join(' and ')}. Pick the right person.`;
}

// Pick a clue + winner for the post round. Cards show thumbnail + title; the
// hidden fields (published date, engagement counts) become the puzzle. We try
// several angles and pick whichever produces a clear winner among the 3 picks
// — so trivia rounds vary across plays even with the same candidate pool.
function chooseClueForPosts(picks) {
  const engagementOf = (p) => (p.likes || 0) + (p.comments || 0);
  const byRecent = [...picks].sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0));
  const byOldest = [...picks].sort((a, b) => new Date(a.published || 0) - new Date(b.published || 0));
  const byEngagement = [...picks].sort((a, b) => engagementOf(b) - engagementOf(a));

  const candidates = [
    {
      clue: 'Which of these posts is the **most recent**?',
      winner: byRecent[0],
      hasSpread: byRecent[0]?.published && byRecent[0].published !== byRecent[1]?.published,
    },
    {
      clue: 'Which of these is our **oldest** post here?',
      winner: byOldest[0],
      hasSpread: byOldest[0]?.published && byOldest[0].published !== byOldest[1]?.published,
    },
    {
      clue: 'Which of these has the **most engagement** (likes + comments)?',
      winner: byEngagement[0],
      hasSpread: engagementOf(byEngagement[0]) > engagementOf(byEngagement[1]),
    },
  ];
  const valid = candidates.filter((c) => c.hasSpread && c.winner);
  if (!valid.length) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

// Pull a broad sample from the live Staffbase intranet for one trivia
// category. Calls the data layer directly (same module, no network hop)
// since both the orchestrator and the staffbase client live in /lib.
async function fetchSampleForCategory(category) {
  try {
    if (category === 'teammate') return await listUsers({ limit: 25 });
    if (category === 'post')     return await listRecentPosts({ limit: 15 });
    if (category === 'channel')  return await listChannels({ limit: 30 });
  } catch (err) {
    console.error(`[trivia] fetchSampleForCategory(${category}) failed:`, err.message);
    return [];
  }
  return [];
}

// Build a fresh round: fetches data, picks correct + 2 distractors, builds a
// clue, returns the round descriptor (with everything the UI needs and the
// secret correctId).
async function buildTriviaRound({ category, usedIds, userProfile }) {
  if (category === 'channel') return await buildChannelRound({ usedIds });
  if (category === 'post')    return await buildPostRound({ usedIds });
  return await buildTeammateRound({ usedIds, userProfile });
}

async function buildTeammateRound({ usedIds, userProfile }) {
  const pool = await fetchSampleForCategory('teammate');
  let usable = pool.filter((u) => u && u.id && u.name && (u.title || u.department));

  // Department bias for personalization.
  if (userProfile?.department) {
    const dept = String(userProfile.department).toLowerCase();
    const same = usable.filter((u) => (u.department || '').toLowerCase() === dept);
    const others = usable.filter((u) => (u.department || '').toLowerCase() !== dept);
    if (same.length >= 3 && Math.random() < 0.7) usable = same;
    else if (same.length >= 1) usable = [...same, ...others];
  }
  if (usable.length < 3) return null;

  const picks = pickRandom(usable, 3, usedIds);
  if (picks.length < 3) return null;
  const correct = picks[0];
  const optionOrder = pickRandom(picks, picks.length);
  return {
    category: 'teammate',
    clue: clueForTeammate(correct, picks.filter((p) => p.id !== correct.id)),
    correctId: correct.id,
    options: optionOrder.map((o) => ({ ...o })),
    optionPublic: optionOrder.map((u) => ({
      id: u.id, kind: 'teammate', label: u.name, avatar: u.avatar || null,
    })),
    correctEntity: correct,
  };
}

// Choose a clue + winner from a triplet of analytics-enriched posts. Each
// pick carries real /branch/analytics/posts/rankings counters
// (registeredVisits, registeredVisitors, likes, comments). We pick whichever
// metric produces a clear single leader.
function chooseClueForRankedPosts(picks) {
  const candidates = [
    {
      clue: 'Which of these posts got the **most engagement** (likes + comments) in the last 30 days?',
      winner: [...picks].sort((a, b) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)))[0],
      hasSpread: (() => {
        const eng = (p) => (p.likes || 0) + (p.comments || 0);
        const sorted = [...picks].sort((a, b) => eng(b) - eng(a));
        return eng(sorted[0]) > eng(sorted[1]);
      })(),
    },
    {
      clue: 'Which of these posts had the **most views** in the last 30 days?',
      winner: [...picks].sort((a, b) => (b.visits || 0) - (a.visits || 0))[0],
      hasSpread: (() => {
        const sorted = [...picks].sort((a, b) => (b.visits || 0) - (a.visits || 0));
        return (sorted[0].visits || 0) > (sorted[1].visits || 0);
      })(),
    },
    {
      clue: 'Which of these posts collected the **most likes** in the last 30 days?',
      winner: [...picks].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0],
      hasSpread: (() => {
        const sorted = [...picks].sort((a, b) => (b.likes || 0) - (a.likes || 0));
        return (sorted[0].likes || 0) > (sorted[1].likes || 0);
      })(),
    },
    {
      clue: 'Which of these posts reached the **most unique readers** in the last 30 days?',
      winner: [...picks].sort((a, b) => (b.uniqueVisitors || 0) - (a.uniqueVisitors || 0))[0],
      hasSpread: (() => {
        const sorted = [...picks].sort((a, b) => (b.uniqueVisitors || 0) - (a.uniqueVisitors || 0));
        return (sorted[0].uniqueVisitors || 0) > (sorted[1].uniqueVisitors || 0);
      })(),
    },
  ];
  const valid = candidates.filter((c) => c.hasSpread && c.winner);
  if (!valid.length) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

async function buildPostRound({ usedIds }) {
  // Pull analytics rankings — the API enriches each ranking row with the post
  // title, author, and engagement counters from the last 30d. Falls back to the
  // legacy recent-posts proxy if analytics is unreachable.
  let analyticsPosts = null;
  try {
    const raw = await getPostsRankings({ sinceDays: 30, limit: 12, enrich: true });
    const entities = raw?.entities?.posts || {};
    const rows = Array.isArray(raw?.ranking) ? raw.ranking : [];
    analyticsPosts = rows
      .map((r) => {
        const id = r.group?.postId || r.postId;
        const ent = id ? entities[id] : null;
        if (!id || !ent?.title) return null;
        return {
          id,
          title: ent.title,
          image: ent?.image?.url || ent?.feedImage?.url || null,
          published: ent.published || null,
          channel: ent.channelID ? { id: ent.channelID } : null,
          visits: r.registeredVisits ?? 0,
          uniqueVisitors: r.registeredVisitors ?? 0,
          likes: r.likes ?? 0,
          comments: r.comments ?? 0,
          shares: r.shares ?? 0,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[trivia] post analytics failed, falling back:', err.message);
  }

  // Analytics path — preferred.
  if (analyticsPosts && analyticsPosts.length >= 3) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const picks = pickRandom(analyticsPosts, 3, usedIds);
      if (picks.length < 3) continue;
      const chosen = chooseClueForRankedPosts(picks);
      if (!chosen) continue;
      const correct = chosen.winner;
      const optionOrder = pickRandom(picks, picks.length);
      return {
        category: 'post',
        clue: chosen.clue,
        correctId: correct.id,
        options: optionOrder.map((o) => ({ ...o })),
        optionPublic: optionOrder.map((p) => ({
          id: p.id, kind: 'post', label: p.title, image: p.image || null,
        })),
        correctEntity: correct,
      };
    }
  }

  // Legacy fallback — same logic as before (recency / oldest / live engagement).
  const pool = await fetchSampleForCategory('post');
  const usable = pool.filter((p) => p && p.id && p.title);
  if (usable.length < 3) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const picks = pickRandom(usable, 3, usedIds);
    if (picks.length < 3) continue;
    const chosen = chooseClueForPosts(picks);
    if (!chosen) continue;
    const correct = chosen.winner;
    const optionOrder = pickRandom(picks, picks.length);
    return {
      category: 'post',
      clue: chosen.clue,
      correctId: correct.id,
      options: optionOrder.map((o) => ({ ...o })),
      optionPublic: optionOrder.map((p) => ({
        id: p.id, kind: 'post', label: p.title,
        image: p.image || null,
      })),
      correctEntity: correct,
    };
  }
  return null;
}

function chooseClueForRankedChannels(picks) {
  const candidates = [
    {
      clue: 'Which of these channels had the **most unique readers** in the last 30 days?',
      winner: [...picks].sort((a, b) => (b.uniqueVisitors || 0) - (a.uniqueVisitors || 0))[0],
      hasSpread: (() => {
        const sorted = [...picks].sort((a, b) => (b.uniqueVisitors || 0) - (a.uniqueVisitors || 0));
        return (sorted[0].uniqueVisitors || 0) > (sorted[1].uniqueVisitors || 0);
      })(),
    },
    {
      clue: 'Which of these channels racked up the **most views** in the last 30 days?',
      winner: [...picks].sort((a, b) => (b.visits || 0) - (a.visits || 0))[0],
      hasSpread: (() => {
        const sorted = [...picks].sort((a, b) => (b.visits || 0) - (a.visits || 0));
        return (sorted[0].visits || 0) > (sorted[1].visits || 0);
      })(),
    },
  ];
  const valid = candidates.filter((c) => c.hasSpread && c.winner);
  if (!valid.length) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

async function buildChannelRound({ usedIds }) {
  // Preferred path: analytics rankings of content (channels/news/pages) over
  // the last 30 days. Each row carries registeredVisits + registeredVisitors,
  // which we map to visits + uniqueVisitors locally.
  let analyticsChannels = null;
  try {
    const raw = await getContentsRankings({ sinceDays: 30, limit: 12 });
    const entities = raw?.entities?.contents || {};
    const rows = Array.isArray(raw?.ranking) ? raw.ranking : [];
    analyticsChannels = rows
      .map((r) => {
        const id = r.group?.contentId || r.contentId;
        const ent = id ? entities[id] : null;
        if (!id || !ent?.title) return null;
        return {
          id,
          title: ent.title,
          link: ent.link || null,
          visits: r.registeredVisits ?? 0,
          uniqueVisitors: r.registeredVisitors ?? 0,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[trivia] channel analytics failed, falling back:', err.message);
  }

  if (analyticsChannels && analyticsChannels.length >= 3) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const picks = pickRandom(analyticsChannels, 3, usedIds);
      if (picks.length < 3) continue;
      const chosen = chooseClueForRankedChannels(picks);
      if (!chosen) continue;
      const correct = chosen.winner;
      const optionOrder = pickRandom(picks, picks.length);
      return {
        category: 'channel',
        clue: chosen.clue,
        correctId: correct.id,
        options: optionOrder.map((o) => ({ ...o })),
        optionPublic: optionOrder.map((c) => ({
          id: c.id, kind: 'channel', label: c.title,
        })),
        correctEntity: correct,
      };
    }
  }

  // Legacy fallback: rank channels by post counts in the recent feed.
  const [channels, recentPosts] = await Promise.all([
    fetchSampleForCategory('channel'),
    listRecentPosts({ limit: 100 }).catch(() => []),
  ]);

  const usable = channels.filter((c) => c && c.id && c.title);
  if (usable.length < 3) return null;

  const counts = new Map();
  for (const p of recentPosts || []) {
    const cid = p?.channel?.id;
    if (cid) counts.set(cid, (counts.get(cid) || 0) + 1);
  }

  // Prefer channels that actually have activity — distractors with 0 posts
  // would make the question trivially easy (or impossible to verify). Cap the
  // pool at the top 15 most active so we always have plausible alternatives.
  const ranked = usable
    .map((c) => ({ ...c, _postCount: counts.get(c.id) || 0 }))
    .sort((a, b) => b._postCount - a._postCount);
  const activePool = ranked.filter((c) => c._postCount > 0).slice(0, 15);
  const fallbackPool = ranked.slice(0, 15);
  const pool = activePool.length >= 3 ? activePool : fallbackPool;
  if (pool.length < 3) return null;

  // Try a few picks until we find a triplet with a clear winner (i.e., the
  // most-active has strictly more posts than the runner-up).
  for (let attempt = 0; attempt < 4; attempt++) {
    const picks = pickRandom(pool, 3, usedIds);
    if (picks.length < 3) continue;
    const sorted = [...picks].sort((a, b) => b._postCount - a._postCount);
    if (sorted[0]._postCount > sorted[1]._postCount) {
      const correct = sorted[0];
      const optionOrder = pickRandom(picks, picks.length);
      return {
        category: 'channel',
        clue: `Which of these channels has been the **most active** in our recent feed?`,
        correctId: correct.id,
        options: optionOrder.map((o) => ({ ...o })),
        optionPublic: optionOrder.map((c) => ({
          id: c.id, kind: 'channel', label: c.title,
          // No description on the cards — let the activity intuition do the work.
        })),
        correctEntity: correct,
      };
    }
  }
  // Couldn't get a clear winner on activity — fall back to a recency-based
  // clue if `published` timestamps differ.
  for (let attempt = 0; attempt < 3; attempt++) {
    const picks = pickRandom(pool, 3, usedIds);
    if (picks.length < 3) continue;
    const byDate = [...picks].sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0));
    if (byDate[0]?.published && byDate[0].published !== byDate[1]?.published) {
      const correct = byDate[0];
      const optionOrder = pickRandom(picks, picks.length);
      return {
        category: 'channel',
        clue: `Which of these channels was launched **most recently**?`,
        correctId: correct.id,
        options: optionOrder.map((o) => ({ ...o })),
        optionPublic: optionOrder.map((c) => ({
          id: c.id, kind: 'channel', label: c.title,
        })),
        correctEntity: correct,
      };
    }
  }
  return null;
}

function matchUserAnswer(text, options) {
  const s = String(text || '').trim().toLowerCase();
  if (!s) return null;
  // Exact label match wins (this is the normal path — user clicked a card).
  let best = null;
  for (const opt of options) {
    const label = String(opt.label || '').toLowerCase();
    if (!label) continue;
    if (label === s) return opt;
    if (s.includes(label) || label.includes(s)) {
      if (!best || label.length > String(best.label).length) best = opt;
    }
  }
  return best;
}

function summariseEntity(opt, full) {
  if (opt?.kind === 'teammate') {
    const bits = [full?.title, full?.department, full?.location].filter(Boolean).join(' · ');
    return bits ? `${opt.label} — ${bits}` : opt.label;
  }
  if (opt?.kind === 'post') {
    const eng = (Number(full?.likes) || 0) + (Number(full?.comments) || 0);
    const bits = [
      full?.author?.name,
      full?.published ? new Date(full.published).toLocaleDateString() : null,
      eng > 0 ? `${eng} likes+comments` : null,
    ].filter(Boolean).join(' · ');
    return bits ? `${opt.label} (${bits})` : opt.label;
  }
  if (opt?.kind === 'channel') {
    const bits = [];
    const n = Number(full?._postCount);
    if (n > 0) bits.push(`${n} recent post${n === 1 ? '' : 's'}`);
    if (full?.description) bits.push(full.description);
    return bits.length ? `${opt.label} — ${bits.join(' · ')}` : opt.label;
  }
  return opt?.label || '';
}

function buildCreateIssueArgs({ rounds, score, userProfile, staffbaseUserId }) {
  const firstName = (userProfile?.name || staffbaseUserId || 'Hackathon player').split(' ')[0];
  const fullName = userProfile?.name || staffbaseUserId || 'Unknown player';
  const total = rounds.length;

  // Player header — gives everyone reading the epic at-a-glance context.
  const playerBits = [
    userProfile?.title,
    userProfile?.department,
    userProfile?.location, // may be undefined; passed through if/when surfaced
  ].filter(Boolean);
  const playerLine = playerBits.length
    ? `${fullName} · ${playerBits.join(' · ')}`
    : fullName;

  const categoryLabel = (c) => c === 'post' ? 'Mystery post'
    : c === 'channel' ? 'Mystery channel'
    : 'Mystery teammate';

  const roundBlocks = rounds.map((r, i) => {
    const cleanClue = r.clue.replace(/\*\*/g, '');
    const mark = r.correct ? '✅ Correct' : '❌ Missed';
    return [
      `### Round ${i + 1} — ${categoryLabel(r.category)}`,
      `**Q:** ${cleanClue}`,
      `**Picked:** ${r.userGuess || '—'}`,
      `**Correct answer:** ${r.correctLabel}`,
      `${mark}`,
    ].join('\n');
  }).join('\n\n');

  const description = [
    `## Player`,
    playerLine,
    ``,
    `## Staffbase Trivia`,
    `🎯 **${score}/${total}**${score === total ? ' — clean sweep!' : ''}`,
    ``,
    roundBlocks,
    ``,
    `_Submitted via Staffbase Companion 🪐_`,
  ].join('\n');

  return {
    summary: `[Hackathon trivia] ${firstName} — ${score}/${total}`,
    description,
    issueType: 'Story',
    labels: ['ai-hackathon', 'companion-demo'],
    assignToMe: true,
  };
}

// Main trivia driver — handles every state the round machine can be in.
// Returns one of { status: 'done' } | { status: 'await_confirm', toolCalls }
// so the api/companion.mjs handler can deal with persistence consistently.
async function runTriviaTurn({
  staffbaseUserId, userProfile, baseUrl, history, emit,
  onAssistantMessage, onSystemMessage,
}) {
  const mockBearer = buildMockBearer(staffbaseUserId);
  const state = parseTriviaState(history);
  const userMsg = lastUserText(history);

  // Helper: kick off a fresh round and persist state.
  async function startRound(round, prevRounds, score, categoryOrder) {
    const category = categoryOrder[(round - 1) % categoryOrder.length];
    const usedIds = prevRounds.flatMap((r) => r.optionIds || []);
    const built = await buildTriviaRound({ category, usedIds, userProfile });
    if (!built) {
      // Not enough usable entities — skip this category and try the next.
      // Falls through to "I couldn't generate one" if we're truly out.
      const intro = `I couldn't pull enough ${category}s from the intranet to play this round. Try again in a minute?`;
      emit({ type: 'delta', content: intro });
      await onAssistantMessage?.({ role: 'assistant', content: intro });
      emit({ type: 'done', final: intro });
      return { status: 'done' };
    }
    const categoryTitle = built.category === 'post' ? 'Mystery post'
      : built.category === 'channel' ? 'Mystery channel'
      : 'Mystery teammate';
    const lead = round === 1
      ? `Welcome to **Staffbase Trivia** 🪐 — three quick rounds, pulled live from our intranet. **Round 1 of 3 · ${categoryTitle}**`
      : `**Round ${round} of 3 · ${categoryTitle}**`;
    emit({ type: 'delta', content: lead });
    emit({
      type: 'trivia_question',
      round, total: 3, category: built.category,
      clue: built.clue,
      options: built.optionPublic,
    });
    await onSystemMessage?.({
      trivia: {
        round, score, finalized: false,
        categoryOrder,
        rounds: prevRounds,
        currentRound: {
          category: built.category, clue: built.clue,
          correctId: built.correctId,
          options: built.options,             // full entities (for reveal)
          optionPublic: built.optionPublic,   // public-safe (for UI replay)
          correctEntity: built.correctEntity,
          optionIds: built.options.map((o) => o.id),
        },
      },
    });
    // Don't persist an assistant content message for the round-lead text —
    // the trivia_question event is the canonical record; reduceMessages
    // reconstructs the card UI from the system state on reload.
    emit({ type: 'done', final: lead });
    return { status: 'done', final: lead };
  }

  async function finalize(rounds, score) {
    const finalLine = `Trivia complete — **${score}/3**. Locking in your entry on the hackathon board now…`;
    emit({ type: 'delta', content: finalLine });

    // Hand off to the existing write-confirm flow. We mimic the same
    // tool_call_pending shape the LLM-driven path uses, so ChatPanel's
    // ConfirmWriteModal opens with the prefilled create_issue args.
    const args = buildCreateIssueArgs({ rounds, score, userProfile, staffbaseUserId });
    const toolCallId = `trivia-create-${Date.now()}`;
    const toolCalls = [{
      id: toolCallId,
      namespacedName: 'atlassian__create_issue',
      name: 'create_issue',
      connector: 'atlassian',
      args,
    }];

    // Persist the assistant turn WITH tool_calls in OpenAI's shape. This is
    // critical: after the user confirms, /api/companion/confirm runs a
    // wrap-up LLM call over conversation history. OpenAI requires every
    // `tool` message to follow an assistant message that contains
    // `tool_calls`. Without this, the wrap-up turn rejects with
    // 'Invalid parameter: messages with role tool must be a response to a
    // preceding message with tool_calls'.
    const openaiToolCalls = [{
      id: toolCallId,
      type: 'function',
      function: { name: 'atlassian__create_issue', arguments: JSON.stringify(args) },
    }];
    await onAssistantMessage?.({
      role: 'assistant',
      content: finalLine,
      tool_calls: openaiToolCalls,
    });

    await onSystemMessage?.({
      trivia: {
        round: 3, score, finalized: true,
        categoryOrder: state?.categoryOrder,
        rounds, currentRound: null,
      },
    });
    emit({ type: 'tool_call_pending', toolCalls });
    return { status: 'await_confirm', toolCalls };
  }

  // ── State dispatch ─────────────────────────────────────────────────────
  if (!state) {
    if (!isHackathonStartIntent(userMsg)) {
      // Not in trivia yet, no clear start signal — let the caller fall back.
      return null;
    }
    // Fresh quiz: shuffle the category order so two players almost never get
    // the same round sequence. Combined with the per-round random pool, every
    // ticket on the epic ends up with a unique question.
    const freshOrder = pickRandom(
      ['teammate', 'post', 'channel'].map((c) => ({ id: c })),
      3,
    ).map((c) => c.id);
    return await startRound(1, [], 0, freshOrder);
  }
  if (state.finalized) {
    // Trivia already concluded; let the caller fall back to normal flow.
    return null;
  }

  // We have an open round; validate the user's answer.
  const current = state.currentRound;
  if (!current) return null;
  // Match against optionPublic — those are the records that actually carry
  // the displayed `label` (e.g. "Patrick Rudolph"). `current.options` are
  // the full Staffbase entities (with `.name`/`.title` instead), so trying
  // to label-match against them silently fails and every answer reads as
  // wrong. Fall back to `options` only if the public list is missing
  // (older persisted state).
  const matchPool = (current.optionPublic && current.optionPublic.length)
    ? current.optionPublic
    : (current.options || []).map((o) => ({
        id: o.id,
        kind: current.category === 'post' ? 'post' : current.category === 'channel' ? 'channel' : 'teammate',
        label: o.name || o.title || '',
      }));
  const picked = matchUserAnswer(userMsg, matchPool);
  const correctPublic = matchPool.find((o) => o.id === current.correctId) || null;
  const correctEntity = (current.options || []).find((o) => o.id === current.correctId) || current.correctEntity || null;
  const correct = !!(picked && picked.id === current.correctId);
  const reveal = summariseEntity(correctPublic, correctEntity);
  const score = state.score + (correct ? 1 : 0);
  emit({
    type: 'trivia_result',
    round: state.round, total: 3,
    correct,
    reveal,
    userPickLabel: picked?.label || userMsg || '—',
    score, scoreOutOf: 3,
  });
  // Reveal a small analytics chart tied to the correct entity. Pulls real data
  // from /branch/analytics so the demo proves the trivia is grounded.
  try {
    const chart = await chartForCorrectEntity(current.category, correctEntity);
    if (chart) emit({ type: 'chart_card', chart, source: `trivia:${current.category}` });
  } catch (err) {
    console.error('[trivia] chart_card emit failed:', err.message);
  }
  const completedRound = {
    category: current.category,
    clue: current.clue,
    correct,
    correctId: current.correctId,
    correctLabel: correctPublic?.label
      || correctEntity?.name
      || correctEntity?.title
      || '—',
    userGuess: picked?.label || userMsg || '—',
    optionIds: current.optionIds || (current.options || []).map((o) => o.id),
  };
  const newRounds = [...(state.rounds || []), completedRound];
  const order = state.categoryOrder || ['teammate', 'post', 'channel'];
  if (state.round < 3) return await startRound(state.round + 1, newRounds, score, order);
  return await finalize(newRounds, score);
}

// ── Studio-driven dispatch ───────────────────────────────────────────────────
//
// Two-tier routing over admin-authored Studio config (assistants, MCPs,
// agents, flows, blueprint) — runs when Studio is populated. Legacy
// connector-registry path below remains the fallback so an unseeded branch
// still demos.

const TIER1_MAX_FLOWS = 8;
const TIER1_MAX_ASSISTANTS = 8;

async function routeTier1({ openai, scope, history, lastUserText: lastUserTextStr }) {
  // Fast path: notable-word match against active flow triggers.
  const flowHits = scope.flows.filter((f) => flowMatchesText(lastUserTextStr, f));
  if (flowHits.length === 1) {
    return {
      kind: 'flow',
      ids: [flowHits[0].id],
      id: flowHits[0].id,
      name: flowHits[0].name,
      confidence: 0.95,
      reasoning: 'trigger matched',
      _shortcut: true,
    };
  }

  // No assistants AND no flows → general_chat with no scope.
  if (!scope.assistants.length && !scope.flows.length) {
    return { kind: 'general_chat', ids: [], id: null, confidence: 1, reasoning: 'no Studio assistants or flows configured' };
  }

  // Build compact catalogs for the LLM.
  const flowChoices = scope.flows.slice(0, TIER1_MAX_FLOWS).map((f) => ({
    id: f.id,
    name: f.name,
    mode: f.mode || 'suggested',
    keywords: notableWordsForRouting(f.trigger).slice(0, 6),
  }));
  const asstChoices = scope.assistants.slice(0, TIER1_MAX_ASSISTANTS).map((a) => {
    const domainBag = new Set();
    const ownsList = [];
    for (const id of a.connectorIds || []) {
      const c = scope.connectorById[id];
      if (!c) continue;
      // Take the top 8 (was 4) so connectors with many domains — like the
      // Staffbase Intranet which spans both people-search AND content terms —
      // contribute enough signal for the LLM to match terse queries
      // ("Who is Martin?", "find the marketing lead").
      (c.domains || []).slice(0, 8).forEach((d) => domainBag.add(d));
      if (c.kind === 'kb' && c.name) domainBag.add(c.name.toLowerCase());
      // Surface connector identity so the router can reason about "this
      // assistant owns the intranet MCP" instead of having to infer it from
      // domain keywords alone. Critical for the disambiguation rules below.
      const label = c.kind === 'mcp'
        ? `${c.id} MCP`
        : c.kind === 'agent'
          ? `agent:${c.id}`
          : c.kind === 'kb'
            ? `KB:${c.id}`
            : c.id;
      ownsList.push(label);
    }
    return {
      id: a.id,
      name: a.name,
      description: (a.description || '').slice(0, 120),
      // Bumped from 250 → 600. The Campsite Assistant's PEOPLE routing rule
      // ("All 'who is X' questions are yours") lives past char 250 — without
      // this, the router can't see the strongest single signal it has.
      instructions: (a.instructions || '').replace(/\s+/g, ' ').slice(0, 600),
      domains: [...domainBag].slice(0, 14),
      owns: ownsList.slice(0, 6),
    };
  });

  const recent = (history || []).slice(-6).map((m) => {
    const t = rowToText(m).replace(/\s+/g, ' ').trim();
    return `${m.role}: ${t.slice(0, 200)}`;
  }).join('\n');

  const validFlowIds = new Set(flowChoices.map((f) => f.id));
  const validAsstIds = new Set(asstChoices.map((a) => a.id));

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are the top-level router for an enterprise employee assistant. Pick the BEST option(s) for the user's most recent message. You MAY pick MULTIPLE assistants when the message clearly spans more than one persona's domain.

Choices:
- "flow" — an admin-defined workflow. Pick AT MOST ONE. Flow options:
${flowChoices.length ? flowChoices.map((f) => `  • ${f.id} ("${f.name}", keywords: ${f.keywords.join(', ')}, mode: ${f.mode})`).join('\n') : '  (none)'}
- "assistants" — one OR MORE topic-scoped personas. Multiple OK when the message clearly spans personas. Options:
${asstChoices.length ? asstChoices.map((a) => `  • ${a.id} ("${a.name}" — ${a.description}\n      owns: ${a.owns.join(', ')}\n      domains: ${a.domains.join(', ')}\n      instructions excerpt: "${a.instructions || ''}")`).join('\n') : '  (none)'}
- "general_chat" — chit-chat / greeting / clarifying question; no scope needed.
- "out_of_scope" — the request is clearly outside what an enterprise assistant should handle.

Return STRICT JSON: {"kind": "flow"|"assistants"|"general_chat"|"out_of_scope", "ids": ["matching id", ...], "confidence": 0..1, "reasoning": "one sentence"}.

ID rules:
- "ids" MUST be an array of ids from the listed options (possibly empty).
- For "flow": exactly ONE id.
- For "assistants": 1-3 ids. Include MULTIPLE when the user's message clearly needs more than one persona's pool (see cross-domain rules below).
- For "general_chat" / "out_of_scope": empty array.

Disambiguation — Staffbase work-assistant defaults. Read each assistant's "owns:" list to decide:
- "Who is X" / "find a teammate" / "find someone in [team]" / "directory" / "people search" / "who reports to Y" / "who's my manager" / "my org" / "my profile" / "my info" → assistant whose "owns:" includes the live intranet MCP (look for "intranet MCP"). The REAL Staffbase employee directory lives there. Do NOT route people-lookups to an HR-policy assistant.
- "Latest news" / "what's new" / "any updates" / "anything new" / "company updates" / "memos" / "what shipped" / "town hall recap" / "leadership posts" / "employee spotlight" / "ERG news" / "campsite post" → assistant whose "owns:" includes "intranet MCP" or a Campsite-Articles KB. NOT world news.
- "PTO" / "vacation" / "leave" / "benefits" / "policy" / "holiday" / "performance review" / "FAQ" / "parental leave" / "conduct" / "performance" → assistant whose "owns:" includes "hr_portal MCP" or an HR KB.
- "Open ticket" / "my tickets" / "IT issue" / "VPN" / "MFA" / "software access" / "equipment" / "laptop" / "phishing" / "security policy" → assistant whose "owns:" includes "it_helpdesk MCP" or an IT KB.
- "Confluence" / "wiki page" / "space" / "doc" / "spec" / "RFC" / "runbook" / "meeting notes" / "Jira issue" / "epic" / "sprint" / "backlog" / "story" / "bug" → assistant whose "owns:" includes "atlassian MCP".
- "Onboarding" / "day one" / "first week" / "first month" / "new hire" / "buddy" / "MacBook pickup" / "benefits enrollment" → assistant whose "owns:" includes the onboarding agent or onboarding KB.

Cross-domain — return MULTIPLE assistant ids when the message clearly needs more than one pool:
- "WFH policy AND any recent leadership memos" → hr-style assistant + intranet-style assistant.
- "Open IT tickets AND any recent IT memos" → it-style assistant + intranet-style assistant.
- "What's the parental leave policy and is there a recent announcement about it?" → hr-style + intranet-style.
- "Show me my open Jira issues and any related Confluence docs" → atlassian-owning assistant (one is fine, both signals already live in atlassian).

Other rules:
- Prefer "flow" over "assistants" when the user's words clearly match a flow's keywords (e.g. "I need a new laptop" → laptop-request flow).
- Follow-up pronouns ("show me the full page", "read more", "open it", "the article", "that one") with a clear antecedent in the previous assistant turn → re-select the SAME assistant(s) that handled the previous turn.
- Use "general_chat" only for greetings, thanks, small-talk, or truly vague follow-ups with no antecedent — NOT as a fallback when you can't decide between assistants. If the user's words touch any of the disambiguation buckets above, pick that assistant.
- Use "out_of_scope" ONLY for clearly non-work topics (recipes, cooking, world news with non-company qualifier, sports, weather, personal/medical/legal/relationship advice, jokes/creative-writing unrelated to work, opinions/politics/religion, self-harm, illegal/unsafe). When uncertain between in-scope and out-of-scope, prefer in-scope.`,
        },
        {
          role: 'user',
          content: recent
            ? `Recent conversation (oldest first):\n${recent}\n\nMost recent user message: "${(lastUserTextStr || '').slice(0, 200)}"`
            : `Message: ${lastUserTextStr || ''}`,
        },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content || '{}');
    let kind = parsed.kind;
    // Tolerate legacy "assistant" (singular) so old responses still work.
    if (kind === 'assistant') kind = 'assistants';
    if (!['flow', 'assistants', 'general_chat', 'out_of_scope'].includes(kind)) kind = 'general_chat';
    // Accept both new {ids:[]} and legacy {id:"x"} shapes.
    const rawIds = Array.isArray(parsed.ids)
      ? parsed.ids
      : (parsed.id ? [parsed.id] : []);
    let ids = [];
    if (kind === 'flow') {
      const first = rawIds.find((x) => validFlowIds.has(x));
      ids = first ? [first] : [];
    } else if (kind === 'assistants') {
      ids = [...new Set(rawIds.filter((x) => validAsstIds.has(x)))].slice(0, 3);
    }
    if ((kind === 'flow' || kind === 'assistants') && !ids.length) {
      return { kind: 'general_chat', ids: [], id: null, confidence: 0.3, reasoning: 'router returned no valid ids' };
    }
    const primaryName = kind === 'flow'
      ? scope.flowById[ids[0]]?.name
      : kind === 'assistants'
        ? scope.assistantById[ids[0]]?.name
        : null;
    return {
      kind,
      ids,
      id: ids[0] || null,
      name: primaryName || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      reasoning: String(parsed.reasoning || '').slice(0, 200),
    };
  } catch (err) {
    console.warn('[orchestrator] Tier1 routing failed:', err.message);
    return { kind: 'general_chat', ids: [], id: null, confidence: 0.1, reasoning: 'router failed' };
  }
}

const ROUTING_STOPWORDS = new Set([
  'employee','employees','asks','wants','says','their','they','the','and','for',
  'that','this','about','have','with','what','when','to','on','of','in','a','an',
  'or','is','are','be','do','need','needs','help','want','start','starts',
  'mentions','mention','from','just','some',
]);
function notableWordsForRouting(s = '') {
  return Array.from(new Set(
    String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
      .filter((w) => w.length > 4 && !ROUTING_STOPWORDS.has(w))
  ));
}

// Build the Tier-2 tool catalog from the chosen scope (assistants or flow).
// Returns { assistant?, assistants?, flow?, connectors[] (unified, de-duped),
// allowedToolIds?, blueprint }. The orchestrator walks `connectors` and
// dispatches per `kind`.
function buildTier2Catalog({ scope, kind, ids, blueprint }) {
  const idList = Array.isArray(ids) ? ids : (ids ? [ids] : []);
  if (kind === 'flow') {
    const flow = scope.flowById[idList[0]];
    if (!flow) return null;
    const pairs = resolveFlowScope(flow, scope);
    const connectorIds = new Set(pairs.map((p) => p.connectorId));
    const connectors = [...connectorIds].map((cid) => scope.connectorById[cid]).filter(Boolean);
    // Restrict the tool catalog to exactly the {connector, tool} pairs the
    // flow lists. Implicit-tool connectors (agent: 'invoke', kb: 'search')
    // still pass through because the seed lists them explicitly.
    const allowedToolIds = new Set(pairs.filter((p) => p.toolId).map((p) => `${p.connectorId}__${p.toolId}`));
    return { flow, assistants: [], connectors, allowedToolIds, blueprint };
  }
  if (kind === 'assistants' || kind === 'assistant') {
    const assistants = idList.map((id) => scope.assistantById[id]).filter(Boolean);
    if (!assistants.length) return null;
    // Merge connector ids across every chosen assistant, de-duped.
    const connectorIds = new Set();
    for (const asst of assistants) {
      for (const cid of resolveAssistantScope(asst, scope)) connectorIds.add(cid);
    }
    const connectors = [...connectorIds].map((cid) => scope.connectorById[cid]).filter(Boolean);
    return {
      // Legacy single-assistant alias so older readers don't break.
      assistant: assistants[0] || null,
      assistants,
      connectors,
      allowedToolIds: null,
      blueprint,
    };
  }
  return null;
}

// Studio-driven turn runner. Returns a result the same shape as the legacy
// path: { status: 'done' | 'await_confirm' | 'truncated', toolCalls?, final? }.
async function runStudioDrivenTurn({
  openai, userId, staffbaseUserId, userProfile, baseUrl, history, emit,
  onAssistantMessage, onToolResult, studio, userConnections = new Set(),
}) {
  const startedAt = Date.now();
  const user = userToAudience(userProfile);
  const scope = materializeActiveScope({
    config: studio.config,
    assistants: studio.assistants,
    user,
    userConnections,
  });
  const blueprint = studio.blueprint || null;
  const tenantName = studio.config?.tenantOverrides?.name || 'Staffbase';

  const userText = lastUserText(history);

  // ── Tier 1 ─────────────────────────────────────────────────────────────
  const tier1 = await routeTier1({ openai, scope, history, lastUserText: userText });

  if (tier1.kind === 'out_of_scope') {
    emit({
      type: 'trace_route',
      tier1, tier2: null, fallbackUsed: false,
    });
    const refusal = `That's outside what I can help with — I'm scoped to ${tenantName} work topics (HR, IT, intranet, and whatever your admins have wired up). Try asking about one of those.`;
    emit({ type: 'delta', content: refusal });
    await onAssistantMessage?.({ role: 'assistant', content: refusal });
    emit({ type: 'done', final: refusal });
    return { status: 'done', final: refusal };
  }

  // Resolve Tier 2 scope.
  const catalog = tier1.kind === 'general_chat'
    ? { connectors: [], assistants: [], blueprint, allowedToolIds: null }
    : buildTier2Catalog({ scope, kind: tier1.kind, ids: tier1.ids, blueprint });

  if (!catalog) {
    // Could happen if the picked id vanished between tiers. Fall through to general chat.
    emit({ type: 'trace_route', tier1: { ...tier1, kind: 'general_chat' }, tier2: null, fallbackUsed: true });
    const reply = `I'm not sure which assistant to use for that. Could you rephrase or pick one of these topics?`;
    emit({ type: 'delta', content: reply });
    await onAssistantMessage?.({ role: 'assistant', content: reply });
    emit({ type: 'done', final: reply });
    return { status: 'done', final: reply };
  }

  const activeAssistants = Array.isArray(catalog.assistants) && catalog.assistants.length
    ? catalog.assistants
    : (catalog.assistant ? [catalog.assistant] : []);
  const activeAssistant = activeAssistants[0] || null;
  const activeFlow = catalog.flow || null;

  if (activeAssistants.length) {
    // Emit one per assistant so existing UI badges still render. Add a
    // combined event when there's more than one so a future UI can show a
    // "running as N personas" strip.
    for (const a of activeAssistants) {
      emit({ type: 'assistant_selected', assistantId: a.id, name: a.name, icon: a.icon || null });
    }
    if (activeAssistants.length > 1) {
      emit({
        type: 'assistants_selected',
        assistants: activeAssistants.map((a) => ({ id: a.id, name: a.name, icon: a.icon || null })),
      });
    }
  }
  if (activeFlow) {
    const totalSteps = (activeFlow.tools || []).length;
    emit({
      type: 'flow_started',
      flowId: activeFlow.id, name: activeFlow.name,
      mode: activeFlow.mode || 'suggested',
      goal: activeFlow.goal || '',
      totalSteps,
    });
  }

  // ── Tool catalog (Tier 2) ──────────────────────────────────────────────
  // Unified pass over `catalog.connectors`. Each connector contributes 1+ tools:
  //   kind: 'mcp'   — every tool in connector.tools[], filtered by flow.allowedToolIds
  //   kind: 'agent' — exactly one synthetic ${id}__invoke tool (dispatched via tasks/send)
  //   kind: 'kb'    — exactly one synthetic ${id}__search tool (dispatched via tools/call)
  const mockBearer = buildMockBearer(staffbaseUserId);
  const openaiTools = [];
  const toolMap = {}; // namespacedName → { connector, toolName }

  for (const connector of catalog.connectors) {
    if (connector.kind === 'agent') {
      const ns = `${connector.id}__invoke`;
      if (catalog.allowedToolIds && !catalog.allowedToolIds.has(ns)) continue;
      toolMap[ns] = { connector, toolName: 'invoke' };
      openaiTools.push({
        type: 'function',
        function: {
          name: ns,
          description: `[${connector.name}] Hand off this request to ${connector.name}. ${connector.description || ''}`,
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'A natural-language message to send to the agent.' },
            },
            required: ['message'],
          },
        },
      });
      continue;
    }
    if (connector.kind === 'kb') {
      const ns = `${connector.id}__search`;
      if (catalog.allowedToolIds && !catalog.allowedToolIds.has(ns)) continue;
      toolMap[ns] = { connector, toolName: 'search' };
      openaiTools.push({
        type: 'function',
        function: {
          name: ns,
          description: `[${connector.name}] Search the ${connector.name} knowledge base${connector.source ? ` (${connector.source})` : ''}. Returns ranked snippets with title + last-updated. Cite the document title in your answer.`,
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'What to search for (keywords or a full question).' },
              limit: { type: 'integer', minimum: 1, maximum: 8, description: 'Max results to return.' },
            },
            required: ['query'],
          },
        },
      });
      continue;
    }
    // kind === 'mcp' — fetch tools/list dynamically.
    let toolList = [];
    try {
      const ep = connector.endpoint || `/api/mcp`;
      const result = await rpc(baseUrl, ep, 'tools/list', {}, mockBearer, userId);
      toolList = result?.tools || [];
    } catch (err) {
      console.warn(`[orchestrator] tools/list ${connector.id}:`, err.message);
    }
    for (const t of toolList) {
      const ns = `${connector.id}__${t.name}`;
      if (catalog.allowedToolIds && !catalog.allowedToolIds.has(ns)) continue;
      toolMap[ns] = { connector, toolName: t.name };
      openaiTools.push({
        type: 'function',
        function: {
          name: ns,
          description: `[${connector.name}] ${t.description || ''}`,
          parameters: sanitizeSchema(t.inputSchema),
        },
      });
    }
  }

  const degradedIds = scope.degradedIds;

  emit({
    type: 'trace_route',
    tier1,
    tier2: {
      scope: tier1.kind,
      toolPool: openaiTools.map((t) => t.function.name),
      connectors: catalog.connectors.map((c) => ({
        id: c.id, kind: c.kind, name: c.name, color: c.color || null,
        source: c.source || null,
        degraded: degradedIds.has(c.id),
      })),
    },
    fallbackUsed: false,
  });

  // If the chosen scope references a connector the admin enabled but the
  // user hasn't OAuth-linked, surface a one-tap connect card before the
  // agentic loop kicks in.
  const scopeRefIds = new Set();
  if (activeFlow) {
    for (const t of activeFlow.tools || []) {
      const cid = typeof t === 'string' ? t : t?.connectorId;
      if (cid) scopeRefIds.add(cid);
    }
  } else if (activeAssistants.length) {
    for (const a of activeAssistants) {
      for (const cid of a.connectorIds || []) scopeRefIds.add(cid);
    }
  }
  const scopeNeedsAuth = (scope.needsAuth || []).filter((c) => scopeRefIds.has(c.id));
  if (scopeNeedsAuth.length) {
    emit({
      type: 'needs_connection',
      connectors: scopeNeedsAuth.map((c) => ({
        id: c.id,
        provider: c.provider,
        name: c.name,
        description: c.description || '',
        color: c.color || null,
        icon: c.icon || null,
        connectUrl: `/api/connections/${c.provider}/connect`,
      })),
    });
  }

  // System prompt — pass unified connectors plus the KB subset (for the
  // "grounding sources" block) so the LLM knows when to call kb__search.
  const systemPrompt = buildStudioSystemPrompt({
    blueprint,
    activeAssistant,
    activeAssistants,
    flow: activeFlow,
    user: { id: staffbaseUserId, ...userProfile, ...user },
    connectors: catalog.connectors,
    tenantName,
    epic: process.env.HACKATHON_JIRA_EPIC_KEY || null,
  });

  // ── Agentic loop ───────────────────────────────────────────────────────
  let messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(rowToOpenAi).filter(Boolean),
  ];
  let toolCount = 0;
  let flowStepIndex = 0;
  const totalFlowSteps = activeFlow ? (activeFlow.tools || []).length : 0;

  // If there are no tools and not in general_chat (e.g. assistant with no
  // connectors), still let the model reply with a stream — it can answer
  // from KB context in the system prompt.
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      emit({ type: 'truncated', reason: 'time' });
      break;
    }
    const params = { model: 'gpt-4o-mini', messages, stream: true };
    if (openaiTools.length) { params.tools = openaiTools; params.tool_choice = 'auto'; }

    const stream = await openai.chat.completions.create(params);
    let roundText = '';
    let toolCalls = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) { roundText += delta.content; emit({ type: 'delta', content: delta.content }); }
      if (delta.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          const idx = tcDelta.index;
          if (!toolCalls[idx]) toolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
          if (tcDelta.id) toolCalls[idx].id += tcDelta.id;
          if (tcDelta.function?.name) toolCalls[idx].function.name += tcDelta.function.name;
          if (tcDelta.function?.arguments) toolCalls[idx].function.arguments += tcDelta.function.arguments;
        }
      }
    }
    toolCalls = toolCalls.filter((t) => t && t.function?.name);

    if (!toolCalls.length) {
      const assistantMsg = { role: 'assistant', content: roundText };
      messages.push(assistantMsg);
      await onAssistantMessage?.(assistantMsg);
      if (activeFlow) {
        emit({ type: 'flow_completed', flowId: activeFlow.id, summary: roundText.slice(0, 200) });
      }
      emit({ type: 'done', final: roundText });
      return { status: 'done', final: roundText };
    }

    // Persist assistant with tool calls
    const assistantMsg = { role: 'assistant', content: roundText || null, tool_calls: toolCalls };
    messages.push(assistantMsg);
    await onAssistantMessage?.(assistantMsg);

    // Write-confirm — only MCP connectors expose write tools. Agents and KBs
    // are write-safe by definition.
    const writeCalls = toolCalls.filter((tc) => {
      const entry = toolMap[tc.function.name];
      if (!entry || entry.connector.kind !== 'mcp') return false;
      const writeTools = Array.isArray(entry.connector.writeTools) ? entry.connector.writeTools : null;
      if (writeTools) return writeTools.includes(entry.toolName);
      return isWriteTool(entry.connector.id, entry.toolName);
    });
    if (writeCalls.length) {
      const parsed = writeCalls.map((tc) => {
        const entry = toolMap[tc.function.name];
        return {
          id: tc.id,
          namespacedName: tc.function.name,
          name: entry.toolName,
          connector: entry.connector.id,
          args: safeParseArgs(tc.function.arguments),
        };
      });
      emit({ type: 'tool_call_pending', toolCalls: parsed });
      return { status: 'await_confirm', toolCalls: parsed };
    }

    // Execute all tool calls in this round.
    for (const tc of toolCalls) {
      if (++toolCount > MAX_TOOL_CALLS) {
        emit({ type: 'truncated', reason: 'tool_cap' });
        return { status: 'truncated' };
      }
      const entry = toolMap[tc.function.name];
      if (!entry) {
        messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify({ error: 'unknown_tool' }) });
        continue;
      }
      const args = safeParseArgs(tc.function.arguments);
      const { connector, toolName } = entry;

      // Pre-event: A2A handoff badge (informational).
      if (connector.kind === 'agent') {
        emit({
          type: 'agent_handoff',
          agentId: connector.id,
          agentName: connector.name,
          color: connector.color || null,
          message: args.message || '',
        });
      }

      emit({
        type: 'tool_start',
        toolCallId: tc.id,
        name: toolName,
        connector: connector.id,
        connectorKind: connector.kind,
        connectorName: connector.name,
        connectorColor: connector.color || null,
        degraded: degradedIds.has(connector.id),
        args,
      });

      let result;
      try {
        if (connector.kind === 'agent') {
          // JSON-RPC tasks/send to the agent endpoint.
          const params = {
            id: `task-${Date.now()}`,
            message: { role: 'user', parts: [{ type: 'text', text: String(args.message || userText || '') }] },
            metadata: { user: { id: staffbaseUserId, email: userProfile?.email || null } },
          };
          result = await rpc(baseUrl, connector.endpoint || '/api/a2a', 'tasks/send', params, mockBearer, userId);
        } else {
          // kind === 'mcp' or 'kb' — both speak standard JSON-RPC tools/call.
          result = await rpc(baseUrl, connector.endpoint, 'tools/call', { name: toolName, arguments: args }, mockBearer, userId);
          if (result?.content) {
            const text = result.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
            try { result = JSON.parse(text); } catch { result = text; }
          }
        }
      } catch (err) {
        result = { error: err.message || String(err) };
      }

      emit({ type: 'tool_result', toolCallId: tc.id, name: toolName, connector: connector.id, result });

      if (result && typeof result === 'object' && result.chart && Array.isArray(result.chart.labels)) {
        emit({ type: 'chart_card', chart: result.chart, source: `tool:${toolName}`, toolCallId: tc.id });
      }
      if (result && typeof result === 'object' && result.cards && typeof result.cards.type === 'string') {
        emit({ type: 'card', card: result.cards, source: `tool:${toolName}`, toolCallId: tc.id });
      }

      // KB hits are inherently citation-shaped — surface each result doc as
      // a citation chip on the tool card so the chat UI shows provenance.
      if (connector.kind === 'kb' && result && typeof result === 'object' && Array.isArray(result.results)) {
        for (const hit of result.results) {
          emit({
            type: 'kb_citation',
            kbId: connector.id,
            name: connector.name,
            source: connector.source || null,
            docTitle: hit.title || null,
            docId: hit.id || null,
            toolCallId: tc.id,
          });
        }
      }

      const toolMsg = {
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.function.name,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      };
      messages.push(toolMsg);
      await onToolResult?.(toolMsg, { name: toolName, connector: connector.id, args, result });

      if (activeFlow) {
        flowStepIndex++;
        const label = connector.kind === 'agent'
          ? `Handed off to ${connector.name}`
          : connector.kind === 'kb'
            ? `Searched ${connector.name}`
            : friendlyToolLabel(toolName);
        emit({ type: 'flow_step', flowId: activeFlow.id, stepIndex: flowStepIndex, totalSteps: totalFlowSteps, label, toolCallId: tc.id });
      }
    }
  }
  emit({ type: 'truncated', reason: 'rounds' });
  return { status: 'truncated' };
}

function friendlyToolLabel(name) {
  if (!name) return 'Step';
  return name.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Public entry point ───────────────────────────────────────────────────────

export async function runOrchestratedTurn({
  openai,
  userId,
  staffbaseUserId,
  userProfile,
  baseUrl,
  history,
  emit,
  onAssistantMessage,
  onToolResult,
  onSystemMessage,
  // Optional Studio context. When present and non-empty, drives the
  // hierarchical two-tier dispatch. When null/empty, we fall back to the
  // legacy hardcoded connector-registry path so an unseeded branch still
  // demos.
  studio = null,
  branchId = null,
  userConnections = new Set(),
}) {
  const startedAt = Date.now();
  const active = await loadActiveConnectors(userId);
  const activeIds = new Set(active.map((c) => c.id));
  emit({ type: 'trace_connectors', connectors: active.map((c) => ({ id: c.id, name: c.name, color: c.color, kind: c.kind })) });

  // ── Trivia state machine takes priority ────────────────────────────────
  // If the user is starting the hackathon trivia OR in the middle of an
  // unfinished round, the deterministic state machine drives the turn (no
  // LLM in the loop, so questions and scoring stay rock-solid for the demo).
  if (activeIds.has('atlassian')) {
    const triviaResult = await runTriviaTurn({
      staffbaseUserId, userProfile, baseUrl, history, emit,
      onAssistantMessage, onSystemMessage,
    });
    if (triviaResult) return triviaResult;
  }

  // ── Studio-driven path ────────────────────────────────────────────────
  // When Studio config exists with at least one assistant or MCP, the
  // hierarchical Tier-1 → Tier-2 dispatch takes over. The legacy path
  // below remains as the fallback when Studio is empty.
  if (studio && !isStudioEmpty(studio)) {
    return await runStudioDrivenTurn({
      openai, userId, staffbaseUserId, userProfile, baseUrl, history, emit,
      onAssistantMessage, onToolResult, studio, userConnections,
    });
  }
  emit({ type: 'studio_empty', reason: studio ? 'no Studio assistants or connectors yet' : 'Studio config not loaded' });

  // If the recent conversation is mid-hackathon-flow, skip the classifier
  // entirely and pin to atlassian. The classifier was second-guessing terse
  // quiz answers (A/B/C/D) as "no tools needed".
  const inHackathonFlow = detectHackathonFlow(history);
  const hasAtlassian = activeIds.has('atlassian');
  // Hackathon trivia uses the live intranet to source questions, then atlassian
  // to write the final ticket. Pin BOTH so terse user answers like "Patrick" or
  // "let's go" don't get misclassified as no-tools-needed mid-flow.
  const intent = inHackathonFlow
    ? {
        inScope: true,
        connectors: hasAtlassian ? ['intranet', 'atlassian'] : ['intranet'],
        reasoning: 'continuing hackathon trivia flow',
      }
    : await classifyIntent(openai, CONNECTORS, activeIds, history);
  emit({ type: 'trace_intent', ...intent });

  if (!intent.inScope) {
    emit({ type: 'delta', content: "I help with Staffbase work topics — HR, IT, the intranet, and (when linked) Confluence + Jira. That one's outside what I can do." });
    emit({ type: 'done', final: '' });
    return { status: 'done' };
  }

  // Split the classifier's chosen connectors into ones we can actually use
  // (active) vs ones we'd need the user to connect first (known external
  // connectors with a provider that the user hasn't linked yet).
  const wanted = intent.connectors || [];
  const availableIds = wanted.filter((id) => activeIds.has(id));
  const needsConnection = wanted
    .map((id) => CONNECTORS.find((c) => c.id === id))
    .filter((c) => c && !activeIds.has(c.id) && c.provider);

  if (needsConnection.length) {
    emit({
      type: 'needs_connection',
      connectors: needsConnection.map((c) => ({
        id: c.id,
        provider: c.provider,
        name: c.name,
        description: c.description,
        color: c.color,
        icon: c.icon,
        connectUrl: `/api/connections/${c.provider}/connect`,
      })),
    });
  }

  // If the user's question requires a connector they haven't linked AND
  // nothing else is available, skip the agentic loop and let the connect
  // card carry the moment — just a brief framing line above it.
  if (!availableIds.length && needsConnection.length) {
    const names = needsConnection.map((c) => c.name).join(' and ');
    const intro = `Sure thing — to answer that I'll need to look in your ${names}. One quick tap on the card below to connect, and I'll be ready.`;
    emit({ type: 'delta', content: intro });
    const assistant = { role: 'assistant', content: intro };
    await onAssistantMessage?.(assistant);
    emit({ type: 'done', final: intro });
    return { status: 'done', final: intro };
  }

  if (!availableIds.length) {
    // Conversational reply, no tools.
    const reply = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [
        { role: 'system', content: `You are Staffbase Companion. Reply briefly to greetings and small-talk in a friendly, work-appropriate tone. Mention you can help with HR, IT, the intranet, and Atlassian if connected.` },
        ...history.map(rowToOpenAi).filter(Boolean),
      ],
    });
    let acc = '';
    for await (const ch of reply) {
      const c = ch.choices[0]?.delta?.content;
      if (c) { acc += c; emit({ type: 'delta', content: c }); }
    }
    const assistant = { role: 'assistant', content: acc };
    await onAssistantMessage?.(assistant);
    emit({ type: 'done', final: acc });
    return { status: 'done', final: acc };
  }

  // Resolve per-connector tooling
  const selected = active.filter((c) => availableIds.includes(c.id));
  const mockBearer = buildMockBearer(staffbaseUserId);

  // Internal MCP tools — all connectors are 'internal' now (Atlassian uses our
  // own MCP wrapper that calls Confluence/Jira REST directly).
  const internalResults = await Promise.all(
    selected.map(async (c) => ({ connector: c, tools: await loadInternalTools(baseUrl, c, mockBearer, userId) }))
  );

  // Unify tools with namespaced names
  const openaiTools = [];
  const toolMap = {}; // namespacedName -> { connector, originalName }
  for (const { connector, tools } of internalResults) {
    for (const t of tools) {
      const ns = `${connector.id}__${t.name}`;
      toolMap[ns] = { connector, originalName: t.name };
      openaiTools.push({
        type: 'function',
        function: {
          name: ns,
          description: `[${connector.name}] ${t.description || ''}`,
          parameters: sanitizeSchema(t.inputSchema),
        },
      });
    }
  }

  emit({ type: 'trace_tools', toolCount: openaiTools.length, connectors: selected.map((c) => c.id) });

  // ── Agentic loop ────────────────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt({ active, selected, staffbaseUserId, userProfile });
  let messages = [{ role: 'system', content: systemPrompt }, ...history.map(rowToOpenAi).filter(Boolean)];
  let toolCount = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        emit({ type: 'truncated', reason: 'time' });
        break;
      }

      const params = { model: 'gpt-4o-mini', messages, stream: true };
      if (openaiTools.length) { params.tools = openaiTools; params.tool_choice = 'auto'; }

      const stream = await openai.chat.completions.create(params);

      let roundText = '';
      let toolCalls = [];
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          roundText += delta.content;
          emit({ type: 'delta', content: delta.content });
        }
        if (delta.tool_calls) {
          for (const tcDelta of delta.tool_calls) {
            const idx = tcDelta.index;
            if (!toolCalls[idx]) toolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
            if (tcDelta.id) toolCalls[idx].id += tcDelta.id;
            if (tcDelta.function?.name) toolCalls[idx].function.name += tcDelta.function.name;
            if (tcDelta.function?.arguments) toolCalls[idx].function.arguments += tcDelta.function.arguments;
          }
        }
      }

      toolCalls = toolCalls.filter((t) => t && t.function?.name);

      if (!toolCalls.length) {
        const assistantMsg = { role: 'assistant', content: roundText };
        messages.push(assistantMsg);
        await onAssistantMessage?.(assistantMsg);
        emit({ type: 'done', final: roundText });
        return { status: 'done', final: roundText };
      }

      // Persist assistant with tool calls
      const assistantMsg = { role: 'assistant', content: roundText || null, tool_calls: toolCalls };
      messages.push(assistantMsg);
      await onAssistantMessage?.(assistantMsg);

      // Check for write tools — pause for confirmation
      const writeCalls = toolCalls.filter((tc) => {
        const entry = toolMap[tc.function.name];
        return entry && isWriteTool(entry.connector.id, entry.originalName);
      });
      if (writeCalls.length) {
        const parsed = writeCalls.map((tc) => {
          const entry = toolMap[tc.function.name];
          return {
            id: tc.id,
            namespacedName: tc.function.name,
            name: entry.originalName,
            connector: entry.connector.id,
            args: safeParseArgs(tc.function.arguments),
          };
        });
        emit({ type: 'tool_call_pending', toolCalls: parsed });
        return { status: 'await_confirm', toolCalls: parsed };
      }

      // Execute all tool calls in this round
      for (const tc of toolCalls) {
        if (++toolCount > MAX_TOOL_CALLS) {
          emit({ type: 'truncated', reason: 'tool_cap' });
          return { status: 'truncated' };
        }
        const entry = toolMap[tc.function.name];
        if (!entry) {
          messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify({ error: 'unknown_tool' }) });
          continue;
        }
        const args = safeParseArgs(tc.function.arguments);

        emit({
          type: 'tool_start',
          toolCallId: tc.id,
          name: entry.originalName,
          connector: entry.connector.id,
          connectorName: entry.connector.name,
          connectorColor: entry.connector.color,
          args,
        });

        let result;
        try {
          result = await rpc(baseUrl, entry.connector.endpoint, 'tools/call', { name: entry.originalName, arguments: args }, mockBearer, userId);
          if (result?.content) {
            const text = result.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
            try { result = JSON.parse(text); } catch { result = text; }
          }
        } catch (err) {
          result = { error: err.message || String(err) };
        }

        emit({
          type: 'tool_result',
          toolCallId: tc.id,
          name: entry.originalName,
          connector: entry.connector.id,
          result,
        });

        // If the tool returned a chartable payload (analytics_timeseries /
        // analytics_rankings), stream a `chart_card` event so ChatPanel renders
        // an inline Chart.js card — even if the LLM forgets to mention it.
        if (result && typeof result === 'object' && result.chart && Array.isArray(result.chart.labels)) {
          emit({
            type: 'chart_card',
            chart: result.chart,
            source: `tool:${entry.originalName}`,
            toolCallId: tc.id,
          });
        }

        // Generalised UI card pipeline. Any tool can return a `cards` field
        // with a `type` discriminator; ChatPanel dispatches it to CardRouter
        // which picks the right component (user/post/leaderboard/kpi/...).
        if (result && typeof result === 'object' && result.cards && typeof result.cards.type === 'string') {
          emit({
            type: 'card',
            card: result.cards,
            source: `tool:${entry.originalName}`,
            toolCallId: tc.id,
          });
        }

        const toolMsg = {
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        };
        messages.push(toolMsg);
        await onToolResult?.(toolMsg, { name: entry.originalName, connector: entry.connector.id, args, result });
      }
  }
  emit({ type: 'truncated', reason: 'rounds' });
  return { status: 'truncated' };
}

function buildSystemPrompt({ active, selected, staffbaseUserId, userProfile }) {
  const epic = process.env.HACKATHON_JIRA_EPIC_KEY;
  const identityLine = userProfile
    ? `Signed-in user: ${userProfile.name || staffbaseUserId} (id="${staffbaseUserId}", email="${userProfile.email || 'unknown'}"${userProfile.title ? `, ${userProfile.title}` : ''}${userProfile.department ? `, ${userProfile.department}` : ''}). When the user asks about themselves ("my manager", "my team", "my profile", "who do I report to", "my open tickets"), call tools using THIS identity — most internal tools auto-resolve "me" from the auth context, but if a tool needs an email/name pass these values directly.`
    : `Signed-in Staffbase user id: "${staffbaseUserId}".`;
  const lines = [
    `You are Staffbase Companion.`,
    identityLine,
    `Active connectors this turn: ${selected.map((c) => c.name).join(', ')}.`,
    `All connectors available (always-on or linked): ${active.map((c) => c.name).join(', ')}.`,
    `Atlassian tools (list_spaces, search_pages, get_page, list_projects, search_issues, get_issue, etc.) automatically use the signed-in user's linked Atlassian site — never ask for a cloudId.`,
    `When a tool returns a 'url' field for a Jira issue or Confluence page, ALWAYS include it as a markdown link in your reply (e.g. [AIW-123](url)). Never paste raw API URLs.`,
    `When you call search_users / get_user / lookup_employee and the result includes user records, the UI will render them as a profile-card carousel directly under your reply. Do NOT enumerate each user's title/department/location/email in prose — that's redundant. Lead with a one-sentence framing (e.g. "Here are the top matches for X:"), then if a specific user is the clear answer, name them in a single sentence. Otherwise stay terse so the cards are the focus.`,
    selected.length > 1
      ? `Multiple connectors were chosen for this turn — when the question spans them (e.g. "latest news on the Phoenix migration" → intranet announcements + Confluence project pages), call tools from EACH relevant connector in parallel and synthesize a combined answer that cites both sources by name.`
      : `Use the active connector's tools to answer concretely. Don't invent connectors that aren't listed above.`,
  ];

  if (epic) {
    lines.push(`---
## Hackathon mode 🪐

The Staffbase AI Hackathon is running on epic **${epic}**. The hackathon flow is **driven by the runtime, not by you** — when the user wants to play, the orchestrator runs a 3-round trivia game (mystery teammate → mystery post → mystery channel) pulled from the live intranet, with click-card UI and a Jira ticket as the prize.

Your job:
- If the user mentions the hackathon, the trivia, "submit my entry", "the quiz", or similar — DO NOT try to ask quiz questions or run intake yourself. Reply briefly and offer the start chip: \`<suggestions>["Submit my hackathon entry", "Tell me about it"]</suggestions>\`. Clicking that chip triggers the trivia state machine automatically.
- If the user asks how it works, explain in one short paragraph: "Three rounds, three categories — colleagues, posts, channels. Each round shows three cards and a clue; pick the right one. At the end your trivia score gets posted to the hackathon board as a Jira ticket."
- Once trivia has finished (you'll see the entry already created), just celebrate briefly with their score and the Jira URL the system already produced.
- NEVER manually call \`atlassian.create_issue\` for hackathon entries — the runtime does it after round 3 with the trivia score baked in.
---`);
  }

  lines.push(`Behavior:
- Call tools eagerly. For cross-connector questions, dispatch multiple tools in sequence and combine.
- For Atlassian WRITE actions (create/update/comment/transition), call the tool — the app will pause and ask the user to confirm before it runs. Do not ask in chat first.
- Cite page titles, space keys, issue keys, dates, URLs when available.
- If a tool returns access-denied, say so plainly — Atlassian RBAC is enforced server-side.
- Keep responses tight and scannable. Use short paragraphs and bullet lists.

After EVERY assistant turn (even short ones), include exactly one block at the end like:
<suggestions>["Short next step 1", "Short next step 2", "Short next step 3"]</suggestions>
Each suggestion ≤ 8 words, specific, and varies from what the user just asked. Don't repeat across consecutive turns.`);
  return lines.join('\n\n');
}

function rowToOpenAi(row) {
  if (row.role === 'user') return { role: 'user', content: typeof row.content === 'string' ? row.content : (row.content?.text || '') };
  if (row.role === 'assistant') {
    const c = row.content || {};
    const msg = { role: 'assistant', content: c.content ?? null };
    if (c.tool_calls?.length) msg.tool_calls = c.tool_calls;
    return msg;
  }
  if (row.role === 'tool') {
    const c = row.content || {};
    return { role: 'tool', tool_call_id: c.tool_call_id, content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content) };
  }
  return null;
}

function safeParseArgs(s) { if (!s) return {}; try { return JSON.parse(s); } catch { return {}; } }
