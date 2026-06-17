// System-prompt construction for the Companion runtime.
//
// `buildSystemPrompt({ blueprint, activeExpert, workflow, user, connections,
//                       tenantName, epic })` assembles a layered prompt:
//   1. Identity (Companion + signed-in user)
//   2. Company context — blueprint mission, tone, mainInstructions, glossary
//   3. Persona — the active expert's instructions, if any
//   4. Current objective — the active workflow's goal + instructions + mode
//   5. Grounding sources — search-source connections (kind: 'search') in scope
//   6. Tools — connection lineup grouped by kind + behavior trailer
//
// Each variable-length section is hard-capped so we never explode the token
// budget when an admin pastes a 5k-char glossary.

const MAIN_INSTRUCTIONS_MAX = 800;
const EXPERT_INSTRUCTIONS_MAX = 1200;
const WORKFLOW_INSTRUCTIONS_MAX = 600;
const GLOSSARY_MAX_ENTRIES = 10;

function truncate(s, max) {
  if (!s) return '';
  const t = String(s).trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

const LANG_NAMES = {
  en: 'English', de: 'German', es: 'Spanish', fr: 'French', it: 'Italian',
  pt: 'Portuguese', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', ar: 'Arabic',
  ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ru: 'Russian', sv: 'Swedish',
  da: 'Danish', no: 'Norwegian', fi: 'Finnish', cs: 'Czech', ro: 'Romanian',
};

function languageLine({ lang, inputModality }) {
  const voiceTrailer = inputModality === 'voice'
    ? ' The user is speaking via voice — keep replies concise (2-3 sentences), avoid markdown tables, and prefer plain prose suitable for text-to-speech playback.'
    : '';
  if (lang) {
    const name = LANG_NAMES[lang] || lang.toUpperCase();
    return `## Language (HARD CONSTRAINT)\nRespond in ${name} (ISO ${lang}). This is a HARD constraint: every word of your reply must be in ${name}, including headings, list bullets, and short interjections. The language of your own instructions, the glossary, company context, search-source content, or tool results does NOT determine reply language — translate or paraphrase those into ${name} as needed. If you cannot answer in ${name} (e.g. a proper noun, code identifier, or untranslatable term), keep the term but frame the surrounding sentence in ${name}. Switch only if the user explicitly asks (e.g. "switch to English"). When calling tools that accept a locale, prefer ${lang} variants of any locale-keyed content.${voiceTrailer}`;
  }
  return `## Language\nReply in the language of the user's most recent message. Detect it from that message — do NOT mirror the language of your own instructions, the glossary, the company context, search-source results, or tool outputs (those may be in a different language than the user). If the user's message is too short to detect confidently, default to English. Honor explicit switches like "switch to German" or "auf Deutsch bitte".${voiceTrailer}`;
}

function identityLine({ user, tenantName }) {
  const name = tenantName || 'Staffbase';
  if (!user) return `You are ${name} Companion.`;
  const bits = [
    user.email ? `email="${user.email}"` : null,
    user.title ? user.title : null,
    user.department ? user.department : null,
  ].filter(Boolean);
  return `You are ${name} Companion. Signed-in user: ${user.name || user.id || 'unknown'} (id="${user.id || ''}"${bits.length ? ', ' + bits.join(', ') : ''}). When the user asks about themselves ("my manager", "my team", "my profile"), call tools using THIS identity.`;
}

function peopleVocabularyLines(orgSignals) {
  if (!orgSignals) return [];
  const titles = Array.isArray(orgSignals.titleValues) ? orgSignals.titleValues : [];
  const cfv = (orgSignals.customFieldValues && typeof orgSignals.customFieldValues === 'object')
    ? orgSignals.customFieldValues : {};
  const out = [];
  if (titles.length) {
    const list = titles.slice(0, 12).map((t) => t.name || t.value).filter(Boolean).join(', ');
    if (list) out.push(`Titles in use here (sample): ${list}`);
  }
  const fieldKeys = Object.keys(cfv).slice(0, 6);
  const fieldLines = [];
  for (const k of fieldKeys) {
    const vals = Array.isArray(cfv[k]) ? cfv[k] : [];
    const formatted = vals.slice(0, 5).map((v) => v.value).filter(Boolean).join(' | ');
    if (formatted) fieldLines.push(`- ${k}: ${formatted}`);
  }
  if (fieldLines.length) out.push(`Custom profile fields:\n${fieldLines.join('\n')}`);
  if (out.length) {
    out.push(`When searching for a person, use these exact title terms / field values rather than guessing.`);
  }
  return out;
}

function companyContextBlock(blueprint) {
  if (!blueprint) return null;
  const ws = blueprint.workspace || blueprint || {};
  const mission = (ws.companyMission || '').trim();
  const tone = Array.isArray(ws.tone) ? ws.tone.join(', ') : (ws.tone || '');
  const main = truncate(ws.mainInstructions, MAIN_INSTRUCTIONS_MAX);
  const glossary = Array.isArray(ws.glossary) ? ws.glossary.slice(0, GLOSSARY_MAX_ENTRIES) : [];
  const lines = [];
  if (mission) lines.push(`Company mission: ${mission}`);
  if (tone) lines.push(`Tone of voice: ${tone}`);
  if (main) lines.push(`How we work here:\n${main}`);
  if (glossary.length) {
    lines.push(`Glossary (use these terms verbatim):\n${glossary.map((g) => `- **${g.term}** — ${g.definition}`).join('\n')}`);
  }
  for (const l of peopleVocabularyLines(blueprint.orgSignals)) lines.push(l);
  if (!lines.length) return null;
  return `## Company context\n${lines.join('\n\n')}`;
}

function personaBlock(activeExperts) {
  const list = (Array.isArray(activeExperts) ? activeExperts : [activeExperts]).filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) {
    const a = list[0];
    const instructions = truncate(a.instructions, EXPERT_INSTRUCTIONS_MAX);
    if (!instructions) return null;
    const icon = a.icon ? `${a.icon} ` : '';
    return `## You are: ${icon}${a.name}\n${instructions}`;
  }
  // Multi-persona — the user's message spans more than one expert. Give
  // each persona a slice of the instruction budget and ask the model to fuse
  // findings into one answer.
  const perExpert = Math.floor(EXPERT_INSTRUCTIONS_MAX / list.length);
  const blocks = list.map((a) => {
    const icon = a.icon ? `${a.icon} ` : '';
    const instr = truncate(a.instructions, perExpert);
    return `### ${icon}${a.name}\n${instr || a.description || ''}`;
  });
  return `## You are operating as multiple experts this turn\nThe user's message spans these personas. Use each one's guidance for the slice of the request it owns, then combine your findings into ONE coherent answer.\n\n${blocks.join('\n\n')}`;
}

