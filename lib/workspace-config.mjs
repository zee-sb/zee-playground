// Typed helpers around navigator_config (migration 012).
//
// v8 simplification: the JSONB columns are now `connections` and `workflows`.
// Each connection carries a `kind: 'toolkit' | 'handoff' | 'search'`
// discriminator. Tenant overrides are unchanged.
//
// Concurrency: every write bumps `revision`. Callers pass `baseRevision`;
// mismatch throws RevisionConflictError so the UI can refetch.
//
// State machines enforced on save:
//   - connection.status : disconnected | connected | degraded
//   - workflow.status   : draft | active | archived
//   - connection.kind   : toolkit | handoff | search
// Invalid values coerce to defaults rather than 500 — prototype-friendly.

import { sql } from './db.mjs';

export const WORKFLOW_STATES = ['draft', 'active', 'archived'];
export const EXPERT_STATES = ['draft', 'active', 'archived'];
export const CONNECTION_STATES = ['disconnected', 'connected', 'degraded'];
export const CONNECTION_KINDS = ['toolkit', 'handoff', 'search'];
export const STEP_TYPES = [
  'form', 'tool', 'confirm', 'photo',
  // Added in the v9 expansion — see lib/flows/types.mjs for shape docs.
  'approval', 'branch', 'file_upload', 'signature', 'location', 'barcode', 'wait', 'notify',
];
export const PHOTO_CAPTURE_MODES = ['camera', 'upload', 'both'];
export const PHOTO_ON_FAIL = ['warn', 'block', 'allow'];
export const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'url', 'date', 'select', 'checkbox', 'radio'];
export const APPROVAL_ROUTES = ['manager', 'hr', 'it', 'finance', 'role', 'named'];
export const SIGNATURE_KINDS = ['draw', 'type', 'click'];
export const FILE_KINDS = ['pdf', 'image', 'document', 'any'];
export const WAIT_UNITS = ['minutes', 'hours', 'days'];
export const NOTIFY_CHANNELS = ['push', 'email', 'in_app'];
// Plain-English step type names — surfaced everywhere admin-facing. Avoid
// leaking the internal `tool` / `form` jargon to non-technical admins.
export const STEP_TYPE_LABELS = {
  form:        'Ask for info',
  tool:        'Run an action',
  confirm:     'Confirm before submitting',
  photo:       'Capture a photo',
  approval:    'Wait for approval',
  branch:      'Branch on a condition',
  file_upload: 'Upload a file',
  signature:   'Collect a signature',
  location:    'Capture location',
  barcode:     'Scan a barcode',
  wait:        'Wait / schedule',
  notify:      'Send a notification',
};

const WORKFLOW_DEFAULT = 'active';
const CONNECTION_DEFAULT = 'connected';
const KIND_DEFAULT = 'toolkit';

export class RevisionConflictError extends Error {
  constructor(current) {
    super('revision_conflict');
    this.code = 'revision_conflict';
    this.currentRevision = current;
  }
}

function coerceStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeField(raw, idx) {
  const id = (raw?.id && String(raw.id)) || `field_${idx + 1}`;
  const type = FIELD_TYPES.includes(raw?.type) ? raw.type : 'text';
  const out = {
    id,
    label: raw?.label || id,
    type,
    required: !!raw?.required,
  };
  if (raw?.description) out.description = String(raw.description);
  if (raw?.placeholder) out.placeholder = String(raw.placeholder);
  if (raw?.defaultValue !== undefined) out.defaultValue = raw.defaultValue;
  if (Array.isArray(raw?.options)) {
    out.options = raw.options
      .map((o) => ({
        value: String(o?.value ?? ''),
        label: String(o?.label ?? o?.value ?? ''),
      }))
      .filter((o) => o.value !== '');
  }
  if (raw?.validation && typeof raw.validation === 'object') {
    out.validation = { ...raw.validation };
  }
  return out;
}

