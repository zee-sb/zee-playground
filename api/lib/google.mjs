// Google OAuth 2.0 / OIDC helpers for "Sign in with Google" restricted to the
// staffbase.com Workspace.

const AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export const GOOGLE_SCOPES = 'openid email profile';
export const ALLOWED_HOSTED_DOMAIN = process.env.GOOGLE_HOSTED_DOMAIN || 'staffbase.com';

export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    state,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    // hd hints + the consent screen "Internal" user-type lock will both reject
    // non-staffbase.com accounts. We also verify the response server-side.
    hd: ALLOWED_HOSTED_DOMAIN,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

export async function exchangeCode({ code, redirectUri }) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status} ${await res.text()}`);
  return await res.json(); // { access_token, id_token, expires_in, scope, token_type }
}

export async function getUserInfo(accessToken) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`google userinfo failed: ${res.status} ${await res.text()}`);
  return await res.json(); // { sub, email, email_verified, name, given_name, family_name, picture, hd, locale }
}

// Reject any account not in the configured Workspace.
export function isAllowedAccount(userInfo) {
  if (!userInfo?.email_verified) return false;
  if (userInfo.hd && userInfo.hd === ALLOWED_HOSTED_DOMAIN) return true;
  // Belt-and-suspenders: also accept by email suffix (covers older Google
  // tenants that don't set `hd`).
  return typeof userInfo.email === 'string' && userInfo.email.toLowerCase().endsWith(`@${ALLOWED_HOSTED_DOMAIN}`);
}