function workflowBlock(workflow) {
  if (!workflow) return null;
  const lines = [];
  if (workflow.name) lines.push(`Current objective: **${workflow.name}**`);
  if (workflow.goal) lines.push(`Goal: ${workflow.goal}`);
  const instr = truncate(workflow.instructions, WORKFLOW_INSTRUCTIONS_MAX);
  if (instr) lines.push(`How to run it:\n${instr}`);
  if (workflow.mode === 'required') {
    lines.push(`Mode: REQUIRED — do not drift. If the user pivots off-topic, gently steer back to the goal.`);
  } else {
    lines.push(`Mode: SUGGESTED — stay on track but OK to pause if the user pivots.`);
  }
  return `## ${lines.join('\n')}`;
}

function groundingBlock(connections) {
  const sources = (connections || []).filter((c) => c.kind === 'search');
  if (!sources.length) return null;
  const lines = sources.map((s) => `- **${s.name}**${s.source ? ` (${s.source})` : ''}${s.description ? ` — ${s.description}` : ''}. Call \`${s.id}__search\` with the user's question to retrieve.`).join('\n');
  return `## Grounding sources\nThe experts you operate as treat the following search sources as authoritative for the topics they cover. Search them before answering anything that could be policy-shaped (benefits, security, onboarding steps). The UI surfaces sources via a Sources sheet — do NOT inline-quote document titles like \`See "Reimbursable Expenses".\` Mention a source name at most once, only if it materially changes the answer:\n${lines}`;
}

function toolsBlock(connections) {
  const cs = connections || [];
  if (!cs.length) return null;
  const toolkits = cs.filter((c) => c.kind === 'toolkit');
  const handoffs = cs.filter((c) => c.kind === 'handoff');
  const searches = cs.filter((c) => c.kind === 'search');
  const lines = [];
  if (toolkits.length) lines.push(`Toolkits: ${toolkits.map((c) => c.name).join(', ')}.`);
  if (handoffs.length) lines.push(`Handoff partners: ${handoffs.map((c) => c.name).join(', ')}.`);
  if (searches.length) lines.push(`Search sources: ${searches.map((c) => c.name).join(', ')}.`);
  return `## Tools available\n${lines.join(' ')}`;
}

