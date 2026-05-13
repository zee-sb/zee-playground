// Canonical Navigator seed — the "known-good" state Reset always restores.
//
// Source of truth for both client and server. Keep this module ESM and
// dependency-free so Vercel functions and Vite-bundled client can import it.
//
// Unified Connector model (v6):
//   - Every "thing the chat can call" is a Connector.
//   - `kind: 'mcp'`   — multi-tool MCP server (HR, IT, Atlassian, Intranet).
//   - `kind: 'agent'` — A2A agent. One implicit tool `invoke` exposed via
//                        the `tasks/send` JSON-RPC method.
//   - `kind: 'kb'`    — knowledge base. One implicit tool `search` over an
//                        indexed corpus (lib/mcp-servers/kb.mjs).
//
// What's in the seed:
//   - 4 MCP connectors (HR, IT, Intranet RAG, Atlassian)
//   - 1 A2A agent (Staffbase Onboarding)
//   - 5 knowledge bases with REAL content (data/kb-documents.mjs)
//   - 4 flows that reference connectors directly
//   - 6 active assistants — each wired to ≥1 connector

export const TENANT_OVERRIDES = {
  name: 'Staffbase',
  brandColor: '#00C7B2',
  workspaceUrl: 'campsite.staffbase.com',
};

// Connector list. Order matters — Studio renders this order in the
// Connectors tab and the chat's tool catalog mirrors it.
export const CONNECTORS = [
  // ── MCPs ─────────────────────────────────────────────────────────────────
  {
    id: 'hr_portal',
    kind: 'mcp',
    catalogId: 'staffbase_hr',
    name: 'Staffbase HR',
    description: 'Employee directory · PTO · policies · org chart',
    endpoint: '/api/mcp',
    authMethod: 'SSO (demo)',
    status: 'connected',
    domains: ['hr', 'pto', 'employees', 'policies', 'benefits', 'leave', 'holiday'],
    writeTools: ['requestPto'],
    addedAt: 'Mar 1, 2026',
    tools: [
      { id: 'getEmployee',     name: 'getEmployee',     description: 'Look up employee profile by email or id' },
      { id: 'getDirectReports', name: 'getDirectReports', description: 'Manager → direct reports' },
      { id: 'getPtoBalance',   name: 'getPtoBalance',   description: 'Read PTO balance for an employee' },
      { id: 'requestPto',      name: 'requestPto',      description: 'Submit a PTO request' },
      { id: 'searchPolicies',  name: 'searchPolicies',  description: 'Semantic search across HR policies' },
    ],
  },
  {
    id: 'it_helpdesk',
    kind: 'mcp',
    catalogId: 'staffbase_it',
    name: 'Staffbase IT Helpdesk',
    description: 'Tickets · equipment · software access',
    endpoint: '/api/mcp-it',
    authMethod: 'SSO (demo)',
    status: 'connected',
    domains: ['it', 'tickets', 'equipment', 'access', 'laptop', 'software', 'vpn'],
    writeTools: ['createTicket', 'requestSoftware'],
    addedAt: 'Mar 1, 2026',
    tools: [
      { id: 'listTickets',     name: 'listTickets',     description: 'Find current IT tickets for the user' },
      { id: 'getTicket',       name: 'getTicket',       description: 'Read full ticket details' },
      { id: 'createTicket',    name: 'createTicket',    description: 'Open a new IT support ticket' },
      { id: 'getEquipment',    name: 'getEquipment',    description: 'Equipment assigned to the user' },
      { id: 'requestSoftware', name: 'requestSoftware', description: 'Submit a software access request' },
    ],
  },
  {
    id: 'intranet',
    kind: 'mcp',
    catalogId: 'staffbase_intranet',
    name: 'Staffbase Intranet',
    description: 'Live Campsite — posts, channels, pages, and the real employee directory (find_user, get_user_profile).',
    endpoint: '/api/mcp-staffbase',
    authMethod: 'SSO (demo)',
    status: 'connected',
    domains: [
      'intranet', 'campsite', 'news', 'announcement', 'memo', 'spotlight',
      'leadership', 'wiki', 'event',
      // People surface lives here — the live Staffbase user directory.
      'employee', 'colleague', 'teammate', 'people', 'directory', 'org', 'manager',
    ],
    writeTools: [],
    addedAt: 'May 10, 2026',
    tools: [
      { id: 'find_user',         name: 'find_user',         description: 'Search Staffbase teammates by name, email, title, department, or role. Returns profile cards.' },
      { id: 'get_user_profile',  name: 'get_user_profile',  description: 'Fetch the full profile for one Staffbase user by id.' },
      { id: 'search_posts',      name: 'search_posts',      description: 'Search posts across the Campsite intranet (newest-first).' },
      { id: 'get_post',          name: 'get_post',          description: 'Fetch the full body of a Campsite post by id.' },
      { id: 'list_recent_posts', name: 'list_recent_posts', description: 'List the most recent Campsite posts.' },
      { id: 'list_channels',     name: 'list_channels',     description: 'List Campsite channels with post counts.' },
      { id: 'list_pages',        name: 'list_pages',        description: 'List Campsite reference pages (policies, hubs, handbooks).' },
      { id: 'list_groups',       name: 'list_groups',       description: 'List Staffbase groups (departments, ERGs, opt-in programs).' },
    ],
  },
  {
    id: 'atlassian',
    kind: 'mcp',
    catalogId: 'atlassian',
    name: 'Atlassian (Confluence + Jira)',
    description: 'Confluence pages, spaces, wikis · Jira issues, sprints, epics. Per-user OAuth — each employee links their own Atlassian site.',
    endpoint: '/api/mcp-atlassian',
    provider: 'atlassian',
    needsUserContext: true,
    authMethod: 'OAuth 2.0 (per user)',
    status: 'connected',
    domains: ['confluence', 'page', 'space', 'wiki', 'doc', 'jira', 'issue', 'sprint', 'backlog', 'epic', 'rfc', 'spec'],
    writeTools: ['create_page', 'update_page', 'add_page_comment', 'add_issue_comment', 'create_issue'],
    addedAt: 'May 13, 2026',
    tools: [
      { id: 'list_spaces',         name: 'list_spaces',         description: 'List Confluence spaces' },
      { id: 'search_pages',        name: 'search_pages',        description: 'Search Confluence pages' },
      { id: 'get_page',            name: 'get_page',            description: 'Read Confluence page content' },
      { id: 'create_page',         name: 'create_page',         description: 'Create a Confluence page (write)' },
      { id: 'update_page',         name: 'update_page',         description: 'Update a Confluence page (write)' },
      { id: 'add_page_comment',    name: 'add_page_comment',    description: 'Comment on a Confluence page (write)' },
      { id: 'list_projects',       name: 'list_projects',       description: 'List Jira projects' },
      { id: 'search_issues',       name: 'search_issues',       description: 'JQL search across Jira issues' },
      { id: 'get_issue',           name: 'get_issue',           description: 'Read a Jira issue' },
      { id: 'add_issue_comment',   name: 'add_issue_comment',   description: 'Comment on a Jira issue (write)' },
      { id: 'create_issue',        name: 'create_issue',        description: 'Create a Jira issue (write)' },
    ],
  },

  // ── A2A Agents ────────────────────────────────────────────────────────────
  {
    id: 'staffbase_onboarding_agent',
    kind: 'agent',
    catalogId: 'a2a',
    name: 'Staffbase Onboarding Agent',
    description: "Stage-aware onboarding checklist (Day One / First Week / First Month) over Google's Agent-to-Agent protocol.",
    endpoint: '/api/a2a',
    authMethod: 'Bearer (session token)',
    status: 'connected',
    protocol: 'a2a',
    capabilities: ['onboarding', 'new hire', 'day one', 'first week', 'first month', 'macbook', 'benefits enrollment'],
    domains: ['onboarding', 'new hire', 'day one', 'first week', 'first month', 'macbook', 'welcome', 'benefits enrollment'],
    writeTools: [],
    addedAt: 'May 13, 2026',
    // Agents expose exactly one synthetic tool: invoke. The orchestrator
    // dispatches via JSON-RPC tasks/send instead of tools/call.
    tools: [
      { id: 'invoke', name: 'invoke', description: 'Hand off the request to this agent. Pass a natural-language message; the agent decides how to act on it.' },
    ],
  },

  // ── Knowledge Bases ───────────────────────────────────────────────────────
  // Each KB is a single-tool MCP server backed by a real corpus
  // (data/kb-documents.mjs). The orchestrator only sees `kb_id__search` as
  // a callable tool — corpus content is retrieved at call time.
  {
    id: 'kb-hr',
    kind: 'kb',
    catalogId: 'kb_confluence',
    name: 'HR Policies',
    description: 'Benefits, leave, conduct, performance — the canonical HR handbook.',
    endpoint: '/api/mcp-kb?kbId=kb-hr',
    authMethod: 'SSO (demo)',
    status: 'connected',
    source: 'Confluence',
    domains: ['hr', 'policy', 'benefits', 'leave', 'pto', 'parental', 'conduct', 'performance', 'review'],
    writeTools: [],
    articleCount: 8,
    addedAt: 'Mar 1, 2026',
    tools: [
      { id: 'search', name: 'search', description: 'Search HR policy documents.' },
    ],
  },
  {
    id: 'kb-it',
    kind: 'kb',
    catalogId: 'kb_sharepoint',
    name: 'IT Wiki',
    description: 'Security, software, equipment, network access policies.',
    endpoint: '/api/mcp-kb?kbId=kb-it',
    authMethod: 'SSO (demo)',
    status: 'connected',
    source: 'SharePoint',
    domains: ['it', 'security', 'vpn', 'mfa', 'software', 'equipment', 'phishing', 'mdm'],
    writeTools: [],
    articleCount: 8,
    addedAt: 'Mar 1, 2026',
    tools: [
      { id: 'search', name: 'search', description: 'Search IT wiki articles.' },
    ],
  },
  {
    id: 'kb-onboard',
    kind: 'kb',
    catalogId: 'kb_notion',
    name: 'Onboarding Guide',
    description: 'New-hire playbook, day one checklist, manager intros, buddy program.',
    endpoint: '/api/mcp-kb?kbId=kb-onboard',
    authMethod: 'SSO (demo)',
    status: 'connected',
    source: 'Notion',
    domains: ['onboarding', 'new hire', 'first day', 'day one', 'buddy', 'manager'],
    writeTools: [],
    articleCount: 6,
    addedAt: 'Mar 1, 2026',
    tools: [
      { id: 'search', name: 'search', description: 'Search onboarding guide articles.' },
    ],
  },
  {
    id: 'kb-travel',
    kind: 'kb',
    catalogId: 'kb_confluence',
    name: 'Travel Policies',
    description: 'Travel booking rules, per-diem, reimbursable expenses, approval flow.',
    endpoint: '/api/mcp-kb?kbId=kb-travel',
    authMethod: 'SSO (demo)',
    status: 'connected',
    source: 'Confluence',
    domains: ['travel', 'expense', 'per diem', 'reimbursement', 'flight', 'hotel'],
    writeTools: [],
    articleCount: 5,
    addedAt: 'Mar 1, 2026',
    tools: [
      { id: 'search', name: 'search', description: 'Search travel policy documents.' },
    ],
  },
  {
    id: 'kb-intranet',
    kind: 'kb',
    catalogId: 'kb_internal',
    name: 'Campsite Articles',
    description: 'Curated leadership memos, town halls, and company-update articles.',
    endpoint: '/api/mcp-kb?kbId=kb-intranet',
    authMethod: 'SSO (demo)',
    status: 'connected',
    source: 'Internal CMS',
    domains: ['intranet', 'memo', 'leadership', 'town hall', 'company update'],
    writeTools: [],
    articleCount: 6,
    addedAt: 'May 10, 2026',
    tools: [
      { id: 'search', name: 'search', description: 'Search Campsite articles.' },
    ],
  },
];

