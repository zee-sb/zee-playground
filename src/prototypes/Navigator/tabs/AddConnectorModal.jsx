import React, { useMemo, useState } from 'react'
import {
  X, Search, ArrowLeft, Plus, Loader2, CheckCircle, AlertCircle, Sparkles,
  Wrench, ExternalLink, BookOpen,
} from 'lucide-react'

// Canonical record for the Microsoft 365 Copilot Retrieval connector. This is
// a real, installable `kind: 'search'` source (not a "coming soon" tile): it
// grounds answers in SharePoint / OneDrive / Copilot-connector content via the
// M365 Copilot Retrieval API, with per-user delegated OAuth so each employee's
// own permissions are enforced by Microsoft at retrieval time.
export const MICROSOFT_COPILOT_CONNECTOR = {
  id: 'microsoft-copilot-retrieval',
  kind: 'search',
  catalogId: 'microsoft_copilot_retrieval',
  name: 'Microsoft 365 Copilot Retrieval',
  description:
    'Grounded retrieval from SharePoint, OneDrive, and Copilot connectors via the Microsoft 365 Copilot Retrieval API. Returns permission-trimmed text extracts ranked by relevance. Per-user OAuth — each employee links their own Microsoft account.',
  endpoint: '/api/mcp-microsoft',
  provider: 'microsoft',
  needsUserContext: true,
  authMethod: 'OAuth 2.0 (per user)',
  // Where the connector row's "Connect Microsoft account" affordance points.
  connectEndpoint: '/api/connections/microsoft/connect',
  // Starts disconnected — installing the connector adds it to the workspace,
  // but each user must still grant the delegated OAuth consent.
  status: 'disconnected',
  source: 'SharePoint · OneDrive · Copilot connectors',
  domains: ['sharepoint', 'onedrive', 'm365', 'microsoft', 'copilot', 'policy', 'document', 'file', 'handbook'],
  writeTools: [],
  // Delegated Graph scopes the OAuth grant requests.
  scopes: ['Files.Read.All', 'Sites.Read.All', 'ExternalItem.Read.All', 'offline_access'],
  // The Retrieval API requires the calling user to hold this license.
  requiresLicense: 'Microsoft 365 Copilot',
  // Admin-configured KQL scoping: allowlist of SharePoint site/library/folder
  // paths compiled into the `filterExpression` on each retrieval call.
  pathScopes: [],
  tools: [
    { id: 'copilot_retrieval', name: 'copilot_retrieval', description: 'Retrieve ranked text extracts from SharePoint, OneDrive, or Copilot connectors for a natural-language query (permission-trimmed).' },
  ],
}

// Canonical record for the ServiceNow ITSM connector. A real, installable
// multi-tool toolkit backed by the ServiceNow REST API at `/api/mcp-servicenow`,
// with per-user delegated OAuth so each employee links their own ServiceNow
// account and the instance enforces their roles/ACLs on every call.
export const SERVICENOW_CONNECTOR = {
  id: 'servicenow',
  kind: 'toolkit',
  catalogId: 'servicenow',
  name: 'ServiceNow',
  description:
    'ServiceNow ITSM — search the knowledge base and view, create, and update incidents. Per-user OAuth; ServiceNow enforces each employee\'s own roles and ACLs on every call.',
  endpoint: '/api/mcp-servicenow',
  provider: 'servicenow',
  needsUserContext: true,
  authMethod: 'OAuth 2.0 (per user)',
  // Where the connector row's "Connect ServiceNow account" affordance points.
  connectEndpoint: '/api/connections/servicenow/connect',
  // Starts disconnected — installing adds it to the workspace, but each user
  // must still grant the OAuth consent on the instance.
  status: 'disconnected',
  source: 'ServiceNow ITSM',
  domains: ['servicenow', 'service now', 'itsm', 'incident', 'ticket', 'knowledge base', 'kb article', 'change record', 'it request'],
  writeTools: ['servicenow_create_incident', 'servicenow_update_incident', 'servicenow_add_comment'],
  tools: [
    { id: 'servicenow_search_kb', name: 'servicenow_search_kb', description: 'Search the ServiceNow knowledge base for help articles.' },
    { id: 'servicenow_list_incidents', name: 'servicenow_list_incidents', description: 'List the signed-in user\'s incidents, newest first.' },
    { id: 'servicenow_get_incident', name: 'servicenow_get_incident', description: 'Fetch full details of one incident by number or sys_id.' },
    { id: 'servicenow_create_incident', name: 'servicenow_create_incident', description: 'Create a new incident on behalf of the user (requires confirmation).' },
    { id: 'servicenow_update_incident', name: 'servicenow_update_incident', description: 'Update fields on an incident (requires confirmation).' },
    { id: 'servicenow_add_comment', name: 'servicenow_add_comment', description: 'Add a comment or work note to an incident (requires confirmation).' },
  ],
}

