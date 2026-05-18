// Visual step composer for the Flow editor. Renders a vertical timeline of
// step cards with type-specific config UIs. Owns no DB state — the parent
// FlowDetail manages save/load.

import React, { useState, useMemo } from 'react';
import {
  ClipboardList, ShieldCheck, Wrench, Plus, Trash2, Copy, ChevronDown, ChevronUp,
  GripVertical, AlertTriangle, Braces, Camera,
} from 'lucide-react';

const STEP_META = {
  form:    { label: 'Form',    color: '#0EA5E9', icon: ClipboardList,
             hint: 'Collect input from the employee.' },
  tool:    { label: 'Tool',    color: '#7C3AED', icon: Wrench,
             hint: 'Invoke an MCP tool, agent, or KB search.' },
  confirm: { label: 'Confirm', color: '#F59E0B', icon: ShieldCheck,
             hint: 'Review the data and confirm before commit.' },
  photo:   { label: 'Photo',   color: '#0EA5A8', icon: Camera,
             hint: 'Employee takes/uploads a photo; AI validates against criteria.' },
};

const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'url', 'date', 'select', 'checkbox', 'radio'];

function blankStep(type, index) {
  const idBase = type === 'form' ? 'collect'
    : type === 'confirm' ? 'confirm'
    : type === 'photo'   ? 'photo'
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
      id, type, label: 'Run tool',
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
  return {
    id, type, label: 'Confirm',
    summary: { title: 'Confirm?', rows: [], confirmLabel: 'Confirm', cancelLabel: 'Cancel' },
  };
}

export default function FlowStepBuilder({ steps, onChange, connections = [] }) {
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

function AddStepRow({ onAdd, compact = false }) {
  const [open, setOpen] = useState(false);
  if (compact) {
    return (
      <div className="flex items-center justify-center" style={{ height: 14 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-6 px-2 rounded-full text-[11px] font-semibold text-[#6B7280] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] hover:text-[#111827] flex items-center gap-1 shadow-sm"
        >
          <Plus size={11} /> {open ? 'Cancel' : 'Insert step'}
        </button>
        {open && (
          <div className="ml-2 flex gap-1">
            {Object.entries(STEP_META).map(([t, m]) => (
              <button
                key={t}
                onClick={() => { setOpen(false); onAdd(t); }}
                className="h-6 px-2 rounded-full text-[11px] font-semibold flex items-center gap-1"
                style={{ background: `${m.color}1a`, color: m.color }}
              >
                <m.icon size={10} /> {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {Object.entries(STEP_META).map(([t, m]) => (
        <button
          key={t}
          onClick={() => onAdd(t)}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
          style={{ background: `${m.color}1a`, color: m.color }}
        >
          <m.icon size={12} /> Add {m.label}
        </button>
      ))}
    </div>
  );
}

function StepCard({
  step, index, connections, allSteps,
  onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}) {
  const meta = STEP_META[step.type];
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
          style={{ background: `${meta.color}1a`, color: meta.color }}>
          {meta.label}
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

          {step.type === 'form' && (
            <FormStepConfig step={step} onUpdate={onUpdate} priorSteps={allSteps.slice(0, index)} />
          )}
          {step.type === 'tool' && (
            <ToolStepConfig step={step} onUpdate={onUpdate} connections={connections} priorSteps={allSteps.slice(0, index)} />
          )}
          {step.type === 'confirm' && (
            <ConfirmStepConfig step={step} onUpdate={onUpdate} priorSteps={allSteps.slice(0, index)} />
          )}
          {step.type === 'photo' && (
            <PhotoStepConfig step={step} onUpdate={onUpdate} />
          )}
        </div>
      )}
    </div>
  );
}

function FormStepConfig({ step, onUpdate }) {
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldConfig({ field, onChange, onRemove }) {
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
          <FieldRow label="Field id">
            <input
              value={field.id}
              onChange={(e) => onChange({ id: slug(e.target.value) })}
              className="w-full px-2 py-1 text-[11px] font-mono bg-white border border-[#E5E7EB] rounded outline-none"
            />
          </FieldRow>
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

function ValidationEditor({ type, value, onChange }) {
  function patch(p) { onChange({ ...value, ...p }); }
  const showStr = type === 'text' || type === 'textarea' || type === 'email' || type === 'url';
  const showNum = type === 'number';
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
          <FieldRow label="Regex pattern">
            <input value={value.pattern ?? ''} onChange={(e) => patch({ pattern: e.target.value || undefined })}
              className="w-full px-2 py-1 text-[11px] font-mono bg-white border border-[#E5E7EB] rounded outline-none" />
          </FieldRow>
          <FieldRow label="Pattern error">
            <input value={value.patternMessage ?? ''} onChange={(e) => patch({ patternMessage: e.target.value || undefined })}
              className="w-full px-2 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded outline-none" />
          </FieldRow>
        </>
      )}
    </div>
  );
}

function ToolStepConfig({ step, onUpdate, connections, priorSteps }) {
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

function ConfirmStepConfig({ step, onUpdate, priorSteps }) {
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
