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
  parseCookies,
  verifyStateJwt,
  issueStateJwt,
  stateCookieHeader,
  clearStateCookieHeader,
  getUserFromReq,
  COOKIE_NAMES,
} from '../lib/session.mjs';
import { dbConfigured } from '../lib/db.mjs';
import { deleteConnection } from '../lib/connections.mjs';

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
