import React from 'react'
import { scoreToBand, bandColors, asPercent, isInverted } from '../lib/evalBands'

// Single 0–100 horizontal bar with band coloring. Used in the per-conversation
// score panel and inline in the conversations list.
export default function EvalScoreBar({ dimension, value, dense = false, reasoning, label }) {
  const band = scoreToBand(dimension, value)
  const c = bandColors(band)
  const filled = value == null ? 0 : (isInverted(dimension) ? (1 - value) : value)
  const pct = asPercent(value)
  return (
    <div title={reasoning || ''} className={dense ? '' : 'mb-2'}>
      <div className="flex items-center justify-between mb-1">
        {label && <div className="text-[11px] font-semibold text-[#374151]">{label}</div>}
        <div className="text-[11px] font-bold tabular-nums" style={{ color: c.fg }}>{pct}</div>
      </div>
      <div className="h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, filled * 100)}%`, background: c.fg }}
        />
      </div>
    </div>
  )
}

// Compact dot/score combo used in dense table cells.
export function ScoreDot({ dimension, value }) {
  const band = scoreToBand(dimension, value)
  const c = bandColors(band)
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.fg }} />
      <span className="text-[11px] font-semibold tabular-nums text-[#374151]">{asPercent(value)}</span>
    </div>
  )
}
