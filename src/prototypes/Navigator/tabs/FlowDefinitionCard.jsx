import React from 'react'
import {
  Workflow, ListChecks, Wrench, Sparkles, ShieldAlert, Users, Globe, MapPin,
  CheckCircle2, AlertCircle, Building2,
} from 'lucide-react'

/**
 * Replaces the old green-on-black terminal panel with a structured summary.
 * Same information density, but it reads like a checklist a non-developer
 * would build rather than a config dump.
 */
export default function FlowDefinitionCard({ workflow, connections = [] }) {
  const stepCount = workflow.steps?.length || 0
  const toolCount = workflow.tools?.length || 0
  const aud = workflow.audience || { everyone: true }
  const wc = workflow.worksCouncil || { required: false, status: 'not_required' }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
      <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#111827] mb-3">
        <Workflow size={14} className="text-[#7C3AED]" />
        Definition at a glance
      </h3>

      <Row label="Trigger" icon={<Workflow size={11} />}>
        {workflow.trigger
          ? <span className="text-[12px] text-[#111827]">{workflow.trigger}</span>
          : <Empty>Not set — add one in <i>Trigger &amp; goal</i> above.</Empty>}
      </Row>

      <Row label="Goal">
        {workflow.goal
          ? <span className="text-[12px] text-[#111827]">{workflow.goal}</span>
          : <Empty>What does completion look like?</Empty>}
      </Row>

      <Row label="Mode">
        <span className="text-[12px] text-[#111827] capitalize">{workflow.mode || 'suggested'}</span>
      </Row>

      <Row label="Audience" icon={<Users size={11} />}>
        {aud.everyone ? (
          <span className="text-[12px] text-[#111827] inline-flex items-center gap-1">
            <Globe size={11} className="text-[#7C3AED]" /> Everyone
          </span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {(aud.roles || []).map((r) => (
              <span key={r} className="px-1.5 py-0.5 text-[10.5px] font-semibold rounded bg-[#F5F3FF] text-[#5B21B6] border border-[#DDD6FE]">{r}</span>
            ))}
            {(aud.locations || []).map((l) => (
              <span key={l} className="px-1.5 py-0.5 text-[10.5px] font-semibold rounded bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] inline-flex items-center gap-0.5">
                <MapPin size={9} /> {l}
              </span>
            ))}
            {!(aud.roles?.length) && !(aud.locations?.length) && (
              <Empty>No roles or locations selected — nobody will match.</Empty>
            )}
          </div>
        )}
      </Row>

      <Row label="Owner team" icon={<Building2 size={11} />}>
        {workflow.ownerTeam
          ? <span className="text-[12px] text-[#111827]">{workflow.ownerTeam}</span>
          : <Empty>(none — set it in Identity)</Empty>}
      </Row>

      <Row label="Steps" icon={<ListChecks size={11} />}>
        <span className="text-[12px] text-[#111827]">
          {stepCount} {stepCount === 1 ? 'step' : 'steps'}
        </span>
      </Row>

      <Row label="Tools" icon={<Wrench size={11} />}>
        {toolCount === 0 ? <Empty>(none authorized)</Empty> : (
          <div className="flex flex-wrap gap-1">
            {(workflow.tools || []).map((t, i) => {
              const c = connections.find((x) => x.id === t.connectionId)
              return (
                <span key={i} className="px-1.5 py-0.5 text-[10.5px] font-semibold rounded bg-[#F3F4F6] text-[#374151]">
                  {(c?.name || t.connectionId)}<span className="text-[#94A3B8]">.</span>{t.toolId}
                </span>
              )
            })}
          </div>
        )}
      </Row>

      {workflow.instructions && (
        <Row label="AI guidance" icon={<Sparkles size={11} />}>
          <span className="text-[12px] text-[#111827] italic">{workflow.instructions}</span>
        </Row>
      )}

      {workflow.onComplete && (
        <Row label="On completion">
          <span className="text-[12px] text-[#111827]">{workflow.onComplete}</span>
        </Row>
      )}

      <Row label="Compliance" icon={<ShieldAlert size={11} />}>
        {wc.required ? (
          wc.status === 'approved'
            ? <span className="text-[12px] text-[#065F46] inline-flex items-center gap-1"><CheckCircle2 size={11} /> Works-council approved</span>
            : <span className="text-[12px] text-[#7F1D1D] inline-flex items-center gap-1"><AlertCircle size={11} /> Awaiting works-council approval — Publish blocked</span>
        ) : <span className="text-[12px] text-[#475569]">No special review required.</span>}
      </Row>

      {workflow.publishedVersion > 0 && (
        <Row label="Live version">
          <span className="text-[12px] text-[#065F46] font-mono">v{workflow.publishedVersion}</span>
        </Row>
      )}
    </div>
  )
}

function Row({ label, icon, children }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 py-2 border-t border-[#F1F5F9] first:border-t-0">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Empty({ children }) {
  return <span className="text-[12px] text-[#94A3B8] italic">{children}</span>
}
