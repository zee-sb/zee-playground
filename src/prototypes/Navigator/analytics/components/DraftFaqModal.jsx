import React, { useState } from 'react'
import { X, FileText, Check } from 'lucide-react'

// Prototype modal: prefills the FAQ from the insight/conversation context
// and shows a success state when "saved". We don't actually persist FAQs
// anywhere in this prototype (no FAQ table yet) — the modal exists to
// demonstrate the closed-loop UX in the analytics view.
export default function DraftFaqModal({ open, onClose, topic = 'General', questionSeed = '' }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [saved, setSaved] = useState(false)

  React.useEffect(() => {
    if (open) {
      setQuestion(questionSeed ? capitalize(questionSeed) + '?' : '')
      setAnswer('')
      setSaved(false)
    }
  }, [open, questionSeed])

  if (!open) return null

  function handleSave() {
    setSaved(true)
    setTimeout(() => onClose?.(), 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#7C3AED]" />
            <div className="text-[14px] font-bold text-[#111827]">Draft an FAQ</div>
            <span className="inline-flex items-center text-[10.5px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
              {topic}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-[#6B7280] hover:text-[#111827]">
            <X size={16} />
          </button>
        </div>
        {saved ? (
          <div className="px-5 py-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#ECFDF5] text-[#16A34A] mb-3">
              <Check size={22} />
            </div>
            <div className="text-[14px] font-semibold text-[#111827]">FAQ drafted</div>
            <div className="text-[12px] text-[#6B7280] mt-1">It will appear in the {topic} knowledge base.</div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280] mb-1">Question</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What employees keep asking…"
                className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280] mb-1">Canonical answer</label>
              <textarea
                rows={5}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write the short, authoritative answer the assistant should reuse…"
                className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
              />
            </div>
            <div className="text-[11px] text-[#6B7280]">
              Saved FAQs are matched first — the assistant skips the LLM for these and returns the canonical answer.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[12.5px] font-semibold text-[#374151] border border-[#E5E7EB] rounded-md hover:bg-[#F9FAFB]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!question.trim() || !answer.trim()}
                className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-[#111827] rounded-md hover:bg-[#1F2937] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save FAQ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function capitalize(s) {
  return String(s || '').replace(/^./, (c) => c.toUpperCase())
}
