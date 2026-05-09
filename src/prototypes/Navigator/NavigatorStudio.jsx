import React, { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Eye, RotateCcw, Bot, Wrench, BookOpen, Sparkles, Users, AlertCircle, ChevronRight } from 'lucide-react'
import { StudioShell } from '../../components/StudioShell'
import { useConfigStore } from '../AIAssistant/useConfigStore'
import { deriveLiveOrchestrator } from '../AIAssistant/configStore'
import { LogoChip } from './components/Catalog'

import AssistantsList from './tabs/AssistantsList'
import AssistantDetail from './tabs/AssistantDetail'
import MCPConnectorsList from './tabs/MCPConnectorsList'
import ExternalAgentsList from './tabs/ExternalAgentsList'
import KnowledgeBasesList from './tabs/KnowledgeBasesList'

const TABS = [
  { id: 'assistants', label: 'Assistants',       icon: Sparkles },
  { id: 'agents',     label: 'External Agents',  icon: Bot      },
  { id: 'mcp',        label: 'MCP Connectors',   icon: Wrench   },
  { id: 'kb',         label: 'Knowledge',        icon: BookOpen },
]

/**
 * Navigator Studio — admin-side prototype.
 *
 * Top half: tab nav + tab content
 * Right rail: live chat preview that reflects the persisted config
 * Bottom-left: cross-link to Employee prototype + Reset demo
 *
 * Routes:
 *   /prototypes/navigator-studio                       → Assistants list
 *   /prototypes/navigator-studio/assistants            → Assistants list
 *   /prototypes/navigator-studio/assistants/:id        → Assistant detail
 *   /prototypes/navigator-studio/assistants/new        → New assistant
 *   /prototypes/navigator-studio/agents                → External agents
 *   /prototypes/navigator-studio/mcp                   → MCP connectors
 *   /prototypes/navigator-studio/kb                    → Knowledge bases
 */
