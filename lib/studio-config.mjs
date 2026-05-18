// Studio config loader for the Companion runtime.
//
// One call per chat turn loads the live Studio state (navigator_config row
// + blueprint + persisted experts) for the active Staffbase branch, with
// a 30s in-memory TTL so a chat→confirm round-trip doesn't double-read.
//
// v8 simplification: connections are one list with
// `kind: 'toolkit' | 'handoff' | 'search'`. `materializeActiveScope` returns
// one filtered connections[] array plus quick lookup maps. Experts reference
// connections via a single `connectionIds[]`. Workflows reference them via
// `{ connectionId, toolId }`.

import { getBranch } from './staffbase.mjs';
import { getConfig } from './workspace-config.mjs';
import { getBlueprint, listExperts } from './blueprints.mjs';

const CACHE_TTL_MS = 30_000;
const cache = new Map();

function now() { return Date.now(); }

function getCached(branchId) {
  const hit = cache.get(branchId);
  if (!hit) return null;
  if (hit.expiresAt < now()) { cache.delete(branchId); return null; }
  return hit.value;
}

function setCached(branchId, value) {
  cache.set(branchId, { value, expiresAt: now() + CACHE_TTL_MS });
}

export function invalidateStudioCache(branchId) {
  if (branchId) cache.delete(branchId);
  else cache.clear();
}

export async function loadStudio({ branchId: passedBranchId } = {}) {
  let branchId = passedBranchId;
  let branchName = null;
  if (!branchId) {
    const branch = await getBranch().catch(() => null);
    branchId = branch?.id || null;
    branchName = branch?.name || null;
  }
  if (!branchId) return null;

  const cached = getCached(branchId);
  if (cached) return cached;

  const [config, blueprintRow, experts] = await Promise.all([
    getConfig(branchId).catch(() => null),
    getBlueprint(branchId).catch(() => null),
    listExperts(branchId).catch(() => []),
  ]);

  const value = {
    branchId,
    branchName,
    config: config || { connections: [], workflows: [], tenantOverrides: {}, revision: 0 },
    blueprint: blueprintRow?.blueprint || null,
    experts: experts || [],
  };
  setCached(branchId, value);
  return value;
}

export function isStudioEmpty(studio) {
  if (!studio) return true;
  const c = studio.config || {};
  const hasConnections = (c.connections || []).length > 0;
  const hasWorkflows = (c.workflows || []).length > 0;
  const hasExperts = (studio.experts || []).length > 0;
  return !hasConnections && !hasWorkflows && !hasExperts;
}

export function userToAudience(userProfile) {
  if (!userProfile) return { groups: [], role: null, location: null };
  const dept = userProfile.department || null;
  return {
    name: userProfile.name || null,
    email: userProfile.email || null,
    groups: dept ? [dept] : [],
    role: dept || null,
    location: null,
  };
}

export function expertVisibleTo(expert, user) {
  if (!expert) return false;
  const aud = expert.audience || { everyone: true };
  if (aud.everyone) return true;
  if (!user) return false;
  const groups = aud.groups || [];
  const roles = aud.roles || [];
  const locations = aud.locations || [];
  if (groups.length === 0 && roles.length === 0 && locations.length === 0) return true;
  const userGroups = user.groups || [];
  const matchGroup = groups.length > 0 && groups.some((g) => userGroups.includes(g));
  const matchRole = roles.length > 0 && user.role && roles.includes(user.role);
  const matchLoc = locations.length > 0 && user.location && locations.includes(user.location);
  return matchGroup || matchRole || matchLoc;
}

import { FLOW_STOPWORDS } from './flow-stopwords.mjs';
export { FLOW_STOPWORDS };

export function notableWordsFromTrigger(trigger = '') {
  return Array.from(new Set(
    String(trigger).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
      .filter((w) => w.length > 4 && !FLOW_STOPWORDS.has(w))
  ));
}

export function workflowMatchesText(text, workflow) {
  if (!text || !workflow) return false;
  const t = String(text).toLowerCase();
  const words = notableWordsFromTrigger(workflow.trigger || '');
  return words.some((w) => t.includes(w));
}

// Materialize the active scope for a user.
//
// Returns:
//   experts       — active experts visible to user
//   connections   — connected/degraded connections (status filter + user OAuth)
//   workflows     — active workflows
//   degradedIds   — Set of connection ids with status === 'degraded'
//   needsAuth     — connections the admin enabled but the user hasn't OAuth'd
//   connectionById, expertById, workflowById — lookup maps
//
// `userConnections` is a Set of provider strings the user has linked (e.g.
// 'atlassian'). Connections with `provider:` require user OAuth.
export function materializeActiveScope({ config, experts, user, userConnections = new Set() }) {
  const cfg = config || {};
  const connAll = Array.isArray(cfg.connections) ? cfg.connections : [];
  const wfAll = Array.isArray(cfg.workflows) ? cfg.workflows : [];

  const visibleExperts = (experts || []).filter(
    (a) => a.status === 'active' && expertVisibleTo(a, user)
  );

  const needsAuth = new Set();
  const connections = connAll.filter((c) => {
    if (c.status === 'disconnected') return false;
    if (c.provider && !userConnections.has(c.provider)) {
      needsAuth.add(c.id);
      return false;
    }
    return true;
  });
  const workflows = wfAll.filter((f) => f.status === 'active');

  const degradedIds = new Set(connections.filter((c) => c.status === 'degraded').map((c) => c.id));

  const needsAuthDetails = [...needsAuth].map((id) => connAll.find((c) => c.id === id)).filter(Boolean);

  const mapBy = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
  return {
    experts: visibleExperts,
    connections,
    workflows,
    degradedIds,
    needsAuth: needsAuthDetails,
    expertById: mapBy(visibleExperts),
    connectionById: mapBy(connections),
    workflowById: mapBy(workflows),
  };
}

// Resolve which connections an expert can reach (filtered to those still in
// scope after status + OAuth checks).
export function resolveExpertScope(expert, scope) {
  const ids = new Set();
  if (!expert) return ids;
  for (const id of expert.connectionIds || []) {
    if (scope.connectionById[id]) ids.add(id);
  }
  return ids;
}

// Resolve the (connection, tool) pairs a workflow needs.
export function resolveWorkflowScope(workflow, scope) {
  const pairs = [];
  if (!workflow) return pairs;
  for (const t of workflow.tools || []) {
    // Defensive: legacy bare id strings still get treated as connection refs.
    const connectionId = typeof t === 'string' ? t : (t?.connectionId || t?.connectorId);
    const toolId = typeof t === 'string' ? null : t?.toolId || null;
    if (!connectionId) continue;
    if (!scope.connectionById[connectionId]) continue;
    pairs.push({ connectionId, toolId });
  }
  return pairs;
}
