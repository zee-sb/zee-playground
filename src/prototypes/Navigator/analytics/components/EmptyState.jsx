import React from 'react'
import { Inbox } from 'lucide-react'

export default function EmptyState({ title = 'Nothing here yet', children, cta }) {
  return (
    <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl py-12 px-6 text-center">
      <Inbox size={20} className="mx-auto text-[#94A3B8] mb-2" />
      <div className="text-[14px] font-semibold text-[#111827]">{title}</div>
      {children && <div className="text-[12px] text-[#6B7280] mt-1">{children}</div>}
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  )
}
