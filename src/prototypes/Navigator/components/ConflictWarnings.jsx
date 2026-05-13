import React from 'react'
import { Info } from 'lucide-react'
import HealthIssueCard from './HealthIssueCard'

/**
 * Adapter that renders the LLM-judged Assistant overlap conflicts from
 * the navigator-assistant API in the same visual language as the rest of
 * the Health Check feature. Existing callers pass the LLM conflict shape:
 *   { withAssistantId, withAssistantName, severity, reason, suggestion }
 * — we coerce those into HealthIssueCard's `issue` shape so the AI
 * creator and Templates Gallery automatically inherit any future Health
 * UX improvements.
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
        <HealthIssueCard
          key={c.withAssistantId || i}
          issue={{
            id: 'assistant.llm-overlap',
            severity: c.severity === 'high' ? 'error' : c.severity === 'medium' ? 'warning' : 'info',
            title: `Overlaps with ${c.withAssistantName || 'existing Assistant'}`,
            description: c.reason,
            subject: { type: 'assistant', id: c.withAssistantId || null, name: c.withAssistantName || 'existing Assistant' },
            suggestion: c.suggestion,
          }}
        />
      ))}
    </div>
  )
}

export function hasHardConflict(conflicts) {
  return Array.isArray(conflicts) && conflicts.some((c) => c.severity === 'high')
}
