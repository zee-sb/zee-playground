import React, { useMemo, useState } from 'react'
import {
  Activity, Search, User, Workflow, Edit3, Send, ShieldAlert, CheckCircle2, Play, X,
  ChevronRight,
} from 'lucide-react'

/**
 * Audit log tab — who did what, when, to which workflow.
 *
 * In production this would be backed by an append-only event log (Postgres
 * table or external log sink). Here we generate plausible entries from the
 * workflow list so the surface is shaped like the real thing: action filter,
 * time filter, who-did-what rows, and a detail drawer for any single entry.
 */
export default function AuditLogTab({ workflows = [] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const entries = useMemo(() => generateEntries(workflows), [workflows])

  const filtered = entries.filter((e) => {
    if (filter !== 'all' && e.action !== filter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (e.workflowName + ' ' + e.actor + ' ' + e.summary).toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Audit log</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Every meaningful change and run, kept for compliance and reviewable by works councils.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by workflow, actor, or note…"
            className="w-full pl-7 pr-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
          />
        </div>
        <div className="flex gap-1">
          {[
            { id: 'all',       label: 'All' },
            { id: 'edited',    label: 'Edits' },
            { id: 'published', label: 'Publishes' },
            { id: 'approval',  label: 'Approvals' },
            { id: 'run',       label: 'Runs' },
            { id: 'works_council', label: 'Works council' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                filter === f.id ? 'bg-[#111827] text-white' : 'bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F9FAFB]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-[12px] text-[#94A3B8] italic">
            No entries match.
          </div>
        ) : (
          filtered.map((e) => <Row key={e.id} entry={e} />)
        )}
      </div>

      <div className="mt-3 text-[11px] text-[#94A3B8]">
        Showing {filtered.length} of {entries.length}. Audit entries are retained for 7 years.
      </div>
    </div>
  )
}

const ACTIONS = {
  edited:        { icon: Edit3,        color: '#7C3AED', label: 'Edited' },
  published:     { icon: Send,         color: '#16A34A', label: 'Published' },
  approval:      { icon: CheckCircle2, color: '#2563EB', label: 'Approval' },
  run:           { icon: Play,         color: '#0EA5E9', label: 'Ran' },
  cancelled:     { icon: X,            color: '#DC2626', label: 'Cancelled' },
  works_council: { icon: ShieldAlert,  color: '#DC2626', label: 'Works council' },
}

function Row({ entry }) {
  const meta = ACTIONS[entry.action] || ACTIONS.edited
  const Icon = meta.icon
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-t border-[#F1F5F9] first:border-t-0 hover:bg-[#FAFAFB]">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${meta.color}1a`, color: meta.color }}>
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: meta.color, background: `${meta.color}1a` }}>
            {meta.label}
          </span>
          <span className="text-[12.5px] font-semibold text-[#111827]">{entry.workflowName}</span>
          <span className="text-[11px] text-[#94A3B8]">·</span>
          <span className="text-[11px] text-[#6B7280] inline-flex items-center gap-1">
            <User size={10} /> {entry.actor}
          </span>
          <span className="text-[11px] text-[#94A3B8] ml-auto">{entry.timeLabel}</span>
        </div>
        <div className="text-[12px] text-[#374151] mt-0.5 leading-relaxed">{entry.summary}</div>
        {entry.detail && (
          <div className="text-[11px] text-[#6B7280] mt-1 px-2 py-1 bg-[#F9FAFB] rounded font-mono">
            {entry.detail}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Mock entry generator ────────────────────────────────────────────────────

function hash(s) {
  let h = 0
  for (let i = 0; i < String(s).length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const ACTORS = ['Maria Schmidt', 'Alex Chen', 'Jordan Lee', 'Priya Nair', 'You (demo)']

function pickActor(seed) {
  return ACTORS[seed % ACTORS.length]
}

function generateEntries(workflows) {
  const now = Date.now()
  const out = []
  let idCounter = 0
  for (const w of workflows) {
    const seed = hash(w.id || w.name || 'x')
    // Run entries — denser
    const runCount = 6 + (seed % 8)
    for (let i = 0; i < runCount; i++) {
      const minutesAgo = 5 + i * 47 + (seed % 60)
      const cancelled = i % 7 === 3
      out.push({
        id: `e${idCounter++}`,
        action: cancelled ? 'cancelled' : 'run',
        workflowName: w.name || 'Untitled',
        actor: `Employee ${1 + ((seed + i) % 9)}`,
        summary: cancelled
          ? `Cancelled the flow at step "${w.steps?.[1]?.label || 'Confirm'}".`
          : `Completed the flow${w.steps?.length ? ` (${w.steps.length} steps)` : ''}.`,
        detail: null,
        ts: now - minutesAgo * 60 * 1000,
        timeLabel: formatAgo(minutesAgo),
      })
    }
    // Edits + publishes — sparser
    out.push({
      id: `e${idCounter++}`,
      action: 'edited',
      workflowName: w.name || 'Untitled',
      actor: pickActor(seed),
      summary: 'Adjusted the goal text and added a confirm step.',
      detail: 'fields changed: goal, steps[2]',
      ts: now - (120 + (seed % 600)) * 60 * 1000,
      timeLabel: formatAgo(120 + (seed % 600)),
    })
    if (w.publishedVersion > 0) {
      out.push({
        id: `e${idCounter++}`,
        action: 'published',
        workflowName: w.name || 'Untitled',
        actor: pickActor(seed + 1),
        summary: `Published v${w.publishedVersion}.`,
        detail: null,
        ts: now - (60 + (seed % 240)) * 60 * 1000,
        timeLabel: formatAgo(60 + (seed % 240)),
      })
    }
    // Approval activity for flows that have an approval step
    if ((w.steps || []).some((s) => s.type === 'approval')) {
      out.push({
        id: `e${idCounter++}`,
        action: 'approval',
        workflowName: w.name || 'Untitled',
        actor: `Manager ${1 + (seed % 5)}`,
        summary: 'Approved a pending request.',
        detail: 'sla met: 4h 12m of 24h',
        ts: now - (10 + (seed % 50)) * 60 * 1000,
        timeLabel: formatAgo(10 + (seed % 50)),
      })
    }
    // Works-council event if applicable
    if (w.worksCouncil?.required) {
      out.push({
        id: `e${idCounter++}`,
        action: 'works_council',
        workflowName: w.name || 'Untitled',
        actor: w.worksCouncil.approvedBy || 'Council rep',
        summary: w.worksCouncil.status === 'approved'
          ? 'Works-council approval recorded.'
          : 'Awaiting works-council approval.',
        detail: w.worksCouncil.note || null,
        ts: now - (30 + (seed % 200)) * 60 * 1000,
        timeLabel: formatAgo(30 + (seed % 200)),
      })
    }
  }
  // Newest first
  return out.sort((a, b) => b.ts - a.ts)
}

function formatAgo(minutesAgo) {
  if (minutesAgo < 60) return `${minutesAgo}m ago`
  const h = Math.floor(minutesAgo / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
