import React, { useEffect, useState } from 'react';
import { MessageSquarePlus, ArrowLeft, Sparkles, Plug, MessageCircle, LogOut, Menu } from 'lucide-react';
import ChatPanel from './ChatPanel.jsx';
import ConnectionsPanel from './ConnectionsPanel.jsx';
import { PhoneFrame, StatusBar } from './PhoneFrame.jsx';
import { useIsMobile } from './lib/responsive.js';
import { listConversations, createConversation, logout } from './api.js';

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
        // Mobile defaults to a fresh conversation on each visit — previous
        // chats are still reachable from the drawer. Desktop keeps showing
        // the most recent one so power users don't lose context on reload.
        if (isMobile) {
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      const cleaned = window.location.pathname + window.location.hash;
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
              <button
                key={c.id}
                onClick={() => { setActiveId(c.id); setDrawerOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-md text-[13px] truncate mb-0.5 transition-colors ${
                  c.id === activeId ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                {c.title || 'Conversation'}
              </button>
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
          <>
            {/* Menu button is owned by ChatPanel's AppHeader on chat view;
                non-chat views render their own floating menu button. */}
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              style={{ position: 'absolute', top: 14, left: 14, zIndex: 10, background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: 6, color: '#52525B', cursor: 'pointer' }}
            >
              <Menu size={14} />
            </button>
            <div style={{ position: 'relative', zIndex: 1, flex: 1, overflow: 'auto', background: 'white' }}>
              <ConnectionsPanel connections={connections} onChanged={onMeRefresh} />
            </div>
          </>
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
