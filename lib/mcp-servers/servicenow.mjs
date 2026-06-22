// Internal MCP server that wraps direct ServiceNow REST calls.
//
// The orchestrator forwards `X-Companion-User-Id` so this server can fetch the
// right per-user access token from the connections table. Both sides live on
// the same host so the header is trusted. Every tool runs with the user's own
// token, so ServiceNow enforces their roles/ACLs on each call. Mirrors
// lib/mcp-servers/atlassian.mjs.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { getServiceNowAccessToken } from '../servicenow.mjs';
import {
  searchKnowledge,
  listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  addIncidentComment,
} from '../servicenow-api.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, X-Companion-User-Id',
};

function asResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

function buildServer({ userId }) {
  const server = new McpServer({ name: 'servicenow-internal', version: '1.0.0' });

  async function withCtx(fn) {
    if (!userId) return asResult({ error: true, message: 'no_user_context' });
    try {
      const { accessToken, instanceUrl } = await getServiceNowAccessToken(userId);
      return await fn({ accessToken, instanceUrl });
    } catch (err) {
      // Surface the tagged reconnect/config codes so the orchestrator can
      // prompt the user instead of failing vaguely.
      return asResult({ error: true, code: err.code || null, message: err.message || String(err) });
    }
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  server.tool(
    'servicenow_search_kb',
    'Search the ServiceNow knowledge base for help articles (how-tos, policies, troubleshooting). Returns article number, title, and a snippet. Use this when the user asks how to do something, for setup/troubleshooting steps, or "is there a KB article on X?".',
    {
      query: z.string().describe('Search keywords, e.g. "reset VPN password".'),
      limit: z.number().int().min(1).max(25).optional(),
    },
    async ({ query, limit }) => withCtx(async (ctx) => {
      const articles = await searchKnowledge({ ...ctx, query, limit: limit || 10 });
      return asResult({ query, count: articles.length, articles });
    })
  );

  server.tool(
    'servicenow_list_incidents',
    'List the signed-in user\'s ServiceNow incidents, newest first. Use this for "my open tickets", "what incidents do I have?", "show my ServiceNow cases".',
    {
      scope: z.enum(['caller', 'assigned']).describe('"caller" = incidents the user opened (default); "assigned" = incidents assigned to them.').optional(),
      state: z.string().describe('Optional ServiceNow state value to filter on (e.g. "1" New, "2" In Progress, "6" Resolved).').optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async ({ scope, state, limit }) => withCtx(async (ctx) => {
      const incidents = await listIncidents({ ...ctx, scope: scope || 'caller', state, limit: limit || 20 });
      return asResult({ count: incidents.length, incidents });
    })
  );

  server.tool(
    'servicenow_get_incident',
    'Fetch full details of one ServiceNow incident by its number (e.g. "INC0010001") or sys_id.',
    { number_or_sys_id: z.string().describe('Incident number like "INC0010001", or a sys_id.') },
    async ({ number_or_sys_id }) => withCtx(async (ctx) => {
      const incident = await getIncident({ ...ctx, idOrNumber: number_or_sys_id });
      if (!incident) return asResult({ error: true, message: `Incident ${number_or_sys_id} not found.` });
      return asResult({ incident });
    })
  );

  // ── Writes (orchestrator requires user confirmation before these run) ─────────

  server.tool(
    'servicenow_create_incident',
    'Create a new ServiceNow incident on behalf of the signed-in user (they become the caller). Use this to log a problem or open a ticket. Requires user confirmation in the UI before it runs.',
    {
      short_description: z.string().describe('One-line summary of the issue.'),
      description: z.string().describe('Detailed description of the issue.').optional(),
      urgency: z.enum(['1', '2', '3']).describe('1 High, 2 Medium, 3 Low.').optional(),
      impact: z.enum(['1', '2', '3']).describe('1 High, 2 Medium, 3 Low.').optional(),
      category: z.string().describe('Incident category, e.g. "hardware", "software", "network".').optional(),
    },
    async ({ short_description, description, urgency, impact, category }) => withCtx(async (ctx) => {
      const incident = await createIncident({ ...ctx, short_description, description, urgency, impact, category });
      return asResult({ created: true, incident });
    })
  );

  server.tool(
    'servicenow_update_incident',
    'Update fields on an existing ServiceNow incident (e.g. state, urgency, short_description). Requires user confirmation before it runs.',
    {
      sys_id: z.string().describe('The incident sys_id (from servicenow_get_incident / servicenow_list_incidents).'),
      fields: z.record(z.string()).describe('Map of ServiceNow field names to new values, e.g. {"state":"2","urgency":"1"}.'),
    },
    async ({ sys_id, fields }) => withCtx(async (ctx) => {
      const incident = await updateIncident({ ...ctx, sys_id, fields });
      return asResult({ updated: true, incident });
    })
  );

  server.tool(
    'servicenow_add_comment',
    'Add a customer-visible comment and/or an internal work note to a ServiceNow incident. Requires user confirmation before it runs.',
    {
      sys_id: z.string().describe('The incident sys_id.'),
      comment: z.string().describe('Customer-visible comment (additional comments).').optional(),
      work_note: z.string().describe('Internal work note (not visible to the caller).').optional(),
    },
    async ({ sys_id, comment, work_note }) => withCtx(async (ctx) => {
      const incident = await addIncidentComment({ ...ctx, sys_id, comment, workNote: work_note });
      return asResult({ updated: true, incident });
    })
  );

  return server;
}

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET' || req.method === 'DELETE') {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed for stateless server' }, id: null });
    return;
  }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  // Orchestrator injects this header for tools that need per-user identity.
  // Same-host so we trust it.
  const userId = req.headers['x-companion-user-id'] || null;

  try {
    const server = buildServer({ userId });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  } catch (err) {
    console.error('[mcp-servicenow]', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
}
