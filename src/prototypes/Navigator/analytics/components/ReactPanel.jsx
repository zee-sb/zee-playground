import React from 'react'
import { Plug, FileText, Edit3, ArrowRight } from 'lucide-react'

const ICON = {
  connect_source:    Plug,
  draft_faq:         FileText,
  edit_instructions: Edit3,
}

const ACCENT = {
  connect_source:    { fg: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  draft_faq:         { fg: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  edit_instructions: { fg: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
}

export default function ReactPanel({ recommendations = [], onAction }) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Recommended actions</div>
        <div className="text-[12px] text-[#94A3B8]">Nothing to act on for this conversation.</div>
      </div>
    )
  }
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280] mb-3">Recommended actions</div>
      <div className="space-y-2">
        {recommendations.map((r) => {
          const accent = ACCENT[r.action] || ACCENT.connect_source
          const Icon = ICON[r.action] || ArrowRight
          return (
            <button
              key={r.action + (r.payload?.topic || '')}
              type="button"
              onClick={() => onAction?.(r)}
              className="w-full text-left flex items-start gap-3 p-3 border rounded-lg hover:bg-[#FAFAFB] transition-colors"
              style={{ borderColor: accent.border }}
            >
              <div
                className="flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0"
                style={{ background: accent.bg, color: accent.fg }}
              >
                <Icon size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-[#111827]">{r.title}</div>
                <div className="text-[11px] text-[#6B7280] leading-relaxed mt-0.5">{r.reason}</div>
              </div>
              <ArrowRight size={13} className="text-[#94A3B8] flex-shrink-0 mt-1" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
