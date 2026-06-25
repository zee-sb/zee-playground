// Single Vercel function handling all /api/connections/* routes. Consolidated
// to stay under the Hobby plan's 12-function-per-deployment ceiling.
//
//   GET  /api/connections/atlassian/connect    → start Atlassian OAuth
//   GET  /api/connections/atlassian/callback   → finish Atlassian OAuth
//   POST /api/connections/disconnect           → drop a connection row

import { randomBytes } from 'node:crypto';
import {
  buildAuthorizeUrl as buildAtlassianAuthorizeUrl,
  exchangeCode as exchangeAtlassianCode,
  getAccessibleResources,
  getMe,
  saveAtlassianConnection,
  ATLASSIAN_SCOPES,
} from '../lib/atlassian.mjs';
import {
  buildAuthorizeUrl as buildServiceNowAuthorizeUrl,
  exchangeCode as exchangeServiceNowCode,
  getMe as getServiceNowMe,
  saveServiceNowConnection,
  SERVICENOW_SCOPES,
} from '../lib/servicenow.mjs';
import {
  parseCookies,
  verifyStateJwt,
  issueStateJwt,
  stateCookieHeader,
  clearStateCookieHeader,
  getUserFromReq,
  COOKIE_NAMES,
} from '../lib/session.mjs';
import { sql, dbConfigured } from '../lib/db.mjs';
import { deleteConnection, upsertConnection } from '../lib/connections.mjs';

function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
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
    if (path === '/api/connections/atlassian/connect')  return await atlassianConnect(req, res);
    if (path === '/api/connections/atlassian/callback') return await atlassianCallback(req, res);
    if (path === '/api/connections/campsite/connect')   return await campsiteConnect(req, res);
    if (path === '/api/connections/servicenow/connect')  return await serviceNowConnect(req, res);
    if (path === '/api/connections/servicenow/callback') return await serviceNowCallback(req, res);
    if (path === '/api/connections/disconnect')         return await disconnect(req, res);
    res.status(404).json({ error: 'not_found', path });
  } catch (err) {
    console.error('[connections router]', path, err);
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
  }
}

// ── GET /api/connections/atlassian/connect ─────────────────────────────
async function atlassianConnect(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  const clientId = process.env.ATLASSIAN_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: 'ATLASSIAN_CLIENT_ID is not configured' });
    return;
  }
  const base = appUrl(req);
  const redirectUri = `${base}/api/connections/atlassian/callback`;
  const nonce = randomBytes(16).toString('hex');
  // State carries the user id (signed) so the callback can attribute the
  // connection without trusting the cookie alone.
  const state = `${nonce}.${session.userId}`;
  const stateJwt = await issueStateJwt(state);
  const url = buildAtlassianAuthorizeUrl({ clientId, redirectUri, state });
  res.setHeader('Set-Cookie', stateCookieHeader(stateJwt));
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: url });
  res.end();
}

// ── GET /api/connections/atlassian/callback ────────────────────────────
async function atlassianCallback(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const base = appUrl(req);
  const bounce = (code) => {
    const params = code ? `?connect_error=${encodeURIComponent(code)}` : '';
    res.setHeader('Set-Cookie', clearStateCookieHeader());
    res.writeHead(302, { Location: `${base}/prototypes/staffbase-companion${params}` });
    res.end();
  };
  if (!dbConfigured()) return bounce('db_not_configured');

  const session = await getUserFromReq(req);
  if (!session) return bounce('not_signed_in');

  const url = new URL(req.url, base);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  if (errorParam) return bounce(errorParam);
  if (!code || !state) return bounce('missing_code');

  const cookies = parseCookies(req.headers.cookie || '');
  const stateInCookie = await verifyStateJwt(cookies[COOKIE_NAMES.state]);
  if (!stateInCookie || stateInCookie !== state) return bounce('state_mismatch');
  const [, signedUserId] = state.split('.');
  if (signedUserId !== session.userId) return bounce('state_user_mismatch');

  const redirectUri = `${base}/api/connections/atlassian/callback`;
  try {
    const tokens = await exchangeAtlassianCode({ code, redirectUri });
    if (!tokens.refresh_token) return bounce('no_refresh_token');
    const resources = await getAccessibleResources(tokens.access_token);
    if (!resources?.length) return bounce('no_accessible_resources');
    const resource = resources[0];
    const me = await getMe(tokens.access_token);
    await saveAtlassianConnection({
      userId: session.userId,
      me,
      resource,
      tokens,
      scopeStr: tokens.scope || ATLASSIAN_SCOPES,
    });
    res.setHeader('Set-Cookie', clearStateCookieHeader());
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(302, { Location: `${base}/prototypes/staffbase-companion?connected=atlassian` });
    res.end();
  } catch (err) {
    console.error('[connections/atlassian/callback]', err);
    return bounce('callback_failed');
  }
}

