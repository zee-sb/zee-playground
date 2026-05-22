import React, { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Wrench, Bot, BookOpen, ChevronRight, ChevronDown, X, Plus, Power, AlertTriangle, Compass, ExternalLink, Sparkles } from 'lucide-react'
import { LogoChip } from '../components/Catalog'
import AddConnectorModal from './AddConnectorModal'

/**
 * Unified Connections tab. Each row is one connection, filterable by kind
 * (toolkit / handoff / search). The shape is the same regardless of kind;
 * only the icon, color, and "tools" semantics differ.
 *
 * Props:
 *   connections[]                  — full unified list
 *   experts[]                      — for the "Used by" column
 *   onConnectionsChange(updater)   — write-through (status toggle, remove)
 */
export default function ConnectorsList({
  connections = [],
  experts = [],
  onConnectionsChange,
  // Per-connector settings from navigator_config.tenantOverrides.
  // connectorSettings. Token is server-redacted — we get { hasToken,
  // mcpUrl, authMode } back from load(), and only send a non-empty
  // apiToken when the admin types a new one.
  connectorSettings = {},
  onConnectorSettingsChange,
}) {
  const [filter, setFilter] = useState('all') // all | toolkit | handoff | search
  const [expandedId, setExpandedId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const suggested = searchParams.get('suggested')
  const suggestedTopic = searchParams.get('topic')

  // Opening the Add modal automatically when arriving from an analytics CTA.
  useEffect(() => {
    if (suggested) setAddOpen(true)
  }, [suggested])

  function dismissSuggestion() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('suggested')
      next.delete('topic')
      return next
    }, { replace: true })
  }

  const counts = useMemo(() => {
    const all = connections.length
    const toolkit = connections.filter((c) => c.kind === 'toolkit').length
    const handoff = connections.filter((c) => c.kind === 'handoff').length
    const search = connections.filter((c) => c.kind === 'search').length
    return { all, toolkit, handoff, search }
  }, [connections])

  const visible = useMemo(() => {
    if (filter === 'all') return connections
    return connections.filter((c) => c.kind === filter)
  }, [connections, filter])

  const usedBy = (cid) =>
    experts.filter((a) => (a.connectionIds || []).includes(cid))

  function handleToggleStatus(connection) {
    onConnectionsChange((prev) =>
      prev.map((c) => c.id === connection.id
        ? { ...c, status: c.status === 'connected' ? 'disconnected' : 'connected' }
        : c)
    )
  }
  function handleRemove(connection) {
    if (!window.confirm(`Remove ${connection.name}? Experts and workflows using it will lose those tools.`)) return
    onConnectionsChange((prev) => prev.filter((c) => c.id !== connection.id))
  }
  function handleAddCustomConnection(connection) {
    onConnectionsChange((prev) => [...prev, connection])
    setExpandedId(connection.id)
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Connections</h1>
          <p className="text-[13px] text-[#6B7280] mt-1 max-w-2xl">
            Everything the chat can call — multi-tool toolkits, single-tool handoff agents, and indexed search sources. Same protocol underneath; the <span className="font-mono">kind</span> field decides how the orchestrator dispatches.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          title="Browse the integration marketplace or connect a custom MCP server."
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] hover:bg-[#1F2937] text-white text-[13px] font-semibold rounded-lg transition-colors"
        >
          <Plus size={15} />
          Add connection
        </button>
      </div>

      {suggested && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
          <Sparkles size={16} className="text-[#2563EB] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-[#1E3A8A]">
              Suggested from Analytics{suggestedTopic ? `: ${suggestedTopic}` : ''}
            </div>
            <div className="text-[12px] text-[#1E40AF] mt-0.5">
              Conversations on this topic struggled to find an authoritative answer. Adding a <span className="font-mono">{suggested}</span> source should help.
            </div>
          </div>
          <button
            type="button"
            onClick={dismissSuggestion}
            className="text-[#1E40AF] hover:text-[#1E3A8A]"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Kind filter strip */}
      <div className="inline-flex items-center gap-1 border border-[#E5E7EB] rounded-lg p-0.5 bg-white mb-4">
        <KindButton id="all"     label="All"      count={counts.all}     active={filter === 'all'}     onClick={setFilter} />
        <KindButton id="toolkit" icon={<Wrench size={11} />}   label="Toolkits" count={counts.toolkit} active={filter === 'toolkit'} onClick={setFilter} />
        <KindButton id="handoff" icon={<Bot size={11} />}      label="Handoffs" count={counts.handoff} active={filter === 'handoff'} onClick={setFilter} />
        <KindButton id="search"  icon={<BookOpen size={11} />} label="Search"   count={counts.search}  active={filter === 'search'}  onClick={setFilter} />
      </div>

      {visible.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Connector</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Kind</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Tools</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Used by</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const using = usedBy(c.id)
                const expanded = expandedId === c.id
                return (
                  <React.Fragment key={c.id}>
                    <tr
                      className="border-t border-[#F1F5F9] hover:bg-[#FAFAFA] cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <LogoChip name={c.name} color={kindColor(c.kind)} size={28} />
                          <div className="min-w-0">
                            <div className="font-semibold text-[#111827] truncate">{c.name}</div>
                            <div className="text-[11px] text-[#94A3B8] font-mono truncate">{c.endpoint || c.protocol || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <KindBadge kind={c.kind} />
                      </td>
                      <td className="px-4 py-3 text-[#52525B]">
                        {c.kind === 'toolkit'
                          ? `${(c.tools || []).length} tools`
                          : c.kind === 'remote'
                            ? `${(c.tools || []).length || '—'} tools · remote MCP`
                            : c.kind === 'handoff'
                              ? 'invoke'
                              : `search · ${c.articleCount || 0} docs`}
                      </td>
                      <td className="px-4 py-3">
                        {using.length === 0
                          ? <span className="text-[11px] text-[#94A3B8] italic">No experts</span>
                          : (
                            <div className="flex flex-wrap gap-1">
                              {using.slice(0, 3).map((a) => (
                                <span key={a.id} className="px-1.5 py-0.5 text-[10.5px] font-semibold bg-[#F3F4F6] text-[#374151] rounded">
                                  {a.name}
                                </span>
                              ))}
                              {using.length > 3 && (
                                <span className="text-[10.5px] text-[#94A3B8]">+{using.length - 3}</span>
                              )}
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={c.status} />
                      </td>
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(c) }}
                          title={c.status === 'connected' ? 'Disconnect' : 'Connect'}
                          className="p-1.5 text-[#6B7280] hover:text-[#111827] rounded hover:bg-[#F3F4F6]"
                        >
                          <Power size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemove(c) }}
                          title="Remove"
                          className="p-1.5 text-[#6B7280] hover:text-[#B91C1C] rounded hover:bg-[#FEF2F2] ml-0.5"
                        >
                          <X size={14} />
                        </button>
                        {expanded ? <ChevronDown size={13} className="inline ml-1 text-[#94A3B8]" /> : <ChevronRight size={13} className="inline ml-1 text-[#94A3B8]" />}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-t border-[#F1F5F9] bg-[#FAFAFA]">
                        <td colSpan={6} className="px-5 py-3">
                          <ExpandedRow
                            connection={c}
                            onConnectionsChange={onConnectionsChange}
                            connectorSettings={connectorSettings}
                            onConnectorSettingsChange={onConnectorSettingsChange}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MCP Explorer footer — a separate, dedicated entry point for browsing
          the registry of available MCP servers + A2A agents and testing
          connections in isolation (separate from the live Navigator wiring). */}
      <Link
        to="/prototypes/mcp-demo"
        className="mt-6 flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-[#F5F3FF] to-[#F0F9FF] border border-[#DDD6FE] rounded-xl hover:border-[#7C3AED] transition-colors group"
      >
        <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={{ background: '#7C3AED' }}>
          <Compass size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[#111827]">MCP Explorer</div>
          <div className="text-[11.5px] text-[#52525B] mt-0.5">
            Browse every MCP server + A2A agent reachable from this workspace, inspect tools, and try requests in isolation.
          </div>
        </div>
        <ExternalLink size={14} className="text-[#94A3B8] group-hover:text-[#7C3AED] shrink-0" />
      </Link>

      {addOpen && (
        <AddConnectorModal
          existingIds={connections.map((c) => c.id)}
          onClose={() => setAddOpen(false)}
          onAdd={handleAddCustomConnection}
        />
      )}
    </div>
  )
}

function KindButton({ id, icon, label, count, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-semibold rounded ${
        active ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:text-[#111827]'
      }`}
    >
      {icon}
      {label}
      <span className={`text-[10px] font-mono ${active ? 'text-white/60' : 'text-[#94A3B8]'}`}>{count}</span>
    </button>
  )
}

function KindBadge({ kind }) {
  const Icon = kind === 'toolkit' || kind === 'remote'
    ? Wrench
    : kind === 'handoff' ? Bot : BookOpen
  const label = kind === 'toolkit'
    ? 'Toolkit'
    : kind === 'remote'
      ? 'Remote MCP'
      : kind === 'handoff' ? 'Handoff' : 'Search'
  const color = kindColor(kind)
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold" style={{ background: `${color}1a`, color }}>
      <Icon size={10} />
      {label}
    </span>
  )
}

function kindColor(kind) {
  if (kind === 'handoff') return '#F59E0B'
  if (kind === 'search') return '#2563EB'
  if (kind === 'remote') return '#0EA5E9'
  return '#7C3AED'
}

function StatusPill({ status }) {
  const color = status === 'connected' ? '#16A34A' : status === 'degraded' ? '#D97706' : '#71717A'
  const bg = status === 'connected' ? '#DCFCE7' : status === 'degraded' ? '#FEF3C7' : '#F3F4F6'
  const label = status === 'connected' ? 'Connected' : status === 'degraded' ? 'Degraded' : 'Disconnected'
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold" style={{ background: bg, color }}>
      {status === 'degraded' && <AlertTriangle size={10} />}
      {label}
    </span>
  )
}

function ExpandedRow({ connection, onConnectionsChange, connectorSettings, onConnectorSettingsChange }) {
  const tools = connection.tools || []
  return (
    <div>
      {connection.description && (
        <p className="text-[12.5px] text-[#374151] mb-2">{connection.description}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Field label="Endpoint" value={connection.endpoint} mono />
        <Field label="Auth" value={connection.authMethod || '—'} />
        {connection.kind === 'search' && <Field label="Source" value={connection.source || '—'} />}
        {connection.kind === 'handoff' && <Field label="Protocol" value={connection.protocol || 'native'} />}
        {connection.provider && <Field label="OAuth provider" value={connection.provider} />}
        {connection.writeTools?.length > 0 && <Field label="Write tools" value={connection.writeTools.join(', ')} />}
      </div>
      {connection.kind === 'remote' && onConnectorSettingsChange && (
        <RemoteMcpSettings
          connection={connection}
          settings={connectorSettings?.[connection.id] || {}}
          onChange={(patch) => onConnectorSettingsChange(connection.id, patch)}
        />
      )}
      {onConnectionsChange && (
        <RoutingHintsEditor connection={connection} onConnectionsChange={onConnectionsChange} />
      )}
      {tools.length > 0 && (
        <div className="mt-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">Tools ({tools.length})</div>
          <div className="flex flex-col gap-1">
            {tools.map((t) => (
              <div key={t.id || t.name} className="flex items-center gap-2 px-2 py-1 rounded bg-white border border-[#E5E7EB]">
                <span className="font-mono text-[11.5px] font-semibold text-[#111827]">{t.name}</span>
                {t.description && (
                  <span className="text-[11.5px] text-[#52525B] truncate">— {t.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Inline editor for the routing-hint fields the Tier-1 orchestrator router
// reads (useWhen, dontUseFor, examples, keywords). Save-on-blur — no separate
// "save" button so admins can iterate quickly while testing prompts in chat.
function RoutingHintsEditor({ connection, onConnectionsChange }) {
  const [useWhen, setUseWhen] = useState(connection.useWhen || '')
  const [dontUseFor, setDontUseFor] = useState(connection.dontUseFor || '')
  const [examples, setExamples] = useState((connection.examples || []).join('\n'))
  const [keywords, setKeywords] = useState(
    (connection.keywords && connection.keywords.length
      ? connection.keywords
      : connection.domains || []
    ).join(', ')
  )

  useEffect(() => {
    setUseWhen(connection.useWhen || '')
    setDontUseFor(connection.dontUseFor || '')
    setExamples((connection.examples || []).join('\n'))
    setKeywords(
      (connection.keywords && connection.keywords.length
        ? connection.keywords
        : connection.domains || []
      ).join(', ')
    )
  }, [connection.id])

  function save(patch) {
    onConnectionsChange((prev) =>
      prev.map((c) => c.id === connection.id ? { ...c, ...patch } : c)
    )
  }

  function commitExamples() {
    const lines = examples
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 6)
    save({ examples: lines })
  }

  function commitKeywords() {
    const tokens = keywords
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12)
    save({ keywords: tokens })
  }

  return (
    <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={12} className="text-[#7C3AED]" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#52525B]">
          Routing hints
        </span>
        <span className="text-[11px] text-[#94A3B8] font-normal">
          Read by the orchestrator's Tier-1 router to pick this connector over overlapping ones.
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <HintField
          label="Use when"
          placeholder="Hardware, VPN, MFA, software access, security incidents."
          value={useWhen}
          onChange={setUseWhen}
          onBlur={() => save({ useWhen: useWhen.trim().slice(0, 200) })}
          maxLength={200}
          rows={3}
        />
        <HintField
          label="Don't use for"
          placeholder="Project tracking — use Atlassian/Jira for sprints, epics, bugs."
          value={dontUseFor}
          onChange={setDontUseFor}
          onBlur={() => save({ dontUseFor: dontUseFor.trim().slice(0, 160) })}
          maxLength={160}
          rows={3}
        />
        <HintField
          label="Example user phrases"
          placeholder={'My laptop is slow\nI need GitHub access'}
          value={examples}
          onChange={setExamples}
          onBlur={commitExamples}
          rows={4}
          hint="One per line · up to 6"
        />
        <HintField
          label="Keywords"
          placeholder="ticket, helpdesk, vpn, mfa, laptop"
          value={keywords}
          onChange={setKeywords}
          onBlur={commitKeywords}
          rows={4}
          hint="Comma-separated · up to 12. Falls back to the connector's built-in domains when empty."
        />
      </div>
    </div>
  )
}

// Settings panel for `kind: 'remote'` connectors — captures the MCP server
// URL + API token (Basic auth). Live in the expanded row so admins can
// configure without leaving the connector list. The token field is a
// password input and the stored value never round-trips to the browser
// (api/navigator-config.mjs strips it on load → we see `hasToken: bool`
// only). Sending an empty apiToken on save preserves the stored one.
function RemoteMcpSettings({ connection, settings, onChange }) {
  const hasToken = Boolean(settings.hasToken)
  const [mcpUrl, setMcpUrl] = useState(settings.mcpUrl || connection.endpoint || '')
  const [apiToken, setApiToken] = useState('')
  const [authMode] = useState(settings.authMode || 'basic')
  const [testState, setTestState] = useState({ status: 'idle', message: '', tools: 0 })

  useEffect(() => {
    setMcpUrl(settings.mcpUrl || connection.endpoint || '')
    setApiToken('')
  }, [connection.id])

  function commit(patch) {
    onChange?.(patch)
  }

  async function testConnection() {
    setTestState({ status: 'testing', message: 'Calling tools/list…', tools: 0 })
    try {
      const res = await fetch('/api/connector-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mcpUrl,
          method: 'tools/list',
          params: {},
          auth: apiToken
            ? { type: 'header', headerName: 'Authorization', headerValue: `${authMode === 'cookie' ? `Cookie: ${settings.cookieName || ''}=${apiToken}` : `Basic ${apiToken}`}` }
            : (hasToken ? { type: 'none' } : { type: 'none' }),
        }),
      })
      const json = await res.json()
      if (json.ok) {
        const count = json.result?.tools?.length || 0
        setTestState({ status: 'ok', message: `Connected — ${count} tools discovered.`, tools: count })
      } else {
        setTestState({ status: 'error', message: json.error || 'Test failed', tools: 0 })
      }
    } catch (err) {
      setTestState({ status: 'error', message: err.message || 'Network error', tools: 0 })
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <Wrench size={12} className="text-[#0EA5E9]" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#52525B]">
          MCP server settings
        </span>
        <span className="text-[11px] text-[#94A3B8] font-normal">
          Remote MCP endpoint + API token. Use a read-only token for demos — admin tokens grant full write access to the app.
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1">MCP URL</div>
          <input
            type="url"
            value={mcpUrl}
            onChange={(e) => setMcpUrl(e.target.value)}
            onBlur={() => commit({ mcpUrl: mcpUrl.trim() })}
            placeholder="https://campsite.staffbase.com/mcp"
            className="w-full text-[12px] font-mono px-2 py-1.5 rounded border border-[#E5E7EB] focus:border-[#0EA5E9] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/40 text-[#111827] bg-white"
          />
        </label>
        <label className="block">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1 flex items-center gap-2">
            API token
            {hasToken && !apiToken && (
              <span className="text-[10px] font-normal text-[#16A34A] normal-case tracking-normal">✓ saved</span>
            )}
          </div>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            onBlur={() => {
              if (apiToken) commit({ apiToken, authMode })
            }}
            placeholder={hasToken ? '••••••••••••• (leave blank to keep)' : 'Paste API token from /studio/settings/security/api'}
            autoComplete="new-password"
            className="w-full text-[12px] font-mono px-2 py-1.5 rounded border border-[#E5E7EB] focus:border-[#0EA5E9] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/40 text-[#111827] bg-white"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={testConnection}
          disabled={!mcpUrl || testState.status === 'testing'}
          className="px-2.5 py-1 text-[11.5px] font-semibold rounded border border-[#E5E7EB] hover:border-[#0EA5E9] hover:text-[#0EA5E9] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testState.status === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
        {testState.status === 'ok' && (
          <span className="text-[11.5px] text-[#16A34A]">{testState.message}</span>
        )}
        {testState.status === 'error' && (
          <span className="text-[11.5px] text-[#B91C1C]">{testState.message}</span>
        )}
        {!hasToken && !apiToken && testState.status === 'idle' && (
          <span className="text-[11.5px] text-[#94A3B8]">No token configured — the orchestrator will skip this connector.</span>
        )}
      </div>
    </div>
  )
}

function HintField({ label, value, onChange, onBlur, placeholder, rows = 3, maxLength, hint }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="w-full text-[12px] px-2 py-1.5 rounded border border-[#E5E7EB] focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/40 text-[#111827] bg-white resize-y"
      />
      {hint && <div className="text-[10.5px] text-[#94A3B8] mt-0.5">{hint}</div>}
    </label>
  )
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{label}</div>
      <div className={`text-[12px] text-[#111827] ${mono ? 'font-mono' : ''} truncate`}>{value || '—'}</div>
    </div>
  )
}

function EmptyState({ filter }) {
  const label = filter === 'all' ? 'connections' : filter === 'toolkit' ? 'toolkits' : filter === 'handoff' ? 'handoffs' : 'search sources'
  return (
    <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl px-6 py-12 text-center">
      <p className="text-[14px] font-semibold text-[#374151]">No {label} yet</p>
      <p className="text-[12.5px] text-[#6B7280] mt-1">Click "Reset to defaults" in the header to bring the canonical seed back.</p>
    </div>
  )
}
