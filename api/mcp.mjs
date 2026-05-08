// Acme HR Portal — MCP Server
// Exposes Resources, Tools, and Prompts for testing Navigator MCP integration.
// Runs stateless (no session IDs) — ideal for Vercel serverless.
// All policy/FAQ/holiday content loaded from ./data/ for easy expansion + multi-lang.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { HR_POLICIES, localizePolicy, searchPolicies } from './data/hr-policies.mjs';
import { HOLIDAYS, REGIONS, getHolidays, nextHoliday } from './data/holidays.mjs';
import { searchFAQs } from './data/faqs.mjs';
import { SUPPORTED_LANGS, normalizeLang, pick } from './data/languages.mjs';

// ── Simulated data ────────────────────────────────────────────────────────────

const EMPLOYEES = [
  { id: 'alice', name: 'Alice Chen', email: 'alice@acme.com', role: 'hr_admin', department: 'HR', title: 'HR Manager', manager: null, ptoBalance: 18, location: 'San Francisco', region: 'US', startDate: '2019-03-15' },
  { id: 'bob', name: 'Bob Smith', email: 'bob@acme.com', role: 'employee', department: 'Engineering', title: 'Software Engineer', manager: 'carol@acme.com', ptoBalance: 12, location: 'New York', region: 'US', startDate: '2021-07-01' },
  { id: 'carol', name: 'Carol Davis', email: 'carol@acme.com', role: 'manager', department: 'Product', title: 'Product Manager', manager: 'eve@acme.com', ptoBalance: 15, location: 'Austin', region: 'US', startDate: '2020-01-20' },
  { id: 'dave', name: 'Dave Wilson', email: 'dave@acme.com', role: 'employee', department: 'Design', title: 'UX Designer', manager: 'carol@acme.com', ptoBalance: 9, location: 'Berlin', region: 'DE', startDate: '2022-04-11' },
  { id: 'eve', name: 'Eve Martinez', email: 'eve@acme.com', role: 'manager', department: 'Engineering', title: 'Engineering Manager', manager: null, ptoBalance: 20, location: 'San Francisco', region: 'US', startDate: '2017-09-05' },
  { id: 'frank', name: 'Frank Lee', email: 'frank@acme.com', role: 'employee', department: 'Engineering', title: 'Frontend Engineer', manager: 'eve@acme.com', ptoBalance: 14, location: 'Amsterdam', region: 'NL', startDate: '2023-01-16' },
];

const ANNOUNCEMENTS = [
  { id: '1', title: 'Q2 All-Hands on May 15', body: 'Join us for the Q2 All-Hands meeting on May 15th at 2pm PT. Agenda includes product roadmap updates, Q1 results, and a special guest announcement.', date: '2026-05-05', author: 'Eve Martinez', priority: 'high' },
  { id: '2', title: 'New Parental Leave Policy', body: 'We are excited to announce expanded parental leave: 16 weeks fully paid for primary caregivers starting June 1st.', date: '2026-04-28', author: 'Alice Chen', priority: 'normal' },
  { id: '3', title: 'Office Closure — Memorial Day', body: 'The office will be closed on Monday, May 26th in observance of Memorial Day. Have a great long weekend!', date: '2026-04-22', author: 'Alice Chen', priority: 'normal' },
  { id: '4', title: 'AI Tool Usage Policy v2 Live', body: 'Updated AI Tool Usage Policy is live. New approved tools include Microsoft 365 Copilot (in pilot) and updated guidance on attribution. Read the full policy in the People app.', date: '2026-04-15', author: 'IT & Security', priority: 'normal' },
  { id: '5', title: 'Open Enrolment Reminder', body: 'Open enrolment for benefits closes November 30. Review your elections in Workday by then.', date: '2026-11-01', author: 'Alice Chen', priority: 'normal' },
];

// ── Token decode ──────────────────────────────────────────────────────────────

function decodeToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = Buffer.from(authHeader.slice(7), 'base64').toString('utf8');
    const [userId] = decoded.split(':');
    return EMPLOYEES.find(e => e.id === userId) || null;
  } catch {
    return null;
  }
}

// ── CORS headers ──────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id',
};

// ── Build MCP server ──────────────────────────────────────────────────────────

