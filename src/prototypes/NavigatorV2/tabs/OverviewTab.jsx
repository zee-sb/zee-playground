import React, { useEffect, useMemo, useState } from 'react'
import {
  Check, X, Pencil, ShieldCheck, CornerDownRight, Sparkles, Route, Layers, Workflow,
  Languages, FileText, CheckCircle2, ChevronDown, ChevronRight, Activity, Radar,
  ArrowUpRight, MessageSquare, Wrench, ExternalLink,
} from 'lucide-react'
import { Card, SectionTitle, CoverageBadge, TrendArrow, PrimaryButton, GhostButton, OriginBadge } from '../components'
import { deriveTuneChecks } from '../useV2Store'

/**
 * Overview — the Studio's home tab. Three layers, one surface:
 *   (a) compact stats header — the analytics surface (demand, citation
 *       rate, escalations, top gap)
 *   (b) Setup health strip — deriveTuneChecks rendered as in tune /
 *       needs attention, every issue with a one-click fix or deep-link
 *   (c) the question log — clustered demand + Navigator's proposals
 * In day-0 mode it additionally carries the "Navigator is live" moment,
 * the watching state, and the demand-driven suggestions.
 */

const PROPOSAL_KIND_META = {
  'gap-answer':  { icon: FileText,  label: 'Draft answer',     color: '#B91C1C', bg: '#FEF2F2' },
  'stale':       { icon: Route,     label: 'Stale content',    color: '#92400E', bg: '#FFFBEB' },
  'bundle':      { icon: Layers,    label: 'Capability bundle', color: '#067A6E', bg: '#E6FBF8' },
  'process':     { icon: Workflow,  label: 'Process suggestion', color: '#6D28D9', bg: '#F5F3FF' },
  'terminology': { icon: Languages, label: 'Terminology',      color: '#1D4ED8', bg: '#EFF6FF' },
}

