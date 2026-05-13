import React from 'react'
import { AlertCircle, AlertTriangle, Info, ArrowUpRight, Wrench } from 'lucide-react'

const SUBJECT_LABEL = {
  assistant: 'Assistant',
  mcp: 'Connector',
  agent: 'Agent',
  kb: 'Knowledge Base',
  flow: 'Flow',
  workspace: 'Workspace',
  blueprint: 'Blueprint',
}

function severityStyles(sev) {
  switch (sev) {
    case 'error':
      return { bg: 'bg-[#FEF2F2]', border: 'border-[#FCA5A5]', text: 'text-[#991B1B]', subtext: 'text-[#7F1D1D]', icon: AlertCircle, iconColor: 'text-[#DC2626]', label: 'Error' }
    case 'warning':
      return { bg: 'bg-[#FEF9C3]', border: 'border-[#FACC15]', text: 'text-[#713F12]', subtext: 'text-[#854D0E]', icon: AlertTriangle, iconColor: 'text-[#A16207]', label: 'Warning' }
    default:
      return { bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]', text: 'text-[#1E40AF]', subtext: 'text-[#1D4ED8]', icon: Info, iconColor: 'text-[#2563EB]', label: 'Info' }
  }
}

// Renders a single health issue. `onOpen(issue)` is called when the admin
// clicks "Open" (jump to the entity detail); `onFix(issue)` when they click
// the "Fix" button — only shown if `issue.autoFix` is set.
export default function HealthIssueCard({ issue, onOpen, onFix, compact = false }) {
  const s = severityStyles(issue.severity)
  const Icon = s.icon
  return (
    <div className={`flex items-start gap-3 ${s.bg} border ${s.border} rounded-lg px-3 py-2.5`}>
      <Icon size={16} className={`${s.iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-[10.5px] font-bold uppercase tracking-wider ${s.text}`}>{s.label}</span>
          <span className={`text-[13px] font-semibold ${s.text}`}>{issue.title}</span>
          {issue.subject?.name && (
            <span className="text-[11px] font-mono px-1.5 py-0 rounded bg-white/70 border border-white/40 text-[#52525B]">
              {SUBJECT_LABEL[issue.subject.type] || issue.subject.type}: {issue.subject.name}
            </span>
          )}
        </div>
        {!compact && issue.description && (
          <div className={`text-[12px] ${s.subtext} mt-1 leading-relaxed`}>{issue.description}</div>
        )}
        {!compact && issue.suggestion && (
          <div className={`text-[12px] ${s.subtext} mt-1.5 italic`}>Tip: {issue.suggestion}</div>
        )}
        {!compact && (onFix || onOpen) && (
          <div className="flex items-center gap-1.5 mt-2">
            {issue.autoFix && onFix && (
              <button
                onClick={() => onFix(issue)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#D4D4D8] hover:border-[#7C3AED] text-[11.5px] font-semibold text-[#18181B] hover:text-[#7C3AED] transition-colors"
              >
                <Wrench size={11} />
                Fix
              </button>
            )}
            {onOpen && issue.subject?.id && (
              <button
                onClick={() => onOpen(issue)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-transparent border border-transparent hover:bg-white/60 text-[11.5px] font-medium text-[#52525B] transition-colors"
              >
                Open
                <ArrowUpRight size={11} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
