import React, { useState, useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Eye, RotateCcw, Bot, Wrench, BookOpen, Sparkles, Users, AlertCircle, ChevronRight, Building2, MapPin, Send, ChevronDown, ClipboardList } from 'lucide-react'
import { StudioShell } from '../../components/StudioShell'
import { useConfigStore } from '../AIAssistant/useConfigStore'
import { deriveLiveOrchestrator, deriveLiveOrchestratorFor, assistantVisibleTo } from '../AIAssistant/configStore'
import { pickRoleChips } from '../NavigatorOrchestrator/chipRules'
import { LogoChip } from './components/Catalog'

import AssistantsList from './tabs/AssistantsList'
import AssistantDetail from './tabs/AssistantDetail'
import TemplatesGallery from './tabs/TemplatesGallery'
import AssistantAiCreator from './tabs/AssistantAiCreator'
import MCPConnectorsList from './tabs/MCPConnectorsList'
import ExternalAgentsList from './tabs/ExternalAgentsList'
import KnowledgeBasesList from './tabs/KnowledgeBasesList'
import WorkspaceTab from './tabs/WorkspaceTab'

const TABS = [
  { id: 'assistants', label: 'Assistants',       icon: Sparkles },
  { id: 'agents',     label: 'External Agents',  icon: Bot      },
  { id: 'mcp',        label: 'MCP Connectors',   icon: Wrench   },
  { id: 'kb',         label: 'Knowledge',        icon: BookOpen },
  { id: 'workspace',  label: 'Workspace',        icon: Building2 },
]

