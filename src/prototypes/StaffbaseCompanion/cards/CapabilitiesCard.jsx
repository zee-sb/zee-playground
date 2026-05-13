import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL, STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from './cardStyles';

export default function CapabilitiesCard({ title, categories = [], source }) {
  if (!categories.length) return null;
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{title || 'What you can ask Staffbase'}</div>
        <div style={liveBadge}>Staffbase</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {categories.map((cat) => (
          <div key={cat.category} style={{
            padding: 10, borderRadius: 10, background: '#FBFEFE',
            border: '1px solid #D7F4F0',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: STAFFBASE_TEAL,
              }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: STAFFBASE_TEAL_DEEP, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {cat.category}
              </div>
            </div>
            {cat.description ? (
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
                {cat.description}
              </div>
            ) : null}
            {cat.examples?.length ? (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cat.examples.map((ex) => (
                  <span key={ex} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 999,
                    background: '#FFFFFF', color: TEXT_PRIMARY, border: '1px solid #D7F4F0',
                  }}>
                    {ex}
                  </span>
                ))}
              </div>
            ) : null}
            {cat.tools?.length ? (
              <div style={{ marginTop: 6, fontSize: 10, color: TEXT_MUTED, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                {cat.tools.join(' · ')}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
