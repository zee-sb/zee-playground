import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, Sparkles, HeartHandshake, Briefcase, Megaphone, Wrench,
  GraduationCap, Users, Building2, Newspaper, ShieldCheck, Calendar, Hash,
  Loader2, AlertTriangle, AlertCircle, ExternalLink, Flame, ArrowRight,
  Check, RefreshCw, MessageCircle, Search, ChevronDown, ChevronUp,
} from 'lucide-react'
import { StudioShell } from '../../components/StudioShell'
import { useConfigStore } from '../AIAssistant/useConfigStore'

const ICON_MAP = {
  Sparkles, HeartHandshake, Briefcase, Megaphone, Wrench,
  GraduationCap, Users, Building2, Newspaper, ShieldCheck, Calendar, Hash,
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
}
const emojiForIcon = (name) => ICON_TO_EMOJI[name] || '✨'

const slug = (s) =>
  (s || 'cluster').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)

export default function NavigatorSetupStudio() {
  const { setAssistants, setKnowledgeBases } = useConfigStore()

  const [phase, setPhase] = useState('idle') // idle | discovering | ready | error
  const [discovery, setDiscovery] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [errorCode, setErrorCode] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState(null)

  const [includedClusterNames, setIncludedClusterNames] = useState(() => new Set())
  const [expandedPrompts, setExpandedPrompts] = useState(() => new Set())
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // When a discovery completes, switch every proposed Assistant on by default.
  useEffect(() => {
    if (!discovery?.proposedAssistants) return
    setIncludedClusterNames(new Set(discovery.proposedAssistants.map((a) => a.clusterName)))
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

  const toggleIncluded = (clusterName) => {
    setIncludedClusterNames((prev) => {
      const next = new Set(prev)
      if (next.has(clusterName)) next.delete(clusterName)
      else next.add(clusterName)
      return next
    })
  }

  const togglePromptExpanded = (clusterName) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev)
      if (next.has(clusterName)) next.delete(clusterName)
      else next.add(clusterName)
      return next
    })
  }

  const applyConfiguration = () => {
    if (!discovery?.proposedAssistants) return
    const selected = discovery.proposedAssistants.filter((a) => includedClusterNames.has(a.clusterName))
    if (selected.length === 0) {
      showToast('Select at least one Assistant before applying.')
      return
    }
    const now = Date.now()
    const channelById = new Map(discovery.channels.map((c) => [c.id, c]))

    const newKbs = selected.map((a, i) => ({
      id: `kb-setup-${slug(a.clusterName)}-${now}-${i}`,
      name: a.clusterName,
      source: 'Staffbase Channels',
      articleCount: (a.knowledgeSources || []).reduce((sum, ks) => {
        const ch = channelById.get(ks.channelId)
        return sum + (ch?.sampledPostCount || 0)
      }, 0),
    }))

    const newAssistants = selected.map((a, i) => {
      const sourceLines = (a.knowledgeSources || [])
        .map((ks) => `- ${ks.channelTitle} (${ks.url})`)
        .join('\n')
      return {
        id: `asst-setup-${slug(a.clusterName)}-${now}-${i}`,
        name: a.name,
        icon: emojiForIcon(a.lucideIcon),
        description: a.description,
        instructions: `${a.systemPromptSnippet}\n\nKnowledge sources:\n${sourceLines}`,
        mcpConnectorIds: [],
        externalAgentIds: [],
        knowledgeBaseIds: [newKbs[i].id],
        audience: { everyone: true, roles: [], locations: [] },
        status: 'active',
      }
    })

    setKnowledgeBases((prev) => [...(prev || []), ...newKbs])
    setAssistants((prev) => [...(prev || []), ...newAssistants])
    showToast(`Configuration applied — ${selected.length} ${selected.length === 1 ? 'Assistant' : 'Assistants'} added. Open Navigator Studio to review.`)
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
              <SectionDivider title="What we found" />
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

              <SectionDivider title="Proposed Navigator Setup" />
              <Phase3Proposal
                discovery={discovery}
                includedClusterNames={includedClusterNames}
                onToggleIncluded={toggleIncluded}
                expandedPrompts={expandedPrompts}
                onTogglePromptExpanded={togglePromptExpanded}
              />
            </>
          )}
        </div>

        {discovery && (
          <ApplyFooter
            selectedCount={includedClusterNames.size}
            totalCount={discovery.proposedAssistants.length}
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
          Discover your intranet and generate a ready-to-use Navigator configuration.
          One click pulls your channels and most-engaged posts, clusters them into topic groups,
          and proposes a named Assistant per group — complete with system prompts and knowledge links.
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
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[#F5F5F7] border border-[#E4E4E7] rounded-xl p-5 animate-pulse">
                <div className="h-3 bg-[#E4E4E7] rounded w-1/2 mb-3" />
                <div className="h-6 bg-[#E4E4E7] rounded w-2/3 mb-2" />
                <div className="h-3 bg-[#E4E4E7] rounded w-3/4" />
              </div>
            ))}
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

