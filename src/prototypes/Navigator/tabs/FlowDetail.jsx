import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  ArrowLeft, Save, Trash2, Wrench, Bot, BookOpen, Workflow, Check, Sparkles,
  ListChecks, LayoutTemplate, Wand2, Loader2, History, Eye, Users, ShieldAlert,
  CircleCheck, Settings2, GitBranch, Send, Info, Megaphone, UserCog, Code2,
} from 'lucide-react'
import { LogoChip } from '../components/Catalog'
import AudiencePicker from '../components/AudiencePicker'
import FlowStepBuilder from './FlowStepBuilder.jsx'
import FlowPreviewPane from './FlowPreviewPane.jsx'
import FlowDefinitionCard from './FlowDefinitionCard.jsx'
import FlowEmbedPreview from './FlowEmbedPreview.jsx'
import ManagerLauncherCard from './ManagerLauncherCard.jsx'
import { FLOW_TEMPLATES, instantiateTemplate } from '../../../../lib/flows/templates.mjs'
import { useActiveTenant } from '../../AIAssistant/useActiveTenant'

/**
 * Workflow detail editor — v9.
 *
 * The previous incarnation was a single Save button + a terminal-style
 * definition panel. This rewrite separates Draft from Published, adds audience
 * targeting and a works-council gate, exposes an Advanced toggle for power
 * users, and lets the admin click Test-as-employee to open the flow in the
 * Companion chat with a pre-filled trigger.
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
  const [ownerTeam, setOwnerTeam] = useState(workflow.ownerTeam || '')
  const [audience, setAudience] = useState(workflow.audience || { everyone: true, roles: [], locations: [] })
  const [worksCouncil, setWorksCouncil] = useState(workflow.worksCouncil || { required: false, status: 'not_required', approvedBy: null, approvedAt: null, note: '' })
  const [versions, setVersions] = useState(Array.isArray(workflow.versions) ? workflow.versions : [])
  const [publishedVersion, setPublishedVersion] = useState(Number(workflow.publishedVersion) || 0)
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
  const [advanced, setAdvanced] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showEmbedPreview, setShowEmbedPreview] = useState(false)
  const [showManagerLauncher, setShowManagerLauncher] = useState(false)
  // Auto-save UI state — toggles between idle / dirty / saving / saved. The
  // actual debounced save calls into the parent via onSave (same path the
  // explicit save button uses), so the change is round-tripped to the server.
  const [autoSaveState, setAutoSaveState] = useState('idle')

  const connected = useMemo(() => connections.filter((c) => c.status === 'connected'), [connections])

  // Roles + locations the audience picker can offer. In this prototype the
  // tenant config has neither yet, so we ship a sensible Staffbase-flavored
  // default that admins would actually recognize from a real customer.
  const audienceOptions = useMemo(() => {
    return {
      roles: ['Frontline', 'Office', 'Manager', 'HR', 'IT', 'Field service', 'Executive'],
      locations: ['Global', 'AMER', 'EMEA', 'APAC', 'DACH'],
    }
  }, [])

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

  // Build the full workflow payload from local state. Used by both the
  // explicit save buttons and the auto-save effect.
  const buildPayload = (overrides = {}) => ({
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
    audience,
    worksCouncil,
    ownerTeam: ownerTeam.trim(),
    versions,
    publishedVersion,
    ...overrides,
  })

  function handleSaveDraft() {
    setAutoSaveState('saving')
    onSave(buildPayload({ status: 'draft', hasDraft: true }))
    setAutoSaveState('saved')
  }

  function handlePublish() {
    // Block publish when works-council approval is required but not granted.
    if (worksCouncil.required && worksCouncil.status !== 'approved') {
      window.alert('Works-council approval is required before this workflow can be published.\n\nMark it approved (or remove the requirement) in the Compliance section first.')
      return
    }
    const nextVersion = (versions[0]?.version || 0) + 1
    const newEntry = {
      version: nextVersion,
      publishedAt: new Date().toISOString(),
      publishedBy: 'you (demo)',
      note: `Published v${nextVersion}`,
      // We store a slim snapshot — the full step body lives in the live row.
      snapshot: { name, trigger, goal, mode, steps, audience },
    }
    const nextVersions = [newEntry, ...versions]
    setVersions(nextVersions)
    setPublishedVersion(nextVersion)
    setAutoSaveState('saving')
    onSave(buildPayload({
      status: 'active',
      hasDraft: false,
      versions: nextVersions,
      publishedVersion: nextVersion,
    }))
    setAutoSaveState('saved')
  }

  function handleRollback(targetVersion) {
    const target = versions.find((v) => v.version === targetVersion)
    if (!target?.snapshot) return
    if (!window.confirm(`Roll back to v${targetVersion}? Your current draft will be replaced with the v${targetVersion} snapshot.`)) return
    setName(target.snapshot.name || name)
    setTrigger(target.snapshot.trigger || '')
    setGoal(target.snapshot.goal || '')
    setMode(target.snapshot.mode || 'suggested')
    setSteps(target.snapshot.steps || [])
    if (target.snapshot.audience) setAudience(target.snapshot.audience)
    setShowVersionHistory(false)
  }

  // Auto-save: 1.2s after the last edit, push a draft. Skip the very first
  // render (it would noisily save the workflow we just loaded).
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    setAutoSaveState('dirty')
    const t = setTimeout(() => {
      try {
        setAutoSaveState('saving')
        onSave(buildPayload({ hasDraft: status !== 'active' || true }))
        setAutoSaveState('saved')
      } catch {
        setAutoSaveState('idle')
      }
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, status, mode, trigger, goal, instructions, onComplete, ownerTeam, JSON.stringify(steps), JSON.stringify(tools), JSON.stringify(audience), JSON.stringify(worksCouncil)])

  function applyTemplate(tpl) {
    const inst = instantiateTemplate(tpl)
    setName(inst.name || name)
    setTrigger(inst.trigger || '')
    setGoal(inst.goal || '')
    setMode(inst.mode || 'suggested')
    setSteps(inst.steps || [])
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

  function handleTestAsEmployee() {
    // Persist the draft first so the chat opens against the current state, then
    // hop to the Companion with a synthetic prompt that primes the trigger.
    handleSaveDraft()
    const triggerHint = trigger || name
    const url = `/prototypes/staffbase-companion?testFlow=${encodeURIComponent(workflow.id || 'preview')}&prompt=${encodeURIComponent(triggerHint)}`
    window.open(url, '_blank', 'noopener')
  }

  const canPublish = !worksCouncil.required || worksCouncil.status === 'approved'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 hover:bg-[#F3F4F6] rounded text-[#6B7280]">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-[#94A3B8]">
              {isNew ? 'New workflow' : 'Workflow'}
            </div>
            <AutoSaveBadge state={autoSaveState} />
            {publishedVersion > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                Live: v{publishedVersion}
              </span>
            )}
          </div>
          <h1 className="text-[20px] font-bold text-[#111827] truncate">{name || 'Untitled workflow'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdvanced((v) => !v)}
            title="Show step ids, regex patterns, deep links, and other power-user knobs."
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-colors ${
              advanced ? 'bg-[#111827] border-[#111827] text-white' : 'bg-white border-[#E5E7EB] text-[#475569] hover:border-[#7C3AED] hover:text-[#7C3AED]'
            }`}
          >
            <Code2 size={13} />
            {advanced ? 'Advanced on' : 'Advanced'}
          </button>
          <button
            onClick={() => setShowVersionHistory(true)}
            title="See and roll back to previous published versions."
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#475569] bg-white border border-[#E5E7EB] hover:border-[#7C3AED] hover:text-[#7C3AED] rounded-lg transition-colors"
          >
            <History size={13} />
            History ({versions.length})
          </button>
          <button
            onClick={handleTestAsEmployee}
            title="Open this flow in the Companion chat as if you were an employee."
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#475569] bg-white border border-[#E5E7EB] hover:border-[#0EA5E9] hover:text-[#0EA5E9] rounded-lg transition-colors"
          >
            <Eye size={13} />
            Test as employee
          </button>
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
            onClick={handleSaveDraft}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#7C3AED] text-[#7C3AED] text-[12px] font-semibold rounded-lg hover:bg-[#F5F3FF]"
          >
            <Save size={13} />
            Save draft
          </button>
          <button
            onClick={handlePublish}
            disabled={!canPublish}
            title={canPublish ? 'Publish a new version that becomes live for matching employees.' : 'Works-council approval required first.'}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#7C3AED] text-white text-[12px] font-semibold rounded-lg hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={13} />
            {publishedVersion > 0 ? `Publish v${(versions[0]?.version || 0) + 1}` : 'Publish'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        {/* Left column — form */}
        <div className="space-y-6">
          {/* Identity */}
          <Section
            title="Identity"
            help="Name the flow and decide whether Navigator should require employees to finish it once it starts, or merely suggest it."
          >
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Laptop Request"
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status" help="Active flows can fire for employees. Drafts are invisible.">
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
              <Field label="Mode" help="Required: locks the employee in once started. Suggested: free chat is still allowed.">
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

            <Field label="Owner team (optional)" help="Department that owns this workflow. Shows up in the audit log and the analytics filter.">
              <input
                value={ownerTeam}
                onChange={(e) => setOwnerTeam(e.target.value)}
                placeholder="HR Operations, IT helpdesk, Comms, …"
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
              />
            </Field>
          </Section>

          {/* Audience */}
          <Section
            title="Audience"
            icon={<Users size={14} className="text-[#7C3AED]" />}
            help="Choose who can trigger this workflow. Everyone is the default — restrict to specific roles or locations for workforce-segmented flows."
          >
            <AudiencePicker
              value={audience}
              onChange={setAudience}
              roles={audienceOptions.roles}
              locations={audienceOptions.locations}
            />
          </Section>

          {/* Trigger + Goal */}
          <Section
            title="Trigger & goal"
            icon={<Workflow size={14} className="text-[#7C3AED]" />}
            help="Describe what employees say or do that should fire this flow, and what the finished state should look like."
          >
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
            help="Compose what Navigator does when this workflow fires — collect inputs, route for approval, run actions, ask the employee to confirm."
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
            <FlowStepBuilder steps={steps} onChange={setSteps} connections={connections} advanced={advanced} />
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
            help="If you let Navigator fill in tool arguments automatically (instead of wiring them step-by-step), pre-authorize the toolkits it can reach for from here."
          >
            {connected.length === 0 ? (
              <div className="text-[12px] text-[#94A3B8] italic px-3 py-3 bg-[#F9FAFB] rounded-lg">
                No connections connected yet — go to Connections to add some.
              </div>
            ) : (
              <div className="space-y-3">
                {connected.map((c) => {
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
                                <div className={`text-[12px] font-semibold text-[#111827] ${advanced ? 'font-mono' : ''}`}>{t.name}</div>
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

          {/* Guidance */}
          <Section
            title="Guidance"
            icon={<Sparkles size={14} className="text-[#7C3AED]" />}
            help="Hints Navigator can use if it has to fill in gaps not covered by the explicit steps."
          >
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

          {/* Compliance — Works council */}
          <Section
            title="Compliance"
            icon={<ShieldAlert size={14} className="text-[#DC2626]" />}
            help="In EU markets (Germany, Austria, Netherlands…) any employee-facing automation may need works-council co-determination before it goes live."
          >
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!worksCouncil.required}
                onChange={(e) => setWorksCouncil((wc) => ({
                  ...wc,
                  required: e.target.checked,
                  status: e.target.checked ? (wc.status === 'approved' ? 'approved' : 'pending') : 'not_required',
                }))}
                className="mt-0.5"
              />
              <span className="text-[12.5px] text-[#111827]">
                <b>Works-council approval required before publish</b>
                <p className="text-[11px] text-[#6B7280] mt-0.5 leading-relaxed">
                  Blocks the Publish button until a council representative has signed off. Approval is recorded with a name, timestamp, and optional note.
                </p>
              </span>
            </label>

            {worksCouncil.required && (
              <div className="mt-3 p-3 border border-[#FCA5A5] bg-[#FEF2F2] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] font-semibold text-[#7F1D1D]">
                    Status: <ApprovalChip status={worksCouncil.status} />
                  </div>
                  {worksCouncil.status !== 'approved' ? (
                    <button
                      onClick={() => setWorksCouncil((wc) => ({
                        ...wc,
                        status: 'approved',
                        approvedBy: 'Council rep (demo)',
                        approvedAt: new Date().toISOString(),
                      }))}
                      className="px-3 py-1 text-[11px] font-semibold bg-[#DC2626] text-white rounded-lg hover:bg-[#B91C1C]"
                    >
                      Mark approved (demo)
                    </button>
                  ) : (
                    <button
                      onClick={() => setWorksCouncil((wc) => ({ ...wc, status: 'pending', approvedAt: null, approvedBy: null }))}
                      className="px-3 py-1 text-[11px] font-semibold text-[#7F1D1D] bg-white border border-[#FCA5A5] rounded-lg hover:bg-[#FEE2E2]"
                    >
                      Reset to pending
                    </button>
                  )}
                </div>
                {worksCouncil.status === 'approved' && worksCouncil.approvedBy && (
                  <div className="text-[11px] text-[#7F1D1D]">
                    Approved by <b>{worksCouncil.approvedBy}</b>
                    {worksCouncil.approvedAt && <> on {new Date(worksCouncil.approvedAt).toLocaleString()}</>}
                  </div>
                )}
                <Field label="Note (visible in audit log)">
                  <input
                    value={worksCouncil.note || ''}
                    onChange={(e) => setWorksCouncil((wc) => ({ ...wc, note: e.target.value }))}
                    placeholder="Reviewed in Q2 BR meeting; no objections."
                    className="w-full px-2 py-1 text-[11px] bg-white border border-[#FCA5A5] rounded outline-none"
                  />
                </Field>
              </div>
            )}
          </Section>

          {/* Discovery & entry points */}
          <Section
            title="Discovery"
            icon={<Megaphone size={14} className="text-[#7C3AED]" />}
            help="Beyond chat, employees and managers can reach this flow from posts, deep links, and dashboards. Preview those surfaces here."
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowEmbedPreview(true)}
                className="text-left p-3 border border-[#E5E7EB] rounded-lg hover:border-[#7C3AED] hover:bg-[#F5F3FF] transition-colors"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Megaphone size={13} className="text-[#7C3AED]" />
                  <span className="text-[12.5px] font-semibold text-[#111827]">Embed in a post</span>
                </div>
                <span className="text-[11px] text-[#6B7280]">Preview how this flow renders as a CTA inside a Staffbase news post.</span>
              </button>
              <button
                onClick={() => setShowManagerLauncher(true)}
                className="text-left p-3 border border-[#E5E7EB] rounded-lg hover:border-[#7C3AED] hover:bg-[#F5F3FF] transition-colors"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <UserCog size={13} className="text-[#7C3AED]" />
                  <span className="text-[12.5px] font-semibold text-[#111827]">Manager launcher</span>
                </div>
                <span className="text-[11px] text-[#6B7280]">Preview the "kick off on behalf of an employee" launcher card.</span>
              </button>
            </div>
          </Section>
        </div>

        {/* Right column — live preview + structured definition card */}
        <div className="space-y-6">
          <FlowPreviewPane workflow={{
            id: workflow.id || 'preview',
            name, mode, goal, steps,
          }} />
          <FlowDefinitionCard
            workflow={{
              name, status, mode, trigger, goal, audience, ownerTeam,
              instructions, onComplete, worksCouncil, publishedVersion,
              steps, tools,
            }}
            connections={connections}
          />
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
      {showVersionHistory && (
        <VersionHistoryModal
          versions={versions}
          publishedVersion={publishedVersion}
          onRollback={handleRollback}
          onClose={() => setShowVersionHistory(false)}
        />
      )}
      {showEmbedPreview && (
        <Modal title="Embed in a Staffbase post" onClose={() => setShowEmbedPreview(false)} width={560}>
          <FlowEmbedPreview workflow={{ id: workflow.id || 'preview', name, goal, mode }} />
        </Modal>
      )}
      {showManagerLauncher && (
        <Modal title="Manager launcher" onClose={() => setShowManagerLauncher(false)} width={520}>
          <ManagerLauncherCard workflow={{ id: workflow.id || 'preview', name, goal, mode, audience }} />
        </Modal>
      )}
    </div>
  )
}

function AutoSaveBadge({ state }) {
  if (state === 'idle') return null
  const map = {
    dirty:  { label: 'Unsaved…',     color: '#92400E', bg: '#FEF3C7' },
    saving: { label: 'Saving…',      color: '#1E40AF', bg: '#DBEAFE' },
    saved:  { label: 'All changes saved', color: '#065F46', bg: '#ECFDF5' },
  }
  const v = map[state] || map.dirty
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: v.color, background: v.bg }}>
      {state === 'saved' ? <span className="inline-flex items-center gap-1"><CircleCheck size={9} /> {v.label}</span> : v.label}
    </span>
  )
}

