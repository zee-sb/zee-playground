// System-prompt construction for the Companion runtime.
//
// `buildSystemPrompt({ blueprint, activeAssistant, flow, user, connectors,
//                       tenantName, epic })` assembles a layered prompt:
//   1. Identity (Companion + signed-in user)
//   2. Company context — blueprint mission, tone, mainInstructions, glossary
//   3. Persona — the active assistant's instructions, if any
//   4. Current objective — the active flow's goal + instructions + mode
//   5. Grounding sources — knowledge-base connectors (kind: 'kb') in scope
//   6. Tools — connector lineup grouped by kind + behavior trailer
//
// Each variable-length section is hard-capped so we never explode the token
// budget when an admin pastes a 5k-char glossary.

const MAIN_INSTRUCTIONS_MAX = 800;
const ASSISTANT_INSTRUCTIONS_MAX = 1200;
const FLOW_INSTRUCTIONS_MAX = 600;
const GLOSSARY_MAX_ENTRIES = 10;

function truncate(s, max) {
  if (!s) return '';
  const t = String(s).trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
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
  if (!lines.length) return null;
  return `## Company context\n${lines.join('\n\n')}`;
}

function personaBlock(activeAssistants) {
  const list = (Array.isArray(activeAssistants) ? activeAssistants : [activeAssistants]).filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) {
    const a = list[0];
    const instructions = truncate(a.instructions, ASSISTANT_INSTRUCTIONS_MAX);
    if (!instructions) return null;
    const icon = a.icon ? `${a.icon} ` : '';
    return `## You are: ${icon}${a.name}\n${instructions}`;
  }
  // Multi-persona — the user's message spans more than one assistant. Give
  // each persona a slice of the instruction budget and ask the model to fuse
  // findings into one answer.
  const perAssistant = Math.floor(ASSISTANT_INSTRUCTIONS_MAX / list.length);
  const blocks = list.map((a) => {
    const icon = a.icon ? `${a.icon} ` : '';
    const instr = truncate(a.instructions, perAssistant);
    return `### ${icon}${a.name}\n${instr || a.description || ''}`;
  });
  return `## You are operating as multiple assistants this turn\nThe user's message spans these personas. Use each one's guidance for the slice of the request it owns, then combine your findings into ONE coherent answer.\n\n${blocks.join('\n\n')}`;
}

function flowBlock(flow) {
  if (!flow) return null;
  const lines = [];
  if (flow.name) lines.push(`Current objective: **${flow.name}**`);
  if (flow.goal) lines.push(`Goal: ${flow.goal}`);
  const instr = truncate(flow.instructions, FLOW_INSTRUCTIONS_MAX);
  if (instr) lines.push(`How to run it:\n${instr}`);
  if (flow.mode === 'required') {
    lines.push(`Mode: REQUIRED — do not drift. If the user pivots off-topic, gently steer back to the goal.`);
  } else {
    lines.push(`Mode: SUGGESTED — stay on track but OK to pause if the user pivots.`);
  }
  return `## ${lines.join('\n')}`;
}

function groundingBlock(connectors) {
  const kbs = (connectors || []).filter((c) => c.kind === 'kb');
  if (!kbs.length) return null;
  const lines = kbs.map((kb) => `- **${kb.name}**${kb.source ? ` (${kb.source})` : ''}${kb.description ? ` — ${kb.description}` : ''}. Call \`${kb.id}__search\` with the user's question to retrieve.`).join('\n');
  return `## Grounding sources\nThe assistants you operate as treat the following knowledge bases as authoritative for the topics they cover. Search them before answering anything that could be policy-shaped (benefits, security, onboarding steps), and CITE the document title in your answer:\n${lines}`;
}

function toolsBlock(connectors) {
  const cs = connectors || [];
  if (!cs.length) return null;
  const mcps = cs.filter((c) => c.kind === 'mcp');
  const agents = cs.filter((c) => c.kind === 'agent');
  const kbs = cs.filter((c) => c.kind === 'kb');
  const lines = [];
  if (mcps.length) lines.push(`MCP connectors: ${mcps.map((c) => c.name).join(', ')}.`);
  if (agents.length) lines.push(`Agents you can hand off to: ${agents.map((c) => c.name).join(', ')}.`);
  if (kbs.length) lines.push(`Knowledge bases you can search: ${kbs.map((c) => c.name).join(', ')}.`);
  return `## Tools available\n${lines.join(' ')}`;
}

function behaviorTrailer({ epic, multipleConnectors }) {
  const lines = [];
  lines.push(`Behavior:
- Call tools eagerly. For policy questions, ALWAYS search the relevant knowledge base first and cite the document title.
- When a tool returns a 'url' field, include it as a markdown link. Never paste raw API URLs.
- For WRITE actions (create/update/comment/transition), call the tool — the app will pause and ask the user to confirm before running. Do not ask in chat first.
- If a tool returns access-denied, say so plainly — server-side RBAC is enforced.
- Keep responses tight and scannable. Use short paragraphs and bullet lists.`);

  if (multipleConnectors) {
    lines.push(`Multiple connectors are in scope for this turn — when the question spans them (e.g. policy lookup + live status), call tools from EACH in parallel and synthesize a combined answer that cites both sources by name.`);
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
  activeAssistant = null,
  activeAssistants = null,
  flow = null,
  user = null,
  connectors = [],
  tenantName = null,
  epic = null,
} = {}) {
  const personaList = Array.isArray(activeAssistants) && activeAssistants.length
    ? activeAssistants
    : (activeAssistant ? [activeAssistant] : []);
  const sections = [
    identityLine({ user, tenantName }),
    companyContextBlock(blueprint),
    personaBlock(personaList),
    flowBlock(flow),
    groundingBlock(connectors),
    toolsBlock(connectors),
    behaviorTrailer({ epic, multipleConnectors: (connectors || []).filter((c) => c.kind !== 'kb').length > 1 }),
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
    `Active connectors this turn: ${selected.map((c) => c.name).join(', ')}.`,
    `All connectors available (always-on or linked): ${active.map((c) => c.name).join(', ')}.`,
    `Atlassian tools auto-use the signed-in user's linked site — never ask for a cloudId.`,
  ];
  if (selected.length > 1) {
    lines.push(`Multiple connectors were chosen — call tools from EACH and synthesize a combined answer.`);
  }
  if (epic) {
    lines.push(`Hackathon mode is on (epic ${epic}). The runtime drives trivia + ticket creation — don't manually call create_issue.`);
  }
  lines.push(`After every reply, end with: <suggestions>["...", "...", "..."]</suggestions>`);
  return lines.join('\n\n');
}
