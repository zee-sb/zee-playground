import React from 'react'
import { Lock, KeyRound, AlertTriangle, User, Server, Bot } from 'lucide-react'
import { Card, SectionTitle, HealthPill, TierControl, InfoTip, LogoSquare, EngineRoomLine } from '../components'
import { TIER_OPTIONS } from '../useV2Store'

/**
 * Sources & Actions — one card per connected SYSTEM or external AGENT,
 * never per protocol. The four visible facets per source: capabilities
 * (with risk tier), identity, inherited permissions, health. External
 * agents get the exact same card — a handoff is just a Trigger-tier
 * capability. Deliberately absent: audience configuration (the inheritance
 * principle) and protocol details (engine room only).
 */
export default function SourcesTab({ store }) {
  const { config, setCapabilityTier, setIdentityMode } = store
  const sources = config.sources || []

  return (
    <div className="max-w-[860px] space-y-6 pb-12">
      <div>
        <h1 className="text-[20px] font-bold text-[#111827] mb-1">Sources &amp; Actions</h1>
        <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-[620px]">
          What Navigator can see and do — one entry per connected system. External agents live here too:
          they're just another source with capabilities and a risk tier, not a separate concept. Permissions
          are inherited from each system, never managed here.
        </p>
      </div>

      <div>
        <SectionTitle count={sources.length}>Connected sources</SectionTitle>
        <div className="space-y-4">
          {sources.map((s) => (
            <SourceCard
              key={s.id}
              source={s}
              onTierChange={(capId, tier) => setCapabilityTier(s.id, capId, tier)}
              onIdentityChange={(mode) => setIdentityMode(s.id, mode)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-3">
        <Lock size={15} className="text-[#00A593] mt-0.5 shrink-0" />
        <p className="text-[12px] text-[#6B7280] leading-relaxed">
          <strong className="text-[#374151]">No audience settings on this page — by design.</strong> Retrieval is
          ACL-trimmed at query time against each source, and actions run under the employee's own identity wherever
          possible. A screen that asks you to define who-sees-what would recreate the parallel-permissions
          liability this model eliminates.
        </p>
      </div>
    </div>
  )
}

function SourceCard({ source, onTierChange, onIdentityChange }) {
  const degraded = source.health === 'degraded'
  const isAgent = source.kind === 'agent'
  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <LogoSquare name={source.name} color={source.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14.5px] font-bold text-[#111827]">{source.name}</span>
            {isAgent && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#4338CA]">
                <Bot size={10} /> External agent
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-[#6B7280]">
            {isAgent ? 'Hands conversations off and returns them when done' : `${source.capabilities.length} capabilities`}
          </div>
        </div>
        <HealthPill health={source.health} />
      </div>

      {/* Degraded banner — health is enforced at runtime, not just displayed */}
      {degraded && (
        <div className="mx-5 mb-3 flex items-start gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2.5">
          <AlertTriangle size={13} className="text-[#D97706] mt-0.5 shrink-0" />
          <p className="text-[11.5px] text-[#92400E] leading-relaxed">{source.healthNote}</p>
        </div>
      )}

      {/* Capabilities */}
      <div className="border-t border-[#F3F4F6]">
        {source.capabilities.map((cap) => (
          <div key={cap.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#F3F4F6]">
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-medium ${degraded ? 'text-[#9CA3AF]' : 'text-[#374151]'}`}>{cap.label}</div>
              {cap.handoff ? (
                <div className="text-[10.5px] text-[#9CA3AF] mt-0.5">Hand-off — Trigger means the employee confirms before the agent takes over</div>
              ) : cap.write && (
                <div className="text-[10.5px] text-[#9CA3AF] mt-0.5">Writes to {source.name} — Trigger by default</div>
              )}
            </div>
            <TierControl
              value={cap.tier}
              options={TIER_OPTIONS}
              onChange={(tier) => onTierChange(cap.id, tier)}
            />
          </div>
        ))}
      </div>

      {/* Identity + permissions */}
      <div className="px-5 py-3.5 space-y-2.5 bg-[#FAFAFA]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] w-[104px] shrink-0">
            <KeyRound size={12} /> Acting as
          </span>
          {source.identityOptions.length > 1 ? (
            <div className="inline-flex bg-[#F3F4F6] rounded-lg p-0.5">
              {source.identityOptions.map((mode) => (
                <button
                  key={mode}
                  onClick={() => onIdentityChange(mode)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    source.identity === mode ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  {mode === 'employee' ? <User size={11} /> : <Server size={11} />}
                  {mode === 'employee' ? 'Employee (just-in-time auth)' : 'Service account'}
                </button>
              ))}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#374151]">
              {source.identity === 'employee' ? <User size={12} /> : source.identity === 'agent' ? <Bot size={12} /> : <Server size={12} />}
              {source.identity === 'employee'
                ? 'Employee’s own credentials (just-in-time auth)'
                : source.identity === 'agent'
                  ? 'Its own agent identity — scoped per handoff'
                  : 'Service account'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] w-[104px] shrink-0">
            <Lock size={12} /> {isAgent ? 'Scope' : 'Permissions'}
          </span>
          <span className="text-[12px] text-[#6B7280]">
            {source.scopeNote || `Inherited from ${source.name}`}
          </span>
          <InfoTip text={isAgent
            ? `Navigator hands the agent only the active conversation — never your content index or other sources. The handoff is logged like any other action, and the agent returns control when it’s done.`
            : `Navigator never grants access, it only inherits it. Every retrieval is permission-trimmed against ${source.name} at query time, and actions run under the selected identity. There is nothing to configure — and nothing to get out of sync.`} />
        </div>

        <div className="pt-1">
          <EngineRoomLine text={source.engineRoom} />
        </div>
      </div>
    </Card>
  )
}
