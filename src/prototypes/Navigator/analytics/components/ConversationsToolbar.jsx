import React from 'react'
import { Search, Filter, X } from 'lucide-react'

const TOPICS = ['HR', 'Travel', 'IT', 'Compensation', 'Events', 'Policy', 'Operations', 'Other']
const LANGUAGES = ['en', 'de', 'fr', 'es', 'pt', 'it']
const DEVICES = ['desktop', 'mobile', 'voice']
const MODES = ['text', 'voice', 'mixed']
const REPORTED = ['inaccurate', 'unhelpful', 'inappropriate', 'other']
const STATES = ['resolved', 'processing', 'unresolved', 'escalated']

export default function ConversationsToolbar({ filters, setFilter, clearFilters, hasActiveFilters }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => setFilter({ search: e.target.value })}
          placeholder="Search conversation title…"
          className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
        />
      </div>

      <Select label="Topic"    value={filters.topic    || ''} onChange={(v) => setFilter({ topic: v })}    options={TOPICS} />
      <Select label="Language" value={filters.language || ''} onChange={(v) => setFilter({ language: v })} options={LANGUAGES} optionLabel={(o) => o.toUpperCase()} />
      <Select label="Device"   value={filters.device   || ''} onChange={(v) => setFilter({ device: v })}   options={DEVICES} />
      <Select label="Mode"     value={filters.mode     || ''} onChange={(v) => setFilter({ mode: v })}     options={MODES} />
      <Select label="State"    value={filters.resolution_state || ''} onChange={(v) => setFilter({ resolution_state: v })} options={STATES} />
      <Select label="Reported" value={filters.reported_issue || ''} onChange={(v) => setFilter({ reported_issue: v })} options={REPORTED} />

      <label className="flex items-center gap-1.5 px-2 py-1 text-[12px] text-[#475569] cursor-pointer">
        <input
          type="checkbox"
          checked={filters.low_score === 'true'}
          onChange={(e) => setFilter({ low_score: e.target.checked ? 'true' : '' })}
          className="rounded"
        />
        Flagged only
      </label>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#6B7280] hover:text-[#111827]"
        >
          <X size={12} /> Clear
        </button>
      )}
    </div>
  )
}

function Select({ label, value, onChange, options, optionLabel }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[12px] border border-[#E5E7EB] rounded-md px-2 py-1 bg-white focus:outline-none"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{optionLabel ? optionLabel(o) : o[0].toUpperCase() + o.slice(1)}</option>
        ))}
      </select>
    </label>
  )
}
