import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, Wrench, Bot, BookOpen, Workflow, Users, Compass, ShieldCheck,
  FileText, Edit3, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react'
import { useNavigatorHealth } from '../hooks/useNavigatorHealth'
import HealthTab, { HealthSummary } from './HealthTab'
import SystemPromptEditor from './SystemPromptEditor'

// Home tab — the first thing an admin sees in Navigator Studio.
// Owns: workspace overview, the orchestrator system prompt, a health summary
// (with inline expansion to the full list), and a link to the Discovery wizard.
//
// Replaces the old `SetupTab` and folds the dedicated `Health` tab into a
// single coherent admin home.
export default function HomeTab({ tenant = {}, config = {}, blueprint, basePath, onEditSystemPrompt }) {
  const conns = config.connectors || []
  const mcps = conns.filter((c) => c.kind === 'mcp')
  const agents = conns.filter((c) => c.kind === 'agent')
  const kbs = conns.filter((c) => c.kind === 'kb')
  const stats = [
    { id: 'assistants', label: 'Assistants', value: (config.assistants || []).filter((a) => a.status === 'active').length, total: (config.assistants || []).length, icon: Sparkles },
    { id: 'mcp',        label: 'MCPs',       value: mcps.filter((c) => c.status === 'connected').length,   total: mcps.length,   icon: Wrench },
    { id: 'agent',      label: 'Agents',     value: agents.filter((c) => c.status === 'connected').length, total: agents.length, icon: Bot },
    { id: 'kb',         label: 'Knowledge',  value: kbs.filter((c) => c.status === 'connected').length,    total: kbs.length,    icon: BookOpen },
    { id: 'flows',      label: 'Flows',      value: (config.flows || []).filter((f) => f.status === 'active').length, total: (config.flows || []).length, icon: Workflow },
    { id: 'workspace',  label: 'Groups',     value: (tenant.groups || []).length, total: (tenant.groups || []).length, icon: Users },
  ]

  const ws = blueprint?.blueprint?.workspace || null
  const mainInstructions = ws?.mainInstructions || ''
  const previewLines = mainInstructions
    ? mainInstructions.split('\n').filter((l) => l.trim()).slice(0, 6)
    : []

  const { summary, loading: healthLoading } = useNavigatorHealth()
  const [healthOpen, setHealthOpen] = useState(false)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#111827]">Home</h1>
        <p className="text-[13px] text-[#6B7280] mt-1">
          Your Navigator workspace at a glance — overview, orchestrator system prompt, health, and discovery.
        </p>
      </div>

      {/* Workspace overview */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 mb-5">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Workspace overview</div>
            <div className="flex items-center gap-3 mt-2">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-[18px]"
                style={{ background: tenant.brandColor || '#00C7B2' }}
              >
                {(tenant.name || 'S').slice(0, 1)}
              </div>
              <div>
                <div className="text-[16px] font-bold text-[#111827]">{tenant.name || 'Staffbase'}</div>
                <div className="text-[11px] font-mono text-[#6B7280]">{tenant.workspace || 'campsite.staffbase.com'}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.id} className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{s.label}</div>
                  <Icon size={11} className="text-[#94A3B8]" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <div className="text-[20px] font-bold text-[#111827] leading-none">{s.value}</div>
                  {s.total !== s.value && (
                    <div className="text-[11px] text-[#94A3B8] font-mono">/{s.total}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Orchestrator system prompt */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#7C3AED]" />
            <div>
              <div className="text-[13px] font-bold text-[#111827]">Orchestrator system prompt</div>
              <div className="text-[11.5px] text-[#6B7280] mt-0.5">
                The workspace-level prompt every Assistant inherits. Generated from discovery; edit any time.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onEditSystemPrompt}
            disabled={!ws}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#7C3AED] hover:text-[#7C3AED] text-[12px] font-semibold text-[#374151] shrink-0 disabled:opacity-50"
            title={ws ? 'Edit the workspace system prompt' : 'Run Discovery first to generate the system prompt'}
          >
            <Edit3 size={12} />
            Edit
          </button>
        </div>
        {mainInstructions ? (
          <div className="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] p-3">
            <pre className="m-0 text-[11.5px] leading-relaxed font-mono text-[#374151] whitespace-pre-wrap line-clamp-6 max-h-[140px] overflow-hidden">
              {previewLines.join('\n')}
            </pre>
            <div className="text-[10.5px] text-[#9CA3AF] mt-2">
              {mainInstructions.split(/\s+/).filter(Boolean).length} words · click Edit to view the full prompt
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] p-3 text-[12px] text-[#92400E] flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-[#D97706]" />
            <span>
              No system prompt yet. Run Discovery to generate one grounded in your Staffbase workspace.
            </span>
          </div>
        )}
      </div>

      {/* Health */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#7C3AED]" />
            <div>
              <div className="text-[13px] font-bold text-[#111827]">Navigator health</div>
              <div className="text-[11.5px] text-[#6B7280] mt-0.5">
                Cross-entity validation — broken references, scope overlaps, orphaned resources.
              </div>
            </div>
          </div>
        </div>
        <HealthSummary
          summary={summary}
          loading={healthLoading}
          onAction={() => setHealthOpen((v) => !v)}
          actionLabel={healthOpen ? 'Hide issue list' : 'View all issues'}
          actionIcon={healthOpen ? ChevronUp : ChevronDown}
        />
        {healthOpen && (
          <div className="mt-5 pt-5 border-t border-[#E5E7EB]">
            <HealthTab basePath={basePath} embedded />
          </div>
        )}
      </div>

      {/* Discovery */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-5">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Compass size={16} className="text-[#00C7B2]" />
            <div className="text-[13px] font-bold text-[#111827]">Run discovery</div>
          </div>
          <p className="text-[12px] text-[#6B7280] mb-3 leading-relaxed">
            The wizard pulls real Staffbase channels, pages, and groups, then proposes Assistants grounded in that content. Run it on first install or whenever the workspace changes shape.
          </p>
          <Link
            to="/prototypes/navigator-discovery"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#00C7B2] hover:bg-[#00A899] px-3 py-2 rounded-lg"
          >
            <Compass size={13} />
            Open Discovery
          </Link>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <div className="text-[12px] font-bold text-[#111827] mb-3">What discovery does</div>
          <ul className="space-y-2 text-[12px] text-[#374151]">
            <li className="flex gap-2"><span className="text-[#00C7B2] font-bold">1.</span> Pulls channels, recent posts, pages, groups, and user directory from the Staffbase API.</li>
            <li className="flex gap-2"><span className="text-[#00C7B2] font-bold">2.</span> Runs a multi-pass LLM analysis to extract company name, mission, tone, glossary, and a workspace-level system prompt.</li>
            <li className="flex gap-2"><span className="text-[#00C7B2] font-bold">3.</span> Clusters content into topic areas and proposes 5–9 grounded Assistants (HR, IT, Onboarding, Travel, Campsite + workspace-specific clusters).</li>
            <li className="flex gap-2"><span className="text-[#00C7B2] font-bold">4.</span> Persists the workspace blueprint to Postgres so subsequent loads are instant.</li>
            <li className="flex gap-2"><span className="text-[#00C7B2] font-bold">5.</span> You pick which proposed Assistants to apply, then they're created in <strong>navigator_assistants</strong> and visible in the Assistants tab.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export { SystemPromptEditor }
