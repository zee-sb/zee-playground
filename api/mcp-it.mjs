// Acme IT Helpdesk — MCP Server
// Exposes Tools for ticket management, equipment lookup, software access, and IT/Security policies.
// Mirrors the HR server structure: stateless StreamableHTTP, Bearer auth.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { IT_POLICIES, localizeITPolicy, searchITPolicies } from './data/it-policies.mjs';
import { SUPPORTED_LANGS, normalizeLang, pick } from './data/languages.mjs';

// ── Simulated data ────────────────────────────────────────────────────────────

const EMPLOYEES = [
  { id: 'alice', name: 'Alice Chen',  email: 'alice@acme.com', department: 'HR' },
  { id: 'bob',   name: 'Bob Smith',   email: 'bob@acme.com',   department: 'Engineering' },
  { id: 'carol', name: 'Carol Davis', email: 'carol@acme.com', department: 'Product' },
  { id: 'dave',  name: 'Dave Wilson', email: 'dave@acme.com',  department: 'Design' },
  { id: 'eve',   name: 'Eve Martinez',email: 'eve@acme.com',   department: 'Engineering' },
  { id: 'frank', name: 'Frank Lee',   email: 'frank@acme.com', department: 'Engineering' },
];

const TICKETS = [
  { id: 'INC-1001', title: 'Laptop running slow after update', status: 'open',     priority: 'medium', category: 'hardware',  submittedBy: 'bob@acme.com',   assignedTo: 'it@acme.com', createdAt: '2026-05-01T09:15:00Z', updates: ['Ticket received. IT team will review.'] },
  { id: 'INC-1002', title: 'Cannot access GitHub repository', status: 'open',     priority: 'high',   category: 'access',    submittedBy: 'frank@acme.com', assignedTo: 'it@acme.com', createdAt: '2026-05-03T14:22:00Z', updates: ['Escalated to admin team.'] },
  { id: 'INC-1003', title: 'Request Figma license',           status: 'resolved', priority: 'low',    category: 'software',  submittedBy: 'dave@acme.com',  assignedTo: 'it@acme.com', createdAt: '2026-04-28T11:00:00Z', updates: ['License assigned. Check your email for activation link.'] },
  { id: 'INC-1004', title: 'VPN not connecting from home',    status: 'open',     priority: 'high',   category: 'network',   submittedBy: 'carol@acme.com', assignedTo: 'it@acme.com', createdAt: '2026-05-05T08:45:00Z', updates: ['Investigating. Please try reinstalling the VPN client.'] },
  { id: 'INC-1005', title: 'Need AWS Console access for new project', status: 'open', priority: 'medium', category: 'access', submittedBy: 'bob@acme.com', assignedTo: 'it@acme.com', createdAt: '2026-05-06T16:30:00Z', updates: ['Pending manager approval from eve@acme.com.'] },
  { id: 'INC-1006', title: 'Second monitor not detected',     status: 'resolved', priority: 'low',    category: 'hardware',  submittedBy: 'alice@acme.com', assignedTo: 'it@acme.com', createdAt: '2026-04-20T13:10:00Z', updates: ['Resolved. Updated display driver fixed the issue.'] },
  { id: 'INC-1007', title: 'YubiKey for admin role',          status: 'open',     priority: 'medium', category: 'access',    submittedBy: 'eve@acme.com',   assignedTo: 'it@acme.com', createdAt: '2026-05-02T10:30:00Z', updates: ['YubiKey ordered. ETA 3 business days.'] },
  { id: 'INC-1008', title: 'Mobile MDM enrollment failing',   status: 'open',     priority: 'medium', category: 'software',  submittedBy: 'dave@acme.com',  assignedTo: 'it@acme.com', createdAt: '2026-05-04T13:45:00Z', updates: ['Asked Dave to retry after iOS 18.4 update.'] },
];

