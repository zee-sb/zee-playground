// Navigator Expert management API.
//
// NOTE: file name preserved as navigator-assistant.mjs (the URL path
// `/api/navigator-assistant` stays as the wire address) but every Navigator
// concept inside is now named "Expert".
//
// Six actions (single dispatcher, mirrors api/navigator-setup.mjs):
//   - list                       — fetch all persisted Experts for branch
//   - templates                  — return the curated template catalog
//   - create-from-template       — preview a drafted Expert from a
//                                  template, with auto-matched pages and
//                                  conflict warnings; does NOT save
//   - create-from-description    — streaming NL→drafted Expert
//   - check-conflicts            — LLM-judge conflict detection
//   - save                       — persist a drafted Expert to the DB
//   - bulk-save                  — reconcile a full Experts array
//   - delete                     — remove a saved Expert
//   - scaffold-flow              — kept as `scaffold-flow` action name
//                                  (workflow scaffolder)

import OpenAI from 'openai';
import { withStaffbaseContext } from '../lib/staffbase.mjs';
import {
  getBlueprint,
  listExperts,
  createExpert,
  updateExpert,
  deleteExpert,
} from '../lib/blueprints.mjs';
import { embed, rankByTopic } from '../lib/embeddings.mjs';
import { listTemplates, getTemplate } from '../lib/assistant-templates.mjs';
import { dbConfigured } from '../lib/db.mjs';
import { pairwiseAssistantOverlap as pairwiseExpertOverlap } from '../lib/navigator-health.mjs';
import { resolveBranchId, getTenantContext } from '../lib/tenants.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');
    // Resolve active tenant once and stash it on the request so handlers can
    // read it without re-parsing the URL.
    const branchId = await resolveBranchId(req);
    const tenantCtx = branchId ? await getTenantContext(branchId) : null;
    if (branchId && !tenantCtx) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }
    req._activeBranchId = branchId;
    const dispatch = async () => {
      if (action === 'list')                    return await handleList(req, res);
      if (action === 'templates')               return await handleTemplates(req, res);
      if (action === 'create-from-template')    return await handleCreateFromTemplate(req, res);
      if (action === 'create-from-description') return await handleCreateFromDescription(req, res);
      if (action === 'check-conflicts')         return await handleCheckConflicts(req, res);
      if (action === 'save')                    return await handleSave(req, res);
      if (action === 'bulk-save')               return await handleBulkSave(req, res);
      if (action === 'delete')                  return await handleDelete(req, res, url);
      if (action === 'scaffold-flow')           return await handleScaffoldWorkflow(req, res);
      res.status(400).json({ error: 'unknown action' });
    };
    if (tenantCtx) {
      return await withStaffbaseContext(tenantCtx, dispatch);
    }
    return await dispatch();
  } catch (err) {
    res.status(500).json({ error: err.message || 'internal error' });
  }
}

async function getActiveBranchId(req) {
  return req?._activeBranchId || null;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

// ── list ───────────────────────────────────────────────────────────────────

async function handleList(req, res) {
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const branchId = await getActiveBranchId(req);
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });
  const rows = await listExperts(branchId);
  return res.status(200).json({ branchId, experts: rows });
}

// ── templates ──────────────────────────────────────────────────────────────

async function handleTemplates(req, res) {
  const templates = listTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    lucideIcon: t.lucideIcon,
    shortDescription: t.shortDescription,
    topicKeywords: t.topicKeywords,
    suggestedAudience: t.suggestedAudience,
  }));
  // Tag each template with a "suggested for you" hint if its topic keywords
  // overlap with the workspace's glossary or department names.
  const branchId = await getActiveBranchId(req);
  let suggestedFlags = {};
  if (branchId && dbConfigured()) {
    try {
      const bp = await getBlueprint(branchId);
      if (bp) {
        const haystack = [
          ...(bp.blueprint?.workspace?.glossary || []).map((g) => g.term?.toLowerCase()).filter(Boolean),
          ...(bp.blueprint?.orgSignals?.departments || []).map((d) => d.name?.toLowerCase()).filter(Boolean),
          ...(bp.blueprint?.groups || []).map((g) => g.name?.toLowerCase()).filter(Boolean),
        ];
        for (const t of templates) {
          const hit = t.topicKeywords.some((kw) =>
            haystack.some((h) => h.includes(kw.toLowerCase()) || kw.toLowerCase().includes(h))
          );
          suggestedFlags[t.id] = hit;
        }
      }
    } catch { /* ignore — show templates without flags */ }
  }
  return res.status(200).json({ templates, suggestedFlags });
}

