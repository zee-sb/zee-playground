import React, { useState } from 'react'
import { Plus, Trash2, Bot, ChevronRight, ClipboardList, Camera, Thermometer, Hash, Check } from 'lucide-react'
import { AGENT_CATALOG } from '../../AIAssistant/configStore'
import { CatalogGrid, LogoChip, StatusPill } from '../components/Catalog'
import { CatalogDrawer } from './MCPConnectorsList'

// Per-role × phase checklist task counts. Mirrors the fixtures the Store Ops
// A2A backend serves to the Employee chat — kept here as a static preview so
// admins can see what's behind the agent before linking it to an assistant.
const STORE_OPS_MATRIX = {
  'Branch Manager':   { opening: { count: 7, types: ['checkbox', 'count', 'photo'] },     midshift: { count: 4, types: ['checkbox', 'photo'] },          closing: { count: 8, types: ['checkbox', 'count', 'photo'] } },
  'Line Cook':        { opening: { count: 6, types: ['checkbox', 'temp_log', 'photo'] },  midshift: { count: 5, types: ['checkbox', 'temp_log'] },       closing: { count: 7, types: ['checkbox', 'temp_log', 'count'] } },
  'Shift Supervisor': { opening: { count: 5, types: ['checkbox', 'count'] },               midshift: { count: 3, types: ['checkbox'] },                   closing: { count: 6, types: ['checkbox', 'count', 'photo'] } },
  'Cleaning Staff':   { opening: { count: 4, types: ['checkbox', 'photo'] },               midshift: { count: 3, types: ['checkbox'] },                   closing: { count: 5, types: ['checkbox', 'photo'] } },
}

const TASK_TYPE_META = {
  checkbox: { Icon: Check,        color: '#10B981', label: 'check'  },
  photo:    { Icon: Camera,       color: '#7C3AED', label: 'photo'  },
  temp_log: { Icon: Thermometer,  color: '#DC2626', label: 'temp'   },
  count:    { Icon: Hash,         color: '#F59E0B', label: 'count'  },
}

/**
 * External Agents page — full conversational agents Navigator can route to.
 * Distinct from MCP Connectors (which are tool servers).
 */
