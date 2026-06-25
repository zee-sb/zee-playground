import React, { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Wrench, Bot, BookOpen, ChevronRight, ChevronDown, X, Plus, Power, AlertTriangle, Compass, ExternalLink, Sparkles, KeyRound } from 'lucide-react'
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
export default function ConnectorsList({ connections = [], experts = [], onConnectionsChange }) {
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
                          <ExpandedRow connection={c} onConnectionsChange={onConnectionsChange} />
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
  const Icon = kind === 'toolkit' ? Wrench : kind === 'handoff' ? Bot : BookOpen
  const label = kind === 'toolkit' ? 'Toolkit' : kind === 'handoff' ? 'Handoff' : 'Search'
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

// Microsoft 365 Copilot Retrieval — connector-specific config surfaced in the
// expanded row: the per-user OAuth connect affordance, the requested Graph
// scopes, and the admin path allowlist that compiles into the retrieval
// `filterExpression` (KQL). Path edits write through `onConnectionsChange`.
function MicrosoftConnectorPanel({ connection, onConnectionsChange }) {
  const [path, setPath] = useState('')
  const paths = connection.pathScopes || []
  const connected = connection.status === 'connected'
  const connectUrl = connection.connectEndpoint || '/api/connections/microsoft/connect'

  function updatePaths(next) {
    onConnectionsChange?.((prev) =>
      prev.map((c) => (c.id === connection.id ? { ...c, pathScopes: next } : c)))
  }
  function addPath() {
    const p = path.trim()
    if (!p || paths.includes(p)) { setPath(''); return }
    updatePaths([...paths, p])
    setPath('')
  }
  function removePath(p) {
    updatePaths(paths.filter((x) => x !== p))
  }

  return (
    <div className="mt-3 rounded-lg border border-[#DBEAFE] bg-[#F8FBFF] p-3">
      {/* OAuth grant */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8] flex items-center gap-1.5">
            <KeyRound size={11} /> Microsoft account
          </div>
          <div className="text-[12px] text-[#374151] mt-1">
            {connected
              ? <>Linked{connection.externalEmail ? <> as <span className="font-mono">{connection.externalEmail}</span></> : ''}. Retrieval runs on each user's own delegated token — Microsoft enforces their permissions.</>
              : <>Each employee grants a one-time OAuth consent. Until then this source returns no results.</>}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1.5">
            Scopes: {(connection.scopes || []).map((s) => <span key={s} className="font-mono mr-1.5">{s}</span>)}
          </div>
        </div>
        {!connected && (
          <a
            href={connectUrl}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-semibold"
          >
            <KeyRound size={12} /> Connect Microsoft account
          </a>
        )}
      </div>

      {/* Path scoping → KQL filterExpression */}
      <div className="mt-3 pt-3 border-t border-[#DBEAFE]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8]">SharePoint scope</div>
        <div className="text-[11.5px] text-[#64748B] mt-0.5 mb-2">
          Allowlist of site / library / folder paths to search. Empty = enabled but searches nothing. Compiled into the retrieval <span className="font-mono">filterExpression</span>.
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPath() } }}
            placeholder="https://contoso.sharepoint.com/sites/HR"
            spellCheck={false}
            className="flex-1 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[12px] font-mono outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          />
          <button
            type="button"
            onClick={addPath}
            disabled={!path.trim()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] text-[12px] font-semibold hover:bg-[#DBEAFE] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={12} /> Add path
          </button>
        </div>
        {paths.length > 0 && (
          <div className="mt-2 space-y-1">
            {paths.map((p) => (
              <div key={p} className="flex items-center gap-2 px-2 py-1 rounded bg-white border border-[#DBEAFE] text-[11.5px]">
                <span className="font-mono text-[#111827] truncate flex-1">{p}</span>
                <button
                  type="button"
                  onClick={() => removePath(p)}
                  className="text-[#94A3B8] hover:text-[#B91C1C] shrink-0"
                  aria-label={`Remove ${p}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ServiceNow ITSM — connector-specific config surfaced in the expanded row:
// the per-user OAuth connect affordance and the write tools that prompt for
// confirmation before they run. ServiceNow enforces the user's own roles/ACLs.
function ServiceNowConnectorPanel({ connection }) {
  const connected = connection.status === 'connected'
  // Return to the Studio Connections tab after the OAuth round-trip (instead of
  // the default companion-app landing).
  const base = connection.connectEndpoint || '/api/connections/servicenow/connect'
  const connectUrl = `${base}?return=${encodeURIComponent('/prototypes/navigator-studio/connections')}`
  const writeTools = connection.writeTools || []

  return (
    <div className="mt-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#15803D] flex items-center gap-1.5">
            <KeyRound size={11} /> ServiceNow account
          </div>
          <div className="text-[12px] text-[#374151] mt-1">
            {connected
              ? <>Linked{connection.externalEmail ? <> as <span className="font-mono">{connection.externalEmail}</span></> : ''}. Every tool call runs on the user's own token — ServiceNow enforces their roles and ACLs.</>
              : <>Each employee grants a one-time OAuth consent on the ServiceNow instance. Until then this connector returns no results.</>}
          </div>
        </div>
        {!connected && (
          <a
            href={connectUrl}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-[12px] font-semibold"
          >
            <KeyRound size={12} /> Connect ServiceNow account
          </a>
        )}
      </div>

      {writeTools.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#BBF7D0]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#15803D] flex items-center gap-1.5">
            <AlertTriangle size={11} /> Write actions
          </div>
          <div className="text-[11.5px] text-[#64748B] mt-0.5">
            {writeTools.map((t) => <span key={t} className="font-mono mr-1.5">{t}</span>)}
          </div>
          <div className="text-[11.5px] text-[#64748B] mt-1">
            These change ServiceNow records and require explicit user confirmation in chat before they run.
          </div>
        </div>
      )}
    </div>
  )
}

function ExpandedRow({ connection, onConnectionsChange }) {
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
        {connection.requiresLicense && <Field label="Requires" value={connection.requiresLicense} />}
        {connection.writeTools?.length > 0 && <Field label="Write tools" value={connection.writeTools.join(', ')} />}
      </div>

      {connection.provider === 'microsoft' && (
        <MicrosoftConnectorPanel connection={connection} onConnectionsChange={onConnectionsChange} />
      )}
      {connection.provider === 'servicenow' && (
        <ServiceNowConnectorPanel connection={connection} />
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
