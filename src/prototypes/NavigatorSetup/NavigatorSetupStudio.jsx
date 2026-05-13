import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, Sparkles, HeartHandshake, Briefcase, Megaphone, Wrench,
  GraduationCap, Users, Building2, Newspaper, ShieldCheck, Calendar, Hash,
  Loader2, AlertTriangle, AlertCircle, ExternalLink, Flame, ArrowRight,
  Check, RefreshCw, MessageCircle, Search, ChevronDown, ChevronUp,
  Plane, Globe, Lightbulb, BookOpen, TrendingUp, Award, Coffee, Heart,
  Languages, Map as MapIcon, Pencil, Library, ScrollText, Brain,
} from 'lucide-react'
import { StudioShell } from '../../components/StudioShell'
import { useConfigStore } from '../AIAssistant/useConfigStore'

const ICON_MAP = {
  Sparkles, HeartHandshake, Briefcase, Megaphone, Wrench,
  GraduationCap, Users, Building2, Newspaper, ShieldCheck, Calendar, Hash,
  Plane, Globe, Lightbulb, BookOpen, TrendingUp, Award, Coffee, Heart,
}
const resolveIcon = (name) => ICON_MAP[name] || Sparkles

// Loose mapping so the saved Assistant icon (an emoji, per the existing schema)
// reflects whatever Lucide name the LLM picked.
const ICON_TO_EMOJI = {
  Sparkles: '✨',
  HeartHandshake: '💛',
  Briefcase: '💼',
  Megaphone: '📣',
  Wrench: '🔧',
  GraduationCap: '🎓',
  Users: '👥',
  Building2: '🏢',
  Newspaper: '📰',
  ShieldCheck: '🛡️',
  Calendar: '📅',
  Hash: '#️⃣',
  Plane: '✈️',
  Globe: '🌐',
  Lightbulb: '💡',
  BookOpen: '📖',
  TrendingUp: '📈',
  Award: '🏆',
  Coffee: '☕',
  Heart: '❤️',
}
const emojiForIcon = (name) => ICON_TO_EMOJI[name] || '✨'

// Human-readable locale labels for the language chips.
const LOCALE_NAMES = {
  en_US: 'English (US)', en_GB: 'English (UK)', en: 'English',
  de_DE: 'German', de: 'German', fr_FR: 'French', fr: 'French',
  es_ES: 'Spanish', es: 'Spanish', pt_BR: 'Portuguese (BR)', pt: 'Portuguese',
  it_IT: 'Italian', it: 'Italian', nl_NL: 'Dutch', nl: 'Dutch',
  pl_PL: 'Polish', pl: 'Polish', ja_JP: 'Japanese', ja: 'Japanese',
  zh_CN: 'Chinese (Simplified)', zh: 'Chinese',
}
const localeLabel = (l) => LOCALE_NAMES[l] || l

const slug = (s) =>
  (s || 'cluster').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)

