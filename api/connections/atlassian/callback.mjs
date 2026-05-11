// GET /api/connections/atlassian/callback?code=&state=
// Completes the Atlassian OAuth dance and stores the connection on the
// currently signed-in Staffbase user.

import {
  exchangeCode,
  getAccessibleResources,
  getMe,
  saveAtlassianConnection,
  ATLASSIAN_SCOPES,
} from '../../lib/atlassian.mjs';
import {
  parseCookies,
  verifyStateJwt,
  clearStateCookieHeader,
  COOKIE_NAMES,
  getUserFromReq,
} from '../../lib/session.mjs';
import { dbConfigured } from '../../lib/db.mjs';

function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function bounce(res, base, code) {
  const params = code ? `?connect_error=${encodeURIComponent(code)}` : '';
  res.setHeader('Set-Cookie', clearStateCookieHeader());
  res.writeHead(302, { Location: `${base}/prototypes/staffbase-companion${params}` });
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const base = appUrl(req);
  if (!dbConfigured()) return bounce(res, base, 'db_not_configured');

  const session = await getUserFromReq(req);
  if (!session) return bounce(res, base, 'not_signed_in');

  const url = new URL(req.url, base);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  if (errorParam) return bounce(res, base, errorParam);
  if (!code || !state) return bounce(res, base, 'missing_code');

  // Verify state matches the cookie + the signed payload includes our user id.
  const cookies = parseCookies(req.headers.cookie || '');
  const stateInCookie = await verifyStateJwt(cookies[COOKIE_NAMES.state]);
  if (!stateInCookie || stateInCookie !== state) return bounce(res, base, 'state_mismatch');
  const [, signedUserId] = state.split('.');
  if (signedUserId !== session.userId) return bounce(res, base, 'state_user_mismatch');

  const redirectUri = `${base}/api/connections/atlassian/callback`;

  try {
    const tokens = await exchangeCode({ code, redirectUri });
    if (!tokens.refresh_token) return bounce(res, base, 'no_refresh_token');
    const resources = await getAccessibleResources(tokens.access_token);
    if (!resources?.length) return bounce(res, base, 'no_accessible_resources');
    // Atlassian returns one row per (product, site). Collapse to the first
    // site — its cloudid covers both Confluence and Jira.
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
    return bounce(res, base, 'callback_failed');
  }
}
