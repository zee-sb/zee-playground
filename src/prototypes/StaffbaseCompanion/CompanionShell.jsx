import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquarePlus, ArrowLeft, Sparkles, Plug, MessageCircle, LogOut, Trash2, Search, X as XIcon } from 'lucide-react';
import ChatPanel from './ChatPanel.jsx';
import ConnectionsPanel from './ConnectionsPanel.jsx';
// PhoneFrame is still imported on mobile via ChatPanel's own layout — desktop
// drops the phone mockup so the chat can use the full viewport.
import { useIsMobile } from './lib/responsive.js';
import { BRAND } from './lib/tokens.js';
import { InspectorProvider, useInspector } from './lib/InspectorContext.jsx';
import InspectorDock from './InspectorDock.jsx';
import { listConversations, createConversation, logout, deleteConversation as deleteConversationApi } from './api.js';
import { useActiveTenant } from '../AIAssistant/useActiveTenant';

// Small avatar: real Staffbase photo when available, gradient-initials
// fallback otherwise. Used in the sidebar pill + anywhere else we render
// the signed-in user.
function UserAvatar({ user, size = 32 }) {
  const initials = user?.avatarInitials || (user?.displayName || '?').slice(0, 2).toUpperCase();
  const hasImg = !!user?.avatarUrl;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {hasImg && (
        <img
          src={user.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling; if (fb) fb.style.display = 'grid'; }}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#1f2937' }}
        />
      )}
      <div
        style={{
          width: size, height: size, borderRadius: '50%',
          display: hasImg ? 'none' : 'grid',
          placeItems: 'center', color: 'white',
          fontSize: Math.floor(size * 0.4), fontWeight: 700,
          background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
          position: hasImg ? 'absolute' : undefined,
          top: hasImg ? 0 : undefined, left: hasImg ? 0 : undefined,
        }}
      >{initials}</div>
    </div>
  );
}

// Outer wrapper installs the inspector context provider so anything inside
// CompanionShellInner can call useInspector(). The provider is `enabled`
// only on desktop — mobile gets a no-op context (see InspectorContext.jsx),
// which keeps ChatPanel's dispatches branchless.
export default function CompanionShell(props) {
  const isMobile = useIsMobile();
  return (
    <InspectorProvider enabled={!isMobile}>
      <CompanionShellInner {...props} isMobile={isMobile} />
    </InspectorProvider>
  );
}

