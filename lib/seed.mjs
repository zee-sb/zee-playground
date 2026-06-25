// Canonical Navigator seed — the "known-good" state Reset always restores.
//
// Source of truth for both client and server. Keep this module ESM and
// dependency-free so Vercel functions and Vite-bundled client can import it.
//
// Unified Connection model (v8 — Simplification):
//   - Every "thing the chat can call" is a Connection.
//   - `kind: 'toolkit'` — multi-tool MCP server (HR, IT, Atlassian, Intranet).
//   - `kind: 'handoff'` — A2A agent. One implicit tool `invoke` exposed via
//                         the `tasks/send` JSON-RPC method.
//   - `kind: 'search'`  — search source. One implicit tool `search` over an
//                         indexed corpus (lib/mcp-servers/kb.mjs).
//
// What's in the seed:
//   - 4 Toolkit connections (HR, IT, Intranet RAG, Atlassian)
//   - 1 Handoff connection (Staffbase Onboarding agent)
//   - 5 Search source connections with REAL content (data/kb-documents.mjs)
//   - 4 Workflows that reference connections directly
//   - 6 active Experts — each wired to ≥1 connection

// Bump this whenever the seed (connections / workflows / experts) changes in
// a way the server must re-pick up. The client compares against
// CONFIG_VERSION in configStore.js and auto-reseeds when the server's value
// is older — so prod doesn't keep stale flow definitions after a deploy.
export const SEED_VERSION = 12;

export const TENANT_OVERRIDES = {
  name: 'Staffbase',
  brandColor: '#00C7B2',
  workspaceUrl: 'campsite.staffbase.com',
};

