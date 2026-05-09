import React, { useState } from 'react'
import { Plus, BookOpen, Trash2 } from 'lucide-react'

const SOURCES = ['Confluence', 'SharePoint', 'Notion', 'Custom URL']

/**
 * Knowledge Bases — minimal list. Used by assistants to ground answers.
 * Left intentionally simple; depth lives in the Assistants flow.
 */
export default function KnowledgeBasesList({ knowledgeBases = [], assistants = [], onKnowledgeBasesChange }) {
  const [showForm, setShowForm] = useState(false)

  const usedBy = (kbId) =>
    assistants.filter(a => (a.knowledgeBaseIds || []).includes(kbId))

  function handleCreate({ name, source }) {
    const newKb = {
      id: `kb-${Date.now().toString(36)}`,
      name,
      source,
      articleCount: Math.floor(Math.random() * 200) + 20,
    }
    onKnowledgeBasesChange((prev) => [newKb, ...prev])
    setShowForm(false)
  }

  function handleRemove(kb) {
    if (!window.confirm(`Remove ${kb.name}?`)) return
    onKnowledgeBasesChange((prev) => prev.filter(x => x.id !== kb.id))
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Knowledge Bases</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Content sources assistants ground answers in.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] text-white text-[13px] font-semibold rounded-lg hover:bg-[#1F2937]"
        >
          <Plus size={15} />
          Add knowledge base
        </button>
      </div>

      {showForm && <NewKbForm onCreate={handleCreate} onClose={() => setShowForm(false)} />}

      {knowledgeBases.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl py-12 px-6 text-center">
          <BookOpen size={28} className="mx-auto text-[#94A3B8] mb-3" />
          <div className="text-[14px] font-semibold text-[#111827]">No knowledge bases yet</div>
          <div className="text-[12px] text-[#6B7280] mt-1">Connect a source to ground assistant answers.</div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          {knowledgeBases.map((kb, i) => {
            const using = usedBy(kb.id)
            return (
              <div key={kb.id} className={`flex items-center gap-4 px-5 py-3 ${i > 0 ? 'border-t border-[#F1F5F9]' : ''}`}>
                <div className="w-8 h-8 bg-[#EEF2FF] rounded-lg grid place-items-center">
                  <BookOpen size={14} className="text-[#4338CA]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#111827] truncate">{kb.name}</div>
                  <div className="text-[11px] text-[#94A3B8]">
                    {kb.source} · {kb.articleCount} articles
                    {using.length > 0 && ` · used by ${using.map(a => a.name).join(', ')}`}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(kb)}
                  className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NewKbForm({ onCreate, onClose }) {
  const [name, setName] = useState('')
  const [source, setSource] = useState(SOURCES[0])

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto_auto] gap-3 items-end">
        <label>
          <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="HR Policies"
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#3B82F6] outline-none"
          />
        </label>
        <label>
          <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Source</div>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#3B82F6] outline-none"
          >
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button
          onClick={() => name.trim() && onCreate({ name: name.trim(), source })}
          disabled={!name.trim()}
          className="px-4 py-2 bg-[#111827] text-white text-[12px] font-semibold rounded-lg hover:bg-[#1F2937] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Create
        </button>
        <button onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-[#6B7280] hover:text-[#111827]">
          Cancel
        </button>
      </div>
    </div>
  )
}