// ── create-from-template ───────────────────────────────────────────────────

async function handleCreateFromTemplate(req, res) {
  const body = await readJsonBody(req);
  const templateId = body.templateId;
  const audienceOverride = body.audience;
  if (!templateId) return res.status(400).json({ error: 'templateId required' });
  const tpl = getTemplate(templateId);
  if (!tpl) return res.status(404).json({ error: 'template not found' });

  const branchId = await getActiveBranchId(req);
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });
  const bp = await getBlueprint(branchId);
  if (!bp) return res.status(404).json({ error: 'no_blueprint', code: 'discovery_required' });

  const blueprint = bp.blueprint || {};
  const pages = blueprint.pages || [];
  const pageEmbeddings = bp.page_embeddings || [];

  // Match pages by embedding the template's matchPrompt and ranking against
  // the cached page embeddings.
  let matchedPages = [];
  if (pages.length > 0 && pageEmbeddings.length > 0) {
    try {
      const [topicVec] = await embed([tpl.matchPrompt]);
      const ranked = rankByTopic(
        topicVec,
        pageEmbeddings.map((p) => ({ id: p.pageId, vec: p.vector })),
        5,
      );
      const pageById = new Map(pages.map((p) => [p.id, p]));
      matchedPages = ranked
        .filter((r) => r.score > 0.2) // drop weak matches
        .map((r) => ({ ...pageById.get(r.id), score: r.score }))
        .filter((p) => p.id);
    } catch (err) {
      console.warn('[navigator-expert] page match failed:', err.message);
    }
  }

  // Compose the final system prompt.
  const tenant = blueprint.workspace || {};
  const instructions = composeInstructions({
    mainInstructions: tenant.mainInstructions,
    glossary: tenant.glossary,
    promptBody: tpl.promptBody,
    matchedPages,
  });

  // Run conflict detection inline (best-effort — empty if it fails).
  const existing = await listExperts(branchId);
  let conflicts = [];
  try {
    conflicts = await detectConflicts(existing, {
      name: tpl.name,
      description: tpl.shortDescription,
      promptBody: tpl.promptBody,
    });
  } catch (err) {
    console.warn('[navigator-expert] conflict detection failed:', err.message);
  }

  const draft = {
    name: tpl.name,
    icon: tpl.icon,
    description: tpl.shortDescription,
    instructions,
    audience: audienceOverride || tpl.suggestedAudience,
    connectionIds: [],
    status: 'active',
    // UI-only, not persisted:
    _matchedPages: matchedPages,
    _templateId: tpl.id,
  };

  return res.status(200).json({ draft, conflicts });
}

// ── create-from-description (streaming NDJSON) ─────────────────────────────

