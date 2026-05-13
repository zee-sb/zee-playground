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
import { dbConfigured } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');
    if (action === 'load') return await handleLoad(req, res);
    if (action === 'save') return await handleSave(req, res);
    res.status(400).json({ error: 'unknown action — expected load | save' });
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

// ── load ───────────────────────────────────────────────────────────────────
async function handleLoad(_req, res) {
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const branch = await getActiveBranch();
  if (!branch?.id) return res.status(503).json({ error: 'branch_unavailable' });

  const config = await getConfig(branch.id);
  if (!config) {
    // No config row yet — return an empty default so the client can hydrate
    // and start editing. We do NOT auto-insert here: the row is created on
    // first save, so getConfig's null state and a freshly inserted row are
    // distinguishable in logs.
    return res.status(200).json({
      branchId: branch.id,
      branchName: branch.name,
      config: {
        mcpConnectors: [],
        externalAgents: [],
        knowledgeBases: [],
        flows: [],
        tenantOverrides: {},
      },
      revision: 0,
      empty: true,
    });
  }
  return res.status(200).json({
    branchId: branch.id,
    branchName: branch.name,
    config: {
      mcpConnectors: config.mcpConnectors,
      externalAgents: config.externalAgents,
      knowledgeBases: config.knowledgeBases,
      flows: config.flows,
      tenantOverrides: config.tenantOverrides,
    },
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
      mcpConnectors: saved.mcpConnectors,
      externalAgents: saved.externalAgents,
      knowledgeBases: saved.knowledgeBases,
      flows: saved.flows,
      tenantOverrides: saved.tenantOverrides,
    },
    revision: saved.revision,
    updatedAt: saved.updatedAt,
  });
}
