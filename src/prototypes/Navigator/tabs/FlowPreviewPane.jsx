// Live preview of an admin-designed workflow as it would appear to an
// employee. Walks the steps[] sequentially via a "Next step" button.
// Non-interactive inside the form (admins tab through field-by-field but
// don't submit).

import React, { useMemo, useState } from 'react';
import { Play, RotateCcw, Sparkles, ChevronRight } from 'lucide-react';
import FormCard from '../../../components/FormCard.jsx';
import ConfirmCard from '../../../components/ConfirmCard.jsx';
import FlowTimeline from '../../StaffbaseCompanion/FlowTimeline.jsx';
import { resolveTokens } from '../../../../lib/flows/runtime.mjs';

export default function FlowPreviewPane({ workflow }) {
  const steps = workflow.steps || [];
  const [stepIdx, setStepIdx] = useState(0);
  const [outputs, setOutputs] = useState({});

  const cappedIdx = Math.min(stepIdx, steps.length);
  const current = steps[cappedIdx];

  function reset() {
    setStepIdx(0);
    setOutputs({});
  }

  function advance(synthOutput) {
    if (current) {
      setOutputs((o) => ({ ...o, [current.id]: synthOutput }));
    }
    setStepIdx((i) => i + 1);
  }

  // Build a "live" view of the workflow item for the FlowTimeline component,
  // mirroring the chat runtime so admins see the real UX.
  const flowItem = useMemo(() => {
    const stepsForView = steps.map((s, idx) => {
      let status = 'pending';
      if (idx < cappedIdx) status = 'done';
      else if (idx === cappedIdx) status = 'awaiting_user';
      return { ...s, status };
    });
    let interaction = null;
    if (current && current.type === 'form') {
      interaction = { kind: 'form', stepId: current.id, spec: current.spec };
    } else if (current && current.type === 'confirm') {
      const rows = (current.summary?.rows || []).map((r) => ({
        label: r.label,
        value: typeof r.value === 'string' ? resolveTokens(r.value, outputs) : r.value,
      }));
      interaction = { kind: 'confirm', stepId: current.id, summary: { ...current.summary, rows } };
    } else if (current && current.type === 'photo') {
      // Studio preview is non-interactive — just surface the capture spec so
      // admins see what the employee will read on this step.
      interaction = { kind: 'photo', stepId: current.id, spec: current.spec, phase: 'capture' };
    }
    return {
      id: workflow.id || 'preview',
      name: workflow.name || 'Workflow preview',
      mode: workflow.mode || 'suggested',
      goal: workflow.goal || '',
      totalSteps: steps.length,
      completedSteps: cappedIdx,
      steps: stepsForView,
      stepOutputs: outputs,
      currentStepInteraction: interaction,
      stepMachine: true,
      status: cappedIdx >= steps.length ? 'completed' : 'running',
      summary: cappedIdx >= steps.length ? 'Done — preview complete.' : '',
    };
  }, [workflow.id, workflow.name, workflow.mode, workflow.goal, steps, cappedIdx, outputs, current]);

  // Synthesize sample output for the current step so subsequent steps can
  // demonstrate token-resolution (the live preview is non-interactive).
  function syntheticForCurrent() {
    if (!current) return null;
    if (current.type === 'form') {
      const out = {};
      for (const f of current.spec?.fields || []) {
        if (f.defaultValue !== undefined) { out[f.id] = f.defaultValue; continue; }
        if (f.type === 'date') out[f.id] = '2026-06-15';
        else if (f.type === 'number') out[f.id] = 100;
        else if (f.type === 'email') out[f.id] = 'alex@example.com';
        else if (f.type === 'url') out[f.id] = 'https://example.com';
        else if (f.type === 'select' || f.type === 'radio') out[f.id] = f.options?.[0]?.value || '';
        else if (f.type === 'checkbox') out[f.id] = true;
        else out[f.id] = `sample ${f.label || f.id}`;
      }
      return out;
    }
    if (current.type === 'confirm') return { confirmed: true };
    if (current.type === 'tool') return { ok: true };
    if (current.type === 'photo') {
      // Synthetic canned validation so downstream confirm/tool steps can
      // show their resolved tokens in the preview.
      return {
        imageDataUrl: null,
        imageWidth: 1280,
        imageHeight: 960,
        mimeType: 'image/jpeg',
        acceptedDespiteFail: false,
        validation: {
          passed: true,
          summary: 'Preview: all criteria appear satisfied.',
          criteria: (current.spec?.aiValidation?.criteria || []).map((c) => ({
            id: c.id, label: c.label, passed: true, reason: 'Preview pass',
          })),
          annotations: [],
        },
      };
    }
    return null;
  }

  const showAdvance = !!current;

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#111827]">
          <Sparkles size={14} className="text-[#00C7B2]" />
          Live preview
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={reset}
            className="p-1.5 text-[#94A3B8] hover:text-[#475569] rounded"
            title="Reset preview"
          >
            <RotateCcw size={13} />
          </button>
          {showAdvance && (
            <button
              onClick={() => advance(syntheticForCurrent())}
              className="px-2.5 py-1 text-[11px] font-semibold bg-[#00C7B2] hover:bg-[#00736A] text-white rounded-lg flex items-center gap-1"
              title="Walk through the workflow with sample values"
            >
              Next step <ChevronRight size={11} />
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-[#6B7280] mb-3">
        What an employee will see as Navigator drives this workflow. Use <em>Next step</em> to walk through with sample data.
      </p>

      {steps.length === 0 ? (
        <div className="px-3 py-6 text-center bg-[#F9FAFB] border border-dashed border-[#E5E7EB] rounded-lg text-[12px] text-[#94A3B8]">
          <Play size={18} className="mx-auto mb-2 opacity-50" />
          Add a step to see the preview.
        </div>
      ) : (
        <div className="bg-[#F5F5F7] rounded-lg p-2">
          <FlowTimeline flow={flowItem} busy={true} />
        </div>
      )}
    </div>
  );
}
