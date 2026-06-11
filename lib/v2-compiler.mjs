// V2 → V1 compiler.
//
// Turns the NavigatorV2 concept state (sources / capability bundles /
// processes / behaviors — see src/prototypes/NavigatorV2/useV2Store.js and
// docs/navigator-concept.md) into the V1 runtime entities the live
// orchestrator already understands:
//
//   V2 source (kind: system)   → connection  (kind: toolkit | search)
//   V2 source (kind: agent)    → connection  (kind: handoff)
//   V2 capability bundle       → expert      (instructions composed from
//                                             tone / policy / terminology)
//   V2 process                 → workflow    (form → confirm → tool steps)
//   V2 answer policies + tone
//     + terminology + routes   → policyPrompt (deterministic text block the
//                                             orchestrator appends to the
//                                             system prompt; the raw-
//                                             instructions escape hatch is
//                                             appended verbatim at the end)
//   V2 per-capability risk tier→ toolTiers   ({ "<connId>__<tool>": tier })
//
// Every compiled entity carries `origin: 'v2'` (experts use `source: 'v2'`)
// so the compiler can idempotently replace its own output without touching
// hand-made V1 entities — see mergeCompiledConfig / mergeCompiledExperts.
//
// Pure ESM, dependency-free: imported by the browser (useV2Store write-
// through), by node smoke tests (scripts/smoke-v2.mjs), and safe for any
// Vercel function that wants to compile server-side.

export const V2_TIERS = ['assist', 'trigger', 'execute'];
export const V2_ORIGIN = 'v2';

// ── Source → runtime mapping table ──────────────────────────────────────────
//
// The V2 concept sources are fictional enterprise systems (Workday,
// ServiceNow, SharePoint, Personio). The playground's live runtime has a
// fixed set of real MCP endpoints, so each V2 source maps onto the CLOSEST
// live system. Where no 1:1 exists the decision is documented inline:
//
//   staffbase  → /api/mcp-staffbase   (live Campsite intranet MCP)
//   workday    → /api/mcp             (demo HR MCP: PTO balance + leave
//                                      requests ≈ Workday's HCM caps)
//   servicenow → /api/mcp-it          (demo IT helpdesk MCP: tickets ≈ ITSM;
//                                      `request_software_access` stands in
//                                      for the password-reset execute cap)
//   sharepoint → /api/mcp-kb?kbId=kb-it (the seeded kb-it corpus is literally
//                                      sourced "SharePoint" in lib/seed.mjs)
//   personio   → /api/mcp-kb?kbId=kb-hr (read-only HR policy corpus; the
//                                      pe-bank write cap has no live tool —
//                                      see `unmapped` below)
//   it-agent   → /api/a2a             (the live A2A onboarding agent endpoint
//                                      doubles as the IT Virtual Agent)
//
// `caps` maps each V2 capability id to the real tool names it enables.
// Capabilities with an empty tools list are honest no-ops (`unmapped`).
const RUNTIME_MAP = {
  staffbase: {
    connectionId: 'v2-staffbase',
    kind: 'toolkit',
    endpoint: '/api/mcp-staffbase',
    description: 'Live Campsite intranet — compiled from V2 source “Staffbase Intranet”.',
    domains: ['intranet', 'news', 'announcement', 'people', 'directory', 'pages', 'policies', 'channels'],
    caps: {
      'sb-answer': { tools: ['search_posts', 'get_post', 'list_recent_posts', 'list_channels', 'list_pages'] },
      'sb-people': { tools: ['find_user', 'get_user_profile'] },
      // The Staffbase MCP exposes no comment-write tool today; the tier the
      // admin sets is preserved in v2 state but nothing executable maps yet.
      'sb-comment': { tools: [], write: true, unmapped: 'no comment tool in the live Staffbase MCP' },
    },
  },
  workday: {
    connectionId: 'v2-workday',
    kind: 'toolkit',
    endpoint: '/api/mcp',
    description: 'HCM lookups & leave requests — compiled from V2 source “Workday”, backed by the demo HR MCP.',
    domains: ['hr', 'pto', 'leave', 'vacation', 'balance', 'payslip', 'benefits', 'time off'],
    caps: {
      'wd-balance': { tools: ['check_pto_balance'] },
      'wd-leave':   { tools: ['submit_time_off_request'], write: true },
      'wd-data':    { tools: [], write: true, unmapped: 'no personal-data write tool in the demo HR MCP' },
      'wd-payslip': { tools: ['search_policies'] },
    },
  },
  servicenow: {
    connectionId: 'v2-servicenow',
    kind: 'toolkit',
    endpoint: '/api/mcp-it',
    description: 'Tickets & access — compiled from V2 source “ServiceNow”, backed by the demo IT helpdesk MCP.',
    domains: ['it', 'ticket', 'password', 'reset', 'access', 'equipment', 'software', 'laptop'],
    caps: {
      'sn-status': { tools: ['list_my_tickets', 'get_ticket'] },
      'sn-create': { tools: ['create_ticket'], write: true },
      // Stand-in: the demo IT MCP has no password-reset tool, so the
      // execute-tier reset capability maps to its other write tool.
      'sn-reset':  { tools: ['request_software_access'], write: true },
    },
  },
  sharepoint: {
    connectionId: 'v2-sharepoint',
    kind: 'search',
    endpoint: '/api/mcp-kb?kbId=kb-it',
    source: 'SharePoint',
    description: 'Policy & procedure documents — compiled from V2 source “SharePoint” (kb-it corpus).',
    domains: ['policy', 'procedure', 'document', 'manual', 'security', 'flight ops'],
    caps: {
      'sp-search': { tools: ['search'] },
      'sp-meta':   { tools: ['search'] },
    },
  },
  personio: {
    connectionId: 'v2-personio',
    kind: 'search',
    endpoint: '/api/mcp-kb?kbId=kb-hr',
    source: 'Personio',
    description: 'Contract & tariff lookups — compiled from V2 source “Personio” (kb-hr corpus).',
    domains: ['contract', 'tariff', 'hr', 'bank details'],
    caps: {
      'pe-contract': { tools: ['search'] },
      'pe-bank':     { tools: [], write: true, unmapped: 'read-only corpus — no bank-details write tool' },
    },
  },
  'it-agent': {
    connectionId: 'v2-it-agent',
    kind: 'handoff',
    endpoint: '/api/a2a',
    description: 'A2A handoff partner — compiled from V2 source “IT Virtual Agent”.',
    domains: ['hardware', 'repair', 'broken', 'laptop', 'device', 'screen'],
    caps: {
      'ag-repair': { tools: ['invoke'], handoff: true },
      'ag-status': { tools: ['invoke'] },
    },
  },
};

