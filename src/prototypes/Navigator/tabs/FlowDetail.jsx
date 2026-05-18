import React, { useState, useMemo } from 'react'
import { ArrowLeft, Save, Trash2, Wrench, Bot, BookOpen, Workflow, Check, Sparkles, ListChecks, LayoutTemplate, Wand2, Loader2 } from 'lucide-react'
import { LogoChip } from '../components/Catalog'
import FlowStepBuilder from './FlowStepBuilder.jsx'
import FlowPreviewPane from './FlowPreviewPane.jsx'
import { FLOW_TEMPLATES, instantiateTemplate } from '../../../../lib/flows/templates.mjs'
import { useActiveTenant } from '../../AIAssistant/useActiveTenant'

/**
 * Workflow detail editor.
 *
 * Tool picker walks the unified connections list. For toolkits we show every
 * tool; for handoffs we show one `invoke` row; for search sources we show one
 * `search` row. Selected tools always shape as `{connectionId, toolId}`.
 */
export default function FlowDetail({
  workflow,
  isNew = false,
  connections = [],
  onBack,
  onSave,
  onDelete,
}) {
  const { branchId } = useActiveTenant()
  const [name, setName] = useState(workflow.name || '')
  const [status, setStatus] = useState(workflow.status || 'active')
  const [mode, setMode] = useState(workflow.mode || 'suggested')
  const [trigger, setTrigger] = useState(workflow.trigger || '')
  const [goal, setGoal] = useState(workflow.goal || '')
  const [instructions, setInstructions] = useState(workflow.instructions || '')
  const [onComplete, setOnComplete] = useState(workflow.onComplete || '')
  // Normalize legacy bare ids / connectorId payloads to {connectionId, toolId: 'invoke'}.
  const [tools, setTools] = useState(() =>
    (workflow.tools || []).map((t) => {
      if (typeof t === 'string') return { connectionId: t, toolId: 'invoke' }
      return {
        connectionId: t.connectionId || t.connectorId || '',
        toolId: t.toolId || '',
      }
    })
  )
  const [steps, setSteps] = useState(() => Array.isArray(workflow.steps) ? workflow.steps : [])
  const [showTemplates, setShowTemplates] = useState(false)
  const [scaffoldOpen, setScaffoldOpen] = useState(false)
  const [scaffoldDesc, setScaffoldDesc] = useState('')
  const [scaffoldBusy, setScaffoldBusy] = useState(false)
  const [scaffoldError, setScaffoldError] = useState(null)
  const [scaffoldWarnings, setScaffoldWarnings] = useState([])

  const connected = useMemo(() => connections.filter((c) => c.status === 'connected'), [connections])

  function isToolSelected(connectionId, toolId) {
    return tools.some((t) => t.connectionId === connectionId && t.toolId === toolId)
  }
  function toggleTool(connectionId, toolId) {
    setTools((prev) => {
      const hit = prev.findIndex((t) => t.connectionId === connectionId && t.toolId === toolId)
      if (hit !== -1) return prev.filter((_, i) => i !== hit)
      return [...prev, { connectionId, toolId }]
    })
  }

  function handleSave() {
    onSave({
      ...workflow,
      name: name.trim() || 'Untitled workflow',
      status,
      mode,
      trigger: trigger.trim(),
      goal: goal.trim(),
      instructions: instructions.trim(),
      onComplete: onComplete.trim() || null,
      tools,
      steps,
    })
  }

  function applyTemplate(tpl) {
    const inst = instantiateTemplate(tpl)
    setName(inst.name || name)
    setTrigger(inst.trigger || '')
    setGoal(inst.goal || '')
    setMode(inst.mode || 'suggested')
    setSteps(inst.steps || [])
    // Auto-populate the tool scope from the template's tool refs.
    if (Array.isArray(inst.tools)) setTools(inst.tools.map((t) => ({ ...t })))
    setShowTemplates(false)
  }

  async function runScaffold() {
    if (!scaffoldDesc.trim()) return
    setScaffoldBusy(true)
    setScaffoldError(null)
    try {
      const res = await fetch(`/api/navigator-assistant?action=scaffold-flow${branchId ? `&branch=${encodeURIComponent(branchId)}` : ''}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: scaffoldDesc,
          connections: connections.map((c) => ({
            id: c.id, name: c.name, kind: c.kind, status: c.status,
            tools: (c.tools || []).map((t) => ({ id: t.id, name: t.name, description: t.description })),
          })),
        }),
      })
      const body = await res.json()
      // The endpoint returns `workflow` after the rename; fall back to legacy `flow`.
      const draft = body?.workflow || body?.flow
      if (!res.ok || !draft) throw new Error(body?.error || `scaffold failed (${res.status})`)
      setName(draft.name || name || 'Drafted workflow')
      setTrigger(draft.trigger || '')
      setGoal(draft.goal || '')
      setMode(draft.mode || 'suggested')
      setSteps(Array.isArray(draft.steps) ? draft.steps : [])
      setScaffoldWarnings(body.unknownTools || [])
      setScaffoldOpen(false)
      setScaffoldDesc('')
    } catch (err) {
      setScaffoldError(err.message)
    } finally {
      setScaffoldBusy(false)
    }
  }

  const toolSummary = useMemo(() => formatToolSummary(tools, connections), [tools, connections])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 hover:bg-[#F3F4F6] rounded text-[#6B7280]">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-widest text-[#94A3B8]">
            {isNew ? 'New Workflow' : 'Workflow'}
          </div>
          <h1 className="text-[20px] font-bold text-[#111827] truncate">{name || 'Untitled workflow'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={() => {
                if (window.confirm(`Delete ${name || 'this workflow'}?`)) onDelete(workflow)
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#7C3AED] text-white text-[12px] font-semibold rounded-lg hover:bg-[#6D28D9]"
          >
            <Save size={13} />
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        {/* Left column — form */}
        <div className="space-y-6">
          {/* Identity */}
          <Section title="Identity">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Laptop Request"
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <div className="flex gap-2">
                  {['active', 'draft'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors capitalize ${
                        status === s
                          ? 'bg-[#111827] text-white'
                          : 'bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Mode">
                <div className="flex gap-2">
                  {[
                    { id: 'suggested', label: 'Suggested' },
                    { id: 'required', label: 'Required' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                        mode === m.id
                          ? m.id === 'required'
                            ? 'bg-[#F59E0B] text-white'
                            : 'bg-[#2563EB] text-white'
                          : 'bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <p className="text-[11px] text-[#6B7280] -mt-1">
              {mode === 'required'
                ? 'Required: once started, the employee should complete this flow before changing topic.'
                : 'Suggested: Navigator can offer this flow but free chat is still allowed.'}
            </p>
          </Section>

          {/* Trigger + Goal */}
          <Section title="Trigger & goal" icon={<Workflow size={14} className="text-[#7C3AED]" />}>
            <Field label="When should Navigator start this workflow?">
              <textarea
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                rows={2}
                placeholder="Employee asks for a new laptop or mentions their computer is broken."
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none resize-y leading-relaxed"
              />
            </Field>
            <Field label="What does completion look like?">
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                placeholder="IT ticket submitted with laptop model, OS preference, and delivery address."
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none resize-y leading-relaxed"
              />
            </Field>
          </Section>

          {/* Steps */}
          <Section
            title="Steps"
            icon={<ListChecks size={14} className="text-[#0EA5E9]" />}
            description="Compose what Navigator does when this workflow fires — collect inputs, call tools, ask the user to confirm."
          >
            {steps.length === 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setShowTemplates(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg text-[12px] font-semibold text-[#111827]"
                >
                  <LayoutTemplate size={13} className="text-[#0EA5E9]" />
                  Start from a template
                </button>
                <button
                  onClick={() => setScaffoldOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-[#00C7B2] to-[#0EA5E9] hover:opacity-95 text-white rounded-lg text-[12px] font-semibold"
                >
                  <Wand2 size={13} />
                  Draft with AI
                </button>
              </div>
            )}
            <FlowStepBuilder steps={steps} onChange={setSteps} connections={connections} />
            {scaffoldWarnings.length > 0 && (
              <div className="mt-3 px-3 py-2 bg-[#FEF3C7] border border-[#FCD34D] rounded-lg text-[11px] text-[#92400E]">
                Some scaffolded tools aren't in this workspace:&nbsp;
                {scaffoldWarnings.map((w, i) => (
                  <span key={i} className="font-mono">
                    {i > 0 && ', '}{w.connectionId || w.connectorId}.{w.toolId}
                  </span>
                ))}
                . Pick connected ones in those steps before activating.
              </div>
            )}
          </Section>

          {/* Tools picker */}
          <Section
            title="Tools available in this workflow"
            icon={<Wrench size={14} className="text-[#7C3AED]" />}
            description="Pre-authorize connections for AI fallback. Tools used in step configs are auto-allowed."
          >
            {connected.length === 0 ? (
              <div className="text-[12px] text-[#94A3B8] italic px-3 py-3 bg-[#F9FAFB] rounded-lg">
                No connections connected yet — go to Connections to add some.
              </div>
            ) : (
              <div className="space-y-3">
                {connected.map((c) => {
                  // Tool rows depend on kind. For handoffs, one synthetic invoke;
                  // for search sources, one synthetic search; for toolkits, the
                  // declared list.
                  const rows = c.kind === 'toolkit'
                    ? (c.tools || [])
                    : [{ id: c.kind === 'handoff' ? 'invoke' : 'search', name: c.kind === 'handoff' ? 'invoke' : 'search', description: c.kind === 'handoff' ? 'Hand off the conversation to this agent.' : 'Search the corpus.' }]
                  const headerColor = c.kind === 'handoff' ? '#F59E0B' : c.kind === 'search' ? '#2563EB' : '#7C3AED'
                  const HeaderIcon = c.kind === 'handoff' ? Bot : c.kind === 'search' ? BookOpen : Wrench
                  return (
                    <div key={c.id} className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <HeaderIcon size={13} style={{ color: headerColor }} />
                        <LogoChip name={c.name} color={headerColor} size={22} />
                        <span className="text-[12px] font-semibold text-[#111827]">{c.name}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ml-auto" style={{ color: headerColor, background: `${headerColor}1a` }}>
                          {c.kind === 'handoff' ? 'Handoff' : c.kind === 'search' ? 'Search' : 'Toolkit'}
                        </span>
                      </div>
                      <div className="divide-y divide-[#F1F5F9]">
                        {rows.map((t) => {
                          const sel = isToolSelected(c.id, t.id)
                          return (
                            <button key={t.id} onClick={() => toggleTool(c.id, t.id)}
                              className={`w-full text-left flex items-center gap-3 px-3 py-2 transition-colors ${
                                sel ? 'bg-[#F5F3FF]' : 'bg-white hover:bg-[#F9FAFB]'
                              }`}>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                sel ? 'bg-[#7C3AED] border-[#7C3AED]' : 'border-[#CBD5E1]'
                              }`}>
                                {sel && <Check size={11} className="text-white" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[12px] font-semibold text-[#111827] font-mono">{t.name}</div>
                                <div className="text-[11px] text-[#6B7280] truncate">{t.description}</div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Instructions & completion */}
          <Section title="Guidance" icon={<Sparkles size={14} className="text-[#7C3AED]" />}>
            <Field label="Additional guidance for the AI (optional)">
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                placeholder="Ask for the employee's role first to suggest the right laptop tier."
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none resize-y leading-relaxed"
              />
            </Field>
            <Field label="On completion (optional)">
              <input
                value={onComplete}
                onChange={(e) => setOnComplete(e.target.value)}
                placeholder="Notify IT manager"
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
              />
            </Field>
          </Section>
        </div>

        {/* Right column — live preview */}
        <div className="space-y-6">
          <FlowPreviewPane workflow={{
            id: workflow.id || 'preview',
            name, mode, goal, steps,
          }} />
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#111827] mb-3">
              <Workflow size={14} className="text-[#7C3AED]" />
              Workflow definition
            </h3>
            <pre className="p-4 bg-[#111827] text-[#86EFAC] rounded-lg text-[11px] leading-relaxed overflow-x-auto font-mono whitespace-pre-wrap break-words">
{formatDefinition({ trigger, goal, tools: toolSummary, mode, instructions, onComplete, stepCount: steps.length })}
            </pre>
          </div>
        </div>
      </div>

      {showTemplates && (
        <TemplatesModal
          templates={FLOW_TEMPLATES}
          onApply={applyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
      {scaffoldOpen && (
        <ScaffoldModal
          value={scaffoldDesc}
          onChange={setScaffoldDesc}
          onRun={runScaffold}
          onClose={() => { if (!scaffoldBusy) setScaffoldOpen(false) }}
          busy={scaffoldBusy}
          error={scaffoldError}
        />
      )}
    </div>
  )
}

function TemplatesModal({ templates, onApply, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
            <LayoutTemplate size={16} className="text-[#0EA5E9]" />
            Start from a template
          </h3>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#475569] text-[20px] leading-none">×</button>
        </div>
        <p className="text-[12px] text-[#6B7280] mb-3">Forking a template populates this flow's steps and tools. You can edit before saving.</p>
        <div className="space-y-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => onApply(t.template)}
              className="w-full text-left p-3 bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg flex items-start gap-3"
            >
              <div className="text-[20px] leading-none">{t.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#111827]">{t.template.name}</div>
                <div className="text-[11px] text-[#6B7280] mt-0.5">{t.summary}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScaffoldModal({ value, onChange, onRun, onClose, busy, error }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
            <Wand2 size={16} className="text-[#00C7B2]" />
            Draft a workflow with AI
          </h3>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#475569] text-[20px] leading-none">×</button>
        </div>
        <p className="text-[12px] text-[#6B7280] mb-2">Describe what you want this workflow to do. Navigator will draft steps using the connections in this workspace.</p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="When someone wants to file an expense, ask for the amount and category, then submit it."
          className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#00C7B2] outline-none"
          disabled={busy}
        />
        {error && <div className="mt-2 text-[11px] text-[#B91C1C]">{error}</div>}
        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-3 py-1.5 text-[12px] font-semibold text-[#475569] hover:bg-[#F3F4F6] rounded-lg disabled:opacity-50">Cancel</button>
          <button
            onClick={onRun}
            disabled={busy || !value.trim()}
            className="px-4 py-1.5 text-[12px] font-semibold bg-[#00C7B2] hover:bg-[#00736A] text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {busy ? 'Drafting…' : 'Draft workflow'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDefinition({ trigger, goal, tools, mode, instructions, onComplete, stepCount }) {
  const rows = [
    ['trigger', trigger || '(none)'],
    ['goal', goal || '(none)'],
    ['steps', stepCount ? `${stepCount} step${stepCount === 1 ? '' : 's'}` : '(none)'],
    ['tools', tools || '(none)'],
    ['mode', mode],
  ]
  if (instructions) rows.push(['instructions', instructions])
  if (onComplete) rows.push(['onComplete', onComplete])
  const labelWidth = 12
  return rows
    .map(([k, v]) => `${(k + ':').padEnd(labelWidth, ' ')} ${v}`)
    .join('\n')
}

function formatToolSummary(tools, connections) {
  if (!tools || tools.length === 0) return ''
  return tools
    .map((t) => {
      const c = connections.find((x) => x.id === t.connectionId)
      const label = c?.name || t.connectionId
      return `${label}.${t.toolId}`
    })
    .join(', ')
}

function Section({ title, icon, description, children }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
      <div className="mb-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#111827]">
          {icon}
          {title}
        </h3>
        {description && <p className="text-[11px] text-[#6B7280] mt-0.5">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
