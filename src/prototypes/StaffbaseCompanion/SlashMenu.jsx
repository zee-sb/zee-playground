// Quick-action menu shown when the employee types "/" as the first char of
// the composer. Two grouped sections — Actions (workflows) and Experts
// (assistants) — drawn from server-filtered heroData. Picking a row hands a
// trigger phrase back to the composer, which submits it like a normal
// message so the existing orchestrator routes it.

import React, { useMemo } from 'react';
import { Workflow, Sparkles, CornerDownLeft } from 'lucide-react';
import { BRAND } from './lib/tokens.js';

// Build the message we send to the orchestrator on pick. Mirrors the
// language used by DesktopHero tiles (already proven to route correctly).
export function workflowPrompt(w) {
  const title = w.name || 'Flow';
  return w.goal ? `I want to start the ${title} flow — ${w.goal}` : `Start: ${title}`;
}
export function expertPrompt(e) {
  const title = e.name || 'Assistant';
  return e.description
    ? `Help me with ${title.toLowerCase()} — ${e.description.toLowerCase()}`
    : `Help me with something for the ${title}.`;
}

const SECTION_CAP = 6;

function rankItems(items, q, fields) {
  if (!q) return items;
  const needle = q.toLowerCase();
  const scored = [];
  for (const it of items) {
    const name = (it.name || '').toLowerCase();
    if (name.startsWith(needle)) { scored.push([0, it]); continue; }
    if (name.includes(needle)) { scored.push([1, it]); continue; }
    let matched = false;
    for (const f of fields) {
      const v = (it[f] || '').toLowerCase();
      if (v.includes(needle)) { scored.push([2, it]); matched = true; break; }
    }
    if (matched) continue;
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.map((s) => s[1]);
}

export default function SlashMenu({
  query,
  workflows,
  experts,
  isMobile,
  selectedIndex,
  onPick,
  onHover,
}) {
  const { wf, ex, total, wfTruncated, exTruncated } = useMemo(() => {
    const rankedWf = rankItems(workflows || [], query, ['goal']);
    const rankedEx = rankItems(experts || [], query, ['description']);
    const wf = rankedWf.slice(0, SECTION_CAP);
    const ex = rankedEx.slice(0, SECTION_CAP);
    return {
      wf, ex,
      total: wf.length + ex.length,
      wfTruncated: rankedWf.length - wf.length,
      exTruncated: rankedEx.length - ex.length,
    };
  }, [query, workflows, experts]);

  // Container varies between desktop popover and mobile bottom-sheet.
  const containerStyle = isMobile
    ? {
        position: 'absolute', left: 8, right: 8, bottom: '100%', marginBottom: 6,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)',
        borderRadius: 18, border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 -8px 36px rgba(15,23,42,0.16)',
        maxHeight: '52vh', overflowY: 'auto', overscrollBehavior: 'contain',
        zIndex: 60,
      }
    : {
        position: 'absolute', left: 12, right: 12, bottom: '100%', marginBottom: 8,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)',
        borderRadius: 16, border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 8px 28px rgba(15,23,42,0.18)',
        maxHeight: 360, overflowY: 'auto',
        zIndex: 60,
      };

  if (total === 0) {
    return (
      <div style={containerStyle} role="listbox" aria-label="Quick actions">
        <div style={{
          padding: '14px 16px', fontSize: 13, color: BRAND.muted,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ flex: 1 }}>No matches. Press <kbd style={kbd}>Enter</kbd> to send as-is.</span>
        </div>
      </div>
    );
  }

  let flatIndex = -1;

  function Row({ item, kind }) {
    flatIndex += 1;
    const localIndex = flatIndex;
    const active = localIndex === selectedIndex;
    const rowH = isMobile ? 56 : 48;
    const icon = item.icon && /^\p{Emoji}/u.test(item.icon) ? item.icon : null;
    const Fallback = kind === 'flow' ? Workflow : Sparkles;
    const subtitle = kind === 'flow' ? (item.goal || 'Run this action') : (item.description || 'Talk to this expert');
    return (
      <div
        role="option"
        aria-selected={active}
        onMouseEnter={() => onHover?.(localIndex)}
        // Use onMouseDown not onClick: the textarea blurs before onClick fires
        // and we lose the pick. preventDefault keeps focus on the textarea.
        onMouseDown={(e) => { e.preventDefault(); onPick(item, kind); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: isMobile ? '10px 14px' : '8px 12px',
          minHeight: rowH,
          cursor: 'pointer',
          background: active ? 'rgba(0,199,178,0.10)' : 'transparent',
          borderLeft: `3px solid ${active ? BRAND.teal : 'transparent'}`,
          transition: 'background 80ms',
        }}
      >
        <div style={{
          width: isMobile ? 34 : 30, height: isMobile ? 34 : 30, borderRadius: 9,
          background: kind === 'flow' ? 'rgba(124,58,237,0.10)' : BRAND.tealSoft,
          color: kind === 'flow' ? '#7C3AED' : BRAND.tealDeep,
          display: 'grid', placeItems: 'center', flexShrink: 0,
          fontSize: 16,
        }}>
          {icon ? <span style={{ fontSize: isMobile ? 18 : 16, lineHeight: 1 }}>{icon}</span> : <Fallback size={15} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? 14 : 13, fontWeight: 600, color: BRAND.ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {item.name}
          </div>
          <div style={{
            fontSize: isMobile ? 12 : 11.5, color: BRAND.muted, lineHeight: 1.35,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {subtitle}
          </div>
        </div>
        {active && !isMobile && (
          <CornerDownLeft size={13} color={BRAND.tealDeep} style={{ opacity: 0.7, flexShrink: 0 }} />
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle} role="listbox" aria-label="Quick actions">
      {wf.length > 0 && (
        <>
          <SectionHeader label="Actions" count={wf.length} truncated={wfTruncated} />
          {wf.map((it) => <Row key={`wf-${it.id}`} item={it} kind="flow" />)}
        </>
      )}
      {ex.length > 0 && (
        <>
          <SectionHeader label="Experts" count={ex.length} truncated={exTruncated} />
          {ex.map((it) => <Row key={`ex-${it.id}`} item={it} kind="expert" />)}
        </>
      )}
      {!isMobile && (
        <div style={{
          padding: '6px 14px 8px', borderTop: '1px solid rgba(15,23,42,0.05)',
          fontSize: 10.5, color: BRAND.mutedSoft, display: 'flex', gap: 12,
        }}>
          <span><kbd style={kbd}>↑↓</kbd> navigate</span>
          <span><kbd style={kbd}>↵</kbd> send</span>
          <span><kbd style={kbd}>esc</kbd> cancel</span>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label, truncated }) {
  return (
    <div style={{
      padding: '8px 14px 4px',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      color: BRAND.mutedSoft, textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span>{label}</span>
      {truncated > 0 && (
        <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>
          +{truncated} more — keep typing
        </span>
      )}
    </div>
  );
}

const kbd = {
  display: 'inline-block', padding: '1px 5px', borderRadius: 4,
  background: 'rgba(15,23,42,0.06)', color: BRAND.inkSoft,
  fontSize: 10, fontFamily: 'inherit', fontWeight: 600,
  border: '1px solid rgba(15,23,42,0.08)',
};

// Helper exposed for the composer: how many visible items are in the menu
// for the current query (used for keyboard nav clamping).
export function visibleCount(workflows, experts, query) {
  const wf = rankItems(workflows || [], query, ['goal']).slice(0, SECTION_CAP);
  const ex = rankItems(experts || [], query, ['description']).slice(0, SECTION_CAP);
  return wf.length + ex.length;
}

// Helper: get the item at a flat index (used for keyboard Enter).
export function itemAt(workflows, experts, query, index) {
  const wf = rankItems(workflows || [], query, ['goal']).slice(0, SECTION_CAP);
  const ex = rankItems(experts || [], query, ['description']).slice(0, SECTION_CAP);
  if (index < wf.length) return { item: wf[index], kind: 'flow' };
  const j = index - wf.length;
  if (j < ex.length) return { item: ex[j], kind: 'expert' };
  return null;
}