function normalizeStep(raw, idx) {
  if (!raw || typeof raw !== 'object') return null;
  const type = STEP_TYPES.includes(raw.type) ? raw.type : null;
  if (!type) return null;
  const id = (raw.id && String(raw.id)) || `step_${idx + 1}`;
  const label = raw.label || id;
  if (type === 'form') {
    const spec = (raw.spec && typeof raw.spec === 'object') ? raw.spec : {};
    const fields = Array.isArray(spec.fields) ? spec.fields.map(normalizeField).filter(Boolean) : [];
    return {
      id, type, label,
      spec: {
        id: spec.id || id,
        title: spec.title || label,
        description: spec.description || '',
        submitLabel: spec.submitLabel || 'Submit',
        cancelLabel: spec.cancelLabel || undefined,
        fields,
      },
    };
  }
  if (type === 'tool') {
    const tool = (raw.tool && typeof raw.tool === 'object') ? raw.tool : {};
    return {
      id, type, label,
      tool: {
        connectionId: tool.connectionId || tool.connectorId || '',
        toolId: tool.toolId || '',
      },
      args: (raw.args && typeof raw.args === 'object') ? { ...raw.args } : {},
      output: (raw.output && typeof raw.output === 'object') ? { ...raw.output } : undefined,
    };
  }
  if (type === 'photo') {
    const spec = (raw.spec && typeof raw.spec === 'object') ? raw.spec : {};
    const ai = (spec.aiValidation && typeof spec.aiValidation === 'object') ? spec.aiValidation : {};
    const criteria = Array.isArray(ai.criteria)
      ? ai.criteria
          .map((c, ci) => ({
            id: (c?.id && String(c.id)) || `criterion_${ci + 1}`,
            label: String(c?.label ?? '').trim(),
            required: !!c?.required,
          }))
          .filter((c) => c.label)
      : [];
    return {
      id, type, label,
      spec: {
        id: spec.id || id,
        title: spec.title || label,
        description: spec.description || '',
        captureMode: PHOTO_CAPTURE_MODES.includes(spec.captureMode) ? spec.captureMode : 'both',
        submitLabel: spec.submitLabel || 'Use this photo',
        retakeLabel: spec.retakeLabel || 'Retake',
        onFail: PHOTO_ON_FAIL.includes(spec.onFail) ? spec.onFail : 'warn',
        aiValidation: {
          enabled: ai.enabled !== false,
          model: typeof ai.model === 'string' && ai.model ? ai.model : 'gpt-4o-mini',
          systemPrompt: typeof ai.systemPrompt === 'string' ? ai.systemPrompt : '',
          criteria,
          annotations: ai.annotations !== false,
        },
      },
    };
  }
  if (type === 'approval') {
    const a = (raw.approval && typeof raw.approval === 'object') ? raw.approval : {};
    return {
      id, type, label,
      approval: {
        route:  APPROVAL_ROUTES.includes(a.route) ? a.route : 'manager',
        // For route='named' / 'role', who specifically. Free-text token-friendly.
        approver: typeof a.approver === 'string' ? a.approver : '',
        title:    a.title || label || 'Approval needed',
        message:  a.message || 'Please review and approve this request.',
        slaHours: Number.isFinite(Number(a.slaHours)) ? Math.max(0, Number(a.slaHours)) : 24,
        onReject: ['cancel', 'continue', 'rewind'].includes(a.onReject) ? a.onReject : 'cancel',
        rewindTo: a.rewindTo || undefined,
      },
    };
  }
  if (type === 'branch') {
    const b = (raw.branch && typeof raw.branch === 'object') ? raw.branch : {};
    return {
      id, type, label,
      branch: {
        // Token-evaluated left side, e.g. {{collect-expense.amount}}
        left:     typeof b.left === 'string' ? b.left : '',
        // Operator on resolved values.
        op:       ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'is_truthy'].includes(b.op) ? b.op : 'equals',
        right:    typeof b.right === 'string' ? b.right : '',
        // When the condition is TRUE → jump to this step id. When false → next.
        thenGoTo: b.thenGoTo || undefined,
        elseGoTo: b.elseGoTo || undefined,
      },
    };
  }
  if (type === 'file_upload') {
    const f = (raw.file && typeof raw.file === 'object') ? raw.file : {};
    return {
      id, type, label,
      file: {
        title:       f.title || label || 'Upload a file',
        description: f.description || '',
        kind:        FILE_KINDS.includes(f.kind) ? f.kind : 'any',
        maxMB:       Number.isFinite(Number(f.maxMB)) ? Math.max(1, Number(f.maxMB)) : 10,
        required:    f.required !== false,
        submitLabel: f.submitLabel || 'Upload',
      },
    };
  }
  if (type === 'signature') {
    const s = (raw.signature && typeof raw.signature === 'object') ? raw.signature : {};
    return {
      id, type, label,
      signature: {
        title:       s.title || label || 'Signature required',
        description: s.description || '',
        // What text/policy the employee is attesting to.
        attestation: s.attestation || 'I have read and agree to the policy above.',
        kind:        SIGNATURE_KINDS.includes(s.kind) ? s.kind : 'draw',
        required:    s.required !== false,
      },
    };
  }
  if (type === 'location') {
    const l = (raw.location && typeof raw.location === 'object') ? raw.location : {};
    return {
      id, type, label,
      location: {
        title:       l.title || label || 'Share your location',
        description: l.description || '',
        accuracy:    ['precise', 'approximate'].includes(l.accuracy) ? l.accuracy : 'precise',
        required:    l.required !== false,
      },
    };
  }
  if (type === 'barcode') {
    const b = (raw.barcode && typeof raw.barcode === 'object') ? raw.barcode : {};
    return {
      id, type, label,
      barcode: {
        title:       b.title || label || 'Scan a code',
        description: b.description || '',
        // Which symbology to accept — UI hint only.
        format:      ['any', 'qr', 'ean', 'code128', 'datamatrix'].includes(b.format) ? b.format : 'any',
        required:    b.required !== false,
      },
    };
  }
  if (type === 'wait') {
    const w = (raw.wait && typeof raw.wait === 'object') ? raw.wait : {};
    return {
      id, type, label,
      wait: {
        amount: Number.isFinite(Number(w.amount)) ? Math.max(0, Number(w.amount)) : 1,
        unit:   WAIT_UNITS.includes(w.unit) ? w.unit : 'hours',
        // What to tell the user while waiting.
        message: w.message || `We'll continue this in ${w.amount || 1} ${w.unit || 'hours'}.`,
      },
    };
  }
  if (type === 'notify') {
    const n = (raw.notify && typeof raw.notify === 'object') ? raw.notify : {};
    return {
      id, type, label,
      notify: {
        channel: NOTIFY_CHANNELS.includes(n.channel) ? n.channel : 'push',
        // Audience target. Common values: 'employee', 'manager', 'role:HR'.
        to:       n.to || 'employee',
        title:    n.title || 'Update from Navigator',
        body:     n.body || '',
        deepLink: n.deepLink || undefined,
      },
    };
  }
  // confirm
  const summary = (raw.summary && typeof raw.summary === 'object') ? raw.summary : {};
  const rows = Array.isArray(summary.rows)
    ? summary.rows.map((r) => ({
        label: String(r?.label ?? ''),
        value: String(r?.value ?? ''),
      }))
    : [];
  return {
    id, type, label,
    summary: {
      title: summary.title || label,
      description: summary.description || '',
      rows,
      confirmLabel: summary.confirmLabel || 'Confirm',
      cancelLabel: summary.cancelLabel || 'Cancel',
      cancelTo: summary.cancelTo || undefined,
    },
  };
}

