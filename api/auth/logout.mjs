// POST /api/auth/logout — clears the session cookie. Does NOT revoke the
// Atlassian refresh token (manual DB cleanup for now; full disconnect UI is
// out of scope for v1).

import { clearSessionCookieHeader } from '../lib/session.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.setHeader('Set-Cookie', clearSessionCookieHeader());
  res.status(200).json({ ok: true });
}
