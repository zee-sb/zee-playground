import React, { useMemo, useState } from 'react'
import { Check, X, Pencil, ShieldCheck, CornerDownRight, Sparkles, Route, Layers, Workflow, Languages, FileText, CheckCircle2 } from 'lucide-react'
import { Card, SectionTitle, CoverageBadge, TrendArrow, PrimaryButton, GhostButton, OriginBadge } from '../components'

/**
 * Question Log — the Studio's home tab and the concept's headline:
 * clustered real demand + Navigator's own proposals, awaiting review.
 * The admin's job is reviewing, not building.
 */

const PROPOSAL_KIND_META = {
  'gap-answer':  { icon: FileText,  label: 'Draft answer',     color: '#B91C1C', bg: '#FEF2F2' },
  'stale':       { icon: Route,     label: 'Stale content',    color: '#92400E', bg: '#FFFBEB' },
  'bundle':      { icon: Layers,    label: 'Capability bundle', color: '#067A6E', bg: '#E6FBF8' },
  'process':     { icon: Workflow,  label: 'Process suggestion', color: '#6D28D9', bg: '#F5F3FF' },
  'terminology': { icon: Languages, label: 'Terminology',      color: '#1D4ED8', bg: '#EFF6FF' },
}

export default function QuestionLogTab({ store }) {
  const { config, approveProposal, dismissProposal } = store
  const clusters = config.questionClusters || []
  const proposals = config.proposals || []

  const open = proposals.filter((p) => p.status === 'open')
  const resolved = proposals.filter((p) => p.status !== 'open')
  const totalQuestions = clusters.reduce((n, c) => n + c.count, 0)
  const gaps = clusters.filter((c) => c.coverage === 'gap').length

  return (
    <div className="max-w-[860px] space-y-8 pb-12">
      {/* Headline stats */}
      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[20px] font-bold text-[#111827]">Question log</h1>
          <span className="text-[12px] text-[#6B7280]">last 7 days</span>
        </div>
        <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-[620px]">
          Navigator clusters what employees actually ask, shows where coverage is missing, and drafts the fix.
          You review — you never build.
        </p>
        <div className="flex gap-3 mt-4">
          <Stat value={totalQuestions} label="questions asked" />
          <Stat value={clusters.length} label="clusters" />
          <Stat value={gaps} label={gaps === 1 ? 'open gap' : 'open gaps'} warn={gaps > 0} />
          <Stat value={open.length} label="proposals to review" accent={open.length > 0} />
        </div>
      </div>

      {/* Proposals — Navigator's drafts */}
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

      {/* Question clusters */}
      <div>
        <SectionTitle count={clusters.length}>Question clusters</SectionTitle>
        <Card>
          {clusters.map((c, i) => (
            <ClusterRow key={c.id} cluster={c} proposal={proposals.find((p) => p.id === c.proposalId)} last={i === clusters.length - 1} />
          ))}
        </Card>
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

function Stat({ value, label, warn, accent }) {
  return (
    <div className={`px-4 py-2.5 rounded-xl border ${warn ? 'bg-[#FEF2F2] border-[#FECACA]' : accent ? 'bg-[#E6FBF8] border-[#99E8DE]' : 'bg-white border-[#E5E7EB]'}`}>
      <div className={`text-[18px] font-bold leading-none ${warn ? 'text-[#B91C1C]' : accent ? 'text-[#067A6E]' : 'text-[#111827]'}`}>{value}</div>
      <div className="text-[11px] text-[#6B7280] mt-1">{label}</div>
    </div>
  )
}

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
