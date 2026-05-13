import React, { useState, useMemo } from 'react'
import { ArrowLeft, Save, Trash2, Wrench, Bot, BookOpen, Workflow, Check, Sparkles } from 'lucide-react'
import { LogoChip } from '../components/Catalog'

/**
 * Flow detail editor (v7 unified).
 *
 * Tool picker walks the unified connectors list. For MCPs we show every
 * tool; for agents we show one `invoke` row; for KBs we show one `search`
 * row. Selected tools always shape as `{connectorId, toolId}`.
 */
export default function FlowDetail({
  flow,
  isNew = false,
  connectors = [],
  onBack,
  onSave,
  onDelete,
}) {
  const [name, setName] = useState(flow.name || '')
  const [status, setStatus] = useState(flow.status || 'active')
  const [mode, setMode] = useState(flow.mode || 'suggested')
  const [trigger, setTrigger] = useState(flow.trigger || '')
  const [goal, setGoal] = useState(flow.goal || '')
  const [instructions, setInstructions] = useState(flow.instructions || '')
  const [onComplete, setOnComplete] = useState(flow.onComplete || '')
  // Normalize legacy bare agent ids to {connectorId, toolId: 'invoke'} on load.
  const [tools, setTools] = useState(() =>
    (flow.tools || []).map((t) =>
      typeof t === 'string' ? { connectorId: t, toolId: 'invoke' } : { ...t }
    )
  )

  const connected = useMemo(() => connectors.filter((c) => c.status === 'connected'), [connectors])

  function isToolSelected(connectorId, toolId) {
    return tools.some((t) => t.connectorId === connectorId && t.toolId === toolId)
  }
  function toggleTool(connectorId, toolId) {
    setTools((prev) => {
      const hit = prev.findIndex((t) => t.connectorId === connectorId && t.toolId === toolId)
      if (hit !== -1) return prev.filter((_, i) => i !== hit)
      return [...prev, { connectorId, toolId }]
    })
  }

  function handleSave() {
    onSave({
      ...flow,
      name: name.trim() || 'Untitled flow',
      status,
      mode,
      trigger: trigger.trim(),
      goal: goal.trim(),
      instructions: instructions.trim(),
      onComplete: onComplete.trim() || null,
      tools,
    })
  }

  const toolSummary = useMemo(() => formatToolSummary(tools, connectors), [tools, connectors])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 hover:bg-[#F3F4F6] rounded text-[#6B7280]">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-widest text-[#94A3B8]">
            {isNew ? 'New Flow' : 'Flow'}
          </div>
          <h1 className="text-[20px] font-bold text-[#111827] truncate">{name || 'Untitled flow'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={() => {
                if (window.confirm(`Delete ${name || 'this flow'}?`)) onDelete(flow)
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
            <Field label="When should Navigator start this flow?">
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

          {/* Tools picker */}
          <Section
            title="Tools available in this flow"
            icon={<Wrench size={14} className="text-[#7C3AED]" />}
            description="Select from your connected connectors. The Navigator brain can only use what you give it."
          >
            {connected.length === 0 ? (
              <div className="text-[12px] text-[#94A3B8] italic px-3 py-3 bg-[#F9FAFB] rounded-lg">
                No connectors connected yet — go to Connectors to add some.
              </div>
            ) : (
              <div className="space-y-3">
                {connected.map((c) => {
                  // Tool rows depend on kind. For agents, one synthetic invoke;
                  // for KBs, one synthetic search; for MCPs, the declared list.
                  const rows = c.kind === 'mcp'
                    ? (c.tools || [])
                    : [{ id: c.kind === 'agent' ? 'invoke' : 'search', name: c.kind === 'agent' ? 'invoke' : 'search', description: c.kind === 'agent' ? 'Hand off the conversation to this agent.' : 'Search the corpus.' }]
                  const headerColor = c.kind === 'agent' ? '#F59E0B' : c.kind === 'kb' ? '#2563EB' : '#7C3AED'
                  const HeaderIcon = c.kind === 'agent' ? Bot : c.kind === 'kb' ? BookOpen : Wrench
                  return (
                    <div key={c.id} className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <HeaderIcon size={13} style={{ color: headerColor }} />
                        <LogoChip name={c.name} color={headerColor} size={22} />
                        <span className="text-[12px] font-semibold text-[#111827]">{c.name}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ml-auto" style={{ color: headerColor, background: `${headerColor}1a` }}>
                          {c.kind === 'agent' ? 'Agent' : c.kind === 'kb' ? 'Knowledge' : 'MCP'}
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
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#111827] mb-3">
              <Workflow size={14} className="text-[#7C3AED]" />
              Flow definition
            </h3>
            <pre className="p-4 bg-[#111827] text-[#86EFAC] rounded-lg text-[11px] leading-relaxed overflow-x-auto font-mono whitespace-pre-wrap break-words">
{formatDefinition({ trigger, goal, tools: toolSummary, mode, instructions, onComplete })}
            </pre>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#111827] mb-3">
              <Sparkles size={14} className="text-[#7C3AED]" />
              Trace simulation
            </h3>
            <p className="text-[11px] text-[#6B7280] mb-3">
              What the employee will see when this flow fires.
            </p>
            <div className="space-y-2">
              <TraceBubble name={name} mode={mode} goal={goal} />
              <TraceConfirm goal={goal} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDefinition({ trigger, goal, tools, mode, instructions, onComplete }) {
  const rows = [
    ['trigger', trigger || '(none)'],
    ['goal', goal || '(none)'],
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

function formatToolSummary(tools, connectors) {
  if (!tools || tools.length === 0) return ''
  return tools
    .map((t) => {
      const c = connectors.find((x) => x.id === t.connectorId)
      const label = c?.name || t.connectorId
      return `${label}.${t.toolId}`
    })
    .join(', ')
}

function TraceBubble({ name, mode, goal }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-full bg-[#7C3AED] text-white text-[10px] font-bold flex items-center justify-center shrink-0">N</div>
      <div className="flex-1 min-w-0 bg-[#F5F3FF] border border-[#DDD6FE] rounded-2xl rounded-tl-sm px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#7C3AED] bg-white px-1.5 py-0.5 rounded">Flow</span>
          <span className="text-[12px] font-bold text-[#111827] truncate">{name || 'Untitled flow'}</span>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ml-auto shrink-0"
            style={
              mode === 'required'
                ? { background: '#F59E0B', color: '#FFFFFF' }
                : { background: '#FFFFFF', color: '#2563EB', border: '1px solid #BFDBFE' }
            }
          >
            {mode === 'required' ? 'Required' : 'Suggested'}
          </span>
        </div>
        <p className="text-[11px] text-[#6B7280] italic leading-snug">{goal || 'Goal not set yet'}</p>
        <p className="text-[12px] text-[#111827] mt-2 leading-snug">
          I can help with that — let me start a {`{flow}`}.
        </p>
      </div>
    </div>
  )
}

function TraceConfirm({ goal }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-full bg-[#7C3AED] text-white text-[10px] font-bold flex items-center justify-center shrink-0">N</div>
      <div className="flex-1 min-w-0 bg-white border border-[#E5E7EB] rounded-2xl rounded-tl-sm px-3 py-2">
        <div className="text-[11px] font-semibold text-[#374151] mb-1.5">Ready to proceed</div>
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2.5 py-2 text-[11px] text-[#475569] mb-2">
          {goal || 'Goal: not set'}
        </div>
        <button className="w-full px-3 py-1.5 bg-[#7C3AED] text-white text-[11px] font-semibold rounded-lg">
          Continue
        </button>
      </div>
    </div>
  )
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
