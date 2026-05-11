// Per-user external-account connections.
// One row per (user, provider). For OAuth providers the refresh token lives
// here encrypted; for token-less internal MCPs we don't store one.

import { sql } from './db.mjs';
import { encrypt, decrypt } from './crypto.mjs';

export async function listConnectionsForUser(userId) {
  if (!sql) return [];
  return await sql`
    select provider, status, external_account_id, external_email, metadata, created_at, updated_at
    from connections
    where user_id = ${userId}
    order by provider asc
  `;
}

export async function getConnection(userId, provider) {
  if (!sql) return null;
  const rows = await sql`
    select id, user_id, provider, status, refresh_token_ct, refresh_token_iv, refresh_token_tag,
           scopes, external_account_id, external_email, metadata, created_at, updated_at
    from connections
    where user_id = ${userId} and provider = ${provider}
  `;
  return rows[0] || null;
}

export async function upsertConnection({ userId, provider, refreshToken, scopes, externalAccountId, externalEmail, metadata }) {
  if (!sql) throw new Error('DB not configured');
  let ct = null, iv = null, tag = null;
  if (refreshToken) {
    const enc = encrypt(refreshToken);
    ct = enc.ct; iv = enc.iv; tag = enc.tag;
  }
  await sql`
    insert into connections (user_id, provider, status, refresh_token_ct, refresh_token_iv, refresh_token_tag,
                             scopes, external_account_id, external_email, metadata)
    values (${userId}, ${provider}, 'connected', ${ct}, ${iv}, ${tag},
            ${scopes || null}, ${externalAccountId || null}, ${externalEmail || null}, ${JSON.stringify(metadata || {})}::jsonb)
    on conflict (user_id, provider) do update
      set status              = 'connected',
          refresh_token_ct    = excluded.refresh_token_ct,
          refresh_token_iv    = excluded.refresh_token_iv,
          refresh_token_tag   = excluded.refresh_token_tag,
          scopes              = excluded.scopes,
          external_account_id = excluded.external_account_id,
          external_email      = excluded.external_email,
          metadata            = excluded.metadata,
          updated_at          = now()
  `;
}

export async function deleteConnection(userId, provider) {
  if (!sql) return;
  await sql`delete from connections where user_id = ${userId} and provider = ${provider}`;
}

export function decryptRefreshToken(row) {
  if (!row?.refresh_token_ct) return null;
  return decrypt({ ct: row.refresh_token_ct, iv: row.refresh_token_iv, tag: row.refresh_token_tag });
}
