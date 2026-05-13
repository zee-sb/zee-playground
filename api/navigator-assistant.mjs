// Navigator Assistant management API.
//
// Five actions (single dispatcher, mirrors api/navigator-setup.mjs):
//   - list                       — fetch all persisted Assistants for branch
//   - templates                  — return the curated template catalog
//   - create-from-template       — preview a drafted Assistant from a
//                                  template, with auto-matched pages and
//                                  conflict warnings; does NOT save
//   - create-from-description    — streaming NL→drafted Assistant
//                                  (Milestone C)
//   - check-conflicts            — LLM-judge conflict detection
//   - save                       — persist a drafted Assistant to the DB
//   - delete                     — remove a saved Assistant

import OpenAI from 'openai';
import { getBranch } from '../lib/staffbase.mjs';
import {
  getBlueprint,
  listAssistants,
  createAssistant,
  deleteAssistant,
} from '../lib/blueprints.mjs';
import { embed, rankByTopic } from '../lib/embeddings.mjs';
import { listTemplates, getTemplate } from '../lib/assistant-templates.mjs';
import { dbConfigured } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');
    if (action === 'list')                    return await handleList(req, res);
    if (action === 'templates')               return await handleTemplates(req, res);
    if (action === 'create-from-template')    return await handleCreateFromTemplate(req, res);
    if (action === 'create-from-description') return await handleCreateFromDescription(req, res);
    if (action === 'check-conflicts')         return await handleCheckConflicts(req, res);
    if (action === 'save')                    return await handleSave(req, res);
    if (action === 'delete')                  return await handleDelete(req, res, url);
    res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'internal error' });
  }
}

async function getActiveBranchId() {
  const b = await getBranch();
  return b?.id || null;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

// ── list ───────────────────────────────────────────────────────────────────

async function handleList(_req, res) {
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const branchId = await getActiveBranchId();
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });
  const rows = await listAssistants(branchId);
  return res.status(200).json({ branchId, assistants: rows });
}

// ── templates ──────────────────────────────────────────────────────────────

async function handleTemplates(_req, res) {
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
  const branchId = await getActiveBranchId().catch(() => null);
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

  const branchId = await getActiveBranchId();
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
      console.warn('[navigator-assistant] page match failed:', err.message);
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
  const existing = await listAssistants(branchId);
  let conflicts = [];
  try {
    conflicts = await detectConflicts(existing, {
      name: tpl.name,
      description: tpl.shortDescription,
      promptBody: tpl.promptBody,
    });
  } catch (err) {
    console.warn('[navigator-assistant] conflict detection failed:', err.message);
  }

  const draft = {
    name: tpl.name,
    icon: tpl.icon,
    description: tpl.shortDescription,
    instructions,
    audience: audienceOverride || tpl.suggestedAudience,
    knowledgeBaseIds: [],
    mcpConnectorIds: [],
    externalAgentIds: [],
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

  const branchId = await getActiveBranchId();
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
          content: `Generate an Assistant identity from the user's description. Return strict JSON only:
{ "name": "3-5 word Assistant name", "icon": "single emoji", "shortDescription": "one-sentence employee-facing description" }
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
          content: `Draft a system prompt body (120-220 words) for a Navigator Assistant. The customer described what they want; you write the "Role / Scope / Tone / Grounding / Escalation" prompt.

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
          content: `Assistant name: ${naming.name}\nDescription from customer:\n${description}`,
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

    // Step 4 — conflict detection against existing Assistants.
    emit({ step: 4, totalSteps: 4, label: 'Checking for conflicts' });
    const existing = await listAssistants(branchId);
    let conflicts = [];
    try {
      conflicts = await detectConflicts(existing, {
        name: naming.name,
        description: naming.shortDescription,
        promptBody: promptJson.promptBody,
      });
    } catch (err) {
      console.warn('[navigator-assistant] conflict detection failed:', err.message);
    }

    const draft = {
      name: naming.name,
      icon: naming.icon || '✨',
      description: naming.shortDescription || '',
      instructions,
      audience,
      knowledgeBaseIds: [],
      mcpConnectorIds: [],
      externalAgentIds: [],
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
  const branchId = await getActiveBranchId();
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });
  const existing = await listAssistants(branchId);
  const conflicts = await detectConflicts(existing, candidate);
  return res.status(200).json({ conflicts });
}

async function detectConflicts(existing, candidate) {
  if (!existing.length) return [];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];
  const client = new OpenAI({ apiKey });

  // Summarize existing Assistants compactly: name + description + first ~80 chars of instructions.
  const compactExisting = existing.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description || '',
    instructionsHead: (a.instructions || '').slice(0, 300),
  }));

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Detect topic/audience overlap between a proposed new Assistant and existing Navigator Assistants. Return STRICT JSON:
{ "conflicts": [ { "withAssistantId": "id of existing", "withAssistantName": "...", "severity": "low" | "medium" | "high", "reason": "1-2 sentences", "suggestion": "concrete rename or scope-narrowing tip" } ] }

Severity guide:
- high: the new Assistant covers essentially the same scope as an existing one (employees wouldn't know which to ask). Block the add.
- medium: meaningful overlap in topics or audience but distinguishable. Add with a warning.
- low: minor overlap; mention but allow.

Return an empty array if there are no conflicts.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          candidate: {
            name: candidate.name,
            description: candidate.description,
            promptBody: (candidate.promptBody || candidate.instructions || '').slice(0, 600),
          },
          existing: compactExisting,
        }),
      },
    ],
  });
  const parsed = JSON.parse(resp.choices[0].message.content || '{}');
  return Array.isArray(parsed.conflicts) ? parsed.conflicts : [];
}

// ── save ───────────────────────────────────────────────────────────────────

async function handleSave(req, res) {
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const body = await readJsonBody(req);
  const { assistant, source, templateId } = body;
  if (!assistant?.name) return res.status(400).json({ error: 'assistant.name required' });
  const branchId = await getActiveBranchId();
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });
  const saved = await createAssistant({
    branchId,
    assistant,
    source: source || 'manual',
    templateId: templateId || null,
    userId: null,
  });
  return res.status(200).json({ assistant: saved });
}

// ── delete ─────────────────────────────────────────────────────────────────

async function handleDelete(req, res, url) {
  if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
  const id = url.searchParams.get('id');
  if (!id) return res.status(400).json({ error: 'id required' });
  const branchId = await getActiveBranchId();
  if (!branchId) return res.status(503).json({ error: 'branch_unavailable' });
  const ok = await deleteAssistant({ branchId, id });
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
