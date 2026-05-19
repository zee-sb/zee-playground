// Single Vercel function handling all /api/auth/* routes. Consolidated to
// stay under the Hobby plan's 12-function-per-deployment ceiling.
//
//   GET  /api/auth/google/login          → start Google OAuth
//   GET  /api/auth/google/callback       → finish Google OAuth, mint session
//   GET  /api/auth/me                    → current user + connections
//   POST /api/auth/logout                → clear session cookie
//   GET  /api/auth/staffbase/login       → list demo personas
//   POST /api/auth/staffbase/login       → sign in as demo persona

import { randomBytes } from 'node:crypto';
import {
  exchangeCode,
  getUserInfo,
  isAllowedAccount,
  ALLOWED_HOSTED_DOMAIN,
  buildAuthorizeUrl as buildGoogleAuthorizeUrl,
} from '../lib/google.mjs';
import {
  parseCookies,
  verifyStateJwt,
  issueStateJwt,
  issueSessionJwt,
  stateCookieHeader,
  sessionCookieHeader,
  clearStateCookieHeader,
  clearSessionCookieHeader,
  getUserFromReq,
  COOKIE_NAMES,
} from '../lib/session.mjs';
import { sql, dbConfigured } from '../lib/db.mjs';
import { resolveStaffbaseIdentity } from '../lib/staffbase-users.mjs';
import { findUserByEmail as findStaffbaseUserByEmail, withStaffbaseContext } from '../lib/staffbase.mjs';
import { listConnectionsForUser } from '../lib/connections.mjs';
import { resolveBranchId, getTenantContext } from '../lib/tenants.mjs';

function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function pathOf(req) {
  if (req.query?._path) return String(req.query._path);
  return (req.url || '').split('?')[0];
}

export default async function handler(req, res) {
  const path = pathOf(req);
  try {
    if (path === '/api/auth/google/login')     return await googleLogin(req, res);
    if (path === '/api/auth/google/callback')  return await googleCallback(req, res);
    if (path === '/api/auth/me')               return await me(req, res);
    if (path === '/api/auth/refresh-profile')  return await refreshProfile(req, res);
    if (path === '/api/auth/avatar')           return await avatarProxy(req, res);
    if (path === '/api/auth/logout')           return await logout(req, res);
    if (path === '/api/auth/staffbase/login')  return await staffbaseLogin(req, res);
    res.status(404).json({ error: 'not_found', path });
  } catch (err) {
    console.error('[auth router]', path, err);
    if (!res.headersSent) {
      // Surface the underlying error message in this prototype so failures
      // are debuggable from the browser without tailing server logs. No PII
      // travels through this path — it's auth-flow exceptions like missing
      // columns or directory-lookup failures.
      res.status(500).json({
        error: 'internal_error',
        message: err?.message || String(err),
        ...(err?.code ? { code: err.code } : {}),
      });
    }
  }
}

// ── GET /api/auth/google/login ─────────────────────────────────────────
// Google OAuth app was removed by infra; route is kept (registered redirect
// URI, vercel.json rewrites) but the entry point bounces back to the picker
// with a `google_disabled` notice. To re-enable, restore the original body
// (see git history) once a new OAuth client is provisioned.
async function googleLogin(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const base = appUrl(req);
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: `${base}/prototypes/staffbase-companion?auth_error=google_disabled` });
  res.end();
}

