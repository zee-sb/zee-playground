import React from 'react'
import { Settings } from 'lucide-react'

export default function AnalyticsHeader({ basePath, navigate }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h1 className="text-[22px] font-bold text-[#111827]">Navigator</h1>
        <p className="text-[13px] text-[#6B7280] mt-1">
          What employees are asking, how the assistant is doing, and where to react.
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate?.(`${basePath}/home`)}
        className="flex items-center gap-2 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] font-semibold text-[#374151] hover:bg-[#F9FAFB]"
      >
        <Settings size={14} /> Navigator Settings
      </button>
    </div>
  )
}
