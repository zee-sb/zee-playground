import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from './cardStyles';

export default function KpiGrid({ title, tiles = [], source }) {
  if (!tiles.length) return null;
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{title || 'Headline KPIs'}</div>
        <div style={liveBadge}>Staffbase</div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(tiles.length, 4)}, 1fr)`,
        gap: 10,
      }}>
        {tiles.map((t, i) => (
          <div key={i} style={{
            padding: 12, borderRadius: 10, background: '#F8FAFC',
            border: '1px solid #EEF2F7',
            display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
          }}>
            <div style={{ fontSize: 11, color: TEXT_SECONDARY, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1 }}>
              {t.value}
            </div>
            {t.delta != null ? (
              <div style={{
                fontSize: 11, fontWeight: 600,
                color: t.delta >= 0 ? STAFFBASE_TEAL_DEEP : '#B91C1C',
              }}>
                {t.delta >= 0 ? '▲' : '▼'} {Math.abs(t.delta)}{t.deltaSuffix || '%'}
              </div>
            ) : null}
            {t.sublabel ? (
              <div style={{ fontSize: 10, color: TEXT_MUTED }}>{t.sublabel}</div>
            ) : null}
          </div>
        ))}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
