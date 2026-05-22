import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  formatDate,
} from './cardStyles';

export default function ArticleList({ title, articles = [], badge, source }) {
  if (!articles.length) {
    return (
      <div style={cardShell}>
        <div style={cardHeader}>
          <div style={cardTitle}>{title || 'Articles'}</div>
          <div style={liveBadge}>{badge || 'Intranet'}</div>
        </div>
        <div style={{ color: TEXT_MUTED, fontSize: 12, padding: '10px 0' }}>
          Nothing to show.
        </div>
      </div>
    );
  }
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{title || `Articles (${articles.length})`}</div>
        <div style={liveBadge}>{badge || 'Intranet'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {articles.slice(0, 15).map((a) => (
          <a
            key={a.id || a.url || a.title}
            href={a.url || undefined}
            target={a.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            style={{
              display: 'flex', gap: 10, padding: 8, borderRadius: 8,
              border: '1px solid #EEF2F7', background: '#FFFFFF',
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 8, flexShrink: 0,
              background: a.image ? `center/cover no-repeat url(${JSON.stringify(a.image)})` : '#F1F5F9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: '#CBD5E1',
            }}>
              {a.image ? null : '📰'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, lineHeight: 1.3,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {a.title || '(untitled)'}
              </div>
              {a.snippet || a.summary ? (
                <div style={{
                  fontSize: 11, color: TEXT_SECONDARY, marginTop: 2,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>{a.snippet || a.summary}</div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: TEXT_MUTED, marginTop: 4, flexWrap: 'wrap' }}>
                {a.category ? (
                  <span style={{ color: STAFFBASE_TEAL_DEEP, fontWeight: 600 }}>{a.category}</span>
                ) : null}
                {a.author ? <span>by {a.author}</span> : null}
                {a.publishedAt ? <span>{formatDate(a.publishedAt)}</span> : null}
              </div>
            </div>
          </a>
        ))}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