async function handleCreateFromDescription(req, res) {
  const body = await readJsonBody(req);
  const description = (body.description || '').trim();
  const audience = body.audience || { everyone: true, roles: [], locations: [] };
  if (!description) return res.status(400).json({ error: 'description required' });

  const branchId = await getActiveBranchId(req);
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });
  const bp = await getBlueprint(branchId);
  if (!bp) return res.status(404).json({ error: 'no_blueprint', code: 'discovery_required' });

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const emit = (obj) => res.write(JSON.stringify(obj) + '\n');

  try {
    const blueprint = bp.blueprint || {};
    const tenant = blueprint.workspace || {};
    const pages = blueprint.pages || [];
    const pageEmbeddings = bp.page_embeddings || [];

    // Step 1 — generate name + icon + description from the user's input.
    emit({ step: 1, totalSteps: 4, label: 'Generating name & icon' });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY missing');
    const client = new OpenAI({ apiKey });

    const namingResp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Generate an Expert identity from the user's description. Return strict JSON only:
{ "name": "3-5 word Expert name", "icon": "single emoji", "shortDescription": "one-sentence employee-facing description" }
Workspace tone: ${(tenant.tone || []).join(', ') || 'professional'}.
Workspace name: ${tenant.companyName || 'this company'}.`,
        },
        { role: 'user', content: description },
      ],
    });
    const naming = JSON.parse(namingResp.choices[0].message.content);

    // Step 2 — match pages by embedding the description.
    emit({ step: 2, totalSteps: 4, label: 'Finding relevant pages' });
    let matchedPages = [];
    if (pages.length > 0 && pageEmbeddings.length > 0) {
      const [topicVec] = await embed([description]);
      const ranked = rankByTopic(
        topicVec,
        pageEmbeddings.map((p) => ({ id: p.pageId, vec: p.vector })),
        5,
      );
      const pageById = new Map(pages.map((p) => [p.id, p]));
      matchedPages = ranked
        .filter((r) => r.score > 0.2)
        .map((r) => ({ ...pageById.get(r.id), score: r.score }))
        .filter((p) => p.id);
    }

    // Step 3 — write the system prompt body. We let the LLM draft a focused
    // role description; then we prepend the workspace main instructions and
    // append the matched-page references.
    emit({ step: 3, totalSteps: 4, label: 'Writing system prompt' });
    const promptResp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Draft a system prompt body (120-220 words) for a Navigator Expert. The customer described what they want; you write the "Role / Scope / Tone / Grounding / Escalation" prompt.

Format: plain text (no markdown headings). Start with "You are <name>." Include 3-5 specific topics in scope, the tone to use, instruction to ground answers in the linked knowledge sources, and an escalation rule for what to route to a human.

Workspace context:
- Company: ${tenant.companyName || 'this company'} — ${tenant.companyMission || ''}
- Tone: ${(tenant.tone || []).join(', ')}
- Glossary terms to recognize: ${(tenant.glossary || []).slice(0, 8).map((g) => g.term).join(', ')}
- Linked pages available: ${matchedPages.map((p) => p.title).join(', ') || 'none specifically matched'}

Return strict JSON: { "promptBody": "..." }`,
        },
        {
          role: 'user',
          content: `Expert name: ${naming.name}\nDescription from customer:\n${description}`,
        },
      ],
    });
    const promptJson = JSON.parse(promptResp.choices[0].message.content);
    const instructions = composeInstructions({
      mainInstructions: tenant.mainInstructions,
      glossary: tenant.glossary,
      promptBody: promptJson.promptBody,
      matchedPages,
    });

    // Step 4 — conflict detection against existing Experts.
    emit({ step: 4, totalSteps: 4, label: 'Checking for conflicts' });
    const existing = await listExperts(branchId);
    let conflicts = [];
    try {
      conflicts = await detectConflicts(existing, {
        name: naming.name,
        description: naming.shortDescription,
        promptBody: promptJson.promptBody,
      });
    } catch (err) {
      console.warn('[navigator-expert] conflict detection failed:', err.message);
    }

    const draft = {
      name: naming.name,
      icon: naming.icon || '✨',
      description: naming.shortDescription || '',
      instructions,
      audience,
      connectionIds: [],
      status: 'active',
      _matchedPages: matchedPages,
    };

    emit({ type: 'done', draft, conflicts });
    res.end();
  } catch (err) {
    emit({ type: 'error', message: err.message });
    res.end();
  }
}

// ── check-conflicts ────────────────────────────────────────────────────────

