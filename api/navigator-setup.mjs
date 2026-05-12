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
} from '../lib/staffbase.mjs';

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
  // Parallel pull of all primary signals.
  const [channelsRaw, postsRaw, usersRaw] = await Promise.all([
    listChannels({ limit: 50 }),
    listRecentPosts({ limit: 50 }),
    listUsers({ limit: 200 }).catch(() => []),
  ]);

  // ── Channels with sampled post counts + locales aggregated.
  const countsByChannel = new Map();
  for (const p of postsRaw) {
    if (!p.channel?.id) continue;
    countsByChannel.set(p.channel.id, (countsByChannel.get(p.channel.id) || 0) + 1);
  }
  const channels = channelsRaw.map((c) => ({
    ...c,
    sampledPostCount: countsByChannel.get(c.id) || 0,
  }));

  // ── Posts ranked by engagement.
  const topPosts = [...postsRaw]
    .sort((a, b) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)))
    .slice(0, 20);
  const recentPosts = postsRaw.slice(0, 20);

  // ── Deep-content sample: pull full body for the top 3 posts so the
  // LLM has actual employee-reading material (not just titles) to infer
  // tone, internal acronyms, and topic depth.
  const deepPostIds = topPosts.slice(0, 3).map((p) => p.id);
  const deepPosts = await Promise.all(
    deepPostIds.map((id) => getPost(id).catch(() => null))
  ).then((arr) => arr.filter(Boolean));

  // ── Languages: union of locales across channels.
  const languageSet = new Set();
  for (const c of channels) {
    for (const loc of (c.locales || [])) languageSet.add(loc);
  }
  const languages = [...languageSet];

  // ── Org signals from the user directory.
  //    Departments, locations, top-author signals, and any unusual
  //    custom-field keys (e.g. ERGs, skills, pronouns) we should flag
  //    as workspace-specific glossary candidates.
  const orgSignals = summariseUsers(usersRaw, postsRaw);

  // ── Pass A: workspace overview + glossary + main instructions.
  let workspace = null;
  let openAiUsed = false;
  let fallbackReason = null;
  try {
    workspace = await passAWorkspace({
      channels, topPosts, deepPosts, orgSignals, languages,
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
      channels, topPosts, deepPosts, orgSignals, languages, workspace,
    });
  } catch (err) {
    fallbackReason = (fallbackReason ? fallbackReason + '; ' : '') + `assistant_pass: ${err.message || 'failed'}`;
    assistantsResult = buildFallbackAssistants({ channels, orgSignals });
  }

  res.status(200).json({
    channels,
    topPosts,
    recentPosts,
    deepPosts: deepPosts.map((p) => ({ id: p.id, title: p.title, contentLength: (p.content || '').length })),
    orgSignals,
    languages,
    workspace,
    topicClusters: assistantsResult.topicClusters,
    proposedAssistants: assistantsResult.proposedAssistants,
    meta: {
      openAiUsed,
      fallbackReason,
      postsAnalyzed: postsRaw.length,
      usersAnalyzed: usersRaw.length,
      deepPostsFetched: deepPosts.length,
      sampledCounts: true,
    },
  });
}

// ── User directory summary ─────────────────────────────────────────────────

function summariseUsers(users, posts) {
  if (!users.length) {
    return { departments: [], locations: [], totalUsers: 0, customFieldKeys: [], topAuthors: [] };
  }
  const deptCounts = new Map();
  const locCounts = new Map();
  const customKeys = new Set();
  for (const u of users) {
    if (u.department) deptCounts.set(u.department, (deptCounts.get(u.department) || 0) + 1);
    if (u.location) locCounts.set(u.location, (locCounts.get(u.location) || 0) + 1);
    if (u.customFields) for (const k of Object.keys(u.customFields)) customKeys.add(k);
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
    totalUsers: users.length,
    departments: rank(deptCounts).slice(0, 15),
    locations: rank(locCounts).slice(0, 15),
    customFieldKeys: [...customKeys].slice(0, 12),
    topAuthors,
  };
}

// ── Pass A: workspace overview + glossary + main instructions ──────────────

