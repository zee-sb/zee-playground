// Navigator Setup — Deep workspace discovery.
//
// GET /api/navigator-setup?action=discover
//   Multi-signal pass against the live Staffbase instance:
//     1. Channels (titles + locales)
//     2. Recent posts (50) ranked by engagement
//     3. Full content of the top 3 posts
//     4. User directory (departments, locations, custom fields)
//   Then two LLM passes:
//     A. Workspace overview + glossary + Main Navigator instructions
//        (top-level orchestrator system prompt for the whole assistant suite)
//     B. Assistant proposal — universal Assistants (HR, IT, etc.) when
//        signals warrant + cluster-derived Assistants. Each Assistant gets
//        a thorough, workspace-grounded system prompt.
//
// GET /api/navigator-setup?action=search-preview&query=<term>
//   Thin pass-through to searchPosts for the gap-detection widget.

import { createAIClient } from '../lib/ai-client.mjs';
import {
  listChannels, listRecentPosts, listUsers, searchPosts, getPost,
  listPages, listGroups, getUsersTotal, getBranch,
  withStaffbaseContext,
} from '../lib/staffbase.mjs';
import { getBlueprint, saveBlueprint, patchBlueprintField, listExperts } from '../lib/blueprints.mjs';
import { getConfig as getNavigatorConfig } from '../lib/workspace-config.mjs';
import { embed } from '../lib/embeddings.mjs';
import { dbConfigured } from '../lib/db.mjs';
import { loadPrompt as loadDiscoveryPrompt } from '../lib/discovery/load-prompt.mjs';
import { resolveBranchId, getTenantContext } from '../lib/tenants.mjs';

const ALLOWED_ICONS = [
  'Sparkles', 'HeartHandshake', 'Briefcase', 'Megaphone', 'Wrench',
  'GraduationCap', 'Users', 'Building2', 'Newspaper', 'ShieldCheck',
  'Calendar', 'Hash', 'Plane', 'Globe', 'Lightbulb', 'BookOpen',
  'TrendingUp', 'Award', 'Coffee', 'Heart',
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');
    // Resolve the active tenant (gallery picker → ?branch=) and run the rest
    // of the request inside its credential frame.
    const branchId = await resolveBranchId(req);
    const tenantCtx = branchId ? await getTenantContext(branchId) : null;
    if (branchId && !tenantCtx) {
      return res.status(404).json({ error: 'tenant_not_found', code: 'tenant_not_found' });
    }
    // Without a registered tenant we fall through to the legacy env-var path
    // (staffbase.mjs's AsyncLocalStorage fallback) so the first-run setup
    // wizard can still discover before the tenant table is populated.
    const dispatch = async () => {
      if (action === 'load') return await handleLoad(req, res);
      if (action === 'discover') return await handleDiscover(req, res, tenantCtx);
      if (action === 'search-preview') return await handleSearchPreview(req, res, url);
      if (action === 'match-pages') return await handleMatchPages(req, res, url);
      if (action === 'update-main-instructions') return await handleUpdateMainInstructions(req, res);
      if (action === 'optimize-main-instructions') return await handleOptimizeMainInstructions(req, res);
      res.status(400).json({ error: 'unknown action — expected load | discover | search-preview | match-pages | update-main-instructions | optimize-main-instructions' });
    };
    if (tenantCtx) {
      return await withStaffbaseContext(tenantCtx, dispatch);
    }
    return await dispatch();
  } catch (err) {
    const isAuthErr = /STAFFBASE_API_TOKEN is not configured/.test(err.message || '');
    res.status(isAuthErr ? 503 : 500).json({
      error: err.message || 'unknown error',
      code: isAuthErr ? 'staffbase_token_missing' : 'internal',
    });
  }
}

// ── load ───────────────────────────────────────────────────────────────────
//
// Return the cached blueprint for the current branch without re-running any
// discovery. Used on every Setup page mount so the customer sees their
// existing analysis instantly. Re-running is gated behind an explicit
// "Re-discover" button that hits ?action=discover.

async function handleLoad(_req, res) {
  if (!dbConfigured()) {
    return res.status(503).json({ error: 'database_not_configured', code: 'db_missing' });
  }
  const branch = await getBranch();
  if (!branch?.id) {
    return res.status(503).json({ error: 'branch_unavailable', code: 'staffbase_branch_missing' });
  }
  const row = await getBlueprint(branch.id);
  if (!row) {
    return res.status(204).end(); // no cached discovery yet
  }
  return res.status(200).json({
    cached: true,
    branchId: row.staffbase_branch_id,
    branchName: row.staffbase_branch_name,
    discoveredAt: row.discovered_at,
    blueprint: row.blueprint,
  });
}

// ── match-pages ────────────────────────────────────────────────────────────
//
// Rank cached Pages by similarity to a topic description. Used by the
// Templates gallery (template description as topic) and the AI Creator
// (customer's natural-language description as topic). Doesn't touch the
// LLM — just embed the topic and run cosine sim against the cached page
// embeddings written during discovery.

