import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from './cardStyles';
import { Avatar } from './UserCard';

export default function UserGrid({ title, users = [], source }) {
  if (!users.length) {
    return (
      <div style={cardShell}>
        <div style={cardHeader}>
          <div style={cardTitle}>{title || 'People'}</div>
          <div style={liveBadge}>Staffbase</div>
        </div>
        <div style={{ color: TEXT_MUTED, fontSize: 12, padding: '10px 0' }}>
          No teammates matched.
        </div>
      </div>
    );
  }
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{title || `People (${users.length})`}</div>
        <div style={liveBadge}>Staffbase</div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 10,
      }}>
        {users.slice(0, 24).map((u) => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 8, borderRadius: 10, background: '#F8FAFC',
            border: '1px solid #EEF2F7',
          }}>
            <Avatar user={u} size={36} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{u.name}</div>
              {u.title ? (
                <div style={{
                  fontSize: 10, color: TEXT_SECONDARY,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{u.title}</div>
              ) : null}
              {u.department ? (
                <div style={{
                  fontSize: 10, color: TEXT_MUTED,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{u.department}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
