import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from './cardStyles';

export default function LeaderboardCard({ title, rows = [], valueLabel = '', source }) {
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{title || 'Top items'}</div>
        <div style={liveBadge}>Staffbase</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.slice(0, 12).map((r, i) => {
          const v = Number(r.value) || 0;
          const pct = Math.max(2, Math.round((v / max) * 100));
          return (
            <div key={r.id || i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
              borderRadius: 8, background: i === 0 ? '#FBFCFE' : '#FFFFFF',
              border: '1px solid #EEF2F7',
            }}>
              <div style={{ width: 22, fontSize: 11, color: TEXT_MUTED, fontWeight: 600 }}>
                #{i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{r.label}</div>
                <div style={{ position: 'relative', height: 4, background: '#F1F5F9', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${pct}%`, background: STAFFBASE_TEAL, borderRadius: 3,
                  }} />
                </div>
                {r.sublabel ? (
                  <div style={{
                    fontSize: 10, color: TEXT_MUTED, marginTop: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.sublabel}</div>
                ) : null}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_SECONDARY, whiteSpace: 'nowrap' }}>
                {v.toLocaleString()}{valueLabel ? <span style={{ color: TEXT_MUTED, fontWeight: 500, fontSize: 10 }}> {valueLabel}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
