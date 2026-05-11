// Internal MCP server that wraps direct Atlassian REST calls.
//
// The orchestrator forwards `X-Companion-User-Id` so this server can fetch
// the right per-user access token from the connections table. Both sides live
// on the same host so the header is trusted.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { getAtlassianAccessToken } from '../atlassian.mjs';
import { getConnection } from '../connections.mjs';
import {
  listConfluenceSpaces,
  listPagesInSpace,
  getConfluencePage,
  searchConfluencePages,
  createConfluencePage,
  updateConfluencePage,
  addConfluenceComment,
  listJiraProjects,
  searchJiraIssues,
  getJiraIssue,
  addJiraComment,
  createJiraIssue,
} from '../atlassian-api.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, X-Companion-User-Id',
};

function asResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

function buildServer({ userId }) {
  const server = new McpServer({ name: 'atlassian-internal', version: '1.0.0' });

  async function withCtx(fn) {
    if (!userId) return asResult({ error: true, message: 'no_user_context' });
    try {
      const { accessToken, cloudid, siteUrl } = await getAtlassianAccessToken(userId);
      return await fn({ accessToken, cloudId: cloudid, siteUrl });
    } catch (err) {
      return asResult({ error: true, message: err.message || String(err) });
    }
  }

  async function lookupAccountId() {
    const conn = await getConnection(userId, 'atlassian');
    return conn?.external_account_id || null;
  }

  // ── Confluence reads ──────────────────────────────────────────────────────

  server.tool(
    'list_spaces',
    'List Confluence spaces the user has access to on their linked Atlassian site. Returns space id, key, name, type, and status. Use this when the user asks "what spaces?", "list my Confluence spaces", "which spaces can I see?".',
    {},
    async () => withCtx(async (ctx) => {
      const spaces = await listConfluenceSpaces({ ...ctx });
      return asResult({ count: spaces.length, spaces });
    })
  );

  server.tool(
    'list_pages_in_space',
    'List recent pages within a specific Confluence space. Pass the spaceId from list_spaces.',
    {
      spaceId: z.string().describe('Confluence space id (from list_spaces).'),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async ({ spaceId, limit }) => withCtx(async (ctx) => {
      const pages = await listPagesInSpace({ ...ctx, spaceId, limit: limit || 25 });
      return asResult({ count: pages.length, pages });
    })
  );

  server.tool(
    'get_page',
    'Fetch the full content of one Confluence page by id. Returns title, status, version, and body (HTML-stripped).',
    { pageId: z.string().describe('Confluence page id.') },
    async ({ pageId }) => withCtx(async (ctx) => asResult(await getConfluencePage({ ...ctx, pageId })))
  );

  server.tool(
    'search_pages',
    'Find Confluence pages by title keyword. Returns matching pages with id, title, space, and url.',
    {
      query: z.string().describe('Keyword(s) to search for in page titles.'),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async ({ query, limit }) => withCtx(async (ctx) => {
      const pages = await searchConfluencePages({ ...ctx, query, limit: limit || 15 });
      return asResult({ query, count: pages.length, pages });
    })
  );

  // ── Confluence writes ─────────────────────────────────────────────────────

  server.tool(
    'create_page',
    'Create a new Confluence page in a specific space. Requires user confirmation in the UI before it runs.',
    {
      spaceId: z.string().describe('Target Confluence space id.'),
      title: z.string().describe('Page title.'),
      body: z.string().describe('Page body in HTML storage format (e.g. "<p>Hello</p>").').optional(),
    },
    async ({ spaceId, title, body }) => withCtx(async (ctx) => asResult(await createConfluencePage({ ...ctx, spaceId, title, body })))
  );

  server.tool(
    'update_page',
    'Update an existing Confluence page. Requires user confirmation before it runs.',
    {
      pageId: z.string().describe('Confluence page id.'),
      title: z.string().describe('New title (optional — keeps current if omitted).').optional(),
      body: z.string().describe('New body in HTML storage format (optional).').optional(),
    },
    async ({ pageId, title, body }) => withCtx(async (ctx) => asResult(await updateConfluencePage({ ...ctx, pageId, title, body })))
  );

  server.tool(
    'add_page_comment',
    'Add a footer comment to a Confluence page. Requires user confirmation.',
    {
      pageId: z.string().describe('Confluence page id.'),
      body: z.string().describe('Comment body (HTML storage format).'),
    },
    async ({ pageId, body }) => withCtx(async (ctx) => asResult(await addConfluenceComment({ ...ctx, pageId, body })))
  );

  // ── Jira reads ────────────────────────────────────────────────────────────

  server.tool(
    'list_projects',
    'List Jira projects the user can see on their linked Atlassian site.',
    {},
    async () => withCtx(async (ctx) => {
      const projects = await listJiraProjects({ ...ctx });
      return asResult({ count: projects.length, projects });
    })
  );

  server.tool(
    'search_issues',
    'Search Jira issues using JQL (Jira Query Language). Returns matching issues with key, summary, status, priority, assignee, etc.',
    {
      jql: z.string().describe('JQL query, e.g. "assignee = currentUser() AND status != Done" or "project = AIW AND priority = High".'),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async ({ jql, limit }) => withCtx(async (ctx) => {
      const issues = await searchJiraIssues({ ...ctx, jql, limit: limit || 25 });
      return asResult({ jql, count: issues.length, issues });
    })
  );

  server.tool(
    'get_issue',
    'Fetch the full details of one Jira issue by its key (e.g. "AIW-243").',
    { issueKey: z.string().describe('Jira issue key, e.g. "AIW-243".') },
    async ({ issueKey }) => withCtx(async (ctx) => asResult(await getJiraIssue({ ...ctx, issueKey })))
  );

  // ── Jira writes ───────────────────────────────────────────────────────────

  server.tool(
    'add_issue_comment',
    'Add a comment to a Jira issue. Requires user confirmation before it runs.',
    {
      issueKey: z.string().describe('Jira issue key, e.g. "AIW-243".'),
      body: z.string().describe('Comment body (plain text).'),
    },
    async ({ issueKey, body }) => withCtx(async (ctx) => asResult(await addJiraComment({ ...ctx, issueKey, body })))
  );

  server.tool(
    'create_issue',
    'Create a new Jira issue. Use this for hackathon entries: the server will automatically attach the issue to the configured hackathon epic and assign it to the signed-in user. Pass plain-text description (the server converts to Atlassian Document Format). Requires user confirmation before it runs.',
    {
      summary: z.string().describe('Issue summary / title.'),
      description: z.string().describe('Issue description as plain text. Blank lines start new paragraphs; lines starting with "- " become bullets; lines starting with "## " become headings.'),
      issueType: z.string().describe('Issue type — "Story", "Task", "Bug", etc. Default "Story".').optional(),
      labels: z.array(z.string()).describe('Optional list of labels.').optional(),
      projectKey: z.string().describe('Override the default Jira project. Usually omit — server uses the configured hackathon project.').optional(),
      epicKey: z.string().describe('Override the parent epic key. Usually omit — server uses the configured hackathon epic.').optional(),
      assignToMe: z.boolean().describe('Assign the new issue to the signed-in user (recommended for hackathon entries). Default true.').optional(),
    },
    async ({ summary, description, issueType, labels, projectKey, epicKey, assignToMe }) => withCtx(async (ctx) => {
      const project = projectKey || process.env.HACKATHON_JIRA_PROJECT_KEY || 'AIW';
      const epic = epicKey || process.env.HACKATHON_JIRA_EPIC_KEY || null;
      const accountId = (assignToMe !== false) ? await lookupAccountId() : null;
      const res = await createJiraIssue({
        ...ctx,
        projectKey: project,
        summary,
        description,
        issueType,
        epicKey: epic,
        labels,
        assignAccountId: accountId,
      });
      return asResult(res);
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
  // It's same-host so we trust it; we could sign it with the session secret
  // as belt-and-suspenders later.
  const userId = req.headers['x-companion-user-id'] || null;

  try {
    const server = buildServer({ userId });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  } catch (err) {
    console.error('[mcp-atlassian]', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
}