export default function OverviewTab({ store, onNavigate }) {
  const { config, approveProposal, dismissProposal, applyTuneFix, applySuggestion, revealDueSuggestions, dismissLiveMoment } = store
  const stage = config.setup?.stage || 'demo'
  const clusters = config.questionClusters || []
  const proposals = config.proposals || []
  const suggestions = (config.day0Suggestions || []).filter((s) => s.status !== 'pending')

  // Day-0: drip-feed suggestions while the tab is open (and catch up
  // anything overdue immediately, e.g. after a reload).
  useEffect(() => {
    if (stage !== 'connected') return
    revealDueSuggestions()
    const t = setInterval(revealDueSuggestions, 1500)
    return () => clearInterval(t)
  }, [stage, revealDueSuggestions])

  const open = proposals.filter((p) => p.status === 'open')
  const resolved = proposals.filter((p) => p.status !== 'open')
  const checks = useMemo(() => deriveTuneChecks(config), [config])

  return (
    <div className="max-w-[860px] space-y-7 pb-12">
      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[20px] font-bold text-[#111827]">Overview</h1>
          <span className="text-[12px] text-[#6B7280]">{stage === 'connected' ? 'since connect' : 'last 7 days'}</span>
        </div>
        <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-[620px]">
          What employees ask, how well Navigator answers, and whether your setup is still in tune.
          You review — you never build.
        </p>
      </div>

      {/* (a) Stats header — the analytics surface */}
      <StatsHeader clusters={clusters} escalations={config.escalations || []} stage={stage} />

      {/* (b) Setup health strip */}
      <SetupHealth checks={checks} onFix={applyTuneFix} onNavigate={onNavigate} />

      {/* Day-0: the "Navigator is live" moment */}
      {stage === 'connected' && !config.setup?.liveDismissed && (
        <LiveMoment onDismiss={dismissLiveMoment} />
      )}

      {/* Day-0: demand-driven suggestions */}
      {suggestions.length > 0 && (
        <div>
          <SectionTitle count={suggestions.filter((s) => s.status === 'visible').length}>
            <span className="inline-flex items-center gap-2"><Radar size={15} className="text-[#00A593]" /> Navigator suggests</span>
          </SectionTitle>
          <div className="space-y-2.5">
            {suggestions.map((s) => <SuggestionCard key={s.id} suggestion={s} onApply={() => applySuggestion(s.id)} />)}
          </div>
        </div>
      )}

      {/* (c) Proposals — Navigator's drafts */}
      {(open.length > 0 || resolved.length > 0 || stage !== 'connected') && (
        <div>
          <SectionTitle count={open.length}>Needs your review</SectionTitle>
          {open.length === 0 ? (
            <Card className="px-5 py-6 text-center">
              <CheckCircle2 size={20} className="mx-auto text-[#16A34A] mb-2" />
              <div className="text-[13px] font-semibold text-[#111827]">All caught up</div>
              <div className="text-[12px] text-[#6B7280] mt-1">Navigator will surface the next proposal as demand emerges.</div>
            </Card>
          ) : (
            <div className="space-y-3">
              {open.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  onApprove={(edited) => approveProposal(p.id, edited)}
                  onDismiss={() => dismissProposal(p.id)}
                />
              ))}
            </div>
          )}
          {resolved.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {resolved.map((p) => (
                <div key={p.id} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[12px] ${p.status === 'approved' ? 'bg-[#F0FDF4] text-[#166534]' : 'bg-[#F9FAFB] text-[#9CA3AF]'}`}>
                  {p.status === 'approved' ? <Check size={13} className="mt-0.5 shrink-0" /> : <X size={13} className="mt-0.5 shrink-0" />}
                  <span>
                    <strong>{p.status === 'approved' ? 'Approved' : 'Dismissed'}:</strong> {p.title}
                    {p.status === 'approved' && <> — {p.resolution || p.effect}</>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question clusters — or the watching state */}
      <div>
        <SectionTitle count={clusters.length}>Question clusters</SectionTitle>
        {clusters.length === 0 ? (
          <WatchingCard />
        ) : (
          <Card>
            {clusters.map((c, i) => (
              <ClusterRow key={c.id} cluster={c} proposal={proposals.find((p) => p.id === c.proposalId)} last={i === clusters.length - 1} />
            ))}
          </Card>
        )}
      </div>

      {/* Privacy affordance */}
      <div className="flex items-start gap-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-3">
        <ShieldCheck size={15} className="text-[#00A593] mt-0.5 shrink-0" />
        <p className="text-[12px] text-[#6B7280] leading-relaxed">
          <strong className="text-[#374151]">Privacy by design.</strong> Clusters with fewer than 5 askers are hidden,
          and no verbatim quotes are shown by default — only anonymized themes. Question-log access is
          works-council reviewable.
        </p>
      </div>
    </div>
  )
}

// ── (a) Stats header ─────────────────────────────────────────────────────────

function StatsHeader({ clusters, escalations, stage }) {
  const total = clusters.reduce((n, c) => n + c.count, 0)
  const answered = clusters.filter((c) => c.coverage === 'answered').reduce((n, c) => n + c.count, 0)
  const partial = clusters.filter((c) => c.coverage === 'partial').reduce((n, c) => n + c.count, 0)
  const citedPct = total > 0 ? Math.round(((answered + partial * 0.6) / total) * 100) : null
  const openEsc = escalations.filter((e) => e.status === 'open').length
  const gaps = clusters.filter((c) => c.coverage === 'gap').sort((a, b) => b.count - a.count)
  const trendingUp = clusters.filter((c) => c.trend === 'up').length
  const watching = stage === 'connected' && total === 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
      <StatCard icon={MessageSquare} value={watching ? '—' : total} label="questions" sub={watching ? 'watching…' : 'this week'} />
      <StatCard icon={Check} value={citedPct === null ? '—' : `${citedPct}%`} label="answered with citations" sub={citedPct === null ? 'no data yet' : '+6 pts vs last week'} good={citedPct !== null && citedPct >= 50} />
      <StatCard icon={Route} value={openEsc} label="open escalations" sub="routed to humans" warn={openEsc > 2} />
      <StatCard icon={Activity} value={gaps.length ? gaps[0].count : 0} label="top gap" sub={gaps.length ? gaps[0].theme : 'no open gaps'} warn={gaps.length > 0} />
      <StatCard icon={ArrowUpRight} value={trendingUp} label="themes trending up" sub={trendingUp > 0 ? 'demand shifting' : 'steady'} />
    </div>
  )
}

function StatCard({ icon: Icon, value, label, sub, warn, good }) {
  return (
    <div className={`px-3.5 py-3 rounded-xl border bg-white ${warn ? 'border-[#FECACA]' : good ? 'border-[#99E8DE]' : 'border-[#E5E7EB]'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className={warn ? 'text-[#B91C1C]' : good ? 'text-[#067A6E]' : 'text-[#9CA3AF]'} />
        <span className={`text-[17px] font-bold leading-none ${warn ? 'text-[#B91C1C]' : good ? 'text-[#067A6E]' : 'text-[#111827]'}`}>{value}</span>
      </div>
      <div className="text-[10.5px] font-semibold text-[#6B7280] leading-tight">{label}</div>
      <div className="text-[10px] text-[#9CA3AF] mt-0.5 leading-tight truncate" title={sub}>{sub}</div>
    </div>
  )
}

// ── (b) Setup health strip ───────────────────────────────────────────────────

const SEVERITY_META = {
  error: { dot: '#DC2626', label: 'blocking' },
  warn:  { dot: '#D97706', label: 'attention' },
  info:  { dot: '#9CA3AF', label: 'hint' },
}

function SetupHealth({ checks, onFix, onNavigate }) {
  const serious = checks.filter((c) => c.severity !== 'info')
  const hints = checks.filter((c) => c.severity === 'info')
  const inTune = serious.length === 0
  const [expanded, setExpanded] = useState(serious.length > 0)

  // Auto-collapse when the last serious issue is fixed; re-open when one appears.
  useEffect(() => { if (serious.length > 0) setExpanded(true) }, [serious.length])

  return (
    <div className={`rounded-xl border overflow-hidden ${inTune ? 'border-[#BBF7D0] bg-[#F0FDF4]' : 'border-[#FDE68A] bg-[#FFFBEB]'}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2.5 px-4 py-3 text-left">
        <Wrench size={15} className={inTune ? 'text-[#16A34A]' : 'text-[#D97706]'} />
        <span className={`text-[13px] font-bold ${inTune ? 'text-[#166534]' : 'text-[#92400E]'}`}>
          {inTune
            ? hints.length > 0 ? `Setup is in tune · ${hints.length} ${hints.length === 1 ? 'hint' : 'hints'}` : 'Setup is in tune'
            : `Setup needs attention · ${serious.length} ${serious.length === 1 ? 'issue' : 'issues'}${hints.length ? ` + ${hints.length} ${hints.length === 1 ? 'hint' : 'hints'}` : ''}`}
        </span>
        <span className={`text-[11px] ${inTune ? 'text-[#16A34A]' : 'text-[#B45309]'} ml-1 hidden sm:inline`}>
          {inTune ? 'sources, policies, routes and processes are consistent' : 'something drifted between your sources and your settings'}
        </span>
        <span className="ml-auto shrink-0">
          {checks.length > 0 && (expanded ? <ChevronDown size={14} className="text-[#9CA3AF]" /> : <ChevronRight size={14} className="text-[#9CA3AF]" />)}
        </span>
      </button>

      {expanded && checks.length > 0 && (
        <div className="border-t border-black/5 divide-y divide-black/5 bg-white/60">
          {checks.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SEVERITY_META[c.severity].dot }} title={SEVERITY_META[c.severity].label} />
              <p className="flex-1 min-w-[240px] text-[12px] text-[#374151] leading-relaxed">{c.text}</p>
              <div className="flex items-center gap-2 shrink-0">
                {c.fix && (
                  <button
                    onClick={() => onFix(c.fix)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white"
                    style={{ background: '#00A593' }}
                  >
                    <Check size={11} /> {c.fix.label}
                  </button>
                )}
                {c.link && (
                  <button
                    onClick={() => onNavigate(c.link.tab)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6B7280] hover:text-[#00A593]"
                  >
                    {c.link.label} <ExternalLink size={10} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Day-0 pieces ─────────────────────────────────────────────────────────────

function LiveMoment({ onDismiss }) {
  return (
    <div className="rounded-xl border border-[#99E8DE] bg-[#F7FEFC] overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <CheckCircle2 size={15} className="text-[#00A593]" />
        <span className="text-[13.5px] font-bold text-[#067A6E]">Navigator is live.</span>
        <span className="text-[12px] text-[#067A6E]">Employees can ask it anything the intranet knows — try it:</span>
        <button onClick={onDismiss} className="ml-auto text-[#9CA3AF] hover:text-[#374151] p-1" aria-label="Dismiss"><X size={13} /></button>
      </div>
      {/* Sample cited answer — what an employee sees right now */}
      <div className="mx-4 my-3 bg-white border border-[#EFEFF1] rounded-xl px-3.5 py-3 shadow-sm max-w-[520px]">
        <div className="text-[11px] font-bold text-[#9CA3AF] mb-1.5">“How many home-office days can I take per week?”</div>
        <p className="text-[12.5px] text-[#1F2937] leading-relaxed">
          Up to 3 days per week, agreed with your team lead. Tuesdays are anchor days for most departments.
        </p>
        <div className="flex items-center gap-1.5 mt-2 text-[11px]">
          <ExternalLink size={10} className="text-[#9CA3AF]" />
          <span className="font-semibold text-[#1D4ED8]">Hybrid work policy</span>
          <span className="text-[#9CA3AF]">· Staffbase Intranet · updated 3 weeks ago</span>
        </div>
      </div>
      <div className="px-4 pb-3.5 text-[11.5px] text-[#067A6E]">
        No further setup needed — Navigator now watches what people ask and suggests the next connection only when demand justifies it.
      </div>
    </div>
  )
}

function SuggestionCard({ suggestion, onApply }) {
  const done = suggestion.status === 'done'
  return (
    <Card className={`px-4 py-3.5 ${done ? 'opacity-75' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#E6FBF8]">
          <Sparkles size={14} className="text-[#00A593]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-[#111827] leading-snug">{suggestion.title}</span>
            <OriginBadge>from real demand</OriginBadge>
          </div>
          <p className="text-[12px] text-[#6B7280] leading-relaxed mt-1">{suggestion.detail}</p>
        </div>
        <div className="shrink-0">
          {done ? (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#166534]"><CheckCircle2 size={13} /> Done</span>
          ) : (
            <PrimaryButton onClick={onApply}>{suggestion.cta}</PrimaryButton>
          )}
        </div>
      </div>
    </Card>
  )
}

function WatchingCard() {
  return (
    <Card className="px-5 py-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#E6FBF8] flex items-center justify-center shrink-0">
          <Radar size={16} className="text-[#00A593] animate-pulse" />
        </div>
        <div>
          <div className="text-[13.5px] font-semibold text-[#111827]">Watching for demand…</div>
          <p className="text-[12.5px] text-[#6B7280] leading-relaxed mt-1 max-w-[520px]">
            As employees ask questions, Navigator clusters them into anonymized themes here — what's answered,
            what's missing, what's trending. Themes appear once at least 5 people ask. Where coverage is missing,
            Navigator drafts the fix and you just review it.
          </p>
        </div>
      </div>
    </Card>
  )
}

// ── Question log pieces (unchanged substance) ────────────────────────────────

function ClusterRow({ cluster, proposal, last }) {
  return (
    <div className={`px-5 py-3.5 ${last ? '' : 'border-b border-[#F3F4F6]'}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-[#111827] truncate">{cluster.theme}</div>
          <div className="text-[11.5px] text-[#6B7280] mt-0.5 leading-relaxed">{cluster.note}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[14px] font-bold text-[#111827] leading-none">{cluster.count}</div>
          <div className="mt-1"><TrendArrow trend={cluster.trend} delta={cluster.delta} /></div>
        </div>
        <div className="w-[110px] text-right shrink-0">
          <CoverageBadge coverage={cluster.coverage} />
        </div>
      </div>
      {proposal && proposal.status === 'open' && (
        <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-[#067A6E]">
          <CornerDownRight size={12} />
          <Sparkles size={11} />
          Proposal attached — review it above.
        </div>
      )}
    </div>
  )
}

function ProposalCard({ proposal, onApprove, onDismiss }) {
  const meta = PROPOSAL_KIND_META[proposal.kind] || PROPOSAL_KIND_META['gap-answer']
  const Icon = meta.icon
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(proposal.draft)

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: meta.bg }}>
            <Icon size={15} style={{ color: meta.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</span>
              <OriginBadge>proposed by Navigator</OriginBadge>
            </div>
            <div className="text-[13.5px] font-semibold text-[#111827] mt-1 leading-snug">{proposal.title}</div>
          </div>
        </div>

        <div className="mt-3 ml-11 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3.5 py-3">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="w-full text-[12.5px] leading-relaxed text-[#374151] bg-white border border-[#99E8DE] rounded-lg px-3 py-2 outline-none focus:border-[#00A593] resize-y"
              autoFocus
            />
          ) : (
            <p className="text-[12.5px] leading-relaxed text-[#374151]">{draft}</p>
          )}
          <div className="text-[11px] text-[#9CA3AF] mt-2">
            On approve: {proposal.effect}
            {proposal.route && <> · Or route to <strong className="text-[#6B7280]">{proposal.route}</strong> instead.</>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 py-3 bg-[#FAFAFA] border-t border-[#F3F4F6]">
        <PrimaryButton onClick={() => onApprove(draft)}>
          <Check size={13} /> {editing ? 'Approve edited draft' : 'Approve'}
        </PrimaryButton>
        <GhostButton onClick={() => setEditing(!editing)}>
          <Pencil size={12} /> {editing ? 'Stop editing' : 'Edit'}
        </GhostButton>
        {proposal.route && (
          <GhostButton onClick={() => onApprove(`${draft}\n\n(Also routed to ${proposal.route} for ownership.)`)}>
            <Route size={12} /> Route to {proposal.route}
          </GhostButton>
        )}
        <div className="flex-1" />
        <GhostButton danger onClick={onDismiss}>
          <X size={12} /> Dismiss
        </GhostButton>
      </div>
    </Card>
  )
}
