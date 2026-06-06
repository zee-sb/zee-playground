import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  formatDate,
} from './cardStyles';

export default function PageList({ title, pages = [], source }) {
  if (!pages.length) {
    return (
      <div style={cardShell}>
        <div style={cardHeader}>
          <div style={cardTitle}>{title || 'Pages'}</div>
          <div style={liveBadge}>Confluence</div>
        </div>
        <div style={{ color: TEXT_MUTED, fontSize: 12, padding: '10px 0' }}>
          No matching pages.
        </div>
      </div>
    );
  }
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{title || `Pages (${pages.length})`}</div>
        <div style={liveBadge}>Confluence</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pages.slice(0, 15).map((p) => (
          <a
            key={p.id}
            href={p.url || undefined}
            target={p.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '8px 10px', borderRadius: 8,
              border: '1px solid #EEF2F7', background: '#FFFFFF',
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <div style={{
              fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {p.title || '(untitled)'}
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: TEXT_MUTED, flexWrap: 'wrap' }}>
              {p.spaceName ? (
                <span style={{ color: STAFFBASE_TEAL_DEEP, fontWeight: 600 }}>{p.spaceName}</span>
              ) : (p.spaceId ? <span>Space {p.spaceId}</span> : null)}
              {p.createdAt ? <span>{formatDate(p.createdAt)}</span> : null}
              {p.status && p.status !== 'current' ? <span>({p.status})</span> : null}
            </div>
          </a>
        ))}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
