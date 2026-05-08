// Registry of MCP servers available to the Navigator Orchestrator.
// Each entry describes one server: its endpoint, domain tags, and auth type.
// The orchestrator uses domain tags to route intent to the right server(s).

export const MCP_REGISTRY = [
  {
    id: 'hr_portal',
    name: 'Acme HR Portal',
    description: 'Employee directory, PTO balances, org chart, HR policies, FAQs, holidays',
    endpoint: '/api/mcp',
    domains: [
      'hr', 'pto', 'employees', 'org', 'directory',
      'leave', 'time off', 'vacation', 'sick', 'parental', 'holiday',
      'benefits', 'health insurance', 'pension', '401k',
      'remote work', 'hybrid', 'travel', 'expenses',
      'performance', 'review', 'salary', 'bonus', 'promotion',
      'onboarding', 'probation',
      'learning', 'training', 'development',
      'conduct', 'harassment', 'ethics',
      'policy', 'policies', 'faq', 'people',
    ],
    color: '#7C3AED',
    icon: 'users',
    authType: 'bearer',
  },
  {
    id: 'it_helpdesk',
    name: 'IT Helpdesk',
    description: 'Tickets, equipment, software access, IT/Security policies',
    endpoint: '/api/mcp-it',
    domains: [
      'it', 'tickets', 'helpdesk', 'support',
      'equipment', 'hardware', 'laptop', 'monitor', 'phone',
      'software', 'license', 'access', 'app',
      'security', 'mfa', '2fa', 'password', 'yubikey',
      'vpn', 'tailscale', 'wireguard',
      'phishing', 'incident', 'breach',
      'byod', 'mobile', 'mdm',
      'ai tool', 'chatgpt', 'copilot', 'claude',
      'data classification', 'gdpr', 'privacy',
    ],
    color: '#2563EB',
    icon: 'monitor',
    authType: 'bearer',
  },
];