async function handleMatchPages(req, res, url) {
  const topic = url.searchParams.get('topic') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 20);
  if (!topic.trim()) {
    return res.status(400).json({ error: 'topic is required' });
  }
  const branch = await getBranch();
  const row = await getBlueprint(branch.id);
  if (!row) {
    return res.status(404).json({ error: 'no_blueprint', code: 'discovery_required' });
  }
  const pageEmbeds = row.page_embeddings || [];
  if (pageEmbeds.length === 0) {
    return res.status(200).json({ topic, results: [] });
  }
  const [topicVec] = await embed([topic]);
  const { rankByTopic } = await import('../lib/embeddings.mjs');
  const ranked = rankByTopic(topicVec, pageEmbeds.map((p) => ({ id: p.pageId, vec: p.vector })), limit);
  const pageById = new Map((row.blueprint.pages || []).map((p) => [p.id, p]));
  return res.status(200).json({
    topic,
    results: ranked.map((r) => ({
      page: pageById.get(r.id) || { id: r.id },
      score: r.score,
    })),
  });
}

// ── discover ───────────────────────────────────────────────────────────────

const ALLOWED_AUDIENCE_KINDS = [
  'internal_employees', 'external_event', 'customer_community',
  'frontline_workforce', 'partner_portal', 'alumni', 'mixed', 'other',
];

function normalizeAudienceOverride(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = ALLOWED_AUDIENCE_KINDS.includes(raw.kind) ? raw.kind : null;
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : null;
  if (!kind && !label) return null;
  return {
    kind: kind || 'mixed',
    label: label || 'workspace members',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
  };
}

