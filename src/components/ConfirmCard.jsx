// Shared confirm card. Renders a labelled-row summary plus Confirm/Cancel
// buttons. Used for flow "confirm" steps and any other pre-commit review.

import React from 'react';
import { CheckCircle, Loader2, ShieldCheck } from 'lucide-react';
import {
  STAFFBASE_TEAL, NEUTRAL_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from '../prototypes/StaffbaseCompanion/cards/cardStyles.js';

const THEMES = {
  teal: { accent: STAFFBASE_TEAL, accentBg: 'rgba(0, 199, 178, 0.08)' },
  purple: { accent: '#7C3AED', accentBg: '#EDE9FE' },
  neutral: { accent: '#0F172A', accentBg: '#F1F5F9' },
};

export default function ConfirmCard({
  summary,
  busy = false,
  onConfirm,
  onCancel,
  theme = 'teal',
  confirmed = false,
  declined = false,
}) {
  const palette = THEMES[theme] || THEMES.teal;
  const title = summary?.title || 'Confirm';
  const rows = summary?.rows || [];

  if (confirmed) {
    return (
      <div style={shellStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={18} color={palette.accent} />
          <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>Confirmed</span>
        </div>
      </div>
    );
  }
  if (declined) {
    return (
      <div style={shellStyle}>
        <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>Cancelled — let's adjust the details.</div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: rows.length ? 10 : 0 }}>
        <ShieldCheck size={16} color={palette.accent} />
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{title}</div>
      </div>

      {summary?.description && (
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 10, lineHeight: 1.4 }}>
          {summary.description}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{
          border: `1px solid ${NEUTRAL_BORDER}`, borderRadius: 8,
          background: palette.accentBg, padding: 10, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
              <div style={{
                color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.04em',
                fontSize: 10, fontWeight: 700, minWidth: 80,
              }}>{row.label}</div>
              <div style={{ color: TEXT_PRIMARY, fontWeight: 500, flex: 1, wordBreak: 'break-word' }}>
                {row.value || <span style={{ color: TEXT_MUTED }}>—</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          style={{
            padding: '8px 14px', borderRadius: 8,
            border: `1px solid ${NEUTRAL_BORDER}`, background: '#FFFFFF',
            color: TEXT_SECONDARY, fontSize: 12.5, fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {summary?.cancelLabel || 'Cancel'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          style={{
            padding: '8px 14px', borderRadius: 8,
            border: 'none', background: palette.accent, color: 'white',
            fontSize: 12.5, fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.7 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          {busy && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          {summary?.confirmLabel || 'Confirm'}
        </button>
      </div>
    </div>
  );
}

const shellStyle = {
  margin: '8px 0', padding: 14, background: '#FFFFFF',
  border: `1px solid ${NEUTRAL_BORDER}`, borderRadius: 12,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};
