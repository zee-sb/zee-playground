// Schema-driven form validation.
//
// Pure functions, no React, server-safe (used by api/companion/chat too).
//
// Spec shape: { fields: [{ id, label, type, required, validation?: { ... } }] }
// Returns: { valid, errors: { [fieldId]: string }, coerced: { [fieldId]: any } }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function coerceValue(type, raw) {
  if (raw === undefined || raw === null) return raw;
  if (type === 'number') {
    if (raw === '') return '';
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (type === 'checkbox') {
    return raw === true || raw === 'true' || raw === 'on' || raw === 1;
  }
  return String(raw);
}

function fieldError(field, value) {
  const required = !!field.required;
  const isEmpty = value === undefined || value === null || value === '';

  if (required && isEmpty) return 'Required';
  if (isEmpty) return null;

  const v = field.validation || {};

  if (field.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'Must be a number';
    if (v.min != null && value < v.min) return `Must be ≥ ${v.min}`;
    if (v.max != null && value > v.max) return `Must be ≤ ${v.max}`;
    return null;
  }

  if (field.type === 'email' && !EMAIL_RE.test(value)) return 'Invalid email';
  if (field.type === 'url' && !URL_RE.test(value)) return 'Must be a valid URL';
  if (field.type === 'date' && !ISO_DATE_RE.test(value)) return 'Use YYYY-MM-DD';

  if (typeof value === 'string') {
    if (v.minLength != null && value.length < v.minLength) return `At least ${v.minLength} characters`;
    if (v.maxLength != null && value.length > v.maxLength) return `At most ${v.maxLength} characters`;
    if (v.pattern) {
      let re = null;
      try { re = new RegExp(v.pattern); } catch { /* bad pattern from admin — ignore */ }
      if (re && !re.test(value)) return v.patternMessage || 'Doesn\'t match the required format';
    }
  }

  if (field.type === 'select' || field.type === 'radio') {
    const options = field.options || [];
    if (options.length && !options.find((o) => o.value === value)) return 'Not a valid option';
  }

  if (field.type === 'date' && (v.min || v.max)) {
    if (v.min && value < v.min) return `Must be on or after ${v.min}`;
    if (v.max && value > v.max) return `Must be on or before ${v.max}`;
  }

  return null;
}

export function validate(spec, rawValues = {}) {
  const fields = spec?.fields || [];
  const coerced = {};
  const errors = {};

  for (const field of fields) {
    const raw = rawValues[field.id];
    const value = coerceValue(field.type, raw);
    coerced[field.id] = value;
    const err = fieldError(field, value);
    if (err) errors[field.id] = err;
  }

  return { valid: Object.keys(errors).length === 0, errors, coerced };
}

// Convenience for the chat UI: returns true if any required field is empty.
export function hasMissingRequired(spec, values = {}) {
  for (const f of spec?.fields || []) {
    if (!f.required) continue;
    const v = values[f.id];
    if (v === undefined || v === null || v === '') return true;
  }
  return false;
}
