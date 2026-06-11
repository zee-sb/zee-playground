import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { LayoutDashboard, Plug, SlidersHorizontal, Package, RotateCcw, Eye, ChevronRight, ChevronDown, Sparkles } from 'lucide-react'
import { StudioShell } from '../../components/StudioShell'
import { useV2Store, deriveTuneChecks } from './useV2Store'
import Day0Screen from './Day0'
import OverviewTab from './tabs/OverviewTab'
import SourcesTab from './tabs/SourcesTab'
import BehaviorsTab from './tabs/BehaviorsTab'
import PacksTab from './tabs/PacksTab'

/**
 * Navigator Studio V2 — the target-concept admin surface.
 *
 * Four tabs; the home tab is the OVERVIEW — analytics, setup health, and
 * the question log on one surface. The admin's job is reviewing what
 * Navigator learned, proposed, and flagged — not authoring experts,
 * instructions, or workflows up front.
 *
 *   home      — Overview (stats, setup health, question log + proposals)
 *   sources   — Sources & Actions (systems AND external agents, risk tiers, identity)
 *   behaviors — answer policies, tone/terminology, escalation, bundles, processes
 *   packs     — installable vertical config
 *
 * Day-0 mode (setup.stage === 'day0') replaces the tabs with a single
 * decision: connect the intranet. "Reset demo" offers both entry points.
 *
 * State lives in useV2Store (localStorage, server seam stubbed). Existing
 * prototypes are untouched — this is the B side of the A/B.
 */
const TABS = [
  { id: 'home',      label: 'Overview',          icon: LayoutDashboard },
  { id: 'sources',   label: 'Sources & Actions', icon: Plug },
  { id: 'behaviors', label: 'Behaviors',         icon: SlidersHorizontal },
  { id: 'packs',     label: 'Packs',             icon: Package },
]

export default function NavigatorV2Studio() {
  const location = useLocation()
  const navigate = useNavigate()
  const store = useV2Store()

  // Path-based tabs, same scheme as the legacy Studio.
  const pathParts = location.pathname.split('/').filter(Boolean)
  const protoIdx = pathParts.indexOf('navigator-v2-studio')
  const basePath = protoIdx !== -1 ? '/' + pathParts.slice(0, protoIdx + 1).join('/') : '/prototypes/navigator-v2-studio'
  const rawTab = pathParts[protoIdx + 1] || 'home'
  const activeTabId = TABS.some((t) => t.id === rawTab) ? rawTab : 'home'

  const isDay0 = store.config.setup?.stage === 'day0'
  const openProposals = (store.config.proposals || []).filter((p) => p.status === 'open').length
  const tuneIssues = useMemo(
    () => deriveTuneChecks(store.config).filter((c) => c.severity !== 'info').length,
    [store.config]
  )
  const homeBadge = openProposals + tuneIssues

  return (
    <StudioShell activeSidebarItem="Navigator">
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Header — tenant strip, teal for V2 */}
        <div className="border-b border-[#E5E7EB] px-8 pt-6 pb-0 bg-white">
          <div className={`flex items-end justify-between gap-3 flex-wrap ${isDay0 ? 'pb-5' : 'mb-4'}`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-[18px] shrink-0" style={{ background: '#00C7B2' }}>
                S
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[22px] font-bold text-[#111827] leading-none">Staffbase</h1>
                  <span className="text-[11px] font-semibold text-[#067A6E] bg-[#E6FBF8] px-2 py-0.5 rounded-full">Navigator V2 · target concept</span>
                  {isDay0 && <span className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">day 0</span>}
                </div>
                <p className="text-[12px] text-[#6B7280] font-mono mt-1">campsite.staffbase.com</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/prototypes/navigator-v2-chat"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-white transition-colors"
                style={{ background: '#111827' }}
              >
                <Eye size={13} />
                Open V2 Chat
                <ChevronRight size={13} />
              </Link>
              <ResetMenu onReset={(mode) => { store.resetV2(mode); navigate(basePath) }} />
            </div>
          </div>

          {!isDay0 && (
            <nav className="flex gap-1 overflow-x-auto">
              {TABS.map((t) => {
                const Icon = t.icon
                const active = activeTabId === t.id
                return (
                  <Link
                    key={t.id}
                    to={`${basePath}/${t.id}`}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                      active ? 'border-[#00A593] text-[#111827]' : 'border-transparent text-[#6B7280] hover:text-[#111827]'
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                    {t.id === 'home' && homeBadge > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#00A593' }}>
                        {homeBadge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        {/* Content */}
        {isDay0 ? (
          <div className="flex-1 overflow-y-auto bg-[#FBFBFC] flex flex-col">
            <Day0Screen store={store} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-8 py-6 bg-[#FBFBFC]">
            {activeTabId === 'home'      && <OverviewTab store={store} onNavigate={(tab) => navigate(`${basePath}/${tab}`)} />}
            {activeTabId === 'sources'   && <SourcesTab store={store} />}
            {activeTabId === 'behaviors' && <BehaviorsTab store={store} />}
            {activeTabId === 'packs'     && <PacksTab store={store} />}
          </div>
        )}
      </div>
    </StudioShell>
  )
}

/** Reset with two entry points: full demo data, or the day-0 journey. */
function ResetMenu({ onReset }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function pick(mode) {
    setOpen(false)
    onReset(mode)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        title="Reset the V2 demo state (localStorage only)."
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#00A593] hover:text-[#00A593] text-[12px] font-semibold text-[#374151] transition-colors"
      >
        <RotateCcw size={13} />
        Reset demo
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[260px] bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-40 overflow-hidden">
          <button onClick={() => pick('demo')} className="w-full flex items-start gap-2.5 px-3.5 py-3 text-left hover:bg-[#F9FAFB] transition-colors">
            <Package size={14} className="text-[#00A593] mt-0.5 shrink-0" />
            <span>
              <span className="block text-[12.5px] font-bold text-[#111827]">Full demo data</span>
              <span className="block text-[11px] text-[#6B7280] mt-0.5">All sources, clusters, proposals — plus 3 live setup-health issues.</span>
            </span>
          </button>
          <button onClick={() => pick('day0')} className="w-full flex items-start gap-2.5 px-3.5 py-3 text-left hover:bg-[#F9FAFB] border-t border-[#F3F4F6] transition-colors">
            <Sparkles size={14} className="text-[#00A593] mt-0.5 shrink-0" />
            <span>
              <span className="block text-[12.5px] font-bold text-[#111827]">Start from day 0</span>
              <span className="block text-[11px] text-[#6B7280] mt-0.5">Fresh tenant — one decision, then value, then demand-driven iteration.</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