function normalizeAudience(a) {
  if (!a || typeof a !== 'object') return { everyone: true, roles: [], locations: [] };
  return {
    everyone: a.everyone !== false,
    roles:     Array.isArray(a.roles) ? a.roles.map(String) : [],
    locations: Array.isArray(a.locations) ? a.locations.map(String) : [],
  };
}

function normalizeVersionEntry(v) {
  if (!v || typeof v !== 'object') return null;
  const version = Number(v.version);
  if (!Number.isFinite(version) || version < 1) return null;
  return {
    version,
    publishedAt: typeof v.publishedAt === 'string' ? v.publishedAt : null,
    publishedBy: v.publishedBy || null,
    note:        typeof v.note === 'string' ? v.note : '',
    // The snapshot is opaque (the full flow payload at publish time). We just
    // keep it small enough to render in a "show diff" view.
    snapshot:    v.snapshot && typeof v.snapshot === 'object' ? v.snapshot : null,
  };
}

function normalizeWorksCouncil(wc) {
  if (!wc || typeof wc !== 'object') {
    return { required: false, status: 'not_required', approvedBy: null, approvedAt: null, note: '' };
  }
  return {
    required:   !!wc.required,
    status:     ['not_required', 'pending', 'approved', 'rejected'].includes(wc.status) ? wc.status : (wc.required ? 'pending' : 'not_required'),
    approvedBy: wc.approvedBy || null,
    approvedAt: typeof wc.approvedAt === 'string' ? wc.approvedAt : null,
    note:       typeof wc.note === 'string' ? wc.note : '',
  };
}

