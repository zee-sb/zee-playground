// Navigator Setup — Instant discovery endpoint.
//
// GET /api/navigator-setup?action=discover
//   Pulls channels + recent posts from Staffbase, computes engagement, and
//   asks gpt-4o-mini to cluster the content into topic groups + propose a
//   Navigator Assistant per cluster. Falls back to one-Assistant-per-channel
//   if OpenAI is unavailable or returns invalid JSON.
//
// GET /api/navigator-setup?action=search-preview&query=<term>
//   Thin pass-through to searchPosts for the UI's gap-detection widget.

import OpenAI from 'openai';
import { listChannels, listRecentPosts, searchPosts } from '../lib/staffbase.mjs';

const ALLOWED_ICONS = [
  'Sparkles', 'HeartHandshake', 'Briefcase', 'Megaphone', 'Wrench',
  'GraduationCap', 'Users', 'Building2', 'Newspaper', 'ShieldCheck',
  'Calendar', 'Hash',
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');
    if (action === 'discover') return await handleDiscover(req, res);
    if (action === 'search-preview') return await handleSearchPreview(req, res, url);
    res.status(400).json({ error: 'unknown action — expected discover | search-preview' });
  } catch (err) {
    const isAuthErr = /STAFFBASE_API_TOKEN is not configured/.test(err.message || '');
    res.status(isAuthErr ? 503 : 500).json({
      error: err.message || 'unknown error',
      code: isAuthErr ? 'staffbase_token_missing' : 'internal',
    });
  }
}

// ── discover ───────────────────────────────────────────────────────────────

async function handleDiscover(_req, res) {
  const [channelsRaw, postsRaw] = await Promise.all([
    listChannels({ limit: 50 }),
    listRecentPosts({ limit: 50 }),
  ]);

  // Sampled post counts per channel — best-effort signal, not authoritative.
  const countsByChannel = new Map();
  for (const p of postsRaw) {
    if (!p.channel?.id) continue;
    countsByChannel.set(p.channel.id, (countsByChannel.get(p.channel.id) || 0) + 1);
  }
  const channels = channelsRaw.map((c) => ({
    ...c,
    sampledPostCount: countsByChannel.get(c.id) || 0,
  }));

  const topPosts = [...postsRaw]
    .sort((a, b) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)))
    .slice(0, 20);
  const recentPosts = postsRaw.slice(0, 20);

  let clustering = null;
  let openAiUsed = false;
  let fallbackReason = null;
  try {
    clustering = await clusterWithOpenAI(channels, topPosts);
    openAiUsed = true;
  } catch (err) {
    fallbackReason = err.message || 'openai_failed';
    clustering = buildFallbackClusters(channels);
  }

  res.status(200).json({
    channels,
    topPosts,
    recentPosts,
    topicClusters: clustering.topicClusters,
    proposedAssistants: clustering.proposedAssistants,
    meta: {
      openAiUsed,
      fallbackReason,
      postsAnalyzed: postsRaw.length,
      sampledCounts: true,
    },
  });
}