const EQUIPMENT = {
  'alice@acme.com': [
    { type: 'laptop',  model: 'MacBook Pro 14" M3',   serialNo: 'FVHJ2NX3Q1',  assignedDate: '2023-06-01', condition: 'good' },
    { type: 'monitor', model: 'LG 27" 4K UltraFine',  serialNo: 'MNT-4892',     assignedDate: '2023-06-01', condition: 'good' },
  ],
  'bob@acme.com': [
    { type: 'laptop',  model: 'MacBook Pro 16" M3 Pro', serialNo: 'FVKQ8ZT5R2', assignedDate: '2022-08-15', condition: 'fair' },
    { type: 'headset', model: 'Sony WH-1000XM5',        serialNo: 'SN-6612-B',  assignedDate: '2022-08-15', condition: 'good' },
  ],
  'carol@acme.com': [
    { type: 'laptop',  model: 'MacBook Air 15" M2',   serialNo: 'FVHT9YP2K0',  assignedDate: '2021-03-10', condition: 'good' },
  ],
  'dave@acme.com': [
    { type: 'laptop',  model: 'MacBook Pro 14" M2',   serialNo: 'FVCK3WT4S1',  assignedDate: '2023-01-20', condition: 'good' },
    { type: 'tablet',  model: 'iPad Pro 12.9"',        serialNo: 'DMPQR8T3N1', assignedDate: '2023-01-20', condition: 'good' },
    { type: 'monitor', model: 'Dell 27" USB-C',        serialNo: 'MNT-7214',   assignedDate: '2023-01-20', condition: 'good' },
  ],
  'eve@acme.com': [
    { type: 'laptop',  model: 'MacBook Pro 16" M3 Max', serialNo: 'FVLM1XZ9P3', assignedDate: '2022-10-01', condition: 'good' },
    { type: 'monitor', model: 'Apple Studio Display',   serialNo: 'APSD-1142',  assignedDate: '2022-10-01', condition: 'good' },
    { type: 'yubikey', model: 'YubiKey 5C NFC',         serialNo: 'YK-998213',  assignedDate: '2024-01-15', condition: 'good' },
  ],
  'frank@acme.com': [
    { type: 'laptop',  model: 'MacBook Pro 14" M3',   serialNo: 'FVNQ0YK7T4',  assignedDate: '2024-02-01', condition: 'good' },
  ],
};