async function handleDiscover(req, res, tenantCtx) {
  // Look up the Staffbase branch ID first — this is the persistence key.
  // Best-effort: if the branch lookup fails (e.g. token mis-scoped), we
  // continue without persistence and return the result in-memory only.
  const branch = await getBranch().catch((err) => {
    console.warn('[navigator-setup] getBranch failed, skipping persistence:', err.message);
    return null;
  });

  // Optional admin-supplied audience override. Accepts a request body of
  // shape { audienceOverride: { kind, label, summary? } }. If present, the
  // LLM is instructed to use it verbatim instead of inferring.
  let audienceOverride = null;
  try {
    const body = await readJsonBody(req);
    audienceOverride = normalizeAudienceOverride(body?.audienceOverride);
  } catch {}

  // Parallel pull of all primary signals + any existing Navigator config
  // for this branch so re-discovery can avoid proposing duplicates.
  const [channelsRaw, postsRaw, usersRaw, usersTotal, pagesRaw, groupsRaw, existingExperts, existingConfig] = await Promise.all([
    listChannels({ limit: 50 }),
    listRecentPosts({ limit: 50 }),
    listUsers({ limit: 200 }).catch(() => []),
    getUsersTotal().catch(() => null),
    listPages({ limit: 200 }).catch(() => []),
    listGroups({ limit: 50 }).catch(() => []),
    branch?.id ? listExperts(branch.id).catch(() => []) : Promise.resolve([]),
    branch?.id ? getNavigatorConfig(branch.id).catch(() => null) : Promise.resolve(null),
  ]);

  // Summarise existing assistants + connectors so Pass B can avoid duplicate
  // proposals. Only non-archived experts count as "already covered".
  const activeExperts = (existingExperts || []).filter((e) => e.status !== 'archived');
  const existingCoverage = {
    experts: activeExperts.map((e) => ({
      name: e.name,
      description: e.description || '',
      instructions: (e.instructions || '').slice(0, 400),
    })),
    connections: ((existingConfig?.connections) || []).map((c) => ({
      name: c.name || c.id,
      kind: c.kind,
    })),
  };

  // ── Channels: keep the API-provided real postCount and lastPostPublishedAt
  // (the previous "sampled" count is kept under sampledPostCount for backward
  // compat with the UI, but we now prefer the authoritative number).
  const countsByChannel = new Map();
  for (const p of postsRaw) {
    if (!p.channel?.id) continue;
    countsByChannel.set(p.channel.id, (countsByChannel.get(p.channel.id) || 0) + 1);
  }
  const channels = channelsRaw.map((c) => ({
    ...c,
    sampledPostCount: c.postCount ?? (countsByChannel.get(c.id) || 0),
  }));

  // ── Posts ranked by engagement.
  const topPosts = [...postsRaw]
    .sort((a, b) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)))
    .slice(0, 20);
  const recentPosts = postsRaw.slice(0, 20);

  // ── Deep-content sample: full body for the top 10 posts so the LLM has
  // a meaningful corpus of employee-reading material to infer tone, internal
  // acronyms, and topic depth. (3 posts was too thin for any real signal.)
  const deepPostIds = topPosts.slice(0, 10).map((p) => p.id);
  const deepPosts = await Promise.all(
    deepPostIds.map((id) => getPost(id).catch(() => null))
  ).then((arr) => arr.filter(Boolean));

  // ── Pages: a separate, deeper knowledge surface — reference docs, policies,
  // hubs. Sorted by recency. Body excerpts are richer than post teasers.
  const pages = (pagesRaw || []).sort((a, b) => {
    const da = new Date(a.published || 0).getTime();
    const db = new Date(b.published || 0).getTime();
    return db - da;
  });

  // ── Groups: feature opt-ins + org segmentation. Heuristic split: titles
  // starting with "Dep." are department mirrors; the rest are programs/ERGs.
  const groups = (groupsRaw || []).map((g) => ({
    ...g,
    isDepartmentGroup: /^Dep\.?\s/i.test(g.name) || /^Department/i.test(g.name),
  }));

  // ── Languages: union of locales across channels + pages.
  const languageSet = new Set();
  for (const c of channels) for (const loc of (c.locales || [])) languageSet.add(loc);
  for (const p of pages) for (const loc of (p.locales || [])) languageSet.add(loc);
  const languages = [...languageSet];

  // ── Org signals from the user directory + group hints. We display the
  // real workspace-wide total (`usersTotal`) and use the sample only for
  // distribution analysis.
  const orgSignals = summariseUsers(usersRaw, postsRaw, { usersTotal, groups });

  // ── Pass A: workspace overview + glossary + main instructions.
  let workspace = null;
  let openAiUsed = false;
  let fallbackReason = null;
  try {
    workspace = await passAWorkspace({
      channels, topPosts, deepPosts, orgSignals, languages, pages, groups, audienceOverride,
    });
    openAiUsed = true;
  } catch (err) {
    fallbackReason = `workspace_pass: ${err.message || 'failed'}`;
    workspace = buildFallbackWorkspace({ channels, orgSignals, languages, audienceOverride });
  }

  // ── Pass B: Assistant proposal — clusters + always-include universals.
  // We pass the tenant's baseUrl so workspace links resolve to *this* tenant's
  // intranet (not the env-var default).
  const tenantBaseUrl = tenantCtx?.baseUrl || process.env.STAFFBASE_API_BASE || 'https://campsite.staffbase.com/api';
  let assistantsResult = null;
  try {
    assistantsResult = await passBAssistants({
      channels, topPosts, deepPosts, orgSignals, languages, workspace, pages, groups, baseApiUrl: tenantBaseUrl,
      existingCoverage,
    });
  } catch (err) {
    fallbackReason = (fallbackReason ? fallbackReason + '; ' : '') + `assistant_pass: ${err.message || 'failed'}`;
    assistantsResult = buildFallbackAssistants({ channels, orgSignals, baseApiUrl: tenantBaseUrl, audience: workspace?.audience, existingCoverage });
  }

  // ── Page embeddings — written alongside the blueprint so Templates and
  // the AI Creator can rank pages by relevance to a topic without re-
  // fetching the source content. Best-effort: if embedding fails we still
  // persist the blueprint, just with an empty embeddings array.
  let pageEmbeddings = [];
  if (pages.length > 0) {
    try {
      const texts = pages.map((p) => `${p.title || ''}\n\n${(p.bodyExcerpt || '').slice(0, 4000)}`);
      const vectors = await embed(texts);
      pageEmbeddings = pages.map((p, i) => ({ pageId: p.id, vector: vectors[i] || null }))
        .filter((e) => Array.isArray(e.vector) && e.vector.length > 0);
    } catch (err) {
      console.warn('[navigator-setup] page embedding failed:', err.message);
    }
  }

  const meta = {
    openAiUsed,
    fallbackReason,
    postsAnalyzed: postsRaw.length,
    usersAnalyzed: usersRaw.length,
    usersTotal,
    pagesAnalyzed: pages.length,
    pagesEmbedded: pageEmbeddings.length,
    groupsAnalyzed: groups.length,
    deepPostsFetched: deepPosts.length,
    persisted: Boolean(branch?.id && dbConfigured() && pageEmbeddings),
    existingCoverage: {
      expertCount: existingCoverage.experts.length,
      connectionCount: existingCoverage.connections.length,
      expertNames: existingCoverage.experts.map((e) => e.name),
    },
  };

  const blueprintPayload = {
    channels,
    topPosts,
    recentPosts,
    deepPosts: deepPosts.map((p) => ({ id: p.id, title: p.title, contentLength: (p.content || '').length })),
    pages: pages.map((p) => ({
      id: p.id, title: p.title, description: p.description,
      published: p.published, bodyExcerpt: p.bodyExcerpt, bodyLength: p.bodyLength,
      locales: p.locales,
    })),
    groups,
    orgSignals,
    languages,
    workspace,
    topicClusters: assistantsResult.topicClusters,
    proposedAssistants: assistantsResult.proposedAssistants,
    branch: branch ? { id: branch.id, name: branch.name, slug: branch.slug } : null,
    meta,
  };

  // Persist to workspace_blueprints — best-effort. If the DB is unreachable
  // or the branch lookup failed, we still return the blueprint in-memory so
  // the customer's UX isn't broken; they just won't get the cache hit next
  // page load.
  let discoveredAt = new Date().toISOString();
  if (branch?.id && dbConfigured()) {
    try {
      const saved = await saveBlueprint({
        branchId: branch.id,
        branchName: branch.name,
        blueprint: blueprintPayload,
        pageEmbeddings,
        userId: null,
      });
      discoveredAt = saved?.discovered_at || discoveredAt;
    } catch (err) {
      console.warn('[navigator-setup] saveBlueprint failed:', err.message);
    }
  }

  res.status(200).json({
    cached: false,
    branchId: branch?.id || null,
    branchName: branch?.name || null,
    discoveredAt,
    // Spread the full blueprint payload for backward-compat with the existing
    // frontend (which expects channels/topPosts/etc. at the top level).
    // `meta` rides along inside `blueprintPayload`.
    ...blueprintPayload,
  });
}

