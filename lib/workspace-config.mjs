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
export const STEP_TYPES = ['form', 'tool', 'confirm', 'photo'];
export const PHOTO_CAPTURE_MODES = ['camera', 'upload', 'both'];
export const PHOTO_ON_FAIL = ['warn', 'block', 'allow'];
export const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'url', 'date', 'select', 'checkbox', 'radio'];

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
  return {
    ...f,
    tools,
    status: coerceStatus(f?.status, WORKFLOW_STATES, WORKFLOW_DEFAULT),
    steps,
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
