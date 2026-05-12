// Atlassian OAuth 2.0 (3LO) helpers — now connection-scoped.
//
// - buildAuthorizeUrl: redirect URL for the consent step
// - exchangeCode:       authorization_code grant
// - getAccessTokenForUser: refresh + advisory-lock guard, scoped to a (user, 'atlassian') connection row
// - getAccessibleResources / getMe: identity + cloudid lookup

import { sql } from './db.mjs';
import { getConnection, decryptRefreshToken, upsertConnection } from './connections.mjs';
import { encrypt } from './crypto.mjs';

const AUTH_BASE = 'https://auth.atlassian.com';
const API_BASE  = 'https://api.atlassian.com';

// Must match the scopes enabled in the Atlassian developer console.
// We use GRANULAR scopes — the Remote MCP server (and v2 REST APIs) reject
// the older classic `read:confluence-*` scopes with "scope does not match".
export const ATLASSIAN_SCOPES = [
  // User identity API
  'read:me',
  'read:account',
  // Confluence API (granular)
  'read:page:confluence',
  'read:space:confluence',
  'read:user:confluence',
  'read:comment:confluence',
  'read:attachment:confluence',
  'write:page:confluence',
  'write:comment:confluence',
  // Jira API (granular)
  'read:issue:jira',
  'read:user:jira',
  'read:project:jira',
  'write:issue:jira',
  'write:comment:jira',
  // Jira v3 REST (POST /issue, /myself, etc.) gates on the classic Jira
  // scopes — granular alone returns "scope does not match". Add both so
  // create_issue works on AIW-960.
  'read:jira-work',
  'read:jira-user',
  'write:jira-work',
  // Refresh tokens
  'offline_access',
].join(' ');

export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: ATLASSIAN_SCOPES,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    prompt: 'consent',
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCode({ code, redirectUri }) {
  const res = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.ATLASSIAN_CLIENT_ID,
      client_secret: process.env.ATLASSIAN_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function postRefresh(refreshToken) {
  const res = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.ATLASSIAN_CLIENT_ID,
      client_secret: process.env.ATLASSIAN_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    // invalid_grant means the refresh token has been revoked or rotated away —
    // user has to redo the OAuth dance. Surface a tagged error so the
    // orchestrator can prompt them to reconnect instead of failing vaguely.
    if (res.status === 400 || res.status === 401 || /invalid_grant/i.test(body)) {
      const err = new Error('atlassian_reauth_required: your Atlassian connection has expired. Disconnect and reconnect Atlassian from the Connections panel to continue.');
      err.code = 'atlassian_reauth_required';
      throw err;
    }
    throw new Error(`token refresh failed: ${res.status} ${body}`);
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

// Acquires an access token for a user's Atlassian connection. Serialized
// across concurrent invocations with a Postgres advisory lock so the rotated
// refresh token issued by one call isn't invalidated by a parallel one.
export async function getAtlassianAccessToken(userId) {
  if (!sql) throw new Error('DB not configured');

  const lockKey = lockKeyFor(userId);
  try {
    await sql`select pg_advisory_lock(${lockKey})`;
    const row = await getConnection(userId, 'atlassian');
    if (!row) throw new Error('No Atlassian connection for user');

    const refresh = decryptRefreshToken(row);
    let tokens;
    try {
      tokens = await postRefresh(refresh);
    } catch (err) {
      if (err.code === 'atlassian_reauth_required') {
        // Mark the connection as expired so the UI can surface a reconnect prompt.
        try {
          await sql`update connections set status = 'expired', updated_at = now() where user_id = ${userId} and provider = 'atlassian'`;
        } catch { /* ignore */ }
      }
      throw err;
    }

    // Persist rotated refresh token.
    const { ct, iv, tag } = encrypt(tokens.refresh_token);
    await sql`
      update connections
      set refresh_token_ct = ${ct},
          refresh_token_iv = ${iv},
          refresh_token_tag = ${tag},
          scopes = ${tokens.scope || row.scopes},
          updated_at = now()
      where user_id = ${userId} and provider = 'atlassian'
    `;

    return {
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      cloudid: row.metadata?.cloudid,
      siteUrl: row.metadata?.site_url,
      siteName: row.metadata?.site_name,
    };
  } finally {
    try { await sql`select pg_advisory_unlock(${lockKey})`; } catch { /* ignore */ }
  }
}

export async function getAccessibleResources(accessToken) {
  const res = await fetch(`${API_BASE}/oauth/token/accessible-resources`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`accessible-resources failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

export async function getMe(accessToken) {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`me failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

export async function saveAtlassianConnection({ userId, me, resource, tokens, scopeStr }) {
  await upsertConnection({
    userId,
    provider: 'atlassian',
    refreshToken: tokens.refresh_token,
    scopes: scopeStr,
    externalAccountId: me?.account_id,
    externalEmail: me?.email,
    metadata: {
      cloudid: resource?.id,
      site_url: resource?.url,
      site_name: resource?.name,
      display_name: me?.name,
      avatar_url: me?.picture,
    },
  });
}