/**
 * Navigator Studio — admin-side prototype.
 *
 * Top half: tab nav + tab content
 * Right rail: "View as" preview — pick a demo user, see exactly which
 *             assistants, MCPs, agents, and launchpad chips that user gets.
 * Bottom-left: cross-link to Employee prototype + Reset demo
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

  // Audience preview state — drives the right-rail "View as" selector.
  const demoUsers = config.demoUsers || []
  const [viewAsEmail, setViewAsEmail] = useState('')
  const viewAsUser = viewAsEmail ? (demoUsers.find(u => u.email === viewAsEmail) || null) : null
  const live = useMemo(
    () => viewAsUser ? deriveLiveOrchestratorFor(config, viewAsUser) : deriveLiveOrchestrator(config),
    [config, viewAsUser]
  )

  // Assistant CRUD
  function handleCreateAssistant() {
    navigate(`${basePath}/assistants/new`)
  }
  function handleOpenTemplates() {
    navigate(`${basePath}/assistants/templates`)
  }
  function handleOpenAiCreator() {
    navigate(`${basePath}/assistants/ai-create`)
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

  // Resolve which assistant detail to render. Two special routes:
  //   /assistants/templates   → Templates Gallery (Milestone B)
  //   /assistants/ai-create   → AI Creator       (Milestone C)
  let detailAssistant = null
  let detailIsNew = false
  const isTemplatesView = activeTabId === 'assistants' && detailId === 'templates'
  const isAiCreatorView = activeTabId === 'assistants' && detailId === 'ai-create'
  if (activeTabId === 'assistants' && detailId && !isTemplatesView && !isAiCreatorView) {
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
        audience: { everyone: true, roles: [], locations: [] },
        status: 'active',
      }
    } else {
      detailAssistant = config.assistants.find(a => a.id === detailId) || null
    }
  }

  const tenant = config.tenant || { name: 'Acme', brandColor: '#7C3AED', workspace: 'acme.staffbase.com' }

  return (
    <StudioShell activeSidebarItem="Navigator">
      <div className="flex-1 flex bg-white relative overflow-hidden">
        {/* Left: tab nav + content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header bar — Acme tenant strip */}
          <div className="border-b border-[#E5E7EB] px-8 pt-6 pb-0 bg-white">
            <div className="flex items-end justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-[18px] shrink-0"
                  style={{ background: tenant.brandColor || '#7C3AED' }}
                >
                  {(tenant.name || 'A').slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-[22px] font-bold text-[#111827] leading-none">{tenant.name || 'Acme'}</h1>
                    <span className="text-[11px] font-semibold text-[#7B5CE3] bg-[#F5F3FF] px-2 py-0.5 rounded-full">Navigator</span>
                  </div>
                  <p className="text-[12px] text-[#6B7280] font-mono mt-1">{tenant.workspace || 'acme.staffbase.com'}</p>
                </div>
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
            {activeTabId === 'assistants' && !detailAssistant && !isTemplatesView && !isAiCreatorView && (
              <AssistantsList
                assistants={config.assistants}
                mcpConnectors={config.mcpConnectors}
                externalAgents={config.externalAgents}
                knowledgeBases={config.knowledgeBases}
                onSelect={handleSelectAssistant}
                onCreate={handleCreateAssistant}
                onOpenTemplates={handleOpenTemplates}
                onOpenAiCreator={handleOpenAiCreator}
              />
            )}
            {isTemplatesView && (
              <TemplatesGallery
                tenant={tenant}
                existingAssistants={config.assistants}
                onBack={() => navigate(`${basePath}/assistants`)}
                onAdd={(asst) => {
                  setAssistants((prev) => {
                    const newId = `asst-tpl-${Date.now().toString(36)}`
                    return [{ ...asst, id: newId }, ...prev]
                  })
                  navigate(`${basePath}/assistants`)
                }}
              />
            )}
            {isAiCreatorView && (
              <AssistantAiCreator
                tenant={tenant}
                existingAssistants={config.assistants}
                onBack={() => navigate(`${basePath}/assistants`)}
                onSave={(asst) => {
                  setAssistants((prev) => {
                    const newId = `asst-ai-${Date.now().toString(36)}`
                    return [{ ...asst, id: newId }, ...prev]
                  })
                  navigate(`${basePath}/assistants`)
                }}
              />
            )}
            {activeTabId === 'assistants' && detailAssistant && (
              <AssistantDetail
                assistant={detailAssistant}
                isNew={detailIsNew}
                mcpConnectors={config.mcpConnectors}
                externalAgents={config.externalAgents}
                knowledgeBases={config.knowledgeBases}
                tenant={tenant}
                demoUsers={demoUsers}
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
            {activeTabId === 'workspace' && (
              <WorkspaceTab
                tenant={tenant}
                demoUsers={demoUsers}
                onReset={handleResetDemo}
              />
            )}
          </div>
        </div>

        {/* Right: "View as" preview — what THIS user will actually see */}
        <aside className="w-[360px] border-l border-[#E5E7EB] bg-[#F9FAFB] flex flex-col shrink-0 overflow-y-auto">
          <div className="px-5 pt-5 pb-4 border-b border-[#E5E7EB] sticky top-0 bg-[#F9FAFB] z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#7B5CE3]">View as</div>
            <ViewAsPicker value={viewAsEmail} onChange={setViewAsEmail} demoUsers={demoUsers} />
            <p className="text-[11px] text-[#6B7280] mt-2 leading-relaxed">
              {viewAsUser
                ? <>What <strong>{viewAsUser.name.split(' ')[0]}</strong> will see in Employee chat.</>
                : <>Workspace view — everything connected and active.</>}
            </p>
          </div>

          {viewAsUser
            ? <AudiencePreviewPanel user={viewAsUser} live={live} config={config} />
            : <OrchestratorImpactPanel live={live} config={config} />}

          {/* Trace preview — works in both modes */}
          <TracePreview config={config} viewAsUser={viewAsUser} />

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
 * "View as" dropdown — a native select rendered as a styled control. Lists all
 * demo users + a default "Workspace (no user)" option that drives the unscoped
 * impact view.
 */
function ViewAsPicker({ value, onChange, demoUsers }) {
  const selected = demoUsers.find(u => u.email === value)
  return (
    <div className="relative mt-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-white border border-[#E5E7EB] rounded-lg pl-3 pr-9 py-2.5 text-[13px] font-semibold text-[#111827] cursor-pointer focus:border-[#7C3AED] outline-none"
        style={selected ? { color: '#111827' } : {}}
      >
        <option value="">Workspace (no user)</option>
        {demoUsers.map(u => (
          <option key={u.email} value={u.email}>{u.name} — {u.role}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
      {selected && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold pointer-events-none" style={{ background: selected.color, marginLeft: -2 }}>
          {selected.avatar}
        </div>
      )}
    </div>
  )
}

/**
 * Audience preview — what the selected user will actually see in Employee chat.
 * Mirrors the Employee launchpad logic 1:1 via the shared `chipRules.js`.
 */
function AudiencePreviewPanel({ user, live, config }) {
  const capabilityIds = new Set([
    ...live.mcps.map(m => m.id),
    ...live.agents.map(a => a.id),
  ])
  const chips = pickRoleChips({ role: user.role, capabilities: capabilityIds, now: new Date() })

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Persona card */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0" style={{ background: user.color }}>
          {user.avatar}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-[#111827]">{user.name}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[11px] font-semibold" style={{ color: user.color }}>{user.role}</span>
            <span className="text-[10px] text-[#9CA3AF]">·</span>
            <span className="text-[11px] text-[#6B7280] flex items-center gap-1"><MapPin size={9} /> {user.location}</span>
          </div>
        </div>
      </div>

      <ImpactSection icon={<Sparkles size={11} />} title="Assistants visible" count={live.assistants.length}>
        {live.assistants.length === 0
          ? <Empty>No assistants reach this user</Empty>
          : live.assistants.map(a => (
              <ImpactRow key={a.id}>
                <span className="text-[14px]">{a.icon || '✨'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111827] truncate">{a.name}</div>
                  <div className="text-[10px] text-[#94A3B8] truncate">{a.audience?.everyone ? 'Everyone' : `${(a.audience?.roles || []).length} roles · ${(a.audience?.locations || []).length} locations`}</div>
                </div>
              </ImpactRow>
            ))}
      </ImpactSection>

      <ImpactSection icon={<ClipboardList size={11} />} title="Launchpad chips" count={chips.length}>
        {chips.length === 0
          ? <Empty>No chips — connect more capabilities</Empty>
          : chips.map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-2 rounded">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.kind === 'shift' ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]' : 'bg-[#F3F4F6] text-[#374151]'}`}>
                  {c.kind === 'shift' ? 'A2A' : 'tool'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111827] truncate">{c.label}</div>
                  <div className="text-[10px] text-[#94A3B8] truncate">{c.full}</div>
                </div>
              </div>
            ))}
      </ImpactSection>

      <ImpactSection icon={<Wrench size={11} />} title="MCPs reachable" count={live.mcps.length}>
        {live.mcps.length === 0
          ? <Empty>No MCPs reachable</Empty>
          : live.mcps.map(c => (
              <ImpactRow key={c.id}>
                <LogoChip name={c.name} color="#7C3AED" size={20} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111827] truncate">{c.name}</div>
                  <div className="text-[10px] text-[#94A3B8]">{c.tools?.length || 0} tools</div>
                </div>
              </ImpactRow>
            ))}
      </ImpactSection>

      <ImpactSection icon={<Bot size={11} />} title="Agents reachable" count={live.agents.length}>
        {live.agents.length === 0
          ? <Empty>No agents reachable</Empty>
          : live.agents.map(a => (
              <ImpactRow key={a.id}>
                <LogoChip name={a.name} color="#F59E0B" size={20} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111827] truncate">{a.name}</div>
                  <div className="text-[10px] text-[#94A3B8] truncate">{a.protocol || 'native'} · {a.capabilities?.length || 0} skills</div>
                </div>
              </ImpactRow>
            ))}
      </ImpactSection>
    </div>
  )
}

/**
 * Unscoped panel — what the workspace can do, regardless of user. Used when no
 * "View as" is selected. Same shape as before, plus a "Visible assistants" count
 * so admins can see exclusions exist at all.
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
      <ImpactSection icon={<Sparkles size={11} />} title="Active assistants" count={activeAssistants.length}>
        {activeAssistants.length === 0 ? (
          <Empty>No active assistants</Empty>
        ) : (
          activeAssistants.map(a => {
            const aud = a.audience || { everyone: true }
            const scope = aud.everyone
              ? 'Everyone'
              : `${(aud.roles || []).length} roles · ${(aud.locations || []).length} locations`
            return (
              <ImpactRow key={a.id}>
                <span className="text-[14px]">{a.icon || '✨'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111827] truncate">{a.name}</div>
                  <div className="text-[10px] text-[#94A3B8] truncate">{scope}</div>
                </div>
              </ImpactRow>
            )
          })
        )}
      </ImpactSection>

      <ImpactSection icon={<Wrench size={11} />} title="MCPs the chat can call" count={live.mcps.length}>
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

      <ImpactSection icon={<Bot size={11} />} title="Agents the chat can hand off to" count={live.agents.length}>
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

/**
 * Trace preview — type a sample question, see which assistant would handle it
 * and which MCP/agent it would route to. Pure client-side heuristic against
 * connected MCP `domains[]` / agent `capabilities[]`. Does NOT hit the
 * backend. Sells the "you can see what your config produces" story.
 */
function TracePreview({ config, viewAsUser }) {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState(null)

  function handleSubmit(e) {
    e?.preventDefault()
    const q = query.trim()
    if (!q) return
    const result = planRoute(q, config, viewAsUser)
    setSubmitted({ q, ...result })
  }

  return (
    <div className="px-5 py-4 border-t border-[#E5E7EB] bg-white">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#7B5CE3] mb-2">Trace preview</div>
      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What's my PTO balance?"
          className="flex-1 px-3 py-2 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
        />
        <button type="submit" className="px-2.5 bg-[#7C3AED] text-white rounded-lg hover:bg-[#6D28D9]">
          <Send size={13} />
        </button>
      </form>
      {submitted && (
        <div className="mt-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 space-y-1.5">
          <div className="text-[11px] text-[#6B7280] italic">"{submitted.q}"</div>
          {submitted.notRoutable ? (
            <div className="text-[11px] text-[#B91C1C] flex items-start gap-1">
              <AlertCircle size={11} className="mt-0.5 shrink-0" />
              <span>Out of scope — no connected capability matches.</span>
            </div>
          ) : (
            <div className="space-y-1">
              <TraceRow label="intent" value={submitted.intent} color="#7C3AED" />
              <TraceRow label="assistant" value={submitted.assistant?.name} color="#2563EB" />
              <TraceRow label="route" value={submitted.target?.name} color={submitted.kind === 'a2a' ? '#F59E0B' : '#0EA5E9'} />
              <TraceRow label="tool" value={submitted.tool} color="#475569" mono />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TraceRow({ label, value, color, mono = false }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-[9px] font-bold uppercase tracking-widest text-[#94A3B8] w-14 shrink-0">{label}</span>
      <span className={mono ? 'font-mono text-[#111827]' : 'font-semibold text-[#111827]'} style={{ borderLeft: `2px solid ${color}`, paddingLeft: 6 }}>{value}</span>
    </div>
  )
}

// String-match heuristic that mirrors how the backend orchestrator picks a
// server: scan connected MCP `domains[]` + agent `capabilities[]` and pick the
// first one whose any-token shows up in the query. Audience-aware when a user
// is selected (out-of-scope assistants are skipped).
function planRoute(query, config, viewAsUser) {
  const q = query.toLowerCase()
  const activeAssistants = (config.assistants || []).filter(a =>
    a.status === 'active' && (!viewAsUser || assistantVisibleTo(a, viewAsUser))
  )

  // Try each active assistant's connected sub-agents/MCPs in order.
  for (const asst of activeAssistants) {
    // Try A2A agents first — they handle whole-domain dialogs.
    for (const agentId of (asst.externalAgentIds || [])) {
      const agent = (config.externalAgents || []).find(a => a.id === agentId && a.status === 'connected')
      if (!agent) continue
      const caps = [...(agent.capabilities || []), ...(agent.domains || [])]
      if (caps.some(c => q.includes(c.toLowerCase()))) {
        return {
          intent: caps.find(c => q.includes(c.toLowerCase())) || 'task',
          assistant: asst,
          target: agent,
          tool: `${agent.id} (A2A delegate)`,
          kind: 'a2a',
        }
      }
    }
    // Then MCP connectors.
    for (const mcpId of (asst.mcpConnectorIds || [])) {
      const mcp = (config.mcpConnectors || []).find(m => m.id === mcpId && m.status === 'connected')
      if (!mcp) continue
      const domains = mcp.domains || []
      const hit = domains.find(d => q.includes(d.toLowerCase()))
      if (hit) {
        // Pick a tool whose name's tokens appear in the query, else the first.
        const tool = (mcp.tools || []).find(t => q.includes(t.name.toLowerCase().slice(0, 5))) || (mcp.tools || [])[0]
        return {
          intent: hit,
          assistant: asst,
          target: mcp,
          tool: tool ? `${mcp.id}.${tool.name}` : `${mcp.id}.(tools/list)`,
          kind: 'mcp',
        }
      }
    }
  }
  return { notRoutable: true }
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
    { label: 'Users',      value: config.demoUsers?.length || 0, icon: Users },
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
