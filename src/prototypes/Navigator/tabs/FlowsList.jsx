import React from 'react'
import { Plus, ChevronRight, Wrench, Workflow } from 'lucide-react'
import { StatusPill } from '../components/Catalog'

/**
 * Workflows page — admin-defined, goal-driven workflows the Navigator brain
 * can invoke automatically when employee intent matches the trigger. Each row
 * shows the trigger sentence, mode (suggested / required), and tool count.
 */
export default function FlowsList({ workflows = [], onSelect, onCreate }) {
  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Workflows</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Goal-driven workflows that Navigator can invoke when an employee's intent matches a trigger.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#7C3AED] text-white text-[13px] font-semibold rounded-lg hover:bg-[#6D28D9] transition-colors"
        >
          <Plus size={15} />
          New workflow
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl py-12 px-6 text-center">
          <Workflow size={20} className="mx-auto text-[#94A3B8] mb-2" />
          <div className="text-[14px] font-semibold text-[#111827]">No workflows yet</div>
          <div className="text-[12px] text-[#6B7280] mt-1">Create your first workflow to guide employees through tasks.</div>
          <button
            onClick={onCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#7C3AED] text-white text-[12px] font-semibold rounded-lg hover:bg-[#6D28D9] transition-colors"
          >
            <Plus size={13} />
            New workflow
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          {workflows.map((f, i) => {
            const toolCount = (f.tools || []).length
            return (
              <button
                key={f.id}
                onClick={() => onSelect(f)}
                className={`w-full text-left px-5 py-4 hover:bg-[#FAFAFA] transition-colors flex items-center gap-4 ${i > 0 ? 'border-t border-[#F1F5F9]' : ''}`}
              >
                <div className="w-10 h-10 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center shrink-0">
                  <Workflow size={16} className="text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[14px] text-[#111827]">{f.name || 'Untitled workflow'}</span>
                      <StatusPill status={f.status === 'active' ? 'active' : 'draft'} />
                      <ModeBadge mode={f.mode} />
                    </div>
                    <p className="text-[12px] text-[#6B7280] italic mt-0.5 line-clamp-1">{f.trigger || 'No trigger configured'}</p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                        <Wrench size={11} />
                        {toolCount} tool{toolCount === 1 ? '' : 's'}
                      </span>
                      {f.instructions && (
                        <span className="text-[11px] text-[#94A3B8] truncate max-w-[280px]">· {f.instructions}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <ChevronRight size={16} className="text-[#9CA3AF]" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ModeBadge({ mode }) {
  if (mode === 'required') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ background: '#F59E0B', color: '#FFFFFF' }}>
        Required
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: '#FFFFFF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
      Suggested
    </span>
  )
}
