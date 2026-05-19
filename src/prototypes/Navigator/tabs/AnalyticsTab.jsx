import React, { useMemo, useState } from 'react'
import {
  BarChart3, TrendingUp, TrendingDown, Users, Clock, ListChecks, ChevronRight,
  Workflow, AlertTriangle,
} from 'lucide-react'

/**
 * Analytics tab — funnel + drop-off view per workflow.
 *
 * Numbers are seeded deterministically from each flow's id so the same flow
 * shows the same stats between reloads, and the demo has variety: some flows
 * have great completion, others bleed in the middle.
 *
 * In production this would come from a real telemetry pipeline (Segment /
 * Snowplow / internal). Same chart shape, different data source.
 */
export default function AnalyticsTab({ workflows = [] }) {
  const [picked, setPicked] = useState(workflows[0]?.id || null)
  const active = workflows.find((w) => w.id === picked) || workflows[0] || null
  const totals = useMemo(() => rollupTotals(workflows), [workflows])

  if (!workflows.length) {
    return (
      <EmptyState />
    )
  }

  const stats = active ? statsFor(active) : null

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Analytics</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            How your workflows are actually used. Numbers below are for the last 30 days.
          </p>
        </div>
      </div>

      {/* Workspace rollup */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <KpiCard label="Flows started" value={totals.started} delta={+18} icon={<Workflow size={14} />} />
        <KpiCard label="Completion rate" value={`${totals.completionPct}%`} delta={+4} icon={<TrendingUp size={14} />} accent="green" />
        <KpiCard label="Avg time to complete" value={`${totals.avgMin}m`} delta={-12} icon={<Clock size={14} />} accent="green" />
        <KpiCard label="Active users" value={totals.users} delta={+9} icon={<Users size={14} />} />
      </div>

      <div className="grid grid-cols-[260px_1fr] gap-4">
        {/* Flow list */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[#E5E7EB] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">
            Workflow
          </div>
          {workflows.map((w) => {
            const s = statsFor(w)
            const selected = w.id === picked
            return (
              <button
                key={w.id}
                onClick={() => setPicked(w.id)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2 border-t border-[#F1F5F9] ${
                  selected ? 'bg-[#F5F3FF]' : 'hover:bg-[#FAFAFB]'
                }`}
              >
                <Workflow size={13} className="text-[#7C3AED] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-[#111827] truncate">{w.name || 'Untitled'}</div>
                  <div className="text-[10.5px] text-[#6B7280]">{s.started} started · {s.completionPct}% done</div>
                </div>
                <ChevronRight size={12} className={selected ? 'text-[#7C3AED]' : 'text-[#CBD5E1]'} />
              </button>
            )
          })}
        </div>

        {/* Detail */}
        {active && stats ? (
          <div className="space-y-4">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[15px] font-bold text-[#111827]">{active.name}</h2>
                <span className="text-[11px] text-[#6B7280]">Last 30 days</span>
              </div>
              <p className="text-[11.5px] text-[#6B7280] mb-4 italic">"{active.trigger || 'No trigger configured'}"</p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatTile label="Started" value={stats.started} />
                <StatTile label="Completed" value={stats.completed} sub={`${stats.completionPct}%`} />
                <StatTile label="Avg duration" value={`${stats.avgMin}m`} />
              </div>

              {/* Funnel */}
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#94A3B8] mb-2 flex items-center gap-1">
                <ListChecks size={11} /> Step-by-step funnel
              </div>
              <div className="space-y-1.5">
                {stats.funnel.map((row, i) => {
                  const pct = stats.started > 0 ? Math.round((row.reached / stats.started) * 100) : 0
                  const dropPct = i > 0 ? Math.max(0, stats.funnel[i - 1].reached - row.reached) : 0
                  return (
                    <div key={row.stepId} className="grid grid-cols-[180px_1fr_60px_40px] items-center gap-2">
                      <div className="text-[11.5px] text-[#374151] truncate" title={row.label}>{row.label}</div>
                      <div className="h-5 bg-[#F1F5F9] rounded overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-[#7C3AED] to-[#0EA5E9]" style={{ width: `${pct}%` }} />
                        <span className="absolute left-2 top-0 bottom-0 flex items-center text-[10.5px] font-bold text-white drop-shadow-sm">
                          {row.reached.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-[#475569] text-right">{pct}%</div>
                      {dropPct > 0 ? (
                        <div className="text-[10px] text-[#B91C1C] text-right" title={`-${dropPct} dropped here`}>
                          −{dropPct}
                        </div>
                      ) : <div />}
                    </div>
                  )
                })}
              </div>

              {stats.biggestDropStep && (
                <div className="mt-4 flex items-start gap-2 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
                  <AlertTriangle size={14} className="text-[#DC2626] mt-0.5 shrink-0" />
                  <div className="text-[11.5px] text-[#7F1D1D]">
                    <b>Biggest drop:</b> {stats.biggestDropStep.label} ({stats.biggestDropStep.dropped} employees stalled). Consider simplifying that step or providing better context.
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <h3 className="text-[13px] font-bold text-[#111827] mb-3 flex items-center gap-1.5">
                <Users size={13} /> Usage by role
              </h3>
              <div className="space-y-2">
                {stats.byRole.map((r) => (
                  <div key={r.role} className="grid grid-cols-[120px_1fr_50px] gap-2 items-center">
                    <div className="text-[11.5px] text-[#374151]">{r.role}</div>
                    <div className="h-3 bg-[#F1F5F9] rounded overflow-hidden">
                      <div className="h-full bg-[#7C3AED]" style={{ width: `${r.pct}%` }} />
                    </div>
                    <div className="text-[11px] text-[#475569] text-right">{r.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 text-[12px] text-[#6B7280] italic">
            Select a workflow on the left.
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div>
      <h1 className="text-[22px] font-bold text-[#111827]">Analytics</h1>
      <p className="text-[13px] text-[#6B7280] mt-1 mb-6">
        How your workflows are actually used.
      </p>
      <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl py-12 px-6 text-center">
        <BarChart3 size={20} className="mx-auto text-[#94A3B8] mb-2" />
        <div className="text-[14px] font-semibold text-[#111827]">No workflows yet</div>
        <div className="text-[12px] text-[#6B7280] mt-1">Add one in the Workflows tab to start collecting analytics.</div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, delta, icon, accent = 'purple' }) {
  const accentMap = {
    purple: '#7C3AED',
    green:  '#16A34A',
    red:    '#DC2626',
    blue:   '#2563EB',
  }
  const color = accentMap[accent] || accentMap.purple
  const positiveDelta = delta >= 0
  const deltaColor = positiveDelta ? '#16A34A' : '#DC2626'
  const Trend = positiveDelta ? TrendingUp : TrendingDown
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280]">
        <span style={{ color }}>{icon}</span> {label}
      </div>
      <div className="mt-1.5 text-[22px] font-bold text-[#111827] tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold flex items-center gap-1" style={{ color: deltaColor }}>
        <Trend size={11} /> {positiveDelta ? '+' : ''}{delta}% vs prior period
      </div>
    </div>
  )
}

function StatTile({ label, value, sub }) {
  return (
    <div className="px-3 py-2.5 bg-[#FAFAFB] border border-[#F1F5F9] rounded-lg">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280]">{label}</div>
      <div className="text-[18px] font-bold text-[#111827] mt-0.5 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-[#475569] mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Deterministic mock numbers ───────────────────────────────────────────────
// Seeded by a hash of the flow id so a given flow always shows the same stats.

function hash(s) {
  let h = 0
  for (let i = 0; i < String(s).length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function statsFor(flow) {
  const seed = hash(flow.id || flow.name || 'x')
  const started = 80 + (seed % 420)
  const steps = flow.steps || []
  // Build a falling funnel — each step retains a per-step rate.
  let reached = started
  const funnel = (steps.length ? steps : [{ id: 'start', label: 'Start' }, { id: 'finish', label: 'Finish' }]).map((s, i) => {
    if (i === 0) return { stepId: s.id, label: s.label || `Step ${i + 1}`, reached }
    const retention = 0.6 + ((seed >> (i + 1)) % 40) / 100 // 60–99%
    reached = Math.max(0, Math.floor(reached * retention))
    return { stepId: s.id, label: s.label || `Step ${i + 1}`, reached }
  })
  const completed = funnel.at(-1)?.reached || 0
  const completionPct = started > 0 ? Math.round((completed / started) * 100) : 0
  const avgMin = 2 + (seed % 14)
  // Biggest drop
  let biggest = null
  for (let i = 1; i < funnel.length; i++) {
    const drop = funnel[i - 1].reached - funnel[i].reached
    if (drop > 0 && (!biggest || drop > biggest.dropped)) {
      biggest = { label: funnel[i].label, dropped: drop }
    }
  }
  // Usage by role
  const roleSplit = [
    { role: 'Frontline',    weight: 0.42 },
    { role: 'Office',       weight: 0.28 },
    { role: 'Manager',      weight: 0.15 },
    { role: 'HR',           weight: 0.08 },
    { role: 'IT',           weight: 0.07 },
  ]
  const byRole = roleSplit.map((r) => {
    const count = Math.max(1, Math.floor(started * r.weight))
    return { ...r, count, pct: Math.round(r.weight * 100) }
  })
  return { started, completed, completionPct, avgMin, funnel, biggestDropStep: biggest, byRole }
}

function rollupTotals(workflows) {
  if (!workflows.length) return { started: 0, completionPct: 0, avgMin: 0, users: 0 }
  let started = 0, completed = 0, durSum = 0
  for (const w of workflows) {
    const s = statsFor(w)
    started += s.started
    completed += s.completed
    durSum += s.avgMin
  }
  const completionPct = started > 0 ? Math.round((completed / started) * 100) : 0
  const avgMin = Math.max(1, Math.round(durSum / workflows.length))
  // Mock unique-user count — ~30% of starts are repeat users
  const users = Math.round(started * 0.7)
  return { started, completionPct, avgMin, users }
}
