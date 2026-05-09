import React, { useState } from 'react'
import { Plus, Trash2, Bot, ChevronRight } from 'lucide-react'
import { AGENT_CATALOG } from '../../AIAssistant/configStore'
import { CatalogGrid, LogoChip, StatusPill } from '../components/Catalog'
import { CatalogDrawer } from './MCPConnectorsList'

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
  return (
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
