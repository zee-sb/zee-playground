import React from 'react'
import { Building2, MapPin, Users as UsersIcon, RotateCcw, Sparkles, ShieldCheck } from 'lucide-react'

/**
 * Workspace tab — Acme tenant info + demo user roster + Reset to defaults.
 *
 * Read-only on purpose: this is the "settings" panel for the tenant itself,
 * showing admins what universe their assistants live in. Audience options in
 * Studio's Assistant editor are drawn from `tenant.roles` and `tenant.locations`.
 */
export default function WorkspaceTab({ tenant = {}, demoUsers = [], onReset }) {
  const roles = tenant.roles || []
  const locations = tenant.locations || []
  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Workspace</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Tenant identity, audience taxonomy, and demo user roster. Roles and locations here populate the Audience editor for each assistant.
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-[#6B7280] hover:text-[#111827] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
        >
          <RotateCcw size={13} />
          Reset to Acme defaults
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-6">
        {/* Tenant identity */}
        <div className="space-y-6">
          <Section title="Tenant" icon={<Building2 size={14} className="text-[#7C3AED]" />}>
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-[22px]"
                style={{ background: tenant.brandColor || '#7C3AED' }}
              >
                {(tenant.name || 'A').slice(0, 1)}
              </div>
              <div>
                <div className="text-[18px] font-bold text-[#111827]">{tenant.name || 'Acme'}</div>
                <div className="text-[12px] text-[#6B7280] font-mono">{tenant.workspace || 'acme.staffbase.com'}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Stat label="Roles" value={roles.length} icon={<ShieldCheck size={11} />} />
              <Stat label="Locations" value={locations.length} icon={<MapPin size={11} />} />
              <Stat label="Demo users" value={demoUsers.length} icon={<UsersIcon size={11} />} />
            </div>
          </Section>

          <Section title="Roles" icon={<ShieldCheck size={14} className="text-[#7C3AED]" />} description="Used to scope audience for shift-floor and HQ assistants.">
            <div className="flex flex-wrap gap-1.5">
              {roles.map(r => (
                <span key={r} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F3F4F6] text-[#374151]">{r}</span>
              ))}
            </div>
          </Section>

          <Section title="Locations" icon={<MapPin size={14} className="text-[#7C3AED]" />} description="Per-store + HQ. Audience can also be scoped by location.">
            <div className="flex flex-wrap gap-1.5">
              {locations.map(l => (
                <span key={l} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#1E40AF]">{l}</span>
              ))}
            </div>
          </Section>
        </div>

        {/* Demo users */}
        <Section title="Demo users" icon={<UsersIcon size={14} className="text-[#7C3AED]" />} description="Sign-in roster shown on the Employee login screen. Use 'View as' in the right rail to see what each user sees.">
          <div className="space-y-1.5">
            {demoUsers.map(u => (
              <div key={u.email} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-[#E5E7EB] rounded-lg">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[12px] shrink-0" style={{ background: u.color }}>
                  {u.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[13px] font-bold text-[#111827] truncate">{u.name}</div>
                    <span className="text-[10px] font-mono text-[#9CA3AF]">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-semibold" style={{ color: u.color }}>{u.role}</span>
                    <span className="text-[10px] text-[#9CA3AF]">·</span>
                    <span className="text-[11px] text-[#6B7280] flex items-center gap-1">
                      <MapPin size={9} /> {u.location}
                    </span>
                  </div>
                </div>
              </div>
            ))}
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