// ── GET /api/auth/google/callback ──────────────────────────────────────
async function googleCallback(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const base = appUrl(req);
  const bounce = (code) => {
    res.setHeader('Set-Cookie', clearStateCookieHeader());
    res.writeHead(302, { Location: `${base}/prototypes/staffbase-companion${code ? `?auth_error=${encodeURIComponent(code)}` : ''}` });
    res.end();
  };
  if (!dbConfigured()) return bounce('db_not_configured');

  const url = new URL(req.url, base);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  if (errorParam) return bounce(errorParam);
  if (!code || !state) return bounce('missing_code');

  const cookies = parseCookies(req.headers.cookie || '');
  const stateInCookie = await verifyStateJwt(cookies[COOKIE_NAMES.state]);
  if (!stateInCookie || stateInCookie !== state) return bounce('state_mismatch');

  const redirectUri = `${base}/api/auth/google/callback`;
  try {
    const tokens = await exchangeCode({ code, redirectUri });
    const info = await getUserInfo(tokens.access_token);
    if (!isAllowedAccount(info)) {
      console.warn(`[auth/google] rejected non-${ALLOWED_HOSTED_DOMAIN} account: ${info.email || '(no email)'}`);
      return bounce('domain_not_allowed');
    }
    const identity = resolveStaffbaseIdentity(info);
    // Look up the real Staffbase profile by email and override the canned
    // seed values for name / title / department / location / avatar /
    // customFields wherever the live API has something better. Falls back to
    // the seed for fields the intranet doesn't populate so we never display
    // a blank profile.
    // Google OAuth is currently disabled — when it's re-enabled, identity
    // must be tenant-scoped just like the email-based login path. Without a
    // branch here the insert would fail the not-null on staffbase_branch_id
    // anyway.
    const googleBranchId = await resolveBranchId(req);
    if (!googleBranchId) {
      return bounce('no_active_tenant');
    }
    const googleCtx = await getTenantContext(googleBranchId).catch(() => null);
    const live = googleCtx
      ? await withStaffbaseContext(googleCtx, () => findStaffbaseUserByEmail(info.email))
      : await findStaffbaseUserByEmail(info.email);
    const displayName  = live?.name       || identity.name;
    const department   = live?.department || identity.department;
    const title        = live?.title      || identity.title;
    const location     = live?.location   || null;
    const avatarInit   = identity.avatar;                  // gradient-initials fallback
    const avatarUrl    = live?.avatar     || null;         // real Staffbase photo
    const customFields = live?.customFields || {};
    const googleLocale = typeof info.locale === 'string' && info.locale.length <= 16 ? info.locale : null;
    const rows = await sql`
      insert into users (staffbase_branch_id, staffbase_user_id, email, display_name, department, title, location, avatar_initials, avatar_url, custom_fields, signup_locale, last_login_at)
      values (${googleBranchId}, ${identity.id}, ${identity.email}, ${displayName}, ${department}, ${title}, ${location}, ${avatarInit}, ${avatarUrl}, ${JSON.stringify(customFields)}::jsonb, ${googleLocale}, now())
      on conflict (staffbase_branch_id, staffbase_user_id) do update
        set email           = excluded.email,
            display_name    = excluded.display_name,
            -- For these, prefer live values when present, retain stored on null.
            department      = coalesce(excluded.department, users.department),
            title           = coalesce(excluded.title,      users.title),
            location        = coalesce(excluded.location,   users.location),
            avatar_initials = excluded.avatar_initials,
            avatar_url      = coalesce(excluded.avatar_url, users.avatar_url),
            -- custom_fields: overwrite when the live lookup returned anything
            -- (empty jsonb means "no live data" → keep what we have).
            custom_fields   = case
              when jsonb_typeof(excluded.custom_fields) = 'object' and excluded.custom_fields <> '{}'::jsonb
                then excluded.custom_fields
              else users.custom_fields
            end,
            -- signup_locale is set-once: keep whatever we recorded at first signup.
            signup_locale   = coalesce(users.signup_locale, excluded.signup_locale),
            last_login_at   = now()
      returning id
    `;
    const userId = rows[0].id;
    const jwt = await issueSessionJwt(userId, googleBranchId);
    res.setHeader('Set-Cookie', [sessionCookieHeader(jwt), clearStateCookieHeader()]);
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(302, { Location: `${base}/prototypes/staffbase-companion` });
    res.end();
  } catch (err) {
    console.error('[auth/google/callback]', err);
    return bounce('callback_failed');
  }
}