function ApprovalChip({ status }) {
  const map = {
    not_required: { label: 'Not required', color: '#475569', bg: '#F1F5F9' },
    pending:      { label: 'Awaiting approval', color: '#92400E', bg: '#FEF3C7' },
    approved:     { label: 'Approved', color: '#065F46', bg: '#D1FAE5' },
    rejected:     { label: 'Rejected', color: '#7F1D1D', bg: '#FEE2E2' },
  }
  const v = map[status] || map.pending
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: v.color, background: v.bg }}>
      {v.label}
    </span>
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

function VersionHistoryModal({ versions, publishedVersion, onRollback, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
            <History size={16} className="text-[#7C3AED]" />
            Version history
          </h3>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#475569] text-[20px] leading-none">×</button>
        </div>
        {versions.length === 0 ? (
          <p className="text-[12px] text-[#6B7280] py-6 text-center">
            No versions yet. Publish the workflow to record one.
          </p>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {versions.map((v) => {
              const isLive = v.version === publishedVersion
              return (
                <div key={v.version} className="p-3 border border-[#E5E7EB] rounded-lg flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center shrink-0">
                    <GitBranch size={16} className="text-[#7C3AED]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-[#111827]">v{v.version}</span>
                      {isLive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                          Live
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#6B7280] mt-0.5">
                      {v.publishedAt ? new Date(v.publishedAt).toLocaleString() : 'unpublished'}
                      {v.publishedBy && <> · by {v.publishedBy}</>}
                    </div>
                    {v.note && <div className="text-[11px] text-[#475569] mt-1 italic">"{v.note}"</div>}
                  </div>
                  {!isLive && v.snapshot && (
                    <button
                      onClick={() => onRollback(v.version)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#7C3AED] bg-white border border-[#7C3AED] rounded-lg hover:bg-[#F5F3FF]"
                    >
                      Roll back
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Modal({ title, onClose, width = 480, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full p-5"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-[#111827]">{title}</h3>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#475569] text-[20px] leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Section({ title, icon, description, help, children }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
      <div className="mb-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#111827]">
          {icon}
          {title}
          {help && <HelpTip>{help}</HelpTip>}
        </h3>
        {description && <p className="text-[11px] text-[#6B7280] mt-0.5">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, help, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide flex items-center gap-1">
        {label}
        {help && <HelpTip>{help}</HelpTip>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function HelpTip({ children }) {
  return (
    <span
      tabIndex={0}
      role="img"
      aria-label="Help"
      title={typeof children === 'string' ? children : ''}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[#94A3B8] hover:text-[#475569] cursor-help"
    >
      <Info size={11} />
    </span>
  )
}