// Catalog of third-party MCP integrations. All marked "coming soon" — they
// render with realistic branding (initials + brand color) and a disabled card.
// Real installs go through the Custom MCP path until each one has a verified
// upstream MCP server.
const MARKETPLACE = [
  { id: 'slack',       name: 'Slack',             category: 'Communication',  color: '#4A154B', desc: 'Channels, DMs, search, post messages.' },
  { id: 'teams',       name: 'Microsoft Teams',   category: 'Communication',  color: '#5059C9', desc: 'Channel posts, chat search, presence.' },
  { id: 'gmail',       name: 'Gmail',             category: 'Email',          color: '#EA4335', desc: 'Read & draft mail, search threads.' },
  { id: 'outlook',     name: 'Outlook',           category: 'Email',          color: '#0078D4', desc: 'Mailbox + calendar, meeting scheduling.' },
  { id: 'gcal',        name: 'Google Calendar',   category: 'Calendar',       color: '#4285F4', desc: 'List & create events, check availability.' },
  { id: 'jira',        name: 'Jira',              category: 'Project mgmt',   color: '#0052CC', desc: 'Issues, sprints, JQL search, transitions.' },
  { id: 'confluence',  name: 'Confluence',        category: 'Docs',           color: '#172B4D', desc: 'Pages, spaces, search, comments.' },
  { id: 'notion',      name: 'Notion',            category: 'Docs',           color: '#000000', desc: 'Pages, databases, search.' },
  { id: 'github',      name: 'GitHub',            category: 'Code',           color: '#181717', desc: 'Repos, PRs, issues, file reads.' },
  { id: 'gitlab',      name: 'GitLab',            category: 'Code',           color: '#FC6D26', desc: 'Projects, MRs, pipelines.' },
  { id: 'linear',      name: 'Linear',            category: 'Project mgmt',   color: '#5E6AD2', desc: 'Issues, projects, cycles.' },
  { id: 'asana',       name: 'Asana',             category: 'Project mgmt',   color: '#F06A6A', desc: 'Tasks, projects, my list.' },
  { id: 'salesforce',  name: 'Salesforce',        category: 'CRM',            color: '#00A1E0', desc: 'Accounts, opportunities, contacts.' },
  { id: 'hubspot',     name: 'HubSpot',           category: 'CRM',            color: '#FF7A59', desc: 'Contacts, deals, marketing emails.' },
  { id: 'zendesk',     name: 'Zendesk',           category: 'Support',        color: '#03363D', desc: 'Tickets, organizations, search.' },
  { id: 'workday',     name: 'Workday',           category: 'HR',             color: '#F38B00', desc: 'HRIS profile, time off, org chart.' },
  { id: 'bamboohr',    name: 'BambooHR',          category: 'HR',             color: '#73C41D', desc: 'Employees, leave, time-tracking.' },
  { id: 'gdrive',      name: 'Google Drive',      category: 'Files',          color: '#1FA463', desc: 'Search files, read docs, share.' },
  { id: 'onedrive',    name: 'OneDrive',          category: 'Files',          color: '#0078D4', desc: 'Files, search, share links.' },
  { id: 'dropbox',     name: 'Dropbox',           category: 'Files',          color: '#0061FF', desc: 'Files, folders, shared links.' },
  { id: 'datadog',     name: 'Datadog',           category: 'Observability',  color: '#632CA6', desc: 'Metrics, monitors, dashboards.' },
  { id: 'sentry',      name: 'Sentry',            category: 'Observability',  color: '#362D59', desc: 'Errors, issues, releases.' },
  { id: 'pagerduty',   name: 'PagerDuty',         category: 'On-call',        color: '#06AC38', desc: 'Incidents, schedules, alerts.' },
]