const SOFTWARE_SYSTEMS = [
  { name: 'GitHub',              description: 'Source code hosting and version control',     approvalRequired: 'manager',  category: 'development',     tier: 1, dpa: true },
  { name: 'AWS Console',         description: 'Amazon Web Services cloud console',           approvalRequired: 'manager',  category: 'infrastructure',  tier: 1, dpa: true },
  { name: 'Figma',               description: 'Collaborative design tool',                   approvalRequired: 'it_admin', category: 'design',          tier: 1, dpa: true },
  { name: 'Notion',              description: 'Team wiki and project docs',                  approvalRequired: 'none',     category: 'productivity',    tier: 1, dpa: true },
  { name: 'Salesforce',          description: 'CRM and sales pipeline',                      approvalRequired: 'manager',  category: 'sales',           tier: 1, dpa: true },
  { name: 'Jira',                description: 'Issue and project tracking',                  approvalRequired: 'none',     category: 'productivity',    tier: 1, dpa: true },
  { name: 'ChatGPT Enterprise',  description: 'OpenAI ChatGPT (enterprise tier)',            approvalRequired: 'manager',  category: 'ai',              tier: 1, dpa: true },
  { name: 'Claude for Work',     description: 'Anthropic Claude (enterprise tier)',          approvalRequired: 'manager',  category: 'ai',              tier: 1, dpa: true },
  { name: 'GitHub Copilot',      description: 'AI pair programmer for engineering',          approvalRequired: 'manager',  category: 'ai',              tier: 1, dpa: true },
  { name: 'Glean',               description: 'Enterprise search across Acme tools',         approvalRequired: 'none',     category: 'productivity',    tier: 1, dpa: true },
  { name: '1Password Business',  description: 'Password manager (provisioned via SSO)',      approvalRequired: 'none',     category: 'security',        tier: 1, dpa: true },
  { name: 'Tailscale',           description: 'ZeroTrust networking for production',         approvalRequired: 'manager',  category: 'security',        tier: 1, dpa: true },
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
    name: 'acme-it-helpdesk',
    version: '2.0.0',
  });

  // ── Resources ──────────────────────────────────────────────────────────────

  // Index of IT/Security policies for quick scanning by the LLM
  server.resource(
    'it-policy-index',
    'acme://it-policies',
    { description: 'Index of all IT & Security policies', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'acme://it-policies',
        mimeType: 'application/json',
        text: JSON.stringify(IT_POLICIES.map(p => localizeITPolicy(p, 'en', false)), null, 2),
      }],
    })
  );

  for (const policy of IT_POLICIES) {
    server.resource(
      `it-policy-${policy.id}`,
      `acme://it-policies/${policy.id}`,
      { description: `${pick(policy.title, 'en')} — ${policy.categoryKey} (v${policy.version}, updated ${policy.lastUpdated})`, mimeType: 'text/markdown' },
      async () => ({
        contents: [{
          uri: `acme://it-policies/${policy.id}`,
          mimeType: 'text/markdown',
          text: pick(policy.content, 'en'),
        }],
      })
    );
  }

  server.resource(
    'software-catalog',
    'acme://software-catalog',
    { description: 'List of approved software systems and their approval requirements', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'acme://software-catalog',
        mimeType: 'application/json',
        text: JSON.stringify(SOFTWARE_SYSTEMS, null, 2),
      }],
    })
  );

  // ── Tools ─────────────────────────────────────────────────────────────────

  server.tool(
    'create_ticket',
    'Create a new IT support ticket for the authenticated user',
    {
      title:       z.string().describe('Short summary of the issue'),
      description: z.string().describe('Detailed description of the problem or request'),
      priority:    z.enum(['low', 'medium', 'high', 'critical']).describe('Urgency level'),
      category:    z.enum(['hardware', 'software', 'access', 'network', 'other']).describe('Issue category'),
    },
    async ({ title, description, priority, category }) => {
      if (!currentUser) {
        return { content: [{ type: 'text', text: 'Authentication required to create a ticket.' }], isError: true };
      }

      const id = `INC-${1000 + Math.floor(Math.random() * 9000)}`;
      const ticket = {
        id, title, description,
        status: 'open',
        priority, category,
        submittedBy: currentUser.email,
        assignedTo: 'it@acme.com',
        createdAt: new Date().toISOString(),
        updates: ['Ticket created. IT team will respond within 1 business day.'],
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ticketId: ticket.id,
            status: 'created',
            title: ticket.title,
            priority: ticket.priority,
            category: ticket.category,
            submittedBy: currentUser.name,
            message: `Your IT ticket ${ticket.id} has been created. Expect a response within 1 business day.`,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'get_ticket',
    'Look up the details and status of a specific IT ticket by ID',
    {
      ticket_id: z.string().describe('Ticket ID (e.g. INC-1001)'),
    },
    async ({ ticket_id }) => {
      const ticket = TICKETS.find(t => t.id.toLowerCase() === ticket_id.toLowerCase());
      if (!ticket) {
        return { content: [{ type: 'text', text: `Ticket ${ticket_id} not found.` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(ticket, null, 2) }] };
    }
  );

  server.tool(
    'list_my_tickets',
    'List open IT support tickets submitted by the authenticated user',
    {
      include_resolved: z.boolean().optional().describe('Include resolved/closed tickets (default: false)'),
    },
    async ({ include_resolved = false }) => {
      if (!currentUser) {
        return { content: [{ type: 'text', text: 'Authentication required.' }], isError: true };
      }

      const tickets = TICKETS.filter(t =>
        t.submittedBy === currentUser.email &&
        (include_resolved || t.status === 'open')
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            employee: currentUser.name,
            tickets: tickets.map(t => ({
              id: t.id, title: t.title, status: t.status,
              priority: t.priority, category: t.category, createdAt: t.createdAt,
            })),
            count: tickets.length,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'lookup_equipment',
    'List all IT equipment assigned to an employee',
    {
      employee_email: z.string().email().optional().describe('Employee email. Omit to look up your own equipment.'),
    },
    async ({ employee_email }) => {
      if (!currentUser) {
        return { content: [{ type: 'text', text: 'Authentication required.' }], isError: true };
      }

      const targetEmail = employee_email || currentUser.email;
      const targetEmployee = EMPLOYEES.find(e => e.email === targetEmail);

      if (!targetEmployee) {
        return { content: [{ type: 'text', text: `Employee ${targetEmail} not found.` }], isError: true };
      }

      const equipment = EQUIPMENT[targetEmail] || [];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            employee: targetEmployee.name,
            email: targetEmail,
            equipment,
            count: equipment.length,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'request_software_access',
    'Submit a request to be granted access to a software system',
    {
      system_name:     z.string().describe('Name of the software system (e.g. GitHub, Figma, AWS Console)'),
      business_reason: z.string().describe('Why you need access to this system'),
    },
    async ({ system_name, business_reason }) => {
      if (!currentUser) {
        return { content: [{ type: 'text', text: 'Authentication required.' }], isError: true };
      }

      const system = SOFTWARE_SYSTEMS.find(
        s => s.name.toLowerCase() === system_name.toLowerCase()
      );

      const requestId = `SAR-${Date.now().toString(36).toUpperCase()}`;
      const approvalRequired = system?.approvalRequired ?? 'manager';

      const approvalNote = approvalRequired === 'none'
        ? 'No approval needed. Access will be provisioned within 1 hour.'
        : `Requires ${approvalRequired} approval. You will be notified once approved.`;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            requestId,
            status: 'submitted',
            requestedBy: currentUser.name,
            systemName: system?.name ?? system_name,
            systemDescription: system?.description ?? 'Unknown system',
            businessReason: business_reason,
            approvalRequired,
            message: `Access request ${requestId} submitted. ${approvalNote}`,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'search_it_policies',
    'Full-text search across IT & Security policies (acceptable use, MFA, BYOD, VPN, AI usage, software approval, phishing, incident response, mobile devices, GDPR, hardware lifecycle).',
    {
      query: z.string().describe('Search keywords (e.g. "MFA", "lost laptop", "AI", "data classification")'),
      lang: z.enum(SUPPORTED_LANGS).optional().describe('Language code for localized titles/summaries (en, de, fr, es, it, nl, pl). Defaults to en.'),
    },
    async ({ query, lang }) => {
      const results = searchITPolicies(query, normalizeLang(lang));
      return {
        content: [{
          type: 'text',
          text: results.length
            ? JSON.stringify(results, null, 2)
            : `No IT/Security policies matched "${query}". Try: acceptable use, mfa, password, byod, vpn, ai, software, phishing, incident, mobile, gdpr, hardware.`,
        }],
      };
    }
  );

  server.tool(
    'get_it_policy',
    'Fetch the full text of a specific IT/Security policy by id, in the requested language (with EN fallback).',
    {
      policy_id: z.string().describe('Policy id, e.g. acceptable-use, password-mfa, byod, ai-tool-usage'),
      lang: z.enum(SUPPORTED_LANGS).optional().describe('Language code (en, de, fr, es, it, nl, pl). Defaults to en.'),
    },
    async ({ policy_id, lang }) => {
      const policy = IT_POLICIES.find(p => p.id === policy_id);
      if (!policy) {
        return { content: [{ type: 'text', text: `IT policy "${policy_id}" not found. Use search_it_policies to find available policy ids.` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(localizeITPolicy(policy, normalizeLang(lang), true), null, 2) }] };
    }
  );

  server.tool(
    'list_software_catalog',
    'List all approved software systems with category, approval requirements, and DPA status.',
    {
      category: z.string().optional().describe('Filter by category (development, infrastructure, design, productivity, sales, ai, security)'),
    },
    async ({ category }) => {
      const filtered = category
        ? SOFTWARE_SYSTEMS.filter(s => s.category.toLowerCase() === category.toLowerCase())
        : SOFTWARE_SYSTEMS;
      return { content: [{ type: 'text', text: JSON.stringify({ systems: filtered, count: filtered.length }, null, 2) }] };
    }
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
          text: `## Acme IT Helpdesk — Navigator UI Guidelines

Format all IT responses for a mobile chat interface. Be direct and action-oriented.

**Ticket lists**
Each ticket on its own line: [STATUS] **INC-XXXX** — Title (Priority)
Status icons: 🔴 critical • 🟠 high • 🟡 medium • 🔵 low • ✅ resolved

**Single ticket detail**
Show: ticket ID in bold, status badge, priority, category, creation date, and the latest update. Keep it under 5 lines.

**New ticket submission**
When the user asks to submit a ticket WITHOUT providing the required fields (title, description, priority, category), output EXACTLY this token on its own line — nothing else before or after it on that line:
<ticket-form>
The Navigator UI will intercept this token and display a structured form. Do NOT ask for the fields yourself. Do NOT describe what a form would look like.

**Ticket creation confirmation**
Show: ✅ **INC-XXXX** • [Category] • [Priority] badge • "[Title]" • "IT will respond within 1 business day."

**Equipment list**
Each item: **Device type** — Model name
Serial and assign date on a secondary line if space allows.

**Software access request**
"✅ Request **SAR-XXXXX** submitted for [System]. [Approval note]."

**IT/Security policy results**
Lead with the localized policy title in bold. Give 3–4 bullet points of the most important rules. Include version + last-updated date as a small caption. End with "Full policy at acme://it-policies/[id]".

**Tone**: Efficient, clear, action-oriented. Use imperative for next steps. No fluff. Keep responses under 100 words.

**Multi-language**: When the user has chosen a language other than English, all titles, summaries, and the prose response must be in that language. Pass the user's language code to tools that accept a \`lang\` argument (search_it_policies, get_it_policy).

**After completing an IT task, your follow-up suggestions must include relevant options from**:
- "Create a new support ticket" (after any IT query)
- "What's the status of [ticket ID]?" (after listing tickets)
- "What equipment am I assigned?" (after any hardware topic)
- "Read the full [policy name] policy" (after any policy query)
- "Are there any critical open tickets?" (after listing open tickets)
- "Request a software license for [tool]"`,
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
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close();
  }
}
