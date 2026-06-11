import React, { useState } from 'react'
import {
  BookOpen, Languages, Route, Layers, Workflow, Plus, X, ChevronDown, ChevronRight,
  AlertTriangle, EyeOff, Sparkles, Check, Trash2, Paperclip, Loader2, PlayCircle, PauseCircle,
} from 'lucide-react'
import {
  Card, SectionTitle, PrimaryButton, GhostButton, OriginBadge, DerivedBadge, StepTypeChip, InfoTip,
} from '../components'
import { DOMAINS, POLICY_OPTIONS, TONE_PRESETS, PACKS_CATALOG, generateProcessDraft } from '../useV2Store'

/**
 * Behaviors — how Navigator answers and acts. Policy, not plumbing:
 * (a) answer policies per content domain, (b) tone & terminology as
 * structured data (raw prompt demoted to an escape hatch), (c) escalation
 * routes, (d) capability bundles (internal), (e) processes — described,
 * not built.
 */
export default function BehaviorsTab({ store }) {
  const { config } = store
  const b = config.behaviors

  return (
    <div className="max-w-[860px] space-y-8 pb-12">
      <div>
        <h1 className="text-[20px] font-bold text-[#111827] mb-1">Behaviors</h1>
        <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-[620px]">
          How Navigator answers and acts. Everything here is structured policy — no free-prose prompts
          on the main path.
        </p>
      </div>

      <AnswerPolicies store={store} behaviors={b} />
      <ToneTerminology store={store} behaviors={b} />
      <EscalationRoutes store={store} behaviors={b} />
      <Bundles behaviors={b} />
      <Processes store={store} behaviors={b} />
    </div>
  )
}

// ── (a) Answer policies ──────────────────────────────────────────────────────

