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
  },
  {
    id: 'intranet',
    name: 'Staffbase Intranet',
    description: 'Real Staffbase intranet — leadership memos, news posts, channels, and the employee directory. Live data from campsite.staffbase.com.',
    kind: 'internal',
    endpoint: '/api/mcp-staffbase',
    color: '#0EA5E9',
    icon: 'newspaper',
    alwaysOn: true,
    domains: [
      'intranet', 'news', 'announcement', 'memo', 'spotlight', 'erg', 'culture',
      'leadership', 'town hall', 'all-hands', 'event', 'offsite', 'summit', 'wiki',
      'playbook', 'runbook', 'article', 'launch', 'release', 'ceo', 'cfo',
      'staffbase', 'campsite', 'post', 'channel', 'staffbase user', 'employee', 'colleague', 'teammate',
      'analytics', 'metrics', 'engagement', 'trends', 'trend', 'kpi', 'dashboard',
      'rankings', 'top posts', 'top channels', 'active users', 'engaged users',
      'visits', 'views', 'reach', 'pulse', 'chart',
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
  },
];

export function getConnector(id) {
  return CONNECTORS.find((c) => c.id === id) || null;
}

export function isWriteTool(connectorId, toolName) {
  const c = getConnector(connectorId);
  return Boolean(c?.writeTools?.includes(toolName));
}