function buildServer(currentUser) {
  const server = new McpServer({
    name: 'acme-hr-portal',
    version: '2.0.0',
  });

  // ── Resources ──────────────────────────────────────────────────────────────

  server.resource(
    'employees',
    'acme://employees',
    { description: 'Full Acme Corp employee directory', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'acme://employees',
        mimeType: 'application/json',
        text: JSON.stringify(EMPLOYEES.map(e => ({
          id: e.id, name: e.name, email: e.email, department: e.department,
          title: e.title, location: e.location, region: e.region, startDate: e.startDate,
          manager: e.manager,
        })), null, 2),
      }],
    })
  );

  server.resource(
    'org-chart',
    'acme://org-chart',
    { description: 'Reporting structure tree', mimeType: 'application/json' },
    async () => {
      const buildTree = (managerEmail) => {
        const reports = EMPLOYEES.filter(e => e.manager === managerEmail);
        return reports.map(e => ({
          id: e.id, name: e.name, title: e.title, email: e.email,
          reports: buildTree(e.email),
        }));
      };
      const roots = EMPLOYEES.filter(e => !e.manager).map(e => ({
        id: e.id, name: e.name, title: e.title, email: e.email,
        reports: buildTree(e.email),
      }));
      return {
        contents: [{
          uri: 'acme://org-chart',
          mimeType: 'application/json',
          text: JSON.stringify(roots, null, 2),
        }],
      };
    }
  );

  server.resource(
    'announcements',
    'acme://announcements',
    { description: 'Recent company announcements', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'acme://announcements',
        mimeType: 'application/json',
        text: JSON.stringify(ANNOUNCEMENTS, null, 2),
      }],
    })
  );

  // Policy index — gives the LLM a one-shot view of every available policy
  server.resource(
    'policy-index',
    'acme://policies',
    { description: 'Index of all HR policies (id, title, category, last updated)', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'acme://policies',
        mimeType: 'application/json',
        text: JSON.stringify(HR_POLICIES.map(p => localizePolicy(p, 'en', false)), null, 2),
      }],
    })
  );

  // Each individual policy as a static MCP resource — visible in resources/list
  for (const policy of HR_POLICIES) {
    server.resource(
      `policy-${policy.id}`,
      `acme://policies/${policy.id}`,
      { description: `${pick(policy.title, 'en')} — ${policy.categoryKey} (v${policy.version}, updated ${policy.lastUpdated})`, mimeType: 'text/markdown' },
      async () => ({
        contents: [{
          uri: `acme://policies/${policy.id}`,
          mimeType: 'text/markdown',
          text: pick(policy.content, 'en'),
        }],
      })
    );
  }

  // Holiday calendar resource (per region)
  for (const region of REGIONS) {
    server.resource(
      `holidays-${region.toLowerCase()}`,
      `acme://holidays/${region}`,
      { description: `Public holiday calendar for ${region}`, mimeType: 'application/json' },
      async () => ({
        contents: [{
          uri: `acme://holidays/${region}`,
          mimeType: 'application/json',
          text: JSON.stringify(getHolidays(region, 'en'), null, 2),
        }],
      })
    );
  }

  // ── Tools ─────────────────────────────────────────────────────────────────

  server.tool(
    'lookup_employee',
    'Search employees by name, department, or role',
    {
      query: z.string().describe('Search query — name, department, title, or email'),
    },
    async ({ query }) => {
      const q = query.toLowerCase();
      const results = EMPLOYEES.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q)
      ).map(e => ({
        id: e.id, name: e.name, email: e.email, title: e.title,
        department: e.department, location: e.location,
      }));

      return {
        content: [{
          type: 'text',
          text: results.length
            ? JSON.stringify(results, null, 2)
            : `No employees found matching "${query}".`,
        }],
      };
    }
  );

  server.tool(
    'check_pto_balance',
    'Check PTO balance. HR admins can check any employee; others can only check their own.',
    {
      employee_email: z.string().email().optional().describe('Employee email to check (HR admin only). Omit to check your own balance.'),
    },
    async ({ employee_email }) => {
      if (!currentUser) {
        return { content: [{ type: 'text', text: 'Authentication required. Please connect with your Acme email first.' }], isError: true };
      }

      const target = employee_email
        ? EMPLOYEES.find(e => e.email === employee_email)
        : currentUser;

      if (!target) {
        return { content: [{ type: 'text', text: `Employee ${employee_email} not found.` }], isError: true };
      }

      if (employee_email && employee_email !== currentUser.email && currentUser.role !== 'hr_admin') {
        return { content: [{ type: 'text', text: 'Permission denied: only HR admins can view other employees\' PTO balances.' }], isError: true };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            employee: target.name,
            email: target.email,
            ptoBalance: target.ptoBalance,
            unit: 'days',
            region: target.region,
            note: 'PTO accrues at 1.25 days/month. Max rollover: 30 days.',
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'submit_time_off_request',
    'Submit a PTO request for the authenticated user',
    {
      start_date: z.string().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().describe('End date (YYYY-MM-DD)'),
      reason: z.string().optional().describe('Optional reason for the request'),
    },
    async ({ start_date, end_date, reason }) => {
      if (!currentUser) {
        return { content: [{ type: 'text', text: 'Authentication required to submit a PTO request.' }], isError: true };
      }

      const start = new Date(start_date);
      const end = new Date(end_date);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      if (days <= 0) {
        return { content: [{ type: 'text', text: 'End date must be after start date.' }], isError: true };
      }

      const requestId = `PTR-${Date.now().toString(36).toUpperCase()}`;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            requestId,
            status: 'submitted',
            employee: currentUser.name,
            startDate: start_date,
            endDate: end_date,
            daysRequested: days,
            reason: reason || 'Not specified',
            submittedAt: new Date().toISOString(),
            message: `Your PTO request (${requestId}) has been submitted. Your manager will review it within 2 business days.`,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'search_policies',
    'Full-text search across all HR policies (PTO, parental leave, sick leave, remote work, travel, code of conduct, performance, onboarding, benefits, learning). Returns localized titles and summaries.',
    {
      query: z.string().describe('Search keywords (e.g. "parental leave", "remote work", "health insurance")'),
      lang: z.enum(SUPPORTED_LANGS).optional().describe('Language code for localized titles/summaries (en, de, fr, es, it, nl, pl). Defaults to en.'),
    },
    async ({ query, lang }) => {
      const results = searchPolicies(query, normalizeLang(lang));
      return {
        content: [{
          type: 'text',
          text: results.length
            ? JSON.stringify(results, null, 2)
            : `No policies found matching "${query}". Try: pto, parental leave, sick leave, remote work, travel, code of conduct, performance, onboarding, benefits, learning.`,
        }],
      };
    }
  );

  server.tool(
    'get_policy',
    'Fetch the full text of a specific HR policy by id, in the requested language (with EN fallback).',
    {
      policy_id: z.string().describe('Policy id, e.g. pto, parental-leave, remote-work, benefits-overview'),
      lang: z.enum(SUPPORTED_LANGS).optional().describe('Language code (en, de, fr, es, it, nl, pl). Defaults to en.'),
    },
    async ({ policy_id, lang }) => {
      const policy = HR_POLICIES.find(p => p.id === policy_id);
      if (!policy) {
        return { content: [{ type: 'text', text: `Policy "${policy_id}" not found. Use search_policies to find available policy ids.` }], isError: true };
      }
      const localized = localizePolicy(policy, normalizeLang(lang), true);
      return { content: [{ type: 'text', text: JSON.stringify(localized, null, 2) }] };
    }
  );

  server.tool(
    'get_direct_reports',
    'Get the direct reports for a given manager. Defaults to the current authenticated user.',
    {
      manager_email: z.string().email().optional().describe('Email of the manager. Omit to use the current user.'),
    },
    async ({ manager_email }) => {
      const email = manager_email || currentUser?.email;
      if (!email) {
        return { content: [{ type: 'text', text: 'Authentication required or manager_email must be provided.' }], isError: true };
      }
      const manager = EMPLOYEES.find(e => e.email === email);
      if (!manager) {
        return { content: [{ type: 'text', text: `Manager ${email} not found.` }], isError: true };
      }

      const reports = EMPLOYEES
        .filter(e => e.manager === email)
        .map(e => ({ id: e.id, name: e.name, email: e.email, title: e.title, department: e.department }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            manager: { name: manager.name, email: manager.email, title: manager.title, department: manager.department },
            directReports: reports,
            count: reports.length,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'get_next_holiday',
    'Get the next upcoming public holiday for a region (US, DE, FR, ES, IT, NL, PL, UK).',
    {
      region: z.enum(REGIONS).optional().describe('Country/region code. Defaults to the current user\'s region.'),
      lang: z.enum(SUPPORTED_LANGS).optional().describe('Language code for the holiday name. Defaults to en.'),
    },
    async ({ region, lang }) => {
      const r = region || currentUser?.region || 'US';
      const result = nextHoliday(r, normalizeLang(lang));
      if (!result) {
        return { content: [{ type: 'text', text: `No upcoming holidays found for ${r}.` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'list_holidays',
    'List all public holidays for a region in a given calendar year.',
    {
      region: z.enum(REGIONS).optional().describe('Country/region code. Defaults to the current user\'s region.'),
      lang: z.enum(SUPPORTED_LANGS).optional().describe('Language code for holiday names. Defaults to en.'),
    },
    async ({ region, lang }) => {
      const r = region || currentUser?.region || 'US';
      return { content: [{ type: 'text', text: JSON.stringify({ region: r, holidays: getHolidays(r, normalizeLang(lang)) }, null, 2) }] };
    }
  );

  server.tool(
    'search_faqs',
    'Search the company FAQ corpus for short, canonical answers to common HR/IT questions.',
    {
      query: z.string().describe('Natural-language question'),
      lang: z.enum(SUPPORTED_LANGS).optional().describe('Language for the answer. Defaults to en.'),
    },
    async ({ query, lang }) => {
      const results = searchFAQs(query, normalizeLang(lang));
      return {
        content: [{
          type: 'text',
          text: results.length
            ? JSON.stringify(results, null, 2)
            : `No FAQ matched "${query}". Try the search_policies tool for full-text policy search.`,
        }],
      };
    }
  );

  // ── Prompts ────────────────────────────────────────────────────────────────

  server.prompt(
    'hr_assistant',
    'HR assistant persona for Acme Corp',
    [],
    async () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `You are an HR assistant for Acme Corp. You help employees with HR-related questions including PTO, benefits, policies, and workplace matters. Be helpful, empathetic, and professional. Always refer employees to the HR team (people@acme.com) for complex or sensitive matters.${currentUser ? ` The employee you are helping is ${currentUser.name} (${currentUser.title}, ${currentUser.department}, region ${currentUser.region}).` : ''}`,
        },
      }],
    })
  );

  server.prompt(
    'benefits_advisor',
    'Guide employees through their Acme Corp benefits',
    [],
    async () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `You are a benefits advisor for Acme Corp. Help employees understand and make the most of their benefits package including health insurance (medical/dental/vision), 401(k) and pension, parental leave, learning & development stipend, wellness stipend, and family-support benefits. Provide clear, actionable guidance. For enrollment questions, direct employees to Workday or People Operations.`,
        },
      }],
    })
  );

  server.prompt(
    'policy_explainer',
    'Explain a company policy in plain language',
    [{ name: 'policy_name', description: 'The policy to explain', required: true }],
    async ({ policy_name }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please explain the Acme Corp "${policy_name}" in simple, plain language. Break it down into key points that any employee can understand. Highlight the most important rules and any exceptions. Avoid jargon.`,
        },
      }],
    })
  );

  server.prompt(
    'navigator_ui',
    'Response formatting and UX guidelines for the Navigator orchestrator',
    [],
    async () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `## Acme HR Portal — Navigator UI Guidelines

Format all HR responses for a mobile chat interface. Keep responses concise and scannable.

**Employee lookups**
Lead with the full name in bold. Show title and department on the next line. Include email in a subtle secondary style. If multiple results, use a numbered list.

**PTO balance**
State the days remaining on the first line prominently: "You have **X days** of PTO remaining."
Follow with accrual rate and rollover cap in one short sentence.

**PTO request confirmation**
Show: ✅ Request ID (e.g. PTR-XXXXX) • dates • X days • "Your manager will review within 2 business days."

**Direct reports / org chart**
List each person as: **Name** — Title (email)

**Policy results**
Lead with the localized policy title in bold. Give 3–4 bullet points of the most important rules. Include the version + last-updated date as a small caption. End with "Full policy at acme://policies/[id]".

**Holiday answers**
Lead with the holiday name and date: "**[Holiday name]** is on [date] ([N] days away)." Mention the region.

**FAQ answers**
Use the FAQ answer verbatim if it fully addresses the question; otherwise summarize and cite the related policy.

**Tone**: Warm, first-person, concise. Address the user by first name when relevant. Avoid corporate jargon. Keep responses under 120 words when possible.

**Multi-language**: When the user has chosen a language other than English, all titles, summaries, and the prose response must be in that language. Pass the user's language code to tools that accept a \`lang\` argument (search_policies, get_policy, get_next_holiday, list_holidays, search_faqs).

**After completing an HR task, your follow-up suggestions must include relevant options from**:
- "Submit a time off request" (after checking PTO balance)
- "Read the full PTO policy" (after any PTO query)
- "When is the next public holiday?" (after any time-off query)
- "Search policies about [relevant topic]"
- "Look up [colleague name] in the directory"
- "What benefits am I entitled to?"`,
        },
      }],
    })
  );

  return server;
}

// ── Vercel handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const currentUser = decodeToken(req.headers['authorization']);
  const server = buildServer(currentUser);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode for serverless
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close();
  }
}
