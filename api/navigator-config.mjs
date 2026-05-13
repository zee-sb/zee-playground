// Navigator workspace config API.
//
// Mirrors api/navigator-setup.mjs and api/navigator-assistant.mjs:
// single dispatcher, action picked from ?action= query param.
//
//   GET  /api/navigator-config?action=load   → load current config + revision
//   POST /api/navigator-config?action=save   → save config (optimistic CAS)
//
// The branch is resolved server-side via getBranch() — one branch per
// deployment for this prototype. Assistants are NOT in this blob; they
// live in navigator_assistants and are managed by /api/navigator-assistant.

import { getBranch } from '../lib/staffbase.mjs';
import {
  getConfig,
  saveConfig,
  ensureConfigRow,
  RevisionConflictError,
} from '../lib/workspace-config.mjs';
import { getBlueprint, listAssistants, createAssistant, deleteAssistant } from '../lib/blueprints.mjs';
import { checkConfigHealth } from '../lib/navigator-health.mjs';
import { buildSeedConfigPayload, buildSeedAssistants } from '../lib/seed.mjs';
import { dbConfigured } from '../lib/db.mjs';

// Memoize the deep-check result per (branchId, revision) so the LLM call
// only fires when something has actually changed.
const deepHealthCache = new Map(); // key → { value, expiresAt }
const DEEP_CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 min upper bound

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');
    if (action === 'load') return await handleLoad(req, res);
    if (action === 'save') return await handleSave(req, res);
    if (action === 'health') return await handleHealth(req, res, url);
    if (action === 'reseed') return await handleReseed(req, res);
    res.status(400).json({ error: 'unknown action — expected load | save | health | reseed' });
  } catch (err) {
    if (err instanceof RevisionConflictError) {
      return res.status(409).json({
        error: 'revision_conflict',
        currentRevision: err.currentRevision,
      });
    }
    res.status(500).json({ error: err.message || 'internal error' });
  }
}

