import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  formatDate,
} from './cardStyles';
import { Avatar } from './UserCard';

export default function PostCard({ post, source }) {
  if (!post) return null;
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>Intranet post</div>
        <div style={liveBadge}>Staffbase</div>
      </div>
      {post.image ? (
        <div style={{
          marginBottom: 10, borderRadius: 10, overflow: 'hidden',
          aspectRatio: '16/7', background: '#F1F5F9',
        }}>
          <img src={post.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : null}
      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.3 }}>
        {post.title}
      </div>
      {post.channel?.title ? (
        <div style={{ marginTop: 4, display: 'inline-block', fontSize: 11, fontWeight: 600,
          color: STAFFBASE_TEAL_DEEP, background: '#D7F4F0', padding: '2px 8px', borderRadius: 999,
        }}>
          {post.channel.title}
        </div>
      ) : null}
      {post.author ? (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar user={post.author} size={24} />
          <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            {post.author.name || 'Author'}
            {post.published ? <span style={{ color: TEXT_MUTED }}> · {formatDate(post.published)}</span> : null}
          </div>
        </div>
      ) : null}
      {post.teaser ? (
        <div style={{ marginTop: 10, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
          {post.teaser}
        </div>
      ) : null}
      {post.body && post.body !== post.teaser ? (
        <div style={{
          marginTop: 10, padding: 10, background: '#F8FAFC', borderRadius: 8,
          fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.55,
          maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap',
        }}>
          {post.body.slice(0, 1200)}{post.body.length > 1200 ? '…' : ''}
        </div>
      ) : null}
      <div style={{ marginTop: 12, display: 'flex', gap: 14, fontSize: 12, color: TEXT_MUTED }}>
        {post.likes != null && <span>♡ {post.likes} likes</span>}
        {post.comments != null && <span>💬 {post.comments} comments</span>}
        {post.url ? (
          <a href={post.url} target="_blank" rel="noopener noreferrer"
             style={{ marginLeft: 'auto', color: STAFFBASE_TEAL_DEEP, textDecoration: 'none', fontWeight: 600 }}>
            Open in Campsite →
          </a>
        ) : null}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
