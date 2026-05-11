import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Plug } from 'lucide-react';

// Shows the orchestrator's reasoning step (intent + which connectors got picked).
export default function TraceCard({ intent, connectors }) {
  const [open, setOpen] = useState(false);
  if (!intent && !connectors?.length) return null;

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

function labelFor(id) {
  switch (id) {
    case 'hr_portal': return 'HR';
    case 'it_helpdesk': return 'IT';
    case 'intranet': return 'Intranet';
    case 'atlassian': return 'Atlassian';
    default: return id;
  }
}
