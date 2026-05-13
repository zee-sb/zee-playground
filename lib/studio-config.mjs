// Studio config loader for the Companion runtime.
//
// One call per chat turn loads the live Studio state (navigator_config row
// + blueprint + persisted assistants) for the active Staffbase branch, with
// a 30s in-memory TTL so a chat→confirm round-trip doesn't double-read.
//
// v7 unification: connectors are one list with `kind: 'mcp' | 'agent' | 'kb'`
// — `materializeActiveScope` returns one filtered connectors[] array plus
// quick lookup maps. Assistants reference connectors via a single
// `connectorIds[]`. Flows reference them via `{ connectorId, toolId }`.

import { getBranch } from './staffbase.mjs';
import { getConfig } from './workspace-config.mjs';
import { getBlueprint, listAssistants } from './blueprints.mjs';

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

  const [config, blueprintRow, assistants] = await Promise.all([
    getConfig(branchId).catch(() => null),
    getBlueprint(branchId).catch(() => null),
    listAssistants(branchId).catch(() => []),
  ]);

  const value = {
    branchId,
    branchName,
    config: config || { connectors: [], flows: [], tenantOverrides: {}, revision: 0 },
    blueprint: blueprintRow?.blueprint || null,
    assistants: assistants || [],
  };
  setCached(branchId, value);
  return value;
}

export function isStudioEmpty(studio) {
  if (!studio) return true;
  const c = studio.config || {};
  const hasConnectors = (c.connectors || []).length > 0;
  const hasFlows = (c.flows || []).length > 0;
  const hasAssistants = (studio.assistants || []).length > 0;
  return !hasConnectors && !hasFlows && !hasAssistants;
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

export function assistantVisibleTo(assistant, user) {
  if (!assistant) return false;
  const aud = assistant.audience || { everyone: true };
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

const FLOW_STOPWORDS = new Set([
  'employee','employees','asks','wants','says','their','they','the','and','for',
  'that','this','about','have','with','what','when','to','on','of','in','a','an',
  'or','is','are','be','do','need','needs','help','want','start','starts',
  'mentions','mention','from','just','some',
]);

export function notableWordsFromTrigger(trigger = '') {
  return Array.from(new Set(
    String(trigger).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
      .filter((w) => w.length > 4 && !FLOW_STOPWORDS.has(w))
  ));
}

export function flowMatchesText(text, flow) {
  if (!text || !flow) return false;
  const t = String(text).toLowerCase();
  const words = notableWordsFromTrigger(flow.trigger || '');
  return words.some((w) => t.includes(w));
}

// Materialize the active scope for a user.
//
// Returns:
//   assistants    — active assistants visible to user
//   connectors    — connected/degraded connectors (status filter + user OAuth)
//   flows         — active flows
//   degradedIds   — Set of connector ids with status === 'degraded'
//   needsAuth     — connectors the admin enabled but the user hasn't OAuth'd
//   connectorById, assistantById, flowById — lookup maps
//
// `userConnections` is a Set of provider strings the user has linked (e.g.
// 'atlassian'). Connectors with `provider:` require user OAuth.
export function materializeActiveScope({ config, assistants, user, userConnections = new Set() }) {
  const cfg = config || {};
  const connAll = Array.isArray(cfg.connectors) ? cfg.connectors : [];
  const flowAll = Array.isArray(cfg.flows) ? cfg.flows : [];

  const visibleAssistants = (assistants || []).filter(
    (a) => a.status === 'active' && assistantVisibleTo(a, user)
  );

  const needsAuth = new Set();
  const connectors = connAll.filter((c) => {
    if (c.status === 'disconnected') return false;
    if (c.provider && !userConnections.has(c.provider)) {
      needsAuth.add(c.id);
      return false;
    }
    return true;
  });
  const flows = flowAll.filter((f) => f.status === 'active');

  const degradedIds = new Set(connectors.filter((c) => c.status === 'degraded').map((c) => c.id));

  const needsAuthDetails = [...needsAuth].map((id) => connAll.find((c) => c.id === id)).filter(Boolean);

  const mapBy = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
  return {
    assistants: visibleAssistants,
    connectors,
    flows,
    degradedIds,
    needsAuth: needsAuthDetails,
    assistantById: mapBy(visibleAssistants),
    connectorById: mapBy(connectors),
    flowById: mapBy(flows),
  };
}

// Resolve which connectors an assistant can reach (filtered to those still in
// scope after status + OAuth checks).
export function resolveAssistantScope(assistant, scope) {
  const ids = new Set();
  if (!assistant) return ids;
  for (const id of assistant.connectorIds || []) {
    if (scope.connectorById[id]) ids.add(id);
  }
  return ids;
}

// Resolve the (connector, tool) pairs a flow needs.
export function resolveFlowScope(flow, scope) {
  const pairs = [];
  if (!flow) return pairs;
  for (const t of flow.tools || []) {
    // Defensive: legacy bare agentId strings still get treated as connector refs.
    const connectorId = typeof t === 'string' ? t : t?.connectorId;
    const toolId = typeof t === 'string' ? null : t?.toolId || null;
    if (!connectorId) continue;
    if (!scope.connectorById[connectorId]) continue;
    pairs.push({ connectorId, toolId });
  }
  return pairs;
}
