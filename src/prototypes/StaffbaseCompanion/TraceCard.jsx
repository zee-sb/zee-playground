import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Plug, Workflow, Sparkles, Wrench, BookOpen, AlertTriangle } from 'lucide-react';

// Renders the orchestrator's routing decision.
//
// New `route` prop (preferred) — hierarchical Tier-1 → Tier-2 trace:
//   { tier1: { kind, id, name, confidence, reasoning },
//     tier2: { scope, toolPool[], connectors:[{id,name,color,degraded}],
//              agents:[{id,name,color,degraded}], kbs:[{id,name,source}] },
//     fallbackUsed: bool }
//
// Legacy `intent` + `connectors` props are still accepted for the legacy
// path so an unseeded branch keeps showing a trace.
export default function TraceCard({ route, intent, connectors }) {
  const [open, setOpen] = useState(false);
  if (!route && !intent && !connectors?.length) return null;

  // ── Studio hierarchical view ────────────────────────────────────────────
  if (route) {
    const { tier1, tier2 } = route;
    const t1Label = tier1?.kind === 'flow'
      ? `Flow · ${tier1.name || tier1.id}`
      : tier1?.kind === 'assistant'
        ? `Assistant · ${tier1.name || tier1.id}`
        : tier1?.kind === 'general_chat' ? 'General chat' : 'Out of scope';
    const Icon = tier1?.kind === 'flow' ? Workflow
      : tier1?.kind === 'assistant' ? Sparkles
      : Brain;
    const toolCount = tier2?.toolPool?.length || 0;
    return (
      <div className="my-2 border border-[#E4E4E7] rounded-lg bg-[#FAFAFA] text-[12px]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#F4F4F5] rounded-lg transition-colors"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Icon size={14} className="text-[#7C3AED]" />
          <span className="font-medium text-[#18181B]">{t1Label}</span>
          {toolCount > 0 && (
            <span className="ml-auto text-[10px] text-[#71717A]">
              {toolCount} tool{toolCount === 1 ? '' : 's'}
            </span>
          )}
        </button>
        {open && (
          <div className="px-3 pb-3 pt-1 border-t border-[#E4E4E7] space-y-2 text-[#52525B]">
            {tier1?.reasoning && (
              <div className="text-[11.5px]"><span className="font-semibold">Why:</span> {tier1.reasoning}</div>
            )}
            {tier2 && (
              <div className="space-y-1.5">
                {(() => {
                  // v7 unified shape: one `connectors[]` array with `kind`
                  // discriminator. Group visually by kind for readability.
                  const cs = tier2.connectors || [];
                  const mcps = cs.filter((c) => c.kind === 'mcp');
                  const agents = cs.filter((c) => c.kind === 'agent');
                  const kbs = cs.filter((c) => c.kind === 'kb');
                  return (
                    <>
                      {mcps.length > 0 && (
                        <Row icon={<Plug size={11} />} label="MCPs">
                          {mcps.map((c) => <Chip key={c.id} color={c.color || '#7C3AED'} label={c.name} degraded={c.degraded} />)}
                        </Row>
                      )}
                      {agents.length > 0 && (
                        <Row icon={<Sparkles size={11} />} label="Agents">
                          {agents.map((c) => <Chip key={c.id} color={c.color || '#F59E0B'} label={c.name} degraded={c.degraded} />)}
                        </Row>
                      )}
                      {kbs.length > 0 && (
                        <Row icon={<BookOpen size={11} />} label="Knowledge">
                          {kbs.map((c) => <Chip key={c.id} color={c.color || '#2563EB'} label={c.name + (c.source ? ` (${c.source})` : '')} degraded={c.degraded} />)}
                        </Row>
                      )}
                    </>
                  );
                })()}
                {tier2.toolPool?.length > 0 && (
                  <Row icon={<Wrench size={11} />} label="Tools">
                    {tier2.toolPool.slice(0, 8).map((t) => (
                      <span key={t} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white border border-[#E4E4E7] text-[#52525B]">{t}</span>
                    ))}
                    {tier2.toolPool.length > 8 && <span className="text-[10px] text-[#A1A1AA]">+{tier2.toolPool.length - 8} more</span>}
                  </Row>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Legacy flat view ────────────────────────────────────────────────────
  const summary = intent
    ? (intent.connectors?.length
        ? `Routing to ${intent.connectors.length} connector${intent.connectors.length > 1 ? 's' : ''}`
        : 'No tools needed — replying directly')
    : 'Loading connectors…';
  return (
    <div className="my-2 border border-[#E4E4E7] rounded-lg bg-[#FAFAFA] text-[12px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#F4F4F5] rounded-lg transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Brain size={14} className="text-[#7C3AED]" />
        <span className="font-medium text-[#18181B]">{summary}</span>
        {intent?.connectors?.length > 0 && (
          <div className="flex gap-1 ml-auto">
            {intent.connectors.map((id) => (
              <span key={id} className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-white border border-[#E4E4E7] text-[#52525B]">
                {labelFor(id)}
              </span>
            ))}
          </div>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-[#E4E4E7] space-y-1.5 text-[#52525B]">
          {intent?.reasoning && (
            <div><span className="font-semibold">Reasoning:</span> {intent.reasoning}</div>
          )}
          {connectors?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Plug size={11} />
              <span className="font-semibold">Available:</span>
              {connectors.map((c) => (
                <span key={c.id} className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-white border border-[#E4E4E7]" style={{ color: c.color }}>
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, children }) {
  return (
    <div className="flex items-start gap-1.5 flex-wrap">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-[#71717A]">
        {icon}{label}
      </span>
      <div className="flex flex-wrap gap-1 flex-1">{children}</div>
    </div>
  );
}

function Chip({ color, label, degraded }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-white border border-[#E4E4E7]"
      style={{ color: color || '#52525B' }}
    >
      {label}
      {degraded && (
        <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-[#FEF3C7] border border-[#FCD34D] text-[#92400E] text-[8px] uppercase tracking-wider font-bold">
          <AlertTriangle size={8} /> degraded
        </span>
      )}
    </span>
  );
}

function labelFor(id) {
  switch (id) {
    case 'hr_portal': return 'HR';
    case 'it_helpdesk': return 'IT';
    case 'intranet': return 'Intranet';
    case 'atlassian': return 'Atlassian';
    default: return id;
  }
}
