/**
 * configStore v2 — single source of truth for the Navigator Studio + Employee prototypes.
 *
 * Persists to localStorage under one key. Both the Studio prototype (admin)
 * and the Employee prototype (chat) hydrate from the same blob, so changes
 * an admin makes in Studio show up immediately in Employee.
 *
 * Data model (v2):
 *   mcpConnectors    — MCP tool servers (Zendesk, ServiceNow, GitHub, ...)
 *   externalAgents   — full conversational agents (Gemini, Copilot Studio, ...)
 *   assistants       — user-facing personas with sub-agent links
 *                      (mcpConnectorIds + externalAgentIds + knowledge bases)
 *   knowledgeBases   — content sources an assistant can ground answers in
 *
 * v1 → v2: schema changed (split connectors into MCPs vs Agents). The hook
 * detects mismatched versions and falls back to the seed.
 */

export const STORAGE_KEY = 'staffbase.navigator.config'
export const CONFIG_VERSION = 4

// ─────────────────────────────────────────────────────────────────────────────
// Tenant — the workspace this Navigator instance is configured for.
// Roles and locations populate the Audience editor in Studio and gate
// what each demo user sees in the Employee chat.
// ─────────────────────────────────────────────────────────────────────────────

const SEED_TENANT = {
  name: 'Acme',
  brandColor: '#7C3AED',
  workspace: 'acme.staffbase.com',
  locations: ['Downtown', 'Airport Terminal', 'Westfield Mall', 'HQ'],
  roles: ['Branch Manager', 'Line Cook', 'Shift Supervisor', 'Cleaning Staff', 'Office Worker'],
}

