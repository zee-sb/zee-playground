// GET /api/auth/google/login
// Starts the Sign-in-with-Google flow. Sets a signed state cookie and 302s to
// Google's consent screen, restricted to the staffbase.com Workspace.

import { randomBytes } from 'node:crypto';
import { buildAuthorizeUrl } from '../../lib/google.mjs';
import { issueStateJwt, stateCookieHeader } from '../../lib/session.mjs';

function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
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
  const url = buildAuthorizeUrl({ clientId, redirectUri, state });

  res.setHeader('Set-Cookie', stateCookieHeader(stateJwt));
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: url });
  res.end();
}
