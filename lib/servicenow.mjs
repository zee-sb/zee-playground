// ServiceNow OAuth 2.0 (authorization_code) helpers — connection-scoped.
//
// Mirrors lib/atlassian.mjs almost 1:1, but ServiceNow differs in two ways:
//   1. The instance base URL is per-deployment (SERVICENOW_INSTANCE_URL),
//      not a fixed vendor host.
//   2. The token endpoint (/oauth_token.do) wants form-urlencoded bodies,
//      not JSON.
//
// - buildAuthorizeUrl:          redirect URL for the consent step
// - exchangeCode:               authorization_code grant
// - getServiceNowAccessToken:   refresh + advisory-lock guard, scoped to a
//                               (user, 'servicenow') connection row
// - getMe:                      resolve the authorizing user (sys_user row)
// - saveServiceNowConnection:   persist the connection row

import { sql } from './db.mjs';
import { getConnection, decryptRefreshToken, upsertConnection } from './connections.mjs';
import { encrypt } from './crypto.mjs';

// ServiceNow's stock OAuth scope. Tokens are still ACL-gated server-side by the
// authenticated user's roles, so the scope is broad and the instance decides
// what each call may actually do. Override via SERVICENOW_SCOPES if the OAuth
// app defines custom scopes.
export const SERVICENOW_SCOPES = process.env.SERVICENOW_SCOPES || 'useraccount';

// Resolve + validate the instance config. Throws a tagged, user-readable error
// when unconfigured so callers can hard-fail cleanly (no silent fallback).
export function serviceNowConfig() {
  const instanceUrl = (process.env.SERVICENOW_INSTANCE_URL || '').replace(/\/$/, '');
  const clientId = process.env.SERVICENOW_CLIENT_ID || '';
  const clientSecret = process.env.SERVICENOW_CLIENT_SECRET || '';
  if (!instanceUrl || !clientId || !clientSecret) {
    const err = new Error(
      'servicenow_not_configured: ServiceNow is not configured. Set SERVICENOW_INSTANCE_URL, SERVICENOW_CLIENT_ID, and SERVICENOW_CLIENT_SECRET.'
    );
    err.code = 'servicenow_not_configured';
    throw err;
  }
  return { instanceUrl, clientId, clientSecret };
}

export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const { instanceUrl } = serviceNowConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${instanceUrl}/oauth_auth.do?${params.toString()}`;
}

export async function exchangeCode({ code, redirectUri }) {
  const { instanceUrl, clientId, clientSecret } = serviceNowConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${instanceUrl}/oauth_token.do`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`servicenow token exchange failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function postRefresh(refreshToken) {
  const { instanceUrl, clientId, clientSecret } = serviceNowConfig();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const res = await fetch(`${instanceUrl}/oauth_token.do`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    // ServiceNow refresh tokens expire (default 100 days) or can be revoked —
    // surface a tagged error so the orchestrator can prompt a reconnect.
    if (res.status === 400 || res.status === 401 || /invalid_grant|expired/i.test(text)) {
      const err = new Error('servicenow_reauth_required: your ServiceNow connection has expired. Disconnect and reconnect ServiceNow from the Connections panel to continue.');
      err.code = 'servicenow_reauth_required';
      throw err;
    }
    throw new Error(`servicenow token refresh failed: ${res.status} ${text}`);
  }
  return await res.json();
}

function lockKeyFor(userId) {
  let h = 0n;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 131n + BigInt(userId.charCodeAt(i))) & 0x7fffffffffffffffn;
  }
  return h.toString();
}

// Acquires an access token for a user's ServiceNow connection. Serialized
// across concurrent invocations with a Postgres advisory lock so a rotated
// refresh token issued by one call isn't invalidated by a parallel one.
export async function getServiceNowAccessToken(userId) {
  if (!sql) throw new Error('DB not configured');
  const { instanceUrl } = serviceNowConfig();

  const lockKey = lockKeyFor(userId);
  try {
    await sql`select pg_advisory_lock(${lockKey})`;
    const row = await getConnection(userId, 'servicenow');
    if (!row) throw new Error('No ServiceNow connection for user');

    const refresh = decryptRefreshToken(row);
    let tokens;
    try {
      tokens = await postRefresh(refresh);
    } catch (err) {
      if (err.code === 'servicenow_reauth_required') {
        try {
          await sql`update connections set status = 'expired', updated_at = now() where user_id = ${userId} and provider = 'servicenow'`;
        } catch { /* ignore */ }
      }
      throw err;
    }

    // ServiceNow returns a refresh token on refresh; persist it in case the
    // instance is configured to rotate them.
    if (tokens.refresh_token) {
      const { ct, iv, tag } = encrypt(tokens.refresh_token);
      await sql`
        update connections
        set refresh_token_ct = ${ct},
            refresh_token_iv = ${iv},
            refresh_token_tag = ${tag},
            scopes = ${tokens.scope || row.scopes},
            updated_at = now()
        where user_id = ${userId} and provider = 'servicenow'
      `;
    }

    return {
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      instanceUrl: row.metadata?.instance_url || instanceUrl,
    };
  } finally {
    try { await sql`select pg_advisory_unlock(${lockKey})`; } catch { /* ignore */ }
  }
}

// Resolve the authorizing user's sys_user record. `javascript:gs.getUserID()`
// evaluates server-side to the access token's user, so this returns the
// identity tied to the freshly minted token.
export async function getMe(accessToken) {
  const { instanceUrl } = serviceNowConfig();
  const url = `${instanceUrl}/api/now/table/sys_user`
    + `?sysparm_query=${encodeURIComponent('sys_id=javascript:gs.getUserID()')}`
    + `&sysparm_limit=1`
    + `&sysparm_fields=sys_id,user_name,name,email`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`servicenow me failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.result && data.result[0]) || null;
}

export async function saveServiceNowConnection({ userId, me, tokens, scopeStr }) {
  const { instanceUrl } = serviceNowConfig();
  await upsertConnection({
    userId,
    provider: 'servicenow',
    refreshToken: tokens.refresh_token,
    scopes: scopeStr,
    externalAccountId: me?.sys_id,
    externalEmail: me?.email,
    metadata: {
      instance_url: instanceUrl,
      user_name: me?.user_name,
      display_name: me?.name,
    },
  });
}