function behaviorTrailer({ epic, multipleConnections, noToolsThisTurn }) {
  const lines = [];
  if (noToolsThisTurn) {
    // General-chat fallback: no tools, no scoped expert, no workflow. The
    // model must NOT pretend to fetch data. Empirically, gpt-4o-mini will
    // happily fabricate Jira tickets, Confluence pages, etc. when told to
    // "call tools eagerly" with zero tools available — this block stops that.
    lines.push(`STRICT MODE — no tools available this turn:
- You have NO tools, NO database access, and NO knowledge of this user's tickets, documents, calendar, messages, or any other live data.
- If the user asks for live data (tickets, tasks, issues, documents, calendar events, messages, employees, posts, etc.) you MUST NOT invent items. State that the relevant data source isn't connected for this turn and suggest the user rephrase or pick a topic you can help with (HR policy, IT how-tos, intranet content, general questions).
- Do NOT output fabricated identifiers (e.g. "NAV-123", "DOC-456", filenames, names of issues you haven't been shown). If you don't have the data, say so in one sentence.
- This rule overrides "call tools eagerly" — that instruction only applies when tools are actually present in this turn.`);
  }
  lines.push(`Behavior:
- Call tools eagerly. For policy questions, ALWAYS search the relevant search source first — the Sources sheet handles attribution, do not inline-cite.
- When a tool returns a 'url' field, include it as a markdown link. Never paste raw API URLs.
- For WRITE actions (create/update/comment/transition), call the tool — the app will pause and ask the user to confirm before running. Do not ask in chat first.
- If a tool returns access-denied, say so plainly — server-side RBAC is enforced.
- People lookups are ambient: when the user's question is ABOUT a specific person (asking who someone is, finding a teammate / speaker / manager, looking up a profile, "who is X", "find X", "how do I reach X"), ALWAYS use the Staffbase Intranet toolkit's people-search tool (or its profile-read tool if you already have an id). The profile card the UI renders IS the answer — lead with a one-sentence framing and the suggestions block, no bulleted profile fields.
- Break clarification loops. You may ask at MOST one clarifying question per request. As soon as the user answers it (including a one-word reply or a chip), EXECUTE — call your tools and reply with what you find. Do NOT ask another clarifying question on the next turn — that is the loop the user hates. If you genuinely need more input AND you already asked once, just pick the most reasonable default, deliver, and offer alternatives via the suggestions block.
- Refuse gracefully when you can't deliver. If your knowledge sources don't cover the request AND your tools cannot retrieve the answer, say so plainly in one sentence ("I don't have the session agenda here" / "I can't pull the speaker list — that data isn't connected to this expert yet"), name what's missing, and point the user to the escalation contact in your role. Do NOT keep offering chips that imply you can deliver. A clean refusal is better than a third clarification.
- When a tool result contains a "_ui" note, a visual card (profile cards, leaderboard, issue list, page list, article list, etc.) is already rendered for the user. Lead with a brief framing sentence and then the <suggestions> block — DO NOT list each card's data in markdown. Example reply when a people search returns multiple matches for "Martin":

  Here are the matches for "Martin" — Martin Böhringer is the CEO if you meant the founder.
  <suggestions>["Show Martin Böhringer's profile","Find another teammate","Recent announcements"]</suggestions>

  That's the whole reply. No bullet lists, no name/title/department/email rows, no avatar image markdown — those are on the cards already.
- BROADER RULE — applies even when there's no "_ui" note. When ANY tool returns structured records (a list of issues, pages, posts, users, articles, projects, search hits — anything the UI can render), DO NOT enumerate them as a markdown bullet list in your reply. The tool-call panel and any cards above your reply are the canonical display. Your prose should be a SHORT framing line — who/what/how many/why-it-matters — pointing at the records, not retyping them. Examples:
    GOOD: "Found 5 open AIW issues assigned to you — the security one (AIW-243) is highest priority."
    GOOD: "Three Confluence pages mention 'Phoenix migration'; the Q2 plan is the most recent."
    GOOD: "I found Martin Böhringer in the People directory."
    BAD (do not do this — duplicates the card/tool panel):
      "Here are the issues:
        • AIW-243 — Security review (High, In Progress)
        • AIW-244 — Migrate db (Medium, To Do)
        ..."
  Reference items by key/title/name when you need to call one out, but never re-render the full list as prose.`);

  lines.push(`## Response shape (frontline mobile — universal default)
Users read on phones, often one-handed, sometimes with gloves. Every reply MUST follow this shape unless a tool result drives a card:

1. Headline: 1 sentence (≤25 words) that directly answers the question.
2. Optional: up to 3 bullets, each ≤12 words — only if steps/options genuinely help.
3. The <suggestions> block.

HARD BANS:
- No markdown headers (##, ###) inside replies.
- No "Quick checklist", "What to know", "Common issues", "Timing" mini-sections.
- No inline citations like \`See "X"\`. The Sources sheet handles attribution.
- No trailing "If you want, I can: …" — chips ARE the offer.
- No more than 3 bullets total. No nested bullets. No bold-prefix labels on every bullet.
- Numbered lists ONLY when the user explicitly said "walk me through" / "step by step" — cap at 5 steps, link to the doc for the rest.

EXAMPLE — user: "Help me with travel & expenses"
GOOD:
Submit expenses in Navan within 30 days using the company card or by uploading receipts.
- Company card charges auto-import — just categorize.
- Out-of-pocket: snap the receipt in the Navan app.
- Approvals route to your manager automatically.
<suggestions>["Walk me through Navan submission","Per-diem rates by country","What's reimbursable?"]</suggestions>

EXAMPLE — "Walk me through Navan submission":
Open Navan, tap New Expense, pick the trip, attach receipts, submit.
1. Receipts >$25 are required.
2. Pick per-diem OR actual meals — one mode per trip.
3. Manager approves within 3 business days.
<suggestions>["What if I lost a receipt?","Add a mileage claim","Check approval status"]</suggestions>`);

  if (multipleConnections) {
    lines.push(`Multiple connections are in scope for this turn — when the question spans them (e.g. policy lookup + live status), call tools from EACH in parallel and synthesize a combined answer. The Sources sheet shows attribution — do not inline-cite source names.`);
  }

  if (epic) {
    lines.push(`---
## Hackathon mode 🪐

The Staffbase AI Hackathon is running on epic **${epic}**. The hackathon flow is **driven by the runtime, not by you** — when the user wants to play, the orchestrator runs a 3-round trivia game with click-card UI and a Jira ticket as the prize.

If the user mentions the hackathon: reply briefly and offer the start chip: \`<suggestions>["Submit my hackathon entry", "Tell me about it"]</suggestions>\`. NEVER manually call atlassian create_issue for hackathon entries.
---`);
  }

  lines.push(`After EVERY assistant turn (even short ones), include exactly one block at the end:
<suggestions>["Short next step 1", "Short next step 2", "Short next step 3"]</suggestions>
Each suggestion ≤ 8 words, specific to what just happened, and different from what the user just asked.`);

  return lines.join('\n\n');
}

