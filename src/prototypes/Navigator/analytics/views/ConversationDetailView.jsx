import React from 'react'
import { ArrowLeft } from 'lucide-react'
import TranscriptViewer from '../components/TranscriptViewer'
import EvalScoreCluster from '../components/EvalScoreCluster'
import SafetyAlertBanner from '../components/SafetyAlertBanner'
import ReactPanel from '../components/ReactPanel'
import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton'
import { useConversation } from '../hooks/useAnalyticsApi'
import { recommendActionsForConversation, buildAction } from '../lib/deepLinks'

export default function ConversationDetailView({ conversationId, onBack, basePath, navigate, onOpenModal }) {
  const { data, isLoading, error, refetch } = useConversation({ id: conversationId })

  const recommendations = data ? recommendActionsForConversation({
    summary: data.summary,
    evals: data.evals,
  }) : []

  function handleAction(rec) {
    const target = buildAction(basePath, rec.action, rec.payload || {})
    if (!target) return
    if (target.kind === 'navigate') navigate(target.href)
    else if (target.kind === 'modal') onOpenModal?.(target)
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#374151] hover:text-[#111827] mb-3"
      >
        <ArrowLeft size={14} /> Back to conversations
      </button>

      {error && (
        <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl p-4 mb-3 flex items-center justify-between">
          <div className="text-[12.5px] text-[#7F1D1D]">Failed to load conversation: {error.message}</div>
          <button type="button" onClick={refetch} className="text-[12px] font-semibold text-[#7F1D1D] underline">
            Retry
          </button>
        </div>
      )}

      {isLoading || !data ? (
        <div className="grid grid-cols-[1fr_340px] gap-4">
          <div className="space-y-3"><CardSkeleton /><ChartSkeleton /></div>
          <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
        </div>
      ) : (
        <>
          {/* Title row */}
          <div className="mb-3">
            <div className="text-[16px] font-bold text-[#111827]">{data.conversation?.title || 'Untitled conversation'}</div>
            <div className="text-[12px] text-[#6B7280] mt-0.5">
              {formatDateLong(data.conversation?.created_at)} · {data.summary?.message_count || 0} message{data.summary?.message_count === 1 ? '' : 's'} · {data.summary?.tool_call_count || 0} tool call{data.summary?.tool_call_count === 1 ? '' : 's'}
            </div>
          </div>

          <SafetyAlertBanner evals={data.evals} />

          <div className="grid grid-cols-[1fr_340px] gap-4">
            <div className="space-y-3">
              <SummaryCard summary={data.summary} />
              <TranscriptViewer messages={data.messages || []} />
            </div>
            <div className="space-y-3 sticky top-4 self-start">
              <EvalScoreCluster evals={data.evals} showDiagnostics={true} />
              <ReactPanel recommendations={recommendations} onAction={handleAction} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ summary }) {
  if (!summary) return null
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Summary</div>
      <div className="text-[13px] text-[#111827] leading-relaxed">{summary.summary}</div>

      <div className="mt-3 grid grid-cols-4 gap-3">
        <Meta label="Topic" value={summary.primary_topic} />
        <Meta label="Mode" value={summary.mode} />
        <Meta label="Device" value={summary.device} />
        <Meta label="Language" value={(summary.language || 'en').toUpperCase()} />
      </div>

      {summary.intent_reasoning && (
        <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280] mb-1">Intent</div>
          <div className="text-[12px] text-[#374151] leading-relaxed">{summary.intent_reasoning}</div>
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{label}</div>
      <div className="text-[12px] font-semibold text-[#111827] mt-0.5">{value || '—'}</div>
    </div>
  )
}

function formatDateLong(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso || ''
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
