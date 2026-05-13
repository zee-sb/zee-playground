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

export function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    return { connectors: [], flows: [], tenantOverrides: {} };
  }
  const connectors = Array.isArray(config.connectors) ? config.connectors : [];
  const flows = Array.isArray(config.flows) ? config.flows : [];
  return {
    connectors: connectors.map((c) => ({
      ...c,
      kind: coerceStatus(c.kind, CONNECTOR_KINDS, KIND_DEFAULT),
      status: coerceStatus(c.status, CONNECTOR_STATES, CONNECTOR_DEFAULT),
    })),
    flows: flows.map((f) => ({
      ...f,
      status: coerceStatus(f.status, FLOW_STATES, FLOW_DEFAULT),
    })),
    tenantOverrides: (config.tenantOverrides && typeof config.tenantOverrides === 'object')
      ? config.tenantOverrides
      : {},
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
