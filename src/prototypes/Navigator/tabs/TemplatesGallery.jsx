import React, { useEffect, useState } from 'react'
import {
  ArrowLeft, Plus, Check, Loader2, Sparkles, ExternalLink,
  HeartHandshake, Wrench, GraduationCap, BookOpen, Plane,
  Users, Heart, ShieldCheck, Megaphone, Star, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import AudiencePicker from '../components/AudiencePicker'
import ConflictWarnings, { hasHardConflict } from '../components/ConflictWarnings'
import { useActiveTenant } from '../../AIAssistant/useActiveTenant'

// Lucide icon name → component, scoped to what the template catalog uses.
const TEMPLATE_ICONS = {
  HeartHandshake, Wrench, GraduationCap, BookOpen, Plane,
  Users, Heart, ShieldCheck, Megaphone,
}
const resolveTemplateIcon = (name) => TEMPLATE_ICONS[name] || Sparkles

/**
 * Templates Gallery — pick a curated Assistant template; we auto-match
 * Pages from the cached workspace blueprint and run conflict detection
 * against existing Assistants.
 */
export default function TemplatesGallery({ tenant, existingAssistants = [], onBack, onAdd }) {
  const { branchId } = useActiveTenant()
  const branchQ = branchId ? `&branch=${encodeURIComponent(branchId)}` : ''
  const [templates, setTemplates] = useState([])
  const [suggestedFlags, setSuggestedFlags] = useState({})
  const [loadErr, setLoadErr] = useState(null)
  const [openTemplateId, setOpenTemplateId] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch(`/api/navigator-assistant?action=templates${branchQ}`)
        const body = await r.json()
        if (!r.ok) throw new Error(body.error || 'Failed to load templates')
        setTemplates(body.templates || [])
        setSuggestedFlags(body.suggestedFlags || {})
      } catch (err) {
        setLoadErr(err.message)
      }
    })()
  }, [])

  const openTemplate = templates.find((t) => t.id === openTemplateId) || null

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#6B7280] hover:text-[#111827] mb-4 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Assistants
      </button>

      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#111827]">Assistant Templates</h1>
        <p className="text-[13px] text-[#6B7280] mt-1">
          Curated starting points. Pick one and we'll auto-match the most relevant pages from your workspace, prepend your Main Navigator instructions, and flag any overlap with existing Assistants.
        </p>
      </div>

      {loadErr && (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg px-3 py-2 mb-4 text-[12.5px] text-[#991B1B]">
          {loadErr}
        </div>
      )}

      {templates.length === 0 && !loadErr && (
        <div className="flex items-center gap-2 text-[13px] text-[#6B7280] py-12 justify-center">
          <Loader2 size={14} className="animate-spin" />
          Loading templates…
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => {
          const Icon = resolveTemplateIcon(t.lucideIcon)
          const suggested = !!suggestedFlags[t.id]
          return (
            <button
              key={t.id}
              onClick={() => setOpenTemplateId(t.id)}
              className="bg-white border border-[#E5E7EB] rounded-2xl p-5 text-left hover:border-[#7C3AED] hover:shadow-md transition-all relative"
            >
              {suggested && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F5F3FF] text-[#5B21B6] border border-[#DDD6FE]">
                  <Star size={9} className="fill-[#7C3AED] text-[#7C3AED]" />
                  Suggested
                </span>
              )}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: '#F5F3FF' }}>
                  <Icon size={18} className="text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold text-[#111827] leading-tight">{t.name}</div>
                  <div className="text-[12.5px] text-[#52525B] mt-2 leading-relaxed">{t.shortDescription}</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {openTemplate && (
        <TemplatePreviewDrawer
          template={openTemplate}
          tenant={tenant}
          onClose={() => setOpenTemplateId(null)}
          onAdd={onAdd}
        />
      )}
    </div>
  )
}

// ── Preview Drawer ────────────────────────────────────────────────────────

