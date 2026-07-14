// Multi-environment Langfuse client (REST Public API).
//
// Trace Doctor pulls traces directly from Langfuse across several Staffbase
// regions/stages. We use the REST Public API (not the Langfuse MCP server —
// that targets AI assistants, not app backends) because it matches the
// upload→analyze→store pipeline the engine already consumes: a full trace
// (GET /api/public/traces/:id) IS the `raw` shape lib/trace-doctor-engine.mjs
// expects (observations, scores, input/output, environment, sessionId).
//
// Environments are configured via a single JSON env var so Vercel needs only
// one secret to manage:
//
//   LANGFUSE_ENVIRONMENTS='[{"id":"prod-de1","label":"Prod · DE1",
//     "baseUrl":"https://langfuse-de1.staffbase.com",
//     "publicKey":"pk-lf-…","secretKey":"sk-lf-…","region":"de1","stage":"prod"}, …]'
//
// Fallback: a single environment from the legacy LANGFUSE_BASE_URL /
// LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY trio (id "default").

let _envs = null;

function parseEnvironments() {
  if (_envs) return _envs;
  const out = [];
  const raw = process.env.LANGFUSE_ENVIRONMENTS;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const e of arr) {
          if (e && e.id && e.baseUrl && e.publicKey && e.secretKey) {
            out.push({
              id: String(e.id),
              label: String(e.label || e.id),
              baseUrl: String(e.baseUrl).replace(/\/+$/, ''),
              publicKey: String(e.publicKey),
              secretKey: String(e.secretKey),
              region: e.region || null,
              stage: e.stage || null,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[langfuse] LANGFUSE_ENVIRONMENTS is not valid JSON:', err.message);
    }
  }
  // Legacy single-env fallback.
  if (!out.length && process.env.LANGFUSE_BASE_URL && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
    out.push({
      id: 'default',
      label: 'Default',
      baseUrl: process.env.LANGFUSE_BASE_URL.replace(/\/+$/, ''),
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      region: null,
      stage: null,
    });
  }
  _envs = out;
  return out;
}

// Public metadata only — NEVER leak keys to the client.
export function listEnvironments() {
  return parseEnvironments().map((e) => ({ id: e.id, label: e.label, region: e.region, stage: e.stage, baseUrl: e.baseUrl }));
}

export function isConfigured() {
  return parseEnvironments().length > 0;
}

function getEnv(id) {
  const envs = parseEnvironments();
  return envs.find((e) => e.id === id) || null;
}

function authHeader(env) {
  return 'Basic ' + Buffer.from(`${env.publicKey}:${env.secretKey}`).toString('base64');
}

async function lfFetch(env, path, { timeoutMs = 25000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.baseUrl}${path}`, {
      headers: { Authorization: authHeader(env), Accept: 'application/json' },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
    if (!res.ok) {
      const msg = json?.message || json?.error || text?.slice(0, 200) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// Auth/connectivity probe. Returns { ok, project?, error? }.
export async function checkHealth(envId) {
  const env = getEnv(envId);
  if (!env) return { ok: false, error: 'unknown_environment' };
  try {
    const json = await lfFetch(env, '/api/public/projects', { timeoutMs: 15000 });
    const project = (json?.data || [])[0];
    return { ok: true, project: project ? { id: project.id, name: project.name } : null };
  } catch (err) {
    return { ok: false, error: err.message, status: err.status || null };
  }
}

// List traces (metadata; observations NOT fully expanded — use getTrace for
// analysis). Supports the Langfuse filter params Trace Doctor needs.
export async function listTraces(envId, {
  limit = 25, page = 1, name, environment, sessionId, userId, tags, fromTimestamp, toTimestamp, orderBy,
} = {}) {
  const env = getEnv(envId);
  if (!env) throw new Error('unknown_environment');
  const qs = new URLSearchParams();
  qs.set('limit', String(Math.min(Math.max(limit, 1), 100)));
  qs.set('page', String(Math.max(page, 1)));
  if (name) qs.set('name', name);
  if (environment) qs.set('environment', environment);
  if (sessionId) qs.set('sessionId', sessionId);
  if (userId) qs.set('userId', userId);
  if (fromTimestamp) qs.set('fromTimestamp', fromTimestamp);
  if (toTimestamp) qs.set('toTimestamp', toTimestamp);
  if (orderBy) qs.set('orderBy', orderBy);
  if (Array.isArray(tags)) for (const t of tags) qs.append('tags', t);
  const json = await lfFetch(env, `/api/public/traces?${qs.toString()}`);
  const data = (json?.data || []).map((t) => ({
    id: t.id,
    name: t.name || null,
    timestamp: t.timestamp,
    environment: t.environment || null,
    sessionId: t.sessionId || null,
    userId: t.userId || null,
    tags: t.tags || [],
    latency: t.latency ?? null,
    totalCost: t.totalCost ?? null,
    // A short preview of the opening user message for the browse list.
    preview: previewOf(t.input),
  }));
  return { data, meta: json?.meta || null };
}

// Full trace incl. nested observations + scores — the shape the engine analyzes.
export async function getTrace(envId, traceId) {
  const env = getEnv(envId);
  if (!env) throw new Error('unknown_environment');
  return await lfFetch(env, `/api/public/traces/${encodeURIComponent(traceId)}`);
}

// ── Sessions ─────────────────────────────────────────────────────────────────
// The team's unit of a "conversation" is the Langfuse session (sessionId).
// A session groups one or more traces (turns). List = browse conversations;
// getSession = the trace ids that make up one conversation.
export async function listSessions(envId, {
  limit = 25, page = 1, environment, fromTimestamp, toTimestamp,
} = {}) {
  const env = getEnv(envId);
  if (!env) throw new Error('unknown_environment');
  const qs = new URLSearchParams();
  qs.set('limit', String(Math.min(Math.max(limit, 1), 100)));
  qs.set('page', String(Math.max(page, 1)));
  if (environment) qs.set('environment', environment);
  if (fromTimestamp) qs.set('fromTimestamp', fromTimestamp);
  if (toTimestamp) qs.set('toTimestamp', toTimestamp);
  const json = await lfFetch(env, `/api/public/sessions?${qs.toString()}`);
  const data = (json?.data || []).map((s) => ({
    id: s.id,
    environment: s.environment || null, // tenant slug
    createdAt: s.createdAt,
  }));
  return { data, meta: json?.meta || null };
}

// Resolve a session to its member trace ids (+ tenant). Session-bundled traces
// omit observations, so callers fetch each full trace via getTrace for analysis.
export async function getSession(envId, sessionId) {
  const env = getEnv(envId);
  if (!env) throw new Error('unknown_environment');
  const s = await lfFetch(env, `/api/public/sessions/${encodeURIComponent(sessionId)}`);
  const traces = Array.isArray(s?.traces) ? s.traces : [];
  return {
    id: s?.id || sessionId,
    environment: s?.environment || traces[0]?.environment || null,
    createdAt: s?.createdAt || null,
    traceIds: traces.map((t) => t.id).filter(Boolean),
  };
}

function previewOf(input) {
  try {
    if (input == null) return '';
    if (typeof input === 'string') return input.slice(0, 140);
    const s = JSON.stringify(input);
    return s.slice(0, 140);
  } catch { return ''; }
}
