// Atlassian Remote MCP client + OpenAI schema bridge.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { sql } from './db.mjs';

const ATLASSIAN_MCP_URL = 'https://mcp.atlassian.com/v1/mcp';
const TOOL_CACHE_KEY = 'atlassian.tools.v1';
const TOOL_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

// Tools that mutate state — require confirmation from the user before the
// agent loop is allowed to dispatch them.
export const WRITE_TOOLS = new Set([
  'createConfluencePage',
  'updateConfluencePage',
  'createConfluenceFooterComment',
  'createConfluenceInlineComment',
  'createJiraIssue',
  'editJiraIssue',
  'transitionJiraIssue',
  'addCommentToJiraIssue',
  'addWorklogToJiraIssue',
  'createIssueLink',
]);

export function isWriteTool(name) {
  return WRITE_TOOLS.has(name);
}

export async function connectMcp(accessToken) {
  const transport = new StreamableHTTPClientTransport(new URL(ATLASSIAN_MCP_URL), {
    requestInit: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
  const client = new Client({ name: 'staffbase-companion', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
  return { client, transport };
}

export async function listToolsCached(client) {
  if (sql) {
    const rows = await sql`select tools_json, updated_at from tool_cache where key = ${TOOL_CACHE_KEY}`;
    if (rows.length) {
      const age = Date.now() - new Date(rows[0].updated_at).getTime();
      if (age < TOOL_CACHE_TTL_MS) return rows[0].tools_json;
    }
  }
  const result = await client.listTools();
  const tools = result.tools || [];
  if (sql) {
    await sql`
      insert into tool_cache (key, tools_json, updated_at)
      values (${TOOL_CACHE_KEY}, ${JSON.stringify(tools)}::jsonb, now())
      on conflict (key) do update
        set tools_json = excluded.tools_json,
            updated_at = now()
    `;
  }
  return tools;
}

// Sanitize MCP tool JSON Schema for OpenAI function-calling.
//
// OpenAI's function tools accept a subset of JSON Schema:
//   - Drops `$schema`, `$id`, `examples`, `default` at root (kept on properties)
//   - oneOf/allOf are tolerated but anyOf is preferred — leave as-is, OpenAI
//     handles all three in practice
//   - $ref is dropped along with the surrounding shape (best effort: leave a
//     plain object instead)
function sanitizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return { type: 'object', properties: {} };
  const out = JSON.parse(JSON.stringify(schema));
  delete out.$schema;
  delete out.$id;
  walk(out);
  return out;
}

function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(walk); return; }
  if (node.$ref) {
    // Replace $ref with a permissive object
    for (const k of Object.keys(node)) delete node[k];
    node.type = 'object';
    return;
  }
  if (node.properties) Object.values(node.properties).forEach(walk);
  if (node.items) walk(node.items);
  for (const k of ['oneOf', 'anyOf', 'allOf']) {
    if (Array.isArray(node[k])) node[k].forEach(walk);
  }
}

export function toolsToOpenAi(mcpTools) {
  return mcpTools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description || '',
      parameters: sanitizeSchema(t.inputSchema),
    },
  }));
}

// Auto-inject the user's real cloudId / siteUrl into args. Atlassian MCP tools
// take parameters like `cloudId`, and the model loves to hallucinate
// placeholders like "your-cloud-id" when we don't tell it the real value.
export function injectCloudContext(args, ctx) {
  if (!args || typeof args !== 'object' || !ctx) return args;
  const out = { ...args };
  if ('cloudId' in out && ctx.cloudid) out.cloudId = ctx.cloudid;
  if ('cloudid' in out && ctx.cloudid) out.cloudid = ctx.cloudid;
  if ('siteUrl' in out && ctx.siteUrl) out.siteUrl = ctx.siteUrl;
  return out;
}

export async function callMcpTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args || {} });
  // MCP returns { content: [{type:'text', text:'…'}, ...], isError? }
  if (result?.content) {
    const text = result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
    try { return JSON.parse(text); } catch { return text; }
  }
  return result;
}