// ── User directory summary ─────────────────────────────────────────────────

function summariseUsers(users, posts, { usersTotal, groups } = {}) {
  if (!users.length) {
    return {
      totalUsers: usersTotal ?? 0,
      sampledUsers: 0,
      departments: [],
      locations: [],
      customFieldKeys: [],
      titleValues: [],
      customFieldValues: {},
      topAuthors: [],
    };
  }
  const deptCounts = new Map();
  const locCounts = new Map();
  const customKeys = new Set();
  // titleValues: dedup by lowercased key, but keep the first-seen casing for display.
  const titleByKey = new Map();
  // customFieldValues: per-field map of lowercased-value → { value (display), count }.
  const cfValues = new Map();
  for (const u of users) {
    if (u.department) deptCounts.set(u.department, (deptCounts.get(u.department) || 0) + 1);
    if (u.location) locCounts.set(u.location, (locCounts.get(u.location) || 0) + 1);
    if (u.title) {
      const raw = String(u.title).trim();
      if (raw) {
        const key = raw.toLowerCase();
        const entry = titleByKey.get(key);
        if (entry) entry.count += 1;
        else titleByKey.set(key, { name: raw, count: 1 });
      }
    }
    if (u.customFields) {
      for (const [k, v] of Object.entries(u.customFields)) {
        customKeys.add(k);
        if (v == null) continue;
        // Stringify primitives, flatten one level of arrays. Skip objects (manager
        // structs, image blobs) — those don't make useful vocabulary.
        const vals = Array.isArray(v) ? v : [v];
        for (const item of vals) {
          if (item == null) continue;
          if (typeof item === 'object') continue;
          const raw = String(item).trim();
          if (!raw || raw.length > 80) continue;
          const valKey = raw.toLowerCase();
          if (!cfValues.has(k)) cfValues.set(k, new Map());
          const inner = cfValues.get(k);
          const entry = inner.get(valKey);
          if (entry) entry.count += 1;
          else inner.set(valKey, { value: raw, count: 1 });
        }
      }
    }
  }
  // If the user directory didn't expose department/location for most users,
  // fall back to group titles as a secondary signal — they often encode the
  // org structure ("Dep. Customer Success", "Dep. Product & Engineering").
  if (deptCounts.size < 3 && groups?.length) {
    for (const g of groups) {
      if (g.isDepartmentGroup) {
        const name = g.name.replace(/^Dep\.?\s*/i, '').replace(/^Department\s+/i, '').trim();
        if (name) deptCounts.set(name, (deptCounts.get(name) || 0) + 1);
      }
    }
  }
  const rank = (m) => [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Top authors by post volume in the recent sample (signal: which teams
  // are loudest right now → which Assistants will get the most use).
  const authorCounts = new Map();
  for (const p of posts) {
    const name = p.author?.name;
    if (!name) continue;
    authorCounts.set(name, (authorCounts.get(name) || 0) + 1);
  }
  const topAuthors = [...authorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, postCount]) => ({ name, postCount }));

  // Top distinct title strings so the LLM (and Setup UI) can see how this
  // org actually phrases roles ("CEO" vs "Chief Executive Officer" vs
  // "Geschäftsführer"). Drop singletons that look like free-form unique
  // strings rather than role vocabulary, except when the sample is small.
  const titleEntries = [...titleByKey.values()].sort((a, b) => b.count - a.count);
  const titleMinCount = users.length >= 30 ? 2 : 1;
  const titleValues = titleEntries.filter((t) => t.count >= titleMinCount).slice(0, 20);

  // Per-field value distribution. Only keep fields where ≥2 users share a
  // value — that filters out noisy free-form fields (phone numbers, one-off
  // bios) and keeps enum-shaped fields like "function" or "office".
  const customFieldValues = {};
  for (const [k, inner] of cfValues.entries()) {
    const entries = [...inner.values()]
      .filter((e) => e.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    if (entries.length) customFieldValues[k] = entries;
  }

  return {
    totalUsers: usersTotal ?? users.length,
    sampledUsers: users.length,
    departments: rank(deptCounts).slice(0, 15),
    locations: rank(locCounts).slice(0, 15),
    customFieldKeys: [...customKeys].slice(0, 12),
    titleValues,
    customFieldValues,
    topAuthors,
  };
}

// ── Pass A: workspace overview + glossary + main instructions ──────────────

async function passAWorkspace({ channels, topPosts, deepPosts, orgSignals, languages, pages, groups, audienceOverride }) {
  if (!process.env.AZURE_KEY) throw new Error('AZURE_KEY is not configured');
  const client = createAIClient();

  const compactChannels = channels.map((c) => ({
    id: c.id, title: c.title, postCount: c.sampledPostCount,
  }));
  const compactTopPosts = topPosts.slice(0, 25).map((p) => ({
    title: p.title,
    teaser: (p.teaser || '').slice(0, 160),
    channelTitle: p.channel?.title,
  }));
  const compactDeep = deepPosts.map((p) => ({
    title: p.title,
    excerpt: (p.content || '').slice(0, 1200),
  }));
  // Pages: the richest knowledge surface. Body excerpts up to 800 chars each.
  const compactPages = (pages || []).slice(0, 25).map((p) => ({
    title: p.title,
    description: p.description,
    bodyExcerpt: (p.bodyExcerpt || '').slice(0, 800),
  }));
  const compactGroups = (groups || []).map((g) => ({
    name: g.name,
    description: g.description,
    isDepartmentGroup: g.isDepartmentGroup,
  }));

  const system = loadDiscoveryPrompt('passA-workspace');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.25,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: JSON.stringify({
          totalUsers: orgSignals.totalUsers,
          sampledUsers: orgSignals.sampledUsers,
          languages,
          channels: compactChannels,
          topPosts: compactTopPosts,
          deepPostExcerpts: compactDeep,
          pages: compactPages,
          groups: compactGroups,
          departments: orgSignals.departments,
          locations: orgSignals.locations,
          customFieldKeys: orgSignals.customFieldKeys,
          topAuthors: orgSignals.topAuthors,
          ...(audienceOverride ? {
            audienceOverride: {
              kind: audienceOverride.kind,
              label: audienceOverride.label,
              summary: audienceOverride.summary,
              instruction: 'ADMIN-PROVIDED AUDIENCE — use this exact audience.kind and audience.label in the output and throughout the mainInstructions template. Do not re-infer the audience from content.',
            },
          } : {}),
        }),
      },
    ],
  });

  const raw = response.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('[navigator-setup passA] JSON parse failed. Raw:', raw.slice(0, 500));
    throw new Error('workspace_pass_invalid_json');
  }
  if (typeof parsed.mainInstructions !== 'string') {
    console.error('[navigator-setup passA] mainInstructions missing/non-string. Keys:', Object.keys(parsed), 'Sample:', JSON.stringify(parsed).slice(0, 500));
    throw new Error('workspace_pass_no_mainInstructions');
  }
  parsed.glossary = Array.isArray(parsed.glossary) ? parsed.glossary : [];
  parsed.questionTypes = Array.isArray(parsed.questionTypes) ? parsed.questionTypes : [];
  parsed.companyName = parsed.companyName || 'this company';
  parsed.companyMission = parsed.companyMission || '';
  parsed.workspaceFacts = Array.isArray(parsed.workspaceFacts) ? parsed.workspaceFacts : [];
  parsed.tone = Array.isArray(parsed.tone) ? parsed.tone : [];

  // Audience: normalise the LLM-produced object. If the admin supplied an
  // override, enforce it regardless of what the LLM returned (it shouldn't
  // drift, but belt-and-suspenders).
  const llmAudience = parsed.audience && typeof parsed.audience === 'object' ? parsed.audience : {};
  const resolvedKind = ALLOWED_AUDIENCE_KINDS.includes(llmAudience.kind) ? llmAudience.kind : 'internal_employees';
  const llmLabel = typeof llmAudience.label === 'string' && llmAudience.label.trim() ? llmAudience.label.trim() : '';
  const defaultLabel = resolvedKind === 'internal_employees'
    ? `${parsed.companyName && parsed.companyName !== 'this company' ? parsed.companyName + ' ' : ''}employees`.trim()
    : 'workspace members';
  parsed.audience = {
    kind: resolvedKind,
    label: llmLabel || defaultLabel,
    summary: typeof llmAudience.summary === 'string' ? llmAudience.summary : '',
  };
  if (audienceOverride) {
    parsed.audience = {
      kind: audienceOverride.kind,
      label: audienceOverride.label,
      summary: audienceOverride.summary || parsed.audience.summary,
    };
  }

  // Fallbacks: the LLM sometimes embeds the question types and glossary
  // ONLY inside mainInstructions and forgets to fill the dedicated arrays.
  // Extract them from the prose so the UI's chip cloud + glossary list still
  // render — and so the persisted tenant.glossary isn't empty.
  if (parsed.questionTypes.length === 0 && parsed.mainInstructions) {
    const match = parsed.mainInstructions.match(/WHAT NAVIGATOR HELPS WITH\s*([\s\S]*?)(?:\n\s*WHAT NAVIGATOR DOES NOT|\n\s*ROUTING|\n\s*GLOSSARY|\n\s*WORKSPACE-SPECIFIC|$)/);
    if (match) {
      const lines = match[1].split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
      if (lines.length) parsed.questionTypes = lines.slice(0, 12);
    }
  }
  if (parsed.glossary.length === 0 && parsed.mainInstructions) {
    const match = parsed.mainInstructions.match(/\nGLOSSARY\s*([\s\S]*?)(?:\n\s*WORKSPACE-SPECIFIC|\n\s*ROUTING|$)/);
    if (match) {
      const lines = match[1].split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
      parsed.glossary = lines.map((l) => {
        const m = l.match(/^([^—\-:]+?)\s*[—\-:]\s*(.+)$/);
        return m ? { term: m[1].trim(), definition: m[2].trim() } : null;
      }).filter(Boolean).slice(0, 15);
    }
  }

  return parsed;
}

