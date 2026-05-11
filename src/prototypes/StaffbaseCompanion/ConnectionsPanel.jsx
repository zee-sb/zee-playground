import React, { useState } from 'react';
import { CheckCircle2, Plug, AlertCircle, LogOut, Users, Monitor, Newspaper, Building2 } from 'lucide-react';
import { disconnectProvider } from './api.js';

const CONNECTORS = [
  { id: 'hr_portal',  provider: null,        name: 'HR Portal',     description: 'Employee directory, PTO, org chart, policies, holidays, FAQs', icon: Users,    color: '#7C3AED', alwaysOn: true },
  { id: 'it_helpdesk', provider: null,       name: 'IT Helpdesk',   description: 'Tickets, equipment, software, security policies',              icon: Monitor,  color: '#2563EB', alwaysOn: true },
  { id: 'intranet',   provider: null,        name: 'Staffbase Intranet', description: 'Real posts, channels, and people from campsite.staffbase.com (read-only).', icon: Newspaper, color: '#0EA5E9', alwaysOn: true, live: true },
  { id: 'atlassian',  provider: 'atlassian', name: 'Atlassian',     description: 'Real Confluence + Jira. Search pages, summarize, comment, update issues.', icon: Building2, color: '#0052CC', alwaysOn: false },
];

export default function ConnectionsPanel({ connections = [], onChanged }) {
  const linkedByProvider = Object.fromEntries(connections.map((c) => [c.provider, c]));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function disconnect(provider) {
    if (!confirm(`Disconnect ${provider}? You'll need to re-authorize to use it again.`)) return;
    setBusy(provider);
    setError(null);
    try {
      await disconnectProvider(provider);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-[760px] mx-auto px-6 py-8">
      <h2 className="text-[20px] font-bold mb-1">Connections</h2>
      <p className="text-[13px] text-[#71717A] mb-6">
        Mocked connectors are always available. External connectors require a one-time OAuth grant — your permissions on the linked service are enforced server-side.
      </p>

      {error && (
        <div className="mb-4 text-[13px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="space-y-2">
        {CONNECTORS.map((c) => {
          const Icon = c.icon;
          const linked = c.provider ? linkedByProvider[c.provider] : null;
          const status = c.alwaysOn ? 'mocked' : (linked ? 'connected' : 'not_connected');
          return (
            <div key={c.id} className="border border-[#E4E4E7] rounded-xl p-4 flex items-start gap-4 bg-white">
              <div className="w-10 h-10 rounded-lg grid place-items-center text-white shrink-0" style={{ backgroundColor: c.color }}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-[14px]">{c.name}</div>
                  <StatusPill status={status} live={c.live} />
                </div>
                <div className="text-[12px] text-[#71717A] mt-0.5 leading-relaxed">{c.description}</div>
                {linked?.externalEmail && (
                  <div className="text-[11px] text-[#52525B] mt-2">
                    Linked as <span className="font-mono">{linked.externalEmail}</span>
                    {linked.metadata?.site_name && <> · site <span className="font-mono">{linked.metadata.site_name}</span></>}
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {c.alwaysOn ? (
                  <span className="text-[11px] text-[#A1A1AA]">always-on</span>
                ) : linked ? (
                  <button
                    onClick={() => disconnect(c.provider)}
                    disabled={busy === c.provider}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#52525B] border border-[#E4E4E7] rounded-lg hover:bg-[#FAFAFA] disabled:opacity-50"
                  >
                    <LogOut size={12} /> {busy === c.provider ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : (
                  <a
                    href={`/api/connections/${c.provider}/connect`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#0052CC] hover:bg-[#003E99] rounded-lg"
                  >
                    <Plug size={12} /> Connect
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status, live }) {
  if (status === 'mocked' && live) return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#166534]">Live data</span>;
  if (status === 'mocked') return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#52525B]">Mock</span>;
  if (status === 'connected') return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#166534] inline-flex items-center gap-1"><CheckCircle2 size={10} /> Linked</span>;
  return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#B45309] inline-flex items-center gap-1"><AlertCircle size={10} /> Not linked</span>;
}