export default function NavigatorSetupStudio() {
  const { setAssistants, setKnowledgeBases, setConfig } = useConfigStore()

  const [phase, setPhase] = useState('idle') // idle | discovering | ready | error
  const [discovery, setDiscovery] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [errorCode, setErrorCode] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState(null)

  const [includedAssistantKeys, setIncludedAssistantKeys] = useState(() => new Set())
  const [expandedPrompts, setExpandedPrompts] = useState(() => new Set())
  const [editedMainInstructions, setEditedMainInstructions] = useState('')
  const [includeWorkspaceConfig, setIncludeWorkspaceConfig] = useState(true)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // When a discovery completes, switch every proposed Assistant on by default,
  // and seed the editable main instructions from the LLM output.
  useEffect(() => {
    if (!discovery?.proposedAssistants) return
    setIncludedAssistantKeys(new Set(discovery.proposedAssistants.map((_, i) => i)))
    setEditedMainInstructions(discovery.workspace?.mainInstructions || '')
  }, [discovery])

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), [])

  const showToast = (msg) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  const runDiscover = async () => {
    setPhase('discovering')
    setErrorMsg(null)
    setErrorCode(null)
    try {
      const resp = await fetch('/api/navigator-setup?action=discover')
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setErrorMsg(body.error || `Discovery failed (${resp.status})`)
        setErrorCode(body.code || null)
        setPhase('error')
        return
      }
      setDiscovery(body)
      setPhase('ready')
    } catch (err) {
      setErrorMsg(err.message || 'Network error')
      setPhase('error')
    }
  }

  const runSearch = async (queryOverride) => {
    const q = (queryOverride ?? searchTerm).trim()
    if (!q) return
    setSearching(true)
    setSearchErr(null)
    setSearchResults(null)
    if (queryOverride) setSearchTerm(queryOverride)
    try {
      const resp = await fetch(`/api/navigator-setup?action=search-preview&query=${encodeURIComponent(q)}`)
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setSearchErr(body.error || `Search failed (${resp.status})`)
      } else {
        setSearchResults(body)
      }
    } catch (err) {
      setSearchErr(err.message || 'Network error')
    } finally {
      setSearching(false)
    }
  }

  const toggleIncluded = (idx) => {
    setIncludedAssistantKeys((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const togglePromptExpanded = (key) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const applyConfiguration = () => {
    if (!discovery?.proposedAssistants) return
    const selected = discovery.proposedAssistants
      .map((a, i) => ({ a, i }))
      .filter(({ i }) => includedAssistantKeys.has(i))
      .map(({ a }) => a)
    if (selected.length === 0 && !includeWorkspaceConfig) {
      showToast('Select at least one Assistant or enable Workspace config before applying.')
      return
    }
    const now = Date.now()
    const channelById = new Map(discovery.channels.map((c) => [c.id, c]))

    const newKbs = selected
      .filter((a) => (a.knowledgeSources || []).length > 0)
      .map((a, i) => ({
        id: `kb-setup-${slug(a.name)}-${now}-${i}`,
        name: a.clusterName === 'Universal' ? a.name : a.clusterName,
        source: 'Staffbase Channels',
        articleCount: (a.knowledgeSources || []).reduce((sum, ks) => {
          const ch = channelById.get(ks.channelId)
          return sum + (ch?.sampledPostCount || 0)
        }, 0),
      }))

    const kbByAssistant = new Map()
    let kbIdx = 0
    for (const a of selected) {
      if ((a.knowledgeSources || []).length > 0) {
        kbByAssistant.set(a, newKbs[kbIdx])
        kbIdx++
      }
    }

    const mainBlock = includeWorkspaceConfig && editedMainInstructions.trim()
      ? `# Main Navigator Instructions\n\n${editedMainInstructions.trim()}\n\n---\n\n`
      : ''
    const glossaryBlock = includeWorkspaceConfig && discovery.workspace?.glossary?.length
      ? `# Glossary\n\n${discovery.workspace.glossary.map((g) => `- **${g.term}** — ${g.definition}`).join('\n')}\n\n---\n\n`
      : ''

    const newAssistants = selected.map((a, i) => {
      const sourceLines = (a.knowledgeSources || [])
        .map((ks) => `- ${ks.channelTitle} (${ks.url})`)
        .join('\n')
      const kb = kbByAssistant.get(a)
      return {
        id: `asst-setup-${slug(a.name)}-${now}-${i}`,
        name: a.name,
        icon: emojiForIcon(a.lucideIcon),
        description: a.description,
        instructions: `${mainBlock}${glossaryBlock}# Role\n\n${a.systemPromptSnippet}${sourceLines ? `\n\n# Knowledge sources\n\n${sourceLines}` : ''}`,
        mcpConnectorIds: [],
        externalAgentIds: [],
        knowledgeBaseIds: kb ? [kb.id] : [],
        audience: { everyone: true, roles: [], locations: [] },
        status: 'active',
      }
    })

    if (newKbs.length) setKnowledgeBases((prev) => [...(prev || []), ...newKbs])
    if (newAssistants.length) setAssistants((prev) => [...(prev || []), ...newAssistants])

    if (includeWorkspaceConfig) {
      // Persist workspace-level discoveries into the tenant blob.
      setConfig((prev) => {
        const prevTenant = prev?.tenant || {}
        const discoveredLocations = (discovery.orgSignals?.locations || []).map((l) => l.name).filter(Boolean)
        const discoveredRoles = (discovery.orgSignals?.departments || []).map((d) => d.name).filter(Boolean)
        return {
          ...prev,
          tenant: {
            ...prevTenant,
            // Extend rather than overwrite — keep seed locations/roles, dedupe.
            locations: [...new Set([...(prevTenant.locations || []), ...discoveredLocations])],
            roles: [...new Set([...(prevTenant.roles || []), ...discoveredRoles])],
            // New fields — additive, won't break older Navigator Studio code that ignores them.
            companyName: discovery.workspace?.companyName || prevTenant.companyName || '',
            companyMission: discovery.workspace?.companyMission || prevTenant.companyMission || '',
            languages: discovery.languages || [],
            glossary: discovery.workspace?.glossary || [],
            systemPrompt: editedMainInstructions.trim(),
            workspaceFacts: discovery.workspace?.workspaceFacts || [],
            tone: discovery.workspace?.tone || [],
            questionTypes: discovery.workspace?.questionTypes || [],
            totalUsers: discovery.orgSignals?.totalUsers || prevTenant.totalUsers || null,
          },
        }
      })
    }

    const parts = []
    if (newAssistants.length) parts.push(`${newAssistants.length} ${newAssistants.length === 1 ? 'Assistant' : 'Assistants'}`)
    if (newKbs.length) parts.push(`${newKbs.length} knowledge ${newKbs.length === 1 ? 'base' : 'bases'}`)
    if (includeWorkspaceConfig) parts.push('workspace config')
    showToast(`Applied: ${parts.join(' · ')}. Open Navigator Studio to review.`)
  }

  return (
    <StudioShell activeSidebarItem="Navigator">
      <div className="flex-1 overflow-auto bg-[#F5F5F7]">
        <div className="max-w-[1200px] mx-auto px-8 py-8 pb-32">

          {errorCode === 'staffbase_token_missing' && (
            <TokenMissingBanner />
          )}

          <Phase1Hero
            phase={phase}
            onDiscover={runDiscover}
          />

          {phase === 'error' && errorCode !== 'staffbase_token_missing' && (
            <ErrorCard message={errorMsg} onRetry={runDiscover} />
          )}

          {discovery && (
            <>
              <SectionDivider title="Workspace overview" subtitle="The big picture — who works here, where, in what languages." />
              <WorkspaceOverview discovery={discovery} />

              <SectionDivider title="What we found" subtitle="Channels and posts powering the workspace right now." />
              <Phase2Results
                discovery={discovery}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                onSearchSubmit={() => runSearch()}
                searchResults={searchResults}
                searching={searching}
                searchErr={searchErr}
                onSuggestionClick={(q) => runSearch(q)}
              />

              <SectionDivider
                title="Main Navigator instructions"
                subtitle="The orchestrator-level system prompt every Assistant inherits. Edit before applying."
              />
              <MainInstructionsCard
                value={editedMainInstructions}
                onChange={setEditedMainInstructions}
                tone={discovery.workspace?.tone}
                workspaceFacts={discovery.workspace?.workspaceFacts}
                overview={discovery.workspace?.overview}
              />

              {discovery.workspace?.glossary?.length > 0 && (
                <>
                  <SectionDivider
                    title="Workspace glossary"
                    subtitle="Internal acronyms and program names Navigator should recognize."
                  />
                  <GlossaryCard glossary={discovery.workspace.glossary} />
                </>
              )}

              <SectionDivider
                title="Proposed Assistants"
                subtitle={`${discovery.proposedAssistants.length} Assistants — universal (HR, IT, etc.) plus content-driven from your channels.`}
              />
              <Phase3Proposal
                discovery={discovery}
                includedAssistantKeys={includedAssistantKeys}
                onToggleIncluded={toggleIncluded}
                expandedPrompts={expandedPrompts}
                onTogglePromptExpanded={togglePromptExpanded}
              />
            </>
          )}
        </div>

        {discovery && (
          <ApplyFooter
            selectedCount={includedAssistantKeys.size}
            totalCount={discovery.proposedAssistants.length}
            includeWorkspaceConfig={includeWorkspaceConfig}
            onToggleWorkspaceConfig={() => setIncludeWorkspaceConfig((v) => !v)}
            onApply={applyConfiguration}
          />
        )}

        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#18181B] text-white px-5 py-3 rounded-xl shadow-2xl text-[14px] font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <Check size={16} className="text-[#86EFAC]" />
            {toast}
          </div>
        )}
      </div>
    </StudioShell>
  )
}

