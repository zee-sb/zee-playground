import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import EvalScoreBar from './EvalScoreBar'
import { dimensionLabel } from '../lib/evalBands'

const FIRST_CLASS = ['resolution', 'hallucination', 'factual_accuracy', 'friction', 'sentiment']

// Render the five first-class scores. Pass `evals` as an array of
// { dimension, score, label, flag, reasoning } from the detail endpoint.
export default function EvalScoreCluster({ evals = [], showDiagnostics = false }) {
  const [open, setOpen] = useState(false)
  const byDim = Object.fromEntries(evals.map((e) => [e.dimension, e]))
  const diagnostics = evals.filter((e) => !FIRST_CLASS.includes(e.dimension))

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280]">Eval scores</div>
        <div className="text-[10px] text-[#94A3B8]">0–100 · higher is better</div>
      </div>
      {FIRST_CLASS.map((d) => {
        const e = byDim[d]
        return (
          <EvalScoreBar
            key={d}
            dimension={d}
            label={dimensionLabel(d)}
            value={e?.score}
            reasoning={e?.reasoning}
          />
        )
      })}

      {showDiagnostics && diagnostics.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-3 w-full flex items-center justify-between text-[11px] font-semibold text-[#6B7280] hover:text-[#111827]"
          >
            <span>All scores ({diagnostics.length})</span>
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {open && (
            <div className="mt-2 pt-3 border-t border-[#F1F5F9] space-y-2">
              {diagnostics.map((e) => (
                <DiagnosticRow key={e.dimension} evalRow={e} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DiagnosticRow({ evalRow }) {
  const label = dimensionLabel(evalRow.dimension)
  let value
  if (evalRow.type === 'flag') value = evalRow.flag ? 'pass' : 'fail'
  else if (evalRow.type === 'label') value = evalRow.label
  else if (evalRow.type === 'numeric') {
    if (evalRow.dimension === 'repeated_question_count') value = String(evalRow.score ?? 0)
    else value = `${Math.round((evalRow.score ?? 0) * 100)}`
  }
  return (
    <div className="flex items-start justify-between gap-3" title={evalRow.reasoning || ''}>
      <div className="text-[11px] text-[#374151]">{label}</div>
      <div className="text-[11px] font-semibold text-[#111827] tabular-nums">{value}</div>
    </div>
  )
}