function normalizeWorkflow(f) {
  const steps = Array.isArray(f?.steps)
    ? f.steps.map(normalizeStep).filter(Boolean)
    : [];
  // Enforce unique step ids — append a suffix on collision.
  const seen = new Set();
  for (const s of steps) {
    let id = s.id;
    let n = 1;
    while (seen.has(id)) { n += 1; id = `${s.id}_${n}`; }
    s.id = id;
    seen.add(id);
  }
  // Normalize tool refs at the workflow level (tools[]) too — coerce
  // connectorId → connectionId so legacy payloads still round-trip.
  const tools = Array.isArray(f?.tools)
    ? f.tools.map((t) => {
        if (typeof t === 'string') return t;
        return {
          connectionId: t?.connectionId || t?.connectorId || '',
          toolId: t?.toolId || '',
        };
      })
    : [];
  const versions = Array.isArray(f?.versions)
    ? f.versions.map(normalizeVersionEntry).filter(Boolean).sort((a, b) => b.version - a.version)
    : [];
  return {
    ...f,
    tools,
    status: coerceStatus(f?.status, WORKFLOW_STATES, WORKFLOW_DEFAULT),
    steps,
    audience: normalizeAudience(f?.audience),
    // Whether the editor is showing a draft on top of a published version.
    hasDraft:           !!f?.hasDraft,
    publishedVersion:   Number.isFinite(Number(f?.publishedVersion)) ? Number(f.publishedVersion) : (versions[0]?.version || 0),
    versions,
    worksCouncil: normalizeWorksCouncil(f?.worksCouncil),
    ownerTeam: typeof f?.ownerTeam === 'string' ? f.ownerTeam : '',
    // Suggestion-chip dismissal log: { [userId]: ISO timestamp }. Suppress when
    // less than `dismissalSuppressDays` (default 7) have elapsed.
    dismissedFor: f?.dismissedFor && typeof f.dismissedFor === 'object' ? { ...f.dismissedFor } : {},
    dismissalSuppressDays: Number.isFinite(Number(f?.dismissalSuppressDays)) ? Math.max(0, Number(f.dismissalSuppressDays)) : 7,
  };
}

// Voice config block — tenant-level controls for the voice MVP. Lives under
// tenantOverrides.voice so it persists alongside other tenant prefs.
const VOICE_MODES = ['ptt', 'hands_free', 'disabled'];

function normalizeVoiceConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      enabled: true,
      mode: 'ptt',
      tts: { autoPlay: false, voicePerLang: {} },
      retention: { audioDays: 0, transcriptDays: 30 },
      languages: [
        { code: 'en', locale: 'en_US' },
        { code: 'de', locale: 'de_DE' },
      ],
    };
  }
  const tts = raw.tts && typeof raw.tts === 'object' ? raw.tts : {};
  const retention = raw.retention && typeof raw.retention === 'object' ? raw.retention : {};
  const languages = Array.isArray(raw.languages)
    ? raw.languages
        .map((l) => ({
          code: typeof l?.code === 'string' ? l.code.toLowerCase().slice(0, 5) : null,
          locale: typeof l?.locale === 'string' ? l.locale : null,
        }))
        .filter((l) => l.code)
    : [];
  return {
    enabled: raw.enabled !== false,
    mode: VOICE_MODES.includes(raw.mode) ? raw.mode : 'ptt',
    tts: {
      autoPlay: !!tts.autoPlay,
      voicePerLang: tts.voicePerLang && typeof tts.voicePerLang === 'object' ? { ...tts.voicePerLang } : {},
    },
    retention: {
      audioDays: Number.isFinite(Number(retention.audioDays)) ? Math.max(0, Number(retention.audioDays)) : 0,
      transcriptDays: Number.isFinite(Number(retention.transcriptDays)) ? Math.max(0, Number(retention.transcriptDays)) : 30,
    },
    languages: languages.length ? languages : [{ code: 'en', locale: 'en_US' }],
  };
}

