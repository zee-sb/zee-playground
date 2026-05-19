import React, { useMemo } from 'react'
import { MessageSquare, CheckCircle2, AlertOctagon, Flag, Sparkles } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import TrendChart from '../components/TrendChart'
import InsightCard from '../components/InsightCard'
import EvalScoreCluster from '../components/EvalScoreCluster'
import { KpiSkeleton, ChartSkeleton, CardSkeleton } from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import { useAnalyticsOverview, useAnalyticsInsights } from '../hooks/useAnalyticsApi'
import { buildAction } from '../lib/deepLinks'

export default function OverviewView({ filters, basePath, navigate, onOpenModal, onOpenConversations }) {
  const { dateFrom, dateTo } = filters
  const ov = useAnalyticsOverview({ dateFrom, dateTo })
  const ins = useAnalyticsInsights({ dateFrom, dateTo })

  const aggregatedEvals = useMemo(() => {
    if (!ov.data?.score_distributions) return []
    return Object.entries(ov.data.score_distributions).map(([dim, dist]) => ({
      dimension: dim,
      type: 'numeric',
      score: dist.p50,
      reasoning: `Median (p50) score across the period. p25=${pctOrDash(dist.p25)}, p75=${pctOrDash(dist.p75)}.`,
    }))
  }, [ov.data])

  const flaggedCount = useMemo(() => {
    const total = ov.data?.totals?.conversations || 0
    const issues = ov.data?.reported_issues || {}
    const issuePct = 1 - (issues.none ?? 1)
    return Math.round(total * issuePct)
  }, [ov.data])

  function handleInsightAction(insight) {
    const target = buildAction(basePath, insight.recommended_action, insight.action_payload || {})
    if (!target) return
    if (target.kind === 'navigate') navigate(target.href)
    else if (target.kind === 'modal') onOpenModal?.(target)
  }

  if (ov.error) {
    return <ErrorCard error={ov.error} onRetry={ov.refetch} />
  }

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {ov.isLoading
          ? [...Array(4)].map((_, i) => <KpiSkeleton key={i} />)
          : (
            <>
              <KpiCard
                label="Conversations"
                value={(ov.data?.totals?.conversations ?? 0).toLocaleString()}
                sub={`${(ov.data?.totals?.messages ?? 0).toLocaleString()} messages`}
                icon={<MessageSquare size={13} />}
                accent="purple"
              />
              <KpiCard
                label="Resolution rate"
                value={`${Math.round((ov.data?.resolution_mix?.resolved ?? 0) * 100)}%`}
                sub={`${Math.round((ov.data?.resolution_mix?.unresolved ?? 0) * 100)}% unresolved`}
                icon={<CheckCircle2 size={13} />}
                accent="green"
              />
              <KpiCard
                label="Avg friction"
                value={`${Math.round((ov.data?.score_distributions?.friction?.p50 ?? 0) * 100)}`}
                sub={`Top ${Math.round((ov.data?.score_distributions?.friction?.high_pct ?? 0) * 100)}% high`}
                icon={<AlertOctagon size={13} />}
                accent="amber"
              />
              <KpiCard
                label="Flagged"
                value={flaggedCount.toLocaleString()}
                sub={'Reported issues'}
                icon={<Flag size={13} />}
                accent="red"
              />
            </>
          )}
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-2 gap-3">
        {ov.isLoading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <TrendChart
              title="Conversation volume"
              labels={ov.data?.timeseries?.points?.map((p) => labelFor(p.date)) || []}
              data={ov.data?.timeseries?.points?.map((p) => p.conversations) || []}
              color="#7C3AED"
            />
            <TrendChart
              title="Resolved per day"
              labels={ov.data?.timeseries?.points?.map((p) => labelFor(p.date)) || []}
              data={ov.data?.timeseries?.points?.map((p) => p.resolved) || []}
              color="#16A34A"
            />
          </>
        )}
      </div>

      {/* Aggregate eval cluster + top topics */}
      <div className="grid grid-cols-2 gap-3">
        {ov.isLoading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <EvalScoreCluster evals={aggregatedEvals} />
            <TopTopicsCard
              topics={ov.data?.top_topics || []}
              onPick={(topic) => onOpenConversations?.({ topic })}
            />
          </>
        )}
      </div>

      {/* Insights */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-[#7C3AED]" />
          <h2 className="text-[14px] font-bold text-[#111827]">Insights & recommended actions</h2>
        </div>
        {ins.isLoading ? (
          <div className="grid grid-cols-1 gap-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : ins.data?.insights?.length ? (
          <div className="space-y-3">
            {ins.data.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} onAction={handleInsightAction} />
            ))}
          </div>
        ) : (
          <EmptyState title="No insights yet">
            Once you collect a few hundred conversations, recommendations appear here.
          </EmptyState>
        )}
      </div>
    </div>
  )
}

function TopTopicsCard({ topics, onPick }) {
  const total = topics.reduce((acc, t) => acc + t.count, 0)
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280] mb-3">Top topics</div>
      {topics.length === 0 && <div className="text-[12px] text-[#94A3B8]">No conversations in this range.</div>}
      <div className="space-y-1.5">
        {topics.map((t) => {
          const pct = total ? t.count / total : 0
          return (
            <button
              key={t.topic}
              type="button"
              onClick={() => onPick(t.topic)}
              className="w-full text-left flex items-center gap-3 hover:bg-[#FAFAFB] -mx-1.5 px-1.5 py-1 rounded"
            >
              <div className="text-[12px] font-semibold text-[#111827] w-24 truncate">{t.topic}</div>
              <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#7C3AED]"
                  style={{ width: `${Math.max(2, pct * 100)}%` }}
                />
              </div>
              <div className="text-[11px] tabular-nums text-[#6B7280] w-10 text-right">{t.count}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ErrorCard({ error, onRetry }) {
  return (
    <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl p-4 flex items-center justify-between">
      <div className="text-[12.5px] text-[#7F1D1D]">Failed to load overview: {error.message}</div>
      <button
        type="button"
        onClick={onRetry}
        className="text-[12px] font-semibold text-[#7F1D1D] underline hover:text-[#991B1B]"
      >
        Retry
      </button>
    </div>
  )
}

function labelFor(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function pctOrDash(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return Math.round(v * 100)
}
