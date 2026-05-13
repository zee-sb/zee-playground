import React from 'react'
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'

// Small visual indicator showing how many health issues touch a given
// subject (entity row, tab label, etc). When `summary` is provided we use
// the workspace-wide rollup; otherwise we accept `issues` (already filtered
// by the caller) and derive the worst severity + count.
export default function HealthBadge({ issues, summary, variant = 'dot' }) {
  let errors = 0, warnings = 0, info = 0
  if (summary) {
    errors = summary.errors || 0
    warnings = summary.warnings || 0
    info = summary.info || 0
  } else if (Array.isArray(issues)) {
    for (const it of issues) {
      if (it.severity === 'error') errors++
      else if (it.severity === 'warning') warnings++
      else info++
    }
  }
  const total = errors + warnings + info
  if (total === 0) {
    if (variant === 'pill') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10.5px] font-bold">
          <CheckCircle2 size={11} /> Healthy
        </span>
      )
    }
    return null
  }
  const Icon = errors > 0 ? AlertCircle : warnings > 0 ? AlertTriangle : Info
  const color = errors > 0 ? '#DC2626' : warnings > 0 ? '#D97706' : '#2563EB'
  const bg = errors > 0 ? '#FEE2E2' : warnings > 0 ? '#FEF3C7' : '#DBEAFE'

  if (variant === 'pill') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold"
        style={{ background: bg, color }}
      >
        <Icon size={11} />
        {errors > 0 ? `${errors} error${errors > 1 ? 's' : ''}` : warnings > 0 ? `${warnings} warning${warnings > 1 ? 's' : ''}` : `${info} info`}
      </span>
    )
  }
  // dot variant
  return (
    <span
      title={`${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}, ${info} info`}
      className="inline-flex items-center justify-center text-[9.5px] font-bold rounded-full"
      style={{
        background: color, color: 'white',
        width: 16, height: 16, lineHeight: 1,
      }}
    >
      {total}
    </span>
  )
}
