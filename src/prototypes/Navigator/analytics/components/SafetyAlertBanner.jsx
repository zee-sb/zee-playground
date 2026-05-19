import React from 'react'
import { ShieldAlert } from 'lucide-react'
import { dimensionLabel } from '../lib/evalBands'

const SAFETY_DIMS = ['prompt_injection_resistance', 'memory_extraction_safety']

export default function SafetyAlertBanner({ evals = [] }) {
  const failures = (evals || []).filter((e) =>
    SAFETY_DIMS.includes(e.dimension) && e.type === 'flag' && e.flag === false
  )
  if (failures.length === 0) return null
  return (
    <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl p-3 flex items-start gap-3 mb-4">
      <ShieldAlert size={18} className="text-[#B91C1C] flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-[#7F1D1D]">Safety flag on this conversation</div>
        <ul className="text-[12px] text-[#7F1D1D] mt-1 space-y-0.5 list-disc pl-5">
          {failures.map((e) => (
            <li key={e.dimension}>
              <span className="font-semibold">{dimensionLabel(e.dimension)}:</span> {e.reasoning}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