async function clusterWithOpenAI(channels, topPosts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const client = new OpenAI({ apiKey });

  const compactChannels = channels.map((c) => ({
    id: c.id,
    title: c.title,
    description: (c.description || '').slice(0, 160),
  }));
  const compactPosts = topPosts.map((p) => ({
    title: p.title,
    teaser: (p.teaser || '').slice(0, 200),
    channelId: p.channel?.id,
    channelTitle: p.channel?.title,
  }));

  const system = `You analyze an enterprise intranet and propose a setup for an AI assistant suite called "Navigator". You will be given the list of channels and the 20 most-engaged recent posts. Group the content into 3–7 broad TOPIC CLUSTERS (e.g. "HR & Benefits", "IT & Tooling", "Company News", "Leadership Updates", "Learning & Development"). For each cluster, propose one Navigator Assistant.

Return STRICT JSON only — no prose, no markdown. Schema:
{
  "topicClusters": [
    {
      "name": "string (short, 2-4 words)",
      "description": "string (one sentence describing the cluster's content)",
      "lucideIcon": "one of: ${ALLOWED_ICONS.join(', ')}",
      "channelIds": ["channel-id", ...],
      "samplePostTitles": ["title", ...]   // 2-4 example titles from the input
    }
  ],
  "proposedAssistants": [
    {
      "clusterName": "must match a topicClusters[].name exactly",
      "name": "Assistant name (3-5 words, conversational — e.g. 'HR Helper', 'IT Support')",
      "description": "one sentence describing what the Assistant does for employees",
      "lucideIcon": "must match the cluster's lucideIcon",
      "systemPromptSnippet": "2-4 sentences that would prime an LLM: tone, scope, what it should ground in",
      "knowledgeSources": [
        { "channelId": "must be one of the cluster's channelIds", "channelTitle": "exact channel title from input" }
      ]
    }
  ]
}

Rules:
- Cluster names are short, human, and category-like — not literal channel names.
- Every channel should appear in at most one cluster. It's fine to leave a channel uncategorized if it doesn't fit a cluster cleanly.
- Each proposedAssistant must have at least one knowledgeSource and at least one corresponding channelId in its cluster.
- Pick lucideIcon ONLY from the allowed list — any other value will be rejected.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: JSON.stringify({ channels: compactChannels, topPosts: compactPosts }),
      },
    ],
  });
  const text = response.choices?.[0]?.message?.content || '';
  const parsed = JSON.parse(text); // throws if not valid JSON — caught by outer fallback

  // Validate + sanitise. If structure is off, throw so the fallback kicks in.
  if (!Array.isArray(parsed.topicClusters) || !Array.isArray(parsed.proposedAssistants)) {
    throw new Error('openai_returned_invalid_shape');
  }

  // Enrich knowledgeSources with the channel URL so the UI can render link chips.
  // The Staffbase API doesn't expose a public channel URL on the channel object,
  // so we derive a sensible deep-link pattern: /content/channel/<id>.
  const channelById = new Map(channels.map((c) => [c.id, c]));
  for (const a of parsed.proposedAssistants) {
    a.knowledgeSources = (a.knowledgeSources || [])
      .filter((ks) => ks && ks.channelId && channelById.has(ks.channelId))
      .map((ks) => {
        const ch = channelById.get(ks.channelId);
        return {
          channelId: ks.channelId,
          channelTitle: ks.channelTitle || ch.title,
          url: `${process.env.STAFFBASE_API_BASE?.replace('/api', '') || 'https://campsite.staffbase.com'}/content/channel/${ks.channelId}`,
        };
      });
    if (!ALLOWED_ICONS.includes(a.lucideIcon)) a.lucideIcon = 'Sparkles';
  }
  for (const c of parsed.topicClusters) {
    if (!ALLOWED_ICONS.includes(c.lucideIcon)) c.lucideIcon = 'Sparkles';
  }

  return parsed;
}

function buildFallbackClusters(channels) {
  // One Assistant per channel. Lower-fidelity but always works.
  const baseUrl = process.env.STAFFBASE_API_BASE?.replace('/api', '') || 'https://campsite.staffbase.com';
  const topicClusters = channels.map((c) => ({
    name: c.title,
    description: c.description || `Content from the ${c.title} channel.`,
    lucideIcon: 'Hash',
    channelIds: [c.id],
    samplePostTitles: [],
  }));
  const proposedAssistants = channels.map((c) => ({
    clusterName: c.title,
    name: `${c.title} Assistant`,
    description: c.description || `Answers questions about content from ${c.title}.`,
    lucideIcon: 'Hash',
    systemPromptSnippet: `You answer employee questions using the "${c.title}" channel as your primary source. Keep responses grounded in the channel's posts; if you don't find an answer there, say so.`,
    knowledgeSources: [{
      channelId: c.id,
      channelTitle: c.title,
      url: `${baseUrl}/content/channel/${c.id}`,
    }],
  }));
  return { topicClusters, proposedAssistants };
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
