import React, { useState } from 'react'
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Shared UI primitives for the Navigator V2 Studio. Teal-first palette
// (#00C7B2) per Staffbase brand — the legacy Studio's purple stays with the
// legacy Studio so the A/B contrast reads at a glance.

export const TEAL = '#00C7B2'
export const TEAL_DARK = '#00A593'

export function SectionTitle({ children, count, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-[#111827]">{children}</h2>
        {count !== undefined && (
          <span className="text-[11px] font-bold text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      {right}
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-[#E5E7EB] rounded-xl ${className}`}>
      {children}
    </div>
  )
}

const COVERAGE_STYLES = {
  answered:  { bg: '#DCFCE7', fg: '#166534', label: 'Answered · cited' },
  partial:   { bg: '#FEF3C7', fg: '#92400E', label: 'Partial' },
  gap:       { bg: '#FEE2E2', fg: '#991B1B', label: 'Gap' },
  escalated: { bg: '#EDE9FE', fg: '#6D28D9', label: 'Escalated' },
}

export function CoverageBadge({ coverage }) {
  const s = COVERAGE_STYLES[coverage] || COVERAGE_STYLES.partial
  return (
    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}

const HEALTH_STYLES = {
  connected:    { bg: '#DCFCE7', fg: '#166534', dot: '#16A34A', label: 'Connected' },
  degraded:     { bg: '#FEF3C7', fg: '#92400E', dot: '#D97706', label: 'Degraded' },
  disconnected: { bg: '#FEE2E2', fg: '#991B1B', dot: '#DC2626', label: 'Disconnected' },
}

export function HealthPill({ health }) {
  const s = HEALTH_STYLES[health] || HEALTH_STYLES.disconnected
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2 py-1 rounded-full" style={{ background: s.bg, color: s.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

export function TrendArrow({ trend, delta }) {
  if (trend === 'up') return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B45309]"><TrendingUp size={12} />{delta}</span>
  if (trend === 'down') return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#15803D]"><TrendingDown size={12} />{delta}</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#9CA3AF]"><Minus size={12} />{delta}</span>
}

/**
 * 3-segment risk-tier control: Assist / Trigger / Execute.
 */
export function TierControl({ value, onChange, options }) {
  return (
    <div className="inline-flex bg-[#F3F4F6] rounded-lg p-0.5 shrink-0" role="radiogroup" aria-label="Risk tier">
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.hint}
            onClick={() => onChange(opt.id)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
              active ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
            }`}
            style={active ? { boxShadow: '0 1px 2px rgba(0,0,0,0.08)', color: opt.id === 'execute' ? '#B45309' : '#111827' } : {}}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Tiny hover tooltip — pure CSS, no portal. Wraps an info icon.
 */
export function InfoTip({ text }) {
  return (
    <span className="relative inline-flex group align-middle">
      <Info size={13} className="text-[#9CA3AF] cursor-help" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[260px] bg-[#111827] text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-xl">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111827]" />
      </span>
    </span>
  )
}

export function OriginBadge({ children }) {
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E6FBF8] text-[#067A6E] whitespace-nowrap">
      {children}
    </span>
  )
}

export function DerivedBadge() {
  return (
    <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]" title="Derived from profile fields — not an editable group picker. Navigator never grants access, it only inherits it.">
      derived
    </span>
  )
}

const STEP_TYPE_STYLES = {
  collect: { bg: '#EFF6FF', fg: '#1D4ED8' },
  approve: { bg: '#FEF3C7', fg: '#92400E' },
  submit:  { bg: '#E6FBF8', fg: '#067A6E' },
  confirm: { bg: '#DCFCE7', fg: '#166534' },
}

export function StepTypeChip({ type }) {
  const s = STEP_TYPE_STYLES[type] || STEP_TYPE_STYLES.collect
  return (
    <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0" style={{ background: s.bg, color: s.fg }}>
      {type}
    </span>
  )
}

export function LogoSquare({ name, color, size = 36 }) {
  return (
    <div
      className="rounded-lg flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-bold text-white transition-colors disabled:opacity-50 ${className}`}
      style={{ background: '#00A593' }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = '#008C7D' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#00A593' }}
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, onClick, danger, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12.5px] font-semibold transition-colors ${
        danger
          ? 'border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]'
          : 'border-[#E5E7EB] text-[#374151] hover:border-[#00A593] hover:text-[#00A593]'
      } ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * Collapsible "engine room" detail line — the only place protocol details
 * are allowed to appear in V2, and only in this muted form.
 */
export function EngineRoomLine({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      onClick={() => setOpen(!open)}
      className="text-left text-[10px] font-mono text-[#C0C4CC] hover:text-[#9CA3AF] transition-colors"
      title="Engine room — implementation detail, irrelevant to configuration"
    >
      {open ? text : '⚙︎ engine room'}
    </button>
  )
}
