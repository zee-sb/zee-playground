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
    // Only label as "Out of scope" when the classifier explicitly says so, or
    // when there's nothing routed at all. Direct-tool routes (no flow or
    // assistant matched but connectors/tools picked) get a "Direct tools"
    // label — calling them "Out of scope" while tools fire is contradictory.
    const hasRouting = (tier2?.toolPool?.length || 0) > 0
      || (tier2?.connectors?.length || 0) > 0;
    const directConnectorName = (() => {
      const cs = tier2?.connectors || [];
      const mcps = cs.filter((c) => c.kind === 'mcp');
      if (mcps.length === 1) return mcps[0].name;
      if (mcps.length > 1) return `${mcps[0].name} +${mcps.length - 1}`;
      return cs[0]?.name || null;
    })();
    const t1Label = tier1?.kind === 'flow'
      ? `Flow · ${tier1.name || tier1.id}`
      : tier1?.kind === 'assistants'
        ? `Assistant · ${tier1.name || tier1.id}`
        : tier1?.kind === 'general_chat'
          ? 'General chat'
          : tier1?.kind === 'out_of_scope'
            ? 'Out of scope'
            : hasRouting
              ? (directConnectorName ? `Tools · ${directConnectorName}` : 'Direct tools')
              : 'Out of scope';
    const Icon = tier1?.kind === 'flow' ? Workflow
      : tier1?.kind === 'assistants' ? Sparkles
      : Brain;
    const toolCount = tier2?.toolPool?.length || 0;
    const cs = tier2?.connectors || [];
    const mcps = cs.filter((c) => c.kind === 'mcp');
    const agents = cs.filter((c) => c.kind === 'agent');
    const kbs = cs.filter((c) => c.kind === 'kb');
    return (
      <div className="my-2 rounded-xl bg-white text-[12px] ring-1 ring-[#E4E4E7] overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#FAFAFA] transition-colors"
        >
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] grid place-items-center shrink-0 ring-1 ring-[#E9D5FF]">
            <Icon size={14} className="text-[#7C3AED]" />
          </span>
          <span className="font-semibold text-[#18181B] truncate text-[13px]">{t1Label}</span>
          <span className="ml-auto flex items-center gap-2 shrink-0">
            {toolCount > 0 && (
              <span className="text-[11px] text-[#71717A] font-medium tabular-nums">
                {toolCount} tool{toolCount === 1 ? '' : 's'}
              </span>
            )}
            {open
              ? <ChevronDown size={14} className="text-[#A1A1AA]" />
              : <ChevronRight size={14} className="text-[#A1A1AA]" />}
          </span>
        </button>
        {open && (
          <div className="px-3.5 pb-3.5 pt-0.5 space-y-3 text-[#52525B] bg-white">
            {tier1?.reasoning && (
              <div className="bg-[#FAFAFA] border border-[#F1F5F9] rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed text-[#3F3F46] italic">
                "{tier1.reasoning}"
              </div>
            )}
            {tier2 && (mcps.length || agents.length || kbs.length) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {mcps.map((c) => (
                  <ConnectorChip key={c.id} icon={<Plug size={11} />} label={c.name}
                    color={c.color || '#7C3AED'} degraded={c.degraded} />
                ))}
                {agents.map((c) => (
                  <ConnectorChip key={c.id} icon={<Sparkles size={11} />} label={c.name}
                    color={c.color || '#F59E0B'} degraded={c.degraded} />
                ))}
                {kbs.map((c) => (
                  <ConnectorChip key={c.id} icon={<BookOpen size={11} />}
                    label={c.name + (c.source ? ` · ${c.source}` : '')}
                    color={c.color || '#2563EB'} degraded={c.degraded} />
                ))}
              </div>
            )}
            {tier2?.toolPool?.length > 0 && (
              <ToolList tools={tier2.toolPool} />
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

// Tinted-pill chip — light background derived from the connector's color
// gives each connector visual identity without a heavy outline.
function ConnectorChip({ icon, label, color, degraded }) {
  const tint = colorToTint(color);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-semibold rounded-lg"
      style={{
        color: color || '#52525B',
        backgroundColor: tint.bg,
        boxShadow: `inset 0 0 0 1px ${tint.border}`,
      }}
    >
      <span className="opacity-80">{icon}</span>
      <span className="leading-none">{label}</span>
      {degraded && (
        <span className="inline-flex items-center gap-0.5 ml-0.5 px-1.5 py-0 rounded bg-[#FEF3C7] text-[#92400E] text-[9px] uppercase tracking-wider font-bold">
          <AlertTriangle size={8} /> degraded
        </span>
      )}
    </span>
  );
}

// Collapsed-by-default tool list with a "Show all" expansion. Tools are
// inline-code chips: muted, monospace, small — they're meta-info, not the
// star of the card.
function ToolList({ tools }) {
  const [showAll, setShowAll] = useState(false);
  const preview = 6;
  const visible = showAll ? tools : tools.slice(0, preview);
  const remaining = tools.length - preview;
  return (
    <div className="flex items-start gap-2 pt-0.5">
      <Wrench size={11} className="text-[#A1A1AA] mt-1 shrink-0" />
      <div className="flex flex-wrap gap-1 flex-1 min-w-0">
        {visible.map((t) => (
          <span
            key={t}
            className="px-1.5 py-0.5 text-[10.5px] font-mono rounded-md bg-[#F4F4F5] text-[#52525B]"
          >
            {t}
          </span>
        ))}
        {!showAll && remaining > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="px-1.5 py-0.5 text-[10.5px] font-medium rounded-md text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors"
          >
            +{remaining} more
          </button>
        )}
        {showAll && tools.length > preview && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="px-1.5 py-0.5 text-[10.5px] font-medium rounded-md text-[#71717A] hover:bg-[#F4F4F5] transition-colors"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

// Map a connector's accent color to a soft background + matching border.
// Hand-tuned for the small palette we actually use (purple/blue/amber).
// Falls back to a neutral gray tint for anything unknown.
function colorToTint(color) {
  const map = {
    '#7C3AED': { bg: '#F5F3FF', border: '#E9D5FF' }, // purple — MCP
    '#0EA5E9': { bg: '#F0F9FF', border: '#BAE6FD' }, // sky — atlassian-ish
    '#2563EB': { bg: '#EFF6FF', border: '#BFDBFE' }, // blue — KB
    '#F59E0B': { bg: '#FFFBEB', border: '#FDE68A' }, // amber — agents
    '#16A34A': { bg: '#F0FDF4', border: '#BBF7D0' }, // green
  };
  return map[color] || { bg: '#F4F4F5', border: '#E4E4E7' };
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