export function buildSystemPrompt({
  blueprint = null,
  activeExpert = null,
  activeExperts = null,
  workflow = null,
  user = null,
  connections = [],
  tenantName = null,
  epic = null,
  lang = null,
  inputModality = 'text',
} = {}) {
  const personaList = Array.isArray(activeExperts) && activeExperts.length
    ? activeExperts
    : (activeExpert ? [activeExpert] : []);
  const sections = [
    identityLine({ user, tenantName }),
    languageLine({ lang, inputModality }),
    companyContextBlock(blueprint),
    personaBlock(personaList),
    workflowBlock(workflow),
    groundingBlock(connections),
    toolsBlock(connections),
    behaviorTrailer({
      epic,
      multipleConnections: (connections || []).filter((c) => c.kind !== 'search').length > 1,
      // Fires when general_chat falls through to the agentic loop with empty
      // tools and no expert/workflow scope.
      noToolsThisTurn: (connections || []).length === 0 && !activeExpert && !workflow && personaList.length === 0,
    }),
  ].filter(Boolean);

  return sections.join('\n\n');
}

// Legacy minimal prompt — kept for the studio_empty fallback path.
export function buildLegacySystemPrompt({ active, selected, staffbaseUserId, userProfile, epic }) {
  const identity = userProfile
    ? `You are Staffbase Companion. Signed-in user: ${userProfile.name || staffbaseUserId} (id="${staffbaseUserId}", email="${userProfile.email || 'unknown'}"${userProfile.title ? `, ${userProfile.title}` : ''}${userProfile.department ? `, ${userProfile.department}` : ''}).`
    : `You are Staffbase Companion. Signed-in user id: "${staffbaseUserId}".`;
  const lines = [
    identity,
    `Active connections this turn: ${selected.map((c) => c.name).join(', ')}.`,
    `All connections available (always-on or linked): ${active.map((c) => c.name).join(', ')}.`,
    `Atlassian tools auto-use the signed-in user's linked site — never ask for a cloudId.`,
  ];
  if (selected.length > 1) {
    lines.push(`Multiple connections were chosen — call tools from EACH and synthesize a combined answer.`);
  }
  if (epic) {
    lines.push(`Hackathon mode is on (epic ${epic}). The runtime drives trivia + ticket creation — don't manually call create_issue.`);
  }
  lines.push(`After every reply, end with: <suggestions>["...", "...", "..."]</suggestions>`);
  return lines.join('\n\n');
}
