import React from 'react'
import { Lightbulb, AlertTriangle, ArrowRight, Plug, FileText, Edit3 } from 'lucide-react'

const SEVERITY = {
  high:   { fg: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5', icon: AlertTriangle },
  medium: { fg: '#B45309', bg: '#FEF3C7', border: '#FCD34D', icon: Lightbulb },
  low:    { fg: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: Lightbulb },
}

const ACTION_ICON = {
  connect_source:   Plug,
  draft_faq:        FileText,
  edit_instructions: Edit3,
}

const ACTION_LABEL = {
  connect_source:   'Connect a source',
  draft_faq:        'Draft an FAQ',
  edit_instructions: 'Edit instructions',
}

export default function InsightCard({ insight, onAction }) {
  const sev = SEVERITY[insight.severity] || SEVERITY.medium
  const SevIcon = sev.icon
  const ActionIcon = ACTION_ICON[insight.recommended_action] || ArrowRight
  const actionLabel = ACTION_LABEL[insight.recommended_action] || 'Take action'

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex items-start gap-3">
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 mt-0.5"
        style={{ background: sev.bg, color: sev.fg, border: `1px solid ${sev.border}` }}
      >
        <SevIcon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#111827]">{insight.title}</div>
        <div className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">{insight.rationale}</div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {insight.topic && (
            <span className="inline-flex items-center text-[10.5px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
              {insight.topic}
            </span>
          )}
          {insight.evidence_conversation_ids?.length > 0 && (
            <span className="text-[11px] text-[#94A3B8]">
              {insight.evidence_conversation_ids.length} example{insight.evidence_conversation_ids.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAction?.(insight)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111827] hover:bg-[#1F2937] text-white text-[12px] font-semibold rounded-lg whitespace-nowrap"
      >
        <ActionIcon size={13} />
        {actionLabel}
      </button>
    </div>
  )
}
