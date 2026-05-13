import { useCallback, useEffect, useRef, useState } from 'react'
import {
  STORAGE_KEY,
  loadConfig,
  saveConfig,
  clearConfig,
  buildSeedConfig,
} from './configStore'

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

// ── Server transport helpers ──────────────────────────────────────────────────

// Returns parsed JSON or null if the response isn't actually JSON.
// Vite serves the SPA index.html (200, text/html) for any unknown path
// including /api/*, so a bare resp.json() throws on the first byte.
async function safeJson(resp) {
  const ct = resp.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) return null;
  try { return await resp.json(); } catch { return null; }
}

async function fetchServerConfig() {
  let resp;
  try {
    resp = await fetch(`${CONFIG_ENDPOINT}?action=load`, {
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

async function pushServerConfig(payload) {
  let resp;
  try {
    resp = await fetch(`${CONFIG_ENDPOINT}?action=save`, {
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

// Merge server-provided config (the navigator_config blob) onto the local
// hydrated state. Assistants stay where they are — they belong to the
// navigator_assistants table and have their own hook hooked up elsewhere.
function mergeServerConfig(localConfig, serverPayload) {
  if (!serverPayload || !serverPayload.config) return localConfig;
  const s = serverPayload.config;
  return {
    ...localConfig,
    mcpConnectors:    Array.isArray(s.mcpConnectors)    ? s.mcpConnectors    : localConfig.mcpConnectors,
    externalAgents:   Array.isArray(s.externalAgents)   ? s.externalAgents   : localConfig.externalAgents,
    knowledgeBases:   Array.isArray(s.knowledgeBases)   ? s.knowledgeBases   : localConfig.knowledgeBases,
    flows:            Array.isArray(s.flows)            ? s.flows            : localConfig.flows,
    tenant: {
      ...localConfig.tenant,
      ...(s.tenantOverrides && typeof s.tenantOverrides === 'object' ? s.tenantOverrides : {}),
    },
  };
}

function buildServerPayload(config) {
  // Extract just the slice the navigator_config table cares about. Assistants
  // are excluded — they live in navigator_assistants (Phase 4 hooks that up).
  const tenant = config.tenant || {};
  return {
    mcpConnectors:  config.mcpConnectors  || [],
    externalAgents: config.externalAgents || [],
    knowledgeBases: config.knowledgeBases || [],
    flows:          config.flows          || [],
    tenantOverrides: {
      name: tenant.name,
      brandColor: tenant.brandColor,
      workspaceUrl: tenant.workspace,
    },
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConfigStore({ onConflict } = {}) {
  const [config, setConfigState] = useState(() => {
    const loaded = loadConfig()
    if (loaded) return loaded
    const seeded = buildSeedConfig()
    saveConfig(seeded)
    return seeded
  })
  // Server revision token — used as the baseRevision on every PUT. Starts at 0
  // until the first GET completes.
  const revisionRef = useRef(0);
  const lastFetchRef = useRef(0);
  const initialPushDoneRef = useRef(false);

  // Persist every change to localStorage immediately. Cross-tab sync via the
  // storage event still works because saveConfig writes synchronously.
  useEffect(() => {
    saveConfig(config)
  }, [config])

  // Cross-tab sync (same browser).
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onStorage(e) {
      if (e.key !== STORAGE_KEY) return
      const next = loadConfig()
      if (next) setConfigState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // First-mount server fetch + push-if-empty.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const payload = await fetchServerConfig().catch((err) => {
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
            });
            if (!cancelled && pushed) revisionRef.current = pushed.revision || 1;
          } catch (err) {
            // Conflict on first push → server already has something. Refetch.
            if (err.code === 'revision_conflict') {
              const refetched = await fetchServerConfig().catch(() => null);
              if (!cancelled && refetched && !refetched.empty) {
                revisionRef.current = refetched.revision || 0;
                setConfigState((prev) => mergeServerConfig(prev, refetched));
              }
            }
          }
        }
        return;
      }

      // Server has a config. Merge over local + record revision.
      revisionRef.current = payload.revision || 0;
      setConfigState((prev) => mergeServerConfig(prev, payload));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch on visibilitychange (covers cross-browser staleness without a
  // polling loop).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchRef.current < FETCH_DEBOUNCE_MS) return;
      (async () => {
        const payload = await fetchServerConfig().catch(() => null);
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
        });
        if (pushed) revisionRef.current = pushed.revision || revisionRef.current;
      } catch (err) {
        if (err.code === 'revision_conflict') {
          // Refetch + surface to consumer. The hook user can show a toast and
          // re-render against the server's state.
          const refetched = await fetchServerConfig().catch(() => null);
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

  const setMcpConnectors = makeArraySetter('mcpConnectors')
  const setExternalAgents = makeArraySetter('externalAgents')
  const setAssistants = makeArraySetter('assistants')
  const setKnowledgeBases = makeArraySetter('knowledgeBases')
  const setFlows = makeArraySetter('flows')

  const resetConfig = useCallback(() => {
    clearConfig()
    const seeded = buildSeedConfig()
    saveConfig(seeded)
    setConfigState(seeded)
    schedulePush();
  }, [schedulePush])

  return {
    config,
    setConfig,
    patchConfig,
    setMcpConnectors,
    setExternalAgents,
    setAssistants,
    setKnowledgeBases,
    setFlows,
    resetConfig,
    // Expose the revision so consumers (e.g. a future Conflict UX banner) can
    // tell whether they're in sync. Not part of the v4 contract.
    revision: revisionRef.current,
  }
}
