import React from 'react'
import { Users, MapPin, Globe, ShieldCheck } from 'lucide-react'

/**
 * Compact audience picker reused across Templates Gallery + AI Creator.
 *
 * Props:
 *   value: { everyone: boolean, roles: string[], locations: string[] }
 *   onChange: (next) => void
 *   roles: string[]      — available role options (from tenant)
 *   locations: string[]  — available location options (from tenant)
 */
export default function AudiencePicker({ value, onChange, roles = [], locations = [] }) {
  const audience = value || { everyone: true, roles: [], locations: [] }

  const setEveryone = (everyone) => onChange({ ...audience, everyone })
  const toggleRole = (r) => {
    const cur = audience.roles || []
    onChange({ ...audience, roles: cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r] })
  }
  const toggleLocation = (l) => {
    const cur = audience.locations || []
    onChange({ ...audience, locations: cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l] })
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => setEveryone(true)}
          className={`p-2.5 rounded-lg border text-left transition-colors ${
            audience.everyone ? 'border-[#7C3AED] bg-[#F5F3FF]' : 'border-[#E4E4E7] hover:border-[#D4D4D8]'
          }`}
        >
          <div className="flex items-center gap-2 mb-0.5">
            <Globe size={13} className={audience.everyone ? 'text-[#7C3AED]' : 'text-[#71717A]'} />
            <span className={`text-[12.5px] font-semibold ${audience.everyone ? 'text-[#5B21B6]' : 'text-[#18181B]'}`}>Everyone</span>
          </div>
          <div className="text-[11px] text-[#71717A]">All employees see this Assistant.</div>
        </button>
        <button
          type="button"
          onClick={() => setEveryone(false)}
          className={`p-2.5 rounded-lg border text-left transition-colors ${
            !audience.everyone ? 'border-[#7C3AED] bg-[#F5F3FF]' : 'border-[#E4E4E7] hover:border-[#D4D4D8]'
          }`}
        >
          <div className="flex items-center gap-2 mb-0.5">
            <ShieldCheck size={13} className={!audience.everyone ? 'text-[#7C3AED]' : 'text-[#71717A]'} />
            <span className={`text-[12.5px] font-semibold ${!audience.everyone ? 'text-[#5B21B6]' : 'text-[#18181B]'}`}>Specific</span>
          </div>
          <div className="text-[11px] text-[#71717A]">Filter by role or location.</div>
        </button>
      </div>

      <div className={audience.everyone ? 'opacity-40 pointer-events-none' : ''}>
        {roles.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Users size={11} className="text-[#71717A]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">Roles</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {roles.map((r) => {
                const on = (audience.roles || []).includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={`text-[12px] px-2 py-0.5 rounded-full border transition-colors ${
                      on
                        ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                        : 'bg-white border-[#E4E4E7] text-[#52525B] hover:border-[#D4D4D8]'
                    }`}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {locations.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <MapPin size={11} className="text-[#71717A]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">Locations</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {locations.map((l) => {
                const on = (audience.locations || []).includes(l)
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLocation(l)}
                    className={`text-[12px] px-2 py-0.5 rounded-full border transition-colors ${
                      on
                        ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                        : 'bg-white border-[#E4E4E7] text-[#52525B] hover:border-[#D4D4D8]'
                    }`}
                  >
                    {l}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
