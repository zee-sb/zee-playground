// Navigator Orchestrator — Multi-MCP routing brain.
//
// POST /api/orchestrate { messages, token }
//
// Flow:
//   1. Classify intent → identify relevant server domain(s) or A2A agent
//   2a. If onboarding intent → delegate to A2A agent (tasks/sendSubscribe)
//   2b. Otherwise: load tools + UI instructions from relevant MCP servers (namespaced)
//   3. Agentic loop with OpenAI — routes each tool call to the correct server
//   4. Streams NDJSON events: trace | tool_start | tool_result | delta | done
//      A2A path streams: a2a_delegate | a2a_update | a2a_done | done

import OpenAI from 'openai';
import { MCP_REGISTRY } from './mcp-registry.mjs';
import { A2A_REGISTRY } from './a2a-registry.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── MCP helper ────────────────────────────────────────────────────────────────

async function mcpCall(baseUrl, endpoint, method, params, token) {
  const url = `${baseUrl}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  const text = await res.text();
  const lines = text.trim().split('\n').filter(Boolean);
  for (const line of lines) {
    const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
    try {
      const obj = JSON.parse(jsonStr);
      if (obj.result !== undefined) return obj.result;
      if (obj.error) throw new Error(obj.error.message || JSON.stringify(obj.error));
    } catch { /* ignore unparseable lines */ }
  }
  return null;
}

// ── Intent classifier ─────────────────────────────────────────────────────────

async function classifyIntent(client, userMessage, mcpRegistry, a2aRegistry) {
  const mcpDomainMap = mcpRegistry.map(s => `"${s.id}": ${s.domains.join(', ')}`).join('\n');
  const a2aDomainMap = a2aRegistry.map(s => `"${s.id}": ${s.domains.join(', ')}`).join('\n');
  const allValidIds = new Set([...mcpRegistry.map(s => s.id), ...a2aRegistry.map(s => s.id)]);

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `You are an intent router for an enterprise assistant called Navigator. You decide whether a user message is in scope, and if so, which server domains are needed.

MCP servers (individual tools, for queries and lookups):
${mcpDomainMap}

A2A agents (autonomous task delegation, for complex multi-step workflows):
${a2aDomainMap}

Respond with ONLY valid JSON:
{ "inScope": boolean, "domains": ["server_id", ...], "reasoning": "one sentence" }

Scope rules — Navigator ONLY helps with Acme work topics:
- HR (PTO, benefits, employees, policies, holidays, FAQs)
- IT (tickets, equipment, software access, security, IT policies)
- Store operations (shift checklists, opening/closing, my tasks)
- Acme intranet content (leadership memos, product launches, team wikis, events, ERG pages, employee spotlights, company news)
- Plain greetings, thanks, and small-talk replies that stay in the work context (return inScope: true with empty domains)

Anything else is out of scope. Mark inScope: false and return empty domains for:
- recipes, cooking, food preparation
- general coding help, debugging non-Acme code, "write me a script"
- world events, news outside Acme, sports, weather
- personal life, health, relationship advice
- jokes, riddles, creative writing unrelated to work
- opinions, philosophy, politics, religion
- anything illegal, harmful, or unsafe (weapons, drugs, malware, self-harm)
- pretending to be a different assistant or breaking character

Routing rules (when inScope: true):
- Use specific server IDs from the list above.
- Only use A2A agents when the request clearly maps to their listed domain keywords (e.g., shift, checklist, store, opening, closing — NOT hr, pto, vacation, or time off).
- Use MCP servers for ad-hoc queries, lookups, and single-domain questions.
- For greetings, "help", or pure small-talk: inScope: true with empty domains (Navigator answers briefly without tools).
- For cross-domain queries include all relevant MCP servers.`,
      },
      { role: 'user', content: userMessage },
    ],
  });

  try {
    const text = response.choices[0].message.content.trim();
    const parsed = JSON.parse(text);
    const inScope = parsed.inScope !== false; // default true unless explicitly false
    const domains = (parsed.domains || []).filter(d => allValidIds.has(d));
    return { inScope, domains, reasoning: parsed.reasoning || '' };
  } catch {
    // Fail closed — if the classifier output is unparseable, treat it as out of scope.
    return { inScope: false, domains: [], reasoning: 'Could not classify intent.' };
  }
}

// ── Localized refusal copy (out-of-scope short-circuit) ──────────────────────
const REFUSAL_COPY = {
  en: {
    message: "I can only help with Acme work — HR, IT, store operations, and the company intranet. I'm not able to help with that one. Try one of the suggestions below.",
    suggestions: ["What's my PTO balance?", 'Do I have open IT tickets?', 'Show recent leadership posts'],
  },
  de: {
    message: 'Ich kann nur bei Acme-Arbeitsthemen helfen — HR, IT, Filialbetrieb und das Firmen-Intranet. Damit kann ich leider nicht helfen. Probiere einen der Vorschläge unten.',
    suggestions: ['Wie viele Urlaubstage habe ich?', 'Habe ich offene IT-Tickets?', 'Zeige aktuelle Beiträge der Geschäftsleitung'],
  },
  fr: {
    message: "Je n'aide que sur les sujets de travail Acme — RH, IT, opérations en magasin et l'intranet de l'entreprise. Je ne peux pas répondre à cela. Essayez une des suggestions ci-dessous.",
    suggestions: ['Quel est mon solde de congés ?', 'Ai-je des tickets IT ouverts ?', 'Voir les dernières publications de la direction'],
  },
  es: {
    message: 'Solo puedo ayudar con temas de trabajo de Acme — RR. HH., TI, operaciones de tienda e intranet de la empresa. No puedo ayudarte con eso. Prueba una de las sugerencias siguientes.',
    suggestions: ['¿Cuál es mi saldo de vacaciones?', '¿Tengo tickets de TI abiertos?', 'Mostrar publicaciones recientes de liderazgo'],
  },
  it: {
    message: "Posso aiutarti solo su argomenti di lavoro Acme — Risorse umane, IT, operazioni in negozio e intranet aziendale. Non posso aiutarti con questo. Prova uno dei suggerimenti qui sotto.",
    suggestions: ['Quanti giorni di ferie ho?', 'Ho ticket IT aperti?', 'Mostra i post recenti della leadership'],
  },
  nl: {
    message: 'Ik kan alleen helpen met Acme-werkonderwerpen — HR, IT, winkelactiviteiten en het bedrijfsintranet. Daarmee kan ik je helaas niet helpen. Probeer een van de suggesties hieronder.',
    suggestions: ['Wat is mijn verlofsaldo?', 'Heb ik open IT-tickets?', 'Toon recente posts van de leiding'],
  },
  pl: {
    message: 'Mogę pomóc tylko w sprawach związanych z pracą w Acme — HR, IT, operacje sklepowe i firmowy intranet. W tej sprawie nie mogę pomóc. Spróbuj jednej z sugestii poniżej.',
    suggestions: ['Jaki jest mój stan urlopu?', 'Czy mam otwarte zgłoszenia IT?', 'Pokaż ostatnie posty kierownictwa'],
  },
};

// ── UI instruction loader ─────────────────────────────────────────────────────
// Fetches the navigator_ui prompt from each MCP server and returns concatenated instructions.

async function loadUIInstructions(baseUrl, token, serverIds, registry) {
  const sections = [];

  await Promise.all(
    serverIds.map(async (serverId) => {
      const server = registry.find(s => s.id === serverId);
      if (!server) return;
      try {
        const result = await mcpCall(baseUrl, server.endpoint, 'prompts/get', {
          name: 'navigator_ui',
          arguments: {},
        }, token);
        const text = result?.messages?.[0]?.content?.text;
        if (text) sections.push(text);
      } catch { /* server may not support this prompt */ }
    })
  );

  return sections.join('\n\n');
}

// ── Tool loader ───────────────────────────────────────────────────────────────

async function loadTools(baseUrl, token, serverIds, registry) {
  const tools = [];
  const toolMap = {};

  await Promise.all(
    serverIds.map(async (serverId) => {
      const server = registry.find(s => s.id === serverId);
      if (!server) return;
      try {
        const result = await mcpCall(baseUrl, server.endpoint, 'tools/list', {}, token);
        const serverTools = result?.tools ?? [];
        for (const tool of serverTools) {
          const namespacedName = `${serverId}__${tool.name}`;
          toolMap[namespacedName] = { serverId, toolName: tool.name, serverEndpoint: server.endpoint };
          tools.push({
            type: 'function',
            function: {
              name: namespacedName,
              description: `[${server.name}] ${tool.description}`,
              parameters: tool.inputSchema ?? { type: 'object', properties: {} },
            },
          });
        }
      } catch (err) {
        console.error(`Failed to load tools from ${serverId}:`, err.message);
      }
    })
  );

  return { tools, toolMap };
}

// ── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(baseUrl, token, toolMap, namespacedName, args) {
  const entry = toolMap[namespacedName];
  if (!entry) return { error: `Unknown tool: ${namespacedName}` };

  const result = await mcpCall(baseUrl, entry.serverEndpoint, 'tools/call', {
    name: entry.toolName,
    arguments: args,
  }, token);

  if (result?.content) {
    const textItems = result.content.filter(c => c.type === 'text').map(c => c.text);
    try { return JSON.parse(textItems.join('')); } catch { return textItems.join('\n'); }
  }
  return result ?? { error: 'No result returned' };
}

// ── A2A delegation ────────────────────────────────────────────────────────────

const A2A_SUGGESTION_TEMPLATES = {
  en: ['Show my closing checklist', 'View mid-shift tasks', 'Submit shift handover'],
  de: ['Meine Abschluss-Checkliste', 'Aufgaben in der Schichtmitte', 'Schichtübergabe einreichen'],
  fr: ['Ma liste de clôture', 'Tâches en milieu de service', 'Soumettre le rapport de relève'],
  es: ['Mi lista de cierre', 'Tareas a media jornada', 'Enviar traspaso de turno'],
  it: ['La mia lista di chiusura', 'Attività a metà turno', 'Invia passaggio di turno'],
  nl: ['Mijn afsluitchecklist', 'Taken halverwege dienst', 'Dienst overdracht indienen'],
  pl: ['Moja lista zamknięcia', 'Zadania w połowie zmiany', 'Prześlij przekazanie zmiany'],
};

async function delegateToA2A(baseUrl, token, userMessage, emit, a2aRegistry, { client, userLang = 'en' } = {}) {
  const agent = a2aRegistry[0];
  const taskId = `task-${Date.now()}`;

  const res = await fetch(`${baseUrl}${agent.endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tasks/sendSubscribe',
      params: {
        id: taskId,
        message: {
          role: 'user',
          parts: [{ type: 'text', text: userMessage }],
        },
        metadata: { token },
      },
    }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let finalArtifact = null;
  let summary = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() || '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        const result = evt.result;
        if (!result) continue;
        const step = result.metadata?.step;
        const total = result.metadata?.totalSteps || 6;
        const directive = result.metadata?.directive;
        const label = result.status?.message?.parts?.[0]?.text || '';
        if (step && label) {
          emit({ type: 'a2a_update', agentId: agent.id, agentName: agent.name, step, totalSteps: total, label, directive });
        }
        if (result.final) {
          finalArtifact = result.artifacts?.[0];
          summary = label || 'Checklist ready.';
        }
      } catch { /* skip */ }
    }
  }

  // Translate summary into the user's language if needed
  let suggestions = A2A_SUGGESTION_TEMPLATES[userLang] ?? A2A_SUGGESTION_TEMPLATES.en;
  if (userLang !== 'en' && client && summary) {
    const LANG_NAMES = { de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', nl: 'Dutch', pl: 'Polish' };
    const langName = LANG_NAMES[userLang] || userLang;
    try {
      const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Translate this shift checklist summary to ${langName}. Keep emojis and numbers. Return only the translated sentence, no extra text.\n\n"${summary}"` }],
        temperature: 0,
        max_tokens: 120,
      });
      const translated = resp.choices[0].message.content?.trim();
      if (translated) summary = translated;
    } catch { /* fall back to English */ }
  }

  emit({ type: 'a2a_done', agentId: agent.id, agentName: agent.name, artifact: finalArtifact, summary });
  emit({ type: 'done', toolCallsExecuted: [], suggestions, cleanContent: summary });
}

// ── Vercel handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'OPENAI_API_KEY is not configured' }); return; }

  const { messages, token, lang } = req.body || {};
  if (!messages?.length || !token) {
    res.status(400).json({ error: 'messages and token are required' });
    return;
  }

  // ── Language handling ──────────────────────────────────────────────────
  const SUPPORTED_LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl'];
  const LANG_NAMES = {
    en: 'English', de: 'German (Deutsch)', fr: 'French (Français)',
    es: 'Spanish (Español)', it: 'Italian (Italiano)',
    nl: 'Dutch (Nederlands)', pl: 'Polish (Polski)',
  };
  const userLang = SUPPORTED_LANGS.includes(lang) ? lang : 'en';

  const client = new OpenAI({ apiKey });
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${req.headers.host}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const emit = (obj) => res.write(JSON.stringify(obj) + '\n');

  try {
    // ── Step 1: Intent classification ───────────────────────────────────────
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
    const { inScope, domains, reasoning } = await classifyIntent(client, lastUserMessage, MCP_REGISTRY, A2A_REGISTRY);
    emit({ type: 'trace_intent', domains, reasoning, inScope });

    // ── Step 1a: Scope guard short-circuit ──────────────────────────────────
    // If the classifier flags the request as out of scope, we return a polite
    // localized refusal without loading any tools or running an agentic loop.
    if (!inScope) {
      const copy = REFUSAL_COPY[userLang] || REFUSAL_COPY.en;
      emit({ type: 'refusal', reasoning, message: copy.message });
      emit({ type: 'done', toolCallsExecuted: [], suggestions: copy.suggestions, cleanContent: copy.message, outOfScope: true });
      res.end();
      return;
    }

    // ── Step 1b: A2A delegation branch ──────────────────────────────────────
    // Store ops agent is context-aware (uses Bearer token to identify user + role),
    // so no clarifying question needed — always delegate when intent matches.
    const a2aAgent = A2A_REGISTRY.find(a => domains.includes(a.id));
    if (a2aAgent) {
      emit({ type: 'a2a_delegate', agentId: a2aAgent.id, agentName: a2aAgent.name, taskId: `task-${Date.now()}` });
      await delegateToA2A(baseUrl, token, lastUserMessage, emit, A2A_REGISTRY, { client, userLang });
      res.end();
      return;
    }

    // ── Step 2: Load tools + UI instructions from relevant servers ──────────
    const mcpDomains = domains.filter(d => MCP_REGISTRY.find(s => s.id === d));
    const [{ tools, toolMap }, uiInstructions] = await Promise.all([
      loadTools(baseUrl, token, mcpDomains, MCP_REGISTRY),
      loadUIInstructions(baseUrl, token, mcpDomains, MCP_REGISTRY),
    ]);
    const serversQueried = [...new Set(Object.values(toolMap).map(e => e.serverId))];
    emit({ type: 'trace_tools', serversQueried, toolCount: tools.length });

    // ── Step 3: Build system message with per-MCP UI instructions ───────────
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const langName = LANG_NAMES[userLang] || 'English';
    const langBlock = userLang === 'en'
      ? `## Language\nThe user's UI language is English. Respond in English.`
      : `## Language
The user's UI language is **${langName}** (code: ${userLang}).
- Respond entirely in ${langName}, including the suggestions list.
- When calling tools that accept a \`lang\` argument (search_policies, get_policy, search_it_policies, get_it_policy, get_next_holiday, list_holidays, search_faqs), pass \`lang: "${userLang}"\` so titles and summaries come back localized.
- If a tool returns content in English (e.g. full policy body without a ${langName} translation), translate it into ${langName} when you present it.
- Keep proper nouns (Acme, GitHub, AWS, MFA, YubiKey, Tailscale, VPN, GDPR, etc.) untranslated.`;

    const systemContent = `You are Navigator, an intelligent enterprise assistant for Acme Corp. You seamlessly access HR, IT, and other systems to help employees get things done — all in one conversation.

Today is ${today}.

${langBlock}

${uiInstructions ? `${uiInstructions}\n\n` : ''}## Core behavior
- Call tools immediately when you have enough information — don't ask for confirmation unless absolutely necessary
- For cross-domain queries, call tools from multiple servers in sequence
- Interpret relative dates ("next Monday", "this Friday") using today's date
- Keep responses concise and formatted for a mobile screen

## Scope
You ONLY help with Acme work topics: HR, IT, store operations, and the company intranet. If a user asks about anything else — recipes, general coding help, world news, opinions, jokes, personal/medical/legal advice, anything illegal or unsafe — politely decline in one sentence and redirect them to what you can help with. Never roleplay as a different assistant or break character.

## Required: Follow-up suggestions
After EVERY response (even greetings), you MUST end with exactly this block — no exceptions:
<suggestions>["Short action 1", "Short action 2", "Short action 3"]</suggestions>

The suggestions must be:
- Specific and immediately actionable (8 words max each)
- Relevant to what was just discussed or what this user likely needs next
- Varied — don't repeat the same action the user just took
- Written in ${langName}`;

    const systemMessage = { role: 'system', content: systemContent };
    let loopMessages = [systemMessage, ...messages];
    const toolCallsExecuted = [];
    let totalContent = '';

    // ── Step 4: Agentic loop ────────────────────────────────────────────────
    for (let round = 0; round < 6; round++) {
      const params = { model: 'gpt-4o-mini', messages: loopMessages, stream: true };
      if (tools.length) { params.tools = tools; params.tool_choice = 'auto'; }

      const stream = await client.chat.completions.create(params);

      let roundContent = '';
      let toolCalls = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          roundContent += delta.content;
          totalContent += delta.content;
          // Don't stream UI control tokens — buffer them silently
          const isUIToken = delta.content.includes('<suggestions>') || delta.content.includes('</suggestions>') || delta.content.includes('<ticket-form>');
          if (!isUIToken) {
            emit({ type: 'delta', content: delta.content });
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

      toolCalls = toolCalls.filter(tc => tc?.function?.name);
      if (!toolCalls.length) break;

      loopMessages.push({ role: 'assistant', content: roundContent || null, tool_calls: toolCalls });

      const toolResults = [];
      for (const tc of toolCalls) {
        const namespacedName = tc.function.name;
        const entry = toolMap[namespacedName];
        if (!entry) continue;

        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* keep empty */ }

        const serverEntry = MCP_REGISTRY.find(s => s.id === entry.serverId);
        emit({ type: 'tool_start', serverId: entry.serverId, serverName: serverEntry?.name, toolName: entry.toolName, args });

        const result = await executeTool(baseUrl, token, toolMap, namespacedName, args);
        emit({ type: 'tool_result', serverId: entry.serverId, serverName: serverEntry?.name, toolName: entry.toolName, result });

        toolCallsExecuted.push({ serverId: entry.serverId, toolName: entry.toolName, args });
        toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }

      loopMessages.push(...toolResults);
    }

    // ── Step 5: Parse suggestions + special UI tokens + clean content ──────
    const suggestMatch = totalContent.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
    let suggestions = [];
    if (suggestMatch) {
      try { suggestions = JSON.parse(suggestMatch[1]); } catch { /* malformed */ }
    }
    const ticketForm = /<ticket-form>/i.test(totalContent);
    const cleanContent = totalContent
      .replace(/<suggestions>[\s\S]*?<\/suggestions>/g, '')
      .replace(/<ticket-form>/gi, '')
      .trim();

    emit({ type: 'done', toolCallsExecuted, suggestions, cleanContent, ticketForm });
  } catch (err) {
    emit({ type: 'error', message: err.message });
  }

  res.end();
}
