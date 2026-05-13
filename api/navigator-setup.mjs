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
  listPages, listGroups, getUsersTotal,
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

  // ── Deep-content sample: full body for the top 3 posts so the LLM has
  // real employee-reading material to infer tone, internal acronyms, and
  // topic depth.
  const deepPostIds = topPosts.slice(0, 3).map((p) => p.id);
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

  res.status(200).json({
    channels,
    topPosts,
    recentPosts,
    deepPosts: deepPosts.map((p) => ({ id: p.id, title: p.title, contentLength: (p.content || '').length })),
    pages: pages.map((p) => ({
      id: p.id, title: p.title, description: p.description,
      published: p.published, bodyLength: p.bodyLength, locales: p.locales,
    })),
    groups,
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
      usersTotal,
      pagesAnalyzed: pages.length,
      groupsAnalyzed: groups.length,
      deepPostsFetched: deepPosts.length,
    },
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
  const compactTopPosts = topPosts.slice(0, 15).map((p) => ({
    title: p.title,
    teaser: (p.teaser || '').slice(0, 160),
    channelTitle: p.channel?.title,
  }));
  const compactDeep = deepPosts.map((p) => ({
    title: p.title,
    excerpt: (p.content || '').slice(0, 1200),
  }));
  // Pages: the richest knowledge surface. Body excerpts up to 800 chars each.
  const compactPages = (pages || []).slice(0, 12).map((p) => ({
    title: p.title,
    description: p.description,
    bodyExcerpt: (p.bodyExcerpt || '').slice(0, 800),
  }));
  const compactGroups = (groups || []).map((g) => ({
    name: g.name,
    description: g.description,
    isDepartmentGroup: g.isDepartmentGroup,
  }));

  const system = `You analyze an enterprise intranet and produce the foundational configuration for an AI assistant suite called "Navigator". The output is WORKSPACE-LEVEL — not individual Assistants (those come later).

You will receive:
- channels (news surfaces): id, title, real post count
- 15 most-engaged recent posts: title, teaser, channel
- full body of the top 3 posts (richest tone signal)
- pages (deeper reference content like policies, hubs): title, description, body excerpt
- groups (org segmentation + opt-in programs): name, description, isDepartmentGroup
- user-directory signals: departments, locations, top authors, custom field keys
- detected workspace languages

Produce STRICT JSON with this exact shape:

{
  "companyName": "string — infer from content (e.g. 'Staffbase'); hedge with 'this company' if genuinely unclear",
  "companyMission": "one short sentence describing what this company DOES — its product/service/mission. Infer from page bodies and post content. Hedge if unclear.",
  "overview": "one paragraph on the workspace: who uses it, how, what dominates the content mix",
  "tone": ["2-3 short adjectives describing voice (e.g. 'warm', 'celebratory', 'news-driven', 'formal')"],
  "mainInstructions": "the top-level Navigator orchestrator system prompt that every Assistant inherits. Follow EXACTLY the template below. 400-650 words.",
  "glossary": [{ "term": "...", "definition": "..." }, ...],
  "workspaceFacts": ["short phrase fact", ...],
  "questionTypes": ["question category Navigator should handle", ...]
}

\`questionTypes\` is REQUIRED — 6-12 concrete categories as short phrases (e.g. "Company news & leadership updates", "HR policies, benefits, PTO", "IT support and access requests", "Onboarding for new hires", "Travel & expense policies", "Internal directory lookups", "Product roadmap & strategy", "Event participation & registration"). Base them on the actual signals (channels, pages, groups, departments). The same categories should appear inside \`mainInstructions\` under the "WHAT NAVIGATOR HELPS WITH" section as bullets, but you MUST also return them in the \`questionTypes\` array. Never leave \`questionTypes\` empty.

\`glossary\` should be 8-15 entries of WORKSPACE-SPECIFIC acronyms, division names, internal programs, ERG names, product nicknames. Skip generic enterprise terms (HR, IT, PTO, ETA, EOD). Mine page bodies, post bodies, group names, and custom field keys.

\`mainInstructions\` template — produce it filled in, NOT with placeholders. Use these section headings verbatim, as plain text (no markdown):

  ROLE
  <1-2 sentences. State that this is Navigator, the AI assistant for [companyName] employees. Describe the AI's purpose at a high level (help employees find information, answer questions about the company, route to the right Assistant, ground answers in linked intranet content). DO NOT use sycophantic phrases like "Let's work together" or "make this an even better place".>

  ABOUT [COMPANY]
  <2-4 sentences of company context: what [companyName] does, mission/product, scale (using the real user count if available), notable structure (departments, locations). Mention the dominant content themes you observed. Keep it factual.>

  TONE & LANGUAGE
  <2-3 sentences. State the observed tone adjectives as the voice Navigator should adopt. If multiple languages were detected, state the language policy: "Respond in the user's language. Default to <dominant locale>. Supported: <list>." If only one language, just name it.>

  WHAT NAVIGATOR HELPS WITH
  <Bullet list (use "- " prefix) of question categories — same as questionTypes but written naturally as employee-facing items.>

  WHAT NAVIGATOR DOES NOT HANDLE
  <Bullet list. Include: personal/legal/medical advice; confidential HR cases (escalate to HR helpdesk); anything off-topic to work. Adapt to signals if specific exclusions are obvious.>

  ROUTING
  <2-4 sentences naming the major Assistants and when to route to each. Reference the actual department names and content themes you observed.>

  GLOSSARY
  <Inline the workspace glossary as "- TERM — definition" lines so the orchestrator can recognize internal jargon. Include 6-10 highest-value terms (not all of them — keep this section tight).>

  WORKSPACE-SPECIFIC NOTES
  <2-5 sentences of things worth knowing about THIS company that an AI agent helping employees should know. Examples: prominent programs, recent restructuring observed in posts, multi-language workforce specifics, notable ERGs. Avoid generic platitudes.>

Do not output anything outside the JSON object.`;

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
  const compactPages = (pages || []).slice(0, 12).map((p) => ({
    id: p.id, title: p.title, description: p.description,
    bodyExcerpt: (p.bodyExcerpt || '').slice(0, 500),
  }));
  const compactGroups = (groups || []).map((g) => ({
    name: g.name, description: g.description, isDepartmentGroup: g.isDepartmentGroup,
  }));

  const system = `You analyze an enterprise intranet and propose the FULL Assistant lineup for Navigator. The workspace context (overview, glossary, main instructions) has already been generated in a previous pass — you receive it as input. Your job: produce 5-9 Assistants that cover both common universal needs (HR, IT, People Experience, Onboarding, Learning, Travel) AND workspace-specific topic clusters derived from the actual channels, pages, and groups.

You will be given:
- channels (news surfaces) with descriptions + real post counts
- top 20 engaged posts (titles + teasers)
- 3 deep-content post excerpts
- pages (reference content — policies, hubs, deeper than posts)
- groups (org segmentation: department mirrors + program/ERG opt-ins)
- aggregated org signals: departments, locations, top authors, custom field keys
- workspace context from the previous pass (use it to keep the Assistant prompts grounded in this specific company)

Output rules:
- Produce 5-9 Assistants. Aim for COVERAGE — be generous with proposing universal Assistants like HR, IT Helpdesk, People Experience, Onboarding, Learning & Development, Travel & Expenses. Only skip a universal Assistant if there is genuinely NO signal it would be useful here.
- Each Assistant's \`systemPromptSnippet\` must be 120-220 words, written in second-person ("You are..."), with:
  1. Role definition (one sentence).
  2. Scope: 3-5 specific topics it handles, naming actual workspace concepts/channels/pages when relevant.
  3. Tone matching the workspace tone.
  4. Grounding rules (what knowledge sources to use; cite linked content; say "I don't know" if not in sources). When a relevant Page exists, mention pages explicitly as a richer reference source than channel posts.
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