// Direct browser → MCP endpoint probe. Works for same-origin /api/* paths
// and any external endpoint with permissive CORS. Throws on network/HTTP/RPC
// failure; returns the tools array on success.
async function probeDirect(url, auth) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' }
  if (auth.type === 'bearer' && auth.token) headers['Authorization'] = `Bearer ${auth.token}`
  if (auth.type === 'header' && auth.headerName && auth.headerValue) headers[auth.headerName] = auth.headerValue
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const text = await resp.text()
  let parsed = null
  try { parsed = JSON.parse(text) } catch {
    // Possible SSE-style framing.
    for (const line of text.split('\n')) {
      const m = line.match(/^data:\s*(.*)$/)
      if (!m) continue
      try {
        const obj = JSON.parse(m[1])
        if (obj.result !== undefined || obj.error) parsed = obj
      } catch {}
    }
  }
  if (!parsed) throw new Error('not JSON-RPC')
  if (parsed.error) throw new Error(parsed.error.message || 'rpc error')
  return Array.isArray(parsed.result?.tools) ? parsed.result.tools : []
}

// Backend proxy probe. Cleaner error surface than the direct path and
// bypasses CORS for external endpoints.
async function probeProxy(url, auth) {
  const resp = await fetch('/api/connector-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method: 'tools/list', auth }),
  })
  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error('endpoint not running locally — try vercel dev or a deployed env')
    }
    throw new Error(`HTTP ${resp.status}`)
  }
  const data = await resp.json()
  if (!data.ok) throw new Error(data.error || 'failed')
  return Array.isArray(data.result?.tools) ? data.result.tools : []
}