function SectionDivider({ title }) {
  return (
    <div className="mt-12 mb-5">
      <h2 className="text-[22px] font-bold tracking-tight text-[#18181B]">{title}</h2>
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
  discovery, includedClusterNames, onToggleIncluded,
  expandedPrompts, onTogglePromptExpanded,
}) {
  const assistants = discovery.proposedAssistants
  const channelById = new Map(discovery.channels.map((c) => [c.id, c]))

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

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {assistants.map((a) => {
          const Icon = resolveIcon(a.lucideIcon)
          const included = includedClusterNames.has(a.clusterName)
          const expanded = expandedPrompts.has(a.clusterName)
          return (
            <div
              key={a.clusterName}
              className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all flex flex-col ${
                included ? 'border-[#DDD6FE]' : 'border-[#E4E4E7] opacity-70'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: '#F5F3FF' }}>
                  <Icon size={18} className="text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold text-[#18181B] leading-tight">{a.name}</div>
                  <div className="text-[12px] text-[#A1A1AA] mt-0.5">{a.clusterName}</div>
                </div>
              </div>

              <p className="text-[13px] text-[#52525B] mt-3 leading-relaxed">{a.description}</p>

              <div className="mt-3">
                <button
                  onClick={() => onTogglePromptExpanded(a.clusterName)}
                  className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#71717A] hover:text-[#18181B] transition-colors"
                >
                  System prompt
                  {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <pre
                  className={`mt-1.5 font-mono text-[11.5px] bg-[#F5F5F7] border border-[#E4E4E7] rounded-lg p-2.5 text-[#3F3F46] whitespace-pre-wrap leading-relaxed ${
                    expanded ? '' : 'line-clamp-3'
                  }`}
                >{a.systemPromptSnippet}</pre>
              </div>

              <div className="mt-3 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] mb-2">Knowledge Sources</div>
                <div className="flex flex-wrap gap-1.5">
                  {(a.knowledgeSources || []).length === 0 && (
                    <span className="text-[12px] text-[#A1A1AA]">No channels matched.</span>
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
                  onClick={() => onToggleIncluded(a.clusterName)}
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

function ApplyFooter({ selectedCount, totalCount, onApply }) {
  return (
    <div className="fixed bottom-0 left-[240px] right-0 bg-white/95 backdrop-blur border-t border-[#E4E4E7] px-8 py-4 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background: '#F5F3FF' }}>
            <Sparkles size={16} className="text-[#7C3AED]" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#18181B]">
              {selectedCount} of {totalCount} {totalCount === 1 ? 'Assistant' : 'Assistants'} selected
            </div>
            <div className="text-[12px] text-[#71717A]">Will be added to your Navigator configuration.</div>
          </div>
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
            disabled={selectedCount === 0}
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