async function getActiveBranch() {
  try {
    return await getBranch();
  } catch {
    return null;
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function extractBlueprintGroups(blueprintRow) {
  if (!blueprintRow?.blueprint) return [];
  const bp = blueprintRow.blueprint;
  const list = Array.isArray(bp.groups) ? bp.groups : (Array.isArray(bp.workspace?.groups) ? bp.workspace.groups : []);
  // Groups can be {name, memberCount} objects OR bare strings — normalize.
  return list.map((g) => (typeof g === 'string' ? g : g?.name)).filter(Boolean);
}

// ── load ───────────────────────────────────────────────────────────────────
async function handleLoad(_req, res) {
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const branch = await getActiveBranch();
  if (!branch?.id) return res.status(503).json({ error: 'branch_unavailable' });

  const [config, blueprintRow] = await Promise.all([
    getConfig(branch.id),
    getBlueprint(branch.id).catch(() => null),
  ]);
  const blueprintGroups = extractBlueprintGroups(blueprintRow);
  if (!config) {
    // No config row yet — return an empty default so the client can hydrate
    // and start editing. We do NOT auto-insert here: the row is created on
    // first save, so getConfig's null state and a freshly inserted row are
    // distinguishable in logs.
    return res.status(200).json({
      branchId: branch.id,
      branchName: branch.name,
      config: {
        connectors: [],
        flows: [],
        tenantOverrides: {},
      },
      blueprintGroups,
      revision: 0,
      empty: true,
    });
  }
  return res.status(200).json({
    branchId: branch.id,
    branchName: branch.name,
    config: {
      connectors: config.connectors,
      flows: config.flows,
      tenantOverrides: config.tenantOverrides,
    },
    blueprintGroups,
    revision: config.revision,
    updatedAt: config.updatedAt,
    empty: false,
  });
}

// ── save ───────────────────────────────────────────────────────────────────
async function handleSave(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const branch = await getActiveBranch();
  if (!branch?.id) return res.status(503).json({ error: 'branch_unavailable' });

  const body = await readJsonBody(req);
  const { config, baseRevision } = body || {};
  if (!config || typeof config !== 'object') {
    return res.status(400).json({ error: 'config object required' });
  }

  // Make sure a row exists so the CAS-update has something to hit. This is a
  // no-op if the row was already created on a prior save.
  if (baseRevision === 0 || baseRevision == null) {
    await ensureConfigRow(branch.id);
  }

  const saved = await saveConfig({
    branchId: branch.id,
    config,
    baseRevision: baseRevision ?? 1,
    userId: null,
  });

  return res.status(200).json({
    branchId: branch.id,
    branchName: branch.name,
    config: {
      connectors: saved.connectors,
      flows: saved.flows,
      tenantOverrides: saved.tenantOverrides,
    },
    revision: saved.revision,
    updatedAt: saved.updatedAt,
  });
}

// ── health ─────────────────────────────────────────────────────────────────
// Runs the cross-entity health check over the live workspace state. The
// cheap checks (broken refs, orphans, audience overlaps, blueprint coverage)
// are synchronous; pass ?deep=true to also run the LLM-judged assistant
// overlap check. Deep results are memoized by (branchId, revision) so
// re-checking the same state doesn't burn tokens.
async function handleHealth(_req, res, url) {
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const branch = await getActiveBranch();
  if (!branch?.id) return res.status(503).json({ error: 'branch_unavailable' });
  const deep = url.searchParams.get('deep') === 'true';

  const [config, blueprintRow, assistants] = await Promise.all([
    getConfig(branch.id).catch(() => null),
    getBlueprint(branch.id).catch(() => null),
    listAssistants(branch.id).catch(() => []),
  ]);
  const blueprint = blueprintRow?.blueprint || null;
  const revision = config?.revision || 0;

  // Deep cache key — same revision + same deep flag = same answer.
  const cacheKey = `${branch.id}:${revision}:${deep ? 'deep' : 'shallow'}`;
  const cached = deepHealthCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json({
      branchId: branch.id,
      branchName: branch.name,
      revision,
      cached: true,
      ...cached.value,
    });
  }

  const result = await checkConfigHealth({
    config: config || {},
    blueprint,
    assistants,
    deep,
  });

  // Stamp revision into the summary so the client can detect drift.
  result.summary.revision = revision;

  deepHealthCache.set(cacheKey, {
    value: result,
    expiresAt: Date.now() + DEEP_CACHE_MAX_AGE_MS,
  });
  // Trim the cache so it doesn't grow unbounded.
  if (deepHealthCache.size > 32) {
    const oldestKey = deepHealthCache.keys().next().value;
    deepHealthCache.delete(oldestKey);
  }

  return res.status(200).json({
    branchId: branch.id,
    branchName: branch.name,
    revision,
    cached: false,
    ...result,
  });
}

// ── reseed ────────────────────────────────────────────────────────────────
// "Back to known good" — wipes navigator_config + navigator_assistants for
// the active branch and re-inserts the canonical seed from lib/seed.mjs.
// Deliberately preserves `workspace_blueprints` so the admin doesn't have
// to re-run the (expensive) discovery wizard. Also preserves
// `users.connections` rows so a user with an OAuth token doesn't have to
// re-auth after the admin disables and re-enables a connector.
async function handleReseed(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const branch = await getActiveBranch();
  if (!branch?.id) return res.status(503).json({ error: 'branch_unavailable' });

  // 1) Wipe assistants for this branch and re-insert the seed list.
  const existing = await listAssistants(branch.id);
  for (const a of existing) {
    await deleteAssistant({ branchId: branch.id, id: a.id });
  }
  const seedAssistants = buildSeedAssistants();
  const created = [];
  for (const a of seedAssistants) {
    const row = await createAssistant({
      branchId: branch.id,
      assistant: a,
      source: a.source || 'seed',
      templateId: null,
      userId: null,
    });
    created.push(row);
  }

  // 2) Rewrite the navigator_config row to the seed payload. CAS-safe:
  //    fetch current revision first, then save with that revision so we
  //    don't trip the optimistic concurrency check.
  await ensureConfigRow(branch.id);
  const current = await getConfig(branch.id);
  const seedPayload = buildSeedConfigPayload();
  const saved = await saveConfig({
    branchId: branch.id,
    config: seedPayload,
    baseRevision: current?.revision ?? 0,
    userId: null,
  });

  return res.status(200).json({
    branchId: branch.id,
    branchName: branch.name,
    config: {
      connectors: saved.connectors,
      flows: saved.flows,
      tenantOverrides: saved.tenantOverrides,
    },
    revision: saved.revision,
    assistants: created,
    preserved: ['workspace_blueprints', 'connections', 'conversations'],
  });
}
