import React, { useState } from 'react'
import { UserCog, Workflow, ChevronRight, Search, Users } from 'lucide-react'

const MOCK_REPORTS = [
  { id: 'u1', name: 'Aisha Khan',   role: 'Frontline',  location: 'EMEA',  avatar: 'AK', color: '#2563EB' },
  { id: 'u2', name: 'Diego Ramírez', role: 'Office',    location: 'AMER', avatar: 'DR', color: '#0D9488' },
  { id: 'u3', name: 'Hanna Müller',  role: 'Field service', location: 'DACH', avatar: 'HM', color: '#9333EA' },
  { id: 'u4', name: 'Ravi Patel',    role: 'Manager',   location: 'APAC', avatar: 'RP', color: '#EA580C' },
]

/**
 * Manager launcher demo — preview of the surface managers see when they want
 * to start a flow for one of their reports. (e.g. firing "Onboard a new
 * joiner" before the new hire has even installed Staffbase yet.)
 *
 * In a real rollout this would live in the People / Direct Reports surface;
 * here it's a self-contained component the admin can preview from the flow
 * editor.
 */
export default function ManagerLauncherCard({ workflow }) {
  const [picked, setPicked] = useState(MOCK_REPORTS[0])
  const [filter, setFilter] = useState('')
  const filtered = MOCK_REPORTS.filter((r) =>
    !filter.trim() || r.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <p className="text-[12px] text-[#6B7280] mb-3 leading-relaxed">
        Managers can kick off this workflow on behalf of a direct report from their People view. The employee receives a push and a chat card, prefilled with the inputs the manager already supplied.
      </p>

      {/* Mock Staffbase manager launcher */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] flex items-center gap-2">
          <UserCog size={14} className="text-[#7C3AED]" />
          <span className="text-[12.5px] font-bold text-[#111827]">Start a workflow for someone</span>
        </div>

        <div className="p-4">
          {/* Picked flow */}
          <div className="flex items-center gap-2.5 mb-3 p-2.5 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE]">
            <Workflow size={16} className="text-[#7C3AED] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-bold text-[#5B21B6]">{workflow.name || 'Workflow'}</div>
              <div className="text-[11px] text-[#5B21B6]/80 truncate">{workflow.goal || 'No goal set.'}</div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-[#5B21B6] bg-white border border-[#DDD6FE]">
              {workflow.mode || 'suggested'}
            </span>
          </div>

          {/* Report picker */}
          <div className="mb-3">
            <div className="text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Users size={11} /> Who is this for?
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search reports…"
                className="w-full pl-7 pr-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
              />
            </div>
            <div className="mt-2 max-h-44 overflow-y-auto border border-[#E5E7EB] rounded-lg divide-y divide-[#F1F5F9]">
              {filtered.length === 0
                ? <div className="px-3 py-2 text-[11px] text-[#94A3B8] italic">No reports match.</div>
                : filtered.map((r) => {
                    const selected = picked?.id === r.id
                    return (
                      <button
                        key={r.id}
                        onClick={() => setPicked(r)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 text-left ${selected ? 'bg-[#F5F3FF]' : 'hover:bg-[#F9FAFB]'}`}
                      >
                        <div className="w-7 h-7 rounded-full text-white flex items-center justify-center text-[10.5px] font-bold shrink-0" style={{ background: r.color }}>
                          {r.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-semibold text-[#111827] truncate">{r.name}</div>
                          <div className="text-[10.5px] text-[#6B7280] truncate">{r.role} · {r.location}</div>
                        </div>
                        {selected && <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#7C3AED] text-white">Selected</span>}
                      </button>
                    )
                  })}
            </div>
          </div>

          {/* Send */}
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0]">
            <div className="text-[11.5px] text-[#065F46]">
              {picked
                ? <><b>{picked.name}</b> will get a push and a chat card the moment they open Staffbase.</>
                : 'Pick someone above to start the flow on their behalf.'}
            </div>
            <button
              disabled={!picked}
              className="px-3 py-1.5 bg-[#065F46] text-white text-[12px] font-bold rounded-lg disabled:opacity-50 flex items-center gap-1"
            >
              Start <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 px-3 py-2 bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg text-[11px] text-[#075985]">
        <b>Use case:</b> A line manager files the IT-equipment ticket for a new hire <i>before</i> the hire's first day, so the laptop is on their desk on day one — no chat needed.
      </div>
    </div>
  )
}