// Human source-name → V2 source id, for resolving bundle.sources entries like
// "Workday · HR data" and process step labels like "Submit to Finance via
// Workday".
const NAME_TO_SOURCE_ID = {
  'staffbase': 'staffbase',
  'staffbase intranet': 'staffbase',
  'sharepoint': 'sharepoint',
  'workday': 'workday',
  'servicenow': 'servicenow',
  'personio': 'personio',
  'it virtual agent': 'it-agent',
};

const V2_HEALTH_TO_STATUS = {
  connected: 'connected',
  degraded: 'degraded',
  disconnected: 'disconnected',
};

function coerceTier(t) {
  return V2_TIERS.includes(t) ? t : 'trigger';
}

function resolveSourceIdFromText(text) {
  const t = String(text || '').toLowerCase();
  for (const [name, id] of Object.entries(NAME_TO_SOURCE_ID)) {
    if (t.includes(name)) return id;
  }
  return null;
}

// ── Sources → connections + toolTiers ───────────────────────────────────────

function compileSource(source, toolTiers) {
  const map = RUNTIME_MAP[source.id];
  if (!map) return null; // unknown concept source — nothing live to bind
  const enabledToolNames = new Set();
  const writeTools = new Set();
  const toolDescriptions = [];
  for (const cap of source.capabilities || []) {
    const capMap = map.caps[cap.id];
    if (!capMap) continue;
    for (const tool of capMap.tools) {
      enabledToolNames.add(tool);
      toolDescriptions.push({ id: tool, name: tool, description: cap.label });
      if (capMap.write) {
        writeTools.add(tool);
        // Risk tier only ever applies to write-capable tools; reads are
        // never gated. The orchestrator reads this map at dispatch time.
        toolTiers[`${map.connectionId}__${tool}`] = coerceTier(cap.tier);
      }
    }
  }
  const connection = {
    id: map.connectionId,
    origin: V2_ORIGIN,
    v2SourceId: source.id,
    kind: map.kind,
    catalogId: `v2_${source.id.replace(/-/g, '_')}`,
    name: source.name,
    description: map.description,
    endpoint: map.endpoint,
    authMethod: source.identity === 'employee' ? 'Employee JIT (concept)' : source.identity === 'agent' ? 'Agent identity (A2A)' : 'Service account (demo)',
    status: V2_HEALTH_TO_STATUS[source.health] || 'connected',
    domains: [...map.domains],
    writeTools: [...writeTools],
    // Additive contract with the orchestrator: when present, the dynamic
    // tools/list result is filtered to exactly these names — this is how
    // "tools filtered by enabled capabilities" lands at runtime.
    enabledToolNames: [...enabledToolNames],
    tools: dedupeBy(toolDescriptions, (t) => t.name),
  };
  if (map.source) connection.source = map.source;
  return connection;
}

function dedupeBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

// ── Behaviors → policy prompt block ─────────────────────────────────────────

const DOMAIN_LABELS = {
  general: 'General intranet',
  hr: 'HR policy',
  medical: 'Medical / flight ops',
  legal: 'Legal / works council',
};

const POLICY_TEXT = {
  citations: 'answer normally, always grounded in retrieved content, and cite the source document title',
  'cite-or-refuse': 'STRICT cite-or-refuse — quote retrieved content verbatim, never paraphrase or summarize; if you cannot retrieve an exact passage, refuse and escalate',
  deflect: 'do NOT answer yourself — always route the question to the human escalation contact for this domain',
};

export function composePolicyPrompt(behaviors = {}) {
  const lines = ['## Answer & action policy (compiled from Navigator V2 Behaviors)'];

  const policies = behaviors.answerPolicies || {};
  const routes = behaviors.escalationRoutes || {};
  const policyLines = [];
  for (const [domainId, label] of Object.entries(DOMAIN_LABELS)) {
    const policy = policies[domainId];
    if (!policy || !POLICY_TEXT[policy]) continue;
    const route = routes[domainId];
    const routeText = route && route.target ? ` Escalation route: ${route.target} (${route.type}).` : '';
    policyLines.push(`- ${label}: ${POLICY_TEXT[policy]}.${routeText}`);
  }
  if (policyLines.length) {
    lines.push('Answer policies by content domain:\n' + policyLines.join('\n'));
  }

  const terms = behaviors.terminology || [];
  if (terms.length) {
    lines.push('Terminology — always use the right-hand term in replies:\n'
      + terms.map((t) => `- "${t.from}" → "${t.to}"`).join('\n'));
  }

  if (behaviors.tonePreset) {
    lines.push(`Tone preset: ${behaviors.tonePreset}.`);
  }

  const banned = behaviors.bannedPhrases || [];
  if (banned.length) {
    lines.push(`Banned phrases (never use): ${banned.map((p) => `"${p}"`).join(', ')}.`);
  }

  // Raw-instructions escape hatch — appended verbatim, last, so the admin's
  // free prose can override the structured policy above (documented design).
  const raw = (behaviors.rawInstructions || '').trim();
  if (raw) {
    lines.push(`## Admin instructions (escape hatch — verbatim)\n${raw}`);
  }

  return lines.length > 1 ? lines.join('\n\n') : '';
}

// ── Bundles → experts ───────────────────────────────────────────────────────

function compileBundle(bundle, behaviors, connectedSourceIds, connectionIdBySourceId) {
  const connectionIds = [];
  for (const ref of bundle.sources || []) {
    const srcId = resolveSourceIdFromText(ref);
    if (!srcId || !connectedSourceIds.has(srcId)) continue;
    const connId = connectionIdBySourceId[srcId];
    if (connId && !connectionIds.includes(connId)) connectionIds.push(connId);
  }
  const audienceFacts = (bundle.audience || [])
    .map((a) => `${a.field}: ${a.value}`)
    .join('; ');
  const policy = bundle.policy && POLICY_TEXT[bundle.policy]
    ? `Answer policy: ${POLICY_TEXT[bundle.policy]}.`
    : '';
  const tone = bundle.tone ? `Tone: ${bundle.tone}.` : '';
  const terms = (behaviors?.terminology || [])
    .map((t) => `"${t.from}" → "${t.to}"`)
    .join(', ');
  const instructions = [
    `You are the "${bundle.name}" capability bundle — an internal policy container, invisible to employees. Answer as ONE Navigator.`,
    // V1 audiences are group-membership based; V2 derives audience from
    // profile facts (role / base / fleet). No 1:1 mapping exists, so the
    // bundle stays visible to everyone and the derived facts condition the
    // ANSWERS instead (documented mapping decision).
    audienceFacts ? `Intended audience (derived profile facts): ${audienceFacts}. Tailor answers to this audience.` : '',
    policy,
    tone,
    terms ? `Terminology: ${terms}.` : '',
    `Ground every factual answer in the connected sources and cite document titles.`,
  ].filter(Boolean).join('\n');

  return {
    name: bundle.name,
    icon: '🧩',
    description: `Capability bundle (compiled from Navigator V2)${audienceFacts ? ` — ${audienceFacts}` : ''}`,
    instructions,
    connectionIds,
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: V2_ORIGIN,
  };
}