function buildFallbackWorkspace({ channels, orgSignals, languages, audienceOverride }) {
  const deptNames = orgSignals.departments.slice(0, 6).map((d) => d.name).join(', ') || 'multiple teams';
  const langs = languages.length ? languages.join(', ') : 'en_US';
  const audience = audienceOverride || { kind: 'internal_employees', label: 'employees', summary: '' };
  return {
    audience,
    overview: `This Staffbase workspace has ${channels.length} content channels across ${deptNames}. ${orgSignals.totalUsers ? `Directory contains ${orgSignals.totalUsers} users.` : ''}`,
    tone: ['professional', 'collaborative'],
    mainInstructions: `You are Navigator, an AI assistant for ${audience.label}. Help ${audience.label} find information, navigate workspace content, and get answers grounded in this workspace's sources. Always be helpful, accurate, and grounded in the workspace's content. Workspace languages: ${langs}.`,
    glossary: [],
    workspaceFacts: [
      `${channels.length} content channels`,
      orgSignals.totalUsers ? `${orgSignals.totalUsers} users in the directory sample` : null,
      languages.length > 1 ? `Multi-language workspace: ${languages.join(', ')}` : null,
    ].filter(Boolean),
  };
}

// ── Pass B: Assistant proposal ─────────────────────────────────────────────