function CompanionShellInner({ user, connections, staffbase, tenant: tenantProp, onSignedOut, onBack, onMeRefresh, isMobile }) {
  const inspector = useInspector();
  const { branchId, tenant: tenantFromCtx } = useActiveTenant();
  const tenant = tenantProp || tenantFromCtx;
  const [view, setView] = useState('chat');
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Client-side filter — fast and good enough for the typical 50-row history.
  // If the user wants to find a conversation by a word inside a message, we'd
  // need server-side full-text search; out of scope for this round.
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  // Group conversations by recency for the light-sidebar layout. The API
  // already returns rows ordered by updated_at desc, so within each bucket
  // the order is preserved. Buckets without entries are dropped.
  const groupedConversations = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfLast7 = startOfToday - 7 * 24 * 60 * 60 * 1000;

    const buckets = { today: [], yesterday: [], last7: [], earlier: [] };
    for (const c of filteredConversations) {
      const ts = c.updated_at || c.updatedAt || c.created_at || c.createdAt;
      const t = ts ? new Date(ts).getTime() : 0;
      if (t >= startOfToday) buckets.today.push(c);
      else if (t >= startOfYesterday) buckets.yesterday.push(c);
      else if (t >= startOfLast7) buckets.last7.push(c);
      else buckets.earlier.push(c);
    }
    return [
      { label: 'Today', items: buckets.today },
      { label: 'Yesterday', items: buckets.yesterday },
      { label: 'Previous 7 days', items: buckets.last7 },
      { label: 'Earlier', items: buckets.earlier },
    ].filter((g) => g.items.length > 0);
  }, [filteredConversations]);

  // Re-run when the active tenant changes — switching tenants in the
  // gallery picker must drop the old tenant's conversations and pull the
  // new tenant's. Without `branchId` in the dep array, the sidebar would
  // stay frozen on the previous workspace's chat list.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setConversations([]);
    setActiveId(null);
    (async () => {
      try {
        const list = await listConversations(branchId);
        if (cancelled) return;

        // Honour ?c=<id> in the URL if it matches one of THIS user's
        // conversations FOR THIS TENANT. The API already 404s any id the
        // user doesn't own or that's tenant-mismatched, so we just need to
        // silently fall back if it isn't in our list.
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get('c');
        const owned = urlId && list.some((c) => c.id === urlId) ? urlId : null;

        if (owned) {
          setConversations(list);
          setActiveId(owned);
        } else if (isMobile) {
          // Mobile defaults to a fresh conversation on each visit — previous
          // chats are still reachable from the drawer. Desktop keeps showing
          // the most recent one so power users don't lose context on reload.
          const conv = await createConversation('New conversation', branchId);
          if (cancelled) return;
          setConversations([conv, ...list]);
          setActiveId(conv.id);
        } else if (list.length === 0) {
          const conv = await createConversation('New conversation', branchId);
          if (cancelled) return;
          setConversations([conv]);
          setActiveId(conv.id);
        } else {
          setConversations(list);
          setActiveId(list[0].id);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [branchId, isMobile]);

  // Mirror the active conversation id into the URL so each chat is
  // deep-linkable. We use replaceState (not pushState) so the browser
  // history stays flat — refreshing or sharing the URL still works, but
  // each conversation switch doesn't pollute back/forward navigation.
  useEffect(() => {
    if (!activeId) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('c') === activeId) return;
    params.set('c', activeId);
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  }, [activeId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      // Strip ONLY the connected param — preserve ?c=<id> so the URL still
      // points at the conversation the user came from.
      params.delete('connected');
      const qs = params.toString();
      const cleaned = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState({}, '', cleaned);
      onMeRefresh?.();
    }
  }, []);

  // Campsite SSO is now a first-class connector in the Connections panel —
  // users initiate it explicitly via /api/connections/campsite/connect. No
  // implicit popup on mount (popup blockers + ambiguous UX made the
  // previous auto-open unreliable).

  async function newConversation() {
    const conv = await createConversation('New conversation', branchId);
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setView('chat');
    setDrawerOpen(false);
  }

  async function removeConversation(id, title) {
    if (!id) return;
    const label = title || 'this conversation';
    if (!window.confirm(`Delete "${label}"? This can't be undone.`)) return;
    try {
      await deleteConversationApi(id, branchId);
    } catch (err) {
      window.alert(`Couldn't delete: ${err.message}`);
      return;
    }
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        // Active conversation was deleted — pivot to the next-most-recent,
        // or open a fresh one if the list is now empty.
        if (next.length > 0) {
          setActiveId(next[0].id);
        } else {
          (async () => {
            const conv = await createConversation('New conversation', branchId);
            setConversations([conv]);
            setActiveId(conv.id);
          })();
        }
      }
      return next;
    });
  }

  async function handleSignOut() {
    await logout();
    onSignedOut();
  }

  // Mobile keeps the dark drawer (it's a brief overlay; high contrast wins).
  // Desktop switches to a light surface that sits comfortably next to the
  // light chat canvas — closer to Staffbase Campsite's intranet feel, and
  // makes the teal accent stand out without competing with the chat.
  const sidebarBg = isMobile ? '#111827' : BRAND.surface;
  const sidebarFg = isMobile ? 'white' : BRAND.ink;
  const isLight = !isMobile;

  const navItemActiveStyle = isLight
    ? { background: BRAND.tealSoft, color: BRAND.tealDeep, border: `1px solid ${BRAND.teal}33` }
    : { background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid transparent' };
  const navItemRestStyle = isLight
    ? { background: 'transparent', color: BRAND.inkSoft, border: '1px solid transparent' }
    : { background: 'transparent', color: 'rgba(255,255,255,0.70)', border: '1px solid transparent' };

  const Sidebar = (
    <aside
      className={isMobile ? 'h-full w-full' : 'w-[268px]'}
      style={{
        background: sidebarBg,
        color: sidebarFg,
        display: 'flex',
        flexDirection: 'column',
        borderRight: isLight ? `1px solid ${BRAND.hairline}` : 'none',
      }}
    >
      {/* Brand strip ------------------------------------------------------ */}
      <div style={{
        padding: '14px 16px',
        borderBottom: isLight ? `1px solid ${BRAND.hairline}` : '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onBack}
            aria-label="Back to studio"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: isLight ? BRAND.muted : 'rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6,
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: `linear-gradient(135deg, ${BRAND.teal}, ${BRAND.tealDeep})`,
              display: 'grid', placeItems: 'center', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,199,178,0.30)',
            }}>
              <Sparkles size={15} color="white" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontWeight: 700, fontSize: 13.5, lineHeight: 1.1,
                color: isLight ? BRAND.ink : 'white',
                letterSpacing: '-0.1px',
              }}>
                Navigator
              </div>
              {tenant?.displayName && (
                <div
                  title={tenant.workspaceUrl || tenant.displayName}
                  style={{
                    fontSize: 11, marginTop: 3,
                    color: isLight ? BRAND.muted : 'rgba(255,255,255,0.5)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {tenant.displayName}
                </div>
              )}
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 11, cursor: 'pointer' }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Primary nav ------------------------------------------------------ */}
      <nav style={{
        padding: '10px 10px',
        borderBottom: isLight ? `1px solid ${BRAND.hairline}` : '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <button
          onClick={() => { setView('chat'); setDrawerOpen(false); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 8,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
            ...(view === 'chat' ? navItemActiveStyle : navItemRestStyle),
          }}
        >
          <MessageCircle size={14} /> Chat
        </button>
        <button
          onClick={() => {
            // Desktop: open the inspector dock at the Connections tab and
            // keep the chat surface visible. Mobile (and the legacy desktop
            // fallback if the dock isn't enabled) swaps the main view so
            // the connections list takes the screen.
            if (!isMobile) {
              inspector.openTab('connections');
              setDrawerOpen(false);
              return;
            }
            setView('connections');
            setDrawerOpen(false);
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            padding: '8px 10px', borderRadius: 8,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
            // Desktop: the button reflects dock state (active when dock open + connections tab).
            ...((isMobile ? view === 'connections' : inspector.open && inspector.tab === 'connections')
              ? navItemActiveStyle : navItemRestStyle),
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plug size={14} /> Connections
          </span>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
            padding: '1px 7px', borderRadius: 999,
            background: isLight ? BRAND.bg : 'rgba(255,255,255,0.10)',
            color: isLight ? BRAND.muted : 'rgba(255,255,255,0.7)',
          }}>
            {connections.length}
          </span>
        </button>
      </nav>

      {view === 'chat' && (
        <>
          <button
            onClick={newConversation}
            style={{
              margin: '12px 12px 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '9px 12px',
              borderRadius: 10, cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: isLight ? BRAND.teal : 'rgba(255,255,255,0.10)',
              color: isLight ? 'white' : 'white',
              border: isLight ? `1px solid ${BRAND.tealDeep}` : '1px solid rgba(255,255,255,0.15)',
              boxShadow: isLight ? '0 4px 12px rgba(0,199,178,0.28)' : 'none',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (isLight) e.currentTarget.style.background = BRAND.tealDeep;
              else e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={(e) => {
              if (isLight) e.currentTarget.style.background = BRAND.teal;
              else e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
            }}
          >
            <MessageSquarePlus size={14} /> New conversation
          </button>

          {conversations.length > 0 && (
            <div style={{ margin: '0 12px 8px', position: 'relative' }}>
              <Search
                size={12}
                style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: isLight ? BRAND.mutedSoft : 'rgba(255,255,255,0.4)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations"
                style={{
                  width: '100%',
                  background: isLight ? BRAND.bg : 'rgba(255,255,255,0.05)',
                  border: isLight ? `1px solid ${BRAND.hairline}` : '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 8,
                  padding: '7px 26px 7px 28px',
                  fontSize: 12.5,
                  color: isLight ? BRAND.ink : 'white',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: isLight ? BRAND.muted : 'rgba(255,255,255,0.4)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <XIcon size={12} />
                </button>
              )}
            </div>
          )}

          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '0 8px 8px',
          }}>
            {loading && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: isLight ? BRAND.muted : 'rgba(255,255,255,0.4)' }}>
                Loading…
              </div>
            )}
            {!loading && conversations.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: isLight ? BRAND.muted : 'rgba(255,255,255,0.4)' }}>
                No conversations yet.
              </div>
            )}
            {!loading && conversations.length > 0 && filteredConversations.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: isLight ? BRAND.muted : 'rgba(255,255,255,0.4)' }}>
                No matches for "{searchQuery}".
              </div>
            )}
            {groupedConversations.map((group) => (
              <div key={group.label} style={{ marginBottom: 10 }}>
                <div style={{
                  padding: '6px 10px 4px',
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isLight ? BRAND.mutedSoft : 'rgba(255,255,255,0.35)',
                }}>
                  {group.label}
                </div>
                {group.items.map((c) => {
                  const active = c.id === activeId;
                  const rest = isLight
                    ? { background: 'transparent', color: BRAND.inkSoft }
                    : { background: 'transparent', color: 'rgba(255,255,255,0.7)' };
                  const activeStyle = isLight
                    ? { background: BRAND.tealSoft, color: BRAND.tealDeep, border: `1px solid ${BRAND.teal}33` }
                    : { background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid transparent' };
                  return (
                    <div
                      key={c.id}
                      className="group"
                      style={{
                        display: 'flex', alignItems: 'center', borderRadius: 8, marginBottom: 1,
                        transition: 'background 0.12s, color 0.12s',
                        border: '1px solid transparent',
                        ...(active ? activeStyle : rest),
                      }}
                      onMouseEnter={(e) => {
                        if (active) return;
                        e.currentTarget.style.background = isLight ? BRAND.bg : 'rgba(255,255,255,0.07)';
                      }}
                      onMouseLeave={(e) => {
                        if (active) return;
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <button
                        onClick={() => { setActiveId(c.id); setDrawerOpen(false); }}
                        title={c.title || 'Conversation'}
                        style={{
                          flex: 1, minWidth: 0,
                          textAlign: 'left',
                          padding: '7px 10px',
                          fontSize: 13, fontWeight: active ? 600 : 500,
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'inherit',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                      >
                        {c.title || 'Conversation'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeConversation(c.id, c.title); }}
                        aria-label={`Delete ${c.title || 'conversation'}`}
                        title="Delete"
                        className="group-hover:opacity-100 focus:opacity-100"
                        style={{
                          padding: '6px 8px',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: isLight ? BRAND.mutedSoft : 'rgba(255,255,255,0.3)',
                          opacity: 0.4,
                          display: 'flex', alignItems: 'center',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = isLight ? BRAND.mutedSoft : 'rgba(255,255,255,0.3)'; e.currentTarget.style.opacity = '0.4'; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'connections' && <div style={{ flex: 1 }} />}

      {/* User chip ------------------------------------------------------- */}
      <div style={{
        padding: '12px 14px',
        borderTop: isLight ? `1px solid ${BRAND.hairline}` : '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <UserAvatar user={user} size={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 600,
              color: isLight ? BRAND.ink : 'white',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user?.displayName}
            </div>
            <div style={{
              fontSize: 10.5, marginTop: 2,
              color: isLight ? BRAND.muted : 'rgba(255,255,255,0.4)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user?.title || ''}{user?.department ? ` · ${user.department}` : ''}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: isLight ? BRAND.muted : 'rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = isLight ? BRAND.ink : 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = isLight ? BRAND.muted : 'rgba(255,255,255,0.4)'; }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );

  // ── Chat surface (used in both layouts) ─────────────────────────────────
  const ChatSurface = view === 'chat' ? (
    <ChatPanel
      key={activeId || 'none'}
      conversationId={activeId}
      user={user}
      connections={connections}
      onNavigateConnections={() => setView('connections')}
      onSignOut={handleSignOut}
      onNewConversation={newConversation}
      onOpenHistory={() => setDrawerOpen(true)}
      onConversationRenamed={(id, title) => {
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
      }}
      isMobile={isMobile}
    />
  ) : (
    <div className="flex-1 overflow-y-auto bg-white h-full">
      <ConnectionsPanel connections={connections} onChanged={onMeRefresh} />
    </div>
  );

  // ── Mobile layout: full-bleed phone-style surface, sidebar in drawer ─────
  if (isMobile) {
    return (
      <div style={{
        height: '100dvh', width: '100%',
        display: 'flex', flexDirection: 'column',
        background: 'white', overflow: 'hidden', position: 'relative',
      }}>
        {/* Ambient purple radial gradient at the bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
          background: 'radial-gradient(ellipse 140% 100% at 50% 110%, #7C3AED 0%, rgba(124,58,237,0.55) 35%, rgba(124,58,237,0.15) 60%, transparent 80%)',
          pointerEvents: 'none', zIndex: 0,
        }} />
        {view === 'chat' ? ChatSurface : (
          <div style={{ position: 'relative', zIndex: 1, flex: 1, overflow: 'hidden', background: 'white' }}>
            <ConnectionsPanel
              connections={connections}
              onChanged={onMeRefresh}
              isMobile
              onOpenHistory={() => setDrawerOpen(true)}
            />
          </div>
        )}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="w-[280px] max-w-[80vw] h-full">{Sidebar}</div>
            <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
          </div>
        )}
      </div>
    );
  }

  // ── Desktop: sidebar + chat canvas + inspector dock (no phone frame) ─────
  // Phase A unframes the desktop chat. Phase C adds the right-side inspector
  // dock for Sources / Flow / Trace / Connections. The dock collapses to a
  // 56px icon rail so the chat keeps maximum reading width when nothing
  // contextual is happening.
  return (
    <div className="h-screen flex bg-[#F5F5F7]">
      {Sidebar}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {view === 'chat' ? (
          <div style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            background: '#F5F5F7',
          }}>
            {/* Ambient teal halo, top-right — brand presence without dominating. */}
            <div aria-hidden style={{
              position: 'absolute', top: -220, right: -160,
              width: 720, height: 720, pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(0,199,178,0.10) 0%, rgba(0,199,178,0.04) 35%, transparent 65%)',
            }} />
            {/* Ambient warm violet halo, bottom-left — pairs with the teal. */}
            <div aria-hidden style={{
              position: 'absolute', bottom: -260, left: -200,
              width: 760, height: 760, pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.03) 40%, transparent 70%)',
            }} />
            <div style={{
              position: 'relative', zIndex: 1, height: '100%',
              maxWidth: 1080, margin: '0 auto', padding: '20px 24px 20px',
              display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
                background: 'white',
                borderRadius: 18,
                boxShadow: '0 1px 0 rgba(15,23,42,0.04), 0 12px 40px rgba(15,23,42,0.06)',
                border: `1px solid ${BRAND.hairline}`,
                overflow: 'hidden',
              }}>
                {ChatSurface}
              </div>
            </div>
          </div>
        ) : (
          ChatSurface
        )}
      </main>
      <InspectorDock connections={connections} onConnectionsChanged={onMeRefresh} />
    </div>
  );
}
