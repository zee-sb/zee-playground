import React from 'react'

const ACCENT = {
  purple: '#7C3AED',
  green:  '#16A34A',
  red:    '#DC2626',
  blue:   '#2563EB',
  amber:  '#B45309',
}

export default function KpiCard({ label, value, sub, icon, accent = 'purple' }) {
  const color = ACCENT[accent] || ACCENT.purple
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280]">
        {icon && <span style={{ color }}>{icon}</span>} {label}
      </div>
      <div className="mt-1.5 text-[22px] font-bold text-[#111827] tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[#6B7280]">{sub}</div>}
    </div>
  )
}
