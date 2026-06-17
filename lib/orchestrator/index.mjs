// Multi-MCP orchestrator.
//
// Loads tools from every connector the signed-in user has available
// (always-on internal MCPs + linked external MCPs), runs an intent
// classifier, then dispatches the LLM tool-calling loop to whichever
// connector owns each tool. Streams NDJSON events.

import { AsyncLocalStorage } from 'node:async_hooks';
import { MODELS } from '../ai-client.mjs';
import { CONNECTORS, isWriteTool } from '../connector-registry.mjs';
import { buildMockBearer } from '../staffbase-users.mjs';
import { listConnectionsForUser } from '../connections.mjs';
import { mcpCall, buildAuthHeader } from '../mcp-remote-client.mjs';
import { adaptIntranetResult } from './intranet-adapter.mjs';
import {
  listUsers, listRecentPosts, listChannels,
  getPostsRankings, getContentsRankings, getUsersTimeseries,
} from '../staffbase.mjs';
import {
  materializeActiveScope, resolveExpertScope, resolveWorkflowScope,
  userToAudience, isStudioEmpty,
} from '../studio-config.mjs';
import { buildSystemPrompt as buildStudioSystemPrompt } from './system-prompt.mjs';
import {
  resolveTokens,
  makeInitialRun, applyFormSubmission, applyConfirmResponse,
  applyPhotoValidation, applyPhotoAccept, applyPhotoRetake,
  advance, complete,
} from '../flows/runtime.mjs';
import { loadPrompt } from './load-prompt.mjs';
import { extractFormValues } from '../voice/form-extract.mjs';
import { validatePhoto } from './photo-validate.mjs';

// Simple "switch language" detection for voice/text users. Hard-coded English
// + German + Spanish + French + Italian + Portuguese trigger phrases — enough
// for the prototype; a real impl would route this through the classifier.
const SWITCH_LANG_RE = /\b(?:switch to|change to|speak|reply in|respond in|talk in|sprich|antworte auf|wechsle zu|hablar en|cambia a|parle|réponds en|parla in)\s+(english|german|deutsch|spanish|español|french|français|italian|italiano|portuguese|português|dutch|nederlands|arabic)\b/i;
const LANG_WORD_TO_CODE = {
  english: 'en', german: 'de', deutsch: 'de', spanish: 'es', 'español': 'es',
  french: 'fr', 'français': 'fr', italian: 'it', italiano: 'it',
  portuguese: 'pt', 'português': 'pt', dutch: 'nl', nederlands: 'nl', arabic: 'ar',
};

export function detectLanguageSwitch(text) {
  if (!text) return null;
  const m = String(text).match(SWITCH_LANG_RE);
  if (!m) return null;
  const code = LANG_WORD_TO_CODE[m[1].toLowerCase()];
  return code || null;
}

// Cheap language sniffer for drift detection. Built around stop-words +
// diacritic profiles for the seven SUPPORTED_LANGS in data/languages.mjs.
// Designed for short chat messages; returns null when no strong signal
// (we'd rather miss a drift than guess wrong and trigger a confirm chip).
// Stop-words are chosen to be unique to each language where possible. Words
// that overlap across languages (Romance "de", "le", "la") are deliberately
// avoided so a French sentence containing "de" doesn't score points for
// Spanish too.
const LANG_STOPWORDS = {
  en: ['the','and','are','you','have','this','that','with','what','when','where','would','should','could','about','from','they','their','please','because','through','though'],
  de: ['ich','und','das','ist','nicht','der','die','den','dem','ein','eine','auf','mit','für','von','aber','auch','noch','wenn','wie','was','bitte','sind','beim','sein','vom','zur','zum','ihrer','meiner'],
  fr: ['je','les','une','est','pas','mais','pour','dans','avec','quoi','comment','plus','bien','aussi','très','merci','aussi','voudrais','combien','jours','reste','cette','année','bonjour','aujourd'],
  es: ['los','las','una','que','por','para','como','cuando','donde','pero','muy','también','gracias','está','quedan','este','año','días','vacaciones','gustaría','cuántos','hola'],
  it: ['gli','che','non','per','quando','dove','molto','anche','grazie','sono','sei','sono','dello','della','degli','delle','vorrei','quanti','rimangono','ferie','giorni','quest','anno','ciao'],
  nl: ['het','een','niet','maar','ook','wel','hoe','wanneer','waar','alstublieft','dagen','vakantie','dit','jaar','hallo','vragen'],
  pl: ['się','jest','tak','jak','gdzie','kiedy','ale','już','tylko','bardzo','dziękuję','proszę','dobrze','jeszcze','żeby','który','która','dzień','urlop'],
};
// Diacritic regexes are restricted to chars that genuinely distinguish each
// language. Dutch is dropped from the diacritic check entirely because the
// accent marks it occasionally uses (é, ë) overlap with French/Spanish and
// produce false positives on Romance sentences.
const LANG_DIACRITICS = {
  de: /[äöüß]/i,
  fr: /[àâçèêëîïôûùÿœæ]/i,
  es: /[áñ¿¡]/i,
  it: /[àèéìòù]/i,
  pl: /[ąćęłńśźż]/i,
};

export function detectMessageLanguage(text) {
  const t = String(text || '').toLowerCase().trim();
  if (t.length < 12) return null;
  const tokens = t.match(/\b[\p{L}']+\b/gu) || [];
  if (tokens.length < 3) return null;
  const scores = {};
  for (const [lang, words] of Object.entries(LANG_STOPWORDS)) {
    let hits = 0;
    for (const w of words) if (tokens.includes(w)) hits += 1;
    scores[lang] = hits;
  }
  for (const [lang, re] of Object.entries(LANG_DIACRITICS)) {
    if (re.test(t)) scores[lang] = (scores[lang] || 0) + 2;
  }
  let best = null, bestScore = 0, runnerUp = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) { runnerUp = bestScore; bestScore = score; best = lang; }
    else if (score > runnerUp) { runnerUp = score; }
  }
  // Require both a minimum signal and a meaningful gap so we don't flip on
  // ambiguous prose (e.g. a German loan-word in English).
  if (bestScore < 2 || bestScore - runnerUp < 2) return null;
  return best;
}

// Strip OpenAI's internal "Harmony"/tool-call syntax that occasionally leaks
// into a streamed `delta.content` (e.g. `to=functions.atlassian__search_issues`,
// `<|channel|>`, `assistantfinal`). When the model drifts mid-stream these
// tokens get emitted as visible text — we filter them so the user only sees
// real assistant prose.
function sanitizeStreamDelta(s) {
  if (!s) return s;
  return s
    .replace(/to=functions\.[A-Za-z0-9_]+/g, '')
    .replace(/<\|[^|>]*\|>/g, '')
    .replace(/\b(?:assistantfinal|assistantcommentary|analysisfinal)\b/gi, '');
}

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

// Per-turn context carried implicitly through async resources so we don't
// have to thread `branchId` through every helper signature. Set at the top
// of `runOrchestratedTurn`; read by `rpc()` and any tool dispatch that needs
// to scope an MCP to the active Staffbase tenant.
const turnContext = new AsyncLocalStorage();

