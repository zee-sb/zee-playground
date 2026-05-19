// Visual step composer for the Flow editor. Renders a vertical timeline of
// step cards with type-specific config UIs. Owns no DB state — the parent
// FlowDetail manages save/load.

import React, { useState, useMemo } from 'react';
import {
  ClipboardList, ShieldCheck, Wrench, Plus, Trash2, Copy, ChevronDown, ChevronUp,
  GripVertical, AlertTriangle, Braces, Camera,
  UserCheck, GitBranch, FileUp, PenLine, MapPin, ScanLine, Clock, Bell,
} from 'lucide-react';

// Plain-English labels exposed to admins. The legacy internal type names
// (form/tool/confirm) stay in the data model — only the UI changes.
const STEP_META = {
  form:        { label: 'Ask for info',           short: 'Form',      color: '#0EA5E9', icon: ClipboardList,
                 hint: 'Collect input from the employee.' },
  tool:        { label: 'Run an action',          short: 'Action',    color: '#7C3AED', icon: Wrench,
                 hint: 'File a ticket, post to a system, or call a service.' },
  confirm:     { label: 'Confirm before submit',  short: 'Confirm',   color: '#F59E0B', icon: ShieldCheck,
                 hint: 'Review the data and confirm before commit.' },
  photo:       { label: 'Capture a photo',        short: 'Photo',     color: '#0EA5A8', icon: Camera,
                 hint: 'Employee takes/uploads a photo; AI validates against criteria.' },
  approval:    { label: 'Wait for approval',      short: 'Approval',  color: '#DC2626', icon: UserCheck,
                 hint: "Pause until a manager / HR / named approver decides." },
  branch:      { label: 'Branch on a condition',  short: 'Branch',    color: '#0891B2', icon: GitBranch,
                 hint: 'Skip to a different step based on a prior value.' },
  file_upload: { label: 'Upload a file',          short: 'Upload',    color: '#9333EA', icon: FileUp,
                 hint: 'Collect a PDF, document, or other file.' },
  signature:   { label: 'Collect a signature',    short: 'Sign',      color: '#0D9488', icon: PenLine,
                 hint: 'E-signature on a policy or acknowledgment.' },
  location:    { label: 'Capture location',       short: 'Location',  color: '#16A34A', icon: MapPin,
                 hint: 'Grab the employee\'s current location.' },
  barcode:     { label: 'Scan a barcode',         short: 'Scan',      color: '#EA580C', icon: ScanLine,
                 hint: 'Scan a QR / barcode with the camera.' },
  wait:        { label: 'Wait / schedule',        short: 'Wait',      color: '#7C3AED', icon: Clock,
                 hint: 'Pause the flow for a fixed duration before continuing.' },
  notify:      { label: 'Send a notification',    short: 'Notify',    color: '#2563EB', icon: Bell,
                 hint: 'Send a push, email, or in-app message and continue.' },
};

const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'url', 'date', 'select', 'checkbox', 'radio'];

// Pre-baked validation presets so non-technical admins never have to type a
// regex. When `value.preset` is set, the regex/min/max are derived at render
// time. Custom regex stays available behind the Advanced toggle.
const FORMAT_PRESETS = {
  none:       { label: 'No special format',       pattern: '',                         msg: '' },
  email:      { label: 'Email address',           pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
                msg: 'Enter a valid email like name@company.com' },
  phone:      { label: 'Phone number',            pattern: '^[+()\\-\\s0-9]{7,}$',
                msg: 'Enter a valid phone number' },
  postal_us:  { label: 'Postal code (US)',        pattern: '^\\d{5}(-\\d{4})?$',
                msg: 'Enter a 5-digit ZIP (or 9-digit ZIP+4)' },
  postal_de:  { label: 'Postal code (DE/EU)',     pattern: '^\\d{4,5}$',
                msg: 'Enter a 4–5 digit postal code' },
  iban:       { label: 'IBAN',                    pattern: '^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$',
                msg: 'Enter a valid IBAN' },
  url:        { label: 'Website / URL',           pattern: '^https?://.+',
                msg: 'Enter a URL starting with http(s)://' },
  custom:     { label: 'Custom regex (advanced)', pattern: '',                         msg: '' },
};

function blankStep(type, index) {
  const idBase = type === 'form' ? 'collect'
    : type === 'confirm' ? 'confirm'
    : type === 'photo'   ? 'photo'
    : type === 'approval' ? 'approval'
    : type === 'branch'   ? 'branch'
    : type === 'file_upload' ? 'upload'
    : type === 'signature' ? 'signature'
    : type === 'location' ? 'location'
    : type === 'barcode'  ? 'scan'
    : type === 'wait'     ? 'wait'
    : type === 'notify'   ? 'notify'
    : 'action';
  const id = `${idBase}-${index + 1}`;
  if (type === 'form') {
    return {
      id, type, label: 'Collect input',
      spec: { title: 'Provide details', submitLabel: 'Continue', fields: [] },
    };
  }
  if (type === 'tool') {
    return {
      id, type, label: 'Run action',
      tool: { connectionId: '', toolId: '' }, args: {},
    };
  }
  if (type === 'photo') {
    return {
      id, type, label: 'Take photo',
      spec: {
        title: 'Take a photo',
        description: '',
        captureMode: 'both',
        submitLabel: 'Use this photo',
        retakeLabel: 'Retake',
        onFail: 'warn',
        aiValidation: {
          enabled: true,
          model: 'gpt-4o-mini',
          systemPrompt: '',
          criteria: [
            { id: 'criterion_1', label: 'Describe what should be visible…', required: true },
          ],
          annotations: true,
        },
      },
    };
  }
  if (type === 'approval') {
    return {
      id, type, label: 'Manager approval',
      approval: {
        route: 'manager', approver: '',
        title: 'Approval needed',
        message: 'Please review and approve this request.',
        slaHours: 24,
        onReject: 'cancel',
        rewindTo: '',
      },
    };
  }
  if (type === 'branch') {
    return {
      id, type, label: 'Branch',
      branch: { left: '', op: 'equals', right: '', thenGoTo: '', elseGoTo: '' },
    };
  }
  if (type === 'file_upload') {
    return {
      id, type, label: 'Upload a file',
      file: {
        title: 'Attach a document',
        description: 'PDFs and images up to 10 MB.',
        kind: 'any', maxMB: 10, required: true,
        submitLabel: 'Upload',
      },
    };
  }
  if (type === 'signature') {
    return {
      id, type, label: 'E-signature',
      signature: {
        title: 'Sign to acknowledge',
        description: '',
        attestation: 'I have read and agree to the policy above.',
        kind: 'draw', required: true,
      },
    };
  }
  if (type === 'location') {
    return {
      id, type, label: 'Share location',
      location: {
        title: 'Share your current location',
        description: '',
        accuracy: 'precise', required: true,
      },
    };
  }
  if (type === 'barcode') {
    return {
      id, type, label: 'Scan code',
      barcode: {
        title: 'Scan the QR or barcode',
        description: '',
        format: 'any', required: true,
      },
    };
  }
  if (type === 'wait') {
    return {
      id, type, label: 'Wait',
      wait: { amount: 24, unit: 'hours', message: "We'll continue this in 24 hours." },
    };
  }
  if (type === 'notify') {
    return {
      id, type, label: 'Send notification',
      notify: {
        channel: 'push', to: 'employee',
        title: 'Update from Navigator', body: '',
        deepLink: '',
      },
    };
  }
  return {
    id, type, label: 'Confirm',
    summary: { title: 'Confirm?', rows: [], confirmLabel: 'Confirm', cancelLabel: 'Cancel' },
  };
}

