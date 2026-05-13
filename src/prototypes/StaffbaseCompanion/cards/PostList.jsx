import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  formatDate,
} from './cardStyles';

export default function PostList({ title, posts = [], source }) {
  if (!posts.length) {
    return (
      <div style={cardShell}>
        <div style={cardHeader}>
          <div style={cardTitle}>{title || 'Posts'}</div>
          <div style={liveBadge}>Staffbase</div>
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
        <div style={cardTitle}>{title || `Posts (${posts.length})`}</div>
        <div style={liveBadge}>Staffbase</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {posts.slice(0, 15).map((p) => (
          <div key={p.id} style={{
            display: 'flex', gap: 10, padding: 8, borderRadius: 8,
            border: '1px solid #EEF2F7', background: '#FFFFFF',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 8, flexShrink: 0,
              background: p.image ? `center/cover no-repeat url(${JSON.stringify(p.image)})` : '#F1F5F9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: '#CBD5E1',
            }}>
              {p.image ? null : '📰'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY,
                lineHeight: 1.3,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {p.title}
              </div>
              {p.teaser ? (
                <div style={{
                  fontSize: 11, color: TEXT_SECONDARY, marginTop: 2,
                  display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>{p.teaser}</div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: TEXT_MUTED, marginTop: 4, flexWrap: 'wrap' }}>
                {p.channel?.title && (
                  <span style={{ color: STAFFBASE_TEAL_DEEP, fontWeight: 600 }}>{p.channel.title}</span>
                )}
                {p.author?.name && <span>by {p.author.name}</span>}
                {p.published && <span>{formatDate(p.published)}</span>}
                {p.likes != null && <span>♡ {p.likes}</span>}
                {p.comments != null && <span>💬 {p.comments}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
