// What connectors the Companion orchestrator knows about.
//
// `kind: 'internal'` — Vercel-local mocked MCP at `/api/<endpoint>`. Always
// available (no per-user auth). Token-style bearer = the mock Staffbase user.
//
// `kind: 'external'` — real third-party MCP. Requires the signed-in user to
// have a connection row. Token comes from the OAuth refresh flow.

export const CONNECTORS = [
  {
    id: 'hr_portal',
    name: 'HR Portal',
    description: 'Employee directory, PTO, org chart, HR policies, holidays, FAQs',
    kind: 'internal',
    endpoint: '/api/mcp',
    color: '#7C3AED',
    icon: 'users',
    alwaysOn: true,
    domains: [
      'hr', 'pto', 'employee', 'org', 'directory', 'leave', 'time off', 'vacation',
      'sick', 'parental', 'holiday', 'benefits', 'insurance', 'pension', '401k',
      'remote', 'hybrid', 'travel', 'expense', 'performance', 'review', 'salary',
      'bonus', 'promotion', 'onboarding', 'probation', 'learning', 'training',
      'conduct', 'harassment', 'ethics', 'policy', 'faq', 'people',
    ],
    useWhen: 'PTO, benefits, parental leave, performance reviews, expense policy, onboarding, ethics/conduct, and other HR policy questions.',
    dontUseFor: 'Live people search ("who is X" / "find a teammate") — that lives in the Staffbase Intranet. IT-shaped tickets — use IT Helpdesk.',
    examples: [
      'How much PTO do I have left?',
      'What is our parental leave policy?',
      'When is the next company holiday?',
      'Expense reimbursement rules',
    ],
  },
  {
    id: 'it_helpdesk',
    name: 'IT Helpdesk',
    description: 'Tickets, equipment, software access, security policies',
    kind: 'internal',
    endpoint: '/api/mcp-it',
    color: '#2563EB',
    icon: 'monitor',
    alwaysOn: true,
    domains: [
      'it', 'ticket', 'helpdesk', 'support', 'equipment', 'hardware', 'laptop',
      'monitor', 'phone', 'software', 'license', 'access', 'app', 'security',
      'mfa', '2fa', 'password', 'yubikey', 'vpn', 'tailscale', 'phishing',
      'incident', 'byod', 'mobile', 'mdm', 'ai tool', 'chatgpt', 'copilot',
      'claude', 'data', 'gdpr', 'privacy',
    ],
    useWhen: 'IT support tickets: hardware/equipment, VPN, MFA/2FA, software access requests, security incidents, phishing, password issues, BYOD/MDM.',
    dontUseFor: 'Project tracking, sprints, epics, bugs in a Jira board — use Atlassian. HR policy questions — use HR Portal.',
    examples: [
      'My laptop is slow',
      'I need GitHub access',
      'Open a ticket for VPN access',
      'My MFA token broke',
    ],
  },
  {
    id: 'intranet',
    name: 'Staffbase Intranet',
    description: 'Real Staffbase intranet via the team\'s MCP-proxy (github.com/Staffbase/mcp-proxy). News posts, pages, channels, employee directory, Staffbase Email. Auto-generated from OpenAPI specs.',
    // `remote` = a third-party MCP we talk to over the Streamable HTTP
    // transport (init → Mcp-Session-Id → tools/list, tools/call). URL and
    // API token come from navigator_config.tenantOverrides.connectorSettings
    // .intranet — admins configure them in Studio.
    kind: 'remote',
    // Default URL — the per-tenant `connectorSettings.intranet.mcpUrl`
    // overrides this if set.
    endpoint: 'https://campsite.staffbase.com/mcp',
    color: '#0EA5E9',
    icon: 'newspaper',
    alwaysOn: true,
    domains: [
      'intranet', 'news', 'announcement', 'memo', 'spotlight', 'erg', 'culture',
      'leadership', 'town hall', 'all-hands', 'article', 'launch', 'release', 'ceo', 'cfo',
      'staffbase', 'campsite', 'post', 'channel', 'page', 'space',
      'employee', 'colleague', 'teammate', 'profile', 'directory',
      'email', 'newsletter', 'template', 'gallery',
    ],
    useWhen: 'Staffbase news posts, channels, pages/spaces, Staffbase Email (templates, drafts), and employee profile lookups. Live data from the Staffbase MCP-proxy.',
    dontUseFor: 'Analytics, rankings, engagement metrics — the MCP-proxy does not expose those yet. HR policy text → HR Portal. Jira/Confluence → Atlassian.',
    examples: [
      'What\'s new this week?',
      'Find the marketing lead',
      'Show the Engineering space pages',
      'Read my Staffbase profile',
    ],
  },
  {
    id: 'atlassian',
    name: 'Atlassian',
    description: 'Real Confluence + Jira on your linked account. Search pages, read/comment/update issues. Direct REST (bypasses Atlassian Remote MCP).',
    kind: 'internal',
    endpoint: '/api/mcp-atlassian',
    provider: 'atlassian',
    needsUserContext: true,
    color: '#0052CC',
    icon: 'building',
    alwaysOn: false,
    writeTools: ['create_page', 'update_page', 'add_page_comment', 'add_issue_comment', 'create_issue'],
    domains: [
      'confluence', 'page', 'space', 'wiki', 'doc', 'documentation', 'jira', 'issue',
      'ticket atlassian', 'sprint', 'backlog', 'epic', 'story', 'task', 'roadmap page',
      'meeting notes', 'rfc', 'spec', 'draft',
      // AI Hackathon entry flow ultimately creates a Jira ticket on AIW-960,
      // so route hackathon/quiz intents here.
      'hackathon', 'quiz', 'submit entry', 'hackathon entry', 'ai quiz',
      'create my ticket', 'add me to the board',
    ],
    useWhen: 'Confluence pages/spaces/docs/RFCs/meeting notes AND Jira issues, epics, sprints, backlog, stories, bugs, tasks. Hackathon entries (creates a Jira ticket).',
    dontUseFor: 'IT support tickets (laptops, VPN, MFA, hardware) — use IT Helpdesk. Company news/announcements — use Staffbase Intranet.',
    examples: [
      'Show my open Jira issues',
      'Search Confluence for the Phoenix RFC',
      'Move AIW-243 to In Progress',
      'Pages in the Engineering space',
    ],
  },
];

export function getConnector(id) {
  return CONNECTORS.find((c) => c.id === id) || null;
}

export function isWriteTool(connectorId, toolName) {
  const c = getConnector(connectorId);
  return Boolean(c?.writeTools?.includes(toolName));
}
