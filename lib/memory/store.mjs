// DB layer for per-user memory (user_memory) and the briefing cache
// (user_briefing). All reads are scoped by user_id; branch is denormalized for
// tenant-wide wipes. Every function is defensive — a memory failure must never
// break a chat turn.

import { sql, dbConfigured } from '../db.mjs';

// Read memories for a user, best-first. Ordering encodes trust + recency:
// kind priority (profile > open_item > preference > fact) then last_seen desc,
// confidence desc. Filters out expired items. Returns flat rows.
export async function getMemoriesForUser(userId, { kinds = null, limit = 40 } = {}) {
  if (!userId || !dbConfigured()) return [];
  try {
    const rows = kinds && kinds.length
      ? await sql`
          select kind, mem_key, mem_value, source, confidence, status, last_seen_at, expires_at
          from user_memory
          where user_id = ${userId}
            and kind = any(${kinds})
            and (status is null or status <> 'expired')
            and (expires_at is null or expires_at > now())
          order by
            case kind when 'profile' then 0 when 'open_item' then 1 when 'preference' then 2 else 3 end,
            last_seen_at desc, confidence desc
          limit ${limit}`
      : await sql`
          select kind, mem_key, mem_value, source, confidence, status, last_seen_at, expires_at
          from user_memory
          where user_id = ${userId}
            and (status is null or status <> 'expired')
            and (expires_at is null or expires_at > now())
          order by
            case kind when 'profile' then 0 when 'open_item' then 1 when 'preference' then 2 else 3 end,
            last_seen_at desc, confidence desc
          limit ${limit}`;
    return rows;
  } catch (e) {
    console.warn('[memory] getMemoriesForUser:', e.message);
    return [];
  }
}

// Shape flat rows into the grouped object buildSystemPrompt expects.
export async function loadUserMemory(userId) {
  const rows = await getMemoriesForUser(userId, { limit: 40 });
  if (!rows.length) return null;
  const group = (k) => rows.filter((r) => r.kind === k)
    .map((r) => ({ key: r.mem_key, value: r.mem_value, confidence: r.confidence, status: r.status }));
  return {
    profile: group('profile'),
    openItems: group('open_item').filter((o) => o.status !== 'resolved'),
    preferences: group('preference'),
    facts: group('fact'),
  };
}

// UPSERT one memory item on (user_id, kind, mem_key). Bumps last_seen_at.
export async function upsertMemory(userId, branchId, item) {
  if (!userId || !dbConfigured() || !item?.kind || !item?.mem_key) return;
  const {
    kind, mem_key, mem_value = '', source = 'conversation', source_ref = null,
    confidence = 0.6, status = null, expires_at = null,
  } = item;
  try {
    await sql`
      insert into user_memory
        (user_id, staffbase_branch_id, kind, mem_key, mem_value, source, source_ref, confidence, status, expires_at)
      values
        (${userId}, ${branchId || '*'}, ${kind}, ${mem_key}, ${mem_value}, ${source}, ${source_ref}, ${confidence}, ${status}, ${expires_at})
      on conflict (user_id, kind, mem_key) do update set
        mem_value = excluded.mem_value,
        source = excluded.source,
        source_ref = coalesce(excluded.source_ref, user_memory.source_ref),
        confidence = greatest(user_memory.confidence, excluded.confidence),
        status = coalesce(excluded.status, user_memory.status),
        expires_at = excluded.expires_at,
        last_seen_at = now(),
        updated_at = now()`;
  } catch (e) {
    console.warn('[memory] upsertMemory:', e.message);
  }
}

export async function upsertMemories(userId, branchId, items) {
  for (const item of items || []) {
    // eslint-disable-next-line no-await-in-loop
    await upsertMemory(userId, branchId, item);
  }
}

// Flip a matching open_item to resolved (e.g. when a conversation resolves).
export async function resolveOpenItem(userId, memKey) {
  if (!userId || !dbConfigured()) return;
  try {
    await sql`
      update user_memory set status = 'resolved', updated_at = now(), last_seen_at = now()
      where user_id = ${userId} and kind = 'open_item' and mem_key = ${memKey}`;
  } catch (e) {
    console.warn('[memory] resolveOpenItem:', e.message);
  }
}

// Right-to-forget: wipe one user's memory (and their cached briefing).
export async function wipeUserMemory(userId) {
  if (!userId || !dbConfigured()) return;
  try {
    await sql`delete from user_memory where user_id = ${userId}`;
    await sql`delete from user_briefing where user_id = ${userId}`;
  } catch (e) {
    console.warn('[memory] wipeUserMemory:', e.message);
  }
}

// ── Briefing cache ───────────────────────────────────────────────────────────
export async function getBriefingCache(userId) {
  if (!userId || !dbConfigured()) return null;
  try {
    const rows = await sql`select cards, source, computed_at from user_briefing where user_id = ${userId} limit 1`;
    return rows[0] || null;
  } catch (e) {
    console.warn('[memory] getBriefingCache:', e.message);
    return null;
  }
}

export async function saveBriefingCache(userId, branchId, cards, source = 'live') {
  if (!userId || !dbConfigured()) return;
  try {
    await sql`
      insert into user_briefing (user_id, staffbase_branch_id, cards, source, computed_at)
      values (${userId}, ${branchId || '*'}, ${JSON.stringify(cards)}::jsonb, ${source}, now())
      on conflict (user_id) do update set
        cards = excluded.cards, source = excluded.source,
        staffbase_branch_id = excluded.staffbase_branch_id, computed_at = now()`;
  } catch (e) {
    console.warn('[memory] saveBriefingCache:', e.message);
  }
}
