import React, { useState } from 'react'
import {
  Package, Check, X, Download, Trash2, CircleCheck, Eye, HelpCircle, AlertTriangle,
  Layers, Workflow, BookOpen, Languages,
} from 'lucide-react'
import { Card, SectionTitle, PrimaryButton, GhostButton, LogoSquare } from '../components'
import { PACKS_CATALOG, POLICY_OPTIONS, DOMAINS } from '../useV2Store'

/**
 * Packs — distributable Navigator config: capability bundles + processes +
 * answer policies + terminology, installed as one unit. The install flow
 * runs "intent matching": the pack declares what it needs, the installer
 * resolves each intent against the tenant's actual sources.
 */
export default function PacksTab({ store }) {
  const { config, installPack, uninstallPack } = store
  const [installing, setInstalling] = useState(null) // pack being installed (modal)

  return (
    <div className="max-w-[860px] space-y-6 pb-12">
      <div>
        <h1 className="text-[20px] font-bold text-[#111827] mb-1">Packs</h1>
        <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-[620px]">
          Pre-built Navigator configuration per vertical — bundles, processes, policies, and terminology installed
          as one unit. Packs declare what they need; the installer matches those needs against your connected
          systems, so a pack is useful on day one instead of a checklist.
        </p>
      </div>

      <div>
        <SectionTitle count={PACKS_CATALOG.length}>Catalog</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PACKS_CATALOG.map((pack) => {
            const installed = !!config.installedPacks[pack.id]
            return (
              <Card key={pack.id} className="px-4 py-4 flex flex-col">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-[#E6FBF8] flex items-center justify-center text-[18px]">{pack.emoji}</div>
                  <div>
                    <div className="text-[13.5px] font-bold text-[#111827]">{pack.name}</div>
                    {installed && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#166534]">
                        <CircleCheck size={11} /> Installed
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[12px] text-[#6B7280] leading-relaxed mb-3">{pack.tagline}</p>

                <div className="space-y-1.5 mb-4 flex-1">
                  <ContentLine icon={Layers}    label={`${pack.contents.bundles.length} capability bundle${pack.contents.bundles.length === 1 ? '' : 's'}`} sub={pack.contents.bundles.map((b) => b.name).join(', ')} />
                  <ContentLine icon={Workflow}  label={`${pack.contents.processes.length} process${pack.contents.processes.length === 1 ? '' : 'es'}`} sub={pack.contents.processes.map((p) => p.name).join(', ')} />
                  <ContentLine icon={BookOpen}  label={`${pack.contents.policies.length} answer polic${pack.contents.policies.length === 1 ? 'y' : 'ies'}`} sub={pack.contents.policies.map((p) => `${DOMAINS.find((d) => d.id === p.domain)?.name}: ${POLICY_OPTIONS.find((o) => o.id === p.policy)?.label}`).join('; ')} />
                  <ContentLine icon={Languages} label={`${pack.contents.terminology.length} terminology pairs`} sub={pack.contents.terminology.map((t) => t.from).join(', ')} />
                </div>

                {installed ? (
                  <GhostButton danger onClick={() => uninstallPack(pack.id)} className="justify-center">
                    <Trash2 size={12} /> Uninstall — reverts everything
                  </GhostButton>
                ) : (
                  <PrimaryButton onClick={() => setInstalling(pack)} className="justify-center">
                    <Download size={13} /> Install
                  </PrimaryButton>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      <div className="flex items-start gap-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-3">
        <Package size={15} className="text-[#00A593] mt-0.5 shrink-0" />
        <p className="text-[12px] text-[#6B7280] leading-relaxed">
          Installed items appear in <strong className="text-[#374151]">Behaviors</strong>, marked with their pack of
          origin. Pack processes arrive as drafts — test-drive them in chat before activating. Uninstalling reverts
          policies and removes the pack's bundles, processes, and terminology.
        </p>
      </div>

      {installing && (
        <InstallModal
          pack={installing}
          sources={config.sources}
          onClose={() => setInstalling(null)}
          onInstall={(answers) => {
            installPack(installing.id, answers)
            setInstalling(null)
          }}
        />
      )}
    </div>
  )
}

function ContentLine({ icon: Icon, label, sub }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={12} className="text-[#00A593] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-[11.5px] font-semibold text-[#374151]">{label}</span>
        <span className="text-[11px] text-[#9CA3AF]"> — {sub}</span>
      </div>
    </div>
  )
}

/**
 * Intent matching: each declared intent is resolved against the tenant's
 * actual sources. Matched → green with the matched system. Unmatched →
 * either ONE question, or "Navigator will watch the question log for this".
 */
function InstallModal({ pack, sources, onClose, onInstall }) {
  const [answers, setAnswers] = useState({})

  const resolved = pack.intents.map((intent) => {
    if (intent.matchSource) {
      const src = sources.find((s) => s.id === intent.matchSource)
      if (src) return { ...intent, result: 'matched', source: src }
      return { ...intent, result: 'watch' }
    }
    if (intent.ask) return { ...intent, result: 'ask' }
    return { ...intent, result: 'watch' }
  })

  const matched = resolved.filter((i) => i.result === 'matched').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[85vh] overflow-y-auto">
        <div className="px-6 pt-5 pb-4 border-b border-[#F3F4F6] flex items-center gap-3 sticky top-0 bg-white rounded-t-2xl">
          <div className="w-10 h-10 rounded-lg bg-[#E6FBF8] flex items-center justify-center text-[20px]">{pack.emoji}</div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-[#111827]">Install {pack.name}</div>
            <div className="text-[12px] text-[#6B7280]">{matched} of {resolved.length} needs matched against your workspace</div>
          </div>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#111827] p-1" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="px-6 py-4 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">What this pack needs</div>
          {resolved.map((intent) => (
            <IntentRow
              key={intent.id}
              intent={intent}
              answer={answers[intent.id] || ''}
              onAnswer={(v) => setAnswers((prev) => ({ ...prev, [intent.id]: v }))}
            />
          ))}
        </div>

        <div className="px-6 py-4 border-t border-[#F3F4F6] flex items-center gap-2 sticky bottom-0 bg-white rounded-b-2xl">
          <PrimaryButton onClick={() => onInstall(answers)}>
            <Download size={13} /> Install pack
          </PrimaryButton>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <span className="flex-1 text-right text-[11px] text-[#9CA3AF]">Everything is reversible — uninstall reverts.</span>
        </div>
      </div>
    </div>
  )
}

function IntentRow({ intent, answer, onAnswer }) {
  if (intent.result === 'matched') {
    const degraded = intent.source.health === 'degraded'
    return (
      <div className="flex items-start gap-2.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3.5 py-2.5">
        <Check size={14} className="text-[#16A34A] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-[#111827]">{intent.label}</div>
          <div className="text-[11.5px] text-[#166534] mt-0.5 flex items-center gap-1.5 flex-wrap">
            <LogoSquare name={intent.source.name} color={intent.source.color} size={16} />
            Matched: {intent.source.name}
            {degraded && (
              <span className="inline-flex items-center gap-1 text-[#92400E] font-semibold">
                <AlertTriangle size={11} /> currently degraded — works once reconnected
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }
  if (intent.result === 'ask') {
    return (
      <div className="flex items-start gap-2.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg px-3.5 py-2.5">
        <HelpCircle size={14} className="text-[#00A593] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-[#111827]">{intent.label}</div>
          <div className="text-[11.5px] text-[#6B7280] mt-0.5 mb-1.5">{intent.ask}</div>
          <input
            value={answer}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="One answer is all it needs…"
            className="w-full text-[12px] px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md outline-none focus:border-[#00A593]"
          />
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5 bg-[#FAFAFA] border border-dashed border-[#D1D5DB] rounded-lg px-3.5 py-2.5">
      <Eye size={14} className="text-[#9CA3AF] mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-[#111827]">{intent.label}</div>
        <div className="text-[11.5px] text-[#6B7280] mt-0.5">
          No matching source — Navigator will watch the question log for this and propose a fix when demand shows up.
        </div>
      </div>
    </div>
  )
}