async function handleCheckConflicts(req, res) {
  const body = await readJsonBody(req);
  const candidate = body.candidate;
  if (!candidate?.name) return res.status(400).json({ error: 'candidate.name required' });
  const branchId = await getActiveBranchId(req);
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });
  const existing = await listExperts(branchId);
  const conflicts = await detectConflicts(existing, candidate);
  return res.status(200).json({ conflicts });
}

// Thin wrapper kept for callers that still import detectConflicts. The
// actual LLM judge lives in lib/navigator-health.mjs so the Health Tab
// and the AI creator share one implementation.
async function detectConflicts(existing, candidate) {
  return pairwiseExpertOverlap(existing, candidate);
}

// ── save ───────────────────────────────────────────────────────────────────

async function handleSave(req, res) {
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const body = await readJsonBody(req);
  // Accept legacy `assistant` payloads alongside the new `expert` shape.
  const expert = body.expert || body.assistant;
  const source = body.source;
  const templateId = body.templateId;
  if (!expert?.name) return res.status(400).json({ error: 'expert.name required' });
  const branchId = await getActiveBranchId(req);
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });
  const saved = await createExpert({
    branchId,
    expert,
    source: source || 'manual',
    templateId: templateId || null,
    userId: null,
  });
  return res.status(200).json({ expert: saved });
}

// ── bulk-save ──────────────────────────────────────────────────────────────
// Reconcile a full experts array against the DB: upsert anything in the
// payload, delete anything in DB that's not in the payload. Used by the
// Studio's useConfigStore to push every local change through to the canonical
// store. Preserves DB-assigned UUIDs by matching on the `id` field.
//
// Payload shape: { experts: [{ id?, name, icon, description, instructions,
//   connectionIds, audience, status, source?, templateId? }, ...] }
async function handleBulkSave(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const body = await readJsonBody(req);
  // Accept both new `experts` and legacy `assistants` arrays.
  const incoming = Array.isArray(body.experts)
    ? body.experts
    : (Array.isArray(body.assistants) ? body.assistants : null);
  if (!incoming) return res.status(400).json({ error: 'experts array required' });
  const branchId = await getActiveBranchId(req);
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });

  const existing = await listExperts(branchId);
  const existingById = new Map(existing.map((a) => [a.id, a]));
  const incomingIds = new Set(incoming.map((a) => a.id).filter(Boolean));

  // Upsert each incoming row.
  const saved = [];
  for (const a of incoming) {
    if (!a?.name) continue;
    // Accept legacy `connectorIds` field on input.
    const connectionIds = a.connectionIds || a.connectorIds || [];
    if (a.id && existingById.has(a.id)) {
      const updated = await updateExpert({
        branchId,
        id: a.id,
        patch: {
          name: a.name,
          icon: a.icon,
          description: a.description,
          instructions: a.instructions,
          audience: a.audience,
          connectionIds,
          status: a.status,
        },
      });
      if (updated) saved.push(updated);
    } else {
      const created = await createExpert({
        branchId,
        expert: { ...a, connectionIds },
        source: a.source || 'manual',
        templateId: a.templateId || null,
        userId: null,
      });
      saved.push(created);
    }
  }

  // Delete anything that fell out of the payload.
  for (const a of existing) {
    if (!incomingIds.has(a.id)) {
      await deleteExpert({ branchId, id: a.id });
    }
  }

  return res.status(200).json({ branchId, experts: saved });
}

// ── delete ─────────────────────────────────────────────────────────────────

async function handleDelete(req, res, url) {
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const id = url.searchParams.get('id');
  if (!id) return res.status(400).json({ error: 'id required' });
  const branchId = await getActiveBranchId(req);
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });
  const ok = await deleteExpert({ branchId, id });
  return res.status(ok ? 200 : 404).json({ ok });
}

// ── helpers ────────────────────────────────────────────────────────────────

