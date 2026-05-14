// Helpers used by the chat orchestrator to drive an admin-defined flow's
// step machine. Pure (no DB / network) — easy to unit-test, easy to call
// server-side or from the Studio preview pane.
//
// Conceptual model:
//   • A flow has an ordered `steps: [FormStep | ToolStep | ConfirmStep]`.
//   • A *run* of the flow tracks { currentStepIndex, stepOutputs }.
//   • Token references like {{collect-dates.start_date}} resolve against
//     stepOutputs.
//   • The runtime advances one step at a time and may *pause* (form, confirm)
//     waiting on user input.

// ── Tokens ──────────────────────────────────────────────────────────────────

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function lookup(path, ctx) {
  if (!path) return undefined;
  const parts = String(path).split('.');
  let cur = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function resolveToken(str, stepOutputs) {
  if (typeof str !== 'string') return str;
  // Single-token shortcut: when the whole string is exactly one token, return
  // the underlying value (preserves numbers/booleans/objects).
  const single = str.match(/^\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}$/);
  if (single) {
    const v = lookup(single[1], stepOutputs);
    return v === undefined ? '' : v;
  }
  return str.replace(TOKEN_RE, (_, path) => {
    const v = lookup(path, stepOutputs);
    return v === undefined || v === null ? '' : String(v);
  });
}

export function resolveTokens(value, stepOutputs) {
  if (value == null) return value;
  if (typeof value === 'string') return resolveToken(value, stepOutputs);
  if (Array.isArray(value)) return value.map((v) => resolveTokens(v, stepOutputs));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveTokens(v, stepOutputs);
    return out;
  }
  return value;
}

// ── Trigger matching ────────────────────────────────────────────────────────
// Stronger than flowMatchesText (which fires on any notable-word overlap). For
// step machines we want flows to fire on strong, intentional matches only;
// otherwise the user gets a form they didn't ask for. We require either an
// exact normalized phrase hit OR two notable-word matches.

const TRIGGER_STOPWORDS = new Set([
  'a','an','the','to','of','in','on','at','for','and','or','my','me','i','you',
  'is','are','be','do','does','can','please','need','want','wants','asks',
  'employee','employees','someone','about','with','some','that','this','they',
  'their','them','there','here','have','has','from','it','its','book','take',
]);

function notableSet(s) {
  return new Set(
    String(s || '').toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !TRIGGER_STOPWORDS.has(w))
  );
}

export function matchesFlowTrigger(text, flow) {
  if (!flow || !text) return false;
  const t = String(text).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const trigWords = notableSet(flow.trigger || '');
  const userWords = notableSet(t);
  // Fire on either (a) a single strong-keyword overlap (≥5 chars — "pto",
  // "vacation", "laptop") or (b) any two notable-word matches.
  let overlap = 0;
  let hasStrong = false;
  for (const w of userWords) {
    if (trigWords.has(w)) {
      overlap += 1;
      if (w.length >= 3) hasStrong = true;
    }
  }
  return hasStrong || overlap >= 2;
}

// ── Run state ───────────────────────────────────────────────────────────────

export function makeInitialRun(flow) {
  return {
    flowId: flow.id,
    flowName: flow.name,
    currentStepIndex: 0,
    stepOutputs: {},
    status: 'running', // 'running' | 'awaiting_user' | 'completed' | 'cancelled'
    awaiting: null,    // { kind: 'form' | 'confirm', stepId }
  };
}

export function currentStep(flow, run) {
  if (!flow || !run) return null;
  return flow.steps?.[run.currentStepIndex] || null;
}

export function applyFormSubmission(flow, run, stepId, values) {
  const submittedIdx = flow.steps.findIndex((s) => s.id === stepId);
  const step = flow.steps[submittedIdx];
  if (!step || step.type !== 'form') return run;
  // Advance past this form step. Stale submissions for an already-completed
  // step (idx < currentStepIndex) update stepOutputs without rewinding.
  const nextIdx = submittedIdx === run.currentStepIndex
    ? run.currentStepIndex + 1
    : run.currentStepIndex;
  return {
    ...run,
    currentStepIndex: nextIdx,
    stepOutputs: { ...run.stepOutputs, [stepId]: values },
    awaiting: null,
    status: 'running',
  };
}

export function applyConfirmResponse(flow, run, stepId, accepted, cancelTo) {
  const submittedIdx = flow.steps.findIndex((s) => s.id === stepId);
  const step = flow.steps[submittedIdx];
  if (!step || step.type !== 'confirm') return run;
  if (accepted) {
    const nextIdx = submittedIdx === run.currentStepIndex
      ? run.currentStepIndex + 1
      : run.currentStepIndex;
    return {
      ...run,
      currentStepIndex: nextIdx,
      stepOutputs: { ...run.stepOutputs, [stepId]: { confirmed: true } },
      awaiting: null,
      status: 'running',
    };
  }
  // Cancel → rewind to cancelTo (or the prior form step, or step 0).
  let target = cancelTo || step.summary?.cancelTo;
  let targetIndex = -1;
  if (target) {
    targetIndex = flow.steps.findIndex((s) => s.id === target);
  }
  if (targetIndex === -1) {
    // Scan backwards for the latest form step.
    for (let i = run.currentStepIndex - 1; i >= 0; i--) {
      if (flow.steps[i].type === 'form') { targetIndex = i; break; }
    }
  }
  if (targetIndex === -1) targetIndex = 0;
  return {
    ...run,
    currentStepIndex: targetIndex,
    awaiting: null,
    status: 'running',
  };
}

export function advance(run) {
  return { ...run, currentStepIndex: run.currentStepIndex + 1 };
}

export function complete(run, summary) {
  return { ...run, status: 'completed', summary: summary || null, awaiting: null };
}

// ── Static analysis: outputs available at each step (for the Studio token picker)

export function availableOutputsBefore(flow, stepIndex) {
  const available = []; // [{ stepId, label, kind, fields?: [{id,label,type}] }]
  for (let i = 0; i < stepIndex; i++) {
    const s = flow.steps[i];
    if (!s) continue;
    if (s.type === 'form') {
      available.push({
        stepId: s.id,
        label: s.label,
        kind: 'form',
        fields: (s.spec?.fields || []).map((f) => ({ id: f.id, label: f.label, type: f.type })),
      });
    } else if (s.type === 'tool') {
      available.push({
        stepId: s.id,
        label: s.label,
        kind: 'tool',
        // Tool outputs are opaque at design time — represent as a single
        // {{step.<id>}} token; admins can drill into known sub-paths manually.
        fields: [{ id: '', label: 'result', type: 'object' }],
      });
    }
  }
  return available;
}

// ── Tool-arg AI fallback (best-effort placeholder; orchestrator may extend) ──

// Given a tool step's args and the inputSchema of the resolved tool, return
// the list of required-but-still-missing field names. Useful for deciding
// whether to auto-insert a Form prompt.
export function missingRequiredArgs(resolvedArgs, inputSchema) {
  if (!inputSchema || typeof inputSchema !== 'object') return [];
  const required = Array.isArray(inputSchema.required) ? inputSchema.required : [];
  const missing = [];
  for (const name of required) {
    const v = resolvedArgs?.[name];
    if (v === undefined || v === null || v === '') missing.push(name);
  }
  return missing;
}