async function passAWorkspace({ channels, topPosts, deepPosts, orgSignals, languages }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const client = new OpenAI({ apiKey });

  const compactChannels = channels.map((c) => ({ id: c.id, title: c.title }));
  const compactTopPosts = topPosts.slice(0, 15).map((p) => ({
    title: p.title,
    teaser: (p.teaser || '').slice(0, 160),
    channelTitle: p.channel?.title,
  }));
  const compactDeep = deepPosts.map((p) => ({
    title: p.title,
    excerpt: (p.content || '').slice(0, 1200),
  }));

  const system = `You analyze an enterprise intranet and produce the foundational configuration for an AI assistant suite called "Navigator". You will be given:
- the list of channels (the workspace's content surfaces)
- the 15 most-engaged recent posts
- the full body of the top 3 posts
- aggregated user-directory signals: departments, locations, top authors, custom-field keys
- detected workspace languages

You output the WORKSPACE-LEVEL configuration — NOT individual assistants. Specifically:

1. \`overview\` — one-paragraph plain-English read on what this workspace is and how employees use it.
2. \`tone\` — 2-3 short adjectives describing the workspace's voice (e.g. "warm, casual, celebratory" vs "formal, news-driven").
3. \`mainInstructions\` — the TOP-LEVEL Navigator orchestrator system prompt (250-450 words). This is the master instructions block that every Assistant inherits. It should:
   - Name the company and what it does (infer from content; if unsure, hedge).
   - Set tone-of-voice rules grounded in observed tone.
   - State language policy if multiple languages are present (respond in the user's language; default to the dominant one).
   - Establish what Navigator does and doesn't help with.
   - Reference the actual departments and locations so the orchestrator routes correctly ("for HR questions about benefits or PTO, route to the HR Assistant", etc.).
   - Reference the workspace-specific glossary terms so the orchestrator understands acronyms.
4. \`glossary\` — array of {term, definition} entries (8-15 items). PRIORITISE workspace-specific acronyms, internal program names, ERG names, division names that an outsider wouldn't recognize. Skim post bodies + custom field keys for jargon. Skip generic terms (HR, PTO, IT).
5. \`workspaceFacts\` — bullet-style facts about the org (5-10 items). Format: short phrases. Examples: "Roughly 200 employees spanning 4 locations", "Active People Experience and Product teams", "Heavy intranet activity around leadership memos and culture content".

Return STRICT JSON only:
{
  "overview": "...",
  "tone": ["...", "..."],
  "mainInstructions": "...",
  "glossary": [{ "term": "...", "definition": "..." }, ...],
  "workspaceFacts": ["...", "..."]
}`;

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
          departments: orgSignals.departments,
          locations: orgSignals.locations,
          customFieldKeys: orgSignals.customFieldKeys,
          topAuthors: orgSignals.topAuthors,
          languages,
        }),
      },
    ],
  });

  const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
  // Light shape validation — if structure is off, throw so the outer fallback kicks in.
  if (typeof parsed.mainInstructions !== 'string' || !Array.isArray(parsed.glossary)) {
    throw new Error('workspace_pass_invalid_shape');
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

async function passBAssistants({ channels, topPosts, deepPosts, orgSignals, languages, workspace }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const client = new OpenAI({ apiKey });

  const compactChannels = channels.map((c) => ({
    id: c.id, title: c.title, description: (c.description || '').slice(0, 120),
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

  const system = `You analyze an enterprise intranet and propose the FULL Assistant lineup for Navigator. The workspace context (overview, glossary, main instructions) has already been generated in a previous pass — you receive it as input. Your job: produce 5-9 Assistants that cover both common universal needs (HR, IT, People Experience, Onboarding, Learning, Travel) AND workspace-specific topic clusters derived from the actual channels.

You will be given:
- channels with descriptions
- top 20 engaged posts (titles + teasers)
- 3 deep-content post excerpts
- aggregated org signals: departments, locations, top authors, custom field keys
- workspace context from the previous pass (use it to keep the Assistant prompts grounded in this specific company)

Output rules:
- Produce 5-9 Assistants. Aim for COVERAGE — be generous with proposing universal Assistants like HR, IT Helpdesk, People Experience, Onboarding, Learning & Development, Travel & Expenses. Only skip a universal Assistant if there is genuinely NO signal it would be useful here.
- Each Assistant's \`systemPromptSnippet\` must be 120-220 words, written in second-person ("You are..."), with:
  1. Role definition (one sentence).
  2. Scope: 3-5 specific topics it handles, naming actual workspace concepts/channels when relevant.
  3. Tone matching the workspace tone.
  4. Grounding rules (what knowledge sources to use; cite linked content; say "I don't know" if not in sources).
  5. Escalation: when to refer the user to a human (e.g. HR helpdesk for sensitive cases).
- Use the glossary terms from the workspace context naturally inside the prompts where relevant — that's how the Assistant "knows" the company's language.
- \`topicClusters\` group channels by theme — 3-7 clusters, NOT one per Assistant. A cluster may have no matching Assistant if the channels are tangential, and an Assistant can exist with no cluster (universal Assistants).

Strict JSON schema:
{
  "topicClusters": [
    {
      "name": "string (2-4 words)",
      "description": "string (one sentence)",
      "lucideIcon": "one of: ${ALLOWED_ICONS.join(', ')}",
      "channelIds": ["..."],
      "samplePostTitles": ["..."]
    }
  ],
  "proposedAssistants": [
    {
      "clusterName": "either a topicClusters[].name OR 'Universal' for always-include Assistants like HR/IT/Onboarding",
      "name": "Assistant name (e.g. 'HR Assistant', 'IT Helpdesk', 'People Experience Helper')",
      "description": "one sentence employee-facing description",
      "lucideIcon": "from allowed list",
      "systemPromptSnippet": "120-220 word system prompt",
      "knowledgeSources": [
        { "channelId": "must be from the input channels (only if a relevant channel exists; can be empty array for universal Assistants when no content channel matches)", "channelTitle": "string" }
      ],
      "alwaysInclude": false,    // true for HR/IT/Onboarding etc. that we propose even without a matching channel
      "signalsUsed": ["one-line reason this Assistant was proposed — which signals, departments, channels, or post patterns triggered it"]
    }
  ]
}

Lucide icons MUST be from the allowed list; default to Sparkles if unsure.`;

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
          departments: orgSignals.departments,
          locations: orgSignals.locations,
          customFieldKeys: orgSignals.customFieldKeys,
          topAuthors: orgSignals.topAuthors,
          languages,
          workspaceContext: {
            overview: workspace?.overview,
            tone: workspace?.tone,
            glossary: workspace?.glossary,
            workspaceFacts: workspace?.workspaceFacts,
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