const SEED_DEMO_USERS = [
  { email: 'alice@acme.com', name: 'Alice Chen',  role: 'Branch Manager',    location: 'Downtown',        avatar: 'AC', color: '#7C3AED',
    subtitle: 'I can pull up your shift checklist, check team attendance, and handle store management.' },
  { email: 'bob@acme.com',   name: 'Bob Smith',   role: 'Line Cook',         location: 'Airport Terminal', avatar: 'BS', color: '#D97706',
    subtitle: 'I can load your task list, look up food safety policies, and log equipment issues.' },
  { email: 'carol@acme.com', name: 'Carol Davis', role: 'Shift Supervisor',  location: 'Downtown',        avatar: 'CD', color: '#2563EB',
    subtitle: 'I can fetch your shift checklist, manage team assignments, and prepare handovers.' },
  { email: 'dave@acme.com',  name: 'Dave Wilson', role: 'Cleaning Staff',    location: 'Westfield Mall',  avatar: 'DW', color: '#059669',
    subtitle: 'I can load your task list, check cleaning protocols, and submit supply requests.' },
  { email: 'erin@acme.com',  name: 'Erin Patel',  role: 'Office Worker',     location: 'HQ',              avatar: 'EP', color: '#0EA5E9',
    subtitle: 'I can help with HR, IT, travel, expenses, and the company intranet from your desk at HQ.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Catalogs — read-only menus the admin picks from when adding a connector / agent
// ─────────────────────────────────────────────────────────────────────────────

// MCP catalog — the menu of generic enterprise apps an admin can bring online.
// Two entries (`acme_hr`, `acme_it`) represent the orchestrator backend's actual MCP
// servers (`/api/mcp`, `/api/mcp-it`); seeded connectors keep those ids verbatim
// so the orchestrator can route real tool calls. Other catalog entries are
// generic templates (mock tools only — no live backend).
export const MCP_CATALOG = [
  { id: 'acme_hr',       name: 'Acme HR Portal',  color: '#7C3AED', tagline: 'Employee directory · PTO · policies',     auth: 'SSO',              backend: '/api/mcp'           },
  { id: 'acme_it',       name: 'IT Helpdesk',     color: '#2563EB', tagline: 'Tickets · equipment · access',            auth: 'SSO',              backend: '/api/mcp-it'        },
  { id: 'acme_intranet', name: 'Acme Intranet',   color: '#0EA5E9', tagline: 'News · memos · team wikis · events',      auth: 'SSO',              backend: '/api/mcp-intranet'  },
  { id: 'zendesk',     name: 'Zendesk',         color: '#03363D', tagline: 'Support tickets · knowledge base',     auth: 'OAuth 2.0' },
  { id: 'servicenow',  name: 'ServiceNow',      color: '#62D84E', tagline: 'IT incidents · change requests',       auth: 'OAuth 2.0' },
  { id: 'workday',     name: 'Workday',         color: '#F38B00', tagline: 'HR records · time-off · payroll',      auth: 'Service account' },
  { id: 'github',      name: 'GitHub',          color: '#181717', tagline: 'Repos · issues · pull requests',       auth: 'GitHub App' },
  { id: 'jira',        name: 'Jira',            color: '#0052CC', tagline: 'Issues · sprints · projects',          auth: 'OAuth 2.0' },
  { id: 'confluence',  name: 'Confluence',      color: '#0052CC', tagline: 'Pages · spaces · search',              auth: 'OAuth 2.0' },
  { id: 'slack',       name: 'Slack',           color: '#4A154B', tagline: 'Channels · messages · search',         auth: 'OAuth 2.0' },
  { id: 'notion',      name: 'Notion',          color: '#000000', tagline: 'Pages · databases · search',           auth: 'OAuth 2.0' },
  { id: 'sharepoint',  name: 'SharePoint',      color: '#0078D4', tagline: 'Sites · documents · lists',            auth: 'Entra ID' },
  { id: 'salesforce',  name: 'Salesforce',      color: '#00A1E0', tagline: 'Accounts · opportunities · leads',     auth: 'OAuth 2.0' },
  { id: 'custom',      name: 'Custom MCP',      color: '#475569', tagline: 'Bring your own MCP endpoint',          auth: 'Configurable' },
]

// Agent catalog. `a2a` is the protocol the orchestrator's Store Ops Agent uses;
// keeping the catalogId means seeded agents can be matched back to the live A2A
// backend by `protocol === 'a2a'`.
export const AGENT_CATALOG = [
  { id: 'a2a',            name: 'Custom A2A Agent',          color: '#F59E0B', tagline: 'Google Agent-to-Agent protocol',            auth: 'Configurable',     protocol: 'a2a' },
  { id: 'gemini',         name: 'Google Gemini',             color: '#1A73E8', tagline: 'Vertex AI / Gemini agents',                  auth: 'Service account', protocol: 'native' },
  { id: 'copilot_studio', name: 'Microsoft Copilot Studio',  color: '#0078D4', tagline: 'Power Platform copilots',                   auth: 'Entra ID',         protocol: 'native' },
  { id: 'claude',         name: 'Anthropic Claude',          color: '#C15F3C', tagline: 'Claude API agents',                         auth: 'API key',          protocol: 'native' },
  { id: 'openai',         name: 'OpenAI Assistants',         color: '#10A37F', tagline: 'GPT-4 / GPT-5 assistants',                  auth: 'API key',          protocol: 'native' },
]

// Tool fixtures by catalog id — used to populate `tools[]` when a connector is added
const MCP_TOOLS_BY_CATALOG = {
  acme_hr: [
    { id: 'getEmployee',     name: 'getEmployee',     description: 'Look up employee profile by email or id' },
    { id: 'getDirectReports', name: 'getDirectReports', description: 'Manager → direct reports' },
    { id: 'getPtoBalance',   name: 'getPtoBalance',   description: 'Read PTO balance for an employee' },
    { id: 'requestPto',      name: 'requestPto',      description: 'Submit a PTO request' },
    { id: 'searchPolicies',  name: 'searchPolicies',  description: 'Semantic search across HR policies' },
  ],
  acme_it: [
    { id: 'listTickets',     name: 'listTickets',     description: 'Find current IT tickets for the user' },
    { id: 'getTicket',       name: 'getTicket',       description: 'Read full ticket details' },
    { id: 'createTicket',    name: 'createTicket',    description: 'Open a new IT support ticket' },
    { id: 'getEquipment',    name: 'getEquipment',    description: 'Equipment assigned to the user' },
    { id: 'requestSoftware', name: 'requestSoftware', description: 'Submit a software access request' },
  ],
  acme_intranet: [
    { id: 'searchArticles', name: 'searchArticles', description: 'Keyword search across intranet articles' },
    { id: 'getArticle',     name: 'getArticle',     description: 'Fetch the full body of an intranet article' },
    { id: 'listRecent',     name: 'listRecent',     description: 'List the most recent intranet articles by category' },
  ],
  zendesk: [
    { id: 'create_ticket',   name: 'create_ticket',   description: 'Open a new support ticket' },
    { id: 'search_kb',       name: 'search_kb',       description: 'Search Zendesk Help Center' },
    { id: 'get_ticket',      name: 'get_ticket',      description: 'Look up ticket status & history' },
    { id: 'add_comment',     name: 'add_comment',     description: 'Comment on an existing ticket' },
  ],
  servicenow: [
    { id: 'create_incident',     name: 'create_incident',     description: 'File an IT incident' },
    { id: 'get_incident_status', name: 'get_incident_status', description: 'Check incident progress' },
    { id: 'reset_password',      name: 'reset_password',      description: 'Reset a user password' },
    { id: 'request_access',      name: 'request_access',      description: 'Submit an access request' },
  ],
  workday: [
    { id: 'get_leave_balance', name: 'get_leave_balance', description: 'Read time-off balances' },
    { id: 'submit_leave',      name: 'submit_leave',      description: 'Submit a time-off request' },
    { id: 'get_payslip',       name: 'get_payslip',       description: 'Fetch the latest payslip' },
  ],
  github: [
    { id: 'list_repos',     name: 'list_repos',     description: 'List repositories' },
    { id: 'search_code',    name: 'search_code',    description: 'Search across code' },
    { id: 'create_issue',   name: 'create_issue',   description: 'File an issue' },
  ],
  jira: [
    { id: 'create_issue',  name: 'create_issue',  description: 'Create a Jira issue' },
    { id: 'search_issues', name: 'search_issues', description: 'JQL search' },
  ],
  confluence: [
    { id: 'search_pages', name: 'search_pages', description: 'Search Confluence pages' },
    { id: 'get_page',     name: 'get_page',     description: 'Read page contents' },
  ],
  slack: [
    { id: 'search_messages', name: 'search_messages', description: 'Search messages' },
    { id: 'post_message',    name: 'post_message',    description: 'Post to a channel' },
  ],
  notion: [
    { id: 'search', name: 'search', description: 'Search workspace' },
  ],
  sharepoint: [
    { id: 'search_documents', name: 'search_documents', description: 'Search SharePoint sites' },
  ],
  salesforce: [
    { id: 'query_records', name: 'query_records', description: 'SOQL query' },
  ],
  custom: [],
}

export function toolsForCatalogId(catalogId) {
  return (MCP_TOOLS_BY_CATALOG[catalogId] || []).map(t => ({ ...t }))
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP fixtures — "what's inside" stats and a canned Test-connector response.
// Purely cosmetic, keyed by catalogId. Lets Studio show admins a believable
// snapshot of each connector ("256 employees · 47 policies") rather than a
// bare endpoint URL. No network calls.
// ─────────────────────────────────────────────────────────────────────────────

export const MCP_FIXTURES = {
  acme_hr: {
    stats: [
      { label: 'Employees',  value: '256' },
      { label: 'Policies',   value: '47'  },
      { label: 'Last sync',  value: '3m ago' },
    ],
    sample: {
      tool: 'getPtoBalance',
      query: '{ "employee": "alice@acme.com" }',
      result: '{ "employee": "Alice Chen", "ptoBalance": 19, "used": 6, "accrual": 1.66 }',
    },
  },
  acme_it: {
    stats: [
      { label: 'Open tickets',   value: '38'   },
      { label: 'Resolved (Q)',   value: '1,243' },
      { label: 'SLA',            value: '89%'  },
    ],
    sample: {
      tool: 'listTickets',
      query: '{ "user": "alice@acme.com" }',
      result: '[ { "id": "INC-4821", "title": "Printer offline — Downtown", "priority": "medium", "status": "open" } ]',
    },
  },
  acme_intranet: {
    stats: [
      { label: 'Articles',  value: '18'      },
      { label: 'Categories', value: '6'       },
      { label: 'Last post', value: '12h ago' },
    ],
    sample: {
      tool: 'listRecent',
      query: '{ "category": "leadership", "limit": 3 }',
      result: '[ { "id": "art-q2-priorities", "title": "Q2 priorities — Sarah Chen, CEO", "category": "leadership", "publishedAt": "2 days ago" } ]',
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed — what a freshly-installed Navigator looks like
// ─────────────────────────────────────────────────────────────────────────────

// IMPORTANT: ids must equal the orchestrator backend's MCP server ids
// (`hr_portal`, `it_helpdesk`) for tool routing to work. The clean-slug
// catalogIds are just for icon/branding lookup.
const SEED_MCP_CONNECTORS = [
  {
    id: 'hr_portal',
    catalogId: 'acme_hr',
    name: 'Acme HR Portal',
    description: 'Employee directory · PTO · policies · org chart',
    endpoint: '/api/mcp',
    authMethod: 'SSO (demo)',
    status: 'connected',
    domains: ['hr', 'pto', 'employees', 'policies'],
    addedAt: 'Mar 1, 2026',
    tools: toolsForCatalogId('acme_hr'),
  },
  {
    id: 'it_helpdesk',
    catalogId: 'acme_it',
    name: 'IT Helpdesk',
    description: 'Tickets · equipment · software access',
    endpoint: '/api/mcp-it',
    authMethod: 'SSO (demo)',
    status: 'connected',
    domains: ['it', 'tickets', 'equipment', 'access'],
    addedAt: 'Mar 1, 2026',
    tools: toolsForCatalogId('acme_it'),
  },
  {
    id: 'intranet',
    catalogId: 'acme_intranet',
    name: 'Acme Intranet',
    description: 'Leadership memos · product updates · team wikis · events · ERG pages · spotlights',
    endpoint: '/api/mcp-intranet',
    authMethod: 'SSO (demo)',
    status: 'connected',
    domains: ['intranet', 'news', 'announcement', 'memo', 'spotlight', 'erg', 'leadership', 'wiki', 'event'],
    addedAt: 'May 10, 2026',
    tools: toolsForCatalogId('acme_intranet'),
  },
]

// `id: 'store_ops_agent'` is the orchestrator's literal A2A agent id.
// `protocol: 'a2a'` flips the orchestrator into A2A delegation mode.
const SEED_EXTERNAL_AGENTS = [
  {
    id: 'store_ops_agent',
    catalogId: 'a2a',
    name: 'Store Operations Agent',
    description: 'Role-aware shift checklists for Acme store locations (A2A)',
    endpoint: 'https://a2a.acme.internal/store-ops',
    authMethod: 'Configurable',
    status: 'connected',
    protocol: 'a2a',
    capabilities: ['shift', 'checklist', 'opening', 'closing', 'my tasks'],
    domains: ['shift', 'checklist', 'opening', 'closing', 'my tasks'],
    addedAt: 'Mar 5, 2026',
  },
]

const SEED_KNOWLEDGE_BASES = [
  { id: 'kb-hr',       name: 'HR Policies',       source: 'Confluence',  articleCount: 142 },
  { id: 'kb-it',       name: 'IT Wiki',           source: 'SharePoint',  articleCount: 318 },
  { id: 'kb-onboard',  name: 'Onboarding Guide',  source: 'Notion',      articleCount: 47  },
  { id: 'kb-travel',   name: 'Travel Policies',   source: 'Confluence',  articleCount: 23  },
  { id: 'kb-intranet', name: 'Acme Intranet',     source: 'Internal CMS', articleCount: 18 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Flows — admin-defined, goal-driven workflows the Navigator brain can invoke
// when an employee's intent matches. Workspace-wide for this prototype.
// `tools[]` entries are either `{ connectorId, toolId }` (an MCP tool) or a
// bare agentId string (the whole external agent).
// ─────────────────────────────────────────────────────────────────────────────

const SEED_FLOWS = [
  {
    id: 'flow-laptop',
    name: 'Laptop Request',
    trigger: 'Employee asks for a new laptop, new equipment, or mentions their computer is broken',
    goal: 'IT ticket submitted with laptop model, OS preference, and delivery address confirmed',
    tools: [
      { connectorId: 'it_helpdesk', toolId: 'createTicket' },
      { connectorId: 'it_helpdesk', toolId: 'getEquipment' },
    ],
    mode: 'suggested',
    instructions: 'Ask for role first to recommend the right laptop tier.',
    onComplete: null,
    status: 'active',
  },
  {
    id: 'flow-pto',
    name: 'Request Time Off',
    trigger: 'Employee wants to book leave, holiday, or PTO',
    goal: 'PTO request submitted with dates confirmed and balance verified',
    tools: [
      { connectorId: 'hr_portal', toolId: 'requestPto' },
      { connectorId: 'hr_portal', toolId: 'getPtoBalance' },
    ],
    mode: 'suggested',
    instructions: '',
    onComplete: null,
    status: 'active',
  },
  {
    id: 'flow-onboarding',
    name: 'New Joiner Onboarding',
    trigger: 'Employee just joined or says they are new, or asks what they need to do to get started',
    goal: 'New hire has HR profile reviewed, IT ticket filed for equipment, and core software access requested',
    tools: [
      { connectorId: 'hr_portal',   toolId: 'getEmployee' },
      { connectorId: 'it_helpdesk', toolId: 'createTicket' },
      { connectorId: 'it_helpdesk', toolId: 'requestSoftware' },
    ],
    mode: 'required',
    instructions: 'Check HR first to understand their role. Work through one step at a time.',
    onComplete: null,
    status: 'active',
  },
]

const SEED_ASSISTANTS = [
  {
    id: 'asst-hr',
    name: 'HR Assistant',
    icon: '👥',
    description: 'Leave, benefits, and HR policy questions.',
    instructions: 'You are an HR assistant. Use the Acme HR Portal MCP for PTO, employee data, and policy search. Ground answers in HR Policies.',
    mcpConnectorIds: ['hr_portal'],
    externalAgentIds: [],
    knowledgeBaseIds: ['kb-hr'],
    audience: { everyone: true, roles: [], locations: [] },
    status: 'active',
  },
  {
    id: 'asst-it',
    name: 'IT Support',
    icon: '💻',
    description: 'Devices, software, tickets, and access requests.',
    instructions: 'You are an IT support assistant. Use the IT Helpdesk MCP for tickets, equipment, and software access. Ground in IT Wiki.',
    mcpConnectorIds: ['it_helpdesk'],
    externalAgentIds: [],
    knowledgeBaseIds: ['kb-it'],
    audience: { everyone: true, roles: [], locations: [] },
    status: 'active',
  },
  {
    id: 'asst-shift',
    name: 'Shift & Store Ops',
    icon: '🏪',
    description: 'Role-aware shift checklists for store staff.',
    instructions: 'Hand off any shift / checklist / opening / closing / "my tasks" question to the Store Operations Agent (A2A).',
    mcpConnectorIds: [],
    externalAgentIds: ['store_ops_agent'],
    knowledgeBaseIds: [],
    audience: { everyone: false, roles: ['Branch Manager', 'Line Cook', 'Shift Supervisor', 'Cleaning Staff'], locations: [] },
    status: 'active',
  },
  {
    id: 'asst-onboarding',
    name: 'Onboarding',
    icon: '🚀',
    description: 'First 30 days — paperwork, intros, and IT setup.',
    instructions: 'Help new employees during their first 30 days. Use the Onboarding Guide.',
    mcpConnectorIds: [],
    externalAgentIds: [],
    knowledgeBaseIds: ['kb-onboard'],
    audience: { everyone: false, roles: ['Office Worker'], locations: [] },
    status: 'active',
  },
  {
    id: 'asst-travel',
    name: 'Travel & Expenses',
    icon: '✈️',
    description: 'Booking, policies, and expense reimbursement.',
    instructions: 'Help with travel booking and expenses. Ground in Travel Policies.',
    mcpConnectorIds: [],
    externalAgentIds: [],
    knowledgeBaseIds: ['kb-travel'],
    audience: { everyone: true, roles: [], locations: [] },
    status: 'active',
  },
  {
    id: 'asst-intranet',
    name: 'Company Intranet',
    icon: '📰',
    description: 'Leadership memos, product launches, team wikis, events, and employee spotlights.',
    instructions: 'You are the company intranet assistant. Use the Acme Intranet MCP (search_articles, get_article, list_recent) to answer questions about company news, leadership memos, product launches, team wikis, events, ERGs, and employee spotlights. Always ground answers in retrieved articles and cite them.',
    mcpConnectorIds: ['intranet'],
    externalAgentIds: [],
    knowledgeBaseIds: ['kb-intranet'],
    audience: { everyone: true, roles: [], locations: [] },
    status: 'active',
  },
]

export function buildSeedConfig() {
  return {
    version: CONFIG_VERSION,
    tenant: {
      ...SEED_TENANT,
      locations: [...SEED_TENANT.locations],
      roles: [...SEED_TENANT.roles],
    },
    demoUsers: SEED_DEMO_USERS.map(u => ({ ...u })),
    mcpConnectors: SEED_MCP_CONNECTORS.map(c => ({ ...c, tools: c.tools.map(t => ({ ...t })) })),
    externalAgents: SEED_EXTERNAL_AGENTS.map(a => ({ ...a, capabilities: [...a.capabilities] })),
    assistants: SEED_ASSISTANTS.map(a => ({
      ...a,
      mcpConnectorIds: [...a.mcpConnectorIds],
      externalAgentIds: [...a.externalAgentIds],
      knowledgeBaseIds: [...a.knowledgeBaseIds],
      audience: {
        everyone: a.audience?.everyone ?? true,
        roles: [...(a.audience?.roles || [])],
        locations: [...(a.audience?.locations || [])],
      },
    })),
    knowledgeBases: SEED_KNOWLEDGE_BASES.map(kb => ({ ...kb })),
    flows: SEED_FLOWS.map(f => ({
      ...f,
      tools: (f.tools || []).map(t => (typeof t === 'string' ? t : { ...t })),
    })),
  }
}

// Notable-word heuristic shared with the orchestrator. Mirrors the spirit of
// `planRoute()` — strip punctuation, drop stop-words, keep tokens > 4 chars,
// match any of them against the inbound text. Cheap and good enough for a demo.
const FLOW_STOPWORDS = new Set([
  'employee','employees','asks','wants','says','their','they','the','and','for',
  'that','this','about','have','with','what','when','to','on','of','in','a','an',
  'or','is','are','be','do','need','needs','help','want','wants','start','starts',
  'mentions','mention','their','them','from','just','some',
])

export function notableWordsFromTrigger(trigger = '') {
  return Array.from(new Set(
    String(trigger)
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !FLOW_STOPWORDS.has(w))
  ))
}

export function flowMatchesText(text, flow) {
  if (!text || !flow) return false
  const t = String(text).toLowerCase()
  const words = notableWordsFromTrigger(flow.trigger || '')
  return words.some((w) => t.includes(w))
}

// v3 → v4: graft `flows` onto a v3 config. Seed defaults if missing so existing
// workspaces get the demo flows without losing their other customizations.
function migrateV3toV4(parsed) {
  if (!parsed || parsed.version !== 3) return null
  const seed = buildSeedConfig()
  return {
    ...parsed,
    version: CONFIG_VERSION,
    flows: parsed.flows || seed.flows,
  }
}

// v2 → v3: drop `targetGroups`, add `audience` defaulting to {everyone:true},
// and graft on `tenant` + `demoUsers` so the rest of the app can rely on them.
// Anyone who customized assistants in v2 keeps their connector/agent/KB links;
// they just need to re-pick audience explicitly to scope below "everyone".
function migrateV2toV3(parsed) {
  if (!parsed || parsed.version !== 2) return null
  const seed = buildSeedConfig()
  return {
    version: 3,
    tenant: parsed.tenant || seed.tenant,
    demoUsers: parsed.demoUsers || seed.demoUsers,
    mcpConnectors: parsed.mcpConnectors || seed.mcpConnectors,
    externalAgents: parsed.externalAgents || seed.externalAgents,
    knowledgeBases: parsed.knowledgeBases || seed.knowledgeBases,
    assistants: (parsed.assistants || []).map(a => {
      const { targetGroups, ...rest } = a
      return {
        ...rest,
        audience: a.audience || { everyone: true, roles: [], locations: [] },
      }
    }),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadConfig() {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed) return null
    if (parsed.version === CONFIG_VERSION) return parsed
    let working = parsed
    if (working.version === 2) {
      const v3 = migrateV2toV3(working)
      if (v3) working = v3
    }
    if (working.version === 3) {
      const v4 = migrateV3toV4(working)
      if (v4) working = v4
    }
    if (working.version === CONFIG_VERSION) {
      saveConfig(working)
      return working
    }
    return null
  } catch (err) {
    console.warn('[configStore] load failed, falling back to seed:', err)
    return null
  }
}

export function saveConfig(config) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, version: CONFIG_VERSION }))
  } catch (err) {
    console.warn('[configStore] save failed:', err)
  }
}

export function clearConfig() {
  if (!isBrowser()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived selectors — used by the chat to translate config → ChatWidget props
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ChatWidget gates scenarios via `enabledActions`. An external agent is
 * "available" when it's connected AND at least one assistant references it.
 * (If no assistant uses the agent, the chat shouldn't pretend it's there.)
 */
export function deriveEnabledActions(config) {
  if (!config) return []
  const assistantAgentIds = new Set(
    (config.assistants || [])
      .filter(a => a.status === 'active')
      .flatMap(a => a.externalAgentIds || [])
  )
  return (config.externalAgents || [])
    .filter(a => a.status === 'connected' && assistantAgentIds.has(a.id) && a.chatActionId)
    .map(a => a.chatActionId)
}

/**
 * Find which assistant routes a given chat scenario — used to decorate the
 * employee chat with provenance ("answered by HR Assistant via HR Workday Agent").
 */
export function findAssistantForExternalAgent(config, externalAgentId) {
  if (!config) return null
  return (config.assistants || []).find(a =>
    a.status === 'active' && (a.externalAgentIds || []).includes(externalAgentId)
  ) || null
}

/**
 * The orchestrator's view of the world — only MCPs and agents that are
 * (a) connected and (b) referenced by at least one active assistant.
 *
 * This is the single source of truth that drives the orchestrator's REGISTRY
 * and A2A_AGENTS lists at runtime. Disconnect a connector OR drop its sub-agent
 * link from every assistant → it disappears from the employee chat.
 */
export function deriveLiveOrchestrator(config) {
  if (!config) return { mcps: [], agents: [], assistants: [] }
  const activeAssistants = (config.assistants || []).filter(a => a.status === 'active')
  const referencedMcps = new Set(activeAssistants.flatMap(a => a.mcpConnectorIds || []))
  const referencedAgents = new Set(activeAssistants.flatMap(a => a.externalAgentIds || []))
  return {
    mcps: (config.mcpConnectors || []).filter(c =>
      c.status === 'connected' && referencedMcps.has(c.id)
    ),
    agents: (config.externalAgents || []).filter(a =>
      a.status === 'connected' && referencedAgents.has(a.id)
    ),
    assistants: activeAssistants,
  }
}

/**
 * Audience check — does this assistant reach this user?
 * `everyone: true` short-circuits true. Otherwise the user matches if their
 * role is in `roles` OR their location is in `locations`. Empty arrays in both
 * fall back to true so an admin who flips "everyone" off without picking anything
 * doesn't lock everyone out by mistake.
 */
export function assistantVisibleTo(assistant, user) {
  if (!assistant) return false
  const aud = assistant.audience || { everyone: true }
  if (aud.everyone) return true
  if (!user) return false
  const roles = aud.roles || []
  const locations = aud.locations || []
  if (roles.length === 0 && locations.length === 0) return true
  const matchRole = roles.length > 0 && user.role && roles.includes(user.role)
  const matchLoc = locations.length > 0 && user.location && locations.includes(user.location)
  return matchRole || matchLoc
}

/**
 * Same as `deriveLiveOrchestrator`, but first filters active assistants down
 * to those whose audience includes `user`. Used by the Employee chat to scope
 * the live registry per logged-in user, and by Studio's "View as" preview.
 *
 * If `user` is null, behaves identically to `deriveLiveOrchestrator` (anonymous
 * = see workspace-wide capability, useful for pre-login banners).
 */
export function deriveLiveOrchestratorFor(config, user) {
  if (!config) return { mcps: [], agents: [], assistants: [] }
  if (!user) return deriveLiveOrchestrator(config)
  const visibleAssistants = (config.assistants || []).filter(
    a => a.status === 'active' && assistantVisibleTo(a, user)
  )
  const referencedMcps = new Set(visibleAssistants.flatMap(a => a.mcpConnectorIds || []))
  const referencedAgents = new Set(visibleAssistants.flatMap(a => a.externalAgentIds || []))
  return {
    mcps: (config.mcpConnectors || []).filter(c =>
      c.status === 'connected' && referencedMcps.has(c.id)
    ),
    agents: (config.externalAgents || []).filter(a =>
      a.status === 'connected' && referencedAgents.has(a.id)
    ),
    assistants: visibleAssistants,
  }
}