// ── V2 section (tenantOverrides.v2) — additive, see lib/v2-compiler.mjs ─────
// Stored alongside the V1 blob so the NavigatorV2 prototypes persist per
// tenant without a migration. Strictly additive: when absent, nothing here
// runs and V1 saves round-trip byte-identically.
export const V2_TIER_STATES = ['assist', 'trigger', 'execute'];

function normalizeV2Section(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const toolTiers = {};
  if (raw.toolTiers && typeof raw.toolTiers === 'object') {
    for (const [key, tier] of Object.entries(raw.toolTiers)) {
      if (typeof key !== 'string' || !key.includes('__')) continue;
      toolTiers[key] = V2_TIER_STATES.includes(tier) ? tier : 'trigger';
    }
  }
  return {
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : null,
    // The raw V2 Studio state is an opaque client blob; cap nothing but type.
    state: raw.state && typeof raw.state === 'object' ? raw.state : null,
    toolTiers,
    policyPrompt: typeof raw.policyPrompt === 'string' ? raw.policyPrompt.slice(0, 8000) : '',
    compiledAt: typeof raw.compiledAt === 'string' ? raw.compiledAt : null,
  };
}

export function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    return {
      connections: [],
      workflows: [],
      tenantOverrides: { voice: normalizeVoiceConfig(null) },
    };
  }
  const connections = Array.isArray(config.connections) ? config.connections : [];
  const workflows = Array.isArray(config.workflows) ? config.workflows : [];
  const tenantOverrides = (config.tenantOverrides && typeof config.tenantOverrides === 'object')
    ? { ...config.tenantOverrides }
    : {};
  tenantOverrides.voice = normalizeVoiceConfig(tenantOverrides.voice);
  // Additive: only touch the v2 key when the caller sent one.
  if ('v2' in tenantOverrides) {
    const v2 = normalizeV2Section(tenantOverrides.v2);
    if (v2) tenantOverrides.v2 = v2;
    else delete tenantOverrides.v2;
  }
  return {
    connections: connections.map((c) => ({
      ...c,
      kind: coerceStatus(c.kind, CONNECTION_KINDS, KIND_DEFAULT),
      status: coerceStatus(c.status, CONNECTION_STATES, CONNECTION_DEFAULT),
    })),
    workflows: workflows.map(normalizeWorkflow),
    tenantOverrides,
  };
}

function rowToConfig(row) {
  return {
    branchId: row.staffbase_branch_id,
    connections: row.connections || [],
    workflows: row.workflows || [],
    tenantOverrides: row.tenant_overrides || {},
    revision: Number(row.revision),
    updatedAt: row.updated_at,
  };
}

export async function getConfig(branchId) {
  if (!branchId) return null;
  const rows = await sql`
    select staffbase_branch_id, connections, workflows, tenant_overrides, revision, updated_at
    from navigator_config
    where staffbase_branch_id = ${branchId}
    limit 1
  `;
  return rows[0] ? rowToConfig(rows[0]) : null;
}

// Initialize an empty row for a freshly-discovered branch. Idempotent.
export async function ensureConfigRow(branchId) {
  if (!branchId) throw new Error('branchId required');
  await sql`
    insert into navigator_config (staffbase_branch_id)
    values (${branchId})
    on conflict (staffbase_branch_id) do nothing
  `;
}

export async function saveConfig({ branchId, config, baseRevision, userId }) {
  if (!branchId) throw new Error('branchId required');
  const norm = normalizeConfig(config);
  const rows = await sql`
    update navigator_config set
      connections       = ${JSON.stringify(norm.connections)}::jsonb,
      workflows         = ${JSON.stringify(norm.workflows)}::jsonb,
      tenant_overrides  = ${JSON.stringify(norm.tenantOverrides)}::jsonb,
      revision          = revision + 1,
      updated_at        = now(),
      updated_by_user_id = ${userId || null}
    where staffbase_branch_id = ${branchId}
      and revision = ${baseRevision ?? 0}
    returning staffbase_branch_id, connections, workflows, tenant_overrides, revision, updated_at
  `;
  if (rows.length > 0) return rowToConfig(rows[0]);

  const current = await getConfig(branchId);
  if (!current) {
    if (baseRevision === 0 || baseRevision == null) {
      await ensureConfigRow(branchId);
      return saveConfig({ branchId, config, baseRevision: 1, userId });
    }
    throw new RevisionConflictError(0);
  }
  throw new RevisionConflictError(current.revision);
}