function AnswerPolicies({ store, behaviors }) {
  const { setAnswerPolicy } = store
  return (
    <section>
      <SectionTitle>
        <span className="inline-flex items-center gap-2"><BookOpen size={15} className="text-[#00A593]" /> Answer policies</span>
      </SectionTitle>
      <Card>
        {DOMAINS.map((d, i) => {
          const current = behaviors.answerPolicies[d.id]
          const origin = behaviors.policyOrigins?.[d.id]
          return (
            <div key={d.id} className={`px-5 py-3.5 flex flex-wrap items-center gap-3 ${i < DOMAINS.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-[#111827]">{d.name}</span>
                  {origin && <OriginBadge>from {origin} pack</OriginBadge>}
                </div>
                <div className="text-[11.5px] text-[#9CA3AF] mt-0.5">{d.hint}</div>
              </div>
              <div className="inline-flex bg-[#F3F4F6] rounded-lg p-0.5">
                {POLICY_OPTIONS.map((opt) => {
                  const active = current === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setAnswerPolicy(d.id, opt.id)}
                      className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md transition-colors ${
                        active ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
                      }`}
                      style={active && opt.id === 'cite-or-refuse' ? { color: '#B45309' } : active && opt.id === 'deflect' ? { color: '#6D28D9' } : {}}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </Card>
    </section>
  )
}

// ── (b) Tone & terminology — structured, not prose ───────────────────────────

function ToneTerminology({ store, behaviors }) {
  const {
    addTerminology, removeTerminology, setTonePreset,
    addBannedPhrase, removeBannedPhrase, setRawInstructions,
  } = store
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')
  const [newPhrase, setNewPhrase] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  function submitTerm(e) {
    e.preventDefault()
    if (!newFrom.trim() || !newTo.trim()) return
    addTerminology(newFrom.trim(), newTo.trim())
    setNewFrom(''); setNewTo('')
  }
  function submitPhrase(e) {
    e.preventDefault()
    if (!newPhrase.trim()) return
    addBannedPhrase(newPhrase.trim().toLowerCase())
    setNewPhrase('')
  }

  return (
    <section>
      <SectionTitle>
        <span className="inline-flex items-center gap-2"><Languages size={15} className="text-[#00A593]" /> Tone &amp; terminology</span>
      </SectionTitle>
      <Card className="px-5 py-4 space-y-5">
        {/* Terminology pairs */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">Terminology pairs</div>
          <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
            {behaviors.terminology.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 border-b border-[#F3F4F6]">
                <span className="text-[12.5px] font-semibold text-[#111827] w-[180px] truncate">{t.from}</span>
                <span className="text-[#9CA3AF] text-[12px]">→</span>
                <span className="text-[12.5px] text-[#374151] flex-1 truncate">{t.to}</span>
                {(t.origin === 'proposal') && <OriginBadge>from proposal</OriginBadge>}
                {t.fromPack && <OriginBadge>from {PACKS_CATALOG.find((p) => p.id === t.fromPack)?.name} pack</OriginBadge>}
                <button onClick={() => removeTerminology(t.id)} className="text-[#C0C4CC] hover:text-[#B91C1C] transition-colors" aria-label="Remove pair">
                  <X size={13} />
                </button>
              </div>
            ))}
            <form onSubmit={submitTerm} className="flex items-center gap-2 px-3 py-2 bg-[#FAFAFA]">
              <input
                value={newFrom} onChange={(e) => setNewFrom(e.target.value)} placeholder="What employees say…"
                className="w-[180px] text-[12.5px] px-2 py-1.5 bg-white border border-[#E5E7EB] rounded-md outline-none focus:border-[#00A593]"
              />
              <span className="text-[#9CA3AF] text-[12px]">→</span>
              <input
                value={newTo} onChange={(e) => setNewTo(e.target.value)} placeholder="…what it means here"
                className="flex-1 text-[12.5px] px-2 py-1.5 bg-white border border-[#E5E7EB] rounded-md outline-none focus:border-[#00A593]"
              />
              <button type="submit" className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#00A593] hover:text-[#008C7D] px-1.5">
                <Plus size={12} /> Add
              </button>
            </form>
          </div>
        </div>

        {/* Tone preset */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] w-[120px]">Tone preset</div>
          <div className="relative">
            <select
              value={behaviors.tonePreset}
              onChange={(e) => setTonePreset(e.target.value)}
              className="appearance-none bg-white border border-[#E5E7EB] rounded-lg pl-3 pr-8 py-2 text-[12.5px] font-semibold text-[#111827] cursor-pointer outline-none focus:border-[#00A593]"
            >
              {TONE_PRESETS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
          </div>
        </div>

        {/* Banned phrases */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">Banned phrases</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {behaviors.bannedPhrases.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 bg-[#FEF2F2] text-[#991B1B] text-[11.5px] font-semibold px-2.5 py-1 rounded-full">
                {p}
                <button onClick={() => removeBannedPhrase(p)} className="hover:text-[#7F1D1D]" aria-label={`Remove ${p}`}><X size={11} /></button>
              </span>
            ))}
            <form onSubmit={submitPhrase} className="inline-flex">
              <input
                value={newPhrase} onChange={(e) => setNewPhrase(e.target.value)} placeholder="+ add phrase"
                className="w-[110px] text-[11.5px] px-2.5 py-1 bg-white border border-dashed border-[#D1D5DB] rounded-full outline-none focus:border-[#00A593]"
              />
            </form>
          </div>
        </div>

        {/* Advanced escape hatch */}
        <div className="border-t border-[#F3F4F6] pt-3">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
          >
            {advancedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Advanced: raw instructions
          </button>
          {advancedOpen && (
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2.5">
                <AlertTriangle size={13} className="text-[#D97706] mt-0.5 shrink-0" />
                <p className="text-[11.5px] text-[#92400E] leading-relaxed">
                  Free-prose instructions bypass the structured policies above and can silently break answer quality
                  across every domain. Use the structured controls unless you have a reason this page can't express.
                </p>
              </div>
              <textarea
                value={behaviors.rawInstructions}
                onChange={(e) => setRawInstructions(e.target.value)}
                rows={4}
                placeholder="Power-admin escape hatch — leave empty unless you must."
                className="w-full text-[12.5px] leading-relaxed font-mono text-[#374151] bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg px-3 py-2.5 outline-none focus:border-[#00A593] resize-y"
              />
            </div>
          )}
        </div>
      </Card>
    </section>
  )
}

// ── (c) Escalation routes ────────────────────────────────────────────────────

const ROUTE_TYPES = [
  { id: 'channel', label: 'Channel' },
  { id: 'queue',   label: 'Ticket queue' },
  { id: 'team',    label: 'Named team' },
]

function EscalationRoutes({ store, behaviors }) {
  const { setEscalationRoute } = store
  return (
    <section>
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <Route size={15} className="text-[#00A593]" /> Escalation routes
          <InfoTip text="Escalation is a first-class outcome, not a failure. When Navigator can't answer reliably, the question goes here — and the handover shows up in the question log." />
        </span>
      </SectionTitle>
      <Card>
        {DOMAINS.map((d, i) => {
          const route = behaviors.escalationRoutes[d.id] || { type: 'channel', target: '' }
          return (
            <div key={d.id} className={`px-5 py-3 flex flex-wrap items-center gap-3 ${i < DOMAINS.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}>
              <span className="text-[13px] font-semibold text-[#111827] w-[190px]">{d.name}</span>
              <div className="relative">
                <select
                  value={route.type}
                  onChange={(e) => setEscalationRoute(d.id, { ...route, type: e.target.value })}
                  className="appearance-none bg-white border border-[#E5E7EB] rounded-lg pl-2.5 pr-7 py-1.5 text-[11.5px] font-semibold text-[#6B7280] cursor-pointer outline-none focus:border-[#00A593]"
                >
                  {ROUTE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              </div>
              <input
                value={route.target}
                onChange={(e) => setEscalationRoute(d.id, { ...route, target: e.target.value })}
                placeholder="No route set — Setup health flags this"
                className={`flex-1 min-w-[160px] text-[12.5px] font-medium text-[#374151] px-2.5 py-1.5 bg-white border rounded-lg outline-none focus:border-[#00A593] ${route.target?.trim() ? 'border-[#E5E7EB]' : 'border-[#FCA5A5]'}`}
              />
            </div>
          )
        })}
      </Card>
    </section>
  )
}

// ── (d) Capability bundles — internal ────────────────────────────────────────

function Bundles({ behaviors }) {
  return (
    <section>
      <SectionTitle
        count={behaviors.bundles.length}
        right={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] bg-[#F3F4F6] px-2.5 py-1 rounded-full">
            <EyeOff size={11} /> Internal — employees never see these
          </span>
        }
      >
        <span className="inline-flex items-center gap-2"><Layers size={15} className="text-[#00A593]" /> Capability bundles</span>
      </SectionTitle>
      <p className="text-[12px] text-[#6B7280] leading-relaxed mb-3 max-w-[640px]">
        Policy containers the orchestrator composes at query time. Audiences are <strong>derived from profile
        fields</strong> — there is no group picker, and routing never depends on an employee choosing one.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {behaviors.bundles.map((bundle) => (
          <Card key={bundle.id} className="px-4 py-3.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13.5px] font-bold text-[#111827]">{bundle.name}</span>
              {bundle.origin === 'proposal' && <OriginBadge>from proposal</OriginBadge>}
              {bundle.fromPack && <OriginBadge>from {PACKS_CATALOG.find((p) => p.id === bundle.fromPack)?.name} pack</OriginBadge>}
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] w-[64px] mt-0.5 shrink-0">Audience</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {bundle.audience.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#374151] bg-[#F3F4F6] px-2 py-0.5 rounded-md">
                      {a.field}: {a.value}
                    </span>
                  ))}
                  <DerivedBadge />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] w-[64px] mt-0.5 shrink-0">Sources</span>
                <span className="text-[11.5px] text-[#6B7280] leading-relaxed">{bundle.sources.join(' · ')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] w-[64px] mt-0.5 shrink-0">Policy</span>
                <span className="text-[11.5px] text-[#6B7280]">
                  {POLICY_OPTIONS.find((p) => p.id === bundle.policy)?.label || bundle.policy} · {bundle.tone}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

// ── (e) Processes — described, not built ─────────────────────────────────────

function Processes({ store, behaviors }) {
  const { addProcess, setProcessStatus, removeProcess } = store
  const [description, setDescription] = useState('')
  const [fileAttached, setFileAttached] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(null)

  function handleGenerate(e) {
    e.preventDefault()
    if (!description.trim() && !fileAttached) return
    setGenerating(true)
    setGenerated(null)
    // Canned generation, with a realistic beat — see generateProcessDraft.
    setTimeout(() => {
      setGenerated(generateProcessDraft(description || 'travel claim'))
      setGenerating(false)
    }, 1200)
  }

  function approveGenerated() {
    addProcess({ ...generated, status: 'draft' })
    setGenerated(null)
    setDescription('')
    setFileAttached(false)
  }

  return (
    <section>
      <SectionTitle count={behaviors.processes.length}>
        <span className="inline-flex items-center gap-2">
          <Workflow size={15} className="text-[#00A593]" /> Processes
          <InfoTip text="Deterministic, auditable flows — reserved for sequences that must guarantee an approval order or audit trail. If a gated capability can do it, it's not a process. Matching is by classifier-resolved purpose, not trigger phrases." />
        </span>
      </SectionTitle>

      {/* Describe a process — the authoring surface. No visual builder. */}
      <Card className="px-5 py-4 mb-4">
        <div className="text-[13px] font-bold text-[#111827] mb-1">Describe a process</div>
        <p className="text-[12px] text-[#6B7280] mb-3">
          In words, or attach the existing form / policy PDF. Navigator drafts the steps; you approve, test-drive in chat, activate.
        </p>
        <form onSubmit={handleGenerate} className="space-y-2.5">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. “Employees submit travel claims with receipts. Their manager has to approve before Finance pays out. People should get a confirmation with the payout date.”"
            className="w-full text-[12.5px] leading-relaxed text-[#374151] bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg px-3 py-2.5 outline-none focus:border-[#00A593] resize-y"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFileAttached(!fileAttached)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed text-[12px] font-semibold transition-colors ${
                fileAttached ? 'border-[#00A593] text-[#00A593] bg-[#E6FBF8]' : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#00A593] hover:text-[#00A593]'
              }`}
            >
              <Paperclip size={12} />
              {fileAttached ? 'travel-policy.pdf attached' : 'Attach form or policy PDF'}
              {fileAttached && <X size={11} className="ml-1" />}
            </button>
            <div className="flex-1" />
            <PrimaryButton disabled={generating || (!description.trim() && !fileAttached)}>
              {generating ? <><Loader2 size={13} className="animate-spin" /> Drafting steps…</> : <><Sparkles size={13} /> Draft the process</>}
            </PrimaryButton>
          </div>
        </form>

        {generated && (
          <div className="mt-4 border border-[#99E8DE] bg-[#F7FEFC] rounded-xl px-4 py-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-[#00A593]" />
              <span className="text-[13px] font-bold text-[#111827]">Drafted: {generated.name}</span>
              <span className="text-[10.5px] font-bold text-[#6B7280] bg-white border border-[#E5E7EB] px-2 py-0.5 rounded-full">awaiting your approval</span>
            </div>
            <StepList steps={generated.steps} />
            <div className="text-[11.5px] text-[#6B7280] mt-2.5 italic">Why is this a process? {generated.justification}</div>
            <div className="flex items-center gap-2 mt-3">
              <PrimaryButton onClick={approveGenerated}><Check size={13} /> Approve as draft</PrimaryButton>
              <GhostButton onClick={() => setGenerated(null)}><X size={12} /> Discard</GhostButton>
            </div>
          </div>
        )}
      </Card>

      {/* Existing processes */}
      <div className="space-y-3">
        {behaviors.processes.map((proc) => (
          <Card key={proc.id} className="px-5 py-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13.5px] font-bold text-[#111827]">{proc.name}</span>
              <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                proc.status === 'active' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#F3F4F6] text-[#6B7280]'
              }`}>
                {proc.status}
              </span>
              {proc.origin === 'proposal' && <OriginBadge>from proposal</OriginBadge>}
              {proc.origin === 'described' && <OriginBadge>described by you</OriginBadge>}
              {proc.fromPack && <OriginBadge>from {PACKS_CATALOG.find((p) => p.id === proc.fromPack)?.name} pack</OriginBadge>}
              <div className="flex-1" />
              {proc.status === 'draft' ? (
                <GhostButton onClick={() => setProcessStatus(proc.id, 'active')}>
                  <PlayCircle size={12} /> Activate
                </GhostButton>
              ) : (
                <GhostButton onClick={() => setProcessStatus(proc.id, 'draft')}>
                  <PauseCircle size={12} /> Back to draft
                </GhostButton>
              )}
              {proc.origin !== 'seed' && (
                <button onClick={() => removeProcess(proc.id)} className="text-[#C0C4CC] hover:text-[#B91C1C] transition-colors p-1" aria-label="Delete process">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <div className="mt-3"><StepList steps={proc.steps} /></div>
            <div className="text-[11.5px] text-[#6B7280] mt-2.5 italic">Why is this a process? {proc.justification}</div>
          </Card>
        ))}
      </div>
    </section>
  )
}

function StepList({ steps }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full bg-white border border-[#E5E7EB] text-[10px] font-bold text-[#6B7280] flex items-center justify-center shrink-0">{i + 1}</span>
          <StepTypeChip type={s.type} />
          <span className="text-[12.5px] text-[#374151]">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}
