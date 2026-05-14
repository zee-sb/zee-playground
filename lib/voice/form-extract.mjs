// Voice → form extraction. Given a user transcript and a FormStep field spec,
// pre-fill the form with whatever the user already said so they don't have to
// re-type by hand. The visible FormCard is the safety gate — voice never
// auto-submits.
//
// Strategy: build a JSON-schema-shaped payload from the field list and ask
// gpt-4o-mini to fill it in (JSON mode). The schema enforces:
//   - dates → ISO YYYY-MM-DD
//   - selects/radios → one of the allowed option values
//   - checkboxes → boolean
//   - numbers → number
//   - everything else → string
// Anything the user didn't say comes back null. We never invent values.
//
// Returns: { values, extractedFieldIds, missingRequired }

function fieldToProperty(field, todayIso) {
  const desc = [
    `Field "${field.label || field.id}".`,
    field.description ? `Description: ${field.description}.` : '',
    field.required ? 'Required.' : 'Optional.',
    `If the user did not clearly express this field, return null.`,
  ].filter(Boolean).join(' ');

  if (field.type === 'date') {
    return {
      type: ['string', 'null'],
      description: `${desc} Resolve relative phrases ("next Tuesday", "tomorrow", "in two days") against today=${todayIso}. Output ISO date YYYY-MM-DD only.`,
    };
  }
  if (field.type === 'number') {
    return { type: ['number', 'null'], description: desc };
  }
  if (field.type === 'checkbox') {
    return { type: ['boolean', 'null'], description: desc };
  }
  if ((field.type === 'select' || field.type === 'radio') && Array.isArray(field.options) && field.options.length) {
    const allowedValues = field.options.map((o) => String(o.value));
    return {
      type: ['string', 'null'],
      enum: [...allowedValues, null],
      description: `${desc} Must be one of: ${allowedValues.join(' | ')}. If the user's phrasing isn't clearly one of those, return null.`,
    };
  }
  if (field.type === 'email') {
    return { type: ['string', 'null'], description: `${desc} An email address, or null.` };
  }
  if (field.type === 'url') {
    return { type: ['string', 'null'], description: `${desc} A URL, or null.` };
  }
  // text, textarea, fallback
  return { type: ['string', 'null'], description: desc };
}

function buildSchema(fields, todayIso) {
  const properties = {};
  for (const f of fields) {
    properties[f.id] = fieldToProperty(f, todayIso);
  }
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: fields.map((f) => f.id),
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Coerce + clean the LLM's response: drop nulls, validate enum membership,
// and never overwrite a value the user already locked in.
function postProcess(raw, fields, existingValues) {
  const values = { ...(existingValues || {}) };
  const extractedFieldIds = [];
  for (const f of fields) {
    if (values[f.id] !== undefined && values[f.id] !== '' && values[f.id] !== null) continue;
    const v = raw?.[f.id];
    if (v === null || v === undefined || v === '') continue;
    // Enum gate.
    if ((f.type === 'select' || f.type === 'radio') && Array.isArray(f.options)) {
      const allowed = new Set(f.options.map((o) => String(o.value)));
      if (!allowed.has(String(v))) continue;
    }
    if (f.type === 'number' && typeof v !== 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      values[f.id] = n;
      extractedFieldIds.push(f.id);
      continue;
    }
    if (f.type === 'checkbox') {
      values[f.id] = !!v;
      extractedFieldIds.push(f.id);
      continue;
    }
    values[f.id] = v;
    extractedFieldIds.push(f.id);
  }
  const missingRequired = fields
    .filter((f) => f.required && (values[f.id] === undefined || values[f.id] === '' || values[f.id] === null))
    .map((f) => f.id);
  return { values, extractedFieldIds, missingRequired };
}

// `recentText` is whatever the user said that led up to this FormStep — pass
// their last user message (or the last ~3 messages joined) so the extractor
// has the full ask, not just the trigger phrase.
export async function extractFormValues({
  openai,
  fields,
  recentText,
  lang = null,
  existingValues = null,
}) {
  const safeFields = Array.isArray(fields) ? fields : [];
  if (!safeFields.length || !recentText || !String(recentText).trim()) {
    return { values: existingValues || {}, extractedFieldIds: [], missingRequired: safeFields.filter((f) => f.required).map((f) => f.id) };
  }
  const schema = buildSchema(safeFields, todayIso());
  const langLine = lang ? `The user spoke in language code "${lang}". Field labels may be in English; map their words to the right field.` : '';
  const system = `You extract structured form values from a user's natural-language message.
${langLine}
Rules:
- Output JSON only, matching the provided schema exactly.
- For any field the user did NOT clearly express, output null. NEVER invent a value.
- For dates, resolve relative phrases against today=${todayIso()} and output ISO YYYY-MM-DD.
- For select/radio, the value MUST be one of the allowed option values verbatim, or null.
- Trim quotes and filler ("um", "uh") from extracted strings.`;
  const user = `User said:\n"""\n${String(recentText).trim().slice(0, 2000)}\n"""\n\nReturn JSON matching this schema:\n${JSON.stringify(schema)}`;

  let parsed = {};
  try {
    const resp = await openai.chat.completions.create({
      model: process.env.FORM_EXTRACT_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    parsed = JSON.parse(resp.choices?.[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[voice/form-extract] LLM call failed:', err.message);
    parsed = {};
  }

  return postProcess(parsed, safeFields, existingValues);
}