// ── GET /api/connections/campsite/connect ──────────────────────────────
//
// Initiates SP-initiated SAML SSO into the Staffbase Campsite tenant.
// Unlike Atlassian (OAuth, with our callback receiving an auth code),
// Campsite is browser-session SAML — after the SAML round-trip the user
// has a Campsite web session in their browser but our backend gets
// nothing back. So we treat this as an "optimistic" connector:
//   1. Mark the user's connection row as 'connected' BEFORE we redirect
//      (with `metadata.last_initiated_at` so the UI can show freshness).
//   2. Redirect to STAFFBASE_SSO_URL — Staffbase bounces through Google IdP
//      (silent because the user already has a Google session) and lands
//      them at Campsite home.
//   3. If they didn't actually complete SSO (e.g. closed the tab), they
//      can re-trigger from the Connections panel. Disconnect drops the
//      row but doesn't sign them out of Campsite.
async function campsiteConnect(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  const ssoUrl = process.env.STAFFBASE_SSO_URL
    || 'https://campsite.staffbase.com/auth/saml/staffpranos';
  const ssoConfigId = (ssoUrl.match(/\/auth\/saml\/([^/?#]+)/) || [])[1] || null;
  const initiatedAt = new Date().toISOString();
  if (dbConfigured()) {
    try {
      // Look up the signed-in user's email so the connection card can show
      // "Linked as <email>". Best-effort: skip the upsert silently on error.
      let externalEmail = null;
      try {
        const rows = await sql`select email from users where id = ${session.userId}`;
        externalEmail = rows[0]?.email || null;
      } catch { /* ignore */ }
      await upsertConnection({
        userId: session.userId,
        provider: 'campsite',
        externalEmail,
        metadata: {
          sso_url: ssoUrl,
          sso_config_id: ssoConfigId,
          workspace: 'campsite.staffbase.com',
          last_initiated_at: initiatedAt,
        },
      });
    } catch (err) {
      console.error('[campsite/connect] upsert failed:', err.message);
      // Not fatal — still bounce to SSO so the user isn't blocked.
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: ssoUrl });
  res.end();
}

// ── GET /api/connections/servicenow/connect ────────────────────────────
// Per-user OAuth 2.0 (authorization_code) against the configured ServiceNow
// instance. Mirrors atlassianConnect — the only differences are the provider
// name and that the authorize URL points at the instance's /oauth_auth.do.
async function serviceNowConnect(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  const clientId = process.env.SERVICENOW_CLIENT_ID;
  if (!clientId || !process.env.SERVICENOW_INSTANCE_URL) {
    res.status(500).json({ error: 'servicenow_not_configured' });
    return;
  }
  const base = appUrl(req);
  const redirectUri = `${base}/api/connections/servicenow/callback`;
  const nonce = randomBytes(16).toString('hex');
  // Thread the originating surface through the (signed) state so the callback
  // returns the user to where they started — Studio vs companion — instead of
  // always bouncing to the companion app. Encoded base64url so the '.'
  // delimiter stays unambiguous.
  let returnTo = new URL(req.url, base).searchParams.get('return') || '/prototypes/staffbase-companion';
  if (!returnTo.startsWith('/')) returnTo = '/prototypes/staffbase-companion';
  const retEnc = Buffer.from(returnTo).toString('base64url');
  const state = `${nonce}.${session.userId}.${retEnc}`;
  const stateJwt = await issueStateJwt(state);
  let url;
  try {
    url = buildServiceNowAuthorizeUrl({ clientId, redirectUri, state });
  } catch (err) {
    console.error('[connections/servicenow/connect]', err);
    res.status(500).json({ error: err.code || 'servicenow_config_error' });
    return;
  }
  res.setHeader('Set-Cookie', stateCookieHeader(stateJwt));
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: url });
  res.end();
}

// ── GET /api/connections/servicenow/callback ───────────────────────────
async function serviceNowCallback(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const base = appUrl(req);
  // Default return target until we recover the originating surface from state.
  let returnTo = '/prototypes/staffbase-companion';
  const bounce = (code) => {
    const sep = returnTo.includes('?') ? '&' : '?';
    const params = code ? `${sep}connect_error=${encodeURIComponent(code)}` : '';
    res.setHeader('Set-Cookie', clearStateCookieHeader());
    res.writeHead(302, { Location: `${base}${returnTo}${params}` });
    res.end();
  };
  if (!dbConfigured()) return bounce('db_not_configured');

  const session = await getUserFromReq(req);
  if (!session) return bounce('not_signed_in');

  const url = new URL(req.url, base);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  if (errorParam) return bounce(errorParam);
  if (!code || !state) return bounce('missing_code');

  const cookies = parseCookies(req.headers.cookie || '');
  const stateInCookie = await verifyStateJwt(cookies[COOKIE_NAMES.state]);
  if (!stateInCookie || stateInCookie !== state) return bounce('state_mismatch');
  const parts = state.split('.');
  const signedUserId = parts[1];
  if (signedUserId !== session.userId) return bounce('state_user_mismatch');
  // Recover the originating surface (Studio vs companion) from state.
  try {
    if (parts[2]) {
      const r = Buffer.from(parts[2], 'base64url').toString('utf8');
      if (r.startsWith('/')) returnTo = r;
    }
  } catch { /* keep default */ }

  const redirectUri = `${base}/api/connections/servicenow/callback`;
  try {
    const tokens = await exchangeServiceNowCode({ code, redirectUri });
    if (!tokens.refresh_token) return bounce('no_refresh_token');
    const me = await getServiceNowMe(tokens.access_token);
    await saveServiceNowConnection({
      userId: session.userId,
      me,
      tokens,
      scopeStr: tokens.scope || SERVICENOW_SCOPES,
    });
    const sep = returnTo.includes('?') ? '&' : '?';
    res.setHeader('Set-Cookie', clearStateCookieHeader());
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(302, { Location: `${base}${returnTo}${sep}connected=servicenow` });
    res.end();
  } catch (err) {
    console.error('[connections/servicenow/callback]', err);
    // Surface the real reason in the URL so failures are diagnosable without
    // server logs (e.g. "ServiceNow 401: access_denied" → bad redirect/secret).
    return bounce(`callback_failed: ${String(err.message || err).slice(0, 220)}`);
  }
}

// ── POST /api/connections/disconnect ───────────────────────────────────
async function disconnect(req, res) {
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
  const { provider } = req.body || {};
  if (!provider) {
    res.status(400).json({ error: 'provider required' });
    return;
  }
  await deleteConnection(session.userId, provider);
  res.status(200).json({ ok: true });
}
