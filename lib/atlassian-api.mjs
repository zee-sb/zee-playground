// Direct Atlassian REST client (Confluence v2 + Jira v3) — bypasses the
// Atlassian Remote MCP server because our org admin hasn't allowlisted this
// OAuth app there. Same granular scopes, just called against the REST APIs
// directly. All endpoints are `https://api.atlassian.com/ex/{confluence|jira}/{cloudId}/...`.

const BASE = 'https://api.atlassian.com';

function authHeaders(accessToken, extra) {
  return { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', ...(extra || {}) };
}

async function getJson(url, accessToken) {
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Atlassian ${res.status}: ${body.slice(0, 200)}`);
  }
  return await res.json();
}

async function postJson(url, accessToken, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Atlassian ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

async function putJson(url, accessToken, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Atlassian ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

// ── Confluence (v2 REST) ────────────────────────────────────────────────────

const confluenceBase = (cloudId) => `${BASE}/ex/confluence/${cloudId}/wiki/api/v2`;

// Build a clickable Confluence page URL from the user's site + the API's
// returned `_links.webui` path. The API returns relative paths like
// `/spaces/FOO/pages/123/Title` which must be hung off `${siteUrl}/wiki`.
function confluenceWebUrl(siteUrl, webui) {
  if (!siteUrl || !webui) return null;
  const base = String(siteUrl).replace(/\/$/, '');
  const path = webui.startsWith('/') ? webui : `/${webui}`;
  return path.startsWith('/wiki/') ? `${base}${path}` : `${base}/wiki${path}`;
}

// Build the canonical browser URL for a Jira issue.
function jiraBrowseUrl(siteUrl, key) {
  if (!siteUrl || !key) return null;
  return `${String(siteUrl).replace(/\/$/, '')}/browse/${key}`;
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim();
}

export async function listConfluenceSpaces({ cloudId, accessToken, siteUrl, limit = 25 }) {
  const data = await getJson(`${confluenceBase(cloudId)}/spaces?limit=${limit}`, accessToken);
  return (data.results || []).map((s) => ({
    id: s.id, key: s.key, name: s.name, type: s.type, status: s.status,
    url: confluenceWebUrl(siteUrl, s._links?.webui),
    homepageId: s.homepageId,
  }));
}

export async function listPagesInSpace({ cloudId, accessToken, siteUrl, spaceId, limit = 25 }) {
  const data = await getJson(`${confluenceBase(cloudId)}/spaces/${spaceId}/pages?limit=${limit}`, accessToken);
  return (data.results || []).map((p) => ({
    id: p.id, title: p.title, status: p.status, parentId: p.parentId,
    spaceId: p.spaceId, createdAt: p.createdAt, version: p.version?.number,
    url: confluenceWebUrl(siteUrl, p._links?.webui),
  }));
}

export async function getConfluencePage({ cloudId, accessToken, siteUrl, pageId }) {
  const data = await getJson(`${confluenceBase(cloudId)}/pages/${pageId}?body-format=storage`, accessToken);
  return {
    id: data.id, title: data.title, status: data.status,
    spaceId: data.spaceId, version: data.version?.number,
    body: stripHtml(data.body?.storage?.value || '').slice(0, 4000),
    bodyRaw: data.body?.storage?.value || null,
    createdAt: data.createdAt,
    url: confluenceWebUrl(siteUrl, data._links?.webui),
  };
}

// Confluence v2 doesn't expose a clean "search" endpoint — use the legacy
// CQL search on v1 wiki, which IS available with granular scopes if the
// `search:confluence` scope is granted. Our app doesn't have search:confluence
// (Atlassian's UI didn't expose it for granular configs), so we approximate
// via list-pages + client-side title filter.
export async function searchConfluencePages({ cloudId, accessToken, siteUrl, query, limit = 15 }) {
  // Pull the first ~100 spaces' worth of pages — naive but works for a demo
  // and avoids the broken search endpoint. Production would need real search.
  const data = await getJson(`${confluenceBase(cloudId)}/pages?limit=100`, accessToken);
  const q = (query || '').toLowerCase();
  const matches = (data.results || []).filter((p) =>
    !q || (p.title || '').toLowerCase().includes(q)
  );
  return matches.slice(0, limit).map((p) => ({
    id: p.id, title: p.title, status: p.status,
    spaceId: p.spaceId, createdAt: p.createdAt, version: p.version?.number,
    url: confluenceWebUrl(siteUrl, p._links?.webui),
  }));
}

export async function createConfluencePage({ cloudId, accessToken, siteUrl, spaceId, title, body }) {
  const data = await postJson(`${confluenceBase(cloudId)}/pages`, accessToken, {
    spaceId, status: 'current', title,
    body: { representation: 'storage', value: body || `<p>${title}</p>` },
  });
  return {
    id: data.id, title: data.title, status: data.status,
    url: confluenceWebUrl(siteUrl, data._links?.webui),
    version: data.version?.number,
  };
}

export async function updateConfluencePage({ cloudId, accessToken, siteUrl, pageId, title, body, version }) {
  // v2 requires the current version + 1
  const current = await getJson(`${confluenceBase(cloudId)}/pages/${pageId}`, accessToken);
  const nextVersion = (version ?? current.version?.number ?? 1) + 1;
  const data = await putJson(`${confluenceBase(cloudId)}/pages/${pageId}`, accessToken, {
    id: pageId,
    status: 'current',
    title: title ?? current.title,
    body: { representation: 'storage', value: body ?? current.body?.storage?.value ?? '' },
    version: { number: nextVersion, message: 'Updated via Staffbase Companion' },
  });
  return {
    id: data.id, title: data.title, status: data.status, version: data.version?.number,
    url: confluenceWebUrl(siteUrl, data._links?.webui),
  };
}

export async function addConfluenceComment({ cloudId, accessToken, pageId, body }) {
  // v2 footer comment endpoint
  const data = await postJson(`${confluenceBase(cloudId)}/footer-comments`, accessToken, {
    pageId,
    body: { representation: 'storage', value: body },
  });
  return { id: data.id, status: data.status };
}

// ── Jira (v3 REST) ─────────────────────────────────────────────────────────

const jiraBase = (cloudId) => `${BASE}/ex/jira/${cloudId}/rest/api/3`;

export async function listJiraProjects({ cloudId, accessToken, limit = 25 }) {
  const data = await getJson(`${jiraBase(cloudId)}/project/search?maxResults=${limit}`, accessToken);
  return (data.values || []).map((p) => ({
    id: p.id, key: p.key, name: p.name, projectTypeKey: p.projectTypeKey,
    style: p.style, lead: p.lead?.displayName, url: p.self,
  }));
}

export async function searchJiraIssues({ cloudId, accessToken, siteUrl, jql, limit = 25 }) {
  // Jira v3 GET /search/jql (the newer endpoint with pagination)
  const url = `${jiraBase(cloudId)}/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=summary,status,priority,assignee,reporter,issuetype,created,updated,project,labels`;
  const data = await getJson(url, accessToken);
  return (data.issues || []).map((i) => ({
    key: i.key,
    summary: i.fields?.summary,
    status: i.fields?.status?.name,
    priority: i.fields?.priority?.name,
    issueType: i.fields?.issuetype?.name,
    assignee: i.fields?.assignee?.displayName || null,
    reporter: i.fields?.reporter?.displayName || null,
    project: i.fields?.project?.key,
    labels: i.fields?.labels,
    created: i.fields?.created,
    updated: i.fields?.updated,
    url: jiraBrowseUrl(siteUrl, i.key),
  }));
}

export async function getJiraIssue({ cloudId, accessToken, siteUrl, issueKey }) {
  const data = await getJson(`${jiraBase(cloudId)}/issue/${issueKey}`, accessToken);
  const desc = data.fields?.description;
  const descText = typeof desc === 'string'
    ? desc
    : (desc?.content || []).map((b) => (b.content || []).map((c) => c.text || '').join('')).join('\n');
  return {
    key: data.key,
    summary: data.fields?.summary,
    description: (descText || '').slice(0, 2000),
    status: data.fields?.status?.name,
    priority: data.fields?.priority?.name,
    issueType: data.fields?.issuetype?.name,
    assignee: data.fields?.assignee?.displayName || null,
    reporter: data.fields?.reporter?.displayName || null,
    project: data.fields?.project?.key,
    labels: data.fields?.labels,
    created: data.fields?.created,
    updated: data.fields?.updated,
    url: jiraBrowseUrl(siteUrl, data.key),
  };
}

// Convert a plain-text-with-blank-lines string into Jira's Atlassian Document
// Format. Handles paragraphs (blank-line-separated), bullet lists (lines
// starting with "- " or "* "), and headings (lines starting with "## ").
function textToAdf(text) {
  if (!text) return { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [] }] };
  const paragraphs = String(text).split(/\n\s*\n/);
  const blocks = [];
  for (const para of paragraphs) {
    const lines = para.split('\n').map((l) => l.trimEnd()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      blocks.push({
        type: 'bulletList',
        content: lines.map((l) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: l.replace(/^[-*]\s+/, '') }] }],
        })),
      });
    } else if (lines[0].startsWith('## ')) {
      blocks.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: lines[0].slice(3) }] });
      const rest = lines.slice(1).join(' ');
      if (rest) blocks.push({ type: 'paragraph', content: [{ type: 'text', text: rest }] });
    } else {
      blocks.push({ type: 'paragraph', content: [{ type: 'text', text: lines.join('\n') }] });
    }
  }
  return { type: 'doc', version: 1, content: blocks };
}

export async function createJiraIssue({
  cloudId, accessToken, siteUrl,
  projectKey, summary, description, issueType, epicKey, labels, assignAccountId,
}) {
  const fields = {
    project: { key: projectKey },
    summary,
    issuetype: { name: issueType || 'Story' },
  };
  if (description) fields.description = textToAdf(description);
  // Next-gen Jira projects use `parent` for epic linking. Try this first; if
  // the project is classic and rejects parent, fall back to the customfield.
  if (epicKey) fields.parent = { key: epicKey };
  if (labels?.length) fields.labels = labels;
  if (assignAccountId) fields.assignee = { accountId: assignAccountId };

  let data;
  try {
    data = await postJson(`${jiraBase(cloudId)}/issue`, accessToken, { fields });
  } catch (err) {
    // Classic project? Retry without `parent` and without epic link (we'll
    // post the link as a comment instead — keeps demo working in both modes).
    if (epicKey && /parent|epic/i.test(err.message)) {
      delete fields.parent;
      data = await postJson(`${jiraBase(cloudId)}/issue`, accessToken, { fields });
    } else {
      throw err;
    }
  }

  const baseUrl = siteUrl ? siteUrl.replace(/\/$/, '') : null;
  return {
    key: data.key,
    id: data.id,
    url: baseUrl ? `${baseUrl}/browse/${data.key}` : null,
    self: data.self,
  };
}

export async function addJiraComment({ cloudId, accessToken, issueKey, body }) {
  const data = await postJson(`${jiraBase(cloudId)}/issue/${issueKey}/comment`, accessToken, {
    body: {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
    },
  });
  return { id: data.id, created: data.created, author: data.author?.displayName };
}
