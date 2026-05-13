import UserCard from './UserCard';
import UserGrid from './UserGrid';
import PostCard from './PostCard';
import PostList from './PostList';
import KpiGrid from './KpiGrid';
import LeaderboardCard from './LeaderboardCard';
import TimelineCard from './TimelineCard';
import CapabilitiesCard from './CapabilitiesCard';
import MixedCard from './MixedCard';

export default function CardRouter({ card, source }) {
  if (!card || !card.type) return null;
  switch (card.type) {
    case 'user':         return <UserCard user={card.user} source={source} />;
    case 'user_grid':    return <UserGrid title={card.title} users={card.users} source={source} />;
    case 'post':         return <PostCard post={card.post} source={source} />;
    case 'post_list':    return <PostList title={card.title} posts={card.posts} source={source} />;
    case 'kpi':          return <KpiGrid title={card.title} tiles={card.tiles} source={source} />;
    case 'leaderboard':  return <LeaderboardCard title={card.title} rows={card.rows} valueLabel={card.valueLabel} source={source} />;
    case 'timeline':     return <TimelineCard title={card.title} events={card.events} source={source} />;
    case 'capabilities': return <CapabilitiesCard title={card.title} categories={card.categories} source={source} />;
    case 'mixed':        return <MixedCard title={card.title} sections={card.sections} source={source} />;
    default:             return null;
  }
}
