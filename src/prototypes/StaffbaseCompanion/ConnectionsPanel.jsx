import React, { useState } from 'react';
import { CheckCircle2, Plug, AlertCircle, LogOut, Users, Monitor, Newspaper, Building2, Menu } from 'lucide-react';
import { disconnectProvider } from './api.js';

const CONNECTORS = [
  { id: 'hr_portal',  provider: null,        name: 'HR Portal',     description: 'Employee directory, PTO, org chart, policies, holidays, FAQs', icon: Users,    color: '#7C3AED', alwaysOn: true },
  { id: 'it_helpdesk', provider: null,       name: 'IT Helpdesk',   description: 'Tickets, equipment, software, security policies',              icon: Monitor,  color: '#2563EB', alwaysOn: true },
  { id: 'intranet',   provider: null,        name: 'Staffbase Intranet', description: 'Real posts, channels, and people from campsite.staffbase.com (read-only).', icon: Newspaper, color: '#0EA5E9', alwaysOn: true, live: true },
  { id: 'atlassian',  provider: 'atlassian', name: 'Atlassian',     description: 'Real Confluence + Jira. Search pages, summarize, comment, update issues.', icon: Building2, color: '#0052CC', alwaysOn: false },
];

export default function ConnectionsPanel({ connections = [], onChanged, isMobile = false, onOpenHistory }) {
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

  // On mobile, render a sticky purple header with the menu button so the
  // drawer remains reachable while scrolling, and so the title lines up with
  // the chat view's AppHeader instead of being overlapped by a floating icon.
  return (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div
          className="flex items-center gap-2 px-3 py-3"
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
            position: 'sticky', top: 0, zIndex: 5, flexShrink: 0,
            paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
          }}
        >
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              aria-label="Open conversation history"
              className="flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: 6, color: 'white', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Menu size={14} />
            </button>
          )}
          <div className="text-white font-bold text-[15px]">Connections</div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${isMobile ? 'px-4 pt-4 pb-8' : 'max-w-[760px] mx-auto w-full px-6 py-8'}`}>
        {!isMobile && (
          <>
            <h2 className="text-[20px] font-bold mb-1">Connections</h2>
            <p className="text-[13px] text-[#71717A] mb-6">
              Mocked connectors are always available. External connectors require a one-time OAuth grant — your permissions on the linked service are enforced server-side.
            </p>
          </>
        )}
        {isMobile && (
          <p className="text-[12px] text-[#71717A] mb-4 leading-relaxed">
            Mocked connectors are always available. External connectors require a one-time OAuth grant — your permissions on the linked service are enforced server-side.
          </p>
        )}

        {error && (
          <div className="mb-4 text-[13px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">{error}</div>
        )}

        <div className="space-y-2">
          {CONNECTORS.map((c) => {
            const Icon = c.icon;
            const linked = c.provider ? linkedByProvider[c.provider] : null;
            const status = c.alwaysOn ? 'mocked' : (linked ? 'connected' : 'not_connected');
            return (
              <div key={c.id} className="border border-[#E4E4E7] rounded-xl p-4 bg-white">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="w-10 h-10 rounded-lg grid place-items-center text-white shrink-0" style={{ backgroundColor: c.color }}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-[14px]">{c.name}</div>
                      <StatusPill status={status} live={c.live} />
                    </div>
                    <div className="text-[12px] text-[#71717A] mt-0.5 leading-relaxed">{c.description}</div>
                    {linked?.externalEmail && (
                      <div className="text-[11px] text-[#52525B] mt-2 break-words">
                        Linked as <span className="font-mono">{linked.externalEmail}</span>
                        {linked.metadata?.site_name && <> · site <span className="font-mono">{linked.metadata.site_name}</span></>}
                      </div>
                    )}
                  </div>
                  {!isMobile && (
                    <div className="shrink-0">
                      <ActionButton c={c} linked={linked} busy={busy} onDisconnect={disconnect} />
                    </div>
                  )}
                </div>
                {isMobile && (
                  <div className="mt-3 pt-3 border-t border-[#F4F4F5]">
                    <ActionButton c={c} linked={linked} busy={busy} onDisconnect={disconnect} fullWidth />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ c, linked, busy, onDisconnect, fullWidth = false }) {
  const widthClass = fullWidth ? 'w-full justify-center' : '';
  if (c.alwaysOn) {
    return <span className={`text-[11px] text-[#A1A1AA] ${fullWidth ? 'block text-center' : ''}`}>always-on</span>;
  }
  if (linked) {
    return (
      <button
        onClick={() => onDisconnect(c.provider)}
        disabled={busy === c.provider}
        className={`${widthClass} inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-[#52525B] border border-[#E4E4E7] rounded-lg hover:bg-[#FAFAFA] disabled:opacity-50`}
      >
        <LogOut size={12} /> {busy === c.provider ? 'Disconnecting…' : 'Disconnect'}
      </button>
    );
  }
  return (
    <a
      href={`/api/connections/${c.provider}/connect`}
      className={`${widthClass} inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-white bg-[#0052CC] hover:bg-[#003E99] rounded-lg`}
    >
      <Plug size={12} /> Connect
    </a>
  );
}

function StatusPill({ status, live }) {
  if (status === 'mocked' && live) return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#166534]">Live data</span>;
  if (status === 'mocked') return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#52525B]">Mock</span>;
  if (status === 'connected') return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#166534] inline-flex items-center gap-1"><CheckCircle2 size={10} /> Linked</span>;
  return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#B45309] inline-flex items-center gap-1"><AlertCircle size={10} /> Not linked</span>;
}