export default function FlowStepBuilder({ steps, onChange, connections = [], advanced = false }) {
  function addStep(type, atIndex) {
    const next = [...steps];
    const insertAt = atIndex == null ? next.length : atIndex;
    next.splice(insertAt, 0, blankStep(type, next.length));
    onChange(next);
  }
  function updateStep(index, patch) {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }
  function removeStep(index) {
    if (!window.confirm('Remove this step?')) return;
    onChange(steps.filter((_, i) => i !== index));
  }
  function duplicateStep(index) {
    const cloned = JSON.parse(JSON.stringify(steps[index]));
    cloned.id = `${cloned.id}-copy`;
    const next = [...steps];
    next.splice(index + 1, 0, cloned);
    onChange(next);
  }
  function moveStep(index, dir) {
    const ni = index + dir;
    if (ni < 0 || ni >= steps.length) return;
    const next = [...steps];
    [next[index], next[ni]] = [next[ni], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {steps.length === 0 ? (
        <div className="p-8 border-2 border-dashed border-[#E5E7EB] rounded-xl text-center bg-[#FAFAFB]">
          <div className="text-[12.5px] text-[#6B7280] mb-3">No steps yet — design the flow's sequence.</div>
          <AddStepRow onAdd={(t) => addStep(t)} compact={false} />
        </div>
      ) : (
        <>
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <StepCard
                step={step}
                index={idx}
                connections={connections}
                allSteps={steps}
                advanced={advanced}
                onUpdate={(patch) => updateStep(idx, patch)}
                onRemove={() => removeStep(idx)}
                onDuplicate={() => duplicateStep(idx)}
                onMoveUp={() => moveStep(idx, -1)}
                onMoveDown={() => moveStep(idx, +1)}
                canMoveUp={idx > 0}
                canMoveDown={idx < steps.length - 1}
              />
              <AddStepRow compact onAdd={(t) => addStep(t, idx + 1)} />
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );
}

// Grouped step types for the picker. Order matters here — the most common
// patterns surface first so non-technical admins find them quickly.
const STEP_GROUPS = [
  { id: 'collect',  label: 'Collect',  types: ['form', 'file_upload', 'photo', 'signature', 'location', 'barcode'] },
  { id: 'control',  label: 'Control',  types: ['confirm', 'approval', 'branch', 'wait'] },
  { id: 'action',   label: 'Action',   types: ['tool', 'notify'] },
];

function AddStepRow({ onAdd, compact = false }) {
  const [open, setOpen] = useState(false);
  if (compact) {
    return (
      <div className="flex items-center justify-center relative" style={{ height: 14 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-6 px-2 rounded-full text-[11px] font-semibold text-[#6B7280] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] hover:text-[#111827] flex items-center gap-1 shadow-sm"
        >
          <Plus size={11} /> {open ? 'Cancel' : 'Insert step'}
        </button>
        {open && (
          <StepPickerPopover onPick={(t) => { setOpen(false); onAdd(t); }} onClose={() => setOpen(false)} />
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {STEP_GROUPS.map((g) => (
        <div key={g.id}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1.5 text-center">{g.label}</div>
          <div className="flex flex-wrap justify-center gap-2">
            {g.types.map((t) => {
              const m = STEP_META[t];
              return (
                <button
                  key={t}
                  onClick={() => onAdd(t)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors hover:opacity-90"
                  style={{ background: `${m.color}1a`, color: m.color }}
                  title={m.hint}
                >
                  <m.icon size={12} /> {m.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepPickerPopover({ onPick, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[420px] z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-xl p-3">
        {STEP_GROUPS.map((g) => (
          <div key={g.id} className="mb-2 last:mb-0">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1 px-1">{g.label}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {g.types.map((t) => {
                const m = STEP_META[t];
                return (
                  <button
                    key={t}
                    onClick={() => onPick(t)}
                    className="text-left px-2 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-[#F9FAFB]"
                    title={m.hint}
                  >
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: m.color, color: 'white' }}>
                      <m.icon size={11} />
                    </div>
                    <span className="text-[11.5px] font-semibold text-[#111827] truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function StepCard({
  step, index, connections, allSteps, advanced = false,
  onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}) {
  const meta = STEP_META[step.type] || STEP_META.form;
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="bg-white border rounded-xl overflow-hidden"
      style={{ borderColor: '#E5E7EB' }}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
        <div className="cursor-grab text-[#94A3B8]" title="Drag to reorder (use arrows for now)">
          <GripVertical size={14} />
        </div>
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ background: meta.color, color: 'white' }}
        >
          <Icon size={12} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: `${meta.color}1a`, color: meta.color }}
          title={meta.label}>
          {meta.short || meta.label}
        </span>
        <input
          value={step.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="flex-1 px-2 py-1 text-[13px] font-semibold text-[#111827] bg-transparent border border-transparent hover:bg-white hover:border-[#E5E7EB] focus:bg-white focus:border-[#7C3AED] rounded outline-none transition-colors"
        />
        <button onClick={onMoveUp} disabled={!canMoveUp} className="p-1 text-[#94A3B8] hover:text-[#475569] disabled:opacity-30">
          <ChevronUp size={14} />
        </button>
        <button onClick={onMoveDown} disabled={!canMoveDown} className="p-1 text-[#94A3B8] hover:text-[#475569] disabled:opacity-30">
          <ChevronDown size={14} />
        </button>
        <button onClick={onDuplicate} className="p-1 text-[#94A3B8] hover:text-[#475569]" title="Duplicate">
          <Copy size={13} />
        </button>
        <button onClick={onRemove} className="p-1 text-[#94A3B8] hover:text-[#DC2626]" title="Remove">
          <Trash2 size={13} />
        </button>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="p-1 text-[#94A3B8] hover:text-[#475569]"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {expanded && (
        <div className="p-3 space-y-3">
          {advanced && (
            <FieldRow label="Step id">
              <input
                value={step.id}
                onChange={(e) => onUpdate({ id: slug(e.target.value) })}
                className="w-full px-2 py-1.5 text-[12px] font-mono bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
              />
              <p className="text-[10px] text-[#94A3B8] mt-1">
                Used in token references — <span className="font-mono">{`{{${step.id}.field}}`}</span>
              </p>
            </FieldRow>
          )}

          {step.type === 'form' && (
            <FormStepConfig step={step} onUpdate={onUpdate} priorSteps={allSteps.slice(0, index)} advanced={advanced} />
          )}
          {step.type === 'tool' && (
            <ToolStepConfig step={step} onUpdate={onUpdate} connections={connections} priorSteps={allSteps.slice(0, index)} advanced={advanced} />
          )}
          {step.type === 'confirm' && (
            <ConfirmStepConfig step={step} onUpdate={onUpdate} priorSteps={allSteps.slice(0, index)} advanced={advanced} />
          )}
          {step.type === 'photo' && (
            <PhotoStepConfig step={step} onUpdate={onUpdate} />
          )}
          {step.type === 'approval' && (
            <ApprovalStepConfig step={step} onUpdate={onUpdate} priorSteps={allSteps.slice(0, index)} advanced={advanced} />
          )}
          {step.type === 'branch' && (
            <BranchStepConfig step={step} onUpdate={onUpdate} priorSteps={allSteps.slice(0, index)} allSteps={allSteps} advanced={advanced} />
          )}
          {step.type === 'file_upload' && (
            <FileUploadStepConfig step={step} onUpdate={onUpdate} />
          )}
          {step.type === 'signature' && (
            <SignatureStepConfig step={step} onUpdate={onUpdate} priorSteps={allSteps.slice(0, index)} advanced={advanced} />
          )}
          {step.type === 'location' && (
            <LocationStepConfig step={step} onUpdate={onUpdate} />
          )}
          {step.type === 'barcode' && (
            <BarcodeStepConfig step={step} onUpdate={onUpdate} />
          )}
          {step.type === 'wait' && (
            <WaitStepConfig step={step} onUpdate={onUpdate} />
          )}
          {step.type === 'notify' && (
            <NotifyStepConfig step={step} onUpdate={onUpdate} priorSteps={allSteps.slice(0, index)} advanced={advanced} />
          )}
        </div>
      )}
    </div>
  );
}

function FormStepConfig({ step, onUpdate, advanced = false }) {
  function patchSpec(p) { onUpdate({ spec: { ...step.spec, ...p } }); }
  function addField() {
    const fields = [...(step.spec?.fields || [])];
    fields.push({ id: `field_${fields.length + 1}`, label: `Field ${fields.length + 1}`, type: 'text', required: false });
    patchSpec({ fields });
  }
  function updateField(i, p) {
    const fields = step.spec.fields.map((f, idx) => (idx === i ? { ...f, ...p } : f));
    patchSpec({ fields });
  }
  function removeField(i) {
    patchSpec({ fields: step.spec.fields.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Form title">
          <input
            value={step.spec?.title || ''}
            onChange={(e) => patchSpec({ title: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
          />
        </FieldRow>
        <FieldRow label="Submit button label">
          <input
            value={step.spec?.submitLabel || ''}
            onChange={(e) => patchSpec({ submitLabel: e.target.value })}
            placeholder="Submit"
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
          />
        </FieldRow>
      </div>
      <FieldRow label="Helper text (optional)">
        <input
          value={step.spec?.description || ''}
          onChange={(e) => patchSpec({ description: e.target.value })}
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
        />
      </FieldRow>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Fields</span>
          <button onClick={addField} className="text-[11px] font-semibold text-[#7C3AED] hover:underline flex items-center gap-1">
            <Plus size={11} /> Add field
          </button>
        </div>
        {(step.spec?.fields || []).length === 0 ? (
          <div className="px-3 py-3 bg-[#F9FAFB] border border-dashed border-[#E5E7EB] rounded-lg text-[11px] text-[#94A3B8] italic">
            No fields yet — add at least one for the user to fill in.
          </div>
        ) : (
          <div className="space-y-2">
            {step.spec.fields.map((f, i) => (
              <FieldConfig
                key={i}
                field={f}
                onChange={(p) => updateField(i, p)}
                onRemove={() => removeField(i)}
                advanced={advanced}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldConfig({ field, onChange, onRemove, advanced = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#E5E7EB] rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[#FAFAFB] border-b border-[#F1F5F9]">
        <input
          value={field.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Field label"
          className="flex-1 px-2 py-1 text-[12px] font-semibold bg-transparent border border-transparent hover:bg-white hover:border-[#E5E7EB] focus:bg-white focus:border-[#7C3AED] rounded outline-none transition-colors"
        />
        <select
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value })}
          className="px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none"
        >
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-[#475569] cursor-pointer">
          <input type="checkbox" checked={!!field.required} onChange={(e) => onChange({ required: e.target.checked })} />
          required
        </label>
        <button onClick={() => setOpen((v) => !v)} className="p-1 text-[#94A3B8] hover:text-[#475569]">
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button onClick={onRemove} className="p-1 text-[#94A3B8] hover:text-[#DC2626]">
          <Trash2 size={12} />
        </button>
      </div>
      {open && (
        <div className="p-2 space-y-2 bg-white">
          {advanced && (
            <FieldRow label="Field id">
              <input
                value={field.id}
                onChange={(e) => onChange({ id: slug(e.target.value) })}
                className="w-full px-2 py-1 text-[11px] font-mono bg-white border border-[#E5E7EB] rounded outline-none"
              />
            </FieldRow>
          )}
          <FieldRow label="Description">
            <input
              value={field.description || ''}
              onChange={(e) => onChange({ description: e.target.value })}
              className="w-full px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none"
            />
          </FieldRow>
          <FieldRow label="Placeholder">
            <input
              value={field.placeholder || ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              className="w-full px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none"
            />
          </FieldRow>
          {(field.type === 'select' || field.type === 'radio') && (
            <FieldRow label="Options">
              <OptionsEditor
                options={field.options || []}
                onChange={(options) => onChange({ options })}
              />
            </FieldRow>
          )}
          <ValidationEditor
            type={field.type}
            value={field.validation || {}}
            onChange={(validation) => onChange({ validation })}
            advanced={advanced}
          />
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }) {
  function add() { onChange([...options, { value: `opt_${options.length + 1}`, label: `Option ${options.length + 1}` }]); }
  function update(i, p) { onChange(options.map((o, idx) => idx === i ? { ...o, ...p } : o)); }
  function remove(i) { onChange(options.filter((_, idx) => idx !== i)); }
  return (
    <div className="space-y-1">
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-1">
          <input value={o.value} onChange={(e) => update(i, { value: e.target.value })} placeholder="value"
            className="w-24 px-2 py-1 text-[11px] font-mono bg-white border border-[#E5E7EB] rounded outline-none" />
          <input value={o.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="label"
            className="flex-1 px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none" />
          <button onClick={() => remove(i)} className="p-1 text-[#94A3B8] hover:text-[#DC2626]"><Trash2 size={11} /></button>
        </div>
      ))}
      <button onClick={add} className="text-[11px] font-semibold text-[#7C3AED] hover:underline">+ Add option</button>
    </div>
  );
}

function ValidationEditor({ type, value, onChange, advanced = false }) {
  function patch(p) { onChange({ ...value, ...p }); }
  const showStr = type === 'text' || type === 'textarea' || type === 'email' || type === 'url';
  const showNum = type === 'number';
  // Derive which preset is currently active. If the user has a pattern that
  // matches a preset, surface that label; otherwise fall back to "custom".
  const currentPreset = value.preset
    || Object.entries(FORMAT_PRESETS).find(([, p]) => p.pattern && p.pattern === value.pattern)?.[0]
    || (value.pattern ? 'custom' : 'none');
  function pickPreset(key) {
    const p = FORMAT_PRESETS[key];
    if (!p) return;
    patch({
      preset: key,
      pattern: p.pattern || undefined,
      patternMessage: p.msg || undefined,
    });
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {showStr && (
        <>
          <FieldRow label="Min length">
            <input type="number" value={value.minLength ?? ''} onChange={(e) => patch({ minLength: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="w-full px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none" />
          </FieldRow>
          <FieldRow label="Max length">
            <input type="number" value={value.maxLength ?? ''} onChange={(e) => patch({ maxLength: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="w-full px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none" />
          </FieldRow>
        </>
      )}
      {showNum && (
        <>
          <FieldRow label="Min">
            <input type="number" value={value.min ?? ''} onChange={(e) => patch({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="w-full px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none" />
          </FieldRow>
          <FieldRow label="Max">
            <input type="number" value={value.max ?? ''} onChange={(e) => patch({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="w-full px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none" />
          </FieldRow>
        </>
      )}
      {showStr && (
        <>
          <FieldRow label="Format">
            <select
              value={currentPreset}
              onChange={(e) => pickPreset(e.target.value)}
              className="w-full px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none"
            >
              {Object.entries(FORMAT_PRESETS).map(([k, p]) => (
                <option key={k} value={k}>{p.label}</option>
              ))}
            </select>
          </FieldRow>
          {(advanced || currentPreset === 'custom') && (
            <>
              <FieldRow label="Regex pattern (advanced)">
                <input value={value.pattern ?? ''} onChange={(e) => patch({ pattern: e.target.value || undefined, preset: 'custom' })}
                  className="w-full px-2 py-1 text-[11px] font-mono bg-white border border-[#E5E7EB] rounded outline-none" />
              </FieldRow>
              <FieldRow label="Error message">
                <input value={value.patternMessage ?? ''} onChange={(e) => patch({ patternMessage: e.target.value || undefined })}
                  className="w-full px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none" />
              </FieldRow>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ToolStepConfig({ step, onUpdate, connections, priorSteps, advanced = false }) {
  const tool = step.tool || {};
  const connected = connections.filter((c) => c.status === 'connected' || c.status === 'degraded');
  // Accept either new `connectionId` or legacy `connectorId` on the step payload.
  const refId = tool.connectionId || tool.connectorId || '';
  const connection = connected.find((c) => c.id === refId);
  const toolList = connection
    ? (connection.kind === 'toolkit'
        ? (connection.tools || [])
        : [{ id: connection.kind === 'handoff' ? 'invoke' : 'search', name: connection.kind === 'handoff' ? 'invoke' : 'search' }])
    : [];
  const unknown = refId && !connection;

  function patchTool(p) { onUpdate({ tool: { ...tool, ...p } }); }
  function updateArg(key, value) {
    onUpdate({ args: { ...(step.args || {}), [key]: value } });
  }
  function removeArg(key) {
    const { [key]: _, ...rest } = step.args || {};
    onUpdate({ args: rest });
  }
  function addArg() {
    const name = window.prompt('Argument name (e.g. start_date):');
    if (!name) return;
    updateArg(name, '');
  }

  return (
    <div className="space-y-3">
      {unknown && (
        <div className="flex items-start gap-2 px-3 py-2 bg-[#FEF3C7] border border-[#FCD34D] rounded-lg text-[11px] text-[#92400E]">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <div>This step references <span className="font-mono">{refId}</span>, which isn't in this workspace. Pick a connected one or wire it up first.</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Connection">
          <select
            value={refId}
            onChange={(e) => patchTool({ connectionId: e.target.value, connectorId: undefined, toolId: '' })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
          >
            <option value="">Pick a connection…</option>
            {connected.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Tool">
          <select
            value={tool.toolId || ''}
            onChange={(e) => patchTool({ toolId: e.target.value })}
            disabled={!connection}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none disabled:bg-[#F9FAFB] disabled:text-[#94A3B8]"
          >
            <option value="">{connection ? 'Pick a tool…' : 'Choose a connection first'}</option>
            {toolList.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </FieldRow>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Arguments</span>
          <button onClick={addArg} className="text-[11px] font-semibold text-[#7C3AED] hover:underline flex items-center gap-1">
            <Plus size={11} /> Add arg
          </button>
        </div>
        {Object.keys(step.args || {}).length === 0 ? (
          <div className="px-3 py-2 text-[11px] text-[#94A3B8] italic">
            No args wired — Navigator will rely on AI fallback to fill them.
          </div>
        ) : (
          <div className="space-y-1.5">
            {Object.entries(step.args || {}).map(([key, val]) => (
              <ArgRow
                key={key}
                argKey={key}
                value={val}
                onChange={(v) => updateArg(key, v)}
                onRemove={() => removeArg(key)}
                priorSteps={priorSteps}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArgRow({ argKey, value, onChange, onRemove, priorSteps }) {
  const [tokenOpen, setTokenOpen] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <code className="text-[11px] text-[#374151] bg-[#F3F4F6] px-2 py-1 rounded font-mono">{argKey}</code>
      <span className="text-[#94A3B8] text-[11px]">=</span>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder='Literal or {{step.field}} token'
        className="flex-1 px-2 py-1 text-[11px] font-mono bg-white border border-[#E5E7EB] rounded outline-none"
      />
      <div className="relative">
        <button
          type="button"
          onClick={() => setTokenOpen((v) => !v)}
          className="p-1 text-[#7C3AED] hover:bg-[#F5F3FF] rounded"
          title="Insert token from a prior step"
        >
          <Braces size={13} />
        </button>
        {tokenOpen && (
          <TokenPicker
            priorSteps={priorSteps}
            onPick={(token) => { onChange(`${value || ''}${token}`); setTokenOpen(false); }}
            onClose={() => setTokenOpen(false)}
          />
        )}
      </div>
      <button onClick={onRemove} className="p-1 text-[#94A3B8] hover:text-[#DC2626]">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function TokenPicker({ priorSteps, onPick, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 w-72 max-h-80 overflow-auto z-50 bg-white border border-[#E5E7EB] rounded-lg shadow-lg p-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] px-1 py-1">
          Outputs from prior steps
        </div>
        {priorSteps.length === 0 ? (
          <div className="text-[11px] text-[#94A3B8] italic px-2 py-2">No earlier steps yet.</div>
        ) : (
          priorSteps.map((s) => (
            <div key={s.id} className="mb-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] px-1 mt-1">
                {s.label} <span className="font-normal opacity-70 text-[#94A3B8]">· {s.type}</span>
              </div>
              {s.type === 'form' ? (
                (s.spec?.fields || []).length === 0 ? (
                  <div className="text-[10.5px] text-[#94A3B8] italic px-2 py-1">(no fields yet)</div>
                ) : (
                  s.spec.fields.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onPick(`{{${s.id}.${f.id}}}`)}
                      className="w-full text-left px-2 py-1 hover:bg-[#F5F3FF] rounded font-mono text-[11px] text-[#374151]"
                    >
                      <span className="text-[#94A3B8]">{`{{${s.id}.`}</span>{f.id}<span className="text-[#94A3B8]">{`}}`}</span>
                    </button>
                  ))
                )
              ) : s.type === 'photo' ? (
                [
                  { id: 'validation.passed',   hint: 'pass/fail' },
                  { id: 'validation.summary',  hint: 'AI summary' },
                  { id: 'imageDataUrl',        hint: 'image (data URL)' },
                  { id: 'acceptedDespiteFail', hint: 'accepted on fail?' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onPick(`{{${s.id}.${f.id}}}`)}
                    title={f.hint}
                    className="w-full text-left px-2 py-1 hover:bg-[#F5F3FF] rounded font-mono text-[11px] text-[#374151]"
                  >
                    <span className="text-[#94A3B8]">{`{{${s.id}.`}</span>{f.id}<span className="text-[#94A3B8]">{`}}`}</span>
                  </button>
                ))
              ) : (
                <button
                  onClick={() => onPick(`{{${s.id}}}`)}
                  className="w-full text-left px-2 py-1 hover:bg-[#F5F3FF] rounded font-mono text-[11px] text-[#374151]"
                >
                  <span className="text-[#94A3B8]">{`{{`}</span>{s.id}<span className="text-[#94A3B8]">{`}}`}</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function ConfirmStepConfig({ step, onUpdate, priorSteps, advanced = false }) {
  const summary = step.summary || {};
  function patch(p) { onUpdate({ summary: { ...summary, ...p } }); }
  function addRow() { patch({ rows: [...(summary.rows || []), { label: '', value: '' }] }); }
  function updateRow(i, p) { patch({ rows: summary.rows.map((r, idx) => idx === i ? { ...r, ...p } : r) }); }
  function removeRow(i) { patch({ rows: summary.rows.filter((_, idx) => idx !== i) }); }

  return (
    <div className="space-y-3">
      <FieldRow label="Title">
        <input
          value={summary.title || ''}
          onChange={(e) => patch({ title: e.target.value })}
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
        />
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Confirm label">
          <input
            value={summary.confirmLabel || ''}
            onChange={(e) => patch({ confirmLabel: e.target.value })}
            placeholder="Confirm"
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
          />
        </FieldRow>
        <FieldRow label="Cancel label">
          <input
            value={summary.cancelLabel || ''}
            onChange={(e) => patch({ cancelLabel: e.target.value })}
            placeholder="Cancel"
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
          />
        </FieldRow>
      </div>
      <FieldRow label="Cancel rewinds to step">
        <select
          value={summary.cancelTo || ''}
          onChange={(e) => patch({ cancelTo: e.target.value || undefined })}
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
        >
          <option value="">(default — the last form step)</option>
          {priorSteps.filter((s) => s.type === 'form').map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </FieldRow>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Summary rows</span>
          <button onClick={addRow} className="text-[11px] font-semibold text-[#7C3AED] hover:underline flex items-center gap-1">
            <Plus size={11} /> Add row
          </button>
        </div>
        {(summary.rows || []).length === 0 ? (
          <div className="px-3 py-2 text-[11px] text-[#94A3B8] italic">
            No rows — add tokens like <span className="font-mono">{`{{collect-dates.start_date}}`}</span> to reflect prior form values.
          </div>
        ) : (
          <div className="space-y-1.5">
            {summary.rows.map((r, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  value={r.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder="Label (e.g. Start)"
                  className="w-32 px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none"
                />
                <input
                  value={r.value}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder='Value or {{token}}'
                  className="flex-1 px-2 py-1 text-[11px] font-mono bg-white border border-[#E5E7EB] rounded outline-none"
                />
                <ConfirmRowTokenButton
                  priorSteps={priorSteps}
                  onPick={(token) => updateRow(i, { value: `${r.value || ''}${token}` })}
                />
                <button onClick={() => removeRow(i)} className="p-1 text-[#94A3B8] hover:text-[#DC2626]">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmRowTokenButton({ priorSteps, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1 text-[#7C3AED] hover:bg-[#F5F3FF] rounded"
        title="Insert token"
      >
        <Braces size={13} />
      </button>
      {open && (
        <TokenPicker
          priorSteps={priorSteps}
          onPick={(token) => { onPick(token); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function PhotoStepConfig({ step, onUpdate }) {
  const spec = step.spec || {};
  const ai = spec.aiValidation || {};
  function patchSpec(p) { onUpdate({ spec: { ...spec, ...p } }); }
  function patchAi(p)   { onUpdate({ spec: { ...spec, aiValidation: { ...ai, ...p } } }); }

  function addCriterion() {
    const cs = Array.isArray(ai.criteria) ? ai.criteria : [];
    patchAi({ criteria: [...cs, { id: `criterion_${cs.length + 1}`, label: '', required: false }] });
  }
  function updateCriterion(i, p) {
    const cs = (ai.criteria || []).map((c, idx) => idx === i ? { ...c, ...p } : c);
    patchAi({ criteria: cs });
  }
  function removeCriterion(i) {
    patchAi({ criteria: (ai.criteria || []).filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Title (employee sees this)">
          <input
            value={spec.title || ''}
            onChange={(e) => patchSpec({ title: e.target.value })}
            placeholder="Take a photo of your storefront"
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0EA5A8] outline-none"
          />
        </FieldRow>
        <FieldRow label="Capture mode">
          <select
            value={spec.captureMode || 'both'}
            onChange={(e) => patchSpec({ captureMode: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0EA5A8] outline-none"
          >
            <option value="both">Camera or upload</option>
            <option value="camera">Camera only</option>
            <option value="upload">Upload only</option>
          </select>
        </FieldRow>
      </div>
      <FieldRow label="Helper text (instructions to the employee)">
        <textarea
          value={spec.description || ''}
          onChange={(e) => patchSpec({ description: e.target.value })}
          rows={2}
          placeholder="Stand 2–3 metres back. Capture the whole shopfront…"
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0EA5A8] outline-none resize-none"
        />
      </FieldRow>

      <div className="grid grid-cols-3 gap-3">
        <FieldRow label="Submit label">
          <input
            value={spec.submitLabel || ''}
            onChange={(e) => patchSpec({ submitLabel: e.target.value })}
            placeholder="Use this photo"
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0EA5A8] outline-none"
          />
        </FieldRow>
        <FieldRow label="Retake label">
          <input
            value={spec.retakeLabel || ''}
            onChange={(e) => patchSpec({ retakeLabel: e.target.value })}
            placeholder="Retake"
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0EA5A8] outline-none"
          />
        </FieldRow>
        <FieldRow label="On validation fail">
          <select
            value={spec.onFail || 'warn'}
            onChange={(e) => patchSpec({ onFail: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0EA5A8] outline-none"
          >
            <option value="warn">Warn — allow submit anyway</option>
            <option value="block">Block — must pass to continue</option>
            <option value="allow">Allow — advisory only</option>
          </select>
        </FieldRow>
      </div>

      <div className="pt-2 mt-1 border-t border-[#F1F5F9]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">AI validation</span>
          <label className="flex items-center gap-1 text-[11px] text-[#475569] cursor-pointer">
            <input
              type="checkbox"
              checked={ai.annotations !== false}
              onChange={(e) => patchAi({ annotations: e.target.checked })}
            />
            Annotations (bounding boxes)
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Vision model">
            <select
              value={ai.model || 'gpt-4o-mini'}
              onChange={(e) => patchAi({ model: e.target.value })}
              className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0EA5A8] outline-none"
            >
              <option value="gpt-4o-mini">gpt-4o-mini (fast, cheap)</option>
              <option value="gpt-4o">gpt-4o (best quality)</option>
            </select>
          </FieldRow>
          <FieldRow label="Enabled">
            <select
              value={ai.enabled !== false ? 'on' : 'off'}
              onChange={(e) => patchAi({ enabled: e.target.value === 'on' })}
              className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0EA5A8] outline-none"
            >
              <option value="on">Run AI validation on submit</option>
              <option value="off">Off — just capture the photo</option>
            </select>
          </FieldRow>
        </div>

        <FieldRow label="System prompt (optional — sets the AI's persona)">
          <textarea
            value={ai.systemPrompt || ''}
            onChange={(e) => patchAi({ systemPrompt: e.target.value })}
            rows={3}
            placeholder="You are a retail brand-compliance reviewer…"
            className="w-full mt-1 px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0EA5A8] outline-none resize-none"
          />
        </FieldRow>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Criteria</span>
            <button onClick={addCriterion} className="text-[11px] font-semibold text-[#0EA5A8] hover:underline flex items-center gap-1">
              <Plus size={11} /> Add criterion
            </button>
          </div>
          {(ai.criteria || []).length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-[#94A3B8] italic">
              Add at least one criterion for the model to check.
            </div>
          ) : (
            <div className="space-y-1.5">
              {(ai.criteria || []).map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <code className="text-[11px] text-[#374151] bg-[#F3F4F6] px-2 py-1 rounded font-mono shrink-0">{c.id}</code>
                  <input
                    value={c.label}
                    onChange={(e) => updateCriterion(i, { label: e.target.value })}
                    placeholder="What should the AI look for?"
                    className="flex-1 px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-[#475569] cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={!!c.required}
                      onChange={(e) => updateCriterion(i, { required: e.target.checked })}
                    />
                    required
                  </label>
                  <button onClick={() => removeCriterion(i)} className="p-1 text-[#94A3B8] hover:text-[#DC2626]">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-[#94A3B8] mt-2">
            Tokens available downstream: <span className="font-mono">{`{{${step.id}.imageDataUrl}}`}</span>, <span className="font-mono">{`{{${step.id}.validation.passed}}`}</span>, <span className="font-mono">{`{{${step.id}.validation.summary}}`}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Approval ──────────────────────────────────────────────────────────────
function ApprovalStepConfig({ step, onUpdate, priorSteps, advanced = false }) {
  const a = step.approval || {};
  function patch(p) { onUpdate({ approval: { ...a, ...p } }); }
  return (
    <div className="space-y-3">
      <div className="px-3 py-2 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[11px] text-[#991B1B] leading-relaxed">
        <b>How approvals work:</b> the flow pauses and an approver is notified. They can accept or reject in their own chat / email / Staffbase post. The employee sees a "waiting" card meanwhile.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Route to">
          <select
            value={a.route || 'manager'}
            onChange={(e) => patch({ route: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#DC2626] outline-none"
          >
            <option value="manager">The employee's manager</option>
            <option value="hr">HR team</option>
            <option value="it">IT team</option>
            <option value="finance">Finance team</option>
            <option value="role">A specific role…</option>
            <option value="named">A specific person…</option>
          </select>
        </FieldRow>
        <FieldRow label="SLA (hours)">
          <input
            type="number"
            value={a.slaHours ?? 24}
            onChange={(e) => patch({ slaHours: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#DC2626] outline-none"
          />
        </FieldRow>
      </div>
      {(a.route === 'role' || a.route === 'named') && (
        <FieldRow label={a.route === 'role' ? 'Which role' : 'Which person (email or token)'}>
          <input
            value={a.approver || ''}
            onChange={(e) => patch({ approver: e.target.value })}
            placeholder={a.route === 'role' ? 'e.g. HR Manager' : 'e.g. jane@company.com or {{collect-info.manager_email}}'}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#DC2626] outline-none"
          />
        </FieldRow>
      )}
      <FieldRow label="Message to approver">
        <textarea
          value={a.message || ''}
          onChange={(e) => patch({ message: e.target.value })}
          rows={2}
          placeholder="Please review and approve this request."
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#DC2626] outline-none resize-none"
        />
      </FieldRow>
      <FieldRow label="If rejected">
        <select
          value={a.onReject || 'cancel'}
          onChange={(e) => patch({ onReject: e.target.value })}
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#DC2626] outline-none"
        >
          <option value="cancel">Cancel the flow</option>
          <option value="rewind">Rewind to an earlier step</option>
          <option value="continue">Continue anyway (record only)</option>
        </select>
      </FieldRow>
      {a.onReject === 'rewind' && (
        <FieldRow label="Rewind to step">
          <select
            value={a.rewindTo || ''}
            onChange={(e) => patch({ rewindTo: e.target.value || undefined })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#DC2626] outline-none"
          >
            <option value="">(default — the last form)</option>
            {priorSteps.filter((s) => s.type === 'form').map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </FieldRow>
      )}
    </div>
  );
}

// ── Branch ────────────────────────────────────────────────────────────────
function BranchStepConfig({ step, onUpdate, priorSteps, allSteps, advanced = false }) {
  const b = step.branch || {};
  function patch(p) { onUpdate({ branch: { ...b, ...p } }); }
  // Step targets exclude self + earlier (you can only branch forward, otherwise
  // you get loops in a prototype with no cycle detection).
  const myIdx = allSteps.findIndex((s) => s.id === step.id);
  const targetCandidates = allSteps.slice(myIdx + 1);

  return (
    <div className="space-y-3">
      <div className="px-3 py-2 bg-[#ECFEFF] border border-[#A5F3FC] rounded-lg text-[11px] text-[#155E75] leading-relaxed">
        <b>What this does:</b> when the flow reaches this step, evaluate the condition. If it's true, jump to the "Then" step. If false, jump to "Else" (or just continue to the next step).
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
        <FieldRow label="Compare this">
          <ValueOrTokenInput
            value={b.left || ''}
            onChange={(v) => patch({ left: v })}
            placeholder='{{collect-expense.amount}}'
            priorSteps={priorSteps}
          />
        </FieldRow>
        <FieldRow label="To">
          <select
            value={b.op || 'equals'}
            onChange={(e) => patch({ op: e.target.value })}
            className="px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0891B2] outline-none"
          >
            <option value="equals">equals</option>
            <option value="not_equals">does not equal</option>
            <option value="greater_than">is greater than</option>
            <option value="less_than">is less than</option>
            <option value="contains">contains</option>
            <option value="is_truthy">is set / truthy</option>
          </select>
        </FieldRow>
        <FieldRow label="This value">
          <ValueOrTokenInput
            value={b.right || ''}
            onChange={(v) => patch({ right: v })}
            placeholder={b.op === 'is_truthy' ? '(ignored)' : '100'}
            priorSteps={priorSteps}
          />
        </FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="If TRUE, jump to">
          <select
            value={b.thenGoTo || ''}
            onChange={(e) => patch({ thenGoTo: e.target.value || undefined })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0891B2] outline-none"
          >
            <option value="">(default — next step)</option>
            {targetCandidates.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="If FALSE, jump to">
          <select
            value={b.elseGoTo || ''}
            onChange={(e) => patch({ elseGoTo: e.target.value || undefined })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0891B2] outline-none"
          >
            <option value="">(default — next step)</option>
            {targetCandidates.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </FieldRow>
      </div>
    </div>
  );
}

// Compact input that opens a token picker. Used by Branch's left/right.
function ValueOrTokenInput({ value, onChange, placeholder, priorSteps }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-2 py-1.5 text-[12px] font-mono bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0891B2] outline-none"
      />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 text-[#0891B2] hover:bg-[#ECFEFF] rounded"
          title="Pull a value from an earlier step"
        >
          <Braces size={13} />
        </button>
        {open && (
          <TokenPicker
            priorSteps={priorSteps}
            onPick={(t) => { onChange(`${value || ''}${t}`); setOpen(false); }}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── File upload ──────────────────────────────────────────────────────────
function FileUploadStepConfig({ step, onUpdate }) {
  const f = step.file || {};
  function patch(p) { onUpdate({ file: { ...f, ...p } }); }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Title (employee sees this)">
          <input
            value={f.title || ''}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Attach a document"
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#9333EA] outline-none"
          />
        </FieldRow>
        <FieldRow label="File type">
          <select
            value={f.kind || 'any'}
            onChange={(e) => patch({ kind: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#9333EA] outline-none"
          >
            <option value="any">Any file</option>
            <option value="pdf">PDFs only</option>
            <option value="image">Images only</option>
            <option value="document">Documents (PDF, Word, txt)</option>
          </select>
        </FieldRow>
      </div>
      <FieldRow label="Helper text">
        <textarea
          value={f.description || ''}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
          placeholder="PDFs and images up to 10 MB."
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#9333EA] outline-none resize-none"
        />
      </FieldRow>
      <div className="grid grid-cols-3 gap-3">
        <FieldRow label="Max size (MB)">
          <input
            type="number"
            value={f.maxMB ?? 10}
            onChange={(e) => patch({ maxMB: Math.max(1, Number(e.target.value) || 1) })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#9333EA] outline-none"
          />
        </FieldRow>
        <FieldRow label="Submit label">
          <input
            value={f.submitLabel || 'Upload'}
            onChange={(e) => patch({ submitLabel: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#9333EA] outline-none"
          />
        </FieldRow>
        <FieldRow label="Required">
          <select
            value={f.required !== false ? 'yes' : 'no'}
            onChange={(e) => patch({ required: e.target.value === 'yes' })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#9333EA] outline-none"
          >
            <option value="yes">Yes</option>
            <option value="no">Optional</option>
          </select>
        </FieldRow>
      </div>
    </div>
  );
}

// ── Signature ────────────────────────────────────────────────────────────
function SignatureStepConfig({ step, onUpdate }) {
  const s = step.signature || {};
  function patch(p) { onUpdate({ signature: { ...s, ...p } }); }
  return (
    <div className="space-y-3">
      <FieldRow label="Title (employee sees this)">
        <input
          value={s.title || ''}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Sign to acknowledge"
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0D9488] outline-none"
        />
      </FieldRow>
      <FieldRow label="Policy / text to attest to">
        <textarea
          value={s.description || ''}
          onChange={(e) => patch({ description: e.target.value })}
          rows={3}
          placeholder='Paste the policy or acknowledgment text the employee is signing.'
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0D9488] outline-none resize-y"
        />
      </FieldRow>
      <FieldRow label="Attestation statement">
        <input
          value={s.attestation || ''}
          onChange={(e) => patch({ attestation: e.target.value })}
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0D9488] outline-none"
        />
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Signature method">
          <select
            value={s.kind || 'draw'}
            onChange={(e) => patch({ kind: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0D9488] outline-none"
          >
            <option value="draw">Draw signature</option>
            <option value="type">Type full name</option>
            <option value="click">Click to acknowledge</option>
          </select>
        </FieldRow>
        <FieldRow label="Required">
          <select
            value={s.required !== false ? 'yes' : 'no'}
            onChange={(e) => patch({ required: e.target.value === 'yes' })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#0D9488] outline-none"
          >
            <option value="yes">Yes</option>
            <option value="no">Optional</option>
          </select>
        </FieldRow>
      </div>
    </div>
  );
}

// ── Location ─────────────────────────────────────────────────────────────
function LocationStepConfig({ step, onUpdate }) {
  const l = step.location || {};
  function patch(p) { onUpdate({ location: { ...l, ...p } }); }
  return (
    <div className="space-y-3">
      <FieldRow label="Title (employee sees this)">
        <input
          value={l.title || ''}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Share your current location"
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#16A34A] outline-none"
        />
      </FieldRow>
      <FieldRow label="Helper text (optional)">
        <input
          value={l.description || ''}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder='So we can route the incident to the right team.'
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#16A34A] outline-none"
        />
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Accuracy">
          <select
            value={l.accuracy || 'precise'}
            onChange={(e) => patch({ accuracy: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#16A34A] outline-none"
          >
            <option value="precise">Precise (GPS)</option>
            <option value="approximate">Approximate (city-level)</option>
          </select>
        </FieldRow>
        <FieldRow label="Required">
          <select
            value={l.required !== false ? 'yes' : 'no'}
            onChange={(e) => patch({ required: e.target.value === 'yes' })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#16A34A] outline-none"
          >
            <option value="yes">Yes</option>
            <option value="no">Optional</option>
          </select>
        </FieldRow>
      </div>
    </div>
  );
}

// ── Barcode ──────────────────────────────────────────────────────────────
function BarcodeStepConfig({ step, onUpdate }) {
  const b = step.barcode || {};
  function patch(p) { onUpdate({ barcode: { ...b, ...p } }); }
  return (
    <div className="space-y-3">
      <FieldRow label="Title (employee sees this)">
        <input
          value={b.title || ''}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Scan the QR or barcode"
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#EA580C] outline-none"
        />
      </FieldRow>
      <FieldRow label="Helper text">
        <input
          value={b.description || ''}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder='Point your camera at the label on the equipment.'
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#EA580C] outline-none"
        />
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Accepted format">
          <select
            value={b.format || 'any'}
            onChange={(e) => patch({ format: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#EA580C] outline-none"
          >
            <option value="any">Any code</option>
            <option value="qr">QR code</option>
            <option value="ean">EAN / UPC</option>
            <option value="code128">Code 128</option>
            <option value="datamatrix">DataMatrix</option>
          </select>
        </FieldRow>
        <FieldRow label="Required">
          <select
            value={b.required !== false ? 'yes' : 'no'}
            onChange={(e) => patch({ required: e.target.value === 'yes' })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#EA580C] outline-none"
          >
            <option value="yes">Yes</option>
            <option value="no">Optional</option>
          </select>
        </FieldRow>
      </div>
    </div>
  );
}

// ── Wait ─────────────────────────────────────────────────────────────────
function WaitStepConfig({ step, onUpdate }) {
  const w = step.wait || {};
  function patch(p) { onUpdate({ wait: { ...w, ...p } }); }
  return (
    <div className="space-y-3">
      <div className="px-3 py-2 bg-[#F5F3FF] border border-[#DDD6FE] rounded-lg text-[11px] text-[#5B21B6] leading-relaxed">
        <b>What this does:</b> the flow pauses for the chosen duration, then resumes automatically. Useful for follow-up reminders or batching downstream work.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="How long">
          <input
            type="number"
            value={w.amount ?? 24}
            onChange={(e) => patch({ amount: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
          />
        </FieldRow>
        <FieldRow label="Unit">
          <select
            value={w.unit || 'hours'}
            onChange={(e) => patch({ unit: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </FieldRow>
      </div>
      <FieldRow label="Message to employee while waiting">
        <input
          value={w.message || ''}
          onChange={(e) => patch({ message: e.target.value })}
          placeholder="We'll continue this in 24 hours."
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#7C3AED] outline-none"
        />
      </FieldRow>
    </div>
  );
}

// ── Notify ───────────────────────────────────────────────────────────────
function NotifyStepConfig({ step, onUpdate, priorSteps, advanced = false }) {
  const n = step.notify || {};
  function patch(p) { onUpdate({ notify: { ...n, ...p } }); }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Channel">
          <select
            value={n.channel || 'push'}
            onChange={(e) => patch({ channel: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#2563EB] outline-none"
          >
            <option value="push">Push notification</option>
            <option value="email">Email</option>
            <option value="in_app">In-app banner</option>
          </select>
        </FieldRow>
        <FieldRow label="Send to">
          <select
            value={n.to || 'employee'}
            onChange={(e) => patch({ to: e.target.value })}
            className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#2563EB] outline-none"
          >
            <option value="employee">The employee</option>
            <option value="manager">Their manager</option>
            <option value="role:HR">HR team</option>
            <option value="role:IT">IT team</option>
          </select>
        </FieldRow>
      </div>
      <FieldRow label="Title">
        <input
          value={n.title || ''}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Update from Navigator"
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#2563EB] outline-none"
        />
      </FieldRow>
      <FieldRow label="Body">
        <textarea
          value={n.body || ''}
          onChange={(e) => patch({ body: e.target.value })}
          rows={2}
          placeholder='Hi! Your request was just submitted.'
          className="w-full px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#2563EB] outline-none resize-none"
        />
      </FieldRow>
      {advanced && (
        <FieldRow label="Deep link (optional)">
          <input
            value={n.deepLink || ''}
            onChange={(e) => patch({ deepLink: e.target.value || undefined })}
            placeholder="staffbase://posts/123 or https://…"
            className="w-full px-2 py-1.5 text-[12px] font-mono bg-white border border-[#E5E7EB] rounded-lg focus:border-[#2563EB] outline-none"
          />
        </FieldRow>
      )}
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</div>
      {children}
    </label>
  );
}

function slug(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
