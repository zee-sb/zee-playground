import { useCallback, useEffect, useRef, useState } from 'react'
import {
  STORAGE_KEY,
  keyForBranch,
  loadConfig,
  saveConfig,
  clearConfig,
  buildSeedConfig,
} from './configStore'
import { SEED_VERSION } from '../../../lib/seed.mjs'

/**
 * Hook that wraps the Navigator workspace config.
 *
 * In v5 the source of truth is `/api/navigator-config` (Postgres, keyed by
 * Staffbase branch id). localStorage is a fast-path cache so the UI renders
 * instantly and so the app still boots when DATABASE_URL is unset (offline
 * demo path).
 *
 * Lifecycle on mount:
 *   1. Hydrate synchronously from localStorage (UI paints immediately).
 *   2. In a background effect, GET /api/navigator-config. If the server
 *      reports a non-empty config, replace state with merged result.
 *   3. If the server is empty but localStorage has data, push localStorage up
 *      once so the in-memory and server states agree.
 *   4. On every setter, write through to localStorage (optimistic) and PUT
 *      the merged blob. On 409 (revision conflict), refetch and surface a
 *      toast via the optional `onConflict` prop on consumers.
 *   5. `visibilitychange` triggers a refetch when the tab becomes active and
 *      >10s have passed since the last fetch — covers cross-browser sync
 *      without a polling loop.
 *
 * The hook contract is unchanged from v4: returns config + typed setters.
 * Consumers don't need to know about the server round-trip.
 */

const FETCH_DEBOUNCE_MS = 10_000;
const CONFIG_ENDPOINT = '/api/navigator-config';
const ASSISTANT_ENDPOINT = '/api/navigator-assistant';
const SETUP_ENDPOINT = '/api/navigator-setup';

// ── Server transport helpers ──────────────────────────────────────────────────

// Returns parsed JSON or null if the response isn't actually JSON.
// Vite serves the SPA index.html (200, text/html) for any unknown path
// including /api/*, so a bare resp.json() throws on the first byte.
async function safeJson(resp) {
  const ct = resp.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) return null;
  try { return await resp.json(); } catch { return null; }
}

