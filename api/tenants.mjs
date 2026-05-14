// Staffbase tenant CRUD — the gallery picker's backend.
//
//   GET    /api/tenants                 → list (no secrets)
//   POST   /api/tenants                 → body {displayName, baseUrl, apiToken}
//                                          verifies token by hitting /branch,
//                                          stores encrypted
//   PATCH  /api/tenants?branch=<id>     → body {displayName?, apiToken?, brandColor?}
//   DELETE /api/tenants?branch=<id>     → cascade-delete blueprints + config
//
// Auth: the gallery tenant pool is unauthenticated by design. Sign-in to the
// Companion is per-tenant (see api/auth.mjs), but the act of *registering* a
// tenant has to be reachable before any user has a session — otherwise it's
// a chicken-and-egg (you'd need to be signed in to add the first workspace
// you want to sign in to). All tenants live in the staffbase_tenants table
// with their tokens encrypted at rest, so no secret leaks via this endpoint.
// `created_by_user_id` is best-effort — stamped when we happen to have a
// session, null otherwise.

import { getUserFromReq } from '../lib/session.mjs';
import { dbConfigured } from '../lib/db.mjs';
import {
  listTenants, createTenant, updateTenant, deleteTenant, ensureDefaultTenant,
} from '../lib/tenants.mjs';

// Accept "https://acme.staffbase.com", "https://acme.staffbase.com/", or
// "https://acme.staffbase.com/api". The Staffbase REST API lives at /api on
// every workspace, so we always normalise to the …/api form before probing
// and storing — this keeps the picker forgiving of how the user pastes.
function normalizeBaseUrl(raw) {
  const trimmed = String(raw).trim().replace(/\/+$/, '');
  if (/\/api(\/v\d+)?$/.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!dbConfigured()) {
    return res.status(503).json({ error: 'db_not_configured' });
  }
  // Best-effort: stamp the actor on POST when a session is available, but
  // never block tenant management on missing auth (see file-header comment).
  const session = await getUserFromReq(req);

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const branchId = url.searchParams.get('branch');

    if (req.method === 'GET') {
      // Idempotent: Campsite (or whatever STAFFBASE_API_BASE points at)
      // gets ensured in the DB on first gallery load so the picker always
      // has a default workspace, even on a fresh database. Memoised
      // server-side — see lib/tenants.mjs:ensureDefaultTenant.
      await ensureDefaultTenant();
      const tenants = await listTenants();
      return res.status(200).json({ tenants });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const { displayName, baseUrl, apiToken, brandColor } = body || {};
      if (!displayName || !baseUrl || !apiToken) {
        return res.status(400).json({
          error: 'missing_fields',
          message: 'displayName, baseUrl, and apiToken are required',
        });
      }
      try {
        const tenant = await createTenant({
          displayName: String(displayName).slice(0, 120),
          baseUrl: normalizeBaseUrl(String(baseUrl)),
          apiToken: String(apiToken).trim(),
          brandColor: brandColor ? String(brandColor) : null,
          userId: session?.userId || null,
        });
        return res.status(200).json({ tenant });
      } catch (err) {
        if (err.code === 'tenant_verify_failed') {
          return res.status(400).json({ error: err.code, message: err.message });
        }
        throw err;
      }
    }

    if (req.method === 'PATCH') {
      if (!branchId) return res.status(400).json({ error: 'missing_branch' });
      const body = await readJsonBody(req);
      const tenant = await updateTenant({
        branchId,
        displayName: body.displayName ? String(body.displayName).slice(0, 120) : undefined,
        apiToken: body.apiToken ? String(body.apiToken).trim() : undefined,
        brandColor: body.brandColor !== undefined ? body.brandColor : undefined,
      });
      if (!tenant) return res.status(404).json({ error: 'tenant_not_found' });
      return res.status(200).json({ tenant });
    }

    if (req.method === 'DELETE') {
      if (!branchId) return res.status(400).json({ error: 'missing_branch' });
      const ok = await deleteTenant(branchId);
      return res.status(ok ? 200 : 404).json({ ok });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('[api/tenants]', err);
    return res.status(500).json({ error: err.message || 'internal_error' });
  }
}