function TemplatePreviewDrawer({ template, tenant, onClose, onAdd }) {
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(null)
  const [conflicts, setConflicts] = useState([])
  const [audience, setAudience] = useState({ everyone: true, roles: [], locations: [] })
  const [promptOpen, setPromptOpen] = useState(false)
  const [err, setErr] = useState(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const r = await fetch(`/api/navigator-assistant?action=create-from-template${branchQ}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: template.id }),
        })
        const body = await r.json()
        if (!r.ok) throw new Error(body.error || 'Failed to create draft')
        setDraft(body.draft)
        setConflicts(body.conflicts || [])
        if (body.draft?.audience) setAudience(body.draft.audience)
      } catch (e) {
        setErr(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [template.id])

  const hardBlocked = hasHardConflict(conflicts)

  const handleAdd = async () => {
    if (!draft || hardBlocked || adding) return
    setAdding(true)
    try {
      const finalDraft = { ...draft, audience }
      // Persist server-side
      const r = await fetch(`/api/navigator-assistant?action=save${branchQ}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistant: finalDraft, source: `template:${template.id}`, templateId: template.id }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Failed to save')
      onAdd?.(body.assistant || finalDraft)
    } catch (e) {
      setErr(e.message)
      setAdding(false)
    }
  }

  const Icon = resolveTemplateIcon(template.lucideIcon)
  const matchedPages = draft?._matchedPages || []

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-[640px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-[#E5E7EB] px-6 py-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: '#F5F3FF' }}>
              <Icon size={18} className="text-[#7C3AED]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-bold text-[#111827]">{template.name}</div>
              <div className="text-[12.5px] text-[#52525B] mt-0.5">{template.shortDescription}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#71717A] hover:text-[#18181B]">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-[#6B7280] py-12 justify-center">
              <Loader2 size={14} className="animate-spin" />
              Composing draft…
            </div>
          ) : err ? (
            <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg px-3 py-2 text-[12.5px] text-[#991B1B]">{err}</div>
          ) : draft && (
            <>
              {/* How this fits your workspace */}
              <div className="bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#5B21B6] mb-1">How this fits your workspace</div>
                <p className="text-[13px] text-[#3F3F46] leading-relaxed">
                  {matchedPages.length > 0
                    ? `Linked to ${matchedPages.length} matched page${matchedPages.length === 1 ? '' : 's'} in your workspace.`
                    : 'No specific pages matched — this Assistant will rely on the workspace-wide instructions.'}
                  {tenant?.tone?.length > 0 && ` Tone will mirror your workspace: ${tenant.tone.join(', ')}.`}
                  {tenant?.languages?.length > 1 && ` Languages: ${tenant.languages.join(', ')}.`}
                </p>
              </div>

              {/* Auto-matched pages */}
              {matchedPages.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] mb-2">Auto-matched pages</div>
                  <ul className="space-y-2">
                    {matchedPages.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg px-3 py-2">
                        <div className="w-7 h-7 rounded-md bg-[#F0F9FF] grid place-items-center shrink-0">
                          <BookOpen size={13} className="text-[#0284C7]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-[#18181B] truncate">{p.title || '(untitled page)'}</div>
                          {p.description && <div className="text-[11.5px] text-[#71717A] line-clamp-1">{p.description}</div>}
                        </div>
                        <span className="text-[10.5px] text-[#52525B] bg-white border border-[#E4E4E7] rounded-md px-1.5 py-0.5 shrink-0 font-mono">
                          {(p.score * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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

              {/* System prompt preview */}
              <div>
                <button
                  onClick={() => setPromptOpen((v) => !v)}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#71717A] hover:text-[#18181B] transition-colors"
                >
                  System prompt preview
                  {promptOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                {promptOpen && (
                  <pre className="mt-2 font-mono text-[11px] bg-[#F5F5F7] border border-[#E4E4E7] rounded-lg p-3 text-[#27272A] whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                    {draft.instructions}
                  </pre>
                )}
              </div>

              {/* Conflicts */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] mb-2">Conflict check</div>
                <ConflictWarnings conflicts={conflicts} showEmpty />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E5E7EB] px-6 py-3.5 flex items-center justify-between gap-3 bg-white">
          <button onClick={onClose} className="text-[12.5px] font-semibold text-[#6B7280] hover:text-[#18181B]">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={!draft || hardBlocked || adding}
            title={hardBlocked ? 'Resolve the high-severity conflict before adding.' : ''}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            style={{ background: '#7C3AED' }}
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add to Navigator
          </button>
        </div>
      </div>
    </div>
  )
}
