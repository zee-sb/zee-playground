import React, { useMemo, useState } from 'react';
import { Sparkles, Workflow, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Employee-facing flow catalog — surfaces the active workflows the user is
 * eligible for so they don't have to "discover" them via natural-language
 * chat. Renders inline in the chat (e.g. at the start of a conversation
 * or as a slash menu shortcut).
 *
 * Props:
 *   workflows: full flow list (will be filtered to active + audience-matching)
 *   user:      { role, location, ... } — used for audience filtering
 *   onStart:   (flow) => void  — triggers the flow as if the user typed the trigger
 */
export default function QuickActionsTray({ workflows = [], user, onStart }) {
  const [open, setOpen] = useState(true);

  const eligible = useMemo(() => {
    const active = workflows.filter((w) => (w.status || 'active') === 'active' && (w.steps || []).length > 0);
    if (!user) return active;
    return active.filter((w) => matchesAudience(w.audience, user));
  }, [workflows, user]);

  if (eligible.length === 0) return null;

  return (
    <div style={{
      margin: '8px 0',
      border: '1px solid rgba(124, 58, 237, 0.18)',
      background: 'linear-gradient(180deg, rgba(124,58,237,0.06) 0%, rgba(255,255,255,0.95) 100%)',
      borderRadius: 12,
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
        <Sparkles size={14} color="#7C3AED" />
        <span style={{ fontWeight: 700, color: '#5B21B6' }}>Quick actions</span>
        <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>
          ({eligible.length})
        </span>
        <span style={{ marginLeft: 'auto', color: '#7C3AED' }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 8px 10px' }}>
          {eligible.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onStart?.(w)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 10,
                background: '#FFFFFF', border: '1px solid #E5E7EB',
                margin: '4px 0', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(124,58,237,0.1)', color: '#7C3AED',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Workflow size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#111827', fontSize: 12.5 }}>{w.name}</div>
                <div style={{
                  color: '#6B7280', fontSize: 11, marginTop: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {w.goal || w.trigger || `${(w.steps || []).length} steps`}
                </div>
              </div>
              <ChevronRight size={13} color="#94A3B8" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function matchesAudience(audience, user) {
  const a = audience || { everyone: true };
  if (a.everyone) return true;
  const userRole = user?.role ? String(user.role).toLowerCase() : '';
  const userLoc  = user?.location ? String(user.location).toLowerCase() : '';
  const rolesOK = !a.roles?.length || a.roles.some((r) => String(r).toLowerCase() === userRole);
  const locsOK  = !a.locations?.length || a.locations.some((l) => String(l).toLowerCase() === userLoc);
  return rolesOK && locsOK;
}
