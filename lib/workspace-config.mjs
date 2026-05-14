// Typed helpers around navigator_config (migration 007).
//
// v7 unification: the three legacy columns (mcp_connectors, external_agents,
// knowledge_bases) collapse into one `connectors` JSONB column. Each
// connector carries a `kind: 'mcp' | 'agent' | 'kb'` discriminator. Tenant
// overrides + flows are unchanged.
//
// Concurrency: every write bumps `revision`. Callers pass `baseRevision`;
// mismatch throws RevisionConflictError so the UI can refetch.
//
// State machines enforced on save:
//   - connector.status : disconnected | connected | degraded
//   - flow.status      : draft | active | archived
//   - connector.kind   : mcp | agent | kb
// Invalid values coerce to defaults rather than 500 — prototype-friendly.

import { sql } from './db.mjs';

export const FLOW_STATES = ['draft', 'active', 'archived'];
export const ASSISTANT_STATES = ['draft', 'active', 'archived'];
export const CONNECTOR_STATES = ['disconnected', 'connected', 'degraded'];
export const CONNECTOR_KINDS = ['mcp', 'agent', 'kb'];
export const STEP_TYPES = ['form', 'tool', 'confirm'];
export const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'url', 'date', 'select', 'checkbox', 'radio'];

const FLOW_DEFAULT = 'active';
const CONNECTOR_DEFAULT = 'connected';
const KIND_DEFAULT = 'mcp';

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
        connectorId: tool.connectorId || '',
        toolId: tool.toolId || '',
      },
      args: (raw.args && typeof raw.args === 'object') ? { ...raw.args } : {},
      output: (raw.output && typeof raw.output === 'object') ? { ...raw.output } : undefined,
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

function normalizeFlow(f) {
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
  return {
    ...f,
    status: coerceStatus(f?.status, FLOW_STATES, FLOW_DEFAULT),
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
      connectors: [],
      flows: [],
      tenantOverrides: { voice: normalizeVoiceConfig(null) },
    };
  }
  const connectors = Array.isArray(config.connectors) ? config.connectors : [];
  const flows = Array.isArray(config.flows) ? config.flows : [];
  const tenantOverrides = (config.tenantOverrides && typeof config.tenantOverrides === 'object')
    ? { ...config.tenantOverrides }
    : {};
  tenantOverrides.voice = normalizeVoiceConfig(tenantOverrides.voice);
  return {
    connectors: connectors.map((c) => ({
      ...c,
      kind: coerceStatus(c.kind, CONNECTOR_KINDS, KIND_DEFAULT),
      status: coerceStatus(c.status, CONNECTOR_STATES, CONNECTOR_DEFAULT),
    })),
    flows: flows.map(normalizeFlow),
    tenantOverrides,
  };
}

function rowToConfig(row) {
  return {
    branchId: row.staffbase_branch_id,
    connectors: row.connectors || [],
    flows: row.flows || [],
    tenantOverrides: row.tenant_overrides || {},
    revision: Number(row.revision),
    updatedAt: row.updated_at,
  };
}

export async function getConfig(branchId) {
  if (!branchId) return null;
  const rows = await sql`
    select staffbase_branch_id, connectors, flows, tenant_overrides, revision, updated_at
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
      connectors        = ${JSON.stringify(norm.connectors)}::jsonb,
      flows             = ${JSON.stringify(norm.flows)}::jsonb,
      tenant_overrides  = ${JSON.stringify(norm.tenantOverrides)}::jsonb,
      revision          = revision + 1,
      updated_at        = now(),
      updated_by_user_id = ${userId || null}
    where staffbase_branch_id = ${branchId}
      and revision = ${baseRevision ?? 0}
    returning staffbase_branch_id, connectors, flows, tenant_overrides, revision, updated_at
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