async function rpc(baseUrl, endpoint, method, params, token, userId) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${token}`,
  };
  // Forwarded to all internal MCPs; harmless for ones that don't need it.
  // mcp-atlassian uses it to look up the user's stored access token.
  if (userId) headers['X-Companion-User-Id'] = userId;
  // The active Staffbase tenant comes from the per-turn AsyncLocalStorage
  // frame. The staffbase MCP reads ?branch= to scope every tool call to the
  // right workspace; other MCPs ignore the param.
  const branchId = turnContext.getStore()?.branchId || null;
  const url = branchId
    ? `${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}branch=${encodeURIComponent(branchId)}`
    : `${baseUrl}${endpoint}`;
  const res = await fetch(url, {
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

// Dispatch a JSON-RPC call to the right transport based on `connector.kind`.
//
//   - `remote` → talk to a third-party MCP server (Staffbase MCP-proxy etc.)
//     over the Streamable HTTP transport with a cached session id. Settings
//     (URL, API token) come from navigator_config via turnContext.
//   - everything else → existing path; speaks JSON-RPC to a Vercel-local
//     `/api/mcp-*` route using a mock bearer.
//
// One entry point keeps the four orchestrator call sites symmetric and
// avoids leaking `connector.kind` checks everywhere downstream.
async function dispatchMcp(connector, method, params, { baseUrl, mockBearer, userId }) {
  if (connector?.kind === 'remote') {
    const store = turnContext.getStore() || {};
    const settings = store.connectorSettings?.[connector.id] || null;
    const mcpUrl = settings?.mcpUrl || connector.endpoint;
    if (!settings?.apiToken) {
      throw new Error(`${connector.name} is not configured — set the API token in Studio.`);
    }
    const authHeader = buildAuthHeader({
      apiToken: settings.apiToken,
      authMode: settings.authMode || 'basic',
      cookieName: settings.cookieName,
    });
    return await mcpCall({ url: mcpUrl, authHeader, method, params });
  }
  return await rpc(baseUrl, connector.endpoint, method, params, mockBearer, userId);
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

// Decide whether we're inside the hackathon-trivia flow. When true, routing is
// pinned to atlassian so terse answers like "C" don't get misclassified as
// out-of-scope. Two distinct conditions trigger this:
//   (1) START: the user's LATEST message explicitly asks to begin trivia.
//   (2) MID-FLOW: the most recent assistant/tool turn carries trivia state
//       (Q1/Q2/Q3 markers, AIW- issue ids, mystery-X prompts, create_issue
//       tool calls). User turns are excluded from this check because we don't
//       want stray "Q3 OKRs" or "trivia night" mentions to false-positive.
function detectHackathonFlow(history) {
  const recent = (history || []).slice(-8);
  const lastUserText = rowToText([...recent].reverse().find((m) => m.role === 'user') || {});
  const START = /\b(start (the )?hackathon( trivia)?|hackathon trivia|let'?s play (the )?(hackathon |hackathon trivia|trivia)|trivia time|begin (the )?trivia)\b/i;
  if (START.test(lastUserText)) return true;

  const STATE = /Q[123]\.|trivia score|score:\s*\d+|mystery teammate|mystery post|mystery channel|AIW-/i;
  return recent.some((row) => {
    if (row?.role !== 'assistant' && row?.role !== 'tool' && row?.role !== 'system') return false;
    const text = rowToText(row);
    if (STATE.test(text)) return true;
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

  const systemContent = loadPrompt('classifier', { connectors: domainMap });

  const resp = await openai.chat.completions.create({
    // Classifier stays on gpt-4o-mini — gpt-5-mini is too conservative here
    // and drops legitimate directory/tool questions into general_chat.
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: systemContent },
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
    const result = await dispatchMcp(connector, 'tools/list', {}, { baseUrl, mockBearer, userId });
    return result?.tools || [];
  } catch (err) {
    // Remote MCPs that aren't configured yet are NOT an error — they just
    // contribute no tools. Log at info to keep the boot logs clean.
    if (connector?.kind === 'remote' && /not configured/i.test(err.message || '')) {
      console.info(`[orchestrator] ${connector.id} skipped: ${err.message}`);
    } else {
      console.error(`[orchestrator] loadInternalTools(${connector.id}):`, err.message);
    }
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

const TIER1_MAX_WORKFLOWS = 8;
const TIER1_MAX_EXPERTS = 8;

async function routeTier1({ openai, scope, history, lastUserText: lastUserTextStr }) {
  // Note: we deliberately do NOT short-circuit on notable-word overlap with
  // flow triggers. That was a constant source of hallucinated flow starts —
  // e.g. "Check recent announcements" matching a "Storefront opening check"
  // flow because both contain "check". The LLM router below sees every flow
  // (with name, goal, trigger text, and notable keywords) alongside every
  // assistant and picks semantically.

  // No assistants AND no flows → general_chat with no scope.
  if (!scope.experts.length && !scope.workflows.length) {
    return { kind: 'general_chat', ids: [], id: null, confidence: 1, reasoning: 'no Studio assistants or flows configured', clarifyPrompt: '', clarifyOptions: [] };
  }

  // Build compact catalogs for the LLM. Flows surface their FULL goal +
  // trigger description (not just notable keywords) so the router can tell
  // whether the user is actually invoking that specific multi-step process
  // vs. just asking a question that happens to share a word with the
  // trigger phrase ("check", "report", "get").
  const flowChoices = scope.workflows.slice(0, TIER1_MAX_WORKFLOWS).map((f) => ({
    id: f.id,
    name: f.name,
    mode: f.mode || 'suggested',
    goal: (f.goal || '').replace(/\s+/g, ' ').slice(0, 160),
    trigger: (f.trigger || '').replace(/\s+/g, ' ').slice(0, 160),
    keywords: notableWordsForRouting(f.trigger).slice(0, 6),
  }));
  // Per-connector view: surface each connector's identity, useWhen, dontUseFor,
  // keywords, examples to the router — NOT a merged "domain bag". Pooling
  // collapsed the very signal the router needs to disambiguate overlapping
  // connectors (e.g. "tickets" belongs to both IT Helpdesk and Atlassian/Jira).
  const connectorLabel = (c) => c.kind === 'toolkit'
    ? `${c.id} MCP`
    : c.kind === 'handoff'
      ? `agent:${c.id}`
      : c.kind === 'search'
        ? `KB:${c.id}`
        : c.id;

  const asstChoices = scope.experts.slice(0, TIER1_MAX_EXPERTS).map((a) => {
    const connectors = [];
    for (const id of a.connectionIds || []) {
      const c = scope.connectionById[id];
      if (!c) continue;
      // Prefer admin-edited `keywords` if present; otherwise fall back to the
      // seed-provided `domains`. Cap at 10 so a long array doesn't blow the
      // prompt for an assistant with 4 connectors.
      const kwSource = (Array.isArray(c.keywords) && c.keywords.length) ? c.keywords : (c.domains || []);
      const keywords = kwSource.slice(0, 10);
      connectors.push({
        label: connectorLabel(c),
        name: c.name || c.id,
        kind: c.kind,
        useWhen: (c.useWhen || '').slice(0, 200),
        dontUseFor: (c.dontUseFor || '').slice(0, 160),
        keywords,
        examples: (Array.isArray(c.examples) ? c.examples : []).slice(0, 3),
      });
    }
    return {
      id: a.id,
      name: a.name,
      description: (a.description || '').slice(0, 120),
      // Bumped from 250 → 600. The Campsite Assistant's PEOPLE routing rule
      // ("All 'who is X' questions are yours") lives past char 250 — without
      // this, the router can't see the strongest single signal it has.
      instructions: (a.instructions || '').replace(/\s+/g, ' ').slice(0, 600),
      connectors: connectors.slice(0, 6),
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
      // Tried gpt-5-mini briefly — it failed the strict json_schema call and
      // dumped everything into general_chat ("router failed" in the trace).
      // gpt-4o-mini reliably emits this schema; the slug-recovery shim below
      // patches the slug-vs-UUID flakiness we used to see.
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'router_decision',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'ids', 'confidence', 'reasoning', 'clarifyPrompt', 'clarifyOptions'],
            properties: {
              kind: { type: 'string', enum: ['flow', 'assistants', 'clarify', 'general_chat', 'out_of_scope'] },
              ids: { type: 'array', items: { type: 'string' } },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              reasoning: { type: 'string' },
              // Populated only when kind === 'clarify'. Empty string / empty
              // array otherwise (strict-schema requires the keys to be present).
              clarifyPrompt: { type: 'string' },
              clarifyOptions: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'label'],
                  properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      messages: [
        {
          role: 'system',
          content: `You are the top-level router for an enterprise employee assistant. Pick the BEST option(s) for the user's most recent message. You MAY pick MULTIPLE assistants when the message clearly spans more than one persona's domain.