async function passBAssistants({ channels, topPosts, deepPosts, orgSignals, languages, workspace, pages, groups, baseApiUrl, existingCoverage }) {
  if (!process.env.AZURE_KEY) throw new Error('AZURE_KEY is not configured');
  const client = createAIClient();

  const compactChannels = channels.map((c) => ({
    id: c.id, title: c.title, description: (c.description || '').slice(0, 120), postCount: c.sampledPostCount,
  }));
  const compactTopPosts = topPosts.map((p) => ({
    title: p.title,
    teaser: (p.teaser || '').slice(0, 180),
    channelId: p.channel?.id,
    channelTitle: p.channel?.title,
  }));
  const compactDeep = deepPosts.map((p) => ({
    title: p.title,
    excerpt: (p.content || '').slice(0, 800),
  }));
  const compactPages = (pages || []).slice(0, 25).map((p) => ({
    id: p.id, title: p.title, description: p.description,
    bodyExcerpt: (p.bodyExcerpt || '').slice(0, 500),
  }));
  const compactGroups = (groups || []).map((g) => ({
    name: g.name, description: g.description, isDepartmentGroup: g.isDepartmentGroup,
  }));

  const system = loadDiscoveryPrompt('passB-assistants', {
    allowedIcons: ALLOWED_ICONS.join(', '),
  });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: JSON.stringify({
          channels: compactChannels,
          topPosts: compactTopPosts,
          deepPostExcerpts: compactDeep,
          pages: compactPages,
          groups: compactGroups,
          departments: orgSignals.departments,
          locations: orgSignals.locations,
          customFieldKeys: orgSignals.customFieldKeys,
          topAuthors: orgSignals.topAuthors,
          totalUsers: orgSignals.totalUsers,
          languages,
          workspaceContext: {
            companyName: workspace?.companyName,
            companyMission: workspace?.companyMission,
            audience: workspace?.audience,
            overview: workspace?.overview,
            tone: workspace?.tone,
            glossary: workspace?.glossary,
            workspaceFacts: workspace?.workspaceFacts,
            questionTypes: workspace?.questionTypes,
          },
          existingCoverage: existingCoverage || { experts: [], connections: [] },
        }),
      },
    ],
  });

  const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
  if (!Array.isArray(parsed.topicClusters) || !Array.isArray(parsed.proposedAssistants)) {
    throw new Error('assistant_pass_invalid_shape');
  }

  // Enrich knowledgeSources with channel URLs + sanitise icons.
  const baseUrl = (baseApiUrl || process.env.STAFFBASE_API_BASE || 'https://campsite.staffbase.com/api').replace(/\/api\/?$/, '');
  const channelById = new Map(channels.map((c) => [c.id, c]));
  for (const a of parsed.proposedAssistants) {
    a.knowledgeSources = (a.knowledgeSources || [])
      .filter((ks) => ks && ks.channelId && channelById.has(ks.channelId))
      .map((ks) => {
        const ch = channelById.get(ks.channelId);
        return {
          channelId: ks.channelId,
          channelTitle: ks.channelTitle || ch.title,
          url: `${baseUrl}/content/channel/${ks.channelId}`,
        };
      });
    if (!ALLOWED_ICONS.includes(a.lucideIcon)) a.lucideIcon = 'Sparkles';
    a.alwaysInclude = !!a.alwaysInclude;
    a.signalsUsed = Array.isArray(a.signalsUsed) ? a.signalsUsed : [];
  }
  for (const c of parsed.topicClusters) {
    if (!ALLOWED_ICONS.includes(c.lucideIcon)) c.lucideIcon = 'Sparkles';
  }

  // Defense in depth: even with the audience-aware Pass B prompt, the LLM
  // occasionally falls back to its training-data defaults and slips in
  // employee-only universals (HR / IT / Onboarding / Travel / Payroll /
  // People Experience / L&D). When the audience clearly isn't an internal
  // workforce, drop them post-hoc.
  if (workspace?.audience?.kind && workspace.audience.kind !== 'internal_employees') {
    const employeeOnly = /\b(hr|human resources|it helpdesk|it support|onboarding|travel\s*(?:&|and)\s*expenses?|payroll|people experience|learning\s*(?:&|and)\s*development|l\s*&\s*d)\b/i;
    parsed.proposedAssistants = parsed.proposedAssistants.filter((a) => !(a.name && employeeOnly.test(a.name)));
  }

  // Post-hoc dedupe against existing Experts — case-insensitive name match
  // after stripping punctuation and the optional " Assistant" suffix.
  const normalise = (s) => (s || '').toLowerCase().replace(/\bassistant\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const existingNames = new Set((existingCoverage?.experts || []).map((e) => normalise(e.name)));
  if (existingNames.size > 0) {
    parsed.proposedAssistants = parsed.proposedAssistants.filter((a) => !existingNames.has(normalise(a.name)));
  }

  return parsed;
}

