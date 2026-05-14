// Schema-driven flow rendering in chat. Vertical timeline of steps with the
// current step interactive (form / confirm / running tool) and prior steps
// collapsed to a one-line summary.

import React, { useState } from 'react';
import { CheckCircle2, Circle, Loader2, ClipboardList, ShieldCheck, Wrench, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import FormCard from '../../components/FormCard.jsx';
import ConfirmCard from '../../components/ConfirmCard.jsx';
import {
  STAFFBASE_TEAL, STAFFBASE_TEAL_DEEP, NEUTRAL_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from './cards/cardStyles.js';

function stepIcon(type, size = 14) {
  if (type === 'form') return <ClipboardList size={size} />;
  if (type === 'confirm') return <ShieldCheck size={size} />;
  if (type === 'tool') return <Wrench size={size} />;
  return <Circle size={size} />;
}

export default function FlowTimeline({ flow, onFormSubmit, onConfirm, onCancel, busy = false }) {
  const totalSteps = flow.steps?.length || flow.totalSteps || 0;
  const completedSteps = flow.completedSteps || 0;
  const status = flow.status || 'running';

  return (
    <div style={{
      margin: '8px 0',
      background: '#FFFFFF',
      border: `1px solid ${NEUTRAL_BORDER}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
    }}>
      <FlowHeader
        name={flow.name}
        goal={flow.goal}
        mode={flow.mode}
        completed={completedSteps}
        total={totalSteps}
        status={status}
      />

      <div style={{ padding: '6px 0 4px' }}>
        {(flow.steps || []).map((step, idx) => (
          <StepRow
            key={step.id || idx}
            step={step}
            index={idx}
            isLast={idx === (flow.steps?.length || 0) - 1}
            currentStepInteraction={flow.currentStepInteraction}
            onFormSubmit={onFormSubmit}
            onConfirm={onConfirm}
            onCancel={onCancel}
            stepOutputs={flow.stepOutputs || {}}
            busy={busy}
          />
        ))}
      </div>

      {status === 'completed' && flow.summary && (
        <div style={{
          padding: '10px 14px', borderTop: `1px solid ${NEUTRAL_BORDER}`,
          background: 'rgba(0,199,178,0.05)', fontSize: 12, color: TEXT_SECONDARY,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Sparkles size={13} color={STAFFBASE_TEAL_DEEP} />
          <span>{flow.summary}</span>
        </div>
      )}
    </div>
  );
}

function FlowHeader({ name, goal, mode, completed, total, status }) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${NEUTRAL_BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          background: STAFFBASE_TEAL, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={12} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.2 }}>
            {name}
          </div>
          {goal && (
            <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 }}>{goal}</div>
          )}
        </div>
        {mode && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: mode === 'required' ? '#7C2D12' : STAFFBASE_TEAL_DEEP,
            background: mode === 'required' ? '#FFEDD5' : 'rgba(0,199,178,0.12)',
            padding: '2px 7px', borderRadius: 999,
          }}>
            {mode}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1, height: 4, background: '#E5E7EB', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: status === 'completed' ? STAFFBASE_TEAL_DEEP : STAFFBASE_TEAL,
            transition: 'width 220ms ease',
          }} />
        </div>
        <div style={{ fontSize: 10.5, color: TEXT_MUTED, fontWeight: 600, minWidth: 50, textAlign: 'right' }}>
          {status === 'completed' ? 'Done' : `Step ${Math.min(completed + 1, total)} of ${total}`}
        </div>
      </div>
    </div>
  );
}

function StepRow({
  step, index, isLast, currentStepInteraction,
  onFormSubmit, onConfirm, onCancel, stepOutputs, busy,
}) {
  const status = step.status || 'pending'; // 'pending' | 'awaiting_user' | 'done' | 'error'
  const isCurrent = currentStepInteraction?.stepId === step.id;
  const isDone = status === 'done';
  const isWaiting = status === 'awaiting_user' || isCurrent;
  const [expanded, setExpanded] = useState(isWaiting);

  const indicatorColor = isDone
    ? STAFFBASE_TEAL_DEEP
    : isWaiting
      ? STAFFBASE_TEAL
      : '#D1D5DB';

  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 14px' }}>
      {/* Spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: isDone ? STAFFBASE_TEAL_DEEP : isWaiting ? 'rgba(0,199,178,0.12)' : '#F3F4F6',
          color: isDone ? 'white' : indicatorColor,
          border: isDone ? 'none' : `1px solid ${isWaiting ? STAFFBASE_TEAL : '#E5E7EB'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {isDone
            ? <CheckCircle2 size={14} />
            : status === 'awaiting_user' && step.type === 'tool'
              ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : stepIcon(step.type, 12)}
        </div>
        {!isLast && (
          <div style={{
            width: 1.5, flex: 1, marginTop: 2, minHeight: 12,
            background: isDone ? STAFFBASE_TEAL_DEEP : '#E5E7EB',
          }} />
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, paddingBottom: isLast ? 6 : 4 }}>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            width: '100%', textAlign: 'left',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: TEXT_PRIMARY, fontSize: 12.5, fontWeight: 600,
          }}
        >
          {expanded ? <ChevronDown size={12} color={TEXT_MUTED} /> : <ChevronRight size={12} color={TEXT_MUTED} />}
          <span style={{ color: isDone ? TEXT_SECONDARY : TEXT_PRIMARY }}>{step.label || `Step ${index + 1}`}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: TEXT_MUTED, marginLeft: 'auto',
          }}>
            {step.type}
          </span>
        </button>

        {expanded && (
          <div style={{ marginTop: 6 }}>
            {/* Interactive content for the current step */}
            {isCurrent && currentStepInteraction?.kind === 'form' && (
              <FormCard
                spec={currentStepInteraction.spec}
                initialValues={stepOutputs[step.id]}
                busy={busy}
                onSubmit={(values) => onFormSubmit?.(step.id, values)}
                theme="teal"
              />
            )}
            {isCurrent && currentStepInteraction?.kind === 'confirm' && (
              <ConfirmCard
                summary={currentStepInteraction.summary}
                busy={busy}
                onConfirm={() => onConfirm?.(step.id)}
                onCancel={() => onCancel?.(step.id, step.summary?.cancelTo)}
                theme="teal"
              />
            )}
            {!isCurrent && isDone && (
              <DoneSummary step={step} output={stepOutputs[step.id]} />
            )}
            {!isCurrent && !isDone && (
              <div style={{ fontSize: 11.5, color: TEXT_MUTED, fontStyle: 'italic' }}>
                Pending…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DoneSummary({ step, output }) {
  if (!output) {
    return <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>Done.</div>;
  }
  if (step.type === 'form') {
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px',
        fontSize: 11.5, color: TEXT_SECONDARY,
      }}>
        {(step.spec?.fields || []).map((f) => {
          const v = output[f.id];
          if (v === undefined || v === null || v === '') return null;
          return (
            <React.Fragment key={f.id}>
              <div style={{ color: TEXT_MUTED, fontWeight: 600 }}>{f.label}</div>
              <div style={{ color: TEXT_PRIMARY }}>{String(v)}</div>
            </React.Fragment>
          );
        })}
      </div>
    );
  }
  if (step.type === 'confirm') {
    return <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Confirmed.</div>;
  }
  if (step.type === 'tool') {
    if (output?.error) {
      return <div style={{ fontSize: 11.5, color: '#B91C1C' }}>Failed: {output.error}</div>;
    }
    const txt = typeof output === 'string' ? output : JSON.stringify(output).slice(0, 200);
    return <div style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: 'ui-monospace, monospace' }}>{txt}</div>;
  }
  return null;
}