Choices:
- "flow" — an admin-defined GUIDED MULTI-STEP workflow (forms, photos, confirms, a fixed sequence of tool calls). Pick AT MOST ONE. Pick "flow" ONLY when the user is clearly invoking that specific guided process — not just because a single keyword overlaps. For free-form questions answerable with a tool ("what's new", "find X", "check Y status"), pick "assistants" instead so the agentic loop can choose the right tool. Flow options:
${flowChoices.length ? flowChoices.map((f) => {
  const bits = [
    f.goal ? `goal: ${f.goal}` : null,
    f.trigger ? `trigger: ${f.trigger}` : null,
    f.keywords.length ? `keywords: ${f.keywords.join(', ')}` : null,
    `mode: ${f.mode}`,
  ].filter(Boolean);
  return `  • ${f.id} ("${f.name}"; ${bits.join('; ')})`;
}).join('\n') : '  (none)'}
- "assistants" — one OR MORE topic-scoped personas. Multiple OK when the message clearly spans personas. Options:
${asstChoices.length ? asstChoices.map((a) => {
  const connectorLines = a.connectors.length
    ? a.connectors.map((c) => {
        const parts = [];
        if (c.useWhen) parts.push(`use when: ${c.useWhen}`);
        if (c.dontUseFor) parts.push(`don't use for: ${c.dontUseFor}`);
        if (c.keywords.length) parts.push(`keywords: ${c.keywords.join(', ')}`);
        if (c.examples.length) parts.push(`e.g. ${c.examples.map((e) => `"${e}"`).join(', ')}`);
        return `        - ${c.label} ("${c.name}", ${c.kind})\n          ${parts.join('; ')}`;
      }).join('\n')
    : '        (no connectors)';
  return `  • ${a.id} ("${a.name}" — ${a.description})\n      instructions excerpt: "${a.instructions || ''}"\n      connectors:\n${connectorLines}`;
}).join('\n') : '  (none)'}
- "clarify" — pick this ONLY when 2+ assistants/connectors plausibly own the request and the user's words don't pick between them. Return 2-3 \`clarifyOptions\` where each option's \`id\` is an assistant UUID from the list above and \`label\` is short, connector-shaped text (e.g. "IT Helpdesk: my open tickets" / "Jira: my open issues"). Set \`clarifyPrompt\` to one short sentence asking the user which one they meant.
- "general_chat" — chit-chat / greeting / clarifying question; no scope needed.
- "out_of_scope" — the request is clearly outside what an enterprise assistant should handle.

Return STRICT JSON matching the schema: {"kind": "...", "ids": [...], "confidence": 0..1, "reasoning": "one sentence", "clarifyPrompt": "", "clarifyOptions": []}. The clarifyPrompt / clarifyOptions fields MUST be present in every response — leave them as "" and [] when kind is not "clarify".

ID rules:
- "ids" MUST be the exact id strings from the options above — copy them verbatim. Do NOT slugify, lowercase, or rephrase the name. If an option's id is "0a8b6c12-…-9f", you MUST return "0a8b6c12-…-9f", not "campsite-expert".
- Tokens inside connector lines — like "atlassian MCP", "intranet MCP", "hr_portal MCP", "KB:xyz", "agent:abc" — are connector identifiers, NOT valid ids. You must NEVER put those tokens in the "ids" array. Pick the assistant's UUID, not its connectors.
- For "flow": exactly ONE id.
- For "assistants": 1-3 ids. Include MULTIPLE when the user's message clearly needs more than one persona's pool (see cross-domain rules below).
- For "clarify": "ids" MUST be empty []; put the 2-3 assistant UUIDs in "clarifyOptions" instead.
- For "general_chat" / "out_of_scope": empty array.

Example A (illustrative — your real options are listed above):
- Options: "assistants" → "8e1f2a73-4d52-49c1-b6c1-ab90c2fda917" ("Campsite Expert" — connectors include intranet MCP)
- User: "Who is the new VP of Marketing?"
- Correct output: {"kind":"assistants","ids":["8e1f2a73-4d52-49c1-b6c1-ab90c2fda917"],"confidence":0.9,"reasoning":"people lookup belongs with the intranet-owning expert","clarifyPrompt":"","clarifyOptions":[]}
- WRONG outputs you must NOT emit: {"ids":["campsite-expert"]} or {"ids":["Campsite Expert"]} or {"kind":"flow","ids":["8e1f2a73-..."]}.

Example B (connector-token mistake — DO NOT do this):
- Options: "assistants" → "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e" ("Atlassian Ops" — connectors include atlassian MCP)
- User: "Show me open Jira tickets that are assigned to me"
- Correct output: {"kind":"assistants","ids":["1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e"],"confidence":0.95,"reasoning":"Jira lookup → atlassian-owning expert","clarifyPrompt":"","clarifyOptions":[]}
- WRONG output (this is the failure we are protecting against): {"ids":["atlassian"]} — "atlassian" is a connector token, not an assistant id.

Example C (clarify pattern — use when overlap is real):
- Options: two assistants — "AAAA-..." owns "it_helpdesk MCP" (use when: IT support tickets); "BBBB-..." owns "atlassian MCP" (use when: Jira/Confluence).
- User: "Show me my tickets"
- Correct output: {"kind":"clarify","ids":[],"confidence":0.5,"reasoning":"'tickets' applies to both IT Helpdesk and Jira","clarifyPrompt":"Which kind of ticket — IT support or a Jira issue?","clarifyOptions":[{"id":"AAAA-...","label":"IT Helpdesk: my open tickets"},{"id":"BBBB-...","label":"Jira: my open issues"}]}

Disambiguation — read each connector's "use when" / "don't use for" / "keywords" / examples to decide. The user's words map directly onto those fields. When two connectors both seem plausible (their use-when both touch the same noun, e.g. "ticket", "issue", "page", "doc") AND no strong-signal keyword picks one over the other, prefer "clarify" over guessing. But: if ONE connector has a strong-signal keyword the other lacks (e.g. "Jira ticket" → atlassian alone, "VPN ticket" → it_helpdesk alone), pick that assistant directly — do NOT clarify.

Cross-domain — return MULTIPLE assistant ids (kind: "assistants") when the message clearly needs more than one pool:
- "WFH policy AND any recent leadership memos" → hr-style assistant + intranet-style assistant.
- "Open IT tickets AND any recent IT memos" → it-style assistant + intranet-style assistant.
- "What's the parental leave policy and is there a recent announcement about it?" → hr-style + intranet-style.
- "Show me my open Jira issues and any related Confluence docs" → atlassian-owning assistant (one is fine, both signals already live in atlassian).
Do not "clarify" cross-domain requests — those want both assistants to run.

Other rules:
- Prefer "flow" over "assistants" ONLY when the user's intent semantically matches the flow's GOAL (not just a single keyword). Good examples: "I need a new laptop" → laptop-request flow; "submit my expenses" → expense-submission flow; "I'm opening the storefront, do the daily check" → storefront-opening flow. BAD examples (do NOT pick flow here): "check recent announcements" / "check my open tickets" / "find the marketing lead" — these are general questions and belong with the relevant assistant, even if a flow's trigger contains the word "check" or "find". When in doubt between flow and assistants, pick assistants.
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
    if (!['flow', 'assistants', 'clarify', 'general_chat', 'out_of_scope'].includes(kind)) kind = 'general_chat';
    // Accept both new {ids:[]} and legacy {id:"x"} shapes.
    const rawIds = Array.isArray(parsed.ids)
      ? parsed.ids
      : (parsed.id ? [parsed.id] : []);
    // gpt-4o-mini routinely misroutes in three ways:
    //   (1) emits a slugified name ("campsite-expert") instead of the UUID,
    //   (2) emits the right UUID but the wrong `kind` (e.g. labels an expert
    //       UUID as kind:"flow"),
    //   (3) emits a connector reference ("atlassian", "intranet") that it
    //       picked up from the "owns:" hint, instead of the expert UUID.
    // We resolve names AND connector refs to UUIDs, then if the LLM's `kind`
    // doesn't match where those UUIDs live, we flip `kind` to the pool the ids
    // belong to. The router already saw the right options — these recoveries
    // just patch up presentation glitches before they cascade into general_chat.
    const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const expertSlugToId = new Map();
    for (const a of scope.experts) {
      const k = slug(a.name);
      if (k) expertSlugToId.set(k, a.id);
    }
    const flowSlugToId = new Map();
    for (const f of scope.workflows) {
      const k = slug(f.name);
      if (k) flowSlugToId.set(k, f.id);
    }
    // Connector → expert recovery. If the LLM hands us a connector token like
    // "atlassian", map it to the first expert that owns that connector.
    // Also key on c.provider (e.g. OAuth providers like "atlassian" that may
    // differ from c.id) so a needs-auth or differently-named connection still
    // resolves. Fall through to the full config catalog so an expert whose
    // connector is OAuth-pending in scope still gets matched.
    const connectorRefToExpertId = new Map();
    const addTokens = (a, c) => {
      for (const token of [c.id, slug(c.id), slug(c.name), c.provider, slug(c.provider)]) {
        if (token && !connectorRefToExpertId.has(token)) connectorRefToExpertId.set(token, a.id);
      }
    };
    const allConnectionsById = scope.connectionById || {};
    const needsAuthById = Object.fromEntries((scope.needsAuth || []).map((c) => [c.id, c]));
    for (const a of scope.experts) {
      for (const cid of a.connectionIds || []) {
        const c = allConnectionsById[cid] || needsAuthById[cid];
        if (!c) continue;
        addTokens(a, c);
      }
    }
    const resolveExpertRef = (x) => {
      if (validAsstIds.has(x)) return x;
      const k = slug(x);
      return expertSlugToId.get(k) || connectorRefToExpertId.get(x) || connectorRefToExpertId.get(k) || null;
    };
    const resolveFlowRef = (x) => validFlowIds.has(x) ? x : flowSlugToId.get(slug(x)) || null;

    // Kind-correction pass. If the LLM picked "flow" but the ids resolve to
    // experts (or vice versa), flip `kind`. Only fires when one side resolves
    // cleanly and the other is empty — keeps ambiguous cases on the LLM's call.
    if (kind === 'flow' || kind === 'assistants') {
      const asExperts = rawIds.map(resolveExpertRef).filter(Boolean);
      const asFlows = rawIds.map(resolveFlowRef).filter(Boolean);
      if (kind === 'flow' && asFlows.length === 0 && asExperts.length > 0) kind = 'assistants';
      else if (kind === 'assistants' && asExperts.length === 0 && asFlows.length > 0) kind = 'flow';
    }

    let ids = [];
    let clarifyPrompt = '';
    let clarifyOptions = [];
    if (kind === 'flow') {
      const first = rawIds.map(resolveFlowRef).find(Boolean);
      ids = first ? [first] : [];
    } else if (kind === 'assistants') {
      ids = [...new Set(rawIds.map(resolveExpertRef).filter(Boolean))].slice(0, 3);
    } else if (kind === 'clarify') {
      // Clarify: resolve each option's id through the same recovery shim so
      // slugs/connector tokens still land on a real assistant. Drop options
      // that can't be resolved; demote to general_chat if fewer than 2 remain.
      const rawOptions = Array.isArray(parsed.clarifyOptions) ? parsed.clarifyOptions : [];
      const resolved = [];
      const seen = new Set();
      for (const opt of rawOptions) {
        if (!opt || typeof opt !== 'object') continue;
        const resolvedId = resolveExpertRef(opt.id);
        if (!resolvedId || seen.has(resolvedId)) continue;
        const label = typeof opt.label === 'string' ? opt.label.trim().slice(0, 60) : '';
        if (!label) continue;
        seen.add(resolvedId);
        resolved.push({ id: resolvedId, label });
        if (resolved.length >= 3) break;
      }
      if (resolved.length < 2) {
        return {
          kind: 'general_chat', ids: [], id: null, confidence: 0.3,
          reasoning: `router asked to clarify but returned <2 resolvable options (raw: ${JSON.stringify(rawOptions).slice(0, 80)})`,
        };
      }
      clarifyOptions = resolved;
      clarifyPrompt = String(parsed.clarifyPrompt || '').trim().slice(0, 200)
        || 'Which one did you mean?';
    }
    if ((kind === 'flow' || kind === 'assistants') && !ids.length) {
      // Decide whether the raw ids looked like a known connector reference
      // (e.g. "atlassian") that just doesn't map to any wired-up expert, vs.
      // genuinely unknown tokens. The first case gets a clearer trace so the
      // UI doesn't show a misleading "general chat" reasoning.
      const knownConnectorTokens = new Set();
      for (const c of scope.connections || []) {
        for (const t of [c.id, slug(c.id), slug(c.name), c.provider, slug(c.provider)]) {
          if (t) knownConnectorTokens.add(t);
        }
      }
      const wasConnectorRef = rawIds.some((x) => knownConnectorTokens.has(x) || knownConnectorTokens.has(slug(x)));
      return {
        kind: 'general_chat', ids: [], id: null, confidence: 0.3,
        reasoning: wasConnectorRef
          ? `router named a connector (${JSON.stringify(rawIds).slice(0, 60)}) instead of an assistant — handling as general chat`
          : `router returned no valid ids (raw: ${JSON.stringify(rawIds).slice(0, 80)})`,
      };
    }
    const primaryName = kind === 'flow'
      ? scope.workflowById[ids[0]]?.name
      : kind === 'assistants'
        ? scope.expertById[ids[0]]?.name
        : null;
    return {
      kind,
      ids,
      id: ids[0] || null,
      name: primaryName || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      reasoning: String(parsed.reasoning || '').slice(0, 200),
      clarifyPrompt,
      clarifyOptions,
    };
  } catch (err) {
    console.warn('[orchestrator] Tier1 routing failed:', err.message);
    return { kind: 'general_chat', ids: [], id: null, confidence: 0.1, reasoning: 'router failed', clarifyPrompt: '', clarifyOptions: [] };
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

// Connectors that every assistant gets implicitly, regardless of per-assistant
// wiring. The Staffbase Intranet MCP exposes find_user / get_user_profile /
// search_posts — capabilities almost every assistant needs at some point.
// Adding them ambiently means: (1) admins don't have to wire them, (2) profile
// lookups always work, (3) an assistant with no other tools can still answer
// people questions instead of looping with clarification chips.
const AMBIENT_CONNECTOR_CATALOG_IDS = new Set(['staffbase_intranet']);

// Build the Tier-2 tool catalog from the chosen scope (assistants or flow).
// Returns { assistant?, assistants?, flow?, connectors[] (unified, de-duped),
// allowedToolIds?, blueprint }. The orchestrator walks `connectors` and
// dispatches per `kind`.
function buildTier2Catalog({ scope, kind, ids, blueprint }) {
  const idList = Array.isArray(ids) ? ids : (ids ? [ids] : []);
  if (kind === 'flow') {
    const flow = scope.workflowById[idList[0]];
    if (!flow) return null;
    const pairs = resolveWorkflowScope(flow, scope);
    const connectionIds = new Set(pairs.map((p) => p.connectionId));
    const connectors = [...connectionIds].map((cid) => scope.connectionById[cid]).filter(Boolean);
    // Restrict the tool catalog to exactly the {connection, tool} pairs the
    // workflow lists. Implicit-tool connections (handoff: 'invoke',
    // search: 'search') still pass through because the seed lists them
    // explicitly.
    const allowedToolIds = new Set(pairs.filter((p) => p.toolId).map((p) => `${p.connectionId}__${p.toolId}`));
    return { flow, assistants: [], connectors, allowedToolIds, blueprint };
  }
  if (kind === 'assistants' || kind === 'assistant') {
    const assistants = idList.map((id) => scope.expertById[id]).filter(Boolean);
    if (!assistants.length) return null;
    // Merge connector ids across every chosen assistant, de-duped.
    const connectionIds = new Set();
    for (const asst of assistants) {
      for (const cid of resolveExpertScope(asst, scope)) connectionIds.add(cid);
    }
    // Ambient connectors — the Staffbase Intranet MCP carries people-lookup
    // (find_user, get_user_profile) and intranet content search. Every
    // assistant gets it for free so admins don't have to wire it manually
    // and so name/profile questions never dead-end with "I can't look that up".
    for (const c of scope.connections || []) {
      if (AMBIENT_CONNECTOR_CATALOG_IDS.has(c.catalogId)) connectionIds.add(c.id);
    }
    const connectors = [...connectionIds].map((cid) => scope.connectionById[cid]).filter(Boolean);
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
// ── Flow step machine ────────────────────────────────────────────────────────
//
// Drives an admin-defined flow's explicit `steps[]`. Persists run state via a
// `flowExec` system message at every pause/completion. Form/confirm steps
// pause the turn (emit form_request / confirm_request and return); tool steps
// run to completion inline.

function findActiveFlowRun(history) {
  // Most-recent `flowExec` system message wins.
  for (let i = (history || []).length - 1; i >= 0; i--) {
    const row = history[i];
    if (row.role === 'system' && row.content && typeof row.content === 'object' && row.content.flowExec) {
      return row.content.flowExec;
    }
  }
  return null;
}

// Build the system-message payload that captures both the run state AND
// enough flow metadata for the chat UI to hydrate a FlowTimeline on reload.
function persistedFlowState(flow, run, interaction = null) {
  return {
    flowExec: run,
    flowSnapshot: {
      id: flow.id,
      name: flow.name,
      goal: flow.goal,
      mode: flow.mode,
      steps: flow.steps.map((s) => ({
        id: s.id, type: s.type, label: s.label,
        spec: (s.type === 'form' || s.type === 'photo') ? s.spec : undefined,
        summary: s.type === 'confirm' ? s.summary : undefined,
      })),
      interaction,
    },
  };
}

function flowStepSummary(step, output) {
  if (!step) return '';
  if (step.type === 'form') {
    const fields = step.spec?.fields || [];
    return fields
      .map((f) => {
        const v = output?.[f.id];
        if (v === undefined || v === null || v === '') return null;
        return `${f.label}: ${v}`;
      })
      .filter(Boolean)
      .join(' · ');
  }
  if (step.type === 'confirm') return output?.confirmed ? 'Confirmed' : '';
  if (step.type === 'photo') {
    if (!output) return '';
    const v = output.validation;
    if (!v) return 'Photo captured';
    const heading = v.passed
      ? 'Looks good'
      : (output.acceptedDespiteFail ? 'Continued with issues' : 'Issues found');
    return `${heading} — ${v.summary || ''}`.trim();
  }
  if (step.type === 'tool') {
    if (output?.error) return `Error: ${output.error}`;
    if (typeof output === 'string') return output.slice(0, 120);
    return 'Done';
  }
  return '';
}

async function executeFlowToolStep({
  step, run, scope, baseUrl, staffbaseUserId, userProfile, userText, emit,
}) {
  // Accept either new `connectionId` or legacy `connectorId` on the step payload.
  const refId = step.tool?.connectionId || step.tool?.connectorId;
  const connector = scope.connectionById?.[refId];
  if (!connector) {
    return { error: `Unknown connection: ${refId}` };
  }
  const mockBearer = buildMockBearer(staffbaseUserId);
  const resolved = resolveTokens(step.args || {}, run.stepOutputs);

  const toolCallId = `flow_${run.flowId}_${step.id}_${Date.now()}`;
  emit({
    type: 'tool_start',
    toolCallId,
    name: step.tool?.toolId || 'tool',
    connector: connector.id,
    connectorKind: connector.kind,
    connectorName: connector.name,
    connectorColor: connector.color || null,
    args: resolved,
  });

  let result;
  try {
    if (connector.kind === 'handoff') {
      const params = {
        id: `task-${Date.now()}`,
        message: { role: 'user', parts: [{ type: 'text', text: String(resolved.message || userText || '') }] },
        metadata: { user: { id: staffbaseUserId, email: userProfile?.email || null } },
      };
      result = await rpc(baseUrl, connector.endpoint || '/api/a2a', 'tasks/send', params, mockBearer);
    } else {
      const toolName = connector.kind === 'search' ? 'search' : (step.tool?.toolId || 'invoke');
      result = await dispatchMcp(connector, 'tools/call', { name: toolName, arguments: resolved }, { baseUrl, mockBearer, userId: null });
      if (result?.content) {
        const text = result.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
        try { result = JSON.parse(text); } catch { result = text; }
      }
    }
  } catch (err) {
    result = { error: err.message || String(err) };
  }
  emit({ type: 'tool_result', toolCallId, name: step.tool?.toolId, connector: connector.id, result });
  return result;
}

// Returns:
//   { status: 'paused' }     — waiting on user input; flowExec persisted
//   { status: 'completed' }  — flow finished
//   { status: 'error', error } — fatal error; flow run cancelled
async function runFlowStepMachine({
  openai, flow, run, scope, baseUrl, staffbaseUserId, userProfile, userText,
  emit, onAssistantMessage, onSystemMessage,
  sessionLang = null, inputModality = 'text',
}) {
  let cur = { ...run };

  while (cur.currentStepIndex < flow.steps.length && cur.status === 'running') {
    const step = flow.steps[cur.currentStepIndex];

    if (step.type === 'form') {
      // Resolve {{token}} references in the user-facing parts of the form
      // spec so "lookup-then-form" flows can echo prior step outputs back
      // to the user (e.g. "I see you have a MacBook Pro 13 — what next?").
      const resolvedSpec = {
        ...step.spec,
        title: typeof step.spec?.title === 'string' ? resolveTokens(step.spec.title, cur.stepOutputs) : step.spec?.title,
        description: typeof step.spec?.description === 'string' ? resolveTokens(step.spec.description, cur.stepOutputs) : step.spec?.description,
        fields: (step.spec?.fields || []).map((f) => ({
          ...f,
          description: typeof f.description === 'string' ? resolveTokens(f.description, cur.stepOutputs) : f.description,
          placeholder: typeof f.placeholder === 'string' ? resolveTokens(f.placeholder, cur.stepOutputs) : f.placeholder,
          defaultValue: typeof f.defaultValue === 'string' ? resolveTokens(f.defaultValue, cur.stepOutputs) : f.defaultValue,
        })),
      };
      cur.awaiting = { kind: 'form', stepId: step.id };
      cur.status = 'awaiting_user';
      // Voice → forms bulk-extract. Before showing the FormCard, ask
      // gpt-4o-mini to pull whatever fields the user already said into
      // initialValues. The visible form is the safety gate — voice never
      // auto-submits. We always run this (not just voice mode) because
      // typed users also benefit from the assistant doing the parsing.
      let initialValues = cur.stepOutputs[step.id] || null;
      let extractedFieldIds = [];
      try {
        const extract = await extractFormValues({
          openai,
          fields: resolvedSpec.fields || [],
          recentText: userText,
          lang: sessionLang,
          existingValues: initialValues,
        });
        initialValues = extract.values && Object.keys(extract.values).length ? extract.values : initialValues;
        extractedFieldIds = extract.extractedFieldIds || [];
      } catch (err) {
        console.warn('[orchestrator] form-extract failed:', err.message);
      }
      emit({
        type: 'form_request',
        flowId: flow.id, stepId: step.id, label: step.label,
        spec: resolvedSpec,
        initialValues,
        extractedFieldIds,
      });
      emit({ type: 'flow_step', flowId: flow.id, stepIndex: cur.currentStepIndex + 1, totalSteps: flow.steps.length, label: step.label, status: 'awaiting_user', stepId: step.id });
      await onSystemMessage?.(persistedFlowState(flow, cur, { kind: 'form', stepId: step.id, spec: resolvedSpec, initialValues, extractedFieldIds }));
      emit({ type: 'done', awaitingForm: true });
      return { status: 'paused', run: cur };
    }

    if (step.type === 'confirm') {
      // Resolve token references in summary rows.
      const resolvedSummary = {
        ...step.summary,
        rows: (step.summary?.rows || []).map((r) => ({
          label: r.label,
          value: typeof r.value === 'string' ? resolveTokens(r.value, cur.stepOutputs) : r.value,
        })),
      };
      cur.awaiting = { kind: 'confirm', stepId: step.id };
      cur.status = 'awaiting_user';
      emit({
        type: 'confirm_request',
        flowId: flow.id, stepId: step.id, label: step.label,
        summary: resolvedSummary,
      });
      emit({ type: 'flow_step', flowId: flow.id, stepIndex: cur.currentStepIndex + 1, totalSteps: flow.steps.length, label: step.label, status: 'awaiting_user', stepId: step.id });
      await onSystemMessage?.(persistedFlowState(flow, cur, { kind: 'confirm', stepId: step.id, summary: resolvedSummary }));
      emit({ type: 'done', awaitingConfirm: true });
      return { status: 'paused', run: cur };
    }

    if (step.type === 'photo') {
      // Two-phase pause:
      //   capture — fresh entry; emit photo_request and wait for upload
      //   review  — set up by the photo_validate dispatch (which already
      //             emitted photo_result with the autoAdvanced flag); we
      //             just pause and persist here without re-emitting.
      const resolvedSpec = resolveTokens(step.spec, cur.stepOutputs);
      const isReview = cur.awaiting && cur.awaiting.kind === 'photo'
        && cur.awaiting.stepId === step.id && cur.awaiting.phase === 'review';
      if (!isReview) {
        cur.awaiting = { kind: 'photo', stepId: step.id, phase: 'capture' };
      }
      cur.status = 'awaiting_user';
      const interaction = isReview
        ? {
            kind: 'photo', stepId: step.id, spec: resolvedSpec, phase: 'review',
            imageDataUrl: cur.awaiting.imageDataUrl,
            imageWidth: cur.awaiting.imageWidth,
            imageHeight: cur.awaiting.imageHeight,
            mimeType: cur.awaiting.mimeType,
            validation: cur.awaiting.validation,
          }
        : { kind: 'photo', stepId: step.id, spec: resolvedSpec, phase: 'capture' };
      if (!isReview) {
        emit({
          type: 'photo_request',
          flowId: flow.id, stepId: step.id, label: step.label,
          spec: resolvedSpec,
        });
      }
      emit({ type: 'flow_step', flowId: flow.id, stepIndex: cur.currentStepIndex + 1, totalSteps: flow.steps.length, label: step.label, status: 'awaiting_user', stepId: step.id });
      await onSystemMessage?.(persistedFlowState(flow, cur, interaction));
      emit({ type: 'done', awaitingPhoto: true });
      return { status: 'paused', run: cur };
    }

    if (step.type === 'tool') {
      const result = await executeFlowToolStep({
        step, run: cur, scope, baseUrl, staffbaseUserId, userProfile, userText, emit,
      });
      cur.stepOutputs = { ...cur.stepOutputs, [step.id]: result };
      emit({
        type: 'flow_step',
        flowId: flow.id, stepIndex: cur.currentStepIndex + 1, totalSteps: flow.steps.length,
        label: step.label, status: 'done', stepId: step.id,
        summary: flowStepSummary(step, result),
      });
      cur = advance(cur);
      // Continue to next step
      continue;
    }

    // Unknown step type — skip.
    cur = advance(cur);
  }

  cur = complete(cur, 'Flow completed');
  emit({
    type: 'flow_completed',
    flowId: flow.id,
    summary: 'All steps completed.',
  });

  // Compose a short final assistant message summarising the run for the chat.
  let finalText = '';
  try {
    const lastFormOutput = (() => {
      for (let i = flow.steps.length - 1; i >= 0; i--) {
        const s = flow.steps[i];
        if (s.type === 'form') return { step: s, values: cur.stepOutputs[s.id] || {} };
      }
      return null;
    })();
    const summaryRow = lastFormOutput
      ? lastFormOutput.step.spec.fields
          .map((f) => {
            const v = lastFormOutput.values[f.id];
            return v ? `${f.label}: ${v}` : null;
          })
          .filter(Boolean)
          .join(' · ')
      : '';
    finalText = summaryRow
      ? `Done — ${flow.name}. ${summaryRow}.`
      : `Done — ${flow.name}.`;
    emit({ type: 'delta', content: finalText });
  } catch { /* non-fatal */ }

  await onAssistantMessage?.({ role: 'assistant', content: finalText });
  await onSystemMessage?.(persistedFlowState(flow, cur));
  emit({ type: 'done', final: finalText });
  return { status: 'completed', run: cur };
}

async function runStudioDrivenTurn({
  openai, userId, staffbaseUserId, userProfile, baseUrl, history, emit,
  onAssistantMessage, onToolResult, onSystemMessage, studio,
  userConnections = new Set(),
  flowSubmission = null,
  sessionLang = null,
  inputModality = 'text',
}) {
  const startedAt = Date.now();
  const user = userToAudience(userProfile);
  const scope = materializeActiveScope({
    config: studio.config,
    experts: studio.experts,
    user,
    userConnections,
  });
  const blueprint = studio.blueprint || null;
  const tenantName = studio.config?.tenantOverrides?.name || 'Staffbase';

  const userText = lastUserText(history);

  // ── Step-machine resume — if a prior turn paused a flow on a form/confirm
  // and the client sent a submission, drive the machine forward instead of
  // running the regular Tier-1 router.
  if (flowSubmission) {
    const existingRun = findActiveFlowRun(history);
    const flowsCfg = (studio.config?.workflows || studio.config?.flows || []);
    const flow = flowsCfg.find((f) => f.id === (existingRun?.flowId || flowSubmission.flowId));
    if (existingRun && flow && flow.steps?.length) {
      let nextRun = { ...existingRun };
      const advancedFromIdx = existingRun.currentStepIndex;
      if (flowSubmission.kind === 'form') {
        nextRun = applyFormSubmission(flow, nextRun, flowSubmission.stepId, flowSubmission.values || {});
      } else if (flowSubmission.kind === 'confirm') {
        nextRun = applyConfirmResponse(flow, nextRun, flowSubmission.stepId, !!flowSubmission.accepted, flowSubmission.cancelTo);
      } else if (flowSubmission.kind === 'photo_validate') {
        // Run the vision model against the submitted photo. The verdict
        // drives the flow per the step's `onFail` policy:
        //   passed                 → auto-advance (no review prompt)
        //   failed + onFail=allow  → auto-advance (advisory only)
        //   failed + onFail=warn   → pause in review with retake / continue
        //   failed + onFail=block  → pause in review with retake only
        const photoStep = flow.steps.find((s) => s.id === flowSubmission.stepId);
        const validation = photoStep?.type === 'photo'
          ? await validatePhoto({
              openai,
              imageDataUrl: flowSubmission.imageDataUrl,
              mimeType: flowSubmission.mimeType,
              spec: photoStep.spec,
            })
          : { passed: false, summary: 'Unknown photo step.', criteria: [], annotations: [] };
        const onFail = photoStep?.spec?.onFail || 'warn';
        const shouldAutoAdvance = validation.passed || onFail === 'allow';

        // Stage the photo + validation in `awaiting` so persisted state and
        // downstream tokens have it regardless of whether we pause or advance.
        nextRun = applyPhotoValidation(flow, nextRun, flowSubmission.stepId, {
          imageDataUrl: flowSubmission.imageDataUrl,
          imageWidth: flowSubmission.imageWidth,
          imageHeight: flowSubmission.imageHeight,
          mimeType: flowSubmission.mimeType,
          validation,
        });

        // Always tell the client what the AI said — even when auto-advancing,
        // so the timeline can render the thumbnail + summary on the completed
        // step. The `autoAdvanced` flag tells the client whether to render a
        // review card or transition the photo step to done.
        emit({
          type: 'photo_result',
          flowId: flow.id,
          stepId: flowSubmission.stepId,
          spec: photoStep?.spec || null,
          imageDataUrl: flowSubmission.imageDataUrl,
          imageWidth: flowSubmission.imageWidth,
          imageHeight: flowSubmission.imageHeight,
          mimeType: flowSubmission.mimeType,
          validation,
          autoAdvanced: shouldAutoAdvance,
          onFail,
        });

        if (shouldAutoAdvance) {
          nextRun = applyPhotoAccept(flow, nextRun, flowSubmission.stepId, {
            acceptedDespiteFail: !validation.passed,
          });
        }
      } else if (flowSubmission.kind === 'photo_accept') {
        nextRun = applyPhotoAccept(flow, nextRun, flowSubmission.stepId, {
          acceptedDespiteFail: !!flowSubmission.acceptedDespiteFail,
        });
      } else if (flowSubmission.kind === 'photo_retake') {
        nextRun = applyPhotoRetake(flow, nextRun, flowSubmission.stepId);
      }
      emit({
        type: 'flow_started',
        flowId: flow.id, name: flow.name,
        mode: flow.mode || 'suggested',
        goal: flow.goal || '',
        totalSteps: flow.steps.length,
        steps: flow.steps.map((s) => ({ id: s.id, type: s.type, label: s.label })),
        resumed: true,
      });
      // Mark the form/confirm step as done in the UI. The runner only emits
      // 'done' for tool steps; form/confirm steps are completed implicitly
      // when the run advances past them.
      if (nextRun.currentStepIndex > advancedFromIdx) {
        const completedStep = flow.steps[advancedFromIdx];
        if (completedStep) {
          emit({
            type: 'flow_step',
            flowId: flow.id,
            stepIndex: advancedFromIdx + 1,
            totalSteps: flow.steps.length,
            label: completedStep.label,
            status: 'done',
            stepId: completedStep.id,
            summary: flowStepSummary(completedStep, nextRun.stepOutputs[completedStep.id]),
          });
        }
      }
      return await runFlowStepMachine({
        openai, flow, run: nextRun, scope, baseUrl,
        staffbaseUserId, userProfile, userText,
        emit, onAssistantMessage, onSystemMessage,
        sessionLang, inputModality,
      });
    }
    // Submission for a flow we can't find — fall through to normal handling.
  }

  // ── New-flow detection happens semantically inside `routeTier1` below.
  //
  // We used to have a deterministic word-overlap shortcut here
  // (matchesFlowTrigger) that fired a flow whenever any ≥5-char notable word
  // overlapped with the flow's trigger. That was brittle: any flow whose
  // trigger contained a common verb like "check", "get", "find", "report"
  // would hijack unrelated queries (e.g. "Check recent announcements"
  // matching a "Storefront opening **check**" flow). The shortcut also ran
  // before the LLM router got a chance to weigh the user's actual intent
  // against the full set of choices (flows + assistants + general chat).
  //
  // Instead, the LLM-driven Tier-1 router (`routeTier1` below) sees every
  // active flow alongside every active assistant and chooses semantically.
  // It still has access to each flow's name, goal, trigger text, and
  // notable keywords — strong intentional matches ("I need a new laptop"
  // → laptop-request flow) still win, but stray keyword overlap doesn't.

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

  if (tier1.kind === 'clarify') {
    // Router decided two+ assistants plausibly own the request. Ask the user
    // to pick instead of guessing. The chip's label encodes a connector hint
    // (e.g. "IT Helpdesk: my open tickets") so the next turn's router has
    // strong keywords to pick the right assistant deterministically.
    emit({ type: 'trace_route', tier1, tier2: null, fallbackUsed: false });
    const options = Array.isArray(tier1.clarifyOptions) ? tier1.clarifyOptions : [];
    const headline = (tier1.clarifyPrompt || 'Which one did you mean?').trim();
    const chips = options.map((o) => o.label).filter(Boolean);
    const suggestionsLine = chips.length
      ? `<suggestions>${JSON.stringify(chips)}</suggestions>`
      : '';
    const final = suggestionsLine ? `${headline}\n${suggestionsLine}` : headline;
    emit({ type: 'delta', content: final });
    await onAssistantMessage?.({ role: 'assistant', content: final });
    emit({ type: 'done', final });
    return { status: 'done', final };
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

  const activeExperts = Array.isArray(catalog.assistants) && catalog.assistants.length
    ? catalog.assistants
    : (catalog.assistant ? [catalog.assistant] : []);
  const activeExpert = activeExperts[0] || null;
  const activeWorkflow = catalog.flow || null;

  if (activeExperts.length) {
    // Emit one per assistant so existing UI badges still render. Add a
    // combined event when there's more than one so a future UI can show a
    // "running as N personas" strip.
    for (const a of activeExperts) {
      emit({ type: 'expert_selected', expertId: a.id, name: a.name, icon: a.icon || null });
    }
    if (activeExperts.length > 1) {
      emit({
        type: 'experts_selected',
        assistants: activeExperts.map((a) => ({ id: a.id, name: a.name, icon: a.icon || null })),
      });
    }
  }
  // Step-machine flows (admin authored explicit `steps[]`) need their own
  // runner — they pause on forms/photos/confirms and don't go through the
  // agentic-loop tool catalog. Hand off here. Legacy tool-list flows (tools[]
  // only) keep flowing into the agentic loop below.
  if (activeWorkflow && Array.isArray(activeWorkflow.steps) && activeWorkflow.steps.length > 0) {
    const newRun = makeInitialRun(activeWorkflow);
    emit({
      type: 'trace_route',
      tier1,
      tier2: { scope: 'flow', toolPool: [], connectors: [] },
      fallbackUsed: false,
    });
    emit({
      type: 'flow_started',
      flowId: activeWorkflow.id, name: activeWorkflow.name,
      mode: activeWorkflow.mode || 'suggested',
      goal: activeWorkflow.goal || '',
      totalSteps: activeWorkflow.steps.length,
      steps: activeWorkflow.steps.map((s) => ({ id: s.id, type: s.type, label: s.label })),
    });
    return await runFlowStepMachine({
      openai, flow: activeWorkflow, run: newRun, scope, baseUrl,
      staffbaseUserId, userProfile, userText,
      emit, onAssistantMessage, onSystemMessage,
      sessionLang, inputModality,
    });
  }
  if (activeWorkflow) {
    const totalSteps = (activeWorkflow.tools || []).length;
    emit({
      type: 'flow_started',
      flowId: activeWorkflow.id, name: activeWorkflow.name,
      mode: activeWorkflow.mode || 'suggested',
      goal: activeWorkflow.goal || '',
      totalSteps,
    });
  }

  // ── Tool catalog (Tier 2) ──────────────────────────────────────────────
  // Unified pass over `catalog.connectors`. Each connector contributes 1+ tools:
  //   kind: 'toolkit'   — every tool in connector.tools[], filtered by flow.allowedToolIds
  //   kind: 'handoff' — exactly one synthetic ${id}__invoke tool (dispatched via tasks/send)
  //   kind: 'search'    — exactly one synthetic ${id}__search tool (dispatched via tools/call)
  const mockBearer = buildMockBearer(staffbaseUserId);
  const openaiTools = [];
  const toolMap = {}; // namespacedName → { connector, toolName }

  for (const connector of catalog.connectors) {
    if (connector.kind === 'handoff') {
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
    if (connector.kind === 'search') {
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
    // kind === 'toolkit' / 'remote' — fetch tools/list dynamically.
    let toolList = [];
    try {
      const result = await dispatchMcp(connector, 'tools/list', {}, { baseUrl, mockBearer, userId });
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

  // Bundle the trace into a single payload we both emit (for the live
  // stream) and stash on the first assistant message of this turn (so it
  // round-trips through the messages table and survives a reload).
  const tracePayload = {
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
  };
  let traceAttached = false;
  emit({ type: 'trace_route', ...tracePayload });

  // If the chosen scope references a connector the admin enabled but the
  // user hasn't OAuth-linked, surface a one-tap connect card before the
  // agentic loop kicks in.
  const scopeRefIds = new Set();
  if (activeWorkflow) {
    for (const t of activeWorkflow.tools || []) {
      const cid = typeof t === 'string' ? t : (t?.connectionId || t?.connectorId);
      if (cid) scopeRefIds.add(cid);
    }
  } else if (activeExperts.length) {
    for (const a of activeExperts) {
      for (const cid of a.connectionIds || []) scopeRefIds.add(cid);
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

  // System prompt — pass unified connections plus the search subset (for the
  // "grounding sources" block) so the LLM knows when to call search tools.
  // NOTE: the system-prompt builder uses `workflow` and `connections` after the
  // big rename; the orchestrator used to pass `flow:` / `connectors:` here,
  // which silently defaulted to null/[] and stripped persona + tool context
  // out of the prompt — that's why the model would fall back to fabricating
  // answers in general_chat.
  const systemPrompt = buildStudioSystemPrompt({
    blueprint,
    activeExpert,
    activeExperts,
    workflow: activeWorkflow,
    user: { id: staffbaseUserId, ...userProfile, ...user },
    connections: catalog.connectors,
    tenantName,
    epic: process.env.HACKATHON_JIRA_EPIC_KEY || null,
    lang: sessionLang,
    inputModality,
  });

  // ── Agentic loop ───────────────────────────────────────────────────────
  let messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(rowToOpenAi).filter(Boolean),
  ];
  let toolCount = 0;
  let flowStepIndex = 0;
  const totalFlowSteps = activeWorkflow ? (activeWorkflow.tools || []).length : 0;

  // If there are no tools and not in general_chat (e.g. assistant with no
  // connectors), still let the model reply with a stream — it can answer
  // from KB context in the system prompt.
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      emit({ type: 'truncated', reason: 'time' });
      break;
    }
    // Main agentic loop runs on Sonnet for tool-call reliability. Routes through
    // the OpenAI-shaped shim in lib/ai-client.mjs → Anthropic on Azure AI Foundry.
    const params = { model: MODELS.SMART, messages, stream: true };
    if (openaiTools.length) { params.tools = openaiTools; params.tool_choice = 'auto'; }

    const stream = await openai.chat.completions.create(params);
    let roundText = '';
    let toolCalls = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        const cleaned = sanitizeStreamDelta(delta.content);
        if (cleaned) { roundText += cleaned; emit({ type: 'delta', content: cleaned }); }
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
      if (!traceAttached) { assistantMsg.trace = tracePayload; traceAttached = true; }
      messages.push(assistantMsg);
      await onAssistantMessage?.(assistantMsg);
      if (activeWorkflow) {
        emit({ type: 'flow_completed', flowId: activeWorkflow.id, summary: roundText.slice(0, 200) });
      }
      emit({ type: 'done', final: roundText });
      return { status: 'done', final: roundText };
    }

    // Persist assistant with tool calls
    const assistantMsg = { role: 'assistant', content: roundText || null, tool_calls: toolCalls };
    if (!traceAttached) { assistantMsg.trace = tracePayload; traceAttached = true; }
    messages.push(assistantMsg);
    await onAssistantMessage?.(assistantMsg);

    // Write-confirm — only MCP connectors expose write tools. Agents and KBs
    // are write-safe by definition.
    const writeCalls = toolCalls.filter((tc) => {
      const entry = toolMap[tc.function.name];
      if (!entry || entry.connector.kind !== 'toolkit') return false;
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
      if (connector.kind === 'handoff') {
        emit({
          type: 'handoff',
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
        if (connector.kind === 'handoff') {
          // JSON-RPC tasks/send to the agent endpoint.
          const params = {
            id: `task-${Date.now()}`,
            message: { role: 'user', parts: [{ type: 'text', text: String(args.message || userText || '') }] },
            metadata: { user: { id: staffbaseUserId, email: userProfile?.email || null } },
          };
          result = await rpc(baseUrl, connector.endpoint || '/api/a2a', 'tasks/send', params, mockBearer, userId);
        } else {
          // kind === 'toolkit' | 'remote' | 'kb' — all speak standard JSON-RPC tools/call.
          result = await dispatchMcp(connector, 'tools/call', { name: toolName, arguments: args }, { baseUrl, mockBearer, userId });
          if (result?.content) {
            const text = result.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
            try { result = JSON.parse(text); } catch { result = text; }
          }
          // The Staffbase MCP-proxy returns raw API JSON; the chat UI needs
          // a `cards` field to render the pretty post/user/channel components.
          if (connector.id === 'intranet' && connector.kind === 'remote' && result && typeof result === 'object') {
            result = adaptIntranetResult(toolName, result, { query: args?.query });
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
      if (connector.kind === 'search' && result && typeof result === 'object' && Array.isArray(result.results)) {
        for (const hit of result.results) {
          emit({
            type: 'source_citation',
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
        content: serializeToolResultForModel(result),
      };
      messages.push(toolMsg);
      await onToolResult?.(toolMsg, { name: toolName, connector: connector.id, args, result });

      if (activeWorkflow) {
        flowStepIndex++;
        const label = connector.kind === 'handoff'
          ? `Handed off to ${connector.name}`
          : connector.kind === 'search'
            ? `Searched ${connector.name}`
            : friendlyToolLabel(toolName);
        emit({ type: 'flow_step', flowId: activeWorkflow.id, stepIndex: flowStepIndex, totalSteps: totalFlowSteps, label, toolCallId: tc.id });
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

// Wraps the inner implementation in the per-turn AsyncLocalStorage frame
// (currently just `branchId`, used by `rpc()` to scope MCP calls to the
// active Staffbase tenant). Keeps the inner function signature unchanged
// so deep helpers don't need to thread a new parameter.
export async function runOrchestratedTurn(params) {
  // Per-tenant connector settings (Staffbase MCP-proxy URL/token etc.)
  // ride along in the AsyncLocalStorage frame so `dispatchMcp` doesn't
  // need an extra parameter at every call site.
  const connectorSettings = params?.studio?.config?.tenantOverrides?.connectorSettings || {};
  return await turnContext.run(
    { branchId: params?.branchId || null, connectorSettings },
    () => _runOrchestratedTurn(params),
  );
}

async function _runOrchestratedTurn({
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
  // Flow-step submission from the client (form or confirm response).
  flowSubmission = null,
  // Voice context. sessionLang is sticky per-conversation (set on first
  // confident STT detection and on explicit "switch language" intents).
  // inputModality nudges the system prompt toward TTS-friendly prose.
  sessionLang = null,
  inputModality = 'text',
}) {
  const startedAt = Date.now();
  const active = await loadActiveConnectors(userId);
  const activeIds = new Set(active.map((c) => c.id));
  emit({ type: 'trace_connectors', connectors: active.map((c) => ({ id: c.id, name: c.name, color: c.color, kind: c.kind })) });

  // Detect explicit "switch to <language>" turns BEFORE we route, so a single
  // user message can both change the language and have the rest of the reply
  // honor it. The /chat handler already persisted the inbound lang from the
  // client; this catches in-conversation switches that the client didn't
  // pre-signal.
  //
  // Two distinct signals:
  //   - explicit switch ("auf Deutsch", "switch to German") → silent flip +
  //     soft confirmation banner in the UI (`language_switched`).
  //   - drift (user types in a language ≠ sessionLang without saying so) →
  //     emit `language_drift_detected`; the UI renders chips so the user
  //     can confirm. Do NOT flip sessionLang here.
  if (!flowSubmission) {
    const last = lastUserText(history);
    const switched = detectLanguageSwitch(last);
    if (switched && switched !== sessionLang) {
      const prevLang = sessionLang;
      sessionLang = switched;
      emit({ type: 'language_switched', lang: switched, prevLang, source: 'explicit' });
      await onSystemMessage?.({ session_lang: switched, source: 'in_conversation_switch' });
    } else if (sessionLang) {
      const detected = detectMessageLanguage(last);
      if (detected && detected !== sessionLang) {
        emit({ type: 'language_drift_detected', detectedLang: detected, currentLang: sessionLang });
      }
    }
  }

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
      onAssistantMessage, onToolResult, onSystemMessage, studio,
      userConnections, flowSubmission, sessionLang, inputModality,
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
    // Conversational reply, no tools. gpt-4o-mini matches the agentic loop's
    // model — gpt-5-mini was producing multilingual sampling drift here.
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
      const c = sanitizeStreamDelta(ch.choices[0]?.delta?.content);
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

      // gpt-4o-mini — see note on the Studio-driven loop above; gpt-5-mini
      // Sub-assistant streaming loop — same Sonnet model as the main loop.
      const params = { model: MODELS.SMART, messages, stream: true };
      if (openaiTools.length) { params.tools = openaiTools; params.tool_choice = 'auto'; }

      const stream = await openai.chat.completions.create(params);

      let roundText = '';
      let toolCalls = [];
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          const cleaned = sanitizeStreamDelta(delta.content);
          if (cleaned) {
            roundText += cleaned;
            emit({ type: 'delta', content: cleaned });
          }
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
          content: serializeToolResultForModel(result),
        };
        messages.push(toolMsg);
        await onToolResult?.(toolMsg, { name: entry.originalName, connector: entry.connector.id, args, result });
      }
  }
  emit({ type: 'truncated', reason: 'rounds' });
  return { status: 'truncated' };
}

// Produce the version of a tool result that goes into the LLM message stream.
// The UI already consumed `result.cards` via the `card` event before this
// runs, so:
//  1. Strip `cards` from what the model sees — keeping it just tempts the
//     model to enumerate fields the user already sees as visual cards.
//  2. For list-shaped card payloads (user_grid, leaderboard, etc.), slim the
//     `raw` items to minimal references (id + name + 1 disambiguating field).
//     The model can still reason about and reference results, but it can't
//     parrot title/department/email/etc. back in prose.
//  3. Inject a short `_ui` note in place of the stripped cards, so the model
//     sees a per-result reminder right next to the data.
function serializeToolResultForModel(result) {
  if (result == null) return 'null';
  if (typeof result === 'string') return result;
  if (typeof result !== 'object') return JSON.stringify(result);
  const { cards, ...rest } = result;
  if (!cards || typeof cards !== 'object') return JSON.stringify(result);

  const cardType = cards.type || 'card';
  const out = { ...rest };
  out._ui = `A ${cardType} card is already rendered for the user above your reply. Don't repeat its data in prose — one short framing sentence is plenty.`;

  // List-shaped payloads: slim per-item details so the model can reference
  // results by name without enumerating every field.
  if (cardType === 'user_grid' && Array.isArray(rest.raw?.users)) {
    out.raw = {
      ...rest.raw,
      users: rest.raw.users.map((u) => ({
        id: u.id,
        name: u.name,
        title: u.title || null,
      })),
    };
  } else if (cardType === 'leaderboard' && Array.isArray(rest.raw?.items)) {
    out.raw = {
      ...rest.raw,
      items: rest.raw.items.map((it) => ({
        id: it.id,
        name: it.name,
        score: it.score ?? it.value ?? it.count ?? null,
      })),
    };
  } else if (cardType === 'issue_list' && Array.isArray(rest.issues)) {
    out.issues = rest.issues.map((i) => ({
      key: i.key,
      summary: i.summary || null,
      status: i.status || null,
      assignee: i.assignee || null,
    }));
  } else if (cardType === 'issue') {
    // Single issue: keep key+summary for the model to reference; details are
    // on the card.
    out.summary = rest.summary || null;
    out.status = rest.status || null;
    delete out.description;
    delete out.bodyRaw;
  } else if (cardType === 'page_list' && Array.isArray(rest.pages)) {
    out.pages = rest.pages.map((p) => ({
      id: p.id,
      title: p.title || null,
      spaceId: p.spaceId || null,
    }));
  } else if (cardType === 'page') {
    delete out.body;
    delete out.bodyRaw;
  } else if (cardType === 'project_list' && Array.isArray(rest.projects)) {
    out.projects = rest.projects.map((p) => ({
      id: p.id,
      key: p.key || null,
      name: p.name || null,
    }));
  } else if (cardType === 'project_list' && Array.isArray(rest.spaces)) {
    out.spaces = rest.spaces.map((s) => ({
      id: s.id,
      key: s.key || null,
      name: s.name || null,
    }));
  } else if (cardType === 'article_list' && Array.isArray(rest.articles)) {
    out.articles = rest.articles.map((a) => ({
      id: a.id || null,
      title: a.title || null,
      category: a.category || null,
    }));
  }
  return JSON.stringify(out);
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
    `When a tool result contains a "_ui" note, a visual card is already rendered for the user. Your prose answer should be a SHORT framing line (e.g. "Here's what I found for Martin:" or "Martin Böhringer is most likely who you meant."), not a copy of the card data. Never enumerate the card's items in markdown — no bullet lists of name/title/department/email/avatar images, since those are visible on the cards already. Still emit the trailing <suggestions> block as usual.`,
    `BROADER ANTI-DUPLICATION RULE — even when no "_ui" note is present, if a tool returned structured records (list of issues, pages, posts, articles, users, projects, search hits), DO NOT enumerate them as a markdown bullet list in your reply. The tool-call panel is the canonical display. Lead with a short framing line (who/what/how many/why-it-matters) and reference items by key/title only when you single one out. Never re-render the full list as prose.`,
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
