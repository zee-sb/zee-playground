// Diagnostic: pulls a fresh access token from the DB-stored refresh token,
// then runs three checks:
//   1. /oauth/token/accessible-resources — what products + scopes do we have on which sites?
//   2. Direct Confluence REST: /wiki/api/v2/spaces — does Confluence even respond?
//   3. Atlassian Remote MCP tools/list — does the MCP endpoint accept our token?

import { readFileSync } from 'node:fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

function loadEnv(path) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* ignore */ }
}
loadEnv('.env.local');

const { createDecipheriv } = await import('node:crypto');

function decrypt({ ct, iv, tag }) {
  const key = Buffer.from(process.env.TOKEN_ENC_KEY, 'base64');
  const dc = createDecipheriv('aes-256-gcm', key, Buffer.from(iv));
  dc.setAuthTag(Buffer.from(tag));
  return Buffer.concat([dc.update(Buffer.from(ct)), dc.final()]).toString('utf8');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED });
const { rows } = await pool.query(`
  select u.email, t.refresh_token_ct, t.refresh_token_iv, t.refresh_token_tag, t.cloudid, t.site_url
  from users u join oauth_tokens t on t.user_id = u.id
  limit 1
`);
await pool.end();

if (!rows.length) { console.error('No user in DB'); process.exit(1); }
const u = rows[0];
console.log('User:', u.email);
console.log('Stored cloudid:', u.cloudid);
console.log('Stored site:', u.site_url);

const refresh = decrypt({ ct: u.refresh_token_ct, iv: u.refresh_token_iv, tag: u.refresh_token_tag });

// 1) refresh → access token
const tokRes = await fetch('https://auth.atlassian.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'refresh_token',
    client_id: process.env.ATLASSIAN_CLIENT_ID,
    client_secret: process.env.ATLASSIAN_CLIENT_SECRET,
    refresh_token: refresh,
  }),
});
if (!tokRes.ok) { console.error('Refresh failed:', tokRes.status, await tokRes.text()); process.exit(1); }
const tok = await tokRes.json();
const at = tok.access_token;
console.log('\nAccess token scope:', tok.scope);
console.log('Access token expires in:', tok.expires_in, 's');

// 2) accessible resources — what products on which sites?
console.log('\n--- accessible-resources ---');
const arRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
  headers: { Authorization: `Bearer ${at}`, Accept: 'application/json' },
});
const ar = await arRes.json();
console.log(JSON.stringify(ar, null, 2));

// 3) Direct Confluence REST
console.log('\n--- Confluence v2 spaces (direct REST) ---');
const cRes = await fetch(`https://api.atlassian.com/ex/confluence/${u.cloudid}/wiki/api/v2/spaces?limit=5`, {
  headers: { Authorization: `Bearer ${at}`, Accept: 'application/json' },
});
console.log('HTTP', cRes.status);
const cText = await cRes.text();
console.log(cText.slice(0, 600));

// 4) Atlassian Remote MCP tools/list
console.log('\n--- MCP tools/list ---');
const mRes = await fetch('https://mcp.atlassian.com/v1/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${at}`,
  },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'diag', version: '0.0.1' } } }),
});
console.log('initialize HTTP', mRes.status);
const mText = await mRes.text();
console.log(mText.slice(0, 600));
