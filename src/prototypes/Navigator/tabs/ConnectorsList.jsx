import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wrench, Bot, BookOpen, ChevronRight, ChevronDown, X, Plus, Power, AlertTriangle, Compass, ExternalLink } from 'lucide-react'
import { LogoChip } from '../components/Catalog'
import AddConnectorModal from './AddConnectorModal'

/**
 * Unified Connectors tab — replaces the three legacy tabs (MCP Connectors,
 * External Agents, Knowledge Bases). Each row is one connector, filterable
 * by kind. The shape is the same regardless of kind; only the icon, color,
 * and "tools" semantics differ.
 *
 * Props:
 *   connectors[]                 — full unified list
 *   assistants[]                 — for the "Used by" column
 *   onConnectorsChange(updater)  — write-through (status toggle, remove)
 */
export default function ConnectorsList({ connectors = [], assistants = [], onConnectorsChange }) {
  const [filter, setFilter] = useState('all') // all | mcp | agent | kb
  const [expandedId, setExpandedId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  const counts = useMemo(() => {
    const all = connectors.length
    const mcp = connectors.filter((c) => c.kind === 'mcp').length
    const agent = connectors.filter((c) => c.kind === 'agent').length
    const kb = connectors.filter((c) => c.kind === 'kb').length
    return { all, mcp, agent, kb }
  }, [connectors])

  const visible = useMemo(() => {
    if (filter === 'all') return connectors
    return connectors.filter((c) => c.kind === filter)
  }, [connectors, filter])

  const usedBy = (cid) =>
    assistants.filter((a) => (a.connectorIds || []).includes(cid))

  function handleToggleStatus(connector) {
    onConnectorsChange((prev) =>
      prev.map((c) => c.id === connector.id
        ? { ...c, status: c.status === 'connected' ? 'disconnected' : 'connected' }
        : c)
    )
  }
  function handleRemove(connector) {
    if (!window.confirm(`Remove ${connector.name}? Assistants and flows using it will lose those tools.`)) return
    onConnectorsChange((prev) => prev.filter((c) => c.id !== connector.id))
  }
  function handleAddCustomConnector(connector) {
    onConnectorsChange((prev) => [...prev, connector])
    setExpandedId(connector.id)
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Connectors</h1>
          <p className="text-[13px] text-[#6B7280] mt-1 max-w-2xl">
            Everything the chat can call — multi-tool MCP servers, single-tool A2A agents, and indexed knowledge bases. Same protocol underneath; the <span className="font-mono">kind</span> field decides how the orchestrator dispatches.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          title="Browse the integration marketplace or connect a custom MCP server."
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] hover:bg-[#1F2937] text-white text-[13px] font-semibold rounded-lg transition-colors"
        >
          <Plus size={15} />
          Add connector
        </button>
      </div>

      {/* Kind filter strip */}
      <div className="inline-flex items-center gap-1 border border-[#E5E7EB] rounded-lg p-0.5 bg-white mb-4">
        <KindButton id="all"   label="All"        count={counts.all}   active={filter === 'all'}   onClick={setFilter} />
        <KindButton id="mcp"   icon={<Wrench size={11} />}   label="MCPs"    count={counts.mcp}   active={filter === 'mcp'}   onClick={setFilter} />
        <KindButton id="agent" icon={<Bot size={11} />}      label="Agents"  count={counts.agent} active={filter === 'agent'} onClick={setFilter} />
        <KindButton id="kb"    icon={<BookOpen size={11} />} label="Knowledge" count={counts.kb}  active={filter === 'kb'}    onClick={setFilter} />
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
                        {c.kind === 'mcp'
                          ? `${(c.tools || []).length} tools`
                          : c.kind === 'agent'
                            ? 'invoke'
                            : `search · ${c.articleCount || 0} docs`}
                      </td>
                      <td className="px-4 py-3">
                        {using.length === 0
                          ? <span className="text-[11px] text-[#94A3B8] italic">No assistants</span>
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
                          <ExpandedRow connector={c} />
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
          existingIds={connectors.map((c) => c.id)}
          onClose={() => setAddOpen(false)}
          onAdd={handleAddCustomConnector}
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
  const Icon = kind === 'mcp' ? Wrench : kind === 'agent' ? Bot : BookOpen
  const label = kind === 'mcp' ? 'MCP' : kind === 'agent' ? 'Agent' : 'Knowledge'
  const color = kindColor(kind)
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold" style={{ background: `${color}1a`, color }}>
      <Icon size={10} />
      {label}
    </span>
  )
}

function kindColor(kind) {
  if (kind === 'agent') return '#F59E0B'
  if (kind === 'kb') return '#2563EB'
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

function ExpandedRow({ connector }) {
  const tools = connector.tools || []
  return (
    <div>
      {connector.description && (
        <p className="text-[12.5px] text-[#374151] mb-2">{connector.description}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Field label="Endpoint" value={connector.endpoint} mono />
        <Field label="Auth" value={connector.authMethod || '—'} />
        {connector.kind === 'kb' && <Field label="Source" value={connector.source || '—'} />}
        {connector.kind === 'agent' && <Field label="Protocol" value={connector.protocol || 'native'} />}
        {connector.provider && <Field label="OAuth provider" value={connector.provider} />}
        {connector.writeTools?.length > 0 && <Field label="Write tools" value={connector.writeTools.join(', ')} />}
      </div>
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
  const label = filter === 'all' ? 'connectors' : filter === 'mcp' ? 'MCP connectors' : filter === 'agent' ? 'agents' : 'knowledge bases'
  return (
    <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl px-6 py-12 text-center">
      <p className="text-[14px] font-semibold text-[#374151]">No {label} yet</p>
      <p className="text-[12.5px] text-[#6B7280] mt-1">Click "Reset to defaults" in the header to bring the canonical seed back.</p>
    </div>
  )
}
