// Direct ServiceNow REST client — Table API (incident) + Knowledge API.
//
// Every helper takes `{ accessToken, instanceUrl, ... }` and calls the
// instance with the user's per-request OAuth token, so ServiceNow enforces the
// caller's own roles/ACLs on every read and write. Mirrors lib/atlassian-api.mjs.

function authHeaders(accessToken, extra) {
  return { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', ...(extra || {}) };
}

async function getJson(url, accessToken) {
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ServiceNow ${res.status}: ${body.slice(0, 300)}`);
  }
  return await res.json();
}

async function sendJson(method, url, accessToken, body) {
  const res = await fetch(url, {
    method,
    headers: authHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ServiceNow ${res.status}: ${text.slice(0, 300)}`);
  }
  return await res.json();
}

const tableBase = (instanceUrl) => `${instanceUrl}/api/now/table`;

// `display_value=all` returns { display_value, value } objects; this flattens
// to the human-readable string for compact tool output.
function dv(field) {
  if (field && typeof field === 'object') return field.display_value ?? field.value ?? null;
  return field ?? null;
}

function mapIncident(r) {
  return {
    sys_id: dv(r.sys_id),
    number: dv(r.number),
    short_description: dv(r.short_description),
    description: dv(r.description),
    state: dv(r.state),
    priority: dv(r.priority),
    urgency: dv(r.urgency),
    impact: dv(r.impact),
    category: dv(r.category),
    assigned_to: dv(r.assigned_to),
    caller_id: dv(r.caller_id),
    opened_at: dv(r.opened_at),
    sys_created_on: dv(r.sys_created_on),
  };
}

// ── Knowledge ────────────────────────────────────────────────────────────────

// Search the knowledge base. Prefers the dedicated Knowledge Management API;
// falls back to the kb_knowledge table if that API isn't installed/available
// on the instance.
export async function searchKnowledge({ instanceUrl, accessToken, query, limit = 10 }) {
  const kmUrl = `${instanceUrl}/api/sn_km_api/knowledge/articles`
    + `?query=${encodeURIComponent(query || '')}`
    + `&limit=${limit}`
    + `&fields=${encodeURIComponent('number,short_description,text')}`;
  try {
    const data = await getJson(kmUrl, accessToken);
    const articles = data?.result?.articles || data?.result || [];
    return articles.map((a) => ({
      number: a.number || a.id || null,
      title: a.title || a.short_description || null,
      snippet: (a.snippet || a.text || '').toString().replace(/<[^>]+>/g, '').slice(0, 600),
      score: a.score ?? null,
    }));
  } catch (err) {
    // KM API absent (404) or not licensed — fall back to the table directly.
    if (!/\b40[0-9]\b/.test(err.message)) throw err;
    const q = `short_descriptionLIKE${query}^ORtextLIKE${query}^latest=true`;
    const tableUrl = `${tableBase(instanceUrl)}/kb_knowledge`
      + `?sysparm_query=${encodeURIComponent(q)}`
      + `&sysparm_limit=${limit}`
      + `&sysparm_fields=${encodeURIComponent('number,short_description,text')}`
      + `&sysparm_display_value=true`;
    const data = await getJson(tableUrl, accessToken);
    return (data.result || []).map((a) => ({
      number: dv(a.number),
      title: dv(a.short_description),
      snippet: (dv(a.text) || '').toString().replace(/<[^>]+>/g, '').slice(0, 600),
      score: null,
    }));
  }
}

// ── Incidents ────────────────────────────────────────────────────────────────

// List incidents for the current user. `scope` controls whose incidents:
//   'caller'   → incidents the user opened (caller_id)   — default, end-user view
//   'assigned' → incidents assigned to the user (assigned_to) — agent view
export async function listIncidents({ instanceUrl, accessToken, scope = 'caller', state, limit = 20 }) {
  const userExpr = 'javascript:gs.getUserID()';
  const field = scope === 'assigned' ? 'assigned_to' : 'caller_id';
  let q = `${field}=${userExpr}`;
  if (state) q += `^state=${state}`;
  q += '^ORDERBYDESCsys_created_on';
  const url = `${tableBase(instanceUrl)}/incident`
    + `?sysparm_query=${encodeURIComponent(q)}`
    + `&sysparm_limit=${limit}`
    + `&sysparm_display_value=true`
    + `&sysparm_fields=${encodeURIComponent('number,short_description,state,priority,opened_at,sys_id')}`;
  const data = await getJson(url, accessToken);
  return (data.result || []).map(mapIncident);
}

// Fetch one incident by number (INC...) or by sys_id.
export async function getIncident({ instanceUrl, accessToken, idOrNumber }) {
  const id = String(idOrNumber || '').trim();
  if (/^inc/i.test(id)) {
    const url = `${tableBase(instanceUrl)}/incident`
      + `?sysparm_query=${encodeURIComponent(`number=${id}`)}`
      + `&sysparm_limit=1`
      + `&sysparm_display_value=all`;
    const data = await getJson(url, accessToken);
    const r = (data.result || [])[0];
    return r ? mapIncident(r) : null;
  }
  const url = `${tableBase(instanceUrl)}/incident/${encodeURIComponent(id)}?sysparm_display_value=all`;
  const data = await getJson(url, accessToken);
  return data.result ? mapIncident(data.result) : null;
}

export async function createIncident({ instanceUrl, accessToken, short_description, description, urgency, impact, category }) {
  const body = { short_description, caller_id: 'javascript:gs.getUserID()' };
  if (description) body.description = description;
  if (urgency) body.urgency = String(urgency);
  if (impact) body.impact = String(impact);
  if (category) body.category = category;
  const url = `${tableBase(instanceUrl)}/incident?sysparm_display_value=all`;
  const data = await sendJson('POST', url, accessToken, body);
  return data.result ? mapIncident(data.result) : null;
}

export async function updateIncident({ instanceUrl, accessToken, sys_id, fields }) {
  const url = `${tableBase(instanceUrl)}/incident/${encodeURIComponent(sys_id)}?sysparm_display_value=all`;
  const data = await sendJson('PATCH', url, accessToken, fields || {});
  return data.result ? mapIncident(data.result) : null;
}

// Add a customer-visible comment and/or an internal work note to an incident.
export async function addIncidentComment({ instanceUrl, accessToken, sys_id, comment, workNote }) {
  const fields = {};
  if (comment) fields.comments = comment;
  if (workNote) fields.work_notes = workNote;
  const url = `${tableBase(instanceUrl)}/incident/${encodeURIComponent(sys_id)}?sysparm_display_value=all`;
  const data = await sendJson('PATCH', url, accessToken, fields);
  return data.result ? mapIncident(data.result) : null;
}
