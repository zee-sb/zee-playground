import React, { useEffect, useState } from 'react';
import { MessageSquarePlus, ArrowLeft, Sparkles, Plug, MessageCircle, LogOut, Trash2 } from 'lucide-react';
import ChatPanel from './ChatPanel.jsx';
import ConnectionsPanel from './ConnectionsPanel.jsx';
import { PhoneFrame, StatusBar } from './PhoneFrame.jsx';
import { useIsMobile } from './lib/responsive.js';
import { listConversations, createConversation, logout, deleteConversation as deleteConversationApi } from './api.js';

export default function CompanionShell({ user, connections, onSignedOut, onBack, onMeRefresh }) {
  const isMobile = useIsMobile();
  const [view, setView] = useState('chat');
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listConversations();
        if (cancelled) return;

        // Honour ?c=<id> in the URL if it matches one of THIS user's
        // conversations. The API already 404s any id the user doesn't own,
        // so we just need to silently fall back if it isn't in our list.
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
          const conv = await createConversation('New conversation');
          if (cancelled) return;
          setConversations([conv, ...list]);
          setActiveId(conv.id);
        } else if (list.length === 0) {
          const conv = await createConversation('New conversation');
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
  }, []);

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

  async function newConversation() {
    const conv = await createConversation('New conversation');
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
      await deleteConversationApi(id);
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
            const conv = await createConversation('New conversation');
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

  const Sidebar = (
    <aside className={isMobile ? 'h-full w-full' : 'w-[260px]'} style={{ background: '#111827', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <button onClick={onBack} className="text-white/60 hover:text-white" aria-label="Back to studio">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#7C3AED] grid place-items-center">
            <Sparkles size={14} />
          </div>
          <span className="font-semibold text-[13px]">Companion</span>
        </div>
        {isMobile && (
          <button onClick={() => setDrawerOpen(false)} className="ml-auto text-white/60 hover:text-white text-[11px]">Close</button>
        )}
      </div>

      <nav className="px-3 py-3 space-y-1 border-b border-white/10">
        <button
          onClick={() => { setView('chat'); setDrawerOpen(false); }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[13px] transition-colors ${
            view === 'chat' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'
          }`}
        >
          <MessageCircle size={14} /> Chat
        </button>
        <button
          onClick={() => { setView('connections'); setDrawerOpen(false); }}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-[13px] transition-colors ${
            view === 'connections' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'
          }`}
        >
          <span className="flex items-center gap-2"><Plug size={14} /> Connections</span>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-1.5 py-0.5 rounded">
            {connections.length}
          </span>
        </button>
      </nav>

      {view === 'chat' && (
        <>
          <button
            onClick={newConversation}
            className="mx-3 my-3 flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-[13px] font-medium transition-colors"
          >
            <MessageSquarePlus size={14} /> New conversation
          </button>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {loading && <div className="px-2 py-2 text-[12px] text-white/40">Loading…</div>}
            {!loading && conversations.length === 0 && (
              <div className="px-2 py-2 text-[12px] text-white/40">No conversations yet.</div>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center rounded-md mb-0.5 transition-colors ${
                  c.id === activeId ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <button
                  onClick={() => { setActiveId(c.id); setDrawerOpen(false); }}
                  className="flex-1 min-w-0 text-left px-3 py-2 text-[13px] truncate"
                  title={c.title || 'Conversation'}
                >
                  {c.title || 'Conversation'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeConversation(c.id, c.title); }}
                  aria-label={`Delete ${c.title || 'conversation'}`}
                  title="Delete"
                  className="px-2 py-2 text-white/30 hover:text-[#FCA5A5] opacity-60 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'connections' && <div className="flex-1" />}

      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white text-[12px] font-bold grid place-items-center">
            {user?.avatarInitials || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold truncate">{user?.displayName}</div>
            <div className="text-[10px] text-white/40 truncate">{user?.title || ''} {user?.department ? `· ${user.department}` : ''}</div>
          </div>
          <button onClick={handleSignOut} className="text-white/40 hover:text-white" title="Sign out">
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

  // ── Desktop: sidebar + centered phone-frame chat ─────────────────────────
  return (
    <div className="h-screen flex bg-[#F5F5F7]">
      {Sidebar}
      <main className="flex-1 flex flex-col overflow-hidden">
        {view === 'chat' ? (
          <div className="flex-1 grid place-items-center overflow-hidden py-6" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)' }}>
            <PhoneFrame>
              <StatusBar />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, minHeight: 0 }}>
                {ChatSurface}
              </div>
            </PhoneFrame>
          </div>
        ) : (
          ChatSurface
        )}
      </main>
    </div>
  );
}