function buildFallbackAssistants({ channels, orgSignals, baseApiUrl, audience, existingCoverage }) {
  const baseUrl = (baseApiUrl || process.env.STAFFBASE_API_BASE || 'https://campsite.staffbase.com/api').replace(/\/api\/?$/, '');
  const audienceLabel = audience?.label || 'workspace members';
  const audienceKind = audience?.kind || 'mixed';

  // Universals only make sense for an internal workforce. For other audience
  // kinds, fall back to channel-driven Assistants only — the LLM is the
  // right tool for inventing audience-specific universals, and the fallback
  // path runs precisely when the LLM is unavailable.
  const universalSpecs =
    audienceKind === 'internal_employees'
      ? [
          { name: 'HR Assistant', description: 'Answers HR, benefits, PTO, and policy questions.', lucideIcon: 'HeartHandshake' },
          { name: 'IT Helpdesk', description: 'Help with devices, software, access, and tickets.', lucideIcon: 'Wrench' },
          { name: 'Onboarding Buddy', description: 'Guides new hires through their first 30 days.', lucideIcon: 'GraduationCap' },
        ]
      : [];
  const universals = universalSpecs.map((u) => ({
    clusterName: 'Universal',
    name: u.name,
    description: u.description,
    lucideIcon: u.lucideIcon,
    systemPromptSnippet: `You are ${u.name} for ${audienceLabel}. Handle questions related to ${u.description.toLowerCase()} Be clear, accurate, and grounded in linked sources. If you don't know an answer, say so and suggest who to ask.`,
    knowledgeSources: [],
    alwaysInclude: true,
    signalsUsed: ['fallback — OpenAI unavailable, including universal Assistants'],
  }));

  const clusters = channels.map((c) => ({
    name: c.title,
    description: c.description || `Content from ${c.title}.`,
    lucideIcon: 'Hash',
    channelIds: [c.id],
    samplePostTitles: [],
  }));

  const proposed = channels.map((c) => ({
    clusterName: c.title,
    name: `${c.title} Helper`,
    description: c.description || `Surfaces content from ${c.title}.`,
    lucideIcon: 'Hash',
    systemPromptSnippet: `You are an assistant for the "${c.title}" channel. Use posts from that channel as your primary source. Cite sources, and say if a topic isn't covered.`,
    knowledgeSources: [{
      channelId: c.id,
      channelTitle: c.title,
      url: `${baseUrl}/content/channel/${c.id}`,
    }],
    alwaysInclude: false,
    signalsUsed: ['fallback — one Assistant per channel'],
  }));

  // Dedupe against existing Experts on the fallback path too.
  const normalise = (s) => (s || '').toLowerCase().replace(/\bassistant\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const existingNames = new Set((existingCoverage?.experts || []).map((e) => normalise(e.name)));
  const combined = [...universals, ...proposed].filter((a) => !existingNames.has(normalise(a.name)));

  return { topicClusters: clusters, proposedAssistants: combined };
}

// ── search-preview ─────────────────────────────────────────────────────────

async function handleSearchPreview(_req, res, url) {
  const query = url.searchParams.get('query') || '';
  if (!query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }
  const results = await searchPosts(query, { limit: 5 });
  res.status(200).json({
    query,
    results,
    hasResults: results.length > 0,
  });
}

// ── update-main-instructions ────────────────────────────────────────────────
//
// Persist a user-edited orchestrator system prompt verbatim. The Home tab's
// editor uses this for "Save as-is".

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

async function handleUpdateMainInstructions(req, res) {
  if (!dbConfigured()) {
    return res.status(503).json({ error: 'database_not_configured', code: 'db_missing' });
  }
  const body = await readJsonBody(req);
  const mainInstructions = typeof body.mainInstructions === 'string' ? body.mainInstructions : null;
  if (mainInstructions === null) {
    return res.status(400).json({ error: 'mainInstructions (string) is required' });
  }
  const branch = await getBranch();
  if (!branch?.id) {
    return res.status(503).json({ error: 'branch_unavailable', code: 'staffbase_branch_missing' });
  }
  const existing = await getBlueprint(branch.id);
  if (!existing) {
    return res.status(404).json({ error: 'no_blueprint', code: 'discovery_required' });
  }
  await patchBlueprintField(branch.id, ['workspace', 'mainInstructions'], mainInstructions);
  return res.status(200).json({ ok: true, mainInstructions });
}

// ── optimize-main-instructions ──────────────────────────────────────────────
//
// Run an LLM polish pass over the user's draft, enforcing the Pass-A
// section structure (ROLE / ABOUT / TONE & LANGUAGE / WHAT NAVIGATOR HELPS
// WITH / WHAT NAVIGATOR DOES NOT HANDLE / ROUTING / GLOSSARY /
// WORKSPACE-SPECIFIC NOTES). Returns both `original` and `optimized` so the
// UI can show a diff before committing. Does NOT persist — the client calls
// update-main-instructions with the result if the user accepts.

async function handleOptimizeMainInstructions(req, res) {
  if (!process.env.AZURE_KEY) {
    return res.status(503).json({ error: 'azure_key_not_configured', code: 'azure_key_missing' });
  }
  const body = await readJsonBody(req);
  const draft = typeof body.mainInstructions === 'string' ? body.mainInstructions : null;
  if (!draft || !draft.trim()) {
    return res.status(400).json({ error: 'mainInstructions (string) is required' });
  }

  // The client may supply the current audience (from in-flight edits in the
  // wizard) — that takes precedence over what's persisted in the blueprint.
  const bodyAudience = body.audience && typeof body.audience === 'object'
    ? {
        kind: ALLOWED_AUDIENCE_KINDS.includes(body.audience.kind) ? body.audience.kind : 'mixed',
        label: typeof body.audience.label === 'string' && body.audience.label.trim() ? body.audience.label.trim() : 'workspace members',
        summary: typeof body.audience.summary === 'string' ? body.audience.summary : '',
      }
    : null;

  // Pull workspace context (companyName, tone, glossary, audience) so the
  // polish pass can reinforce workspace-specific framing instead of generic
  // boilerplate.
  let workspaceContext = null;
  try {
    const branch = await getBranch();
    if (branch?.id) {
      const row = await getBlueprint(branch.id);
      const ws = row?.blueprint?.workspace || null;
      if (ws) {
        workspaceContext = {
          companyName: ws.companyName,
          companyMission: ws.companyMission,
          audience: bodyAudience || ws.audience || null,
          tone: ws.tone,
          glossary: (ws.glossary || []).slice(0, 12),
          languages: row?.blueprint?.languages || [],
        };
      }
    }
  } catch {}
  // If we couldn't load a blueprint (e.g. discovery hasn't persisted yet)
  // but the client still provided an audience, propagate it so the optimize
  // pass respects the override.
  if (!workspaceContext && bodyAudience) {
    workspaceContext = { audience: bodyAudience };
  }

  const client = createAIClient();
  const system = loadDiscoveryPrompt('optimize-main');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: JSON.stringify({
          draft,
          workspaceContext,
          audience: workspaceContext?.audience || null,
        }),
      },
    ],
  });

  let parsed = {};
  try { parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}'); } catch {}
  const optimized = typeof parsed.optimized === 'string' ? parsed.optimized : null;
  if (!optimized) {
    return res.status(500).json({ error: 'optimization_failed', code: 'llm_invalid_output' });
  }
  return res.status(200).json({
    original: draft,
    optimized,
  });
}
