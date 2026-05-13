import React from 'react'
import { Building2, Users as UsersIcon, RotateCcw, ShieldCheck } from 'lucide-react'

/**
 * Workspace tab — Staffbase tenant info + groups (discovered) + Reset.
 *
 * Read-only on purpose: this is the "settings" panel for the tenant itself,
 * showing admins what universe their assistants live in. Audience options in
 * Studio's Assistant editor are drawn from real Staffbase groups (discovered
 * by the Setup wizard into workspace_blueprints).
 */
export default function WorkspaceTab({ tenant = {}, demoUsers = [], onReset }) {
  const groups = tenant.groups || []
  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Workspace</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Tenant identity and audience groups. Groups are discovered from the live Staffbase directory and populate the Audience editor for each assistant.
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-[#6B7280] hover:text-[#111827] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
        >
          <RotateCcw size={13} />
          Reset to Staffbase defaults
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-6">
        {/* Tenant identity */}
        <div className="space-y-6">
          <Section title="Tenant" icon={<Building2 size={14} className="text-[#00C7B2]" />}>
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-[22px]"
                style={{ background: tenant.brandColor || '#00C7B2' }}
              >
                {(tenant.name || 'S').slice(0, 1)}
              </div>
              <div>
                <div className="text-[18px] font-bold text-[#111827]">{tenant.name || 'Staffbase'}</div>
                <div className="text-[12px] text-[#6B7280] font-mono">{tenant.workspace || 'campsite.staffbase.com'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Stat label="Groups" value={groups.length} icon={<ShieldCheck size={11} />} />
              <Stat label="Team members" value={demoUsers.length} icon={<UsersIcon size={11} />} />
            </div>
          </Section>

          <Section title="Groups" icon={<ShieldCheck size={14} className="text-[#00C7B2]" />} description={groups.length ? 'Audience can be scoped to any of these Staffbase groups.' : 'No groups yet — run discovery in the Setup tab to pull groups from the live Staffbase directory.'}>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(g => (
                <span key={g} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F3F4F6] text-[#374151]">{g}</span>
              ))}
              {groups.length === 0 && (
                <span className="text-[12px] text-[#9CA3AF] italic">No groups loaded yet.</span>
              )}
            </div>
          </Section>
        </div>

        {/* Team members (cached snapshot from Staffbase) */}
        <Section title="Team members" icon={<UsersIcon size={14} className="text-[#00C7B2]" />} description={demoUsers.length ? 'Cached snapshot of the Staffbase team. Used by the "View as" preview in the right rail.' : 'No team members cached yet. Run Sync in the Setup tab to pull users from the live Staffbase directory.'}>
          <div className="space-y-1.5">
            {demoUsers.map(u => (
              <div key={u.email} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-[#E5E7EB] rounded-lg">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[12px] shrink-0" style={{ background: u.color || '#00C7B2' }}>
                  {u.avatar || (u.name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[13px] font-bold text-[#111827] truncate">{u.name}</div>
                    <span className="text-[10px] font-mono text-[#9CA3AF]">{u.email}</span>
                  </div>
                  {(u.title || u.department) && (
                    <div className="text-[11px] text-[#6B7280] mt-0.5">
                      {[u.title, u.department].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {demoUsers.length === 0 && (
              <div className="text-center py-8 text-[12px] text-[#9CA3AF] italic">
                No team members loaded. Run discovery in the Setup tab to pull the Staffbase directory.
              </div>
            )}
          </div>
        </Section>
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
      <div>{children}</div>
    </div>
  )
}

function Stat({ label, value, icon }) {
  return (
    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
        {icon} {label}
      </div>
      <div className="text-[18px] font-bold text-[#111827] mt-0.5">{value}</div>
    </div>
  )
}