export default function ExternalAgentsList({ externalAgents = [], assistants = [], onExternalAgentsChange }) {
  const [showCatalog, setShowCatalog] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const usedBy = (agentId) =>
    assistants.filter(a => (a.externalAgentIds || []).includes(agentId))

  function handleAdd(catalogItem) {
    const newId = `agent-${catalogItem.id}-${Date.now().toString(36)}`
    const newAgent = {
      id: newId,
      catalogId: catalogItem.id,
      name: `${catalogItem.name} Agent`,
      description: 'New external agent. Configure capabilities and endpoint.',
      endpoint: `https://agents.acme.internal/${catalogItem.id}/v1/chat`,
      authMethod: catalogItem.auth,
      status: 'connected',
      capabilities: [],
      chatActionId: null, // not pre-wired to scenarios; only seed agents are
      addedAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    }
    onExternalAgentsChange((prev) => [newAgent, ...prev])
    setShowCatalog(false)
    setExpandedId(newId)
  }

  function handleToggleStatus(agent) {
    onExternalAgentsChange((prev) =>
      prev.map(a => a.id === agent.id
        ? { ...a, status: a.status === 'connected' ? 'disconnected' : 'connected' }
        : a
      )
    )
  }

  function handleRemove(agent) {
    if (!window.confirm(`Remove ${agent.name}? Assistants using it will lose this hand-off.`)) return
    onExternalAgentsChange((prev) => prev.filter(a => a.id !== agent.id))
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">External Agents</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Specialist conversational agents Navigator can hand off to. Different from MCP — these are full agents, not tool servers.
          </p>
        </div>
        <button
          onClick={() => setShowCatalog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] text-white text-[13px] font-semibold rounded-lg hover:bg-[#1F2937] transition-colors"
        >
          <Plus size={15} />
          Add agent
        </button>
      </div>

      {externalAgents.length === 0 ? (
        <EmptyState onCta={() => setShowCatalog(true)} />
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Agent</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Capabilities</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Used by</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {externalAgents.map((agent) => {
                const catalog = AGENT_CATALOG.find(x => x.id === agent.catalogId) || {}
                const using = usedBy(agent.id)
                const expanded = expandedId === agent.id
                return (
                  <React.Fragment key={agent.id}>
                    <tr className="border-t border-[#F1F5F9] hover:bg-[#FAFAFA] cursor-pointer" onClick={() => setExpandedId(expanded ? null : agent.id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <LogoChip name={catalog.name || agent.name} color={catalog.color} size={32} />
                          <div className="min-w-0">
                            <div className="font-semibold text-[#111827] truncate">{agent.name}</div>
                            <div className="text-[11px] text-[#94A3B8] truncate max-w-[260px]">
                              {catalog.name || agent.catalogId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">
                        {agent.capabilities?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {agent.capabilities.slice(0, 3).map(c => (
                              <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#475569] font-medium">
                                {c}
                              </span>
                            ))}
                            {agent.capabilities.length > 3 && (
                              <span className="text-[11px] text-[#94A3B8]">+{agent.capabilities.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#94A3B8]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {using.length === 0 ? (
                          <span className="text-[12px] text-[#94A3B8]">Not linked</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {using.slice(0, 2).map(a => (
                              <span key={a.id} className="text-[11px] px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4338CA] font-medium">
                                {a.name}
                              </span>
                            ))}
                            {using.length > 2 && (
                              <span className="text-[11px] text-[#94A3B8]">+{using.length - 2}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(agent) }} className="hover:opacity-80">
                          <StatusPill status={agent.status} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemove(agent) }}
                            className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={14} className={`text-[#94A3B8] transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-[#FAFAFA]">
                        <td colSpan={5} className="px-4 py-3 border-t border-[#F1F5F9]">
                          <AgentDetail agent={agent} />
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

      {showCatalog && (
        <CatalogDrawer onClose={() => setShowCatalog(false)} title="Add an external agent">
          <CatalogGrid items={AGENT_CATALOG} onPick={handleAdd} ctaLabel="Connect" />
        </CatalogDrawer>
      )}
    </div>
  )
}

function AgentDetail({ agent }) {
  const showStoreOpsMatrix = agent.id === 'store_ops_agent' || agent.protocol === 'a2a'
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">Description</div>
          <p className="text-[12px] text-[#475569] leading-relaxed">{agent.description}</p>
        </div>
        <div>
          <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">Connection</div>
          <div className="space-y-1 text-[12px]">
            <div className="flex gap-2">
              <span className="text-[#94A3B8] w-16 shrink-0">Endpoint</span>
              <span className="font-mono text-[#475569] truncate">{agent.endpoint}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#94A3B8] w-16 shrink-0">Auth</span>
              <span className="text-[#475569]">{agent.authMethod}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#94A3B8] w-16 shrink-0">Added</span>
              <span className="text-[#475569]">{agent.addedAt}</span>
            </div>
          </div>
        </div>
      </div>

      {showStoreOpsMatrix && agent.id === 'store_ops_agent' && (
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-3">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={13} className="text-[#F59E0B]" />
            <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest">Shift checklist matrix</div>
            <span className="text-[10px] text-[#94A3B8]">— read-only preview of what employees see per role × phase</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left">
                  <th className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Role</th>
                  <th className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Opening</th>
                  <th className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Mid-shift</th>
                  <th className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Closing</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(STORE_OPS_MATRIX).map(([role, phases]) => (
                  <tr key={role} className="border-t border-[#F1F5F9]">
                    <td className="px-2 py-2 font-semibold text-[#111827]">{role}</td>
                    {['opening', 'midshift', 'closing'].map(phase => (
                      <td key={phase} className="px-2 py-2">
                        <PhaseCell data={phases[phase]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function PhaseCell({ data }) {
  if (!data) return <span className="text-[#94A3B8]">—</span>
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-bold text-[#111827]">{data.count}</span>
      <span className="text-[10px] text-[#6B7280]">tasks</span>
      <span className="flex items-center gap-0.5">
        {data.types.map(t => {
          const meta = TASK_TYPE_META[t]
          if (!meta) return null
          const Icon = meta.Icon
          return (
            <span key={t} title={meta.label} className="inline-flex items-center justify-center w-5 h-5 rounded" style={{ background: `${meta.color}1A`, color: meta.color }}>
              <Icon size={10} />
            </span>
          )
        })}
      </span>
    </div>
  )
}

function EmptyState({ onCta }) {
  return (
    <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl py-12 px-6 text-center">
      <Bot size={28} className="mx-auto text-[#94A3B8] mb-3" />
      <div className="text-[14px] font-semibold text-[#111827]">No external agents connected</div>
      <div className="text-[12px] text-[#6B7280] mt-1 mb-4">Connect an agent from a provider to enable specialist hand-offs.</div>
      <button onClick={onCta} className="inline-flex items-center gap-2 px-4 py-2 bg-[#111827] text-white text-[12px] font-semibold rounded-lg hover:bg-[#1F2937]">
        <Plus size={14} />
        Browse providers
      </button>
    </div>
  )
}