// Flows reference connectors directly. Each tool entry is `{ connectorId,
// toolId }`. For agents/KBs, toolId is the implicit `invoke` / `search`.
export const FLOWS = [
  {
    id: 'flow-laptop',
    name: 'Laptop Request',
    trigger: 'Employee asks for a new laptop, equipment, broken computer, replacement',
    goal: 'IT ticket submitted with laptop model, OS preference, and delivery address confirmed',
    tools: [
      { connectorId: 'it_helpdesk', toolId: 'getEquipment' },
      { connectorId: 'it_helpdesk', toolId: 'createTicket' },
    ],
    mode: 'suggested',
    instructions: 'Look up current equipment first, then ask role to recommend the right laptop tier before opening the ticket.',
    onComplete: null,
    status: 'active',
  },
  {
    id: 'flow-pto',
    name: 'Request Time Off',
    trigger: 'Employee wants to book leave, holiday, vacation, or PTO',
    goal: 'PTO request submitted with dates confirmed and balance verified',
    tools: [
      { connectorId: 'hr_portal', toolId: 'getPtoBalance' },
      { connectorId: 'hr_portal', toolId: 'requestPto' },
      { connectorId: 'kb-hr',     toolId: 'search' },
    ],
    mode: 'suggested',
    instructions: 'Check balance, search the HR policy KB for any blackout dates or notice rules, then confirm dates back to the user before submitting.',
    onComplete: null,
    status: 'active',
  },
  {
    id: 'flow-onboarding',
    name: 'New Joiner Onboarding',
    trigger: 'Employee just joined, says they are new, asks what to do to get started, day one, first week',
    goal: 'New hire has HR profile reviewed, IT ticket filed for equipment, and core software access requested',
    tools: [
      { connectorId: 'hr_portal',                  toolId: 'getEmployee' },
      { connectorId: 'it_helpdesk',                toolId: 'createTicket' },
      { connectorId: 'it_helpdesk',                toolId: 'requestSoftware' },
      { connectorId: 'staffbase_onboarding_agent', toolId: 'invoke' },
      { connectorId: 'kb-onboard',                 toolId: 'search' },
    ],
    mode: 'required',
    instructions: 'Check HR first to understand the role. Hand off to the Onboarding Agent for the stage-aware checklist. Use the Onboarding KB for "how do we do X" questions. Work through one step at a time.',
    onComplete: null,
    status: 'active',
  },
  {
    id: 'flow-policy-lookup',
    name: 'Policy Lookup',
    trigger: 'Employee asks about a policy, handbook, benefit, leave rules, what we allow',
    goal: 'Answer the question with the relevant policy text and a citation to the source document',
    tools: [
      { connectorId: 'kb-hr',     toolId: 'search' },
      { connectorId: 'kb-it',     toolId: 'search' },
      { connectorId: 'intranet',  toolId: 'searchArticles' },
    ],
    mode: 'suggested',
    instructions: 'Search the HR and IT knowledge bases first; fall back to intranet articles. Cite the exact document title in the answer.',
    onComplete: null,
    status: 'active',
  },
];

