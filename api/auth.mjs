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
import { resolveStaffbaseIdentity, STAFFBASE_DIRECTORY } from '../lib/staffbase-users.mjs';
import { listConnectionsForUser } from '../lib/connections.mjs';

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
    if (path === '/api/auth/logout')           return await logout(req, res);
    if (path === '/api/auth/staffbase/login')  return await staffbaseLogin(req, res);
    res.status(404).json({ error: 'not_found', path });
  } catch (err) {
    console.error('[auth router]', path, err);
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
  }
}

// ── GET /api/auth/google/login ─────────────────────────────────────────
async function googleLogin(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured' });
    return;
  }
  const base = appUrl(req);
  const redirectUri = `${base}/api/auth/google/callback`;
  const state = randomBytes(16).toString('hex');
  const stateJwt = await issueStateJwt(state);
  const url = buildGoogleAuthorizeUrl({ clientId, redirectUri, state });
  res.setHeader('Set-Cookie', stateCookieHeader(stateJwt));
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: url });
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
    const rows = await sql`
      insert into users (staffbase_user_id, email, display_name, department, title, avatar_initials, last_login_at)
      values (${identity.id}, ${identity.email}, ${identity.name}, ${identity.department}, ${identity.title}, ${identity.avatar}, now())
      on conflict (staffbase_user_id) do update
        set email           = excluded.email,
            display_name    = excluded.display_name,
            department      = coalesce(excluded.department, users.department),
            title           = coalesce(excluded.title, users.title),
            avatar_initials = excluded.avatar_initials,
            last_login_at   = now()
      returning id
    `;
    const userId = rows[0].id;
    const jwt = await issueSessionJwt(userId);
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
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  const rows = await sql`
    select id, staffbase_user_id, email, display_name, department, title, avatar_initials
    from users where id = ${session.userId}
  `;
  if (!rows.length) {
    res.status(401).json({ error: 'user_not_found' });
    return;
  }
  const u = rows[0];
  const connections = await listConnectionsForUser(u.id);
  res.status(200).json({
    user: {
      id: u.id,
      staffbaseUserId: u.staffbase_user_id,
      email: u.email,
      displayName: u.display_name,
      department: u.department,
      title: u.title,
      avatarInitials: u.avatar_initials,
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

// ── POST /api/auth/logout ──────────────────────────────────────────────
async function logout(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.setHeader('Set-Cookie', clearSessionCookieHeader());
  res.status(200).json({ ok: true });
}

// ── GET|POST /api/auth/staffbase/login ─────────────────────────────────
async function staffbaseLogin(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({
      personas: STAFFBASE_DIRECTORY.map((u) => ({
        id: u.id, name: u.name, email: u.email,
        department: u.department, title: u.title, avatar: u.avatar,
      })),
    });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  const { staffbaseUserId } = req.body || {};
  const profile = STAFFBASE_DIRECTORY.find((u) => u.id === staffbaseUserId);
  if (!profile) {
    res.status(400).json({ error: 'unknown_user' });
    return;
  }
  const rows = await sql`
    insert into users (staffbase_user_id, email, display_name, department, title, avatar_initials, last_login_at)
    values (${profile.id}, ${profile.email}, ${profile.name}, ${profile.department}, ${profile.title}, ${profile.avatar}, now())
    on conflict (staffbase_user_id) do update
      set email           = excluded.email,
          display_name    = excluded.display_name,
          department      = excluded.department,
          title           = excluded.title,
          avatar_initials = excluded.avatar_initials,
          last_login_at   = now()
    returning id
  `;
  const userId = rows[0].id;
  const jwt = await issueSessionJwt(userId);
  res.setHeader('Set-Cookie', sessionCookieHeader(jwt));
  res.status(200).json({ user: { id: userId, ...profile } });
}
