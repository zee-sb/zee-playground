import React, { useState, useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Eye, RotateCcw, Bot, Wrench, BookOpen, Sparkles, Users, AlertCircle, ChevronRight, Building2, MapPin, Send, ChevronDown, ClipboardList, Workflow, Compass, ShieldCheck, Home } from 'lucide-react'
import { StudioShell } from '../../components/StudioShell'
import { useConfigStore } from '../AIAssistant/useConfigStore'
import { useActiveTenant } from '../AIAssistant/useActiveTenant'
import { deriveLiveOrchestrator, deriveLiveOrchestratorFor, assistantVisibleTo } from '../AIAssistant/configStore'
import { pickRoleChips } from './chipRules'
import { LogoChip } from './components/Catalog'
import HealthBadge from './components/HealthBadge'
import { useNavigatorHealth } from './hooks/useNavigatorHealth'

import AssistantsList from './tabs/AssistantsList'
import AssistantDetail from './tabs/AssistantDetail'
import TemplatesGallery from './tabs/TemplatesGallery'
import AssistantAiCreator from './tabs/AssistantAiCreator'
import ConnectorsList from './tabs/ConnectorsList'
import WorkspaceTab from './tabs/WorkspaceTab'
import FlowsList from './tabs/FlowsList'
import FlowDetail from './tabs/FlowDetail'
import HomeTab from './tabs/HomeTab'
import SystemPromptEditor from './tabs/SystemPromptEditor'