// Connection list. Order matters — Studio renders this order in the
// Connections tab and the chat's tool catalog mirrors it.
export const CONNECTIONS = [
  // ── Toolkits (multi-tool MCP servers) ────────────────────────────────────
  {
    id: 'hr_portal',
    kind: 'toolkit',
    catalogId: 'staffbase_hr',
    name: 'Staffbase HR',
    description: 'Employee directory · PTO · policies · org chart',
    endpoint: '/api/mcp',
    authMethod: 'SSO (demo)',
    status: 'connected',
    domains: ['hr', 'pto', 'employees', 'policies', 'benefits', 'leave', 'holiday'],
    writeTools: ['submit_time_off_request'],
    addedAt: 'Mar 1, 2026',
    tools: [
      { id: 'lookup_employee',         name: 'lookup_employee',         description: 'Look up employee profile by email or id' },
      { id: 'get_direct_reports',      name: 'get_direct_reports',      description: 'Manager → direct reports' },
      { id: 'check_pto_balance',       name: 'check_pto_balance',       description: 'Read PTO balance for an employee' },
      { id: 'submit_time_off_request', name: 'submit_time_off_request', description: 'Submit a PTO request' },
      { id: 'search_policies',         name: 'search_policies',         description: 'Semantic search across HR policies' },
    ],
  },
  {
    id: 'it_helpdesk',
    kind: 'toolkit',
    catalogId: 'staffbase_it',
    name: 'Staffbase IT Helpdesk',
    description: 'Tickets · equipment · software access',
    endpoint: '/api/mcp-it',
    authMethod: 'SSO (demo)',
    status: 'connected',
    domains: ['it', 'tickets', 'equipment', 'access', 'laptop', 'software', 'vpn'],
    writeTools: ['create_ticket', 'request_software_access'],
    addedAt: 'Mar 1, 2026',
    tools: [
      { id: 'list_my_tickets',         name: 'list_my_tickets',         description: 'Find current IT tickets for the user' },
      { id: 'get_ticket',              name: 'get_ticket',              description: 'Read full ticket details' },
      { id: 'create_ticket',           name: 'create_ticket',           description: 'Open a new IT support ticket' },
      { id: 'lookup_equipment',        name: 'lookup_equipment',        description: 'Equipment assigned to the user' },
      { id: 'request_software_access', name: 'request_software_access', description: 'Submit a software access request' },
    ],
  },
  {
    id: 'intranet',
    kind: 'toolkit',
    catalogId: 'staffbase_intranet',
    name: 'Staffbase Intranet',
    description: 'Live Campsite — posts, channels, pages, and the real employee directory (find_user, get_user_profile).',
    endpoint: '/api/mcp-staffbase',
    authMethod: 'SSO (demo)',
    status: 'connected',
    // People-related domains FIRST because the tier1 router only sees the
    // top-N domains of each connection when scoring which expert to pick.
    // Burying "people" / "directory" / "colleague" behind nine intranet terms
    // means terse queries like "Who is Martin?" never reach the Campsite
    // Expert and fall through to general_chat.
    domains: [
      'people', 'directory', 'employee', 'colleague', 'teammate', 'manager', 'org',
      'intranet', 'campsite', 'news', 'announcement', 'memo', 'spotlight',
      'leadership', 'wiki', 'event',
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
    kind: 'toolkit',
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

  {
    id: 'servicenow',
    kind: 'toolkit',
    catalogId: 'servicenow',
    name: 'ServiceNow',
    description: 'ServiceNow ITSM — search the knowledge base and view, create & update incidents. Per-user OAuth — each employee links their own ServiceNow account; ServiceNow enforces their roles/ACLs.',
    endpoint: '/api/mcp-servicenow',
    provider: 'servicenow',
    needsUserContext: true,
    authMethod: 'OAuth 2.0 (per user)',
    status: 'connected',
    domains: ['servicenow', 'service now', 'itsm', 'incident', 'ticket', 'knowledge base', 'kb article', 'change record', 'it request', 'outage'],
    writeTools: ['servicenow_create_incident', 'servicenow_update_incident', 'servicenow_add_comment'],
    addedAt: 'Jun 25, 2026',
    tools: [
      { id: 'servicenow_search_kb',       name: 'servicenow_search_kb',       description: 'Search the ServiceNow knowledge base' },
      { id: 'servicenow_list_incidents',  name: 'servicenow_list_incidents',  description: 'List the user\'s incidents' },
      { id: 'servicenow_get_incident',    name: 'servicenow_get_incident',    description: 'Read one incident by number or sys_id' },
      { id: 'servicenow_create_incident', name: 'servicenow_create_incident', description: 'Create an incident (write)' },
      { id: 'servicenow_update_incident', name: 'servicenow_update_incident', description: 'Update an incident (write)' },
      { id: 'servicenow_add_comment',     name: 'servicenow_add_comment',     description: 'Add a comment / work note to an incident (write)' },
    ],
  },

  {
    id: 'staffbase_voices',
    kind: 'toolkit',
    catalogId: 'staffbase_voices',
    name: 'Staffbase Voices',
    description: 'Peer recognition wall · pulse-survey responses · culture moments. Lets Navigator publish to the Voices feed on the employee\'s behalf.',
    endpoint: '/api/mcp-voices',
    authMethod: 'SSO (demo)',
    status: 'connected',
    domains: ['voices', 'recognition', 'shoutout', 'kudos', 'pulse', 'survey', 'culture', 'engagement', 'feedback'],
    writeTools: ['submit_recognition', 'submit_pulse_feedback'],
    addedAt: 'May 17, 2026',
    tools: [
      { id: 'submit_recognition',       name: 'submit_recognition',       description: 'Post a peer-recognition shout-out to the Voices wall.' },
      { id: 'submit_pulse_feedback',    name: 'submit_pulse_feedback',    description: 'Submit a pulse-survey response (text + sentiment).' },
      { id: 'list_recent_recognitions', name: 'list_recent_recognitions', description: 'List the most recent recognition posts.' },
    ],
  },

  // ── Handoffs (A2A agents) ────────────────────────────────────────────────
  {
    id: 'staffbase_onboarding_agent',
    kind: 'handoff',
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
    // Handoffs expose exactly one synthetic tool: invoke. The orchestrator
    // dispatches via JSON-RPC tasks/send instead of tools/call.
    tools: [
      { id: 'invoke', name: 'invoke', description: 'Hand off the request to this agent. Pass a natural-language message; the agent decides how to act on it.' },
    ],
  },

  // ── Search sources (knowledge bases) ─────────────────────────────────────
  // Each Search source is a single-tool MCP server backed by a real corpus
  // (data/kb-documents.mjs). The orchestrator only sees `{id}__search` as
  // a callable tool — corpus content is retrieved at call time.
  {
    id: 'kb-hr',
    kind: 'search',
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
    kind: 'search',
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
    kind: 'search',
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
    kind: 'search',
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
    kind: 'search',
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

// Workflows reference connections directly. Each tool entry is
// `{ connectionId, toolId }`. For handoffs/search sources, toolId is the
// implicit `invoke` / `search`.
export const WORKFLOWS = [
  {
    id: 'flow-laptop',
    name: 'Laptop Request',
    trigger: 'Employee asks for a new laptop, equipment, broken computer, replacement',
    goal: 'IT ticket submitted with laptop model, OS preference, and delivery address confirmed',
    tools: [
      { connectionId: 'it_helpdesk', toolId: 'lookup_equipment' },
      { connectionId: 'it_helpdesk', toolId: 'create_ticket' },
    ],
    mode: 'suggested',
    instructions: 'Look up the employee\'s current equipment first, then ask about preferences, then open the ticket.',
    onComplete: null,
    status: 'active',
    // Demo pattern: read-then-act. Pull current state from IT, then ask for
    // the gap, then file the ticket. Shows token piping from a tool result
    // into a later form's description.
    steps: [
      {
        id: 'check-equipment',
        type: 'tool',
        label: 'Look up current equipment',
        tool: { connectionId: 'it_helpdesk', toolId: 'lookup_equipment' },
        args: {},
      },
      {
        id: 'collect-laptop',
        type: 'form',
        label: 'Laptop preferences',
        spec: {
          title: 'Request a new laptop',
          description: 'IT has your current inventory on file — pick what you need next.',
          submitLabel: 'Next',
          fields: [
            {
              id: 'reason', label: 'Reason', type: 'select', required: true,
              description: 'Why do you need a new laptop?',
              options: [
                { value: 'broken',    label: 'Current laptop is broken' },
                { value: 'new_hire',  label: "I'm a new hire" },
                { value: 'upgrade',   label: 'Hardware upgrade' },
                { value: 'lost',      label: 'Lost or stolen' },
                { value: 'other',     label: 'Other' },
              ],
            },
            {
              id: 'tier', label: 'Laptop tier', type: 'select', required: true,
              options: [
                { value: 'standard', label: 'Standard (MacBook Air)' },
                { value: 'pro',      label: 'Pro (MacBook Pro 14")' },
                { value: 'engineer', label: 'Engineer (MacBook Pro 16")' },
              ],
            },
            {
              id: 'os', label: 'OS preference', type: 'radio', required: true,
              options: [
                { value: 'macos',   label: 'macOS' },
                { value: 'windows', label: 'Windows' },
                { value: 'linux',   label: 'Linux' },
              ],
            },
            {
              id: 'address', label: 'Shipping address', type: 'textarea', required: true,
              description: 'Where should IT ship it?',
              validation: { minLength: 10, maxLength: 300 },
            },
          ],
        },
      },
      {
        id: 'confirm',
        type: 'confirm',
        label: 'Review before filing',
        summary: {
          title: 'File this IT ticket?',
          rows: [
            { label: 'Reason',  value: '{{collect-laptop.reason}}' },
            { label: 'Tier',    value: '{{collect-laptop.tier}}' },
            { label: 'OS',      value: '{{collect-laptop.os}}' },
            { label: 'Ship to', value: '{{collect-laptop.address}}' },
          ],
          confirmLabel: 'File ticket',
          cancelLabel:  'Edit',
          cancelTo:     'collect-laptop',
        },
      },
      {
        id: 'create-ticket',
        type: 'tool',
        label: 'Open IT ticket',
        tool: { connectionId: 'it_helpdesk', toolId: 'create_ticket' },
        args: {
          title: 'Laptop request — {{collect-laptop.tier}} ({{collect-laptop.os}})',
          body: 'Reason: {{collect-laptop.reason}}\nTier: {{collect-laptop.tier}}\nOS: {{collect-laptop.os}}\nShip to: {{collect-laptop.address}}',
          category: 'equipment',
        },
      },
    ],
  },
  {
    id: 'flow-pto',
    name: 'Request Time Off',
    trigger: 'Employee wants to book leave, holiday, vacation, or PTO',
    goal: 'PTO request submitted with dates confirmed and balance verified',
    tools: [
      { connectionId: 'hr_portal', toolId: 'check_pto_balance' },
      { connectionId: 'hr_portal', toolId: 'submit_time_off_request' },
      { connectionId: 'kb-hr',     toolId: 'search' },
    ],
    mode: 'suggested',
    instructions: 'Check balance, search the HR policy search source for any blackout dates or notice rules, then confirm dates back to the user before submitting.',
    onComplete: null,
    status: 'active',
    steps: [
      {
        id: 'collect-dates',
        type: 'form',
        label: 'Collect dates',
        spec: {
          title: 'Request time off',
          description: "We'll check your balance and submit this for approval.",
          submitLabel: 'Next',
          fields: [
            { id: 'start_date', label: 'Start date', type: 'date', required: true,
              description: 'First day off (YYYY-MM-DD).' },
            { id: 'end_date', label: 'End date', type: 'date', required: true,
              description: 'Last day off (YYYY-MM-DD).' },
            { id: 'reason', label: 'Reason', type: 'textarea', required: false,
              description: 'A short note for your manager.',
              validation: { maxLength: 280 } },
          ],
        },
      },
      {
        id: 'confirm',
        type: 'confirm',
        label: 'Confirm before submitting',
        summary: {
          title: 'Submit your PTO request?',
          rows: [
            { label: 'Start',  value: '{{collect-dates.start_date}}' },
            { label: 'End',    value: '{{collect-dates.end_date}}' },
            { label: 'Reason', value: '{{collect-dates.reason}}' },
          ],
          confirmLabel: 'Submit to HR',
          cancelLabel: 'Edit dates',
          cancelTo: 'collect-dates',
        },
      },
      {
        id: 'submit',
        type: 'tool',
        label: 'Submit to HR',
        tool: { connectionId: 'hr_portal', toolId: 'submit_time_off_request' },
        args: {
          start_date: '{{collect-dates.start_date}}',
          end_date: '{{collect-dates.end_date}}',
          reason: '{{collect-dates.reason}}',
        },
      },
    ],
  },
  {
    id: 'flow-onboarding',
    name: 'New Joiner Onboarding',
    trigger: 'Employee just joined, says they are new, asks what to do to get started, day one, first week',
    goal: 'New hire has HR profile reviewed, IT ticket filed for equipment, and core software access requested',
    tools: [
      { connectionId: 'hr_portal',                  toolId: 'lookup_employee' },
      { connectionId: 'it_helpdesk',                toolId: 'create_ticket' },
      { connectionId: 'it_helpdesk',                toolId: 'request_software_access' },
      { connectionId: 'staffbase_onboarding_agent', toolId: 'invoke' },
      { connectionId: 'kb-onboard',                 toolId: 'search' },
    ],
    mode: 'required',
    instructions: 'Check HR first to understand the role. Hand off to the Onboarding Agent for the stage-aware checklist. Use the Onboarding search source for "how do we do X" questions. Work through one step at a time.',
    onComplete: null,
    status: 'active',
    steps: [
      {
        id: 'collect-joiner',
        type: 'form',
        label: 'New hire details',
        spec: {
          title: 'Get the new hire set up',
          submitLabel: 'Next',
          fields: [
            { id: 'full_name', label: 'Full name', type: 'text', required: true,
              validation: { minLength: 2, maxLength: 80 } },
            { id: 'start_date', label: 'Start date', type: 'date', required: true },
            { id: 'role', label: 'Role', type: 'text', required: true,
              description: 'Helps the onboarding agent tailor the checklist.' },
            {
              id: 'laptop_tier', label: 'Laptop tier', type: 'select', required: true,
              options: [
                { value: 'standard', label: 'Standard (MacBook Air)' },
                { value: 'pro', label: 'Pro (MacBook Pro 14")' },
                { value: 'engineer', label: 'Engineer (MacBook Pro 16")' },
              ],
            },
            { id: 'address', label: 'Shipping address', type: 'textarea', required: true },
          ],
        },
      },
      {
        id: 'file-it-ticket',
        type: 'tool',
        label: 'File IT equipment ticket',
        tool: { connectionId: 'it_helpdesk', toolId: 'create_ticket' },
        args: {
          title: 'New hire equipment — {{collect-joiner.full_name}}',
          body: 'Role: {{collect-joiner.role}}\nStart: {{collect-joiner.start_date}}\nTier: {{collect-joiner.laptop_tier}}\nShip to: {{collect-joiner.address}}',
          category: 'equipment',
        },
      },
      {
        id: 'invoke-onboarding-agent',
        type: 'tool',
        label: 'Engage onboarding agent',
        tool: { connectionId: 'staffbase_onboarding_agent', toolId: 'invoke' },
        args: {
          message: 'New hire {{collect-joiner.full_name}} ({{collect-joiner.role}}) starting {{collect-joiner.start_date}}. Generate a Day-1 checklist.',
        },
      },
    ],
  },
  {
    id: 'flow-software-access',
    name: 'Software Access Request',
    trigger: 'Employee needs software access, license, install, account, tool',
    goal: 'Software access request submitted to IT',
    tools: [
      { connectionId: 'it_helpdesk', toolId: 'request_software_access' },
    ],
    mode: 'suggested',
    instructions: 'Minimal workflow — collect the software + justification, file it.',
    onComplete: null,
    status: 'active',
    // Demo pattern: shortest possible useful workflow. Single form, single
    // write tool. No confirm step (the form's submit IS the commit).
    steps: [
      {
        id: 'collect-software',
        type: 'form',
        label: 'Software request',
        spec: {
          title: 'Request software access',
          description: "IT will review and provision within 1 business day.",
          submitLabel: 'Submit request',
          fields: [
            { id: 'software', label: 'Software', type: 'text', required: true,
              placeholder: 'e.g. Figma, Notion, Adobe Creative Cloud',
              validation: { minLength: 2, maxLength: 80 } },
            {
              id: 'urgency', label: 'Urgency', type: 'radio', required: true,
              options: [
                { value: 'low',    label: 'When you can' },
                { value: 'normal', label: 'Within a week' },
                { value: 'high',   label: 'I need it today' },
              ],
              defaultValue: 'normal',
            },
            { id: 'justification', label: 'Justification', type: 'textarea', required: true,
              description: "What will you use it for?",
              validation: { minLength: 10, maxLength: 400 } },
          ],
        },
      },
      {
        id: 'submit-request',
        type: 'tool',
        label: 'File request with IT',
        tool: { connectionId: 'it_helpdesk', toolId: 'request_software_access' },
        args: {
          software: '{{collect-software.software}}',
          urgency:  '{{collect-software.urgency}}',
          reason:   '{{collect-software.justification}}',
        },
      },
    ],
  },
  {
    id: 'flow-storefront-check',
    name: 'Storefront opening check',
    trigger: 'storefront check, morning open, shopfront audit, store opening photo, opening shift',
    goal: 'Photo of the storefront validated against brand guidelines; any issues filed as a ticket',
    tools: [
      { connectionId: 'it_helpdesk', toolId: 'create_ticket' },
    ],
    mode: 'suggested',
    instructions: 'Frontline retail staff use this at shift open. Validate the storefront photo against brand guidelines, then file a ticket if anything failed.',
    onComplete: null,
    status: 'active',
    steps: [
      {
        id: 'inspect-storefront',
        type: 'photo',
        label: 'Inspect storefront',
        spec: {
          title: 'Take a photo of your storefront',
          description: 'Stand 2–3 metres back. Capture the entire shopfront in one wide frame — windows, signage, and entrance.',
          captureMode: 'both',
          submitLabel: 'Check this photo',
          retakeLabel: 'Retake',
          onFail: 'warn',
          aiValidation: {
            enabled: true,
            model: 'gpt-4o-mini',
            systemPrompt: 'You are a retail brand-compliance reviewer for a chain. You evaluate storefront photos for visible compliance with the daily-open checklist. Be specific, cite what you see, and be fair — natural lighting and angle are not faults.',
            criteria: [
              { id: 'window_display',  label: 'Window display is in place and matches a current monthly campaign poster',  required: true  },
              { id: 'entrance_clear',  label: 'Entrance is unobstructed (no boxes, cables, debris)',                       required: true  },
              { id: 'sandwich_board',  label: 'Sandwich board (A-frame sign) is visible, upright and legible',             required: false },
            ],
            annotations: true,
          },
        },
      },
      {
        id: 'confirm-result',
        type: 'confirm',
        label: 'Review the AI assessment',
        summary: {
          title: 'Send this to operations?',
          description: 'We will log the photo and the AI assessment. If anything failed, a ticket gets filed automatically.',
          rows: [
            { label: 'Overall',     value: '{{inspect-storefront.validation.passed}}' },
            { label: 'AI summary',  value: '{{inspect-storefront.validation.summary}}' },
          ],
          confirmLabel: 'Submit',
          cancelLabel:  'Retake photo',
          cancelTo:     'inspect-storefront',
        },
      },
      {
        id: 'file-ticket',
        type: 'tool',
        label: 'Log the assessment as a ticket',
        tool: { connectionId: 'it_helpdesk', toolId: 'create_ticket' },
        args: {
          title:       'Storefront opening check',
          description: 'AI assessment: {{inspect-storefront.validation.summary}}',
          priority:    'medium',
          category:    'other',
        },
      },
    ],
  },

  // ── Staffbase (intranet / employee app) — "Snap an IT incident" ─────────
  // Real use case at every Staffbase customer: a corporate employee sees a
  // weird error message / dead monitor / fried plug and has no idea how to
  // describe it. They snap a photo, the vision model identifies the device +
  // suggests a priority, and a ticket is filed with the photo attached so the
  // helpdesk doesn't have to play 20 questions.
  {
    id: 'flow-snap-it-incident',
    name: 'Snap an IT issue',
    trigger: 'weird error, error message, screen frozen, blue screen, broken monitor, monitor wont turn on, computer wont start, my laptop is, strange warning, what does this error mean, weird light, dead screen, snap an issue, photo of error',
    goal: 'IT ticket filed with a photo of the issue and an AI-classified description',
    tools: [
      { connectionId: 'it_helpdesk', toolId: 'create_ticket' },
    ],
    mode: 'suggested',
    instructions: 'Used when an employee struggles to describe a hardware/software problem. Get a photo, classify it, ask one clarifying question, then file the ticket.',
    onComplete: null,
    status: 'active',
    steps: [
      {
        id: 'capture-issue',
        type: 'photo',
        label: 'Photo of the issue',
        spec: {
          title: 'Snap a photo of what you\'re seeing',
          description: 'Point at the error message, the broken device, or whatever is acting weird. Make sure the screen text or device label is readable.',
          captureMode: 'both',
          submitLabel: 'Analyze it',
          retakeLabel: 'Retake',
          onFail: 'warn',
          aiValidation: {
            enabled: true,
            model: 'gpt-4o-mini',
            systemPrompt: 'You are a Staffbase IT triage assistant. The photo shows whatever is broken on a colleague\'s workstation. Identify the device (laptop / monitor / dock / cable / etc.), transcribe any visible error text, and assess severity. Be precise — your description is going straight into a helpdesk ticket.',
            criteria: [
              { id: 'image_in_focus',    label: 'Image is in focus and the screen / device is clearly visible', required: true  },
              { id: 'issue_visible',     label: 'A specific issue is visible (error text, damage, status light, blank screen)', required: true  },
              { id: 'no_sensitive_info', label: 'No obviously sensitive content (passwords on sticky notes, customer PII on screen)', required: false },
            ],
            annotations: true,
          },
        },
      },
      {
        id: 'collect-context',
        type: 'form',
        label: 'A few quick details',
        spec: {
          title: 'Give IT a head start',
          description: 'AI summary: {{capture-issue.validation.summary}}',
          submitLabel: 'Continue',
          fields: [
            {
              id: 'when_started', label: 'When did this start?', type: 'select', required: true,
              options: [
                { value: 'just_now',    label: 'Just now' },
                { value: 'today',       label: 'Earlier today' },
                { value: 'this_week',   label: 'Sometime this week' },
                { value: 'longer',      label: 'Longer than a week' },
              ],
            },
            {
              id: 'priority', label: 'How blocking is it?', type: 'radio', required: true,
              options: [
                { value: 'low',      label: 'I can work around it' },
                { value: 'medium',   label: "It's slowing me down" },
                { value: 'high',     label: "I'm fully blocked" },
                { value: 'critical', label: 'Customer impact / production' },
              ],
            },
            {
              id: 'extra', label: 'Anything else IT should know?', type: 'textarea', required: false,
              description: 'Optional — error codes you typed in, things you tried, etc.',
            },
          ],
        },
      },
      {
        id: 'confirm-incident',
        type: 'confirm',
        label: 'Review before filing',
        summary: {
          title: 'File this IT ticket?',
          description: 'IT will get the photo plus the AI assessment and your context.',
          rows: [
            { label: 'AI summary',  value: '{{capture-issue.validation.summary}}' },
            { label: 'When',        value: '{{collect-context.when_started}}' },
            { label: 'Priority',    value: '{{collect-context.priority}}' },
            { label: 'Notes',       value: '{{collect-context.extra}}' },
          ],
          confirmLabel: 'File ticket',
          cancelLabel:  'Edit',
          cancelTo:     'collect-context',
        },
      },
      {
        id: 'file-it-ticket',
        type: 'tool',
        label: 'File the IT ticket',
        tool: { connectionId: 'it_helpdesk', toolId: 'create_ticket' },
        args: {
          title:       'IT incident — {{capture-issue.validation.summary}}',
          description: 'Submitted via Navigator photo flow.\n\nAI assessment: {{capture-issue.validation.summary}}\n\nStarted: {{collect-context.when_started}}\nEmployee notes: {{collect-context.extra}}',
          priority:    '{{collect-context.priority}}',
          category:    'hardware',
        },
      },
    ],
  },

  // ── Staffbase Voices — "Spotlight a teammate" ────────────────────────────
  // Real Voices engagement use case. Employees often want to recognize a
  // colleague but bounce off the moment because the recognition form lives
  // three clicks deep. With Navigator they say "shout out Alice for…" and a
  // flow assembles the post; an optional photo of the moment gets validated
  // (workplace-appropriate, no confidential info on screens) before posting.
  {
    id: 'flow-voices-spotlight',
    name: 'Spotlight a teammate',
    trigger: 'spotlight, shout out, shoutout, recognize a teammate, recognize someone, kudos, give kudos, team highlight, share a win, culture moment, recognition',
    goal: 'A peer-recognition post (with optional photo) published to the Voices wall',
    tools: [
      { connectionId: 'staffbase_voices', toolId: 'submit_recognition' },
    ],
    mode: 'suggested',
    instructions: 'Light, encouraging flow for peer recognition. Default to publishing immediately after confirm — make it feel like one tap. Photo is optional but adds personality when there is a moment to capture.',
    onComplete: null,
    status: 'active',
    steps: [
      {
        id: 'collect-nomination',
        type: 'form',
        label: 'Who and why',
        spec: {
          title: 'Spotlight a teammate',
          description: 'Quick recognition that gets posted to the Voices wall.',
          submitLabel: 'Next',
          fields: [
            {
              id: 'nominee', label: 'Who do you want to recognize?', type: 'text', required: true,
              placeholder: 'Name or email',
              validation: { minLength: 2, maxLength: 80 },
            },
            {
              id: 'category', label: 'Category', type: 'select', required: true,
              options: [
                { value: 'above_and_beyond', label: 'Above & beyond' },
                { value: 'craft',            label: 'Craft / quality of work' },
                { value: 'culture',          label: 'Culture / team energy' },
                { value: 'customer_impact',  label: 'Customer impact' },
                { value: 'collaboration',    label: 'Collaboration' },
              ],
              defaultValue: 'culture',
            },
            {
              id: 'note', label: 'What did they do?', type: 'textarea', required: true,
              description: 'One or two sentences — what happened, why it mattered.',
              validation: { minLength: 10, maxLength: 500 },
            },
          ],
        },
      },
      {
        id: 'moment-photo',
        type: 'photo',
        label: 'Capture the moment (optional)',
        spec: {
          title: 'Got a photo of the moment?',
          description: 'Optional — a team huddle, a finished whiteboard, a customer thank-you note. We will check it is workplace-safe before posting.',
          captureMode: 'both',
          submitLabel: 'Use this photo',
          retakeLabel: 'Different photo',
          onFail: 'warn',
          aiValidation: {
            enabled: true,
            model: 'gpt-4o-mini',
            systemPrompt: 'You are reviewing a photo employees want to attach to a peer-recognition post that will appear on the company Voices wall. Be generous — natural office photos are great. Only flag things that would embarrass the company or the people in the photo.',
            criteria: [
              { id: 'workplace_appropriate', label: 'Workplace-appropriate (no NSFW content, alcohol-heavy scenes, or non-work imagery)', required: true  },
              { id: 'no_confidential_info',  label: 'No visible confidential info (whiteboards with strategy, customer data on a screen, salary or PII)', required: true  },
              { id: 'recognizable_moment',   label: 'Shows people, a workspace, or a clear "moment" rather than a generic stock-photo blob', required: false },
            ],
            annotations: true,
          },
        },
      },
      {
        id: 'confirm-post',
        type: 'confirm',
        label: 'Review the post',
        summary: {
          title: 'Post this to the Voices wall?',
          description: 'Your recognition will appear in the Voices feed and your teammate will get a notification.',
          rows: [
            { label: 'Recognizing', value: '{{collect-nomination.nominee}}' },
            { label: 'Category',    value: '{{collect-nomination.category}}' },
            { label: 'Note',        value: '{{collect-nomination.note}}' },
            { label: 'Photo check', value: '{{moment-photo.validation.summary}}' },
          ],
          confirmLabel: 'Post it',
          cancelLabel:  'Edit',
          cancelTo:     'collect-nomination',
        },
      },
      {
        id: 'publish-recognition',
        type: 'tool',
        label: 'Publish to the Voices wall',
        tool: { connectionId: 'staffbase_voices', toolId: 'submit_recognition' },
        args: {
          nominee:      '{{collect-nomination.nominee}}',
          category:     '{{collect-nomination.category}}',
          note:         '{{collect-nomination.note}}',
          moment_photo: '{{moment-photo.imageDataUrl}}',
        },
      },
    ],
  },
];

// Experts reference one unified `connectionIds[]`. The orchestrator
// builds the Tier-2 tool catalog by walking that list and picking up
// each connection's tools (filtered by status + user OAuth).
export const EXPERTS = [
  {
    name: 'HR Expert',
    icon: '👥',
    description: 'Leave, benefits, and HR policy questions.',
    instructions: 'You are the Staffbase HR expert. Use the HR Toolkit for live PTO, employee data, and policy operations. Use the HR Policies search source to ground answers in the canonical handbook — always cite the document title.',
    connectionIds: ['hr_portal', 'kb-hr'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
  {
    name: 'IT Support',
    icon: '💻',
    description: 'Devices, software, tickets, and access requests.',
    instructions: 'You are the Staffbase IT support expert. Use the IT Helpdesk Toolkit for ticket and equipment operations. Use the IT Wiki search source for security, software, and equipment policy lookups. When the user explicitly asks about ServiceNow — its knowledge base or incidents — use the ServiceNow tools (servicenow_search_kb, servicenow_list_incidents, servicenow_get_incident, and the incident write tools) rather than the IT Wiki or mock helpdesk.',
    connectionIds: ['it_helpdesk', 'kb-it', 'servicenow'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
  {
    name: 'Onboarding',
    icon: '🚀',
    description: 'First 30 days — paperwork, intros, MacBook pickup, benefits enrollment.',
    instructions: 'Help new Staffbase employees during their first 30 days. For "Day One / First Week / First Month / MacBook / onboarding checklist" questions, hand off to the Staffbase Onboarding Agent (call its invoke tool with a natural-language message). For general how-do-I-do-X-at-Staffbase questions, search the Onboarding Guide.',
    connectionIds: ['hr_portal', 'it_helpdesk', 'staffbase_onboarding_agent', 'kb-onboard'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
  {
    name: 'Travel & Expenses',
    icon: '✈️',
    description: 'Booking, policies, and expense reimbursement.',
    instructions: 'Help with travel booking, expense reimbursement, and per-diem questions. Ground every answer in the Travel Policies search source and cite the exact document title.',
    connectionIds: ['kb-travel'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
  {
    name: 'Campsite Expert',
    icon: '📰',
    description: 'Posts, channels, leadership memos, product launches, team updates, and the live employee directory from Campsite.',
    instructions: [
      'You are the Campsite Intranet expert for Staffbase. You own people lookups, news, posts, channels, and reference pages.',
      '',
      'PEOPLE — All "who is X" / "find a teammate" / "find someone in [team]" / "who reports to Y" / "directory" / "people search" questions are yours. Call find_user with the natural-language query. The UI renders the result as a profile-card carousel automatically — do NOT enumerate each person\'s title/department in prose. Lead with one short sentence ("Here are the matches for \\"Martin\\":") and let the cards speak.',
      '',
      'CONTENT — News, announcements, leadership memos, posts, channels, and reference pages. Use the Staffbase Intranet Toolkit (search_posts, get_post, list_recent_posts, list_channels, list_pages) for live data. Use the Campsite Articles search source for curated leadership memos. Always cite the post or page title.',
      '',
      '- If multiple matches come back, show them all and let the user pick.',
      '- If one match is clearly the answer, name them in a single sentence.',
      '- For a specific user (after find_user surfaces an id, or the user names a specific person), call get_user_profile.',
      '- Never invent people. If find_user returns zero matches, say so and suggest a broader spelling.',
    ].join('\n'),
    connectionIds: ['intranet', 'kb-intranet'],
    audience: { everyone: true, groups: [], roles: [], locations: [] },
    status: 'active',
    source: 'seed',
  },
  {
    name: 'Project Workspace',
    icon: '🛠',
    description: 'Confluence pages, Jira issues, sprints, RFCs. Available when Atlassian is connected.',
    instructions: 'Help employees find docs in Confluence and work items in Jira. Always include URLs to the source. When listing or searching, prefer the most recently updated items first.',
    connectionIds: ['atlassian'],
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
    version: 8,
    tenant: {
      name: TENANT_OVERRIDES.name,
      brandColor: TENANT_OVERRIDES.brandColor,
      workspace: TENANT_OVERRIDES.workspaceUrl,
      groups: tenantGroups,
    },
    connections: CONNECTIONS.map((c) => deepClone(c)),
    workflows: WORKFLOWS.map((f) => ({
      ...f,
      tools: f.tools.map((t) => ({ ...t })),
      steps: Array.isArray(f.steps) ? JSON.parse(JSON.stringify(f.steps)) : [],
    })),
    experts: EXPERTS.map((a, i) => ({
      id: `expert-seed-${i + 1}`,
      ...a,
      connectionIds: [...a.connectionIds],
      audience: cloneAudience(a.audience),
    })),
  };
}

// Server-side: the slice persisted to navigator_config.
export function buildSeedConfigPayload() {
  return {
    connections: CONNECTIONS.map((c) => deepClone(c)),
    workflows: WORKFLOWS.map((f) => ({
      ...f,
      tools: f.tools.map((t) => ({ ...t })),
      steps: Array.isArray(f.steps) ? JSON.parse(JSON.stringify(f.steps)) : [],
    })),
    tenantOverrides: { ...TENANT_OVERRIDES, seedVersion: SEED_VERSION },
  };
}

// Server-side: expert rows to insert (shape lib/blueprints.mjs#createExpert expects).
export function buildSeedExperts() {
  return EXPERTS.map((a) => ({
    ...a,
    connectionIds: [...a.connectionIds],
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