// ── Processes → workflows ───────────────────────────────────────────────────

// Per-write-tool form/arg templates so compiled tool steps submit payloads
// that the demo MCPs actually accept. Fallback is a generic details field.
const TOOL_TEMPLATES = {
  submit_time_off_request: {
    fields: [
      { id: 'start_date', label: 'Start date', type: 'date', required: true },
      { id: 'end_date',   label: 'End date',   type: 'date', required: true },
      { id: 'reason',     label: 'Reason',     type: 'textarea', required: false },
    ],
    args: (formId) => ({
      start_date: `{{${formId}.start_date}}`,
      end_date: `{{${formId}.end_date}}`,
      reason: `{{${formId}.reason}}`,
    }),
  },
  create_ticket: {
    fields: [
      { id: 'details', label: 'Details', type: 'textarea', required: true },
    ],
    args: (formId, proc) => ({
      title: proc.name,
      body: `{{${formId}.details}}`,
      category: 'other',
    }),
  },
  request_software_access: {
    fields: [
      { id: 'software', label: 'What do you need?', type: 'text', required: true },
      { id: 'justification', label: 'Justification', type: 'textarea', required: true },
    ],
    args: (formId) => ({
      software: `{{${formId}.software}}`,
      urgency: 'normal',
      reason: `{{${formId}.justification}}`,
    }),
  },
};

const GENERIC_TEMPLATE = {
  fields: [{ id: 'details', label: 'Details', type: 'textarea', required: true }],
  args: (formId, proc) => ({ summary: `${proc.name}: {{${formId}.details}}` }),
};

function firstWriteToolFor(sourceId, state) {
  const map = RUNTIME_MAP[sourceId];
  if (!map) return null;
  const source = (state.sources || []).find((s) => s.id === sourceId);
  if (!source) return null;
  for (const cap of source.capabilities || []) {
    const capMap = map.caps[cap.id];
    if (capMap?.write && capMap.tools.length && cap.tier !== 'assist') {
      return { connectionId: map.connectionId, toolId: capMap.tools[0] };
    }
  }
  return null;
}

function triggerWordsFor(proc) {
  const words = [proc.name, ...(proc.steps || []).map((s) => s.label)].join(' ');
  return words;
}

function compileProcess(proc, state) {
  // Resolve the submit target: which connected system does the submit step
  // write into? Inferred from step label text (same heuristic the V2 Studio
  // tune checks use).
  const submitStep = (proc.steps || []).find((s) => s.type === 'submit');
  const submitSourceId = submitStep ? resolveSourceIdFromText(submitStep.label) : null;
  const writeRef = submitSourceId ? firstWriteToolFor(submitSourceId, state) : null;
  const template = writeRef ? (TOOL_TEMPLATES[writeRef.toolId] || GENERIC_TEMPLATE) : GENERIC_TEMPLATE;

  const steps = [];
  const formId = 'collect';
  for (const s of proc.steps || []) {
    if (s.type === 'collect') {
      steps.push({
        id: formId,
        type: 'form',
        label: s.label,
        spec: {
          id: formId,
          title: proc.name,
          description: s.label,
          submitLabel: 'Next',
          fields: template.fields.map((f) => ({ ...f })),
        },
      });
    } else if (s.type === 'approve') {
      // V2 "approve" maps to the V1 confirm step — the runtime's supported
      // pause-gate. (V1's `approval` step type validates but the live step
      // machine skips it, so confirm is the faithful executable mapping.)
      steps.push({
        id: 'approve',
        type: 'confirm',
        label: s.label,
        summary: {
          title: s.label,
          description: `Review before submitting — ${proc.justification || 'auditable process'}`,
          rows: template.fields.map((f) => ({ label: f.label, value: `{{${formId}.${f.id}}}` })),
          confirmLabel: 'Approve & submit',
          cancelLabel: 'Edit',
          cancelTo: formId,
        },
      });
    } else if (s.type === 'submit' && writeRef) {
      steps.push({
        id: 'submit',
        type: 'tool',
        label: s.label,
        tool: { connectionId: writeRef.connectionId, toolId: writeRef.toolId },
        args: template.args(formId, proc),
      });
    }
    // V2 "confirm" (confirm-to-employee) maps to the flow-completion summary
    // the V1 runner already emits — no extra step compiled.
  }

  return {
    id: `v2-${proc.id}`,
    origin: V2_ORIGIN,
    name: proc.name,
    trigger: triggerWordsFor(proc),
    goal: proc.justification || `${proc.name} completed with an audit trail`,
    tools: writeRef ? [{ connectionId: writeRef.connectionId, toolId: writeRef.toolId }] : [],
    mode: 'suggested',
    instructions: proc.justification || '',
    status: proc.status === 'active' ? 'active' : 'draft',
    steps,
  };
}

