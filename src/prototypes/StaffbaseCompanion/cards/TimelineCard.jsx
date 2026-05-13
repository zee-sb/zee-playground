import { useState } from 'react';
import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  timeAgo, initials, avatarColor,
} from './cardStyles';

function TimelineAvatar({ avatar, title, icon, iconText }) {
  const [failed, setFailed] = useState(false);
  const fallbackBg = avatarColor(title || avatar || icon || 'event');
  const showText = title ? initials(title) : iconText || '•';
  if (!avatar || failed) {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: fallbackBg,
        color: '#1E293B', fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {showText}
      </div>
    );
  }
  return (
    <img src={avatar} alt="" onError={() => setFailed(true)} style={{
      width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: fallbackBg,
    }} />
  );
}

const ICON = {
  comment: '💬',
  reply: '↪',
  campaign: '📅',
  event: '•',
};

export default function TimelineCard({ title, events = [], source }) {
  if (!events.length) {
    return (
      <div style={cardShell}>
        <div style={cardHeader}>
          <div style={cardTitle}>{title || 'Timeline'}</div>
          <div style={liveBadge}>Staffbase</div>
        </div>
        <div style={{ color: TEXT_MUTED, fontSize: 12, padding: '10px 0' }}>
          No events to show.
        </div>
      </div>
    );
  }
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{title || `Timeline (${events.length})`}</div>
        <div style={liveBadge}>Staffbase</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.slice(0, 25).map((e) => (
          <div key={e.id} style={{ display: 'flex', gap: 10 }}>
            <TimelineAvatar avatar={e.avatar} title={e.title} icon={e.icon} iconText={ICON[e.icon] || '•'} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY }}>
                  {e.icon && ICON[e.icon] ? <span style={{ marginRight: 4 }}>{ICON[e.icon]}</span> : null}
                  {e.title}
                </div>
                {e.when ? <div style={{ fontSize: 10, color: TEXT_MUTED }}>{timeAgo(e.when)}</div> : null}
              </div>
              {e.detail ? (
                <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {e.detail}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