// Assistants reference one unified `connectorIds[]`. The orchestrator
// builds the Tier-2 tool catalog by walking that list and picking up
// each connector's tools (filtered by status + user OAuth).
export const ASSISTANTS = [
  {
    name: 'HR Assistant',
    icon: '👥',
    description: 'Leave, benefits, and HR policy questions.',
    instructions: 'You are the Staffbase HR assistant. Use the HR MCP for live PTO, employee data, and policy operations. Use the HR Policies knowledge base to ground answers in the canonical handbook — always cite the document title.',
    connectorIds: ['hr_portal', 'kb-hr'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
  {
    name: 'IT Support',
    icon: '💻',
    description: 'Devices, software, tickets, and access requests.',
    instructions: 'You are the Staffbase IT support assistant. Use the IT Helpdesk MCP for ticket and equipment operations. Use the IT Wiki knowledge base for security, software, and equipment policy lookups.',
    connectorIds: ['it_helpdesk', 'kb-it'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
  {
    name: 'Onboarding',
    icon: '🚀',
    description: 'First 30 days — paperwork, intros, MacBook pickup, benefits enrollment.',
    instructions: 'Help new Staffbase employees during their first 30 days. For "Day One / First Week / First Month / MacBook / onboarding checklist" questions, hand off to the Staffbase Onboarding Agent (call its invoke tool with a natural-language message). For general how-do-I-do-X-at-Staffbase questions, search the Onboarding Guide KB.',
    connectorIds: ['hr_portal', 'it_helpdesk', 'staffbase_onboarding_agent', 'kb-onboard'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
  {
    name: 'Travel & Expenses',
    icon: '✈️',
    description: 'Booking, policies, and expense reimbursement.',
    instructions: 'Help with travel booking, expense reimbursement, and per-diem questions. Ground every answer in the Travel Policies knowledge base and cite the exact document title.',
    connectorIds: ['kb-travel'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
  {
    name: 'Campsite Assistant',
    icon: '📰',
    description: 'Posts, channels, leadership memos, product launches, team updates, and the live employee directory from Campsite.',
    instructions: [
      'You are the Campsite Intranet assistant for Staffbase.',
      '',
      'CONTENT — Use the Staffbase Intranet MCP (search_posts, get_post, list_recent_posts, list_channels, list_pages) for live posts and reference pages. Use the Campsite Articles KB for curated leadership memos. Always cite the post or page title.',
      '',
      'PEOPLE — All "who is X" / "find a teammate" / "find someone in [team]" / "who reports to Y" questions are yours. Call find_user with the natural-language query. The UI renders the result as a profile-card carousel automatically — do NOT enumerate each person\'s title/department in prose. Lead with one short sentence ("Here are the matches for \\"Martin\\":") and let the cards speak.',
      '',
      '- If multiple matches come back, show them all and let the user pick.',
      '- If one match is clearly the answer, name them in a single sentence.',
      '- For a specific user (after find_user surfaces an id, or the user names a specific person), call get_user_profile.',
      '- Never invent people. If find_user returns zero matches, say so and suggest a broader spelling.',
    ].join('\n'),
    connectorIds: ['intranet', 'kb-intranet'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
  {
    name: 'Project Workspace',
    icon: '🛠',
    description: 'Confluence pages, Jira issues, sprints, RFCs. Available when Atlassian is connected.',
    instructions: 'Help employees find docs in Confluence and work items in Jira. Always include URLs to the source. When listing or searching, prefer the most recently updated items first.',
    connectorIds: ['atlassian'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
];

// Build the full client-side seed config shape that useConfigStore expects.
// `version`, `tenant`, `demoUsers` are local-only; everything else is
// round-tripped to the DB.
export function buildSeedClientConfig({ tenantGroups = [] } = {}) {
  return {
    version: 6,
    tenant: {
      name: TENANT_OVERRIDES.name,
      brandColor: TENANT_OVERRIDES.brandColor,
      workspace: TENANT_OVERRIDES.workspaceUrl,
      groups: tenantGroups,
    },
    connectors: CONNECTORS.map((c) => deepClone(c)),
    flows: FLOWS.map((f) => ({ ...f, tools: f.tools.map((t) => ({ ...t })) })),
    assistants: ASSISTANTS.map((a, i) => ({
      id: `asst-seed-${i + 1}`,
      ...a,
      connectorIds: [...a.connectorIds],
      audience: cloneAudience(a.audience),
    })),
  };
}

// Server-side: the slice persisted to navigator_config.
export function buildSeedConfigPayload() {
  return {
    connectors: CONNECTORS.map((c) => deepClone(c)),
    flows: FLOWS.map((f) => ({ ...f, tools: f.tools.map((t) => ({ ...t })) })),
    tenantOverrides: { ...TENANT_OVERRIDES },
  };
}

// Server-side: assistant rows to insert (shape lib/blueprints.mjs#createAssistant expects).
export function buildSeedAssistants() {
  return ASSISTANTS.map((a) => ({
    ...a,
    connectorIds: [...a.connectorIds],
    audience: cloneAudience(a.audience),
  }));
}

function deepClone(c) {
  return {
    ...c,
    domains: [...(c.domains || [])],
    capabilities: [...(c.capabilities || [])],
    writeTools: [...(c.writeTools || [])],
    tools: (c.tools || []).map((t) => ({ ...t })),
  };
}

function cloneAudience(a) {
  return {
    everyone: a?.everyone ?? true,
    groups: [...(a?.groups || [])],
    roles: [...(a?.roles || [])],
    locations: [...(a?.locations || [])],
  };
}
