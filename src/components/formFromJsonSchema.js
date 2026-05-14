// Convert a JSON-Schema object (e.g. the inputSchema of an MCP tool) into a
// FormSpec consumable by <FormCard>. Best-effort — what we can't represent
// becomes a plain text field.
//
// Maps:
//   type: 'string' | 'number' | 'integer' | 'boolean' → text / number / checkbox
//   format: 'date'  | 'email' | 'uri'                  → date / email / url
//   enum:   [...]                                      → select with options
//   description                                        → field description
//   minLength / maxLength / minimum / maximum / pattern → validation rules
//   required: [...]                                    → required flag

function fieldFromProp(name, prop, requiredSet) {
  const description = typeof prop?.description === 'string' ? prop.description : '';
  const label = prop?.title || titleize(name);
  const required = requiredSet.has(name);
  const validation = {};
  if (prop?.minLength != null) validation.minLength = prop.minLength;
  if (prop?.maxLength != null) validation.maxLength = prop.maxLength;
  if (prop?.minimum != null) validation.min = prop.minimum;
  if (prop?.maximum != null) validation.max = prop.maximum;
  if (typeof prop?.pattern === 'string') validation.pattern = prop.pattern;

  // Enum → select
  if (Array.isArray(prop?.enum) && prop.enum.length) {
    return {
      id: name,
      label,
      type: 'select',
      required,
      description,
      options: prop.enum.map((v) => ({ value: String(v), label: String(v) })),
    };
  }

  const type = prop?.type;
  if (type === 'number' || type === 'integer') {
    return { id: name, label, type: 'number', required, description, validation };
  }
  if (type === 'boolean') {
    return { id: name, label, type: 'checkbox', required, description };
  }

  // Default string-like
  const format = prop?.format;
  let fieldType = 'text';
  if (format === 'date') fieldType = 'date';
  else if (format === 'email') fieldType = 'email';
  else if (format === 'uri' || format === 'url') fieldType = 'url';
  else if (typeof prop?.maxLength === 'number' && prop.maxLength > 200) fieldType = 'textarea';

  return {
    id: name,
    label,
    type: fieldType,
    required,
    description,
    placeholder: prop?.examples?.[0] != null ? String(prop.examples[0]) : undefined,
    validation,
  };
}

function titleize(snake) {
  return String(snake || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function fromJsonSchema(jsonSchema, opts = {}) {
  const schema = jsonSchema || {};
  const props = schema.properties || {};
  const requiredSet = new Set(Array.isArray(schema.required) ? schema.required : []);
  const fields = Object.entries(props).map(([name, prop]) => fieldFromProp(name, prop, requiredSet));

  // If a partial-values map is provided, mark already-supplied required fields
  // as resolved so the form only asks for the gaps.
  if (opts.initialValues) {
    for (const f of fields) {
      if (opts.initialValues[f.id] != null) f.defaultValue = opts.initialValues[f.id];
    }
  }

  // Optionally narrow to only-missing-required fields (used when the LLM
  // tries to call a tool but is missing args — we ask only for what's gone).
  const onlyMissing = !!opts.onlyMissingRequired;
  const filteredFields = onlyMissing
    ? fields.filter((f) => f.required && (opts.initialValues?.[f.id] == null || opts.initialValues?.[f.id] === ''))
    : fields;

  return {
    id: opts.id || 'tool-args',
    title: opts.title || 'Fill in the details',
    description: opts.description || schema.description || '',
    submitLabel: opts.submitLabel || 'Submit',
    fields: filteredFields,
  };
}