// ── GET /api/auth/me ───────────────────────────────────────────────────
async function me(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    // Clear any stale/invalid session cookie so the browser drops it on
    // the next request — avoids the picker seeing a bogus cookie forever.
    res.setHeader('Set-Cookie', clearSessionCookieHeader());
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  // Tenant-scoped identity: the session is bound to the branch it was
  // issued for. If the user has since switched tenants in the picker, we
  // return 401 (and *don't* clear the cookie — the frontend will attempt
  // an auto-sign-in for the new tenant using the cached email and revive
  // its own session if the user exists there too).
  const activeBranchId = await resolveBranchId(req);
  if (session.branchId && activeBranchId && session.branchId !== activeBranchId) {
    res.status(401).json({
      error: 'session_tenant_mismatch',
      code: 'tenant_mismatch',
      sessionBranchId: session.branchId,
      activeBranchId,
    });
    return;
  }
  const rows = await sql`
    select id, staffbase_branch_id, staffbase_user_id, email, display_name, department, title, location,
           avatar_initials, avatar_url, custom_fields
    from users where id = ${session.userId}
  `;
  if (!rows.length) {
    // Session JWT is valid but the user row is gone (e.g. DB reset, demo
    // persona regenerated under new id). Drop the cookie so the picker
    // doesn't keep auto-redirecting into a broken state.
    res.setHeader('Set-Cookie', clearSessionCookieHeader());
    res.status(401).json({ error: 'user_not_found' });
    return;
  }
  const u = rows[0];
  const connections = await listConnectionsForUser(u.id);
  // Campsite SAML SSO entry point — the URL Staffbase publishes for this
  // workspace's SAML configuration (configurable per env). Surfacing it on
  // /me lets the Companion render a "Continue to Campsite" affordance that
  // initiates SP-initiated SAML SSO: Campsite sees no session, bounces to
  // Google IdP, Google asserts the user (already signed in via our own
  // Google OAuth), Campsite mints a Staffbase web session.
  const staffbaseSsoUrl = process.env.STAFFBASE_SSO_URL
    || 'https://campsite.staffbase.com/auth/saml/staffpranos';
  // Surface the tenant identity the session is bound to, so the Companion
  // can display "Signed in to <Tenant>" and treat tenant switches as
  // account switches.
  let tenant = null;
  if (u.staffbase_branch_id) {
    const tCtx = await getTenantContext(u.staffbase_branch_id).catch(() => null);
    if (tCtx) {
      tenant = {
        branchId: u.staffbase_branch_id,
        displayName: tCtx.displayName || null,
        baseUrl: tCtx.baseUrl || null,
        workspaceUrl: tCtx.workspaceUrl || null,
        brandColor: tCtx.brandColor || null,
      };
    }
  }
  res.status(200).json({
    user: {
      id: u.id,
      staffbaseUserId: u.staffbase_user_id,
      staffbaseBranchId: u.staffbase_branch_id,
      email: u.email,
      displayName: u.display_name,
      department: u.department,
      title: u.title,
      location: u.location,
      avatarInitials: u.avatar_initials,
      // `avatar_url` in the DB is the secure Campsite URL (requires the
      // platform API token to fetch). Expose the public-facing path our
      // server-side proxy serves so <img> elements can render it directly.
      avatarUrl: u.avatar_url ? '/api/auth/avatar' : null,
      avatarSourceUrl: u.avatar_url || null,
      customFields: u.custom_fields || {},
    },
    tenant,
    staffbase: {
      ssoUrl: staffbaseSsoUrl,
      workspace: tenant?.workspaceUrl || 'campsite.staffbase.com',
      ssoConfigId: (staffbaseSsoUrl.match(/\/auth\/saml\/([^/]+)/) || [])[1] || null,
    },
    connections: connections.map((c) => ({
      provider: c.provider,
      status: c.status,
      externalEmail: c.external_email,
      metadata: c.metadata,
      connectedAt: c.created_at,
    })),
  });
}

// ── GET /api/auth/avatar ───────────────────────────────────────────────
//
// Server-side proxy for the signed-in user's avatar. The Campsite directory
// returns avatar URLs of the form
// `https://campsite.staffbase.com/api/media/secure/external/v2/image/...`,
// which require Authorization on the originating request and can't be loaded
// directly by the browser. We fetch them with the platform API token and
// stream the binary back to the browser, with aggressive Cache-Control so
// the asset only round-trips once per session.
async function avatarProxy(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  const rows = await sql`select avatar_url from users where id = ${session.userId}`;
  const avatarUrl = rows[0]?.avatar_url;
  if (!avatarUrl) {
    res.status(404).json({ error: 'no_avatar' });
    return;
  }
  const token = process.env.STAFFBASE_API_TOKEN;
  if (!token) {
    res.status(503).json({ error: 'staffbase_token_missing' });
    return;
  }
  try {
    const upstream = await fetch(avatarUrl, {
      headers: { Authorization: `Basic ${token}` },
    });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'upstream_avatar_failed', status: upstream.status });
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', ct);
    // Cache aggressively in the browser; new sign-in re-issues a fresh URL.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.status(200).send(buf);
  } catch (err) {
    console.error('[auth/avatar] fetch failed:', err.message);
    res.status(502).json({ error: 'avatar_proxy_failed' });
  }
}