function composeInstructions({ mainInstructions, glossary, promptBody, matchedPages }) {
  const parts = [];
  if (mainInstructions && mainInstructions.trim()) {
    parts.push(`# Main Navigator Instructions\n\n${mainInstructions.trim()}`);
  }
  if (Array.isArray(glossary) && glossary.length > 0) {
    const glossaryBody = glossary.map((g) => `- **${g.term}** — ${g.definition}`).join('\n');
    parts.push(`# Glossary\n\n${glossaryBody}`);
  }
  parts.push(`# Role\n\n${(promptBody || '').trim()}`);
  if (Array.isArray(matchedPages) && matchedPages.length > 0) {
    const sources = matchedPages
      .map((p) => `- ${p.title}${p.description ? ' — ' + p.description : ''}`)
      .join('\n');
    parts.push(`# Knowledge sources\n\n${sources}`);
  }
  return parts.join('\n\n---\n\n');
}

// ── scaffold-workflow ──────────────────────────────────────────────────────
//
// Best-effort: turn a one-sentence description + the workspace's available
// connections into a draft workflow JSON the admin can refine. Returns:
//   { ok, workflow: { name, trigger, goal, mode, steps[] }, unknownTools: [...] }

async function handleScaffoldWorkflow(req, res) {
  const body = await readJsonBody(req);
  const description = (body?.description || '').trim();
  // Accept legacy `connectors` array alongside new `connections`.
  const connections = Array.isArray(body?.connections)
    ? body.connections
    : (Array.isArray(body?.connectors) ? body.connectors : []);
  if (!description) return res.status(400).json({ error: 'description required' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  const toolCatalog = [];
  for (const c of connections) {
    // Map legacy kind values too.
    const rawKind = c.kind || 'toolkit';
    const kind = rawKind === 'mcp' ? 'toolkit'
      : rawKind === 'agent' ? 'handoff'
      : rawKind === 'kb' ? 'search'
      : rawKind;
    const tools = Array.isArray(c.tools) ? c.tools : [];
    if (kind === 'handoff') toolCatalog.push(`${c.id} (handoff: ${c.name}) → invoke`);
    else if (kind === 'search') toolCatalog.push(`${c.id} (search source: ${c.name}) → search`);
    else {
      for (const t of tools) toolCatalog.push(`${c.id} (${c.name}) → ${t.id || t.name} — ${t.description || ''}`);
    }
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sys = `You are a workflow designer for an enterprise assistant. Output JSON only.

Step types:
- form: collect user input (fields: id, label, type ['text'|'textarea'|'number'|'email'|'url'|'date'|'select'|'checkbox'|'radio'], required, options? for select/radio)
- tool: invoke a tool. {tool: {connectionId, toolId}, args: {...}} — args may reference earlier form outputs via {{stepId.fieldId}}
- confirm: review summary before commit. summary: {title, rows:[{label,value}], confirmLabel, cancelLabel, cancelTo?}

ONLY reference connection/tool ids from the catalog below. If something isn't available, prefer adding a form step over inventing a tool.

Catalog:
${toolCatalog.join('\n') || '(empty)'}

Return exactly this JSON shape (no markdown, no preamble):
{
  "name": "...",
  "trigger": "Short sentence the employee might say",
  "goal": "What success looks like",
  "mode": "suggested",
  "steps": [ ... ]
}`;

  let parsed = null;
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: description },
      ],
    });
    const txt = resp.choices[0].message.content || '{}';
    parsed = JSON.parse(txt);
  } catch (err) {
    return res.status(502).json({ error: 'scaffold failed', detail: err.message });
  }

  const known = new Set(connections.map((c) => c.id));
  const unknownTools = [];
  for (const s of parsed?.steps || []) {
    if (s.type === 'tool' && !known.has(s.tool?.connectionId || s.tool?.connectorId)) {
      unknownTools.push({ stepId: s.id, connectionId: s.tool?.connectionId || s.tool?.connectorId, toolId: s.tool?.toolId });
    }
  }
  return res.status(200).json({ ok: true, workflow: parsed, unknownTools });
}
