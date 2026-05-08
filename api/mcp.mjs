// Acme HR Portal — MCP Server
// Exposes Resources, Tools, and Prompts for testing Navigator MCP integration.
// Runs stateless (no session IDs) — ideal for Vercel serverless.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

// ── Simulated data ────────────────────────────────────────────────────────────

const EMPLOYEES = [
  { id: 'alice', name: 'Alice Chen', email: 'alice@acme.com', role: 'hr_admin', department: 'HR', title: 'HR Manager', manager: null, ptoBalance: 18, location: 'San Francisco', startDate: '2019-03-15' },
  { id: 'bob', name: 'Bob Smith', email: 'bob@acme.com', role: 'employee', department: 'Engineering', title: 'Software Engineer', manager: 'carol@acme.com', ptoBalance: 12, location: 'New York', startDate: '2021-07-01' },
  { id: 'carol', name: 'Carol Davis', email: 'carol@acme.com', role: 'manager', department: 'Product', title: 'Product Manager', manager: 'eve@acme.com', ptoBalance: 15, location: 'Austin', startDate: '2020-01-20' },
  { id: 'dave', name: 'Dave Wilson', email: 'dave@acme.com', role: 'employee', department: 'Design', title: 'UX Designer', manager: 'carol@acme.com', ptoBalance: 9, location: 'Remote', startDate: '2022-04-11' },
  { id: 'eve', name: 'Eve Martinez', email: 'eve@acme.com', role: 'manager', department: 'Engineering', title: 'Engineering Manager', manager: null, ptoBalance: 20, location: 'San Francisco', startDate: '2017-09-05' },
  { id: 'frank', name: 'Frank Lee', email: 'frank@acme.com', role: 'employee', department: 'Engineering', title: 'Frontend Engineer', manager: 'eve@acme.com', ptoBalance: 14, location: 'Chicago', startDate: '2023-01-16' },
];

const POLICIES = {
  pto: {
    id: 'pto',
    title: 'Paid Time Off Policy',
    content: `# PTO Policy\n\nAll full-time employees receive 15 days of PTO per year, accruing at 1.25 days per month. PTO must be requested at least 2 weeks in advance except for emergencies. Unused PTO rolls over up to a maximum of 30 days. PTO is paid out upon termination.`,
    category: 'Benefits',
    lastUpdated: '2024-01-15',
  },
  remote: {
    id: 'remote',
    title: 'Remote Work Policy',
    content: `# Remote Work Policy\n\nEmployees may work remotely up to 3 days per week with manager approval. Full-remote arrangements require VP approval and a 6-month performance review. Home office stipend of $500/year is available for qualifying employees.`,
    category: 'Work Arrangements',
    lastUpdated: '2024-03-01',
  },
  conduct: {
    id: 'conduct',
    title: 'Code of Conduct',
    content: `# Code of Conduct\n\nAcme Corp expects all employees to treat each other with respect and professionalism. Harassment of any kind is strictly prohibited. Violations should be reported to HR immediately. Retaliation against reporters is also prohibited.`,
    category: 'Compliance',
    lastUpdated: '2023-11-01',
  },
  benefits: {
    id: 'benefits',
    title: 'Employee Benefits Overview',
    content: `# Benefits Overview\n\n**Health Insurance**: Medical, dental, and vision covered at 80% for employee, 60% for dependents.\n\n**401(k)**: 4% company match, vesting over 2 years.\n\n**Parental Leave**: 16 weeks fully paid for primary caregivers, 6 weeks for secondary.\n\n**Learning & Development**: $2,000/year for courses, conferences, and certifications.`,
    category: 'Benefits',
    lastUpdated: '2024-02-10',
  },
};

const ANNOUNCEMENTS = [
  { id: '1', title: 'Q2 All-Hands on May 15', body: 'Join us for the Q2 All-Hands meeting on May 15th at 2pm PT. Agenda includes product roadmap updates, Q1 results, and a special guest announcement.', date: '2026-05-05', author: 'Eve Martinez', priority: 'high' },
  { id: '2', title: 'New Parental Leave Policy', body: 'We are excited to announce expanded parental leave: 16 weeks fully paid for primary caregivers starting June 1st.', date: '2026-04-28', author: 'Alice Chen', priority: 'normal' },
  { id: '3', title: 'Office Closure — Memorial Day', body: 'The office will be closed on Monday, May 26th in observance of Memorial Day. Have a great long weekend!', date: '2026-04-22', author: 'Alice Chen', priority: 'normal' },
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
    version: '1.0.0',
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
          title: e.title, location: e.location, startDate: e.startDate,
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

  // Individual static resources for each policy (visible in resources/list)
  for (const policy of Object.values(POLICIES)) {
    server.resource(
      `policy-${policy.id}`,
      `acme://policies/${policy.id}`,
      { description: `${policy.title} (${policy.category})`, mimeType: 'text/markdown' },
      async () => ({
        contents: [{
          uri: `acme://policies/${policy.id}`,
          mimeType: 'text/markdown',
          text: policy.content,
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
    'Full-text search across company policy documents',
    {
      query: z.string().describe('Search keywords (e.g. "parental leave", "remote work", "health insurance")'),
    },
    async ({ query }) => {
      const q = query.toLowerCase();
      const results = Object.values(POLICIES)
        .filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        )
        .map(p => ({
          id: p.id,
          title: p.title,
          category: p.category,
          lastUpdated: p.lastUpdated,
          uri: `acme://policies/${p.id}`,
          excerpt: p.content.slice(0, 200) + '...',
        }));

      return {
        content: [{
          type: 'text',
          text: results.length
            ? JSON.stringify(results, null, 2)
            : `No policies found matching "${query}". Try: pto, remote work, conduct, benefits.`,
        }],
      };
    }
  );

  server.tool(
    'get_direct_reports',
    'Get the direct reports for a given manager',
    {
      manager_email: z.string().email().describe('Email of the manager'),
    },
    async ({ manager_email }) => {
      const manager = EMPLOYEES.find(e => e.email === manager_email);
      if (!manager) {
        return { content: [{ type: 'text', text: `Manager ${manager_email} not found.` }], isError: true };
      }

      const reports = EMPLOYEES
        .filter(e => e.manager === manager_email)
        .map(e => ({ id: e.id, name: e.name, email: e.email, title: e.title, department: e.department }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            manager: { name: manager.name, email: manager.email, title: manager.title },
            directReports: reports,
            count: reports.length,
          }, null, 2),
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
          text: `You are an HR assistant for Acme Corp. You help employees with HR-related questions including PTO, benefits, policies, and workplace matters. Be helpful, empathetic, and professional. Always refer employees to the HR team (hr@acme.com) for complex or sensitive matters.${currentUser ? ` The employee you are helping is ${currentUser.name} (${currentUser.title}, ${currentUser.department}).` : ''}`,
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
          text: `You are a benefits advisor for Acme Corp. Help employees understand and make the most of their benefits package including health insurance (medical/dental/vision), 401(k) matching, parental leave, and the learning & development stipend. Provide clear, actionable guidance. For enrollment questions, direct employees to the benefits portal or HR.`,
        },
      }],
    })
  );

  server.prompt(
    'policy_explainer',
    'Explain a company policy in plain language',
    [{ name: 'policy_name', description: 'The policy to explain (e.g. "PTO policy", "remote work policy")', required: true }],
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