// ── POST /api/auth/refresh-profile ─────────────────────────────────────
//
// Re-pulls the signed-in user's profile from the live Staffbase Directory
// and overwrites the cached title / department / location / avatar / custom
// fields on the users row. Used when an admin updates Campsite and wants
// the change reflected in Companion without forcing a re-login.
async function refreshProfile(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  const row = await sql`select id, email, staffbase_branch_id from users where id = ${session.userId}`;
  if (!row.length) {
    res.status(401).json({ error: 'user_not_found' });
    return;
  }
  const { email } = row[0];
  // Refresh against the SAME tenant the user is signed into — not the
  // env-var default. Without this, profile pulls could return data from a
  // different workspace's directory and overwrite the cached row.
  const refreshBranchId = session.branchId || row[0].staffbase_branch_id || null;
  const refreshCtx = refreshBranchId ? await getTenantContext(refreshBranchId).catch(() => null) : null;
  let live;
  try {
    live = refreshCtx
      ? await withStaffbaseContext(refreshCtx, () => findStaffbaseUserByEmail(email))
      : await findStaffbaseUserByEmail(email);
  } catch (err) {
    console.error('[auth/refresh-profile] directory lookup failed:', err.message);
    res.status(502).json({ error: 'directory_lookup_failed' });
    return;
  }
  if (!live) {
    res.status(404).json({ error: 'profile_not_found_in_directory', email });
    return;
  }
  await sql`
    update users set
      display_name  = coalesce(${live.name},       display_name),
      department    = coalesce(${live.department}, department),
      title         = coalesce(${live.title},      title),
      location      = coalesce(${live.location},   location),
      avatar_url    = coalesce(${live.avatar},     avatar_url),
      custom_fields = ${JSON.stringify(live.customFields || {})}::jsonb,
      last_login_at = last_login_at
    where id = ${session.userId}
  `;
  res.status(200).json({
    ok: true,
    refreshed: {
      name: live.name,
      title: live.title,
      department: live.department,
      location: live.location,
      avatarPresent: !!live.avatar,
      customFieldsCount: Object.keys(live.customFields || {}).length,
    },
  });
}

// ── POST /api/auth/logout ──────────────────────────────────────────────
async function logout(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.setHeader('Set-Cookie', clearSessionCookieHeader());
  res.status(200).json({ ok: true });
}

// ── POST /api/auth/staffbase/login ─────────────────────────────────────
// Demo sign-in: caller supplies a @staffbase.com email, server resolves it
// against the live Campsite directory and mints a session for that user.
// Replaces the previous static-persona-list flow now that Google OAuth is
// disabled.
async function staffbaseLogin(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  // Identity is tenant-scoped: the same email in two Staffbase workspaces
  // becomes two distinct user rows. The active branch comes from `?branch=`
  // on the login request; `resolveBranchId` falls back to the only/first
  // tenant for single-tenant deployments.
  const branchId = await resolveBranchId(req);
  if (!branchId) {
    res.status(400).json({ error: 'no_active_tenant', code: 'no_active_tenant' });
    return;
  }
  const tenantCtx = await getTenantContext(branchId);
  if (!tenantCtx) {
    res.status(404).json({ error: 'tenant_not_found', code: 'tenant_not_found' });
    return;
  }
  // Resolve the email against THIS tenant's Staffbase directory — not the
  // env-var default. Each workspace has its own user list, so the same
  // email returns a different staffbaseUserId in each tenant.
  let live;
  try {
    live = await withStaffbaseContext(tenantCtx, () => findStaffbaseUserByEmail(email));
  } catch (err) {
    console.error('[auth/staffbase/login] directory lookup failed:', err.message);
    res.status(502).json({ error: 'directory_lookup_failed' });
    return;
  }
  if (!live) {
    res.status(404).json({ error: 'user_not_found' });
    return;
  }
  const displayName = live.name || email;
  const avatarInitials = (() => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  })();
  const customFields = live.customFields || {};
  // Unique key is (staffbase_branch_id, staffbase_user_id) per migration 011.
  // Same human in two tenants → two rows → two distinct users.id values.
  const rows = await sql`
    insert into users (staffbase_branch_id, staffbase_user_id, email, display_name, department, title, location, avatar_initials, avatar_url, custom_fields, last_login_at)
    values (${branchId}, ${live.id}, ${live.email || email}, ${displayName}, ${live.department}, ${live.title}, ${live.location}, ${avatarInitials}, ${live.avatar}, ${JSON.stringify(customFields)}::jsonb, now())
    on conflict (staffbase_branch_id, staffbase_user_id) do update
      set email           = excluded.email,
          display_name    = excluded.display_name,
          department      = coalesce(excluded.department, users.department),
          title           = coalesce(excluded.title,      users.title),
          location        = coalesce(excluded.location,   users.location),
          avatar_initials = excluded.avatar_initials,
          avatar_url      = coalesce(excluded.avatar_url, users.avatar_url),
          custom_fields   = case
            when jsonb_typeof(excluded.custom_fields) = 'object' and excluded.custom_fields <> '{}'::jsonb
              then excluded.custom_fields
            else users.custom_fields
          end,
          last_login_at   = now()
    returning id
  `;
  const userId = rows[0].id;
  const jwt = await issueSessionJwt(userId, branchId);
  res.setHeader('Set-Cookie', sessionCookieHeader(jwt));
  res.status(200).json({
    user: {
      id: userId,
      staffbaseUserId: live.id,
      email: live.email || email,
      name: displayName,
      department: live.department,
      title: live.title,
      location: live.location,
    },
  });
}
