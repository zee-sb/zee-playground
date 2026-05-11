// GET /api/auth/google/callback?code=&state=
// Verifies state, exchanges the code, pulls userinfo, ensures the account is
// a staffbase.com Workspace member, then upserts the user and issues a
// session cookie.

import { exchangeCode, getUserInfo, isAllowedAccount, ALLOWED_HOSTED_DOMAIN } from '../../lib/google.mjs';
import {
  parseCookies,
  verifyStateJwt,
  issueSessionJwt,
  sessionCookieHeader,
  clearStateCookieHeader,
  COOKIE_NAMES,
} from '../../lib/session.mjs';
import { sql, dbConfigured } from '../../lib/db.mjs';
import { resolveStaffbaseIdentity } from '../../lib/staffbase-users.mjs';

function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function bounce(res, base, code) {
  res.setHeader('Set-Cookie', clearStateCookieHeader());
  res.writeHead(302, { Location: `${base}/prototypes/staffbase-companion${code ? `?auth_error=${encodeURIComponent(code)}` : ''}` });
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const base = appUrl(req);
  if (!dbConfigured()) return bounce(res, base, 'db_not_configured');

  const url = new URL(req.url, base);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  if (errorParam) return bounce(res, base, errorParam);
  if (!code || !state) return bounce(res, base, 'missing_code');

  const cookies = parseCookies(req.headers.cookie || '');
  const stateInCookie = await verifyStateJwt(cookies[COOKIE_NAMES.state]);
  if (!stateInCookie || stateInCookie !== state) return bounce(res, base, 'state_mismatch');

  const redirectUri = `${base}/api/auth/google/callback`;

  try {
    const tokens = await exchangeCode({ code, redirectUri });
    const info = await getUserInfo(tokens.access_token);
    if (!isAllowedAccount(info)) {
      console.warn(`[auth/google] rejected non-${ALLOWED_HOSTED_DOMAIN} account: ${info.email || '(no email)'}`);
      return bounce(res, base, 'domain_not_allowed');
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
    return bounce(res, base, 'callback_failed');
  }
}
