// Staffbase SourceAdapter — pulls signals from the live Staffbase REST API.
//
// Thin wrapper over lib/staffbase.mjs. Today api/navigator-setup.mjs::handleDiscover
// calls those same Staffbase functions inline; the eventual refactor moves
// the orchestration into lib/discovery/discover.mjs and consumes this adapter
// instead. For now this file exposes the gathering primitive so the team can
// see the contract and start porting.

import {
  listChannels, listRecentPosts, listUsers, getPost,
  listPages, listGroups, getUsersTotal, getBranch,
} from '../../staffbase.mjs';

/** @returns {import('../source-adapter.mjs').SourceAdapter} */
export function makeStaffbaseAdapter() {
  return {
    describe() {
      return { name: 'Staffbase intranet', kind: 'staffbase' };
    },

    async workspaceKey() {
      try {
        const branch = await getBranch();
        return branch?.id || null;
      } catch {
        return null;
      }
    },

    async gather() {
      const [channelsRaw, postsRaw, usersRaw, usersTotal, pagesRaw, groupsRaw] = await Promise.all([
        listChannels({ limit: 50 }),
        listRecentPosts({ limit: 50 }),
        listUsers({ limit: 200 }).catch(() => []),
        getUsersTotal().catch(() => null),
        listPages({ limit: 200 }).catch(() => []),
        listGroups({ limit: 50 }).catch(() => []),
      ]);

      // Engagement-ranked top posts; fetch full body for the top 10 so the
      // tone-inference pass has real corpus, not just teasers.
      const topPosts = [...postsRaw]
        .sort((a, b) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)))
        .slice(0, 20);
      const deepIds = topPosts.slice(0, 10).map((p) => p.id);
      const deepPosts = (await Promise.all(deepIds.map((id) => getPost(id).catch(() => null)))).filter(Boolean);

      const languageSet = new Set();
      for (const c of channelsRaw) for (const loc of (c.locales || [])) languageSet.add(loc);
      for (const p of pagesRaw) for (const loc of (p.locales || [])) languageSet.add(loc);

      return {
        channels: channelsRaw,
        posts: postsRaw,
        deepPosts,
        pages: pagesRaw,
        groups: groupsRaw,
        users: usersRaw,
        usersTotal,
        languages: [...languageSet],
      };
    },
  };
}
