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

import OpenAI from 'openai';
import {
  listChannels, listRecentPosts, listUsers, searchPosts, getPost,
  listPages, listGroups, getUsersTotal, getBranch,
} from '../lib/staffbase.mjs';
import { getBlueprint, saveBlueprint, patchBlueprintField } from '../lib/blueprints.mjs';
import { embed } from '../lib/embeddings.mjs';
import { dbConfigured } from '../lib/db.mjs';
import { loadPrompt as loadDiscoveryPrompt } from '../lib/discovery/load-prompt.mjs';

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
    if (action === 'load') return await handleLoad(req, res);
    if (action === 'discover') return await handleDiscover(req, res);
    if (action === 'search-preview') return await handleSearchPreview(req, res, url);
    if (action === 'match-pages') return await handleMatchPages(req, res, url);
    if (action === 'update-main-instructions') return await handleUpdateMainInstructions(req, res);
    if (action === 'optimize-main-instructions') return await handleOptimizeMainInstructions(req, res);
    res.status(400).json({ error: 'unknown action — expected load | discover | search-preview | match-pages | update-main-instructions | optimize-main-instructions' });
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

async function handleDiscover(_req, res) {
  // Look up the Staffbase branch ID first — this is the persistence key.
  // Best-effort: if the branch lookup fails (e.g. token mis-scoped), we
  // continue without persistence and return the result in-memory only.
  const branch = await getBranch().catch((err) => {
    console.warn('[navigator-setup] getBranch failed, skipping persistence:', err.message);
    return null;
  });

  // Parallel pull of all primary signals.
  const [channelsRaw, postsRaw, usersRaw, usersTotal, pagesRaw, groupsRaw] = await Promise.all([
    listChannels({ limit: 50 }),
    listRecentPosts({ limit: 50 }),
    listUsers({ limit: 200 }).catch(() => []),
    getUsersTotal().catch(() => null),
    listPages({ limit: 200 }).catch(() => []),
    listGroups({ limit: 50 }).catch(() => []),
  ]);

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
      channels, topPosts, deepPosts, orgSignals, languages, pages, groups,
    });
    openAiUsed = true;
  } catch (err) {
    fallbackReason = `workspace_pass: ${err.message || 'failed'}`;
    workspace = buildFallbackWorkspace({ channels, orgSignals, languages });
  }

  // ── Pass B: Assistant proposal — clusters + always-include universals.
  let assistantsResult = null;
  try {
    assistantsResult = await passBAssistants({
      channels, topPosts, deepPosts, orgSignals, languages, workspace, pages, groups,
    });
  } catch (err) {
    fallbackReason = (fallbackReason ? fallbackReason + '; ' : '') + `assistant_pass: ${err.message || 'failed'}`;
    assistantsResult = buildFallbackAssistants({ channels, orgSignals });
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
      topAuthors: [],
    };
  }
  const deptCounts = new Map();
  const locCounts = new Map();
  const customKeys = new Set();
  for (const u of users) {
    if (u.department) deptCounts.set(u.department, (deptCounts.get(u.department) || 0) + 1);
    if (u.location) locCounts.set(u.location, (locCounts.get(u.location) || 0) + 1);
    if (u.customFields) for (const k of Object.keys(u.customFields)) customKeys.add(k);
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

  return {
    totalUsers: usersTotal ?? users.length,
    sampledUsers: users.length,
    departments: rank(deptCounts).slice(0, 15),
    locations: rank(locCounts).slice(0, 15),
    customFieldKeys: [...customKeys].slice(0, 12),
    topAuthors,
  };
}

// ── Pass A: workspace overview + glossary + main instructions ──────────────

async function passAWorkspace({ channels, topPosts, deepPosts, orgSignals, languages, pages, groups }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const client = new OpenAI({ apiKey });

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

function buildFallbackWorkspace({ channels, orgSignals, languages }) {
  const deptNames = orgSignals.departments.slice(0, 6).map((d) => d.name).join(', ') || 'multiple teams';
  const langs = languages.length ? languages.join(', ') : 'en_US';
  return {
    overview: `This Staffbase workspace has ${channels.length} content channels across ${deptNames}. ${orgSignals.totalUsers ? `Directory contains ${orgSignals.totalUsers} users.` : ''}`,
    tone: ['professional', 'collaborative'],
    mainInstructions: `You are Navigator, an AI assistant for this workspace. Help employees find information, navigate company content, and get answers about policies and procedures. Always be helpful, accurate, and grounded in the company's content. Workspace languages: ${langs}. Departments include: ${deptNames}.`,
    glossary: [],
    workspaceFacts: [
      `${channels.length} content channels`,
      orgSignals.totalUsers ? `${orgSignals.totalUsers} users in the directory sample` : null,
      languages.length > 1 ? `Multi-language workspace: ${languages.join(', ')}` : null,
    ].filter(Boolean),
  };
}

// ── Pass B: Assistant proposal ─────────────────────────────────────────────

async function passBAssistants({ channels, topPosts, deepPosts, orgSignals, languages, workspace, pages, groups }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const client = new OpenAI({ apiKey });

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
            overview: workspace?.overview,
            tone: workspace?.tone,
            glossary: workspace?.glossary,
            workspaceFacts: workspace?.workspaceFacts,
            questionTypes: workspace?.questionTypes,
          },
        }),
      },
    ],
  });

  const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
  if (!Array.isArray(parsed.topicClusters) || !Array.isArray(parsed.proposedAssistants)) {
    throw new Error('assistant_pass_invalid_shape');
  }

  // Enrich knowledgeSources with channel URLs + sanitise icons.
  const baseUrl = process.env.STAFFBASE_API_BASE?.replace('/api', '') || 'https://campsite.staffbase.com';
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

  return parsed;
}

function buildFallbackAssistants({ channels, orgSignals }) {
  const baseUrl = process.env.STAFFBASE_API_BASE?.replace('/api', '') || 'https://campsite.staffbase.com';
  // A handful of universals + one-per-channel
  const universals = [
    { name: 'HR Assistant', description: 'Answers HR, benefits, PTO, and policy questions.', lucideIcon: 'HeartHandshake' },
    { name: 'IT Helpdesk', description: 'Help with devices, software, access, and tickets.', lucideIcon: 'Wrench' },
    { name: 'Onboarding Buddy', description: 'Guides new hires through their first 30 days.', lucideIcon: 'GraduationCap' },
  ].map((u) => ({
    clusterName: 'Universal',
    name: u.name,
    description: u.description,
    lucideIcon: u.lucideIcon,
    systemPromptSnippet: `You are ${u.name} for this workspace. Handle questions related to ${u.description.toLowerCase()} Be clear, accurate, and grounded in linked sources. If you don't know an answer, say so and suggest who to ask.`,
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

  return { topicClusters: clusters, proposedAssistants: [...universals, ...proposed] };
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'openai_not_configured', code: 'openai_missing' });
  }
  const body = await readJsonBody(req);
  const draft = typeof body.mainInstructions === 'string' ? body.mainInstructions : null;
  if (!draft || !draft.trim()) {
    return res.status(400).json({ error: 'mainInstructions (string) is required' });
  }

  // Pull workspace context (companyName, tone, glossary) so the polish pass
  // can reinforce workspace-specific framing instead of generic boilerplate.
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
          tone: ws.tone,
          glossary: (ws.glossary || []).slice(0, 12),
          languages: row?.blueprint?.languages || [],
        };
      }
    }
  } catch {}

  const client = new OpenAI({ apiKey });
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