// Tack the active branch onto a server URL. Server routes accept `branch` as
// a query param to scope each request to one Staffbase tenant.
function withBranch(url, branchId) {
  if (!branchId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}branch=${encodeURIComponent(branchId)}`;
}

async function fetchServerConfig(branchId) {
  let resp;
  try {
    resp = await fetch(withBranch(`${CONFIG_ENDPOINT}?action=load`, branchId), {
      method: 'GET',
      credentials: 'include',
      headers: { 'Cache-Control': 'no-cache' },
    });
  } catch {
    return null;
  }
  if (!resp.ok) {
    if (resp.status !== 503 && resp.status !== 404) {
      console.warn('[useConfigStore] /api/navigator-config load failed:', resp.status);
    }
    return null;
  }
  return safeJson(resp);
}

async function pushServerConfig(payload, branchId) {
  let resp;
  try {
    resp = await fetch(withBranch(`${CONFIG_ENDPOINT}?action=save`, branchId), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return null;
  }
  if (resp.status === 409) {
    const body = (await safeJson(resp)) || {};
    const err = new Error('revision_conflict');
    err.code = 'revision_conflict';
    err.currentRevision = body.currentRevision;
    throw err;
  }
  if (!resp.ok) {
    if (resp.status === 503 || resp.status === 404) {
      return null;
    }
    const body = (await safeJson(resp)) || {};
    const err = new Error(body.error || `save_failed_${resp.status}`);
    err.code = body.error || `http_${resp.status}`;
    throw err;
  }
  return safeJson(resp);
}

// ── Assistant transport (DB authoritative) ──────────────────────────────────

async function fetchServerExperts(branchId) {
  let resp;
  try {
    resp = await fetch(withBranch(`${ASSISTANT_ENDPOINT}?action=list`, branchId), { credentials: 'include' });
  } catch { return null }
  if (!resp.ok) return null;
  const data = await safeJson(resp);
  return Array.isArray(data?.experts) ? data.experts : null;
}

async function pushServerExperts(experts, branchId) {
  let resp;
  try {
    resp = await fetch(withBranch(`${ASSISTANT_ENDPOINT}?action=bulk-save`, branchId), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experts }),
    });
  } catch { return null }
  if (!resp.ok) return null;
  const data = await safeJson(resp);
  return Array.isArray(data?.experts) ? data.experts : null;
}

// ── Blueprint (workspace_blueprints) transport ──────────────────────────────
//
// The blueprint is the discovery snapshot — companyName, mission, glossary,
// and the orchestrator system prompt (`mainInstructions`). It's stored in a
// different table than navigator_config, so it gets its own fetch + setters
// on this hook.

async function fetchServerBlueprint(branchId) {
  let resp;
  try {
    resp = await fetch(withBranch(`${SETUP_ENDPOINT}?action=load`, branchId), { credentials: 'include' });
  } catch { return null; }
  if (resp.status === 204 || !resp.ok) return null;
  return safeJson(resp);
}

async function saveMainInstructionsRequest(text, branchId) {
  let resp;
  try {
    resp = await fetch(withBranch(`${SETUP_ENDPOINT}?action=update-main-instructions`, branchId), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainInstructions: text }),
    });
  } catch (err) {
    throw new Error(err.message || 'network_error');
  }
  if (!resp.ok) {
    const body = (await safeJson(resp)) || {};
    const err = new Error(body.error || `save_failed_${resp.status}`);
    err.code = body.code || `http_${resp.status}`;
    throw err;
  }
  return safeJson(resp);
}

async function optimizeMainInstructionsRequest(text, branchId, audience) {
  let resp;
  try {
    resp = await fetch(withBranch(`${SETUP_ENDPOINT}?action=optimize-main-instructions`, branchId), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainInstructions: text, audience: audience || null }),
    });
  } catch (err) {
    throw new Error(err.message || 'network_error');
  }
  if (!resp.ok) {
    const body = (await safeJson(resp)) || {};
    const err = new Error(body.error || `optimize_failed_${resp.status}`);
    err.code = body.code || `http_${resp.status}`;
    throw err;
  }
  return safeJson(resp);
}

async function callReseed(branchId) {
  let resp;
  try {
    resp = await fetch(withBranch(`${CONFIG_ENDPOINT}?action=reseed`, branchId), {
      method: 'POST',
      credentials: 'include',
    });
  } catch { return null }
  if (!resp.ok) return null;
  return safeJson(resp);
}

// Cheap signature of an experts array — used to detect when the array
// has actually changed shape (so we don't bulk-save on every re-render).
function signatureOf(experts) {
  if (!Array.isArray(experts)) return ''
  return experts.map((a) =>
    `${a.id || '?'}|${a.name}|${a.status}|${(a.connectionIds || []).join(',')}|${a.audience?.everyone ? 'e' : (a.audience?.groups || []).join(',')}|${(a.instructions || '').length}`
  ).join('||')
}

// Reconcile server-returned experts back into local state. The server may
// have generated UUIDs for newly-created rows; we match by name to preserve
// any ordering / extra metadata the client added.
function mergeServerExperts(localConfig, serverExperts) {
  if (!Array.isArray(serverExperts)) return localConfig
  return { ...localConfig, experts: serverExperts.map((a) => ({ ...a })) }
}

// Merge server-provided config (the navigator_config blob) onto the local
// hydrated state. Assistants stay where they are — they belong to the
// navigator_experts table and have their own hook hooked up elsewhere.
function mergeServerConfig(localConfig, serverPayload) {
  if (!serverPayload || !serverPayload.config) return localConfig;
  const s = serverPayload.config;
  const blueprintGroups = Array.isArray(serverPayload.blueprintGroups) ? serverPayload.blueprintGroups : [];
  const existingGroups = Array.isArray(localConfig.tenant?.groups) ? localConfig.tenant.groups : [];
  const mergedGroups = blueprintGroups.length
    ? Array.from(new Set([...blueprintGroups, ...existingGroups]))
    : existingGroups;
  return {
    ...localConfig,
    connections:      Array.isArray(s.connections) ? s.connections : localConfig.connections,
    workflows:        Array.isArray(s.workflows)   ? s.workflows   : localConfig.workflows,
    tenant: {
      ...localConfig.tenant,
      ...(s.tenantOverrides && typeof s.tenantOverrides === 'object' ? s.tenantOverrides : {}),
      groups: mergedGroups,
    },
  };
}

function buildServerPayload(config) {
  // Extract just the slice the navigator_config table cares about. Assistants
  // are excluded — they live in navigator_experts and sync separately.
  const tenant = config.tenant || {};
  return {
    connections:    config.connections || [],
    workflows:      config.workflows   || [],
    tenantOverrides: {
      name: tenant.name,
      brandColor: tenant.brandColor,
      workspaceUrl: tenant.workspace,
    },
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConfigStore({ onConflict, branchId = null } = {}) {
  // Track the active tenant so callbacks that fire later (debounced pushes,
  // visibility re-fetches) always hit the right workspace.
  const branchIdRef = useRef(branchId);
  useEffect(() => { branchIdRef.current = branchId }, [branchId]);

  const [config, setConfigState] = useState(() => {
    const loaded = loadConfig(branchId)
    if (loaded) return loaded
    const seeded = buildSeedConfig()
    saveConfig(seeded, branchId)
    return seeded
  })
  // Blueprint snapshot from workspace_blueprints. Loaded async on mount;
  // null while pending or if the workspace has never been discovered.
  const [blueprint, setBlueprintState] = useState(null);
  // Server revision token — used as the baseRevision on every PUT. Starts at 0
  // until the first GET completes.
  const revisionRef = useRef(0);
  const lastFetchRef = useRef(0);
  const initialPushDoneRef = useRef(false);

  // Persist every change to localStorage immediately, keyed by the active
  // tenant so each workspace has its own offline snapshot.
  useEffect(() => {
    saveConfig(config, branchId)
  }, [config, branchId])

  // Cross-tab sync (same browser) — listen on the branch-specific key only.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const watchedKey = keyForBranch(branchId);
    function onStorage(e) {
      if (e.key !== watchedKey) return
      const next = loadConfig(branchId)
      if (next) setConfigState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [branchId])

  // When the active tenant changes, re-hydrate from the new branch's
  // localStorage (or fall back to a seeded snapshot for a never-visited
  // tenant). The server-fetch effects below also re-run because they list
  // branchId in their deps.
  const lastBranchRef = useRef(branchId);
  useEffect(() => {
    if (lastBranchRef.current === branchId) return;
    lastBranchRef.current = branchId;
    revisionRef.current = 0;
    initialPushDoneRef.current = false;
    expertsInitialPushDoneRef.current = false;
    expertsSignatureRef.current = null;
    setBlueprintState(null);
    const loaded = loadConfig(branchId);
    if (loaded) setConfigState(loaded);
    else {
      const seeded = buildSeedConfig();
      saveConfig(seeded, branchId);
      setConfigState(seeded);
    }
  }, [branchId])

  // First-mount server fetch + push-if-empty. Re-runs on branchId change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const payload = await fetchServerConfig(branchId).catch((err) => {
        console.warn('[useConfigStore] server fetch error:', err.message);
        return null;
      });
      lastFetchRef.current = Date.now();
      if (cancelled || !payload) return;

      if (payload.empty) {
        // Server has no row yet. If our local state has been customized at all
        // (best-effort heuristic: non-zero revision OR non-seed mcp count),
        // push it up so the server starts in sync. Otherwise leave it empty.
        if (!initialPushDoneRef.current) {
          initialPushDoneRef.current = true;
          try {
            const pushed = await pushServerConfig({
              config: buildServerPayload(config),
              baseRevision: 0,
            }, branchId);
            if (!cancelled && pushed) revisionRef.current = pushed.revision || 1;
          } catch (err) {
            // Conflict on first push → server already has something. Refetch.
            if (err.code === 'revision_conflict') {
              const refetched = await fetchServerConfig(branchId).catch(() => null);
              if (!cancelled && refetched && !refetched.empty) {
                revisionRef.current = refetched.revision || 0;
                setConfigState((prev) => mergeServerConfig(prev, refetched));
              }
            }
          }
        }
        return;
      }

      // If the server is on an older seed version than this build ships,
      // call reseed() so the prod DB picks up new flows / connectors /
      // policy changes from lib/seed.mjs automatically. Otherwise admins
      // would have to remember to click "Reset to defaults" after every
      // deploy that changes the seed.
      const serverSeedVersion = Number(payload.config?.tenantOverrides?.seedVersion || 0);
      if (serverSeedVersion < SEED_VERSION) {
        const reseeded = await callReseed(branchId).catch(() => null);
        if (!cancelled && reseeded) {
          revisionRef.current = reseeded.revision || 1;
          setConfigState((prev) => mergeServerConfig(prev, {
            config: {
              connections: reseeded.config?.connections || [],
              workflows: reseeded.config?.workflows || [],
              tenantOverrides: reseeded.config?.tenantOverrides || {},
            },
          }));
          if (Array.isArray(reseeded.experts)) {
            expertsSignatureRef.current = signatureOf(reseeded.experts);
            setConfigState((prev) => ({ ...prev, experts: reseeded.experts }));
          }
          return;
        }
        // Reseed failed (offline / 5xx) — fall through to the normal merge
        // so the UI still shows whatever the server has.
      }

      // Server has a config. Merge over local + record revision.
      revisionRef.current = payload.revision || 0;
      setConfigState((prev) => mergeServerConfig(prev, payload));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // First-mount experts fetch — DB is canonical, localStorage is just an
  // offline cache. When the server returns experts, replace local state.
  // When the server returns an empty list AND localStorage has seed-shape
  // experts, push the seed up so the DB starts in sync.
  const expertsInitialPushDoneRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const server = await fetchServerExperts(branchId).catch(() => null);
      if (cancelled) return;
      if (Array.isArray(server) && server.length > 0) {
        // Server has experts → trust them, replace local.
        expertsSignatureRef.current = signatureOf(server);
        setConfigState((prev) => ({ ...prev, experts: server }));
        return;
      }
      // Server empty. Push the local seed once so DB matches.
      if (!expertsInitialPushDoneRef.current && (latestConfigRef.current.experts || []).length > 0) {
        expertsInitialPushDoneRef.current = true;
        const pushed = await pushServerExperts(latestConfigRef.current.experts, branchId).catch(() => null);
        if (!cancelled && Array.isArray(pushed)) {
          expertsSignatureRef.current = signatureOf(pushed);
          setConfigState((prev) => ({ ...prev, experts: pushed }));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // First-mount blueprint fetch — fire-and-forget, fills the system prompt
  // preview on the Home tab. Re-runs on branchId change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bp = await fetchServerBlueprint(branchId).catch(() => null);
      if (cancelled || !bp) return;
      setBlueprintState(bp);
    })();
    return () => { cancelled = true; };
  }, [branchId]);

  // Refetch on visibilitychange (covers cross-browser staleness without a
  // polling loop).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchRef.current < FETCH_DEBOUNCE_MS) return;
      (async () => {
        const payload = await fetchServerConfig(branchIdRef.current).catch(() => null);
        lastFetchRef.current = Date.now();
        if (!payload || payload.empty) return;
        if ((payload.revision || 0) === revisionRef.current) return;
        revisionRef.current = payload.revision;
        setConfigState((prev) => mergeServerConfig(prev, payload));
      })();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Push-on-change: every state mutation writes through to server. We debounce
  // to coalesce rapid edits (e.g. typing in a flow trigger field).
  const pushTimerRef = useRef(null);
  const latestConfigRef = useRef(config);
  useEffect(() => { latestConfigRef.current = config; }, [config]);

  // Assistant push — a separate debounced bulk-save. We track a signature so
  // we don't fire a save on every re-render, only when the assistant array
  // actually changes shape.
  const expertsPushTimerRef = useRef(null);
  const expertsSignatureRef = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sig = signatureOf(config.experts || []);
    if (expertsSignatureRef.current === null) {
      // First render — don't push yet, the mount fetch effect handles seeding.
      expertsSignatureRef.current = sig;
      return;
    }
    if (sig === expertsSignatureRef.current) return;
    expertsSignatureRef.current = sig;
    if (expertsPushTimerRef.current) clearTimeout(expertsPushTimerRef.current);
    expertsPushTimerRef.current = setTimeout(async () => {
      expertsPushTimerRef.current = null;
      const pushed = await pushServerExperts(latestConfigRef.current.experts || [], branchIdRef.current).catch(() => null);
      if (Array.isArray(pushed)) {
        const newSig = signatureOf(pushed);
        expertsSignatureRef.current = newSig;
        // If server returned generated ids, fold them back into local state.
        // Match by name as a best-effort key since the client may have used
        // a temp id (asst-XXXX) that the server replaced with a UUID.
        setConfigState((prev) => mergeServerExperts(prev, pushed));
      }
    }, 300);
  }, [config.experts]);

  const schedulePush = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      pushTimerRef.current = null;
      const snapshot = latestConfigRef.current;
      try {
        const pushed = await pushServerConfig({
          config: buildServerPayload(snapshot),
          baseRevision: revisionRef.current,
        }, branchIdRef.current);
        if (pushed) revisionRef.current = pushed.revision || revisionRef.current;
      } catch (err) {
        if (err.code === 'revision_conflict') {
          // Refetch + surface to consumer. The hook user can show a toast and
          // re-render against the server's state.
          const refetched = await fetchServerConfig(branchIdRef.current).catch(() => null);
          if (refetched && !refetched.empty) {
            revisionRef.current = refetched.revision || 0;
            setConfigState((prev) => mergeServerConfig(prev, refetched));
            if (typeof onConflict === 'function') {
              try { onConflict({ currentRevision: refetched.revision }); }
              catch (e) { console.warn('[useConfigStore] onConflict handler threw:', e); }
            }
          }
        } else {
          console.warn('[useConfigStore] save failed:', err.message);
        }
      }
    }, 300);
  }, [onConflict]);

  const setConfig = useCallback((updater) => {
    setConfigState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      schedulePush();
      return next;
    })
  }, [schedulePush])

  const patchConfig = useCallback((patch) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      schedulePush();
      return next;
    })
  }, [schedulePush])

  const makeArraySetter = (key) =>
    useCallback((next) => {
      setConfigState((prev) => {
        const resolved = typeof next === 'function' ? next(prev[key] || []) : next;
        const merged = { ...prev, [key]: resolved };
        schedulePush();
        return merged;
      })
    }, [schedulePush])

  const setConnections = makeArraySetter('connections')
  const setExperts = makeArraySetter('experts')
  const setWorkflows = makeArraySetter('workflows')

  // Local-only reset (legacy) — clears localStorage and re-seeds in memory.
  // Doesn't touch the server. Use `reseed()` for the canonical reset.
  const resetConfig = useCallback(() => {
    clearConfig(branchIdRef.current)
    const seeded = buildSeedConfig()
    saveConfig(seeded, branchIdRef.current)
    setConfigState(seeded)
    schedulePush();
  }, [schedulePush])

  // Canonical Reset — server is authoritative. Hits `?action=reseed` to
  // wipe both navigator_config + navigator_experts and re-insert the
  // shared seed from lib/seed.mjs. Preserves workspace_blueprints and
  // connections so re-discovery / re-OAuth isn't needed. Returns true on
  // success so callers can show a toast.
  const reseed = useCallback(async () => {
    const result = await callReseed(branchIdRef.current)
    if (!result) {
      // Server unreachable — fall back to the local-only reset so the demo
      // doesn't get wedged in offline mode.
      resetConfig()
      return false
    }
    // Sync local state to the freshly-seeded server state.
    revisionRef.current = result.revision || 1
    const merged = mergeServerConfig(latestConfigRef.current, {
      config: {
        connections: result.config?.connections || [],
        workflows: result.config?.workflows || [],
        tenantOverrides: result.config?.tenantOverrides || {},
      },
    })
    const withExperts = { ...merged, experts: result.experts || [] }
    expertsSignatureRef.current = signatureOf(withExperts.experts)
    saveConfig(withExperts, branchIdRef.current)
    setConfigState(withExperts)
    return true
  }, [resetConfig])

  // Persist the orchestrator system prompt back to workspace_blueprints.
  // Updates local blueprint state on success so the Home tab preview refreshes
  // without a round-trip.
  const saveMainInstructions = useCallback(async (text) => {
    const result = await saveMainInstructionsRequest(text, branchIdRef.current);
    setBlueprintState((prev) => {
      if (!prev) return prev;
      const nextBlueprint = { ...(prev.blueprint || {}) };
      nextBlueprint.workspace = { ...(nextBlueprint.workspace || {}), mainInstructions: text };
      return { ...prev, blueprint: nextBlueprint };
    });
    return result;
  }, []);

  // Run an LLM polish pass over the draft. Returns { original, optimized }.
  // Does NOT persist — caller is expected to call saveMainInstructions with
  // the optimized text if the user accepts the diff.
  const optimizeMainInstructions = useCallback(async (text, audience) => {
    return await optimizeMainInstructionsRequest(text, branchIdRef.current, audience);
  }, []);

  // TEMPORARY: project a backwards-compat view of `config` for Studio UI files
  // that still read `.assistants` / `.connectors` / `.flows` / `.connectorIds`.
  // Remove this projection once every Studio file uses the new field names.
  const configView = {
    ...config,
    assistants: (config.experts || []).map((e) => ({
      ...e,
      connectorIds: e.connectionIds || e.connectorIds || [],
    })),
    connectors: config.connections || [],
    flows: config.workflows || [],
    experts: config.experts || [],
    connections: config.connections || [],
    workflows: config.workflows || [],
  };

  // Setter aliases that accept the legacy field shape (with connectorIds) and
  // forward to the new setters (which expect connectionIds).
  const setAssistants = useCallback((next) => {
    setExperts((prev) => {
      const resolved = typeof next === 'function' ? next(prev || []) : next;
      // Coerce legacy `connectorIds` → `connectionIds` on the way through.
      return (resolved || []).map((a) => ({
        ...a,
        connectionIds: a.connectionIds || a.connectorIds || [],
      }));
    });
  }, [setExperts]);

  return {
    config: configView,
    blueprint,
    setConfig,
    patchConfig,
    // New names (Phase 1 vocabulary).
    setConnections,
    setExperts,
    setWorkflows,
    // TEMPORARY legacy aliases — remove once Studio UI rename is complete.
    setConnectors: setConnections,
    setFlows: setWorkflows,
    setAssistants,
    resetConfig,
    reseed,
    saveMainInstructions,
    optimizeMainInstructions,
    revision: revisionRef.current,
  }
}