// ── Entry points ────────────────────────────────────────────────────────────

/**
 * Compile a full V2 state blob into V1 runtime entities.
 * Returns { connections, workflows, experts, toolTiers, policyPrompt }.
 */
export function compileV2(state) {
  const s = state || {};
  const toolTiers = {};
  const connections = (s.sources || [])
    .map((src) => compileSource(src, toolTiers))
    .filter(Boolean);

  const connectedSourceIds = new Set((s.sources || []).map((x) => x.id));
  const connectionIdBySourceId = Object.fromEntries(
    Object.entries(RUNTIME_MAP).map(([srcId, m]) => [srcId, m.connectionId])
  );

  const behaviors = s.behaviors || {};
  const experts = (behaviors.bundles || [])
    .map((b) => compileBundle(b, behaviors, connectedSourceIds, connectionIdBySourceId))
    // A bundle whose sources are all disconnected compiles to an expert with
    // no connections — keep it (it still carries policy/tone) unless it has
    // neither connections nor audience facts.
    .filter(Boolean);

  const workflows = (behaviors.processes || [])
    .filter((p) => p.status === 'active' || p.status === 'draft')
    .map((p) => compileProcess(p, s));

  return {
    connections,
    workflows,
    experts,
    toolTiers,
    policyPrompt: composePolicyPrompt(behaviors),
  };
}

/**
 * Merge compiled output into an existing navigator_config payload.
 * Replaces ONLY entities tagged `origin: 'v2'`; everything hand-made in the
 * V1 Studio passes through untouched. Stores the raw V2 state + derived
 * runtime hints under tenantOverrides.v2 (the additive section the
 * orchestrator and lib/workspace-config.mjs know about).
 */
export function mergeCompiledConfig(serverConfig, v2State, compiled = null) {
  const c = compiled || compileV2(v2State);
  const base = serverConfig || {};
  const keep = (arr) => (Array.isArray(arr) ? arr.filter((x) => x?.origin !== V2_ORIGIN) : []);
  return {
    connections: [...keep(base.connections), ...c.connections],
    workflows: [...keep(base.workflows), ...c.workflows],
    tenantOverrides: {
      ...(base.tenantOverrides || {}),
      v2: {
        version: v2State?.version ?? null,
        state: v2State || null,
        toolTiers: c.toolTiers,
        policyPrompt: c.policyPrompt,
        compiledAt: new Date().toISOString(),
      },
    },
  };
}

/**
 * Merge compiled experts into the server's expert list for a bulk-save:
 * keeps every non-v2 expert, replaces v2-origin experts with the fresh
 * compile (reusing DB ids by name so bulk-save updates instead of
 * delete+recreate).
 */
export function mergeCompiledExperts(serverExperts, compiledExperts) {
  const existing = Array.isArray(serverExperts) ? serverExperts : [];
  const keep = existing.filter((e) => e?.source !== V2_ORIGIN);
  const v2ByName = new Map(existing.filter((e) => e?.source === V2_ORIGIN).map((e) => [e.name, e]));
  const compiled = (compiledExperts || []).map((e) => {
    const prior = v2ByName.get(e.name);
    return prior ? { ...e, id: prior.id } : e;
  });
  return [...keep, ...compiled];
}

/** Expose the mapping table for smoke tests / docs. */
export function runtimeMap() {
  return RUNTIME_MAP;
}
