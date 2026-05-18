import React, { useState, useRef, useEffect } from 'react'
import { Plus, ChevronRight, ChevronDown, Wrench, Bot, BookOpen, Users, Sparkles, LayoutGrid, FileText } from 'lucide-react'
import { LogoChip, StatusPill } from '../components/Catalog'

const KIND_COLOR = { toolkit: '#7C3AED', handoff: '#F59E0B', search: '#2563EB' }

/**
 * Experts page — internal personas with connection linking.
 *
 * Each row shows:
 *   - Identity (icon, name, description)
 *   - Connections linked: toolkit chips + handoff chips + search chips
 *   - Targeting groups
 *   - Status pill
 * Click a row to open the detail editor.
 */
export default function AssistantsList({
  experts = [],
  connections = [],
  onSelect,
  onCreate,
  onOpenTemplates,
  onOpenAiCreator,
}) {
  const connectionById = new Map(connections.map((c) => [c.id, c]))
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Click outside closes the split-button menu.
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Experts</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            User-facing personas. Each can call toolkits, hand off to agents, and ground in search sources.
          </p>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-[#111827] text-white text-[13px] font-semibold rounded-lg hover:bg-[#1F2937] transition-colors"
          >
            <Plus size={15} />
            New expert
            <ChevronDown size={13} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-[260px] bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-30 overflow-hidden">
              <MenuItem
                icon={<FileText size={14} />}
                title="Blank"
                hint="Start from an empty form."
                onClick={() => { setMenuOpen(false); onCreate?.() }}
              />
              <MenuItem
                icon={<LayoutGrid size={14} />}
                title="From template"
                hint="Pick a curated template (HR, IT, Onboarding…)."
                onClick={() => { setMenuOpen(false); onOpenTemplates?.() }}
              />
              <MenuItem
                icon={<Sparkles size={14} className="text-[#7C3AED]" />}
                title="AI-generated"
                hint="Describe an expert; we draft the prompt."
                onClick={() => { setMenuOpen(false); onOpenAiCreator?.() }}
                accent
              />
            </div>
          )}
        </div>
      </div>

      {experts.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl py-12 px-6 text-center">
          <div className="text-[14px] font-semibold text-[#111827]">No experts yet</div>
          <div className="text-[12px] text-[#6B7280] mt-1">Create one to start linking connections.</div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          {experts.map((a, i) => {
            const linked = (a.connectionIds || []).map((id) => connectionById.get(id)).filter(Boolean)
            const linkedToolkits = linked.filter((c) => c.kind === 'toolkit')
            const linkedHandoffs = linked.filter((c) => c.kind === 'handoff')
            const linkedSearches = linked.filter((c) => c.kind === 'search')
            const searchCount = linkedSearches.length
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a)}
                className={`w-full text-left px-5 py-4 hover:bg-[#FAFAFA] transition-colors flex items-center gap-4 ${i > 0 ? 'border-t border-[#F1F5F9]' : ''}`}
              >
                <div className="text-[24px] shrink-0">{a.icon || '✨'}</div>
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[14px] text-[#111827]">{a.name}</span>
                      <StatusPill status={a.status === 'active' ? 'active' : 'inactive'} />
                    </div>
                    <p className="text-[12px] text-[#6B7280] mt-0.5 line-clamp-1">{a.description}</p>

                    {/* Connection chips */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      {linkedHandoffs.length > 0 && (
                        <ChipGroup icon={<Bot size={11} />} label={`${linkedHandoffs.length} handoff${linkedHandoffs.length === 1 ? '' : 's'}`}>
                          {linkedHandoffs.map(c => <Chip key={c.id} name={c.name} color={KIND_COLOR.handoff} />)}
                        </ChipGroup>
                      )}
                      {linkedToolkits.length > 0 && (
                        <ChipGroup icon={<Wrench size={11} />} label={`${linkedToolkits.length} toolkit${linkedToolkits.length === 1 ? '' : 's'}`}>
                          {linkedToolkits.map(c => <Chip key={c.id} name={c.name} color={KIND_COLOR.toolkit} />)}
                        </ChipGroup>
                      )}
                      {linkedSearches.length > 0 && (
                        <ChipGroup icon={<BookOpen size={11} />} label={`${linkedSearches.length} search${linkedSearches.length === 1 ? '' : 'es'}`}>
                          {linkedSearches.map(c => <Chip key={c.id} name={c.name} color={KIND_COLOR.search} />)}
                        </ChipGroup>
                      )}
                      {linkedHandoffs.length === 0 && linkedToolkits.length === 0 && searchCount === 0 && (
                        <span className="text-[11px] text-[#94A3B8] italic">No connections linked yet</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden md:flex items-center gap-1 text-[11px] text-[#6B7280]">
                      <Users size={11} />
                      <span>{(a.targetGroups || []).join(', ') || 'No targeting'}</span>
                    </div>
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

function ChipGroup({ icon, label, children }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
        {icon}
        {label}
      </span>
      <span className="flex flex-wrap gap-1">{children}</span>
    </div>
  )
}

function Chip({ name, color }) {
  return (
    <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-[11px] font-medium text-[#374151]">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color || '#94A3B8' }} />
      {name}
    </span>
  )
}

function MenuItem({ icon, title, hint, onClick, accent = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
        accent ? 'hover:bg-[#F5F3FF]' : 'hover:bg-[#F9FAFB]'
      }`}
    >
      <span className={`w-7 h-7 rounded-md grid place-items-center shrink-0 ${accent ? 'bg-[#F5F3FF]' : 'bg-[#F3F4F6]'}`}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#111827]">{title}</div>
        <div className="text-[11.5px] text-[#6B7280] leading-snug">{hint}</div>
      </span>
    </button>
  )
}
