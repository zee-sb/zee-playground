import React, { useEffect, useState } from 'react'
import { Plug, Check, Loader2, ShieldCheck, Sparkles } from 'lucide-react'

/**
 * Day-0 onboarding — value before configuration.
 *
 * One decision: connect the Staffbase intranet. The connect is simulated
 * (read channels → index pages → inherit permissions) and ends in
 * store.connectIntranet(), which flips setup.stage to 'connected' — the
 * Studio then shows the "Navigator is live" moment on the Overview tab and
 * starts drip-feeding demand-driven suggestions.
 */

const CONNECT_STEPS = [
  'Reading channels & news…',
  'Indexing pages & policies…',
  'Inheriting permissions — nothing to configure',
]

export default function Day0Screen({ store }) {
  const [phase, setPhase] = useState('idle') // idle | connecting
  const [done, setDone] = useState(0)        // completed connect steps

  useEffect(() => {
    if (phase !== 'connecting') return
    if (done >= CONNECT_STEPS.length) {
      const t = setTimeout(() => store.connectIntranet(), 500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setDone((d) => d + 1), 1100)
    return () => clearTimeout(t)
  }, [phase, done, store])

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[460px] text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white mb-5" style={{ background: '#00C7B2' }}>
          <Sparkles size={24} />
        </div>

        <h1 className="text-[22px] font-bold text-[#111827] leading-snug">
          One decision stands between you and a working Navigator.
        </h1>
        <p className="text-[13.5px] text-[#6B7280] leading-relaxed mt-3">
          Connect your Staffbase intranet. Navigator inherits its permissions, indexes its content, and starts
          answering with citations — today. There are no experts to define, no prompts to write, no audiences
          to map. Everything after this is iteration, driven by what employees actually ask.
        </p>

        {phase === 'idle' ? (
          <>
            <button
              onClick={() => setPhase('connecting')}
              className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-bold text-white transition-colors"
              style={{ background: '#00A593' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#008C7D' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#00A593' }}
            >
              <Plug size={16} /> Connect Staffbase Intranet
            </button>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-[#9CA3AF]">
              <ShieldCheck size={12} className="text-[#00A593]" />
              Permissions are inherited, never re-modeled — Navigator can’t show anyone more than the intranet already does.
            </div>
            <button
              onClick={() => store.resetV2('demo')}
              className="mt-8 text-[11.5px] text-[#9CA3AF] hover:text-[#6B7280] underline underline-offset-2"
            >
              Skip ahead — load the full demo data instead
            </button>
          </>
        ) : (
          <div className="mt-7 mx-auto max-w-[320px] bg-white border border-[#E5E7EB] rounded-xl px-5 py-4 text-left space-y-2.5 shadow-sm">
            {CONNECT_STEPS.map((label, i) => {
              const isDone = i < done
              const isActive = i === done
              if (!isDone && !isActive) {
                return <div key={i} className="flex items-center gap-2.5 text-[12.5px] text-[#C0C4CC]"><span className="w-[14px]" />{label}</div>
              }
              return (
                <div key={i} className="flex items-center gap-2.5 text-[12.5px]">
                  {isDone
                    ? <Check size={14} className="shrink-0 text-[#16A34A]" />
                    : <Loader2 size={14} className="shrink-0 animate-spin" style={{ color: '#00A593' }} />}
                  <span className={isDone ? 'text-[#6B7280]' : 'text-[#111827] font-semibold'}>{label}</span>
                </div>
              )
            })}
            {done >= CONNECT_STEPS.length && (
              <div className="pt-1 text-[12px] font-bold" style={{ color: '#00A593' }}>Navigator is live.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
