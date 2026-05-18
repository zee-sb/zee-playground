// Photo-step AI validation. Calls an OpenAI vision model with the employee's
// photo + admin-defined criteria and returns a structured pass/fail.
//
// Output shape:
//   { passed, summary, criteria: [{id, label, passed, reason}],
//     annotations: [{id, x, y, w, h, label, severity}] }
//
// Coordinates are normalized 0–1 (top-left origin). The PhotoCard overlay
// multiplies by the rendered image size.

const DEFAULT_MODEL = 'gpt-4o-mini';

function buildJsonSchema(criteria, wantAnnotations) {
  const criterionItem = {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'label', 'passed', 'reason'],
    properties: {
      id: { type: 'string', enum: criteria.map((c) => c.id) },
      label: { type: 'string' },
      passed: { type: 'boolean' },
      reason: { type: 'string', description: 'Short explanation, <= 200 chars.' },
    },
  };
  const properties = {
    passed: { type: 'boolean', description: 'Overall pass: all REQUIRED criteria passed.' },
    summary: { type: 'string', description: 'One- or two-sentence employee-facing summary.' },
    criteria: { type: 'array', items: criterionItem },
  };
  const required = ['passed', 'summary', 'criteria'];
  if (wantAnnotations) {
    properties.annotations = {
      type: 'array',
      description: 'Bounding boxes for areas of interest, especially failed criteria. Empty if nothing to annotate.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'x', 'y', 'w', 'h', 'label', 'severity'],
        properties: {
          id: { type: 'string' },
          x: { type: 'number', minimum: 0, maximum: 1 },
          y: { type: 'number', minimum: 0, maximum: 1 },
          w: { type: 'number', minimum: 0, maximum: 1 },
          h: { type: 'number', minimum: 0, maximum: 1 },
          label: { type: 'string' },
          severity: { type: 'string', enum: ['error', 'warning', 'info'] },
        },
      },
    };
    required.push('annotations');
  }
  return {
    name: 'photo_validation',
    schema: {
      type: 'object',
      additionalProperties: false,
      required,
      properties,
    },
    strict: true,
  };
}

function buildPrompt(spec) {
  const ai = spec.aiValidation || {};
  const criteria = ai.criteria || [];
  const lines = [];
  if (ai.systemPrompt) lines.push(ai.systemPrompt.trim());
  lines.push('');
  lines.push('Evaluate the attached image against each criterion below and return JSON matching the schema.');
  lines.push('');
  lines.push('Criteria:');
  for (const c of criteria) {
    lines.push(`- id="${c.id}" ${c.required ? '[REQUIRED]' : '[optional]'} — ${c.label}`);
  }
  lines.push('');
  lines.push('Rules:');
  lines.push('- Overall `passed` = true if ALL required criteria pass. Optional criteria do not affect overall pass.');
  lines.push('- `reason` for each criterion: one short clause (<= 200 chars). Cite what you see.');
  lines.push('- `summary`: one or two sentences the employee will read first.');
  if (ai.annotations !== false) {
    lines.push('- `annotations`: bounding boxes (0–1 normalized) highlighting issues. Skip if nothing notable.');
  }
  return lines.join('\n');
}

function fallback(message) {
  return {
    passed: false,
    summary: message || 'AI validation unavailable — please review the photo manually.',
    criteria: [],
    annotations: [],
    _error: message || 'validation_unavailable',
  };
}

export async function validatePhoto({ openai, imageDataUrl, mimeType, spec }) {
  if (!openai) return fallback('openai client missing');
  if (!imageDataUrl) return fallback('no image provided');
  const ai = spec?.aiValidation || {};
  const criteria = Array.isArray(ai.criteria) ? ai.criteria : [];
  if (!criteria.length) {
    // No criteria defined — return a neutral pass so the flow still advances.
    return { passed: true, summary: 'No validation criteria configured.', criteria: [], annotations: [] };
  }
  const model = ai.model || DEFAULT_MODEL;
  const prompt = buildPrompt(spec);
  const jsonSchema = buildJsonSchema(criteria, ai.annotations !== false);

  try {
    const resp = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: jsonSchema },
      max_tokens: 800,
    });
    const text = resp?.choices?.[0]?.message?.content;
    if (!text) return fallback('empty model response');
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { return fallback(`bad json: ${e.message}`); }
    // Guarantee shape — fill in defaults if the model drifted.
    const criteriaById = new Map(criteria.map((c) => [c.id, c]));
    const outCriteria = Array.isArray(parsed.criteria) ? parsed.criteria : [];
    // Ensure all admin-defined criteria are represented, even if the model omitted one.
    const seen = new Set(outCriteria.map((c) => c.id));
    for (const c of criteria) {
      if (!seen.has(c.id)) {
        outCriteria.push({ id: c.id, label: c.label, passed: false, reason: 'No determination from model.' });
      }
    }
    // Recompute overall pass from required criteria so the model can't lie to us.
    const allRequiredPass = criteria
      .filter((c) => c.required)
      .every((c) => outCriteria.find((r) => r.id === c.id)?.passed);
    return {
      passed: !!allRequiredPass,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      criteria: outCriteria.map((c) => ({
        id: c.id,
        label: criteriaById.get(c.id)?.label || c.label || c.id,
        passed: !!c.passed,
        reason: typeof c.reason === 'string' ? c.reason : '',
      })),
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations.map((a, i) => ({
        id: a.id || `a${i + 1}`,
        x: Math.max(0, Math.min(1, Number(a.x) || 0)),
        y: Math.max(0, Math.min(1, Number(a.y) || 0)),
        w: Math.max(0, Math.min(1, Number(a.w) || 0)),
        h: Math.max(0, Math.min(1, Number(a.h) || 0)),
        label: typeof a.label === 'string' ? a.label : '',
        severity: ['error', 'warning', 'info'].includes(a.severity) ? a.severity : 'warning',
      })) : [],
    };
  } catch (err) {
    console.warn('[photo-validate] failed:', err.message);
    return fallback(err.message);
  }
}
