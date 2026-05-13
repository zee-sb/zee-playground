import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  TEXT_PRIMARY,
} from './cardStyles';
import UserGrid from './UserGrid';
import PostList from './PostList';
import LeaderboardCard from './LeaderboardCard';

export default function MixedCard({ title, sections = [], source }) {
  if (!sections.length) return null;
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{title || 'Results'}</div>
        <div style={liveBadge}>Staffbase</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sections.map((s, i) => (
          <div key={i}>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_PRIMARY, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '6px 2px' }}>
              {s.title}
            </div>
            {s.kind === 'post_list' && <PostList title="" posts={s.posts} />}
            {s.kind === 'user_grid' && <UserGrid title="" users={s.users} />}
            {s.kind === 'leaderboard' && <LeaderboardCard title="" rows={s.rows} valueLabel={s.valueLabel} />}
          </div>
        ))}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
