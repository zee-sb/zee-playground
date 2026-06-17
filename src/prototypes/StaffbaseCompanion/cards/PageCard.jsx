import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  formatDate,
} from './cardStyles';

export default function PageCard({ page, source }) {
  if (!page) return null;
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>Confluence page</div>
        <div style={liveBadge}>Confluence</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.3 }}>
        {page.title || '(untitled)'}
      </div>
      <div style={{ marginTop: 4, display: 'flex', gap: 10, fontSize: 11, color: TEXT_MUTED, flexWrap: 'wrap' }}>
        {page.spaceName ? (
          <span style={{ color: STAFFBASE_TEAL_DEEP, fontWeight: 600 }}>{page.spaceName}</span>
        ) : (page.spaceId ? <span>Space {page.spaceId}</span> : null)}
        {page.createdAt ? <span>{formatDate(page.createdAt)}</span> : null}
        {page.version != null ? <span>v{page.version}</span> : null}
      </div>
      {page.excerpt ? (
        <div style={{
          marginTop: 10, padding: 10, background: '#F8FAFC', borderRadius: 8,
          fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.55,
          maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap',
        }}>
          {page.excerpt.slice(0, 1200)}{page.excerpt.length > 1200 ? '…' : ''}
        </div>
      ) : null}
      <div style={{ marginTop: 12, display: 'flex', gap: 14, fontSize: 12, color: TEXT_MUTED }}>
        {page.url ? (
          <a href={page.url} target="_blank" rel="noopener noreferrer"
             style={{ marginLeft: 'auto', color: STAFFBASE_TEAL_DEEP, textDecoration: 'none', fontWeight: 600 }}>
            Open in Confluence →
          </a>
        ) : null}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
