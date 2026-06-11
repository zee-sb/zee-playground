import React, { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Inbox, Plug, SlidersHorizontal, Package, RotateCcw, Eye, ChevronRight } from 'lucide-react'
import { StudioShell } from '../../components/StudioShell'
import { useV2Store } from './useV2Store'
import QuestionLogTab from './tabs/QuestionLogTab'
import SourcesTab from './tabs/SourcesTab'
import BehaviorsTab from './tabs/BehaviorsTab'
import PacksTab from './tabs/PacksTab'

/**
 * Navigator Studio V2 — the target-concept admin surface.
 *
 * Four tabs, and the home tab is the QUESTION LOG, not a builder: the
 * admin's job is reviewing what Navigator learned and proposed, not
 * authoring experts/instructions/workflows up front.
 *
 *   home      — Question log (clustered demand + proposals)
 *   sources   — Sources & Actions (per-system, risk tiers, identity)
 *   behaviors — answer policies, tone/terminology, escalation, bundles, processes
 *   packs     — installable vertical config
 *
 * State lives in useV2Store (localStorage, server seam stubbed). Existing
 * prototypes are untouched — this is the B side of the A/B.
 */
const TABS = [
  { id: 'home',      label: 'Question log',      icon: Inbox },
  { id: 'sources',   label: 'Sources & Actions', icon: Plug },
  { id: 'behaviors', label: 'Behaviors',         icon: SlidersHorizontal },
  { id: 'packs',     label: 'Packs',             icon: Package },
]

export default function NavigatorV2Studio() {
  const location = useLocation()
  const navigate = useNavigate()
  const store = useV2Store()
  const [resetting, setResetting] = useState(false)

  // Path-based tabs, same scheme as the legacy Studio.
  const pathParts = location.pathname.split('/').filter(Boolean)
  const protoIdx = pathParts.indexOf('navigator-v2-studio')
  const basePath = protoIdx !== -1 ? '/' + pathParts.slice(0, protoIdx + 1).join('/') : '/prototypes/navigator-v2-studio'
  const rawTab = pathParts[protoIdx + 1] || 'home'
  const activeTabId = TABS.some((t) => t.id === rawTab) ? rawTab : 'home'

  const openProposals = (store.config.proposals || []).filter((p) => p.status === 'open').length

  function handleReset() {
    if (resetting) return
    const ok = window.confirm('Reset the V2 demo to its seeded state? Proposals, packs, processes, and chat escalations are restored.')
    if (!ok) return
    setResetting(true)
    store.resetV2()
    setTimeout(() => setResetting(false), 400)
  }

  return (
    <StudioShell activeSidebarItem="Navigator">
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Header — tenant strip, teal for V2 */}
        <div className="border-b border-[#E5E7EB] px-8 pt-6 pb-0 bg-white">
          <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-[18px] shrink-0" style={{ background: '#00C7B2' }}>
                S
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[22px] font-bold text-[#111827] leading-none">Staffbase</h1>
                  <span className="text-[11px] font-semibold text-[#067A6E] bg-[#E6FBF8] px-2 py-0.5 rounded-full">Navigator V2 · target concept</span>
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
              <button
                onClick={handleReset}
                disabled={resetting}
                title="Reset the V2 demo state (localStorage only)."
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#00A593] hover:text-[#00A593] text-[12px] font-semibold text-[#374151] disabled:opacity-50 transition-colors"
              >
                <RotateCcw size={13} className={resetting ? 'animate-spin' : ''} />
                {resetting ? 'Resetting…' : 'Reset demo'}
              </button>
            </div>
          </div>

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
                  {t.id === 'home' && openProposals > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#00A593' }}>
                      {openProposals}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 bg-[#FBFBFC]">
          {activeTabId === 'home'      && <QuestionLogTab store={store} />}
          {activeTabId === 'sources'   && <SourcesTab store={store} />}
          {activeTabId === 'behaviors' && <BehaviorsTab store={store} />}
          {activeTabId === 'packs'     && <PacksTab store={store} />}
        </div>
      </div>
    </StudioShell>
  )
}
