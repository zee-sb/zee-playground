// Navigator Health Check — cross-entity validation engine.
//
// v7 unification: rules collapse to "broken/disconnected connector ref",
// "audience overlap on connector", "orphan connector", etc. Kind-specific
// nuance lives in the description (e.g. "Onboarding Buddy references a
// missing knowledge base") not in the rule structure.

import OpenAI from 'openai';
import { normalizeConfig } from './workspace-config.mjs';

export const ISSUE_IDS = {
  // Broken references (errors)
  ASST_BROKEN_CONNECTOR:       'assistant.broken-connector-ref',
  ASST_DISCONNECTED_CONNECTOR: 'assistant.disconnected-connector-ref',
  FLOW_BROKEN_CONNECTOR:       'flow.broken-connector-ref',
  FLOW_UNKNOWN_TOOL_ID:        'flow.unknown-tool-id',
  // Scope conflicts (warnings)
  ASST_AUDIENCE_OVERLAP:       'assistant.audience-overlap-on-connector',
  ASST_DOMAIN_OVERLAP:         'assistant.domain-overlap',
  FLOW_DUPLICATE_TRIGGER:      'flow.duplicate-trigger',
  ASST_LLM_OVERLAP:            'assistant.llm-overlap',
  // Orphan (warnings)
  CONNECTOR_ORPHAN:            'connector.orphan',
  FLOW_DEAD_TOOLS:             'flow.dead-tools',
  ASST_AUDIENCE_EMPTY:         'assistant.audience-empty',
  // State (warnings)
  WORKSPACE_ALL_DRAFT:         'workspace.all-assistants-draft',
  CONNECTOR_DEGRADED_NO_FALLBACK: 'connector.degraded-no-fallback',
  // Blueprint coverage (info)
  BP_UNUSED_GROUPS:            'blueprint.unused-groups',
  BP_UNUSED_GLOSSARY:          'blueprint.unused-glossary',
  BP_EMPTY_INSTRUCTIONS:       'blueprint.empty-main-instructions',
};

const CATEGORY = {
  'broken-references': 'Broken references',
  'scope-conflicts':   'Scope conflicts',
  'unused':            'Unused / orphan',
  'state':             'State machine',
  'blueprint':         'Blueprint coverage',
};

function categoryOf(id) {
  if (id.startsWith('assistant.broken') || id.startsWith('assistant.disconnected') || id.startsWith('flow.broken') || id.startsWith('flow.unknown')) return 'broken-references';
  if (id.includes('overlap') || id.includes('duplicate')) return 'scope-conflicts';
  if (id.endsWith('orphan') || id.endsWith('dead-tools') || id.endsWith('audience-empty')) return 'unused';
  if (id.startsWith('blueprint.')) return 'blueprint';
  return 'state';
}

function subject(type, id, name) {
  return { type, id: id || null, name: name || id || '—' };
}

function emit(issues, partial) {
  issues.push({ category: categoryOf(partial.id), ...partial });
}

const KIND_LABEL = { mcp: 'connector', agent: 'agent', kb: 'knowledge base' };
function kindLabel(c) { return KIND_LABEL[c?.kind] || 'connector'; }

