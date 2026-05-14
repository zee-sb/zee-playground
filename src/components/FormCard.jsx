// Shared schema-driven form card. Used in chat (as a flow step or a one-off
// missing-args prompt), in Studio (as a preview), and anywhere else we need
// to collect structured input from the user.
//
// Spec shape — see plan; in short:
//   { id, title, description?, submitLabel?, cancelLabel?,
//     fields: [{ id, label, type, required?, description?, placeholder?,
//                defaultValue?, options?, validation? }] }

import React, { useMemo, useState } from 'react';
import { ClipboardList, CheckCircle, Loader2 } from 'lucide-react';
import { validate } from './formValidation.js';
import {
  STAFFBASE_TEAL, STAFFBASE_TEAL_DEEP, NEUTRAL_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from '../prototypes/StaffbaseCompanion/cards/cardStyles.js';

const THEMES = {
  teal: { accent: STAFFBASE_TEAL, accentDeep: STAFFBASE_TEAL_DEEP, accentBg: 'rgba(0, 199, 178, 0.08)' },
  purple: { accent: '#7C3AED', accentDeep: '#6D28D9', accentBg: '#EDE9FE' },
  neutral: { accent: '#0F172A', accentDeep: '#0F172A', accentBg: '#F1F5F9' },
};

function initialValuesFor(spec, override) {
  const init = {};
  for (const f of spec?.fields || []) {
    if (override && override[f.id] !== undefined) init[f.id] = override[f.id];
    else if (f.defaultValue !== undefined) init[f.id] = f.defaultValue;
    else if (f.type === 'checkbox') init[f.id] = false;
    else init[f.id] = '';
  }
  return init;
}

export default function FormCard({
  spec,
  initialValues,
  busy = false,
  onSubmit,
  onCancel,
  theme = 'teal',
  submitted = false,
  submittedSummary,
}) {
  const palette = THEMES[theme] || THEMES.teal;
  const [values, setValues] = useState(() => initialValuesFor(spec, initialValues));
  const [errors, setErrors] = useState({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(submitted);

  const fields = spec?.fields || [];

  const liveValidation = useMemo(() => validate(spec, values), [spec, values]);

  function setField(id, raw) {
    setValues((v) => ({ ...v, [id]: raw }));
    if (showAllErrors) {
      // Re-validate live once the user has tried to submit once.
      const { errors: nextErrors } = validate(spec, { ...values, [id]: raw });
      setErrors(nextErrors);
    }
  }

  function handleSubmit(e) {
    e?.preventDefault?.();
    const { valid, errors: errs, coerced } = validate(spec, values);
    if (!valid) {
      setErrors(errs);
      setShowAllErrors(true);
      return;
    }
    setErrors({});
    setIsSubmitted(true);
    onSubmit?.(coerced);
  }

  if (isSubmitted) {
    return (
      <div style={{
        margin: '8px 0', padding: 14, background: '#FFFFFF',
        border: `1px solid ${NEUTRAL_BORDER}`, borderRadius: 12,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={18} color={palette.accent} />
          <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
            {submittedSummary || 'Submitted'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        margin: '8px 0', padding: 14, background: '#FFFFFF',
        border: `1px solid ${NEUTRAL_BORDER}`, borderRadius: 12,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spec?.description ? 4 : 10 }}>
        <ClipboardList size={16} color={palette.accent} />
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>
          {spec?.title || 'Fill in the details'}
        </div>
      </div>
      {spec?.description && (
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 10, lineHeight: 1.4 }}>
          {spec.description}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fields.map((f) => (
          <FieldRow
            key={f.id}
            field={f}
            value={values[f.id]}
            error={errors[f.id]}
            onChange={(v) => setField(f.id, v)}
            disabled={busy}
            palette={palette}
          />
        ))}
      </div>

      {showAllErrors && Object.keys(errors).length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#B91C1C' }}>
          Please fix the highlighted fields.
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: `1px solid ${NEUTRAL_BORDER}`, background: '#FFFFFF',
              color: TEXT_SECONDARY, fontSize: 12.5, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {spec?.cancelLabel || 'Cancel'}
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '8px 14px', borderRadius: 8,
            border: 'none', background: palette.accent, color: 'white',
            fontSize: 12.5, fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.7 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          {busy && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          {spec?.submitLabel || 'Submit'}
        </button>
      </div>
    </form>
  );
}

function FieldRow({ field, value, error, onChange, disabled, palette }) {
  const baseInput = {
    width: '100%',
    fontSize: 13,
    padding: '8px 10px',
    border: `1px solid ${error ? '#FCA5A5' : NEUTRAL_BORDER}`,
    borderRadius: 8,
    color: TEXT_PRIMARY,
    background: disabled ? '#F8FAFC' : '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  let control = null;

  if (field.type === 'textarea') {
    control = (
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ''}
        disabled={disabled}
        rows={3}
        style={{ ...baseInput, resize: 'vertical', minHeight: 64 }}
      />
    );
  } else if (field.type === 'select') {
    control = (
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={baseInput}
      >
        <option value="" disabled>Choose…</option>
        {(field.options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>
        ))}
      </select>
    );
  } else if (field.type === 'radio') {
    control = (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(field.options || []).map((opt) => {
          const active = String(value) === String(opt.value);
          return (
            <button
              type="button"
              key={opt.value}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              style={{
                padding: '6px 10px', borderRadius: 999,
                border: `1px solid ${active ? palette.accent : NEUTRAL_BORDER}`,
                background: active ? palette.accentBg : '#FFFFFF',
                color: active ? palette.accentDeep : TEXT_SECONDARY,
                fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {opt.label || opt.value}
            </button>
          );
        })}
      </div>
    );
  } else if (field.type === 'checkbox') {
    control = (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT_PRIMARY, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span>{field.description || field.label}</span>
      </label>
    );
  } else {
    const htmlType = field.type === 'date' ? 'date'
      : field.type === 'number' ? 'number'
      : field.type === 'email' ? 'email'
      : field.type === 'url' ? 'url'
      : 'text';
    control = (
      <input
        type={htmlType}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ''}
        disabled={disabled}
        style={baseInput}
      />
    );
  }

  // Checkbox renders its own inline label; everything else gets a stacked one.
  if (field.type === 'checkbox') {
    return (
      <div>
        {control}
        {error && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <label
        style={{
          display: 'block', fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: TEXT_MUTED, marginBottom: 4,
        }}
      >
        {field.label}{field.required && <span style={{ color: '#B91C1C', marginLeft: 3 }}>*</span>}
      </label>
      {control}
      {field.description && (
        <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 4 }}>{field.description}</div>
      )}
      {error && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
