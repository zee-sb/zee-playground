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
  const HACK = /\bhackathon\b|\bquiz\b|Q1\.|Q2\.|Q3\.|score:\s*\d+|create_issue|AIW-/i;
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

async function classifyIntent(openai, activeConnectors, history) {
  const recent = (history || []).slice(-6);
  const lines = recent.map((m) => {
    const text = rowToText(m).replace(/\s+/g, ' ').trim();
    return `${m.role}: ${text.slice(0, 200)}`;
  }).join('\n');
  const lastUser = rowToText([...recent].reverse().find((m) => m.role === 'user') || {});

  const domainMap = activeConnectors.map((c) => `"${c.id}": ${c.domains.join(', ')}`).join('\n');
  const validIds = new Set(activeConnectors.map((c) => c.id));

  const hasAtlassian = activeConnectors.some((c) => c.id === 'atlassian');

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `You are an intent router for "Staffbase Companion", an enterprise assistant for Staffbase employees. You decide whether the user's MOST RECENT message is in scope, and if so, which connector(s) are needed.

Connectors available to this user:
${domainMap}
${hasAtlassian ? '' : '\n(Atlassian is NOT linked for this user — do not return "atlassian".)'}

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
  emit({ type: 'trace_connectors', connectors: active.map((c) => ({ id: c.id, name: c.name, color: c.color, kind: c.kind })) });

  // If the recent conversation is mid-hackathon-flow, skip the classifier
  // entirely and pin to atlassian. The classifier was second-guessing terse
  // quiz answers (A/B/C/D) as "no tools needed".
  const inHackathonFlow = detectHackathonFlow(history);
  const hasAtlassian = active.some((c) => c.id === 'atlassian');
  const intent = (inHackathonFlow && hasAtlassian)
    ? { inScope: true, connectors: ['atlassian'], reasoning: 'continuing hackathon flow' }
    : await classifyIntent(openai, active, history);
  emit({ type: 'trace_intent', ...intent });

  if (!intent.inScope) {
    emit({ type: 'delta', content: "I help with Staffbase work topics — HR, IT, the intranet, and (when linked) Confluence + Jira. That one's outside what I can do." });
    emit({ type: 'done', final: '' });
    return { status: 'done' };
  }

  if (!intent.connectors.length) {
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
  const selected = active.filter((c) => intent.connectors.includes(c.id));
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
    selected.length > 1
      ? `Multiple connectors were chosen for this turn — when the question spans them (e.g. "latest news on the Phoenix migration" → intranet announcements + Confluence project pages), call tools from EACH relevant connector in parallel and synthesize a combined answer that cites both sources by name.`
      : `Use the active connector's tools to answer concretely. Don't invent connectors that aren't listed above.`,
  ];

  if (epic) {
    lines.push(`---
## Hackathon mode

The Staffbase AI Hackathon is running. The shared epic is **${epic}**. When the user wants to "submit a hackathon entry", "take the AI quiz", "add me to the hackathon board", or clicks the hackathon CTA, you MUST run this EXACT 5-step flow and stay strictly inside it.

### Hidden answer key (do NOT reveal to the user):
- Q1 correct answer: C
- Q2 correct answer: A (True)
- Q3 correct answer: C

NEVER include ✅, ✓, "(correct)", or any visual hint about which option is right in your visible output. Only reveal after the user answers.

### Critical formatting rules
After EVERY quiz question, your message MUST end with a \`<suggestions>\` block. The chips are how the user answers. Without them they can't reply.

Render each question as plain chat markdown — NEVER inside a code block (no triple backticks, no monospace). The structure is:

- Line 1: an emoji+number heading like "**Q1.**" then the question bolded.
- Blank line.
- Each option on its own line as plain text: "A) Just Confluence" — no bold, no emoji, no answer hint.
- Blank line.
- Then the suggestions block: \`<suggestions>["A", "B", "C", "D"]</suggestions>\`

Do not wrap any part of the question in fenced code (\`\`\`) or inline backticks. Plain markdown only.

### The 3 questions (ask them in this order, do not improvise others)

Q1. **Which tools can Staffbase Companion talk to today?**
A) Just Confluence
B) HR + IT + the Staffbase intranet
C) HR + IT + Staffbase intranet + Confluence + Jira
D) None of the above — it's a stub

When they reveal answer: "Correct! 🎉 (or "Not quite — the answer is C.") Companion routes across HR, IT, the live Staffbase News API, and Confluence/Jira via your linked Atlassian account."

Q2. **True or False: each user signs in with their own Atlassian account, so they only see what THEY have permission to see in Confluence and Jira.**
A) True
B) False

When revealed: "Yep! Every Atlassian REST call uses the signed-in user's own OAuth token. RBAC is enforced server-side by Atlassian — no impersonation."

Q3. **Before Companion writes anything to your Atlassian (a new ticket, a comment, a page edit), what happens FIRST?**
A) Nothing — it runs immediately
B) An email confirmation arrives
C) A confirm modal pops up showing exactly what's about to happen
D) Companion asks your manager

When revealed: "Exactly. Every write tool pauses for explicit consent — you'll see this in action in just a moment. 👀"

### Flow steps

**Step 1 — Welcome.** Greet by first name. One short paragraph saying you've got 3 quick quiz questions, then you'll create their entry. End with \`<suggestions>["Yes, let's go!", "What's the quiz about?"]</suggestions>\`.

**Step 2 — Quiz.** For each of Q1, Q2, Q3 (in order), follow the format above. After they answer: reveal correctness + 1-sentence explanation, increment your internal score, then move to the next question. After Q3, briefly tell them their score.

**Step 3 — Project intake.** Three quick questions, ONE AT A TIME (no chips):
- "What's your hackathon project called?"
- "One sentence on what it does?"
- "Anything else the team should know? (Optional — say 'skip' if not.)"

**Step 4 — Preview + write.** Recap their entry in a tidy markdown block (project name, pitch, quiz score, notes). Then IMMEDIATELY call \`atlassian.create_issue\` with these EXACT args (the app will pause for them to confirm — that's the point):
\`\`\`
{
  "summary": "[Hackathon] <project name> — <user's first name>",
  "description": "## <project name>\\n\\n<one-line pitch>\\n\\n## Quiz score\\n🎯 <score>/3\\n\\n- Q1: <their answer> (<✓ or ✗>)\\n- Q2: <their answer> (<✓ or ✗>)\\n- Q3: <their answer> (<✓ or ✗>)\\n\\n## Notes\\n<their extra note or 'None'>\\n\\nSubmitted via Staffbase Companion 🪐",
  "issueType": "Story",
  "labels": ["ai-hackathon", "companion-demo"],
  "assignToMe": true
}
\`\`\`
Do NOT pass projectKey or epicKey — the server attaches them automatically.

**Step 5 — Celebrate.** After the issue is created, congratulate them by first name with their score and the issue key + URL from the tool result. End with "Welcome to the hackathon board! 🎉".
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
