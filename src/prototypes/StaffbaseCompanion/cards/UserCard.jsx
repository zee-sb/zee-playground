import { useState } from 'react';
import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  initials, avatarColor,
} from './cardStyles';

function Avatar({ user, size = 56 }) {
  const [failed, setFailed] = useState(false);
  const fontSize = Math.max(11, Math.floor(size * 0.32));
  const fallback = (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(user?.name || user?.id),
      color: '#1E293B', fontSize, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {initials(user?.name)}
    </div>
  );
  if (!user?.avatar || failed) return fallback;
  return (
    <img
      src={user.avatar}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: avatarColor(user?.name || user?.id) }}
    />
  );
}

export default function UserCard({ user, source }) {
  if (!user) return null;
  const customEntries = user.customFields ? Object.entries(user.customFields).slice(0, 6) : [];
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>Profile</div>
        <div style={liveBadge}>Staffbase</div>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Avatar user={user} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.2 }}>
            {user.name}
          </div>
          {user.title ? (
            <div style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>{user.title}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, color: TEXT_MUTED, fontSize: 12 }}>
            {user.department && <span>📁 {user.department}</span>}
            {user.location && <span>📍 {user.location}</span>}
            {user.email && <span>✉ {user.email}</span>}
          </div>
          {user.manager?.managerName ? (
            <div style={{ marginTop: 10, padding: '6px 10px', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8, fontSize: 12, color: TEXT_SECONDARY }}>
              Reports to <strong style={{ color: TEXT_PRIMARY }}>{user.manager.managerName}</strong>
              {user.manager.managerEmail ? <span style={{ color: TEXT_MUTED }}> · {user.manager.managerEmail}</span> : null}
            </div>
          ) : null}
          {customEntries.length ? (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {customEntries.map(([k, v]) => (
                <span key={k} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 6,
                  background: '#F1F5F9', color: TEXT_SECONDARY, border: '1px solid #E2E8F0',
                }}>
                  <strong style={{ color: STAFFBASE_TEAL_DEEP }}>{k}:</strong> {String(v).slice(0, 36)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}

export { Avatar };