// ── Phase 1 ────────────────────────────────────────────────────────────────

function Phase1Hero({ phase, onDiscover }) {
  const isDiscovering = phase === 'discovering'
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-2xl shadow-sm p-10 mb-6 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{ background: 'radial-gradient(circle at 85% 20%, #7C3AED 0%, transparent 60%)' }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: '#7C3AED' }}>
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-[11px] font-extrabold tracking-widest uppercase text-[#7C3AED]">Navigator · Setup</span>
        </div>
        <h1 className="text-[32px] font-bold tracking-tight text-[#18181B]">Navigator Setup</h1>
        <p className="text-[16px] text-[#71717A] mt-2 max-w-2xl leading-relaxed">
          One click analyzes your channels, posts, user directory, departments, and languages —
          then drafts a ready-to-use Navigator configuration: orchestrator instructions, a workspace
          glossary, and a full Assistant lineup (HR, IT, Onboarding, plus content-driven ones).
        </p>

        <button
          onClick={onDiscover}
          disabled={isDiscovering}
          className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-[15px] font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
          style={{ background: '#7C3AED' }}
        >
          {isDiscovering ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Discovering…
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Discover My Instance
              <ArrowRight size={16} />
            </>
          )}
        </button>

        {isDiscovering && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4 text-[12.5px] text-[#71717A]">
              <Loader2 size={14} className="animate-spin text-[#7C3AED]" />
              Pulling channels · posts · directory · drafting workspace config + Assistants
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-[#F5F5F7] border border-[#E4E4E7] rounded-xl p-5 animate-pulse">
                  <div className="h-3 bg-[#E4E4E7] rounded w-1/2 mb-3" />
                  <div className="h-6 bg-[#E4E4E7] rounded w-2/3 mb-2" />
                  <div className="h-3 bg-[#E4E4E7] rounded w-3/4" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TokenMissingBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 bg-[#FEF9C3] border border-[#FACC15] rounded-xl px-4 py-3">
      <AlertTriangle size={18} className="text-[#A16207] shrink-0 mt-0.5" />
      <div className="text-[13.5px] text-[#713F12] leading-relaxed">
        <strong>Staffbase API token not configured.</strong>{' '}
        Set <code className="bg-white px-1.5 py-0.5 rounded text-[12px] font-mono border border-[#FACC15]">STAFFBASE_API_TOKEN</code> in <code className="bg-white px-1.5 py-0.5 rounded text-[12px] font-mono border border-[#FACC15]">.env</code> to enable live discovery. The prototype will not be able to pull channels or posts until this is set.
      </div>
    </div>
  )
}

function ErrorCard({ message, onRetry }) {
  return (
    <div className="bg-white border border-[#FCA5A5] rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="text-[#DC2626] mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-[#991B1B] text-[15px]">Discovery failed</h3>
          <p className="text-[13.5px] text-[#7F1D1D] mt-1 break-words">{message}</p>
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#FCA5A5] hover:border-[#DC2626] text-[#991B1B] rounded-lg text-[13px] font-semibold transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionDivider({ title, subtitle }) {
  return (
    <div className="mt-12 mb-5">
      <h2 className="text-[22px] font-bold tracking-tight text-[#18181B]">{title}</h2>
      {subtitle && <p className="text-[13.5px] text-[#71717A] mt-1">{subtitle}</p>}
    </div>
  )
}

// ── Workspace Overview ─────────────────────────────────────────────────────

function WorkspaceOverview({ discovery }) {
  const { orgSignals, languages, workspace, pages, groups, channels } = discovery
  const totalUsers = orgSignals?.totalUsers || 0
  const sampledUsers = orgSignals?.sampledUsers || 0
  const departments = orgSignals?.departments || []
  const locations = orgSignals?.locations || []
  const topAuthors = orgSignals?.topAuthors || []
  const totalChannels = channels?.length || 0
  const totalPages = pages?.length || 0
  const totalGroups = groups?.length || 0

  return (
    <div className="space-y-4">
      {workspace?.overview && (
        <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F5F3FF] grid place-items-center shrink-0">
              <Brain size={16} className="text-[#7C3AED]" />
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">AI summary</div>
              {workspace.companyName && workspace.companyName !== 'this company' && (
                <div className="text-[15px] font-bold text-[#18181B] mt-1">{workspace.companyName}{workspace.companyMission ? ` — ${workspace.companyMission}` : ''}</div>
              )}
              <p className="text-[14px] text-[#18181B] mt-1 leading-relaxed">{workspace.overview}</p>
              {workspace.tone?.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  <span className="text-[11px] text-[#A1A1AA] uppercase tracking-wider mr-1 self-center font-semibold">Tone:</span>
                  {workspace.tone.map((t) => (
                    <span key={t} className="text-[11.5px] px-2 py-0.5 rounded-full bg-[#F5F3FF] border border-[#DDD6FE] text-[#5B21B6] font-medium">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Users" value={totalUsers.toLocaleString()} hint={sampledUsers ? `${sampledUsers}-user sample analyzed` : null} />
        <StatCard icon={Building2} label="Departments" value={departments.length} hint={departments.length === 15 ? 'top 15' : null} />
        <StatCard icon={MapIcon} label="Locations" value={locations.length} hint={locations.length === 15 ? 'top 15' : null} />
        <StatCard icon={Newspaper} label="Channels" value={totalChannels} />
        <StatCard icon={BookOpen} label="Pages" value={totalPages} />
        <StatCard icon={Languages} label="Languages" value={languages.length} hint={languages.length > 0 ? languages.slice(0, 2).map(localeLabel).join(', ') + (languages.length > 2 ? '…' : '') : null} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ListCard
          icon={Building2}
          title="Top departments"
          empty="No department data in directory."
          items={departments.slice(0, 8).map((d) => ({ label: d.name, value: d.count }))}
        />
        <ListCard
          icon={MapIcon}
          title="Top locations"
          empty="No location data in directory."
          items={locations.slice(0, 8).map((l) => ({ label: l.name, value: l.count }))}
        />
        <ListCard
          icon={Megaphone}
          title="Top contributors (50-post sample)"
          empty="No author signals."
          items={topAuthors.slice(0, 8).map((a) => ({ label: a.name, value: `${a.postCount} ${a.postCount === 1 ? 'post' : 'posts'}` }))}
        />
      </div>

      {totalGroups > 0 && (
        <GroupsCard groups={groups} />
      )}

      {totalPages > 0 && (
        <PagesCard pages={pages} />
      )}

      {workspace?.questionTypes?.length > 0 && (
        <QuestionTypesCard questionTypes={workspace.questionTypes} />
      )}

      {(orgSignals?.customFieldKeys?.length > 0 || workspace?.workspaceFacts?.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {workspace?.workspaceFacts?.length > 0 && (
            <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={14} className="text-[#D97706]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">Workspace facts</span>
              </div>
              <ul className="space-y-1.5">
                {workspace.workspaceFacts.map((f, i) => (
                  <li key={i} className="text-[13px] text-[#3F3F46] leading-relaxed">• {f}</li>
                ))}
              </ul>
            </div>
          )}
          {orgSignals?.customFieldKeys?.length > 0 && (
            <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Hash size={14} className="text-[#71717A]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">Custom profile fields</span>
              </div>
              <p className="text-[12px] text-[#71717A] mb-2">Workspace-specific fields detected in user profiles.</p>
              <div className="flex flex-wrap gap-1.5">
                {orgSignals.customFieldKeys.map((k) => (
                  <span key={k} className="text-[11.5px] px-2 py-0.5 rounded-md bg-[#F5F5F7] border border-[#E4E4E7] text-[#52525B] font-mono">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className="text-[#7C3AED]" />
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">{label}</div>
      </div>
      <div className="text-[26px] font-bold tracking-tight text-[#18181B]">{value}</div>
      {hint && <div className="text-[11px] text-[#A1A1AA] mt-0.5">{hint}</div>}
    </div>
  )
}

function ListCard({ icon: Icon, title, items, empty }) {
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-[#7C3AED]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">{title}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-[12.5px] text-[#A1A1AA] py-2">{empty}</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-[#18181B] font-medium truncate">{item.label}</span>
              <span className="text-[#71717A] shrink-0">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Groups ─────────────────────────────────────────────────────────────────

function GroupsCard({ groups }) {
  const deptGroups = groups.filter((g) => g.isDepartmentGroup)
  const otherGroups = groups.filter((g) => !g.isDepartmentGroup)
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-[#7C3AED]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">{groups.length} user {groups.length === 1 ? 'group' : 'groups'}</span>
      </div>
      <p className="text-[12px] text-[#71717A] mb-3">Departments + program/ERG opt-ins. Strong signal for org segmentation.</p>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
        {deptGroups.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5B21B6] mb-1.5">Departments</div>
            <ul className="space-y-1">
              {deptGroups.map((g) => (
                <li key={g.id} className="flex items-center gap-2 text-[13px]">
                  <Building2 size={11} className="text-[#7C3AED] shrink-0" />
                  <span className="text-[#18181B] truncate">{g.name.replace(/^Dep\.?\s*/i, '')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {otherGroups.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] mb-1.5">Programs &amp; opt-ins</div>
            <ul className="space-y-1">
              {otherGroups.map((g) => (
                <li key={g.id} className="flex items-center gap-2 text-[13px]">
                  <Hash size={11} className="text-[#71717A] shrink-0" />
                  <span className="text-[#18181B] truncate" title={g.description || ''}>{g.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pages ──────────────────────────────────────────────────────────────────

function PagesCard({ pages }) {
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen size={14} className="text-[#7C3AED]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
      </div>
      <p className="text-[12px] text-[#71717A] mb-3">Reference content (hubs, policies, guides) — deeper than news posts, ideal as Assistant knowledge sources.</p>
      <ul className="space-y-2 max-h-80 overflow-y-auto -mr-2 pr-2">
        {pages.map((p) => (
          <li key={p.id} className="flex items-start gap-3 py-1.5">
            <div className="w-7 h-7 rounded-md bg-[#F0F9FF] grid place-items-center shrink-0 mt-0.5">
              <BookOpen size={13} className="text-[#0284C7]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-[#18181B] truncate">{p.title || '(untitled page)'}</div>
              {p.description && <div className="text-[12px] text-[#71717A] line-clamp-1">{p.description}</div>}
            </div>
            {p.bodyLength > 0 && (
              <span className="text-[10.5px] text-[#52525B] bg-[#F5F5F7] border border-[#E4E4E7] rounded-md px-1.5 py-0.5 shrink-0 whitespace-nowrap" title="Content length">
                ~{Math.round(p.bodyLength / 100) * 100} chars
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Question types ─────────────────────────────────────────────────────────

function QuestionTypesCard({ questionTypes }) {
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle size={14} className="text-[#7C3AED]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">{questionTypes.length} question categories</span>
      </div>
      <p className="text-[12px] text-[#71717A] mb-3">What Navigator will handle, derived from the workspace content mix.</p>
      <div className="flex flex-wrap gap-2">
        {questionTypes.map((q, i) => (
          <span key={i} className="text-[12.5px] px-2.5 py-1 rounded-full bg-[#F5F3FF] border border-[#DDD6FE] text-[#5B21B6] font-medium">{q}</span>
        ))}
      </div>
    </div>
  )
}

// ── Main Navigator Instructions ────────────────────────────────────────────

function MainInstructionsCard({ value, onChange, tone, workspaceFacts, overview }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#F5F3FF] grid place-items-center">
            <ScrollText size={16} className="text-[#7C3AED]" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#18181B]">Orchestrator system prompt</div>
            <div className="text-[12px] text-[#71717A]">Inherited by every Assistant. ~{(value || '').split(/\s+/).filter(Boolean).length} words.</div>
          </div>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E4E7] hover:border-[#7C3AED] hover:text-[#7C3AED] text-[12.5px] font-semibold text-[#52525B] transition-colors"
        >
          <Pencil size={13} />
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      {editing ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={14}
          className="w-full font-mono text-[12.5px] leading-relaxed p-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#27272A]"
        />
      ) : (
        <pre className="font-mono text-[12.5px] leading-relaxed p-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg text-[#27272A] whitespace-pre-wrap max-h-[400px] overflow-y-auto">{value || '(empty)'}</pre>
      )}
    </div>
  )
}

// ── Glossary ───────────────────────────────────────────────────────────────

function GlossaryCard({ glossary }) {
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Library size={14} className="text-[#7C3AED]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">{glossary.length} {glossary.length === 1 ? 'term' : 'terms'}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
        {glossary.map((g, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-[12.5px] font-bold font-mono text-[#5B21B6] bg-[#F5F3FF] px-2 py-0.5 rounded border border-[#DDD6FE] shrink-0 whitespace-nowrap">{g.term}</span>
            <span className="text-[12.5px] text-[#3F3F46] leading-relaxed">{g.definition}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Phase 2 ────────────────────────────────────────────────────────────────

function Phase2Results({
  discovery, searchTerm, onSearchTermChange, onSearchSubmit,
  searchResults, searching, searchErr, onSuggestionClick,
}) {
  const stats = useMemo(() => ([
    { label: 'Total Channels', value: discovery.channels.length, hint: discovery.channels.length === 50 ? 'limited to 50' : null },
    { label: 'Posts Analyzed', value: discovery.meta?.postsAnalyzed ?? discovery.recentPosts.length, hint: 'recent + top engagement' },
    { label: 'Topic Clusters', value: discovery.topicClusters.length, hint: discovery.meta?.openAiUsed ? 'AI-derived' : 'fallback (1 per channel)' },
  ]), [discovery])

  const topByEngagement = useMemo(() => discovery.topPosts.slice(0, 5), [discovery])
  const suggestionChips = useMemo(
    () => discovery.topicClusters.slice(0, 3).map((c) => c.name),
    [discovery]
  )

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: what we found */}
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white border border-[#E4E4E7] rounded-2xl p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">{s.label}</div>
              <div className="text-[28px] font-bold tracking-tight text-[#18181B] mt-1">{s.value}</div>
              {s.hint && <div className="text-[11px] text-[#A1A1AA] mt-0.5">{s.hint}</div>}
            </div>
          ))}
        </div>

        <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[14px] text-[#18181B]">Channels</h3>
            <span className="text-[11px] text-[#A1A1AA]">post counts from 50-post sample</span>
          </div>
          <div className="max-h-80 overflow-y-auto -mr-2 pr-2 space-y-1.5">
            {discovery.channels.length === 0 && (
              <div className="text-[13px] text-[#71717A] py-4 text-center">No channels found.</div>
            )}
            {discovery.channels.map((c) => (
              <div key={c.id} className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-[#F5F5F7]">
                <div className="w-8 h-8 rounded-md bg-[#F5F3FF] grid place-items-center shrink-0">
                  <Hash size={14} className="text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-[#18181B] truncate">{c.title}</div>
                  {c.description && (
                    <div className="text-[12px] text-[#71717A] line-clamp-1">{c.description}</div>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-[#52525B] bg-[#F5F5F7] border border-[#E4E4E7] rounded-md px-2 py-0.5 shrink-0">
                  {c.sampledPostCount} {c.sampledPostCount === 1 ? 'post' : 'posts'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-[14px] text-[#18181B] mb-3">Top posts by engagement</h3>
          <div className="space-y-2.5">
            {topByEngagement.length === 0 && (
              <div className="text-[13px] text-[#71717A] py-2">No engagement data available.</div>
            )}
            {topByEngagement.map((p) => (
              <div key={p.id} className="flex items-start gap-3 py-1.5">
                <div className="w-7 h-7 rounded-md bg-[#FEF3C7] grid place-items-center shrink-0 mt-0.5">
                  <Flame size={14} className="text-[#D97706]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-[#18181B] line-clamp-1">{p.title}</div>
                  <div className="text-[12px] text-[#71717A]">{p.channel?.title || '—'}</div>
                </div>
                <div className="text-[11.5px] text-[#52525B] font-semibold whitespace-nowrap">
                  {(p.likes || 0) + (p.comments || 0)} ⚡
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: search preview */}
      <div className="space-y-4">
        <div className="bg-white border border-[#E4E4E7] rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-[14px] text-[#18181B]">What employees are reading</h3>
          <p className="text-[12.5px] text-[#71717A] mt-1 leading-relaxed">
            Preview how Navigator would surface content for a topic. Matches against post titles &amp; teasers.
          </p>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); onSearchSubmit() }}
          >
            <div className="flex-1 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                placeholder="e.g. benefits, IT, leadership"
                className="w-full pl-9 pr-3 py-2 text-[14px] bg-white border border-[#E4E4E7] rounded-lg focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!searchTerm.trim() || searching}
              className="px-4 py-2 rounded-lg text-white text-[13.5px] font-semibold disabled:opacity-60 transition-opacity"
              style={{ background: '#7C3AED' }}
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : 'Preview'}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#A1A1AA] font-semibold mr-1 self-center">Try:</span>
            {suggestionChips.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestionClick(s)}
                className="text-[12px] px-2.5 py-1 rounded-full bg-[#F5F3FF] hover:bg-[#EDE9FE] border border-[#DDD6FE] text-[#5B21B6] font-medium transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {!searchResults && !searching && !searchErr && (
              <div className="text-[13px] text-[#A1A1AA] py-6 text-center bg-[#FAFAFA] rounded-lg">
                Try a topic to see what surfaces.
              </div>
            )}

            {searchErr && (
              <div className="text-[13px] text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg px-3 py-2.5">
                {searchErr}
              </div>
            )}

            {searchResults && searchResults.hasResults && (
              <div className="space-y-2 pt-1">
                <div className="text-[11.5px] text-[#71717A] mb-1">
                  Top {searchResults.results.length} for <span className="font-semibold text-[#52525B]">"{searchResults.query}"</span>
                </div>
                {searchResults.results.map((r) => (
                  <a
                    key={r.id}
                    href={r.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-[#FAFAFA] hover:bg-[#F5F3FF] border border-[#E4E4E7] hover:border-[#DDD6FE] rounded-lg p-3 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13.5px] font-semibold text-[#18181B] flex-1 line-clamp-1">{r.title}</div>
                      <ExternalLink size={13} className="text-[#A1A1AA] group-hover:text-[#7C3AED] shrink-0 mt-0.5" />
                    </div>
                    <div className="text-[11.5px] text-[#71717A] mt-0.5">{r.channel?.title || '—'}</div>
                    {r.teaser && (
                      <div className="text-[12px] text-[#52525B] mt-1 line-clamp-2 leading-snug">{r.teaser}</div>
                    )}
                  </a>
                ))}
              </div>
            )}

            {searchResults && !searchResults.hasResults && (
              <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg px-3 py-2.5">
                <AlertCircle size={15} className="text-[#DC2626] shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-[#991B1B]">No content found for "{searchResults.query}"</div>
                  <div className="text-[12px] text-[#7F1D1D]">This is a gap Navigator would surface — a candidate for new content or a third-party connector.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Phase 3 ────────────────────────────────────────────────────────────────

function Phase3Proposal({
  discovery, includedAssistantKeys, onToggleIncluded,
  expandedPrompts, onTogglePromptExpanded,
}) {
  const assistants = discovery.proposedAssistants
  const channelById = new Map(discovery.channels.map((c) => [c.id, c]))
  const universalCount = assistants.filter((a) => a.alwaysInclude || a.clusterName === 'Universal').length
  const contentCount = assistants.length - universalCount

  return (
    <div>
      {!discovery.meta?.openAiUsed && (
        <div className="mb-4 flex items-start gap-2 bg-[#FEF9C3] border border-[#FACC15] rounded-xl px-3 py-2">
          <AlertTriangle size={14} className="text-[#A16207] shrink-0 mt-0.5" />
          <div className="text-[12px] text-[#713F12]">
            AI clustering unavailable ({discovery.meta?.fallbackReason || 'unknown'}). Showing a fallback proposal of one Assistant per channel.
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-4 text-[12.5px] text-[#52525B]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
          {universalCount} universal ({universalCount === 1 ? 'always-include Assistant' : 'always-include Assistants'})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#0EA5E9]" />
          {contentCount} content-driven (from your channels)
        </span>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {assistants.map((a, idx) => {
          const Icon = resolveIcon(a.lucideIcon)
          const included = includedAssistantKeys.has(idx)
          const expanded = expandedPrompts.has(idx)
          const isUniversal = a.alwaysInclude || a.clusterName === 'Universal'
          return (
            <div
              key={idx}
              className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all flex flex-col ${
                included ? (isUniversal ? 'border-[#DDD6FE]' : 'border-[#BAE6FD]') : 'border-[#E4E4E7] opacity-70'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                  style={{ background: isUniversal ? '#F5F3FF' : '#F0F9FF' }}
                >
                  <Icon size={18} className={isUniversal ? 'text-[#7C3AED]' : 'text-[#0284C7]'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold text-[#18181B] leading-tight">{a.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isUniversal && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F5F3FF] text-[#5B21B6] border border-[#DDD6FE]">Universal</span>
                    )}
                    <span className="text-[12px] text-[#A1A1AA]">{a.clusterName === 'Universal' ? '' : a.clusterName}</span>
                  </div>
                </div>
              </div>

              <p className="text-[13px] text-[#52525B] mt-3 leading-relaxed">{a.description}</p>

              {a.signalsUsed?.length > 0 && (
                <div className="mt-2 text-[11.5px] text-[#71717A] italic">
                  <span className="font-semibold not-italic text-[#52525B]">Signal: </span>
                  {a.signalsUsed[0]}
                </div>
              )}

              <div className="mt-3">
                <button
                  onClick={() => onTogglePromptExpanded(idx)}
                  className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#71717A] hover:text-[#18181B] transition-colors"
                >
                  System prompt
                  {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <pre
                  className={`mt-1.5 font-mono text-[11.5px] bg-[#F5F5F7] border border-[#E4E4E7] rounded-lg p-2.5 text-[#3F3F46] whitespace-pre-wrap leading-relaxed ${
                    expanded ? '' : 'line-clamp-4'
                  }`}
                >{a.systemPromptSnippet}</pre>
              </div>

              <div className="mt-3 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] mb-2">Knowledge sources</div>
                <div className="flex flex-wrap gap-1.5">
                  {(a.knowledgeSources || []).length === 0 && (
                    <span className="text-[12px] text-[#A1A1AA] italic">Workspace-wide (no specific channel)</span>
                  )}
                  {(a.knowledgeSources || []).map((ks) => {
                    const ch = channelById.get(ks.channelId)
                    const count = ch?.sampledPostCount ?? 0
                    return (
                      <a
                        key={ks.channelId}
                        href={ks.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#F5F3FF] hover:bg-[#EDE9FE] border border-[#DDD6FE] text-[12px] font-medium text-[#5B21B6] transition-colors"
                        title={`${count} ${count === 1 ? 'post' : 'posts'} in sample`}
                      >
                        {ks.channelTitle}
                        <ExternalLink size={11} />
                      </a>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                <span className={`text-[12px] font-semibold ${included ? 'text-[#166534]' : 'text-[#71717A]'}`}>
                  {included ? 'Included in setup' : 'Skipped'}
                </span>
                <button
                  onClick={() => onToggleIncluded(idx)}
                  role="switch"
                  aria-checked={included}
                  className={`relative w-10 h-6 rounded-full transition-colors ${included ? 'bg-[#7C3AED]' : 'bg-[#D4D4D8]'}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      included ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ApplyFooter({ selectedCount, totalCount, includeWorkspaceConfig, onToggleWorkspaceConfig, onApply }) {
  return (
    <div className="fixed bottom-0 left-[240px] right-0 bg-white/95 backdrop-blur border-t border-[#E4E4E7] px-8 py-3.5 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background: '#F5F3FF' }}>
              <Sparkles size={16} className="text-[#7C3AED]" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#18181B]">
                {selectedCount} of {totalCount} {totalCount === 1 ? 'Assistant' : 'Assistants'} selected
              </div>
              <div className="text-[12px] text-[#71717A]">
                Will append to Navigator. Existing Assistants stay.
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pl-4 border-l border-[#E4E4E7]">
            <input
              type="checkbox"
              checked={includeWorkspaceConfig}
              onChange={onToggleWorkspaceConfig}
              className="w-4 h-4 accent-[#7C3AED]"
            />
            <div>
              <div className="text-[12.5px] font-semibold text-[#18181B]">Include workspace config</div>
              <div className="text-[11px] text-[#71717A]">Main instructions · glossary · languages · departments</div>
            </div>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/prototypes/navigator-studio"
            className="text-[13.5px] font-semibold text-[#7C3AED] hover:underline inline-flex items-center gap-1"
          >
            Open Navigator Studio
            <ArrowRight size={14} />
          </Link>
          <button
            onClick={onApply}
            disabled={selectedCount === 0 && !includeWorkspaceConfig}
            className="px-5 py-2.5 rounded-xl text-white text-[14px] font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md inline-flex items-center gap-2"
            style={{ background: '#7C3AED' }}
          >
            <Check size={16} />
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  )
}
