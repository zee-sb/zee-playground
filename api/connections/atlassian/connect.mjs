// GET /api/connections/atlassian/connect
// Starts the Atlassian OAuth flow for the currently-signed-in Staffbase user.
// Stores the staffbase user_id inside the signed `state` so the callback can
// associate the resulting tokens with the right user.

import { randomBytes } from 'node:crypto';
import { buildAuthorizeUrl } from '../../lib/atlassian.mjs';
import { issueStateJwt, stateCookieHeader, getUserFromReq } from '../../lib/session.mjs';

function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
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
  const url = buildAuthorizeUrl({ clientId, redirectUri, state });

  res.setHeader('Set-Cookie', stateCookieHeader(stateJwt));
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: url });
  res.end();
}