export default function NavigatorStudio() {
  const location = useLocation()
  const navigate = useNavigate()

  const {
    config,
    setMcpConnectors,
    setExternalAgents,
    setAssistants,
    setKnowledgeBases,
    resetConfig,
  } = useConfigStore()

  // Parse route
  const pathParts = location.pathname.split('/').filter(Boolean)
  const protoIdx = pathParts.indexOf('navigator-studio')
  const basePath = protoIdx !== -1 ? '/' + pathParts.slice(0, protoIdx + 1).join('/') : '/prototypes/navigator-studio'
  const activeTabId = pathParts[protoIdx + 1] || 'assistants'
  const detailId = pathParts[protoIdx + 2] || null

  // What the Employee orchestrator will actually see, given this config
  const live = deriveLiveOrchestrator(config)

  // Assistant CRUD
  function handleCreateAssistant() {
    navigate(`${basePath}/assistants/new`)
  }
  function handleSelectAssistant(a) {
    navigate(`${basePath}/assistants/${a.id}`)
  }
  function handleSaveAssistant(updated) {
    setAssistants((prev) => {
      if (updated.id && prev.find(a => a.id === updated.id)) {
        return prev.map(a => a.id === updated.id ? updated : a)
      }
      const newId = `asst-${Date.now().toString(36)}`
      return [{ ...updated, id: newId }, ...prev]
    })
    navigate(`${basePath}/assistants`)
  }
  function handleDeleteAssistant(a) {
    setAssistants((prev) => prev.filter(x => x.id !== a.id))
    navigate(`${basePath}/assistants`)
  }

  function handleResetDemo() {
    if (window.confirm('Reset all Navigator config to defaults? Clears your saved Studio state.')) {
      resetConfig()
      navigate(`${basePath}/assistants`)
    }
  }

  // Resolve which assistant detail to render
  let detailAssistant = null
  let detailIsNew = false
  if (activeTabId === 'assistants' && detailId) {
    if (detailId === 'new') {
      detailIsNew = true
      detailAssistant = {
        id: null,
        name: '',
        icon: '✨',
        description: '',
        instructions: '',
        mcpConnectorIds: [],
        externalAgentIds: [],
        knowledgeBaseIds: [],
        targetGroups: ['All Employees'],
        status: 'active',
      }
    } else {
      detailAssistant = config.assistants.find(a => a.id === detailId) || null
    }
  }

  return (
    <StudioShell activeSidebarItem="Navigator">
      <div className="flex-1 flex bg-white relative overflow-hidden">
        {/* Left: tab nav + content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header bar */}
          <div className="border-b border-[#E5E7EB] px-8 pt-6 pb-0 bg-white">
            <div className="flex items-end justify-between mb-4">
              <div>
                <h1 className="text-[22px] font-bold text-[#111827]">Navigator</h1>
                <p className="text-[12px] text-[#6B7280] mt-0.5">Configure assistants, sub-agents, and knowledge.</p>
              </div>
              <ConfigSummary config={config} />
            </div>

            <nav className="flex gap-1">
              {TABS.map((t) => {
                const Icon = t.icon
                const active = activeTabId === t.id
                return (
                  <Link
                    key={t.id}
                    to={`${basePath}/${t.id}`}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold border-b-2 transition-colors ${
                      active
                        ? 'border-[#111827] text-[#111827]'
                        : 'border-transparent text-[#6B7280] hover:text-[#111827]'
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {activeTabId === 'assistants' && !detailAssistant && (
              <AssistantsList
                assistants={config.assistants}
                mcpConnectors={config.mcpConnectors}
                externalAgents={config.externalAgents}
                knowledgeBases={config.knowledgeBases}
                onSelect={handleSelectAssistant}
                onCreate={handleCreateAssistant}
              />
            )}
            {activeTabId === 'assistants' && detailAssistant && (
              <AssistantDetail
                assistant={detailAssistant}
                isNew={detailIsNew}
                mcpConnectors={config.mcpConnectors}
                externalAgents={config.externalAgents}
                knowledgeBases={config.knowledgeBases}
                onBack={() => navigate(`${basePath}/assistants`)}
                onSave={handleSaveAssistant}
                onDelete={handleDeleteAssistant}
              />
            )}
            {activeTabId === 'agents' && (
              <ExternalAgentsList
                externalAgents={config.externalAgents}
                assistants={config.assistants}
                onExternalAgentsChange={setExternalAgents}
              />
            )}
            {activeTabId === 'mcp' && (
              <MCPConnectorsList
                mcpConnectors={config.mcpConnectors}
                assistants={config.assistants}
                onMcpConnectorsChange={setMcpConnectors}
              />
            )}
            {activeTabId === 'kb' && (
              <KnowledgeBasesList
                knowledgeBases={config.knowledgeBases}
                assistants={config.assistants}
                onKnowledgeBasesChange={setKnowledgeBases}
              />
            )}
          </div>
        </div>

        {/* Right: "what the orchestrator can see" — projection of THIS config
            into what the live employee chat will be allowed to route to. */}
        <aside className="w-[340px] border-l border-[#E5E7EB] bg-[#F9FAFB] flex flex-col shrink-0 overflow-y-auto">
          <div className="px-5 pt-5 pb-3 border-b border-[#E5E7EB] sticky top-0 bg-[#F9FAFB] z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#7B5CE3]">Employee orchestrator sees</div>
            <h3 className="text-[14px] font-bold text-[#111827] mt-0.5">Live capability map</h3>
            <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
              Only items connected AND linked to an active assistant reach the chat.
            </p>
          </div>

          <OrchestratorImpactPanel live={live} config={config} />

          <div className="px-5 py-4 border-t border-[#E5E7EB] mt-auto bg-white">
            <Link
              to="/prototypes/navigator-employee"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111827] text-white text-[13px] font-bold rounded-lg hover:bg-[#1F2937] transition-colors"
            >
              <Eye size={14} />
              Open Employee experience
              <ChevronRight size={14} />
            </Link>
            <button
              onClick={handleResetDemo}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 text-[12px] font-semibold text-[#6B7280] hover:text-[#111827] transition-colors"
            >
              <RotateCcw size={12} />
              Reset demo
            </button>
          </div>
        </aside>
      </div>
    </StudioShell>
  )
}

/**
 * The right-rail panel — enumerates exactly what the orchestrator chat will be
 * able to do given the current config. Reads from `deriveLiveOrchestrator(config)`
 * which intersects "connected" with "referenced by an active assistant".
 */
function OrchestratorImpactPanel({ live, config }) {
  const activeAssistants = (config.assistants || []).filter(a => a.status === 'active')
  const orphanMcps = (config.mcpConnectors || []).filter(c =>
    c.status === 'connected' && !live.mcps.find(x => x.id === c.id)
  )
  const orphanAgents = (config.externalAgents || []).filter(a =>
    a.status === 'connected' && !live.agents.find(x => x.id === a.id)
  )

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Active assistants */}
      <ImpactSection
        icon={<Sparkles size={11} />}
        title="Active assistants"
        count={activeAssistants.length}
      >
        {activeAssistants.length === 0 ? (
          <Empty>No active assistants</Empty>
        ) : (
          activeAssistants.map(a => (
            <ImpactRow key={a.id}>
              <span className="text-[14px]">{a.icon || '✨'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[#111827] truncate">{a.name}</div>
                <div className="text-[10px] text-[#94A3B8] truncate">
                  {(a.mcpConnectorIds?.length || 0) + (a.externalAgentIds?.length || 0)} sub-agent{((a.mcpConnectorIds?.length || 0) + (a.externalAgentIds?.length || 0)) === 1 ? '' : 's'}
                </div>
              </div>
            </ImpactRow>
          ))
        )}
      </ImpactSection>

      {/* Live MCPs */}
      <ImpactSection
        icon={<Wrench size={11} />}
        title="MCPs the chat can call"
        count={live.mcps.length}
      >
        {live.mcps.length === 0 ? (
          <Empty>No MCPs reachable</Empty>
        ) : (
          live.mcps.map(c => (
            <ImpactRow key={c.id}>
              <LogoChip name={c.name} color="#7C3AED" size={20} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[#111827] truncate">{c.name}</div>
                <div className="text-[10px] text-[#94A3B8]">{c.tools?.length || 0} tools</div>
              </div>
            </ImpactRow>
          ))
        )}
      </ImpactSection>

      {/* Live external agents */}
      <ImpactSection
        icon={<Bot size={11} />}
        title="Agents the chat can hand off to"
        count={live.agents.length}
      >
        {live.agents.length === 0 ? (
          <Empty>No agents reachable</Empty>
        ) : (
          live.agents.map(a => (
            <ImpactRow key={a.id}>
              <LogoChip name={a.name} color="#F59E0B" size={20} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[#111827] truncate">{a.name}</div>
                <div className="text-[10px] text-[#94A3B8] truncate">{a.protocol || 'native'} · {a.capabilities?.length || 0} skills</div>
              </div>
            </ImpactRow>
          ))
        )}
      </ImpactSection>

      {/* Orphan warning — connected but not referenced */}
      {(orphanMcps.length > 0 || orphanAgents.length > 0) && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-[#D97706] mt-0.5 shrink-0" />
          <div className="text-[11px] text-[#92400E] leading-relaxed">
            <strong>{orphanMcps.length + orphanAgents.length} connected but unused.</strong>{' '}
            Assign them to an assistant to reach the chat.
          </div>
        </div>
      )}
    </div>
  )
}

function ImpactSection({ icon, title, count, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
          <span className="text-[#7B5CE3]">{icon}</span>
          {title}
        </div>
        <span className="text-[10px] font-bold text-[#94A3B8]">{count}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function ImpactRow({ children }) {
  return <div className="flex items-center gap-2 py-1 px-2 rounded">{children}</div>
}

function Empty({ children }) {
  return <div className="text-[11px] text-[#94A3B8] italic px-2 py-1.5">{children}</div>
}

function ConfigSummary({ config }) {
  const stats = [
    { label: 'Assistants', value: config.assistants?.length || 0, icon: Sparkles },
    { label: 'Agents',     value: config.externalAgents?.filter(a => a.status === 'connected').length || 0, icon: Bot },
    { label: 'MCPs',       value: config.mcpConnectors?.filter(c => c.status === 'connected').length || 0, icon: Wrench },
    { label: 'KBs',        value: config.knowledgeBases?.length || 0, icon: BookOpen },
  ]
  return (
    <div className="flex items-center gap-4">
      {stats.map(s => {
        const Icon = s.icon
        return (
          <div key={s.label} className="flex items-center gap-1.5 text-[12px]">
            <Icon size={12} className="text-[#94A3B8]" />
            <span className="font-bold text-[#111827]">{s.value}</span>
            <span className="text-[#6B7280]">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}