// Tabs:
//   home       — overview, system prompt, health summary, discovery link
//   assistants — list + detail CRUD
//   connectors — MCPs, agents, KBs
//   flows      — admin-defined flows
//   workspace  — employee directory + tenant settings
// (The previous standalone Health tab is folded into Home.)
const TABS = [
  { id: 'home',       label: 'Home',        icon: Home     },
  { id: 'assistants', label: 'Assistants',  icon: Sparkles },
  { id: 'connectors', label: 'Connectors',  icon: Wrench   },
  { id: 'flows',      label: 'Flows',       icon: Workflow },
  { id: 'workspace',  label: 'Workspace',   icon: Building2 },
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

  const { branchId, tenant: activeTenant } = useActiveTenant()
  const {
    config,
    blueprint,
    setConnectors,
    setAssistants,
    setFlows,
    resetConfig,
    reseed,
    saveMainInstructions,
    optimizeMainInstructions,
  } = useConfigStore({ branchId })
  const [resetting, setResetting] = useState(false)
  const [promptEditorOpen, setPromptEditorOpen] = useState(false)

  // Workspace-wide health rollup — drives the top banner + per-tab badge.
  // Same hook the Health tab uses, so toggling `deep` there is live everywhere.
  const health = useNavigatorHealth()

  // Parse route
  const pathParts = location.pathname.split('/').filter(Boolean)
  const protoIdx = pathParts.indexOf('navigator-studio')
  const basePath = protoIdx !== -1 ? '/' + pathParts.slice(0, protoIdx + 1).join('/') : '/prototypes/navigator-studio'
  // Default tab is now Home (was 'assistants' in earlier revs; Setup was always
  // a sibling). Legacy URLs hitting /setup or /health redirect transparently
  // to /home so existing bookmarks keep working.
  const rawTabId = pathParts[protoIdx + 1] || 'home'
  const activeTabId = (rawTabId === 'setup' || rawTabId === 'health') ? 'home' : rawTabId
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

  // Flow CRUD — same shape as assistant CRUD
  function handleCreateFlow() {
    navigate(`${basePath}/flows/new`)
  }
  function handleSelectFlow(f) {
    navigate(`${basePath}/flows/${f.id}`)
  }
  function handleSaveFlow(updated) {
    setFlows((prev) => {
      if (updated.id && prev.find(f => f.id === updated.id)) {
        return prev.map(f => f.id === updated.id ? updated : f)
      }
      const newId = `flow-${Date.now().toString(36)}`
      return [{ ...updated, id: newId }, ...prev]
    })
    navigate(`${basePath}/flows`)
  }
  function handleDeleteFlow(f) {
    setFlows((prev) => prev.filter(x => x.id !== f.id))
    navigate(`${basePath}/flows`)
  }

  async function handleResetDemo() {
    if (resetting) return
    const ok = window.confirm(
      'Reset Navigator to the default workspace? This wipes MCPs, Agents, KBs, Flows, and Assistants on the server and re-seeds them. Discovery, OAuth connections, and conversation history are preserved.'
    )
    if (!ok) return
    setResetting(true)
    try {
      const success = await reseed()
      if (!success) {
        // Server unreachable — fell back to local reset. Surface that.
        console.warn('[NavigatorStudio] reseed: server unreachable, used local reset')
      }
      navigate(`${basePath}/assistants`)
    } finally {
      setResetting(false)
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
        connectorIds: [],
        audience: { everyone: true, groups: [], roles: [], locations: [] },
        status: 'active',
      }
    } else {
      detailAssistant = config.assistants.find(a => a.id === detailId) || null
    }
  }

  // Resolve which flow detail to render
  let detailFlow = null
  let detailFlowIsNew = false
  if (activeTabId === 'flows' && detailId) {
    if (detailId === 'new') {
      detailFlowIsNew = true
      detailFlow = {
        id: null,
        name: '',
        trigger: '',
        goal: '',
        tools: [],
        mode: 'suggested',
        instructions: '',
        onComplete: null,
        status: 'active',
      }
    } else {
      detailFlow = (config.flows || []).find(f => f.id === detailId) || null
    }
  }

  // The active tenant (gallery picker) wins for name / workspace URL — the
  // seeded config blob defaults to Campsite, so without this overlay the
  // header would lie about which workspace we're editing.
  const seededTenant = config.tenant || {}
  const tenant = {
    name: activeTenant?.displayName || seededTenant.name || 'Staffbase',
    workspace: activeTenant?.workspaceUrl || seededTenant.workspace || 'campsite.staffbase.com',
    brandColor: seededTenant.brandColor || activeTenant?.brandColor || '#00C7B2',
    groups: seededTenant.groups || [],
  }

  return (
    <StudioShell activeSidebarItem="Navigator">
      <div className="flex-1 flex bg-white relative overflow-hidden">
        {/* Left: tab nav + content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header bar — Staffbase tenant strip */}
          <div className="border-b border-[#E5E7EB] px-8 pt-6 pb-0 bg-white">
            <div className="flex items-end justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-[18px] shrink-0"
                  style={{ background: tenant.brandColor || '#00C7B2' }}
                >
                  {(tenant.name || 'S').slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-[22px] font-bold text-[#111827] leading-none">{tenant.name || 'Staffbase'}</h1>
                    <span className="text-[11px] font-semibold text-[#7B5CE3] bg-[#F5F3FF] px-2 py-0.5 rounded-full">Navigator</span>
                  </div>
                  <p className="text-[12px] text-[#6B7280] font-mono mt-1">{tenant.workspace || 'campsite.staffbase.com'}</p>
                </div>
              </div>
              <button
                onClick={handleResetDemo}
                disabled={resetting}
                title="Reset MCPs, agents, KBs, flows, and assistants to the canonical seed. Discovery and OAuth connections are preserved."
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#7C3AED] hover:text-[#7C3AED] text-[12px] font-semibold text-[#374151] disabled:opacity-50 transition-colors"
              >
                <RotateCcw size={13} className={resetting ? 'animate-spin' : ''} />
                {resetting ? 'Resetting…' : 'Reset to defaults'}
              </button>
            </div>

            <nav className="flex gap-1">
              {TABS.map((t) => {
                const Icon = t.icon
                const active = activeTabId === t.id
                // Health rollup now hangs off the Home tab since Health is folded in.
                const isHome = t.id === 'home'
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
                    {isHome && health.summary && (health.summary.errors > 0 || health.summary.warnings > 0) && (
                      <HealthBadge summary={health.summary} />
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Health banner — sticky top warning when errors exist. */}
          {health.summary?.errors > 0 && activeTabId !== 'home' && (
            <button
              onClick={() => navigate(`${basePath}/home`)}
              className="w-full flex items-center justify-between gap-2 px-8 py-2 bg-[#FEF2F2] border-b border-[#FCA5A5] text-[#991B1B] text-[12.5px] font-semibold hover:bg-[#FEE2E2] transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <AlertCircle size={14} />
                Navigator has {health.summary.errors} error{health.summary.errors === 1 ? '' : 's'}
                {health.summary.warnings > 0 ? ` and ${health.summary.warnings} warning${health.summary.warnings === 1 ? '' : 's'}` : ''} — review now
              </span>
              <ChevronRight size={14} />
            </button>
          )}

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {activeTabId === 'assistants' && !detailAssistant && !isTemplatesView && !isAiCreatorView && (
              <AssistantsList
                assistants={config.assistants}
                connectors={config.connectors}
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
                connectors={config.connectors}
                tenant={tenant}
                demoUsers={demoUsers}
                onBack={() => navigate(`${basePath}/assistants`)}
                onSave={handleSaveAssistant}
                onDelete={handleDeleteAssistant}
              />
            )}
            {activeTabId === 'connectors' && (
              <ConnectorsList
                connectors={config.connectors}
                assistants={config.assistants}
                onConnectorsChange={setConnectors}
              />
            )}
            {activeTabId === 'flows' && !detailFlow && (
              <FlowsList
                flows={config.flows || []}
                onSelect={handleSelectFlow}
                onCreate={handleCreateFlow}
              />
            )}
            {activeTabId === 'flows' && detailFlow && (
              <FlowDetail
                flow={detailFlow}
                isNew={detailFlowIsNew}
                connectors={config.connectors || []}
                onBack={() => navigate(`${basePath}/flows`)}
                onSave={handleSaveFlow}
                onDelete={handleDeleteFlow}
              />
            )}
            {activeTabId === 'workspace' && (
              <WorkspaceTab tenant={tenant} demoUsers={demoUsers} />
            )}
            {activeTabId === 'home' && (
              <HomeTab
                tenant={tenant}
                config={config}
                blueprint={blueprint}
                basePath={basePath}
                onEditSystemPrompt={() => setPromptEditorOpen(true)}
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
              to="/prototypes/staffbase-companion"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111827] text-white text-[13px] font-bold rounded-lg hover:bg-[#1F2937] transition-colors"
            >
              <Eye size={14} />
              Open Companion
              <ChevronRight size={14} />
            </Link>
          </div>
        </aside>
      </div>

      {promptEditorOpen && (
        <SystemPromptEditor
          initialText={blueprint?.blueprint?.workspace?.mainInstructions || ''}
          onClose={() => setPromptEditorOpen(false)}
          onSave={saveMainInstructions}
          onOptimize={(text) => optimizeMainInstructions(text, config?.tenant?.audience || blueprint?.blueprint?.workspace?.audience || null)}
        />
      )}
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
  const capabilityIds = new Set((live.connectors || []).map((c) => c.id))
  const activeFlows = (config.flows || []).filter(f => f.status === 'active')
  const chips = pickRoleChips({
    role: user.role,
    group: user.group,
    daysSinceHire: user.daysSinceHire,
    capabilities: capabilityIds,
    flows: activeFlows,
    now: new Date(),
  })

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
                  <div className="text-[10px] text-[#94A3B8] truncate">{a.audience?.everyone ? 'Everyone' : `${(a.audience?.groups || a.audience?.roles || []).length} groups`}</div>
                </div>
              </ImpactRow>
            ))}
      </ImpactSection>

      <ImpactSection icon={<ClipboardList size={11} />} title="Launchpad chips" count={chips.length}>
        {chips.length === 0
          ? <Empty>No chips — connect more capabilities</Empty>
          : chips.map((c, i) => {
              const badge = c.kind === 'shift'
                ? { bg: '#FFFBEB', fg: '#92400E', border: '#FDE68A', label: 'A2A' }
                : c.kind === 'flow'
                  ? { bg: '#F5F3FF', fg: '#7C3AED', border: '#DDD6FE', label: 'Flow' }
                  : { bg: '#F3F4F6', fg: '#374151', border: 'transparent', label: 'tool' }
              return (
                <div key={i} className="flex items-center gap-2 py-1 px-2 rounded">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: badge.bg, color: badge.fg, border: `1px solid ${badge.border}` }}
                  >
                    {badge.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#111827] truncate">{c.label}</div>
                    <div className="text-[10px] text-[#94A3B8] truncate">{c.full}</div>
                  </div>
                </div>
              )
            })}
      </ImpactSection>

      <ImpactSection icon={<Workflow size={11} />} title="Flows available" count={activeFlows.length}>
        {activeFlows.length === 0
          ? <Empty>No flows configured</Empty>
          : activeFlows.map(f => (
              <ImpactRow key={f.id}>
                <Workflow size={12} className="text-[#7C3AED]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111827] truncate">{f.name}</div>
                  <div className="text-[10px] text-[#94A3B8] truncate">
                    {f.mode === 'required' ? 'Required' : 'Suggested'} · {(f.tools || []).length} tools
                  </div>
                </div>
              </ImpactRow>
            ))}
      </ImpactSection>

      <ImpactSection icon={<Wrench size={11} />} title="Connectors reachable" count={(live.connectors || []).length}>
        {(live.connectors || []).length === 0
          ? <Empty>No connectors reachable</Empty>
          : (live.connectors || []).map(c => {
              const color = c.kind === 'agent' ? '#F59E0B' : c.kind === 'kb' ? '#2563EB' : '#7C3AED'
              const sub = c.kind === 'mcp'
                ? `MCP · ${c.tools?.length || 0} tools`
                : c.kind === 'agent'
                  ? `Agent · ${c.protocol || 'native'}`
                  : `Knowledge · ${c.source || 'corpus'}`
              return (
                <ImpactRow key={c.id}>
                  <LogoChip name={c.name} color={color} size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#111827] truncate">{c.name}</div>
                    <div className="text-[10px] text-[#94A3B8] truncate">{sub}</div>
                  </div>
                </ImpactRow>
              )
            })}
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
  const activeFlows = (config.flows || []).filter(f => f.status === 'active')
  const liveConnectors = live.connectors || []
  const mcps = liveConnectors.filter((c) => c.kind === 'mcp')
  const agents = liveConnectors.filter((c) => c.kind === 'agent')
  const kbs = liveConnectors.filter((c) => c.kind === 'kb')
  const orphan = (config.connectors || []).filter((c) =>
    c.status === 'connected' && !liveConnectors.find((x) => x.id === c.id)
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
              : `${(aud.groups || aud.roles || []).length} groups`
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

      <ImpactSection icon={<Workflow size={11} />} title="Flows available" count={activeFlows.length}>
        {activeFlows.length === 0
          ? <Empty>No flows configured</Empty>
          : activeFlows.map(f => (
              <ImpactRow key={f.id}>
                <Workflow size={12} className="text-[#7C3AED]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111827] truncate">{f.name}</div>
                  <div className="text-[10px] text-[#94A3B8] truncate">
                    {f.mode === 'required' ? 'Required' : 'Suggested'} · {(f.tools || []).length} tools
                  </div>
                </div>
              </ImpactRow>
            ))}
      </ImpactSection>

      <ImpactSection icon={<Wrench size={11} />} title="MCPs the chat can call" count={mcps.length}>
        {mcps.length === 0
          ? <Empty>No MCPs reachable</Empty>
          : mcps.map(c => (
              <ImpactRow key={c.id}>
                <LogoChip name={c.name} color="#7C3AED" size={20} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111827] truncate">{c.name}</div>
                  <div className="text-[10px] text-[#94A3B8]">{c.tools?.length || 0} tools</div>
                </div>
              </ImpactRow>
            ))}
      </ImpactSection>

      <ImpactSection icon={<Bot size={11} />} title="Agents the chat can hand off to" count={agents.length}>
        {agents.length === 0
          ? <Empty>No agents reachable</Empty>
          : agents.map(c => (
              <ImpactRow key={c.id}>
                <LogoChip name={c.name} color="#F59E0B" size={20} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111827] truncate">{c.name}</div>
                  <div className="text-[10px] text-[#94A3B8] truncate">{c.protocol || 'native'} · {c.capabilities?.length || 0} skills</div>
                </div>
              </ImpactRow>
            ))}
      </ImpactSection>

      <ImpactSection icon={<BookOpen size={11} />} title="Knowledge bases the chat can search" count={kbs.length}>
        {kbs.length === 0
          ? <Empty>No knowledge bases reachable</Empty>
          : kbs.map(c => (
              <ImpactRow key={c.id}>
                <LogoChip name={c.name} color="#2563EB" size={20} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111827] truncate">{c.name}</div>
                  <div className="text-[10px] text-[#94A3B8] truncate">{c.source || 'Knowledge'} · {c.articleCount || 0} docs</div>
                </div>
              </ImpactRow>
            ))}
      </ImpactSection>

      {orphan.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-[#D97706] mt-0.5 shrink-0" />
          <div className="text-[11px] text-[#92400E] leading-relaxed">
            <strong>{orphan.length} connected but unused.</strong>{' '}
            Link them to an assistant or flow to reach the chat.
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
    // Walk linked connectors. Agents first (whole-domain dialogs), then
    // MCPs/KBs by domain match.
    const linked = (asst.connectorIds || [])
      .map((id) => (config.connectors || []).find((c) => c.id === id && c.status === 'connected'))
      .filter(Boolean)
    for (const c of linked.filter((x) => x.kind === 'agent')) {
      const caps = [...(c.capabilities || []), ...(c.domains || [])]
      if (caps.some((cap) => q.includes(String(cap).toLowerCase()))) {
        return {
          intent: caps.find((cap) => q.includes(String(cap).toLowerCase())) || 'task',
          assistant: asst,
          target: c,
          tool: `${c.id}__invoke`,
          kind: 'a2a',
        }
      }
    }
    for (const c of linked.filter((x) => x.kind !== 'agent')) {
      const domains = c.domains || []
      const hit = domains.find((d) => q.includes(String(d).toLowerCase()))
      if (hit) {
        const tool = c.kind === 'kb'
          ? `${c.id}__search`
          : ((c.tools || []).find((t) => q.includes(t.name.toLowerCase().slice(0, 5))) || (c.tools || [])[0])
              ? `${c.id}__${((c.tools || []).find((t) => q.includes(t.name.toLowerCase().slice(0, 5))) || (c.tools || [])[0]).name}`
              : `${c.id}.(tools/list)`
        return {
          intent: hit,
          assistant: asst,
          target: c,
          tool,
          kind: c.kind,
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

// (ConfigSummary removed in v7 — counts now live in the Setup tab's
// "Workspace overview" card, not the global header.)
function _ConfigSummaryRemoved() {
  return null
}
