import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Workflow, CheckCircle2, Loader2, Circle, Flag } from 'lucide-react';

// Renders an active Admin-defined Flow's progress in the chat. The runtime
// emits `flow_started`, `flow_step`, and `flow_completed` events; ChatPanel
// collects them into a single `flow` item that drives this card.
//
// props:
//   flow = {
//     id, name, mode, goal,
//     totalSteps,           // from flow_started
//     completedSteps,       // accumulated from flow_step events
//     status: 'running' | 'completed',
//     summary,              // final assistant text (from flow_completed)
//     steps: [{ index, label, toolCallId }]
//   }
export default function FlowCard({ flow }) {
  const [open, setOpen] = useState(true);
  if (!flow) return null;
  const total = Math.max(flow.totalSteps || 0, flow.steps?.length || 0, 1);
  const done = Math.min(flow.completedSteps || flow.steps?.length || 0, total);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = flow.status === 'completed';

  return (
    <div style={{
      margin: '8px 0',
      border: '1px solid rgba(0, 199, 178, 0.25)',
      borderRadius: 12,
      background: 'linear-gradient(180deg, rgba(0, 199, 178, 0.06) 0%, rgba(255,255,255,0.95) 100%)',
      overflow: 'hidden',
      fontSize: 12,
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', textAlign: 'left',
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        {open ? <ChevronDown size={13} color="#9CA3AF" /> : <ChevronRight size={13} color="#9CA3AF" />}
        <Workflow size={14} color="#00C7B2" />
        <span style={{ fontWeight: 700, color: '#0F766E', fontSize: 12 }}>
          {flow.name || 'Flow'}
        </span>
        {flow.mode === 'required' && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
            padding: '1px 5px', borderRadius: 4,
            background: '#0F766E', color: 'white',
          }}>
            REQUIRED
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#52525B', fontWeight: 600 }}>
          {isComplete
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16A34A' }}>
                <CheckCircle2 size={12} /> Complete
              </span>
            : `${done}/${total} · ${pct}%`}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 12px 12px', borderTop: '1px solid rgba(0, 199, 178, 0.15)' }}>
          {flow.goal && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              fontSize: 11.5, color: '#52525B', marginBottom: 10,
              padding: '6px 8px', background: 'rgba(0, 199, 178, 0.05)',
              borderRadius: 6,
            }}>
              <Flag size={11} color="#0F766E" style={{ marginTop: 2, flexShrink: 0 }} />
              <span><b style={{ color: '#0F766E' }}>Goal:</b> {flow.goal}</span>
            </div>
          )}
          {/* Progress bar */}
          <div style={{
            height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden',
            marginBottom: 10,
          }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: isComplete ? '#16A34A' : '#00C7B2',
              transition: 'width 250ms ease',
            }} />
          </div>
          {/* Step list */}
          <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {Array.from({ length: total }).map((_, i) => {
              const step = (flow.steps || [])[i];
              const isDone = i < done;
              const isCurrent = !isComplete && i === done;
              return (
                <li key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 0', borderTop: i === 0 ? 'none' : '1px dashed rgba(0,0,0,0.05)',
                }}>
                  {isDone
                    ? <CheckCircle2 size={13} color="#16A34A" />
                    : isCurrent
                      ? <Loader2 size={13} color="#7C3AED" style={{ animation: 'spin 1s linear infinite' }} />
                      : <Circle size={13} color="#D4D4D8" />}
                  <span style={{
                    fontSize: 11.5, fontWeight: isCurrent ? 700 : 500,
                    color: isDone ? '#16A34A' : isCurrent ? '#7C3AED' : '#A1A1AA',
                    flex: 1,
                  }}>
                    {step?.label || `Step ${i + 1}`}
                  </span>
                </li>
              );
            })}
          </ol>
          {isComplete && flow.summary && (
            <div style={{
              marginTop: 8, padding: '6px 8px', background: 'rgba(16, 185, 129, 0.08)',
              borderRadius: 6, fontSize: 11.5, color: '#065F46',
            }}>
              {flow.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inline confirm chip for `mode: 'suggested'` flows. The user clicks "Start"
// to commit the flow — the chat input sends a sentinel that the orchestrator
// catches on the next turn.
//
// v9: "Not now" now records a dismissal. The chat tracks dismissed flow ids
// per browser session (via localStorage); the chip suppresses itself for
// `suppressDays` days after being dismissed, so users don't get nagged.
export function FlowSuggestionChip({ flow, onStart, onDismiss, suppressDays = 7 }) {
  const storageKey = flow ? `nav.flow.dismissed.${flow.id || flow.name}` : null;
  const [dismissed, setDismissed] = React.useState(() => {
    if (!storageKey) return false;
    try {
      const ts = window.localStorage.getItem(storageKey);
      if (!ts) return false;
      const ageDays = (Date.now() - Number(ts)) / (1000 * 60 * 60 * 24);
      return ageDays < suppressDays;
    } catch { return false; }
  });

  if (!flow || dismissed) return null;

  function handleDismiss() {
    try { window.localStorage.setItem(storageKey, String(Date.now())); } catch { /* ignore */ }
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <div style={{
      margin: '6px 0',
      padding: '8px 10px',
      border: '1px dashed rgba(0, 199, 178, 0.45)',
      background: 'rgba(0, 199, 178, 0.07)',
      borderRadius: 10,
      fontSize: 12,
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    }}>
      <Workflow size={14} color="#0F766E" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 160, color: '#0F766E' }}>
        Looks like you might want to start <b>{flow.name}</b>{flow.goal ? <> — {flow.goal}</> : null}.
      </span>
      <button
        type="button"
        onClick={onStart}
        style={{
          padding: '4px 10px', fontSize: 11.5, fontWeight: 700,
          background: '#0F766E', color: 'white', border: 'none', borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Start
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        title={`We won't suggest this for the next ${suppressDays} days.`}
        style={{
          padding: '4px 8px', fontSize: 11.5, fontWeight: 600,
          background: 'transparent', color: '#0F766E', border: 'none', cursor: 'pointer',
        }}
      >
        Not now
      </button>
    </div>
  );
}
