import React, { useEffect, useState } from 'react'
import { X, Sparkles, Save, Loader2, ArrowLeftRight } from 'lucide-react'

// Modal editor for the workspace orchestrator system prompt (mainInstructions).
// Two ways to commit:
//   • Save as-is        → writes raw text back through saveMainInstructions
//   • Optimize & Save   → runs an LLM polish pass, shows a diff for review,
//                         saves the polished version on accept.
export default function SystemPromptEditor({
  initialText = '',
  onClose,
  onSave,
  onOptimize,
}) {
  const [draft, setDraft] = useState(initialText)
  const [busy, setBusy] = useState(null)         // 'save' | 'optimize' | null
  const [error, setError] = useState(null)
  const [diff, setDiff] = useState(null)         // { original, optimized } | null
  const dirty = draft.trim() !== initialText.trim()

  useEffect(() => {
    setDraft(initialText)
  }, [initialText])

  async function handleSaveRaw() {
    if (busy) return
    setError(null)
    setBusy('save')
    try {
      await onSave(draft)
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleOptimize() {
    if (busy) return
    setError(null)
    setBusy('optimize')
    try {
      const result = await onOptimize(draft)
      if (!result?.optimized) throw new Error('Optimization returned no result')
      setDiff(result)
    } catch (err) {
      setError(err?.message || 'Optimization failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleAcceptOptimized() {
    if (!diff?.optimized || busy) return
    setError(null)
    setBusy('save')
    try {
      await onSave(diff.optimized)
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setBusy(null)
    }
  }

  if (diff) {
    return (
      <ModalShell title="Review optimized prompt" onClose={onClose}>
        <p className="text-[12.5px] text-[#6B7280] mb-4">
          The AI restructured your draft into the standard Navigator sections. Review and apply, or go back to edit further.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4 min-h-0 flex-1 overflow-hidden">
          <DiffPane label="Your draft" body={diff.original} />
          <DiffPane label="Optimized" body={diff.optimized} highlight />
        </div>
        {error && <ErrorBanner message={error} />}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => setDiff(null)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[12.5px] font-semibold text-[#374151] hover:border-[#7C3AED] hover:text-[#7C3AED] disabled:opacity-50"
          >
            <ArrowLeftRight size={13} />
            Back to edit
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-3 py-2 rounded-lg text-[12.5px] font-semibold text-[#6B7280] hover:text-[#111827] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAcceptOptimized}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12.5px] font-semibold disabled:opacity-50"
            >
              {busy === 'save' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Apply optimized
            </button>
          </div>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell title="Orchestrator system prompt" onClose={onClose}>
      <p className="text-[12.5px] text-[#6B7280] mb-3">
        This is the workspace-level system prompt that every Assistant inherits. It shapes Navigator's tone, glossary, and routing. Edit freely, or let the AI optimize structure before saving.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className="w-full flex-1 min-h-[360px] rounded-lg border border-[#E5E7EB] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 outline-none p-3 text-[12.5px] leading-relaxed font-mono text-[#111827] resize-none"
        placeholder={'ROLE\nYou are Navigator…'}
      />
      <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] mt-2">
        <span>{draft.length.toLocaleString()} characters · {draft.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
        {dirty && <span className="text-[#D97706] font-semibold">Unsaved changes</span>}
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="flex items-center justify-end gap-2 pt-4 mt-3 border-t border-[#E5E7EB]">
        <button
          type="button"
          onClick={onClose}
          disabled={!!busy}
          className="px-3 py-2 rounded-lg text-[12.5px] font-semibold text-[#6B7280] hover:text-[#111827] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleOptimize}
          disabled={!!busy || !draft.trim()}
          title="Run an LLM pass that enforces the standard section structure."
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] text-[#5B21B6] text-[12.5px] font-semibold hover:bg-[#EDE9FE] disabled:opacity-50"
        >
          {busy === 'optimize' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Optimize with AI
        </button>
        <button
          type="button"
          onClick={handleSaveRaw}
          disabled={!!busy || !dirty}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#111827] hover:bg-[#1F2937] text-white text-[12.5px] font-semibold disabled:opacity-50"
        >
          {busy === 'save' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save as-is
        </button>
      </div>
    </ModalShell>
  )
}

function ModalShell({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-3xl max-h-[88vh] rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-[16px] font-bold text-[#111827]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6B7280] hover:text-[#111827] p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 flex flex-col px-6 py-5 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

function DiffPane({ label, body, highlight }) {
  return (
    <div className={`flex flex-col rounded-lg border ${highlight ? 'border-[#7C3AED] bg-[#F5F3FF]' : 'border-[#E5E7EB] bg-[#FAFAFA]'}`}>
      <div className={`px-3 py-2 text-[10.5px] font-bold uppercase tracking-widest ${highlight ? 'text-[#5B21B6]' : 'text-[#94A3B8]'}`}>
        {label}
      </div>
      <pre className="flex-1 overflow-auto m-0 px-3 pb-3 text-[11.5px] leading-relaxed font-mono text-[#111827] whitespace-pre-wrap">
        {body}
      </pre>
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="mt-3 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] px-3 py-2 text-[12px]">
      {message}
    </div>
  )
}
