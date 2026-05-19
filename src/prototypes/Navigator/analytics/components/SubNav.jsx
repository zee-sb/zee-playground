import React from 'react'
import { LayoutDashboard, MessageSquare } from 'lucide-react'

const TABS = [
  { id: 'overview',      label: 'Overview',      icon: LayoutDashboard },
  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
]

export default function SubNav({ active, onChange, rightSlot = null }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="inline-flex items-center gap-1 border border-[#E5E7EB] rounded-lg p-0.5 bg-white">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={
                'flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-semibold rounded-md transition-colors ' +
                (isActive
                  ? 'bg-[#111827] text-white'
                  : 'text-[#475569] hover:bg-[#F9FAFB]')
              }
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">{rightSlot}</div>
    </div>
  )
}
