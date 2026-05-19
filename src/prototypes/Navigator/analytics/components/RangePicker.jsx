import React from 'react'
import { Calendar } from 'lucide-react'

const RANGES = [
  { id: '7d',  label: 'Last 7 days',  days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
]

function rangeFor(days) {
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
}

export default function RangePicker({ value, onChange }) {
  // `value` = { dateFrom, dateTo }. Match against known ranges; default to 30d.
  const currentDays = (() => {
    if (!value?.dateFrom || !value?.dateTo) return 30
    const days = Math.round((new Date(value.dateTo) - new Date(value.dateFrom)) / (24 * 60 * 60 * 1000))
    return RANGES.find((r) => r.days === days)?.days || 30
  })()

  return (
    <label className="inline-flex items-center gap-2 px-2 py-1 border border-[#E5E7EB] rounded-md bg-white text-[12px] text-[#475569]">
      <Calendar size={12} className="text-[#94A3B8]" />
      <select
        value={currentDays}
        onChange={(e) => {
          const days = Number.parseInt(e.target.value, 10)
          onChange(rangeFor(days))
        }}
        className="bg-transparent focus:outline-none cursor-pointer"
      >
        {RANGES.map((r) => (
          <option key={r.id} value={r.days}>{r.label}</option>
        ))}
      </select>
    </label>
  )
}
