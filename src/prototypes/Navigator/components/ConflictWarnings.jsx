import React from 'react'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'

/**
 * Renders the conflict-detection result from the navigator-assistant API.
 * Conflicts are LLM-judged and include {withAssistantName, severity, reason, suggestion}.
 *
 * Props:
 *   conflicts: Array<{withAssistantId, withAssistantName, severity, reason, suggestion}>
 *   showEmpty: if true, render a "no conflicts found" pill when array is empty
 */
export default function ConflictWarnings({ conflicts = [], showEmpty = false }) {
  if (!conflicts || conflicts.length === 0) {
    if (!showEmpty) return null
    return (
      <div className="flex items-center gap-2 bg-[#DCFCE7] border border-[#86EFAC] rounded-lg px-3 py-2">
        <Info size={14} className="text-[#15803D] shrink-0" />
        <span className="text-[12.5px] text-[#15803D] font-medium">No conflicts found with existing Assistants.</span>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {conflicts.map((c, i) => (
        <ConflictRow key={c.withAssistantId || i} c={c} />
      ))}
    </div>
  )
}

function severityStyles(sev) {
  switch (sev) {
    case 'high':
      return { bg: 'bg-[#FEF2F2]', border: 'border-[#FCA5A5]', text: 'text-[#991B1B]', icon: AlertCircle, iconColor: 'text-[#DC2626]', label: 'High' }
    case 'medium':
      return { bg: 'bg-[#FEF9C3]', border: 'border-[#FACC15]', text: 'text-[#713F12]', icon: AlertTriangle, iconColor: 'text-[#A16207]', label: 'Medium' }
    default:
      return { bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]', text: 'text-[#1E40AF]', icon: Info, iconColor: 'text-[#2563EB]', label: 'Low' }
  }
}

function ConflictRow({ c }) {
  const s = severityStyles(c.severity)
  const Icon = s.icon
  return (
    <div className={`flex items-start gap-3 ${s.bg} border ${s.border} rounded-lg px-3 py-2.5`}>
      <Icon size={15} className={`${s.iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className={`text-[12.5px] font-semibold ${s.text}`}>
          {c.severity ? s.label.toUpperCase() : ''}{c.severity ? ' · ' : ''}Overlaps with {c.withAssistantName || 'existing Assistant'}
        </div>
        <div className={`text-[12px] ${s.text} opacity-90 mt-0.5 leading-relaxed`}>{c.reason}</div>
        {c.suggestion && (
          <div className={`text-[12px] ${s.text} opacity-80 mt-1 italic`}>Tip: {c.suggestion}</div>
        )}
      </div>
    </div>
  )
}

export function hasHardConflict(conflicts) {
  return Array.isArray(conflicts) && conflicts.some((c) => c.severity === 'high')
}