export async function checkConfigHealth({ config, blueprint, assistants, deep = false } = {}) {
  const norm = normalizeConfig(config || {});
  const connectors = norm.connectors;
  const flows = norm.flows;
  const asstList = assistants || [];

  const connectorById = Object.fromEntries(connectors.map((c) => [c.id, c]));
  const asstById = Object.fromEntries(asstList.map((a) => [a.id, a]));

  const issues = [];

  // ── Broken assistant→connector references ─────────────────────────────────
  for (const a of asstList) {
    if (a.status !== 'active') continue;
    for (const id of a.connectorIds || []) {
      const c = connectorById[id];
      if (!c) {
        emit(issues, {
          id: ISSUE_IDS.ASST_BROKEN_CONNECTOR,
          severity: 'error',
          title: 'Assistant references a missing connector',
          description: `${a.name} lists connector "${id}" which doesn't exist in this workspace.`,
          subject: subject('assistant', a.id, a.name),
          relatedSubjects: [subject('connector', id, id)],
          suggestion: 'Remove the broken reference, or add the connector back.',
          autoFix: { action: 'removeFromAssistant', payload: { id: a.id, field: 'connectorIds', value: id } },
        });
      } else if (c.status === 'disconnected') {
        emit(issues, {
          id: ISSUE_IDS.ASST_DISCONNECTED_CONNECTOR,
          severity: 'error',
          title: `Assistant uses a disconnected ${kindLabel(c)}`,
          description: `${a.name} links to ${c.name}, currently disconnected. Calls will fail silently.`,
          subject: subject('assistant', a.id, a.name),
          relatedSubjects: [subject('connector', c.id, c.name)],
          suggestion: `Reconnect ${c.name}, or remove it from this assistant.`,
          autoFix: { action: 'removeFromAssistant', payload: { id: a.id, field: 'connectorIds', value: id } },
        });
      }
    }
    const aud = a.audience || {};
    if (!aud.everyone && !(aud.groups || []).length && !(aud.roles || []).length && !(aud.locations || []).length) {
      emit(issues, {
        id: ISSUE_IDS.ASST_AUDIENCE_EMPTY,
        severity: 'warning',
        title: 'Assistant has no audience',
        description: `${a.name} is active but reaches nobody — "Everyone" is off and no groups are selected.`,
        subject: subject('assistant', a.id, a.name),
        suggestion: 'Either turn on "Everyone" or add at least one target group.',
        autoFix: { action: 'patchAssistant', payload: { id: a.id, patch: { audience: { ...aud, everyone: true } } } },
      });
    }
  }

  // ── Flow→connector references ─────────────────────────────────────────────
  for (const f of flows) {
    if (f.status !== 'active') continue;
    const tools = Array.isArray(f.tools) ? f.tools : [];
    let liveCount = 0;
    for (const t of tools) {
      const cid = typeof t === 'string' ? t : t?.connectorId;
      const toolId = typeof t === 'string' ? null : t?.toolId || null;
      const c = connectorById[cid];
      if (!c) {
        emit(issues, {
          id: ISSUE_IDS.FLOW_BROKEN_CONNECTOR,
          severity: 'error',
          title: 'Flow references a missing connector',
          description: `Flow "${f.name}" uses connector "${cid}" which doesn't exist.`,
          subject: subject('flow', f.id, f.name),
          relatedSubjects: [subject('connector', cid, cid)],
          suggestion: 'Remove or repoint the tool reference in this flow.',
        });
      } else if (c.status === 'disconnected') {
        emit(issues, {
          id: ISSUE_IDS.FLOW_BROKEN_CONNECTOR,
          severity: 'error',
          title: `Flow uses a disconnected ${kindLabel(c)}`,
          description: `Flow "${f.name}" uses ${c.name}, which is disconnected.`,
          subject: subject('flow', f.id, f.name),
          relatedSubjects: [subject('connector', c.id, c.name)],
          suggestion: `Reconnect ${c.name}, or remove it from this flow.`,
        });
      } else if (toolId && c.kind === 'mcp') {
        // For MCP connectors, validate the toolId is declared. Agents/KBs
        // use implicit invoke/search and skip this check.
        const hasTool = (c.tools || []).some((tt) => tt.id === toolId || tt.name === toolId);
        if (!hasTool) {
          emit(issues, {
            id: ISSUE_IDS.FLOW_UNKNOWN_TOOL_ID,
            severity: 'error',
            title: 'Flow references an unknown tool',
            description: `Flow "${f.name}" uses tool "${toolId}" on ${c.name}, which doesn't expose a tool with that id.`,
            subject: subject('flow', f.id, f.name),
            relatedSubjects: [subject('connector', c.id, c.name)],
            suggestion: 'Pick a different tool from the connector, or remove this step.',
          });
        } else {
          liveCount++;
        }
      } else {
        liveCount++;
      }
    }
    if (tools.length > 0 && liveCount === 0) {
      emit(issues, {
        id: ISSUE_IDS.FLOW_DEAD_TOOLS,
        severity: 'warning',
        title: 'Flow has no usable tools',
        description: `Flow "${f.name}" is active but every connector it references is missing or disconnected.`,
        subject: subject('flow', f.id, f.name),
        suggestion: 'Reconnect at least one connector, or archive this flow.',
        autoFix: { action: 'setFlowStatus', payload: { id: f.id, status: 'archived' } },
      });
    }
  }

  // ── Scope conflicts ───────────────────────────────────────────────────────
  const activeAsst = asstList.filter((a) => a.status === 'active');
  for (let i = 0; i < activeAsst.length; i++) {
    for (let j = i + 1; j < activeAsst.length; j++) {
      const a = activeAsst[i], b = activeAsst[j];
      const sharedIds = (a.connectorIds || []).filter((id) => (b.connectorIds || []).includes(id));
      if (!sharedIds.length) continue;
      if (!audienceIntersect(a.audience, b.audience)) continue;
      const sharedNames = sharedIds.map((id) => connectorById[id]?.name || id).join(', ');
      emit(issues, {
        id: ISSUE_IDS.ASST_AUDIENCE_OVERLAP,
        severity: 'warning',
        title: 'Two assistants compete for the same scope',
        description: `${a.name} and ${b.name} both reach overlapping audiences AND both use ${sharedNames}. Employees won't know which one to ask.`,
        subject: subject('assistant', a.id, a.name),
        relatedSubjects: [subject('assistant', b.id, b.name)],
        suggestion: `Narrow the audience or scope of one of them.`,
      });
    }
  }

  for (let i = 0; i < activeAsst.length; i++) {
    for (let j = i + 1; j < activeAsst.length; j++) {
      const a = activeAsst[i], b = activeAsst[j];
      const domA = new Set(domainsForAssistant(a, connectorById));
      const domB = new Set(domainsForAssistant(b, connectorById));
      let shared = 0;
      const sharedTerms = [];
      for (const d of domA) if (domB.has(d)) { shared++; sharedTerms.push(d); }
      if (shared >= 2) {
        emit(issues, {
          id: ISSUE_IDS.ASST_DOMAIN_OVERLAP,
          severity: 'warning',
          title: 'Assistants share overlapping topic areas',
          description: `${a.name} and ${b.name} both claim coverage of: ${sharedTerms.slice(0, 5).join(', ')}.`,
          subject: subject('assistant', a.id, a.name),
          relatedSubjects: [subject('assistant', b.id, b.name)],
          suggestion: 'Consider merging them or narrowing one to a more specific topic.',
        });
      }
    }
  }

  // Duplicate triggers
  const activeFlows = flows.filter((f) => f.status === 'active');
  for (let i = 0; i < activeFlows.length; i++) {
    for (let j = i + 1; j < activeFlows.length; j++) {
      const a = activeFlows[i], b = activeFlows[j];
      const wa = new Set(notableWords(a.trigger));
      const wb = new Set(notableWords(b.trigger));
      if (!wa.size || !wb.size) continue;
      let inter = 0;
      for (const x of wa) if (wb.has(x)) inter++;
      const union = new Set([...wa, ...wb]).size;
      const jacc = inter / union;
      if (jacc >= 0.6) {
        emit(issues, {
          id: ISSUE_IDS.FLOW_DUPLICATE_TRIGGER,
          severity: 'warning',
          title: 'Two flows have nearly identical triggers',
          description: `"${a.name}" and "${b.name}" would both fire on similar inputs (overlap ${Math.round(jacc * 100)}%).`,
          subject: subject('flow', a.id, a.name),
          relatedSubjects: [subject('flow', b.id, b.name)],
          suggestion: 'Tighten one of the triggers to disambiguate, or merge the flows.',
        });
      }
    }
  }

  // ── Orphan connectors ─────────────────────────────────────────────────────
  const referenced = new Set();
  for (const a of activeAsst) for (const id of a.connectorIds || []) referenced.add(id);
  for (const f of activeFlows) {
    for (const t of f.tools || []) {
      const cid = typeof t === 'string' ? t : t?.connectorId;
      if (cid) referenced.add(cid);
    }
  }
  for (const c of connectors) {
    if (c.status === 'connected' && !referenced.has(c.id)) {
      emit(issues, {
        id: ISSUE_IDS.CONNECTOR_ORPHAN,
        severity: 'warning',
        title: `${capitalize(kindLabel(c))} is connected but unused`,
        description: `${c.name} is connected, but no active assistant or flow uses it.`,
        subject: subject('connector', c.id, c.name),
        suggestion: 'Link it to an assistant or flow, or disconnect it to keep the workspace tidy.',
        autoFix: { action: 'setConnectorStatus', payload: { id: c.id, status: 'disconnected' } },
      });
    }
  }

  // ── State smells ─────────────────────────────────────────────────────────
  if (asstList.length > 0 && activeAsst.length === 0) {
    emit(issues, {
      id: ISSUE_IDS.WORKSPACE_ALL_DRAFT,
      severity: 'warning',
      title: 'No active assistants',
      description: 'Every assistant in the workspace is in draft or archived state — employees will get the default Companion only.',
      subject: subject('workspace', null, 'Workspace'),
      suggestion: 'Promote at least one assistant from draft to active.',
    });
  }
  for (const c of connectors) {
    if (c.status === 'degraded') {
      const myDom = new Set(c.domains || []);
      const hasFallback = connectors.some((other) =>
        other.id !== c.id && other.status === 'connected' &&
        (other.domains || []).some((d) => myDom.has(d))
      );
      if (!hasFallback) {
        emit(issues, {
          id: ISSUE_IDS.CONNECTOR_DEGRADED_NO_FALLBACK,
          severity: 'warning',
          title: `Degraded ${kindLabel(c)} with no fallback`,
          description: `${c.name} is degraded and no other connected connector covers the same domains.`,
          subject: subject('connector', c.id, c.name),
          suggestion: 'Reconnect this connector or add a backup with overlapping coverage.',
        });
      }
    }
  }

  // ── Blueprint coverage ───────────────────────────────────────────────────
  if (blueprint) {
    const ws = blueprint.workspace || {};
    const groups = blueprint.groups || ws.groups || [];
    if (Array.isArray(groups) && groups.length > 0) {
      const targeted = new Set();
      for (const a of activeAsst) for (const g of a.audience?.groups || []) targeted.add(g);
      if (targeted.size === 0) {
        emit(issues, {
          id: ISSUE_IDS.BP_UNUSED_GROUPS,
          severity: 'info',
          title: 'No assistants are targeted at specific groups',
          description: `Discovery surfaced ${groups.length} groups, but every active assistant is set to "Everyone".`,
          subject: subject('blueprint', null, 'Workspace blueprint'),
          suggestion: 'Consider scoping one or two assistants to the most important teams.',
        });
      }
    }
    const glossary = (ws.glossary || blueprint.glossary || []);
    if (Array.isArray(glossary) && glossary.length > 0) {
      const instructions = activeAsst.map((a) => (a.instructions || '').toLowerCase()).join(' ');
      const unused = glossary.filter((g) => g.term && !instructions.includes(String(g.term).toLowerCase()));
      if (unused.length > 0 && unused.length === glossary.length) {
        emit(issues, {
          id: ISSUE_IDS.BP_UNUSED_GLOSSARY,
          severity: 'info',
          title: 'Glossary terms are not surfaced in any assistant',
          description: `${glossary.length} discovered terms aren't referenced in any active assistant's instructions.`,
          subject: subject('blueprint', null, 'Workspace blueprint'),
          suggestion: 'Mention key terms in assistant instructions so the model uses them consistently.',
        });
      }
    }
    const mainInstr = (ws.mainInstructions || blueprint.mainInstructions || '').trim();
    if (!mainInstr) {
      emit(issues, {
        id: ISSUE_IDS.BP_EMPTY_INSTRUCTIONS,
        severity: 'info',
        title: 'No main instructions captured',
        description: 'Discovery didn\'t (or hasn\'t yet) captured "Main instructions" — your company tone won\'t be injected into every chat.',
        subject: subject('blueprint', null, 'Workspace blueprint'),
        suggestion: 'Open Setup → Re-run discovery or paste your main Navigator instructions in.',
      });
    }
  }

  // ── LLM deep check ───────────────────────────────────────────────────────
  if (deep && activeAsst.length >= 2 && process.env.OPENAI_API_KEY) {
    try {
      const overlaps = await pairwiseAssistantOverlap(activeAsst);
      for (const o of overlaps) {
        emit(issues, {
          id: ISSUE_IDS.ASST_LLM_OVERLAP,
          severity: o.severity === 'high' ? 'error' : 'warning',
          title: o.severity === 'high' ? 'Assistants have the same scope' : 'Assistants overlap',
          description: o.reason,
          subject: subject('assistant', o.withAssistantId, asstById[o.withAssistantId]?.name || o.withAssistantName),
          suggestion: o.suggestion || 'Narrow one of them to a distinct scope.',
        });
      }
    } catch (err) {
      console.warn('[navigator-health] deep check failed:', err.message);
    }
  }

  const summary = summarize(issues);
  return { issues, summary, deep };
}