export default function AddConnectorModal({ onClose, onAdd, existingIds = [] }) {
  const [view, setView] = useState('marketplace')          // 'marketplace' | 'custom'
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MARKETPLACE
    return MARKETPLACE.filter((it) =>
      it.name.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q) ||
      it.desc.toLowerCase().includes(q)
    )
  }, [query])

  const microsoftAdded = existingIds.includes(MICROSOFT_COPILOT_CONNECTOR.id)
  const serviceNowAdded = existingIds.includes(SERVICENOW_CONNECTOR.id)

  function handleAddMicrosoft() {
    if (microsoftAdded) return
    onAdd({
      ...MICROSOFT_COPILOT_CONNECTOR,
      addedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })
    onClose?.()
  }

  function handleAddServiceNow() {
    if (serviceNowAdded) return
    onAdd({
      ...SERVICENOW_CONNECTOR,
      addedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-4xl max-h-[88vh] rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            {view === 'custom' && (
              <button
                type="button"
                onClick={() => setView('marketplace')}
                className="p-1 -ml-1 text-[#6B7280] hover:text-[#111827]"
                aria-label="Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <h2 className="text-[16px] font-bold text-[#111827]">
              {view === 'marketplace' ? 'Add a connector' : 'Custom MCP server'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6B7280] hover:text-[#111827] p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {view === 'marketplace' ? (
          <MarketplaceView
            query={query}
            setQuery={setQuery}
            items={filtered}
            onPickCustom={() => setView('custom')}
            onAddMicrosoft={handleAddMicrosoft}
            microsoftAdded={microsoftAdded}
            onAddServiceNow={handleAddServiceNow}
            serviceNowAdded={serviceNowAdded}
          />
        ) : (
          <CustomMcpView
            onClose={onClose}
            onAdd={onAdd}
            existingIds={existingIds}
          />
        )}
      </div>
    </div>
  )
}

// ── Marketplace view ────────────────────────────────────────────────────────

function MarketplaceView({ query, setQuery, items, onPickCustom, onAddMicrosoft, microsoftAdded, onAddServiceNow, serviceNowAdded }) {
  return (
    <>
      <div className="px-6 pt-5 pb-3 border-b border-[#F1F5F9]">
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search integrations…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E7EB] text-[13px] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Custom MCP — featured */}
        <button
          type="button"
          onClick={onPickCustom}
          className="w-full mb-5 flex items-start gap-3 px-4 py-4 bg-gradient-to-r from-[#F5F3FF] to-[#F0F9FF] border border-[#DDD6FE] rounded-xl hover:border-[#7C3AED] text-left transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg grid place-items-center shrink-0" style={{ background: '#7C3AED' }}>
            <Wrench size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-[14px] font-bold text-[#111827]">Custom MCP server</div>
              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#15803D]">Available</span>
            </div>
            <div className="text-[12.5px] text-[#52525B] mt-0.5">
              Connect any MCP-compatible endpoint by URL. We'll fetch its tools list and add it to your workspace.
            </div>
          </div>
          <Plus size={16} className="text-[#7C3AED] shrink-0 mt-1" />
        </button>

        {/* Microsoft 365 Copilot Retrieval — featured, installable search source */}
        <button
          type="button"
          onClick={onAddMicrosoft}
          disabled={microsoftAdded}
          className={`w-full mb-5 flex items-start gap-3 px-4 py-4 border rounded-xl text-left transition-colors group ${
            microsoftAdded
              ? 'bg-[#F8FAFC] border-[#E5E7EB] opacity-70 cursor-default'
              : 'bg-gradient-to-r from-[#EFF6FF] to-[#F0FDFA] border-[#BFDBFE] hover:border-[#2563EB]'
          }`}
        >
          <div className="w-10 h-10 rounded-lg grid place-items-center shrink-0" style={{ background: '#2563EB' }}>
            <BookOpen size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[14px] font-bold text-[#111827]">Microsoft 365 Copilot Retrieval</div>
              <span className="text-[9.5px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#DBEAFE] text-[#1D4ED8]">Search</span>
              {microsoftAdded ? (
                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] inline-flex items-center gap-1"><CheckCircle size={10} /> Added</span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#15803D]">Available</span>
              )}
            </div>
            <div className="text-[12.5px] text-[#52525B] mt-0.5">
              Ground answers in SharePoint, OneDrive & Copilot connectors. Per-user OAuth — Microsoft enforces each employee's own permissions. Requires a Microsoft 365 Copilot license.
            </div>
          </div>
          {microsoftAdded
            ? <CheckCircle size={16} className="text-[#15803D] shrink-0 mt-1" />
            : <Plus size={16} className="text-[#2563EB] shrink-0 mt-1" />}
        </button>

        {/* ServiceNow ITSM — featured, installable toolkit */}
        <button
          type="button"
          onClick={onAddServiceNow}
          disabled={serviceNowAdded}
          className={`w-full mb-5 flex items-start gap-3 px-4 py-4 border rounded-xl text-left transition-colors group ${
            serviceNowAdded
              ? 'bg-[#F8FAFC] border-[#E5E7EB] opacity-70 cursor-default'
              : 'bg-gradient-to-r from-[#F0FDF4] to-[#ECFEFF] border-[#BBF7D0] hover:border-[#16A34A]'
          }`}
        >
          <div className="w-10 h-10 rounded-lg grid place-items-center shrink-0" style={{ background: '#62D84E' }}>
            <Wrench size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[14px] font-bold text-[#111827]">ServiceNow</div>
              <span className="text-[9.5px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#15803D]">Toolkit</span>
              {serviceNowAdded ? (
                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] inline-flex items-center gap-1"><CheckCircle size={10} /> Added</span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#15803D]">Available</span>
              )}
            </div>
            <div className="text-[12.5px] text-[#52525B] mt-0.5">
              Search the knowledge base and view, create & update incidents. Per-user OAuth — ServiceNow enforces each employee's own roles on every call.
            </div>
          </div>
          {serviceNowAdded
            ? <CheckCircle size={16} className="text-[#15803D] shrink-0 mt-1" />
            : <Plus size={16} className="text-[#16A34A] shrink-0 mt-1" />}
        </button>

        <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#94A3B8] mb-3">
          Popular integrations
        </div>

        {items.length === 0 ? (
          <div className="text-[12.5px] text-[#94A3B8] italic py-8 text-center">
            No integrations match "{query}".
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((it) => (
              <MarketplaceCard key={it.id} item={it} />
            ))}
          </div>
        )}

        <p className="text-[11.5px] text-[#94A3B8] mt-5 text-center">
          Don't see your tool? Reach out to <span className="font-mono">navigator@staffbase.com</span> or use the Custom MCP path above.
        </p>
      </div>
    </>
  )
}

function MarketplaceCard({ item }) {
  return (
    <div
      title={`${item.name} — coming soon`}
      className="relative flex items-start gap-3 px-4 py-3.5 bg-white border border-[#E5E7EB] rounded-xl opacity-70 cursor-not-allowed"
    >
      <div
        className="w-9 h-9 rounded-lg grid place-items-center text-white font-bold text-[12px] shrink-0"
        style={{ background: item.color }}
      >
        {initials(item.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-[#111827] truncate">{item.name}</div>
        <div className="text-[10.5px] font-mono text-[#94A3B8] uppercase tracking-wider">{item.category}</div>
        <div className="text-[11.5px] text-[#52525B] mt-1 line-clamp-2">{item.desc}</div>
      </div>
      <span className="absolute top-2 right-2 text-[9.5px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]">
        Coming soon
      </span>
    </div>
  )
}

function initials(name) {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// ── Custom MCP view ─────────────────────────────────────────────────────────

function CustomMcpView({ onClose, onAdd, existingIds }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [authType, setAuthType] = useState('none')
  const [authToken, setAuthToken] = useState('')
  const [headerName, setHeaderName] = useState('')
  const [headerValue, setHeaderValue] = useState('')

  // Discovery state: tools fetched from the endpoint.
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [discovered, setDiscovered] = useState(null) // { tools: [...], serverInfo? }

  const canTest = url.trim().length > 0 && /^(https?:\/\/|\/api\/)/i.test(url.trim())
  const canAdd = !!discovered && name.trim().length > 0

  async function handleTest() {
    setError(null)
    setDiscovered(null)
    setBusy(true)
    try {
      const auth = authType === 'bearer'
        ? { type: 'bearer', token: authToken }
        : authType === 'header'
          ? { type: 'header', headerName, headerValue }
          : { type: 'none' }
      // Two-stage probe:
      //   1. Direct browser → endpoint. Works for same-origin paths and any
      //      external MCP that sets permissive CORS headers.
      //   2. Backend proxy /api/connector-proxy. Covers external endpoints
      //      that don't enable CORS (most do not). Requires the API runtime
      //      (vercel dev or a deployed env) — bare Vite won't execute it.
      let tools = null
      let directErr = null
      try {
        tools = await probeDirect(url.trim(), auth)
      } catch (err) {
        directErr = err
      }
      if (tools === null) {
        try {
          tools = await probeProxy(url.trim(), auth)
        } catch (err) {
          // Combine errors so the admin can see why both paths failed.
          const directMsg = directErr ? `direct: ${directErr.message}` : null
          const proxyMsg = `proxy: ${err.message}`
          throw new Error([directMsg, proxyMsg].filter(Boolean).join(' · '))
        }
      }
      if (!Array.isArray(tools) || tools.length === 0) {
        throw new Error('Endpoint reachable but returned 0 tools. Check the URL points to an MCP server that implements tools/list.')
      }
      setDiscovered({ tools })
      // Auto-fill a name if empty: try to derive from URL host or path.
      if (!name.trim()) {
        try {
          const parsed = new URL(url, window.location.origin)
          const host = parsed.host || parsed.pathname
          setName(host.replace(/^api\.|www\./, '').split('.')[0].replace(/^\w/, (c) => c.toUpperCase()) + ' MCP')
        } catch { /* ignore */ }
      }
    } catch (err) {
      setError(err.message || 'Connection failed')
    } finally {
      setBusy(false)
    }
  }

  function handleAdd() {
    if (!discovered) return
    const id = `toolkit-${Date.now().toString(36)}`
    const connection = {
      id,
      kind: 'toolkit',
      name: name.trim(),
      description: `Custom toolkit · ${discovered.tools.length} tools`,
      endpoint: url.trim(),
      authMethod: authType === 'none' ? 'None' : authType === 'bearer' ? 'Bearer token' : 'Custom header',
      status: 'connected',
      domains: [],
      writeTools: [],
      addedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      tools: discovered.tools.map((t) => ({
        id: t.name,
        name: t.name,
        description: t.description || '',
      })),
      custom: true,
    }
    onAdd(connection)
    onClose?.()
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <p className="text-[12.5px] text-[#6B7280] mb-5">
        Paste the URL of an MCP-compatible JSON-RPC endpoint. We'll call <code className="font-mono bg-[#F5F5F7] px-1.5 py-0.5 rounded text-[11.5px]">tools/list</code> to discover what it offers, then add it to your workspace so Assistants can use it.
      </p>

      <div className="space-y-4">
        <Field label="Connector name" hint="How it appears in the Connectors list and Assistant editor.">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Internal Knowledge Base"
            className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-[13px] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
          />
        </Field>

        <Field label="MCP endpoint URL" hint="An https:// URL, or a relative /api/ path on this same host.">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setDiscovered(null); setError(null) }}
            placeholder="https://your-mcp.example.com/rpc"
            spellCheck={false}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-[13px] font-mono outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
          />
        </Field>

        <Field label="Authentication">
          <div className="inline-flex items-center gap-1 border border-[#E5E7EB] rounded-lg p-0.5 bg-white">
            {[
              { id: 'none',   label: 'None' },
              { id: 'bearer', label: 'Bearer token' },
              { id: 'header', label: 'Custom header' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAuthType(opt.id)}
                className={`px-3 py-1 text-[11.5px] font-semibold rounded ${authType === opt.id ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:text-[#111827]'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {authType === 'bearer' && (
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Bearer token (sent as Authorization header)"
              className="w-full mt-2 px-3 py-2 rounded-lg border border-[#E5E7EB] text-[13px] font-mono outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
            />
          )}
          {authType === 'header' && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input
                type="text"
                value={headerName}
                onChange={(e) => setHeaderName(e.target.value)}
                placeholder="Header name (e.g. X-Api-Key)"
                className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-[13px] font-mono outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
              />
              <input
                type="password"
                value={headerValue}
                onChange={(e) => setHeaderValue(e.target.value)}
                placeholder="Header value"
                className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-[13px] font-mono outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
              />
            </div>
          )}
        </Field>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleTest}
            disabled={!canTest || busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#7C3AED] bg-[#F5F3FF] text-[#5B21B6] text-[12.5px] font-semibold hover:bg-[#EDE9FE] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Test connection
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] px-3 py-2 text-[12.5px] flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {discovered && (
          <div className="rounded-lg border border-[#86EFAC] bg-[#F0FDF4] p-3">
            <div className="flex items-center gap-2 text-[#15803D] font-semibold text-[13px]">
              <CheckCircle size={14} />
              Connected · {discovered.tools.length} tools
            </div>
            <div className="mt-2 max-h-44 overflow-y-auto space-y-1">
              {discovered.tools.slice(0, 30).map((t) => (
                <div key={t.name} className="flex items-center gap-2 px-2 py-1 rounded bg-white border border-[#DCFCE7] text-[11.5px]">
                  <span className="font-mono font-semibold text-[#111827]">{t.name}</span>
                  {t.description && (
                    <span className="text-[#52525B] truncate">— {t.description}</span>
                  )}
                </div>
              ))}
              {discovered.tools.length > 30 && (
                <div className="text-[11px] text-[#15803D] italic px-2">+{discovered.tools.length - 30} more…</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-5 mt-5 border-t border-[#E5E7EB]">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 rounded-lg text-[12.5px] font-semibold text-[#6B7280] hover:text-[#111827]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#111827] hover:bg-[#1F2937] text-white text-[12.5px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={13} />
          Add to workspace
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[11.5px] font-bold text-[#374151] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {hint && <div className="text-[11px] text-[#94A3B8] mt-1">{hint}</div>}
    </div>
  )
}
