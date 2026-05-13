import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, AlertCircle, AlertTriangle, Info, RotateCw, Sparkles, Filter } from 'lucide-react'
import { useNavigatorHealth } from '../hooks/useNavigatorHealth'
import HealthIssueCard from '../components/HealthIssueCard'

const FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'error',   label: 'Errors' },
  { id: 'warning', label: 'Warnings' },
  { id: 'info',    label: 'Info' },
]

const TYPE_LABEL = {
  all: 'All entities',
  assistant: 'Assistants',
  mcp: 'Connectors',
  agent: 'Agents',
  kb: 'Knowledge bases',
  flow: 'Flows',
  workspace: 'Workspace',
  blueprint: 'Blueprint',
}

// Compact health summary card — three severity counts + an action button.
// Re-used on the Home tab. Header is omitted when `compact` is true.
export function HealthSummary({ summary, loading, onAction, actionLabel = 'View all issues', actionIcon: ActionIcon = ShieldCheck }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          icon={AlertCircle} color="#DC2626" bg="#FEF2F2" border="#FCA5A5"
          label="Errors" count={summary?.errors || 0}
        />
        <SummaryCard
          icon={AlertTriangle} color="#D97706" bg="#FEF9C3" border="#FACC15"
          label="Warnings" count={summary?.warnings || 0}
        />
        <SummaryCard
          icon={Info} color="#2563EB" bg="#EFF6FF" border="#BFDBFE"
          label="Info" count={summary?.info || 0}
        />
      </div>
      {onAction && (
        <button
          onClick={onAction}
          disabled={loading}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#7C3AED] hover:text-[#7C3AED] text-[12.5px] font-semibold text-[#374151] disabled:opacity-50"
        >
          <ActionIcon size={13} />
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// When embedded inside another panel (e.g. Home tab) we skip the page header
// and the summary cards — the outer panel already provides them.
export default function HealthTab({ basePath, embedded = false }) {
  const navigate = useNavigate()
  const { issues, summary, loading, error, deep, setDeep, refresh, applyAutoFix } = useNavigatorHealth()
  const [sevFilter, setSevFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [fixableOnly, setFixableOnly] = useState(false)

  const filtered = useMemo(() => {
    return (issues || []).filter((i) => {
      if (sevFilter !== 'all' && i.severity !== sevFilter) return false
      if (typeFilter !== 'all' && i.subject?.type !== typeFilter) return false
      if (fixableOnly && !i.autoFix) return false
      return true
    })
  }, [issues, sevFilter, typeFilter, fixableOnly])

  // Group filtered issues by category for readable display.
  const byCategory = useMemo(() => {
    const out = new Map()
    for (const i of filtered) {
      const key = i.category || 'state'
      if (!out.has(key)) out.set(key, [])
      out.get(key).push(i)
    }
    return out
  }, [filtered])

  const categoryLabels = summary?.categoryLabels || {
    'broken-references': 'Broken references',
    'scope-conflicts':   'Scope conflicts',
    'unused':            'Unused / orphan',
    'state':             'State machine',
    'blueprint':         'Blueprint coverage',
  }

  function handleOpen(issue) {
    if (!issue.subject) return
    const t = issue.subject.type
    const id = issue.subject.id
    if (t === 'assistant' && id) navigate(`${basePath}/assistants/${id}`)
    else if (t === 'mcp') navigate(`${basePath}/mcp`)
    else if (t === 'agent') navigate(`${basePath}/agents`)
    else if (t === 'kb') navigate(`${basePath}/kb`)
    else if (t === 'flow' && id) navigate(`${basePath}/flows/${id}`)
    else if (t === 'blueprint') navigate(`${basePath}/home`)
    else if (t === 'workspace') navigate(`${basePath}/assistants`)
  }

  function handleFix(issue) {
    if (!issue.autoFix) return
    applyAutoFix(issue.autoFix.action, issue.autoFix.payload)
  }

  const entityTypes = Array.from(new Set((issues || []).map((i) => i.subject?.type).filter(Boolean)))

  return (
    <div className="max-w-4xl">
      {!embedded && (
        <>
          {/* Header — skipped when embedded inside the Home tab. */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-[#7C3AED]" />
                <h2 className="text-[18px] font-bold text-[#111827]">Navigator health</h2>
              </div>
              <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-xl">
                Cross-entity validation across Assistants, Flows, MCPs, Agents, and Knowledge Bases. Surfaces broken references, scope overlaps, orphan resources, and gaps in your workspace blueprint.
              </p>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#7C3AED] hover:text-[#7C3AED] text-[12.5px] font-semibold text-[#374151] disabled:opacity-50"
            >
              <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
              Re-run
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <SummaryCard
              icon={AlertCircle} color="#DC2626" bg="#FEF2F2" border="#FCA5A5"
              label="Errors" count={summary?.errors || 0}
            />
            <SummaryCard
              icon={AlertTriangle} color="#D97706" bg="#FEF9C3" border="#FACC15"
              label="Warnings" count={summary?.warnings || 0}
            />
            <SummaryCard
              icon={Info} color="#2563EB" bg="#EFF6FF" border="#BFDBFE"
              label="Info" count={summary?.info || 0}
            />
          </div>
        </>
      )}

      {/* Filters + deep toggle */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="inline-flex items-center gap-1 border border-[#E5E7EB] rounded-lg p-0.5 bg-white">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setSevFilter(f.id)}
              className={`px-2.5 py-1 text-[11.5px] font-semibold rounded ${
                sevFilter === f.id ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2.5 py-1 text-[11.5px] font-semibold rounded-lg border border-[#E5E7EB] bg-white text-[#374151]"
        >
          <option value="all">{TYPE_LABEL.all}</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t] || t}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#374151] cursor-pointer">
          <input
            type="checkbox"
            checked={fixableOnly}
            onChange={(e) => setFixableOnly(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          Fixable only
        </label>
        <div className="flex-1" />
        <label
          title="Run an LLM-judged check for overlapping assistant scopes. Slower; costs tokens."
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white text-[11.5px] font-semibold text-[#374151] cursor-pointer"
        >
          <Sparkles size={12} className="text-[#7C3AED]" />
          <input
            type="checkbox"
            checked={deep}
            onChange={(e) => setDeep(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          Deep check (LLM)
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] px-3 py-2 text-[12px] mb-4">
          Health check failed: {error}
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="flex items-center gap-2 bg-[#DCFCE7] border border-[#86EFAC] rounded-lg px-3 py-3">
          <ShieldCheck size={16} className="text-[#15803D]" />
          <span className="text-[12.5px] text-[#15803D] font-medium">
            {summary?.total === 0
              ? 'No issues detected. Your Navigator workspace is healthy.'
              : 'No issues match the current filters.'}
          </span>
        </div>
      )}

      {/* Grouped issues */}
      <div className="space-y-5">
        {Array.from(byCategory.entries()).map(([cat, items]) => (
          <section key={cat}>
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-[13px] font-bold text-[#111827]">{categoryLabels[cat] || cat}</h3>
              <span className="text-[11px] font-mono text-[#9CA3AF]">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <HealthIssueCard
                  key={`${it.id}-${it.subject?.id || i}-${i}`}
                  issue={it}
                  onOpen={handleOpen}
                  onFix={handleFix}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, color, bg, border, label, count }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ background: bg, borderColor: border }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <Icon size={15} style={{ color }} />
      </div>
      <div className="text-[28px] font-bold mt-1 leading-none" style={{ color }}>{count}</div>
    </div>
  )
}