// Same LLM-judged overlap call the AI Creator uses. Compares one candidate
// against an existing list. Two call shapes — bulk and single-candidate.
export async function pairwiseAssistantOverlap(assistants, candidate = null) {
  if (!process.env.OPENAI_API_KEY) return [];
  const list = assistants || [];
  if (candidate) return runOverlapCall(candidate, list);
  if (list.length < 2) return [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const others = list.filter((_, k) => k !== i);
    const res = await runOverlapCall({
      name: a.name, description: a.description, promptBody: a.instructions, _id: a.id,
    }, others).catch(() => []);
    for (const r of res) {
      const pair = [a.id, r.withAssistantId].sort().join('::');
      if (seen.has(pair)) continue;
      seen.add(pair);
      out.push({ ...r, fromAssistantId: a.id });
    }
  }
  return out;
}

async function runOverlapCall(candidate, existing) {
  if (!existing.length) return [];
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const compactExisting = existing.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description || '',
    instructionsHead: (a.instructions || '').slice(0, 300),
  }));
  const resp = await client.chat.completions.create({
    model: 'gpt-5-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Detect topic/audience overlap between a proposed new Assistant and existing Navigator Assistants. Return STRICT JSON:
{ "conflicts": [ { "withAssistantId": "...", "withAssistantName": "...", "severity": "low" | "medium" | "high", "reason": "1-2 sentences", "suggestion": "concrete rename or scope-narrowing tip" } ] }

- high: essentially the same scope. Block the add.
- medium: meaningful overlap but distinguishable.
- low: minor overlap; mention but allow.

Return an empty array if no conflicts.`,
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

function summarize(issues) {
  let errors = 0, warnings = 0, info = 0;
  const byCategory = {};
  for (const it of issues) {
    if (it.severity === 'error') errors++;
    else if (it.severity === 'warning') warnings++;
    else info++;
    byCategory[it.category] = (byCategory[it.category] || 0) + 1;
  }
  return {
    total: issues.length,
    errors, warnings, info,
    byCategory,
    categoryLabels: CATEGORY,
    lastCheckedAt: new Date().toISOString(),
  };
}

function audienceIntersect(audA, audB) {
  audA = audA || {};
  audB = audB || {};
  if (audA.everyone || audB.everyone) return true;
  const ga = new Set(audA.groups || []);
  for (const g of audB.groups || []) if (ga.has(g)) return true;
  const ra = new Set(audA.roles || []);
  for (const r of audB.roles || []) if (ra.has(r)) return true;
  const la = new Set(audA.locations || []);
  for (const l of audB.locations || []) if (la.has(l)) return true;
  return false;
}

function domainsForAssistant(assistant, connectorById) {
  const out = [];
  for (const id of assistant.connectorIds || []) {
    const c = connectorById[id];
    if (c?.domains) out.push(...c.domains);
  }
  return out;
}

const STOPWORDS = new Set([
  'employee','employees','asks','wants','says','their','they','the','and','for',
  'that','this','about','have','with','what','when','to','on','of','in','a','an',
  'or','is','are','be','do','need','needs','help','want','start','starts',
  'mentions','mention','from','just','some',
]);
function notableWords(s = '') {
  return Array.from(new Set(
    String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
      .filter((w) => w.length > 4 && !STOPWORDS.has(w))
  ));
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
