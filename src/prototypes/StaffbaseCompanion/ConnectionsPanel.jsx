import React, { useState } from 'react';
import { CheckCircle2, Plug, AlertCircle, LogOut, Users, Monitor, Newspaper, Building2, Menu, KeyRound, ExternalLink, RefreshCw } from 'lucide-react';
import { disconnectProvider, refreshProfile } from './api.js';

const CONNECTORS = [
  { id: 'campsite',   provider: 'campsite',  name: 'Staffbase Campsite (SSO)', description: 'Sign in to the Staffbase Campsite intranet via SAML SSO using your Google account. One-click web session — no API token needed.', icon: KeyRound,  color: '#00C7B2', alwaysOn: false, ctaConnect: 'Sign in to Campsite', cta2: 'Open Campsite' },
  { id: 'intranet',   provider: null,        name: 'Staffbase Intranet (read-only API)', description: 'Read live posts, channels, and people from campsite.staffbase.com via the Staffbase Platform API token.', icon: Newspaper, color: '#0EA5E9', alwaysOn: true, live: true },
  { id: 'atlassian',  provider: 'atlassian', name: 'Atlassian',     description: 'Real Confluence + Jira. Search pages, summarize, comment, update issues.', icon: Building2, color: '#0052CC', alwaysOn: false },
  { id: 'hr_portal',  provider: null,        name: 'HR Portal',     description: 'Employee directory, PTO, org chart, policies, holidays, FAQs', icon: Users,    color: '#7C3AED', alwaysOn: true },
  { id: 'it_helpdesk', provider: null,       name: 'IT Helpdesk',   description: 'Tickets, equipment, software, security policies',              icon: Monitor,  color: '#2563EB', alwaysOn: true },
];

function timeAgo(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

export default function ConnectionsPanel({ connections = [], onChanged, isMobile = false, onOpenHistory }) {
  const linkedByProvider = Object.fromEntries(connections.map((c) => [c.provider, c]));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [refreshNotice, setRefreshNotice] = useState(null);

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

  async function handleRefreshProfile() {
    setBusy('refresh');
    setError(null);
    setRefreshNotice(null);
    try {
      const result = await refreshProfile();
      const r = result.refreshed || {};
      setRefreshNotice(`Synced — ${r.title || '—'}${r.department ? ` · ${r.department}` : ''}${r.location ? ` · ${r.location}` : ''}${r.customFieldsCount ? ` · ${r.customFieldsCount} custom fields` : ''}.`);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not refresh profile from Campsite.');
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
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-[20px] font-bold mb-1">Connections</h2>
              <p className="text-[13px] text-[#71717A]">
                Mocked connectors are always available. External connectors require a one-time OAuth grant — your permissions on the linked service are enforced server-side.
              </p>
            </div>
            <button
              onClick={handleRefreshProfile}
              disabled={busy === 'refresh'}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-[#52525B] border border-[#E4E4E7] rounded-lg hover:bg-[#FAFAFA] disabled:opacity-50"
              title="Re-pull your Campsite directory profile"
            >
              <RefreshCw size={12} className={busy === 'refresh' ? 'animate-spin' : ''} />
              {busy === 'refresh' ? 'Refreshing…' : 'Refresh profile from Campsite'}
            </button>
          </div>
        )}
        {isMobile && (
          <>
            <p className="text-[12px] text-[#71717A] mb-3 leading-relaxed">
              Mocked connectors are always available. External connectors require a one-time OAuth grant — your permissions on the linked service are enforced server-side.
            </p>
            <button
              onClick={handleRefreshProfile}
              disabled={busy === 'refresh'}
              className="w-full mb-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-[#52525B] border border-[#E4E4E7] rounded-lg hover:bg-[#FAFAFA] disabled:opacity-50"
            >
              <RefreshCw size={12} className={busy === 'refresh' ? 'animate-spin' : ''} />
              {busy === 'refresh' ? 'Refreshing…' : 'Refresh profile from Campsite'}
            </button>
          </>
        )}

        {error && (
          <div className="mb-4 text-[13px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">{error}</div>
        )}
        {refreshNotice && (
          <div className="mb-4 text-[13px] text-[#166534] bg-[#DCFCE7] border border-[#86EFAC] rounded-lg px-4 py-3">{refreshNotice}</div>
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
                        {linked.metadata?.workspace && <> · workspace <span className="font-mono">{linked.metadata.workspace}</span></>}
                      </div>
                    )}
                    {c.provider === 'campsite' && linked?.metadata?.last_initiated_at && (
                      <div className="text-[11px] text-[#52525B] mt-1">
                        SSO last initiated <span className="font-medium">{timeAgo(linked.metadata.last_initiated_at) || 'recently'}</span>
                        {linked.metadata.sso_url && (
                          <> · <a href={linked.metadata.sso_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#00A899] hover:underline">Open Campsite <ExternalLink size={9} /></a></>
                        )}
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
  const isCampsite = c.provider === 'campsite';
  const bg = isCampsite ? 'bg-[#00C7B2] hover:bg-[#00A899]' : 'bg-[#0052CC] hover:bg-[#003E99]';
  return (
    <a
      href={`/api/connections/${c.provider}/connect`}
      target={isCampsite ? '_blank' : undefined}
      rel={isCampsite ? 'noopener noreferrer' : undefined}
      className={`${widthClass} inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-white ${bg} rounded-lg`}
    >
      <Plug size={12} /> {c.ctaConnect || 'Connect'}
    </a>
  );
}

function StatusPill({ status, live }) {
  if (status === 'mocked' && live) return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#166534]">Live data</span>;
  if (status === 'mocked') return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#52525B]">Mock</span>;
  if (status === 'connected') return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#166534] inline-flex items-center gap-1"><CheckCircle2 size={10} /> Linked</span>;
  return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#B45309] inline-flex items-center gap-1"><AlertCircle size={10} /> Not linked</span>;
}
