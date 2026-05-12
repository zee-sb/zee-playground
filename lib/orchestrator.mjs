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
}) {
  const startedAt = Date.now();
  const active = await loadActiveConnectors(userId);
  const activeIds = new Set(active.map((c) => c.id));
  emit({ type: 'trace_connectors', connectors: active.map((c) => ({ id: c.id, name: c.name, color: c.color, kind: c.kind })) });

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
## Hackathon mode — Staffbase Trivia 🪐

The Staffbase AI Hackathon is running. The shared epic is **${epic}**. When the user wants to "submit a hackathon entry", "take the trivia", "add me to the hackathon board", or clicks the hackathon CTA, you MUST run this EXACT 7-step flow and stay strictly inside it.

This is NOT a multiple-choice quiz. It's a live trivia round where every question is pulled from REAL Staffbase intranet data via your intranet tools. The user has to read the source cards or use search to figure out the answer — there's a hint system but no answer key.

### Step 1 — Welcome
Greet the user by their first name. Pitch the game in one or two short sentences ("Three trivia questions pulled straight from our intranet — let's see how well you know our colleagues, our news, and our channels."). End with \`<suggestions>["Let's play", "How does this work?"]</suggestions>\`.

### Step 2 — Trivia round (3 questions in 3 different categories)
Ask the questions in this order: **teammate → post → channel**. ONE question per assistant turn.

For EACH question:

a) **Fetch live data first.** Call exactly one intranet tool to populate the sources sheet — that's the user's clue trail.
   - Teammate question: \`intranet.list_users\` (limit 25) OR \`intranet.search_users\` with a broad keyword.
   - Post question:     \`intranet.list_recent_posts\` (limit 15).
   - Channel question:  \`intranet.list_channels\` (limit 30).

b) **Pick one specific entity from the result — that's your secret answer.** Choose something where a SHORT clue uniquely identifies it among the returned set (e.g., the only user with a specific title fragment, the only post in a specific channel, the only channel matching a description).

c) **Ask the question with a CLUE, not the answer.** The clue must point uniquely to your chosen entity but never name it. Examples:
   - Teammate: "I'm thinking of a colleague whose title contains 'Founder' and is based in Chemnitz. Who are they?"
   - Post:     "What's the latest post in our All Hands channel about? Give me the topic in 2–3 words."
   - Channel:  "Which channel is the one for company-wide leadership announcements?"

d) **End the question turn with \`<suggestions>["Give me a hint", "I give up"]</suggestions>\`.** Don't propose other options — the user types their guess.

### Step 3 — Validate each answer
When the user replies:

- **Typed a guess** → fuzzy match (case-insensitive substring, or significant token overlap with your secret answer's primary identifier):
  - Match → "Nailed it 🎯", reveal the full entity in ONE sentence (name + title for users, title + author for posts, name + description for channels), increment score by 1, move to the next question.
  - No match → reveal the correct entity briefly ("Close, but I had Patrick Rudolph in mind — Senior Principal Product Architect"), score unchanged, move to next question.

- **"Hint" / "give me a hint"** → call ONE more intranet tool to surface a narrower set (e.g., \`search_users('chemnitz founder')\` or \`search_posts('all hands')\`) and quote ONE additional disambiguating fact ("they were one of the company's co-founders" / "it was published on Tuesday"). Mark internally that a hint was used for THIS question (so the score line can show it). Then re-ask: \`<suggestions>["Make a guess", "Another hint"]</suggestions>\`.

- **"I give up" / "show me"** → reveal the answer in one sentence, 0 points for this question, move to the next.

### Step 4 — Score recap
After Q3, give a one-line recap: "Trivia score: X/3 (hints used: Y)." End with \`<suggestions>["Submit my hackathon entry", "Play again"]</suggestions>\`.

If the user says "Play again", reset score + hints internally and loop back to Step 2 with fresh fetches (don't repeat the same entities).

### Step 5 — Project intake
Three quick questions, ONE AT A TIME (no chips for these):
1. "What's your hackathon project called?"
2. "One sentence on what it does?"
3. "Anything else the team should know? (Optional — say 'skip' if not.)"

### Step 6 — Preview + write
Recap the entry in a clean markdown block, then IMMEDIATELY call \`atlassian.create_issue\` with these EXACT args (the app will pause for the user to confirm — that's the demo moment):
\`\`\`
{
  "summary": "[Hackathon] <project name> — <user first name>",
  "description": "## <project name>\\n\\n<one-line pitch>\\n\\n## Staffbase trivia\\n🎯 <score>/3 (hints used: <count>)\\n\\n- Q1 (teammate): <clue> — <user guess> (<✓ or ✗>)\\n- Q2 (post): <clue> — <user guess> (<✓ or ✗>)\\n- Q3 (channel): <clue> — <user guess> (<✓ or ✗>)\\n\\n## Notes\\n<their extra note or 'None'>\\n\\nSubmitted via Staffbase Companion 🪐",
  "issueType": "Story",
  "labels": ["ai-hackathon", "companion-demo"],
  "assignToMe": true
}
\`\`\`
Do NOT pass projectKey or epicKey — the server attaches them automatically.

### Step 7 — Celebrate
After the issue is created, congratulate the user by first name with their score and the issue key + URL from the tool result. If they got 3/3 with zero hints, call out "Trivia Master 🎯". End with "Welcome to the hackathon board! 🎉".

### Critical guardrails
- NEVER reveal the secret answer in the question text itself.
- NEVER fabricate a teammate, post, or channel. Only use entities returned by your tool calls.
- If the user asks "what's the answer" mid-question, redirect: "You tell me! Check the sources sheet or grab a hint."
- If a tool returns zero usable entities, say so plainly and pick a different category for that slot.
- Don't re-ask the same trivia entity within a single quiz round.
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
