import React, { useState } from 'react'
import { Plus, ChevronRight, Wrench, Bot, BookOpen, Users } from 'lucide-react'
import { MCP_CATALOG, AGENT_CATALOG } from '../../AIAssistant/configStore'
import { LogoChip, StatusPill } from '../components/Catalog'

/**
 * Assistants page — internal personas with sub-agent linking.
 *
 * Each row shows:
 *   - Identity (icon, name, description)
 *   - Sub-agents linked: MCP connector chips + External agent chips + KB count
 *   - Targeting groups
 *   - Status pill
 * Click a row to open the detail editor.
 */
export default function AssistantsList({
  assistants = [],
  mcpConnectors = [],
  externalAgents = [],
  knowledgeBases = [],
  onSelect,
  onCreate,
}) {
  const mcpById = new Map(mcpConnectors.map(c => [c.id, c]))
  const agentById = new Map(externalAgents.map(a => [a.id, a]))

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Assistants</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            User-facing personas. Each can call MCP tools, hand off to external agents, and ground in knowledge bases.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] text-white text-[13px] font-semibold rounded-lg hover:bg-[#1F2937] transition-colors"
        >
          <Plus size={15} />
          New assistant
        </button>
      </div>

      {assistants.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl py-12 px-6 text-center">
          <div className="text-[14px] font-semibold text-[#111827]">No assistants yet</div>
          <div className="text-[12px] text-[#6B7280] mt-1">Create one to start configuring sub-agents.</div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          {assistants.map((a, i) => {
            const linkedMcps = (a.mcpConnectorIds || []).map(id => mcpById.get(id)).filter(Boolean)
            const linkedAgents = (a.externalAgentIds || []).map(id => agentById.get(id)).filter(Boolean)
            const kbCount = (a.knowledgeBaseIds || []).length
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a)}
                className={`w-full text-left px-5 py-4 hover:bg-[#FAFAFA] transition-colors flex items-center gap-4 ${i > 0 ? 'border-t border-[#F1F5F9]' : ''}`}
              >
                <div className="text-[24px] shrink-0">{a.icon || '✨'}</div>
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[14px] text-[#111827]">{a.name}</span>
                      <StatusPill status={a.status === 'active' ? 'active' : 'inactive'} />
                    </div>
                    <p className="text-[12px] text-[#6B7280] mt-0.5 line-clamp-1">{a.description}</p>

                    {/* Sub-agent chips — the core of the "sub-agent thing" */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      {linkedAgents.length > 0 && (
                        <ChipGroup icon={<Bot size={11} />} label={`${linkedAgents.length} agent${linkedAgents.length === 1 ? '' : 's'}`}>
                          {linkedAgents.map(g => {
                            const cat = AGENT_CATALOG.find(c => c.id === g.catalogId)
                            return <Chip key={g.id} name={g.name} color={cat?.color} />
                          })}
                        </ChipGroup>
                      )}
                      {linkedMcps.length > 0 && (
                        <ChipGroup icon={<Wrench size={11} />} label={`${linkedMcps.length} MCP${linkedMcps.length === 1 ? '' : 's'}`}>
                          {linkedMcps.map(m => {
                            const cat = MCP_CATALOG.find(c => c.id === m.catalogId)
                            return <Chip key={m.id} name={m.name} color={cat?.color} />
                          })}
                        </ChipGroup>
                      )}
                      {kbCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                          <BookOpen size={11} />
                          {kbCount} KB{kbCount === 1 ? '' : 's'}
                        </span>
                      )}
                      {linkedAgents.length === 0 && linkedMcps.length === 0 && kbCount === 0 && (
                        <span className="text-[11px] text-[#94A3B8] italic">No sub-agents linked yet</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden md:flex items-center gap-1 text-[11px] text-[#6B7280]">
                      <Users size={11} />
                      <span>{(a.targetGroups || []).join(', ') || 'No targeting'}</span>
                    </div>
                    <ChevronRight size={16} className="text-[#9CA3AF]" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ChipGroup({ icon, label, children }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
        {icon}
        {label}
      </span>
      <span className="flex flex-wrap gap-1">{children}</span>
    </div>
  )
}

function Chip({ name, color }) {
  return (
    <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-[11px] font-medium text-[#374151]">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color || '#94A3B8' }} />
      {name}
    </span>
  )
}
