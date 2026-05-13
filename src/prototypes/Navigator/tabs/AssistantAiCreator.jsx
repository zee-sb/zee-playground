import React, { useState } from 'react'
import {
  ArrowLeft, Sparkles, Loader2, Check, BookOpen, Save, RotateCcw, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import AudiencePicker from '../components/AudiencePicker'
import ConflictWarnings, { hasHardConflict } from '../components/ConflictWarnings'

/**
 * AssistantAiCreator — natural-language Assistant creation.
 *
 * Three-step flow:
 *   1. Customer types a description + picks an audience.
 *   2. Streamed NDJSON progress (name → pages → prompt → conflicts).
 *   3. Customer reviews the draft, can edit, then saves.
 */
export default function AssistantAiCreator({ tenant, existingAssistants = [], onBack, onSave }) {
  const [step, setStep] = useState(1) // 1 describe, 2 drafting/result
  const [description, setDescription] = useState('')
  const [audience, setAudience] = useState({ everyone: true, roles: [], locations: [] })

  // Step 2 state
  const [progress, setProgress] = useState([]) // [{step, totalSteps, label, done?}]
  const [draft, setDraft] = useState(null)
  const [conflicts, setConflicts] = useState([])
  const [drafting, setDrafting] = useState(false)
  const [streamErr, setStreamErr] = useState(null)

  // Editable result fields (synced from draft after stream finishes)
  const [editedName, setEditedName] = useState('')
  const [editedIcon, setEditedIcon] = useState('✨')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedInstructions, setEditedInstructions] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const startDraft = async () => {
    if (!description.trim()) return
    setStep(2)
    setDrafting(true)
    setProgress([])
    setDraft(null)
    setConflicts([])
    setStreamErr(null)

    try {
      const r = await fetch('/api/navigator-assistant?action=create-from-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, audience }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error || `Failed (${r.status})`)
      }
      // Read NDJSON stream
      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const evt = JSON.parse(line)
            handleEvent(evt)
          } catch { /* ignore malformed */ }
        }
      }
      if (buf.trim()) {
        try { handleEvent(JSON.parse(buf)) } catch { /* ignore */ }
      }
    } catch (err) {
      setStreamErr(err.message)
    } finally {
      setDrafting(false)
    }
  }

  const handleEvent = (evt) => {
    if (evt.type === 'error') {
      setStreamErr(evt.message)
      return
    }
    if (evt.type === 'done') {
      setDraft(evt.draft)
      setConflicts(evt.conflicts || [])
      // Mark all progress rows as done
      setProgress((prev) => prev.map((p) => ({ ...p, done: true })))
      // Pre-populate editable fields
      setEditedName(evt.draft.name || '')
      setEditedIcon(evt.draft.icon || '✨')
      setEditedDescription(evt.draft.description || '')
      setEditedInstructions(evt.draft.instructions || '')
      return
    }
    if (typeof evt.step === 'number') {
      setProgress((prev) => {
        // Mark previous steps as done; add the current one as pending.
        const next = prev.map((p) => p.step < evt.step ? { ...p, done: true } : p)
        const idx = next.findIndex((p) => p.step === evt.step)
        if (idx === -1) next.push({ ...evt, done: false })
        else next[idx] = { ...evt, done: false }
        return next
      })
    }
  }

  const reset = () => {
    setStep(1)
    setProgress([])
    setDraft(null)
    setConflicts([])
    setStreamErr(null)
    setDrafting(false)
  }

  const handleSave = async () => {
    if (!draft || saving) return
    setSaving(true)
    try {
      const final = {
        ...draft,
        name: editedName.trim() || draft.name,
        icon: editedIcon || draft.icon,
        description: editedDescription,
        instructions: editedInstructions,
        audience,
      }
      const r = await fetch('/api/navigator-assistant?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistant: final, source: 'custom_ai' }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Save failed')
      onSave?.(body.assistant || final)
    } catch (e) {
      setStreamErr(e.message)
      setSaving(false)
    }
  }

  const hardBlocked = hasHardConflict(conflicts)

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#6B7280] hover:text-[#111827] mb-4 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Assistants
      </button>

      <div className="mb-6 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: '#F5F3FF' }}>
          <Sparkles size={18} className="text-[#7C3AED]" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Create with AI</h1>
          <p className="text-[13px] text-[#6B7280] mt-1 max-w-2xl">
            Describe what this Assistant should help with. We'll draft the name, system prompt, and audience —
            and auto-match the most relevant pages from your workspace.
          </p>
        </div>
      </div>

      {step === 1 && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 max-w-3xl">
          <div className="mb-5">
            <label className="block text-[12.5px] font-semibold text-[#18181B] mb-2">
              What should this Assistant help with?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Help my team navigate the Q3 OKR rollout and how individual goals ladder up to company OKRs. Should be able to answer questions about how to write OKRs, when check-ins happen, and where to find the templates."
              className="w-full p-3 text-[13.5px] bg-white border border-[#E4E4E7] rounded-lg focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] outline-none leading-relaxed"
            />
            <div className="text-[11.5px] text-[#71717A] mt-1">
              Be specific. Mention the topics, edge cases, and where the answers should come from if you know.
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-[12.5px] font-semibold text-[#18181B] mb-2">
              Who is it for?
            </label>
            <AudiencePicker
              value={audience}
              onChange={setAudience}
              roles={tenant?.roles || []}
              locations={tenant?.locations || []}
            />
          </div>

          <button
            onClick={startDraft}
            disabled={!description.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[13.5px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            style={{ background: '#7C3AED' }}
          >
            <Sparkles size={14} />
            Draft Assistant
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-3xl space-y-5">
          {/* Progress card */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] mb-3">
              {drafting ? 'Drafting…' : draft ? 'Draft ready' : streamErr ? 'Error' : 'Drafting…'}
            </div>
            <ol className="space-y-2.5">
              {[1, 2, 3, 4].map((n) => {
                const evt = progress.find((p) => p.step === n)
                const isCurrent = evt && !evt.done && drafting
                const isDone = evt && evt.done
                const label = evt?.label || (
                  n === 1 ? 'Generating name & icon' :
                  n === 2 ? 'Finding relevant pages' :
                  n === 3 ? 'Writing system prompt' :
                  'Checking for conflicts'
                )
                return (
                  <li key={n} className="flex items-center gap-2.5">
                    {isDone
                      ? <Check size={14} className="text-[#16A34A] shrink-0" />
                      : isCurrent
                        ? <Loader2 size={14} className="animate-spin text-[#7C3AED] shrink-0" />
                        : <span className="w-3.5 h-3.5 rounded-full border-2 border-[#E4E4E7] shrink-0" />
                    }
                    <span className={`text-[13px] ${isDone ? 'text-[#18181B] font-semibold' : isCurrent ? 'text-[#18181B] font-medium' : 'text-[#A1A1AA]'}`}>
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
            {streamErr && (
              <div className="mt-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg px-3 py-2 text-[12.5px] text-[#991B1B]">
                {streamErr}
              </div>
            )}
            {(!drafting && (draft || streamErr)) && (
              <button
                onClick={reset}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E4E7] hover:border-[#7C3AED] hover:text-[#7C3AED] text-[12.5px] font-semibold text-[#52525B] transition-colors"
              >
                <RotateCcw size={12} />
                Start over
              </button>
            )}
          </div>

          {/* Result panel */}
          {draft && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5">
              {/* Name + icon + description */}
              <div className="flex items-start gap-3">
                <input
                  type="text"
                  value={editedIcon}
                  onChange={(e) => setEditedIcon(e.target.value.slice(0, 4))}
                  className="w-14 h-14 text-center text-[28px] bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] outline-none shrink-0"
                  title="Emoji icon"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Assistant name"
                    className="w-full px-3 py-2 text-[15px] font-bold bg-white border border-[#E4E4E7] rounded-lg focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] outline-none"
                  />
                  <input
                    type="text"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="Short employee-facing description"
                    className="w-full px-3 py-1.5 text-[13px] text-[#52525B] bg-white border border-[#E4E4E7] rounded-lg focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] outline-none"
                  />
                </div>
              </div>

              {/* Suggested pages */}
              {draft._matchedPages?.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] mb-2">Suggested pages</div>
                  <ul className="space-y-2">
                    {draft._matchedPages.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg px-3 py-2">
                        <div className="w-7 h-7 rounded-md bg-[#F0F9FF] grid place-items-center shrink-0">
                          <BookOpen size={13} className="text-[#0284C7]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-[#18181B] truncate">{p.title || '(untitled page)'}</div>
                        </div>
                        <span className="text-[10.5px] text-[#52525B] bg-white border border-[#E4E4E7] rounded-md px-1.5 py-0.5 shrink-0 font-mono">
                          {(p.score * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* System prompt — editable, collapsible */}
              <div>
                <button
                  onClick={() => setPromptOpen((v) => !v)}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#71717A] hover:text-[#18181B] transition-colors mb-2"
                >
                  System prompt
                  {promptOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                {promptOpen ? (
                  <textarea
                    value={editedInstructions}
                    onChange={(e) => setEditedInstructions(e.target.value)}
                    rows={16}
                    className="w-full p-3 font-mono text-[11.5px] leading-relaxed bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] outline-none text-[#27272A]"
                  />
                ) : (
                  <pre className="font-mono text-[11.5px] bg-[#F5F5F7] border border-[#E4E4E7] rounded-lg p-3 text-[#3F3F46] line-clamp-4 leading-relaxed">
                    {editedInstructions}
                  </pre>
                )}
              </div>

              {/* Audience */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] mb-2">Audience</div>
                <AudiencePicker
                  value={audience}
                  onChange={setAudience}
                  roles={tenant?.roles || []}
                  locations={tenant?.locations || []}
                />
              </div>

              {/* Conflicts */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] mb-2">Conflict check</div>
                <ConflictWarnings conflicts={conflicts} showEmpty />
              </div>

              {/* Save */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  onClick={reset}
                  className="text-[12.5px] font-semibold text-[#6B7280] hover:text-[#18181B]"
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={hardBlocked || saving || !editedName.trim()}
                  title={hardBlocked ? 'Resolve the high-severity conflict before saving.' : ''}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[13.5px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                  style={{ background: '#7C3AED' }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Assistant
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
