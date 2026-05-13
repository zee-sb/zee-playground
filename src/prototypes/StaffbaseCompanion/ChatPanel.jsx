import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, Plug, Send, Loader2, MapPin, Zap, LogOut, RotateCcw, Building2, Trophy, Menu, MessageSquarePlus, Database, ChevronRight, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ToolCallCard from './ToolCallCard.jsx';
import TraceCard from './TraceCard.jsx';
import ConfirmWriteModal from './ConfirmWriteModal.jsx';
import AnalyticsChartCard from './AnalyticsChartCard.jsx';
import CardRouter from './cards/CardRouter.jsx';
import { TypingIndicator } from '../../chat-widget/TypingIndicator.jsx';
import { streamPost, listMessages } from './api.js';
import { markdownComponents } from './lib/markdown.jsx';
import '../../chat-widget/styles.css';

// ── Helpers ────────────────────────────────────────────────────────────────

function safeParse(s) { if (!s) return {}; try { return JSON.parse(s); } catch { return {}; } }

function extractSuggestions(text) {
  if (!text) return { clean: text, suggestions: [] };
  const m = text.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
  if (!m) return { clean: text, suggestions: [] };
  let suggestions = [];
  try { suggestions = JSON.parse(m[1]); } catch { /* malformed */ }
  const clean = text.replace(/<suggestions>[\s\S]*?<\/suggestions>/g, '').trim();
  return { clean, suggestions };
}

function reduceMessages(rows) {
  const out = [];
  for (const row of rows) {
    const c = row.content || {};
    if (row.role === 'user') {
      out.push({ kind: 'msg', role: 'user', text: typeof c === 'string' ? c : (c.text || '') });
    } else if (row.role === 'assistant') {
      const text = c.content;
      if (text) {
        const { clean, suggestions } = extractSuggestions(text);
        out.push({ kind: 'msg', role: 'assistant', text: clean, suggestions });
      }
      if (Array.isArray(c.tool_calls)) {
        for (const tc of c.tool_calls) {
          const name = tc.function?.name || tc.name || '';
          const [connector, ...rest] = name.split('__');
          out.push({
            kind: 'tool',
            id: tc.id,
            name: rest.join('__') || name,
            connector,
            args: safeParse(tc.function?.arguments),
            status: 'done',
          });
        }
      }
    } else if (row.role === 'tool') {
      const id = c.tool_call_id;
      const item = [...out].reverse().find((i) => i.kind === 'tool' && i.id === id);
      if (item) {
        try { item.result = JSON.parse(c.content); } catch { item.result = c.content; }
        item.status = item.result?.error ? 'error' : 'done';
      }
    } else if (row.role === 'system') {
      if (c.pendingConfirmation && Array.isArray(c.toolCalls)) {
        for (const tc of c.toolCalls) {
          const item = [...out].reverse().find((i) => i.kind === 'tool' && i.id === tc.id);
          if (item) item.status = 'pending';
        }
      }
      // Trivia-state recovery: rebuild past round results + the currently
      // open question from the latest trivia state. Earlier snapshots are
      // superseded by the most recent one (we just overwrite).
      if (c.trivia) {
        // Drop any earlier reconstructed trivia entries — keep only the
        // latest snapshot's view.
        for (let i = out.length - 1; i >= 0; i--) {
          const k = out[i].kind;
          if (k === 'trivia_question' || k === 'trivia_result' || k === 'trivia_recap') out.splice(i, 1);
        }
        const t = c.trivia;
        if (t.finalized) {
          // Once trivia is complete, a single tidy recap card reads way
          // better than three stacked "Close, but no" chips.
          const total = (t.rounds || []).length || 3;
          out.push({
            kind: 'trivia_recap',
            score: Number(t.score) || 0,
            total,
            rounds: (t.rounds || []).map((r) => ({
              category: r.category,
              correct: !!r.correct,
              correctLabel: r.correctLabel || '—',
              userGuess: r.userGuess || '—',
            })),
          });
        } else {
          let score = 0;
          for (const past of t.rounds || []) {
            if (past.correct) score += 1;
            out.push({
              kind: 'trivia_result',
              round: (out.filter((x) => x.kind === 'trivia_result').length || 0) + 1,
              total: 3,
              correct: !!past.correct,
              reveal: past.correctLabel,
              score,
              scoreOutOf: 3,
            });
          }
          if (t.currentRound) {
            out.push({
              kind: 'trivia_question',
              round: t.round, total: 3,
              category: t.currentRound.category,
              clue: t.currentRound.clue,
              options: t.currentRound.optionPublic || [],
              answered: false,
            });
          }
        }
      }
    }
  }
  return out;
}

// ── Main panel ──────────────────────────────────────────────────────────────

export default function ChatPanel({ conversationId, user, connections = [], onNavigateConnections, onSignOut, onNewConversation, onOpenHistory, onConversationRenamed, isMobile = false }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [openSources, setOpenSources] = useState(null); // array of tool items, or null
  const [error, setError] = useState(null);
  const endRef = useRef(null);
  const atlassianLinked = connections.some((c) => c.provider === 'atlassian');

  useEffect(() => {
    let cancelled = false;
    if (!conversationId) { setItems([]); return; }
    (async () => {
      try {
        const rows = await listMessages(conversationId);
        if (cancelled) return;
        setItems(reduceMessages(rows));
        const pendingRow = [...rows].reverse().find((r) => r.role === 'system' && r.content?.pendingConfirmation);
        if (pendingRow) setPendingConfirm({ toolCalls: pendingRow.content.toolCalls });
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, busy]);

  const handleEvent = useCallback((evt) => {
    setItems((prev) => {
      const next = [...prev];
      if (evt.type === 'trace_connectors') {
        const last = next[next.length - 1];
        if (last?.kind === 'trace') last.connectors = evt.connectors;
        else next.push({ kind: 'trace', connectors: evt.connectors });
      } else if (evt.type === 'trace_intent') {
        const trace = [...next].reverse().find((i) => i.kind === 'trace');
        if (trace) trace.intent = { connectors: evt.connectors, reasoning: evt.reasoning };
        else next.push({ kind: 'trace', intent: { connectors: evt.connectors, reasoning: evt.reasoning } });
      } else if (evt.type === 'connector_error') {
        next.push({ kind: 'connector_error', connector: evt.connector, message: evt.message });
      } else if (evt.type === 'needs_connection') {
        next.push({ kind: 'connect_prompt', connectors: evt.connectors || [] });
      } else if (evt.type === 'trivia_question') {
        next.push({
          kind: 'trivia_question',
          round: evt.round, total: evt.total, category: evt.category,
          clue: evt.clue, options: evt.options || [],
          answered: false,
        });
      } else if (evt.type === 'trivia_result') {
        // Mark the latest trivia_question as answered so the composer unlocks,
        // and push a result item just under it.
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].kind === 'trivia_question') { next[i].answered = true; break; }
        }
        next.push({
          kind: 'trivia_result',
          round: evt.round, total: evt.total,
          correct: !!evt.correct,
          reveal: evt.reveal,
          score: evt.score, scoreOutOf: evt.scoreOutOf,
        });
      } else if (evt.type === 'chart_card') {
        next.push({ kind: 'chart', chart: evt.chart, source: evt.source || null });
      } else if (evt.type === 'card') {
        next.push({ kind: 'card', card: evt.card, source: evt.source || null });
      } else if (evt.type === 'conversation_renamed') {
        // Fire-and-forget — the parent updates its conversation list.
        // Use queueMicrotask so we don't setState during this setState.
        if (evt.conversationId && evt.title) {
          queueMicrotask(() => onConversationRenamed?.(evt.conversationId, evt.title));
        }
      } else if (evt.type === 'delta') {
        const last = next[next.length - 1];
        if (last?.kind === 'msg' && last.role === 'assistant' && last.streaming) {
          last.text = (last.text || '') + evt.content;
        } else {
          next.push({ kind: 'msg', role: 'assistant', text: evt.content, streaming: true });
        }
      } else if (evt.type === 'tool_start') {
        next.push({
          kind: 'tool',
          id: evt.toolCallId,
          name: evt.name,
          connector: evt.connector,
          args: evt.args,
          status: 'running',
        });
      } else if (evt.type === 'tool_result') {
        const item = [...next].reverse().find((i) => i.kind === 'tool' && i.id === evt.toolCallId);
        if (item) {
          item.result = evt.result;
          item.status = evt.result?.error ? 'error' : (evt.result?.cancelled ? 'error' : 'done');
        }
      } else if (evt.type === 'tool_call_pending') {
        for (const tc of evt.toolCalls) {
          next.push({ kind: 'tool', id: tc.id, name: tc.name, connector: tc.connector || 'atlassian', args: tc.args, status: 'pending' });
        }
        setPendingConfirm({ toolCalls: evt.toolCalls });
      } else if (evt.type === 'done') {
        const last = next[next.length - 1];
        if (last?.kind === 'msg' && last.role === 'assistant' && last.streaming) {
          const { clean, suggestions } = extractSuggestions(last.text);
          last.text = clean;
          last.suggestions = suggestions;
          delete last.streaming;
        }
      } else if (evt.type === 'error') {
        setError(evt.message);
      } else if (evt.type === 'truncated') {
        setError(`Truncated: ${evt.reason}`);
      }
      return next;
    });
  }, []);

  async function send(text) {
    if (!text.trim() || busy || !conversationId) return;
    setError(null);
    setItems((p) => [...p, { kind: 'msg', role: 'user', text }]);
    setBusy(true);
    try {
      await streamPost('/api/companion/chat', { conversationId, message: text }, handleEvent);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision) {
    if (!pendingConfirm) return;
    setConfirmBusy(true);
    try {
      await streamPost('/api/companion/confirm', { conversationId, decision }, handleEvent);
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmBusy(false);
      setPendingConfirm(null);
    }
  }

  const empty = items.length === 0 && !busy;
  const userInitials = user?.avatarInitials || (user?.displayName || '?').slice(0, 2).toUpperCase();
  const liveBadges = ['Staffbase'];
  if (atlassianLinked) liveBadges.push('Atlassian');

  // Trivia is active when the latest trivia_question hasn't been answered.
  // While active, the composer is disabled — the user must pick a card.
  const triviaActive = (() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === 'trivia_question') return !it.answered;
    }
    return false;
  })();

  return (
    <>
      <AppHeader
        user={user}
        connections={connections}
        onSignOut={onSignOut}
        onNewConversation={onNewConversation}
        onOpenHistory={onOpenHistory}
        isMobile={isMobile}
      />

      <div style={{
        flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1,
        WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
        display: 'flex', flexDirection: 'column', padding: '12px 12px 0',
      }}>
        {empty ? (
          <Hero
            user={user}
            atlassianLinked={atlassianLinked}
            onPick={send}
            onConnect={onNavigateConnections}
          />
        ) : (
          <div className="cw-root" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, '--cw-primary': '#7C3AED', '--cw-primary-dark': '#6D28D9', '--cw-primary-light': '#EDE9FE' }}>
            {(() => {
              // Only the most recent assistant message's suggestion chips are
              // interactive; once the turn has passed they grey out so the
              // user can't accidentally re-trigger an old prompt.
              let lastSuggestionIdx = -1;
              for (let i = items.length - 1; i >= 0; i--) {
                const it = items[i];
                if (it.kind === 'msg' && it.role === 'assistant' && it.suggestions?.length > 0 && !it.streaming) {
                  lastSuggestionIdx = i;
                  break;
                }
              }
              // Collapse runs of tool items into the next assistant message
              // they precede — those tools are the "sources" for that answer.
              // Anything still pending at the end (mid-stream, no assistant
              // msg yet) is shown inline so the user sees progress.
              const out = [];
              let pendingTools = [];
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'tool') { pendingTools.push(item); continue; }
                if (item.kind === 'msg' && item.role === 'assistant') {
                  out.push(
                    <Item
                      key={i}
                      item={item}
                      userInitials={userInitials}
                      onSuggestion={send}
                      suggestionsDisabled={busy || i !== lastSuggestionIdx}
                      sources={pendingTools.filter((t) => t.status === 'done' || t.status === 'error')}
                      onOpenSources={setOpenSources}
                    />
                  );
                  pendingTools = [];
                } else {
                  out.push(
                    <Item
                      key={i}
                      item={item}
                      userInitials={userInitials}
                      onSuggestion={send}
                      suggestionsDisabled={busy || i !== lastSuggestionIdx}
                    />
                  );
                }
              }
              // Tools still streaming (no assistant msg yet) — render inline
              // so the user gets running-state feedback.
              for (const t of pendingTools) {
                if (t.status === 'running' || t.status === 'pending') {
                  out.push(
                    <Item key={`pt-${t.id}`} item={t} userInitials={userInitials} onSuggestion={send} />
                  );
                }
              }
              return out;
            })()}
            {busy && (
              <div className="cw-root" style={{ '--cw-primary': '#7C3AED' }}>
                <TypingIndicator agentAvatar={<Sparkles size={14} color="white" />} />
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '6px 14px', background: 'rgba(254,242,242,0.85)', backdropFilter: 'blur(8px)', borderTop: '1px solid #FECACA', color: '#B91C1C', fontSize: 11, position: 'relative', zIndex: 1 }}>
          {error}
        </div>
      )}

      <Composer
        onSubmit={send}
        disabled={busy || !conversationId || triviaActive}
        placeholder={triviaActive ? 'Pick a card above to continue' : undefined}
        isMobile={isMobile}
      />

      {pendingConfirm && (
        <ConfirmWriteModal
          toolCalls={pendingConfirm.toolCalls}
          busy={confirmBusy}
          onConfirm={() => decide('confirm')}
          onCancel={() => decide('cancel')}
        />
      )}

      {openSources && (
        <SourcesBottomSheet
          sources={openSources}
          onClose={() => setOpenSources(null)}
        />
      )}
    </>
  );
}

// ── AppHeader (purple gradient strip that flows up from the status bar) ──────

function AppHeader({ user, connections, onSignOut, onNewConversation, onOpenHistory, isMobile }) {
  const initials = user?.avatarInitials || (user?.displayName || '?').slice(0, 2).toUpperCase();
  const firstName = (user?.displayName || '').split(' ')[0] || 'You';
  const atlassianLinked = connections?.some((c) => c.provider === 'atlassian');
  const subtitle = atlassianLinked
    ? 'HR · IT · Intranet · Atlassian'
    : 'HR · IT · Intranet';

  const iconBtnStyle = {
    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8, padding: 6, color: 'white', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
      padding: '8px 14px 14px', flexShrink: 0,
      position: 'relative', zIndex: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isMobile && onOpenHistory && (
          <button onClick={onOpenHistory} aria-label="Open conversation history" style={iconBtnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            <Menu size={14} />
          </button>
        )}
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)' }}>
          <Zap size={18} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 16, lineHeight: 1.2, letterSpacing: '-0.3px' }}>Staffbase Companion</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 500 }}>{subtitle}</div>
        </div>
        {isMobile && onNewConversation && (
          <button onClick={onNewConversation} aria-label="New conversation" title="New conversation" style={iconBtnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            <MessageSquarePlus size={14} />
          </button>
        )}
        {user && (
          <button
            onClick={onSignOut}
            title="Sign out"
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 20, padding: '4px 10px',
              color: 'rgba(255,255,255,0.95)', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: '#7C3AED', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 800, overflow: 'hidden', position: 'relative',
            }}>
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling; if (fb) fb.style.display = 'flex'; }}
                  style={{ width: 18, height: 18, objectFit: 'cover' }}
                />
              ) : null}
              <span style={{ display: user?.avatarUrl ? 'none' : 'flex' }}>{initials}</span>
            </div>
            {firstName}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Hero (empty state) ──────────────────────────────────────────────────────

function Hero({ user, atlassianLinked, onPick, onConnect }) {
  const callMe = user?.customFields?.callme;
  const firstName = (callMe || user?.displayName || '').split(' ')[0] || 'there';
  const initials = user?.avatarInitials || (firstName).slice(0, 2).toUpperCase();
  const role = user?.title || 'Staffbase teammate';
  // Prefer the real Staffbase location, fall back to department, then a
  // generic label so the Hero always has a second line.
  const heroLocation = user?.location || user?.department || 'Staffbase';

  const subtitle = atlassianLinked
    ? 'I can pull live Staffbase intranet posts, check HR/IT info, and search your Confluence + Jira.'
    : 'I can pull live Staffbase intranet posts and check HR/IT info. Link Atlassian to add Confluence + Jira.';

  const chips = atlassianLinked ? FULL_SAMPLES : MOCKED_ONLY_SAMPLES;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 16px 12px' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingBottom: 16,
      }}>
        {/* Avatar with glow */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', inset: -14, background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: '#7C3AED', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, position: 'relative',
            boxShadow: '0 6px 24px rgba(124,58,237,0.45)',
            overflow: 'hidden',
          }}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling; if (fb) fb.style.display = 'flex'; }}
                style={{ width: 58, height: 58, objectFit: 'cover' }}
              />
            ) : null}
            <span style={{ display: user?.avatarUrl ? 'none' : 'flex' }}>{initials}</span>
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
          Hi, {firstName}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#7C3AED', marginTop: 4, marginBottom: 3 }}>
          {role}
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={10} />
          {heroLocation}
          {user?.department && user?.location && user.department !== user.location && (
            <span style={{ color: '#CBD5E1' }}> · {user.department}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.55, maxWidth: 260 }}>
          {subtitle}
        </div>
      </div>

      {/* Featured action card(s) + round chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {atlassianLinked && (
          <button
            onClick={() => onPick("I want to submit my hackathon entry — let's take the quiz!")}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 14px', borderRadius: 14,
              background: 'rgba(245,158,11,0.10)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(245,158,11,0.35)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.20)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.10)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trophy size={12} color="white" />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#78350F' }}>Take the AI quiz & submit your entry</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#D97706', background: 'rgba(245,158,11,0.15)', padding: '2px 7px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', letterSpacing: '0.05em' }}>HACKATHON</span>
          </button>
        )}
        {!atlassianLinked && (
          <button
            onClick={onConnect}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 14px', borderRadius: 14,
              background: 'rgba(0,82,204,0.10)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0,82,204,0.35)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,82,204,0.18)'; e.currentTarget.style.borderColor = 'rgba(0,82,204,0.5)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,82,204,0.10)'; e.currentTarget.style.borderColor = 'rgba(0,82,204,0.35)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: '#0052CC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={12} color="white" />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#003E99' }}>Connect Atlassian (needed for the hackathon)</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#0052CC', background: 'rgba(0,82,204,0.15)', padding: '2px 7px', borderRadius: 8, border: '1px solid rgba(0,82,204,0.3)', letterSpacing: '0.05em' }}>OAUTH</span>
          </button>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
          {chips.map((label) => (
            <button
              key={label}
              onClick={() => onPick(label)}
              style={{
                padding: '8px 13px', borderRadius: 20,
                background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.7)',
                color: '#111827', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 1px 5px rgba(0,0,0,0.07)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#7C3AED'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.82)'; e.currentTarget.style.color = '#111827'; }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sources badge + bottom sheet ────────────────────────────────────────────

function SourcesBadge({ count, onOpen }) {
  if (!count) return null;
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        marginTop: 8, padding: '4px 10px',
        background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.14)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.07)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
    >
      <Database size={10} color="#7C3AED" />
      <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED' }}>
        {count} {count === 1 ? 'source' : 'sources'}
      </span>
      <ChevronRight size={10} color="#7C3AED" />
    </button>
  );
}

// Bottom sheet anchored to the chat surface (not the full viewport), matching
// the ConfirmWriteModal pattern. Slides up from the bottom.
function SourcesBottomSheet({ sources, onClose }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end pointer-events-none">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 pointer-events-auto transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
      />
      <div
        className="relative bg-white rounded-t-2xl shadow-2xl overflow-hidden pointer-events-auto transition-transform duration-200 ease-out flex flex-col"
        style={{ transform: open ? 'translateY(0)' : 'translateY(100%)', maxHeight: '80%' }}
      >
        <div className="pt-2 pb-1 flex justify-center flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-[#E4E4E7]" />
        </div>
        <div className="px-5 py-3 border-b border-[#E4E4E7] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Database size={14} color="#7C3AED" />
            <span className="font-bold text-[14px]">Sources</span>
            <span className="text-[11px] font-semibold text-[#71717A] bg-[#F4F4F5] px-1.5 py-0.5 rounded">{sources.length}</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#F4F4F5] hover:bg-[#E4E4E7] grid place-items-center text-[#52525B]" aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="px-3 py-3 overflow-y-auto flex-1 flex flex-col gap-2">
          {sources.map((s) => {
            const userCards = extractUserCards(s);
            if (userCards.length > 0) {
              return (
                <div key={s.id} className="flex flex-col gap-2">
                  {userCards.map((u, i) => (
                    <UserCard key={`${s.id}-${u.id || i}`} user={u} />
                  ))}
                </div>
              );
            }
            return (
              <ToolCallCard
                key={s.id}
                name={s.name}
                args={s.args}
                result={s.result}
                status={s.status}
                connector={s.connector}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Pulls user-shaped objects out of a tool result, so we can render them as
// rich cards in the sources sheet instead of raw JSON. Recognises the
// `search_users` / `get_user` shape from the Staffbase MCP plus the generic
// user shape from any tool whose result contains a `users` array.
function extractUserCards(source) {
  if (!source) return [];
  const isUserTool = source.name === 'search_users' || source.name === 'get_user' || source.name === 'lookup_employee';
  const isStaffbase = source.connector === 'intranet' || source.connector === 'hr_portal';
  if (!isUserTool && !isStaffbase) return [];
  const result = source.result;
  if (!result || typeof result !== 'object') return [];
  // Common shapes: { users: [...] }, { user: {...} }, single object, or array
  let candidates = [];
  if (Array.isArray(result.users)) candidates = result.users;
  else if (Array.isArray(result)) candidates = result;
  else if (result.user) candidates = [result.user];
  else if (result.name && result.email) candidates = [result];
  return candidates.filter((u) => u && u.name && (u.email || u.id));
}

// Inline horizontal carousel that renders directly under an assistant message
// whenever the answer included people-lookup tool results. Lets the user
// scrub through compact profile cards without opening the sources sheet.
function UserCardCarousel({ users }) {
  if (!users?.length) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        marginTop: 8,
        marginLeft: -4,
        marginRight: -4,
        paddingLeft: 4,
        paddingRight: 4,
        paddingBottom: 4,
      }}
      className="cw-no-scrollbar"
    >
      {users.map((u, i) => (
        <CompactUserCard key={`${u.id || u.email || i}`} user={u} />
      ))}
    </div>
  );
}

function CompactUserCard({ user }) {
  const initials = (user.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
  const href = user.email ? `mailto:${user.email}` : undefined;
  const content = (
    <>
      <div style={{ position: 'relative', width: 56, height: 56, marginBottom: 8 }}>
        {user.avatar && (
          <img
            src={user.avatar}
            alt=""
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.style.display = 'grid'; }}
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', background: '#F4F4F5' }}
          />
        )}
        <div
          style={{
            width: 56, height: 56, borderRadius: '50%',
            display: user.avatar ? 'none' : 'grid',
            placeItems: 'center', color: 'white', fontSize: 16, fontWeight: 700,
            background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
            position: user.avatar ? 'absolute' : undefined,
            top: user.avatar ? 0 : undefined, left: user.avatar ? 0 : undefined,
          }}
        >
          {initials}
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#18181B', lineHeight: 1.25 }}>
        {user.name}
      </div>
      {user.title && (
        <div
          style={{
            fontSize: 11, color: '#52525B', marginTop: 2, lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {user.title}
        </div>
      )}
      {user.department && (
        <div style={{ fontSize: 10, color: '#71717A', marginTop: 4, fontWeight: 500 }}>
          {user.department}
        </div>
      )}
    </>
  );
  const baseStyle = {
    flexShrink: 0,
    width: 160,
    scrollSnapAlign: 'start',
    background: 'white',
    border: '1px solid #E4E4E7',
    borderRadius: 14,
    padding: '12px 12px 10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    textDecoration: 'none',
    display: 'block',
  };
  return href ? (
    <a href={href} style={baseStyle}>{content}</a>
  ) : (
    <div style={baseStyle}>{content}</div>
  );
}

function UserCard({ user }) {
  const initials = (user.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
  return (
    <div className="border border-[#E4E4E7] rounded-xl p-3 bg-white flex items-start gap-3">
      <div className="flex-shrink-0">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt=""
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.style.display = 'grid'; }}
            className="w-11 h-11 rounded-full object-cover bg-[#F4F4F5]"
          />
        ) : null}
        <div
          className="w-11 h-11 rounded-full grid place-items-center text-white text-[13px] font-bold"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', display: user.avatar ? 'none' : 'grid' }}
        >
          {initials}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-semibold text-[14px] text-[#18181B] truncate">{user.name}</div>
          {user.activated === false && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#B45309]">deactivated</span>
          )}
        </div>
        {user.title && <div className="text-[12px] text-[#52525B] truncate">{user.title}</div>}
        <div className="text-[11px] text-[#71717A] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {user.department && <span>{user.department}</span>}
          {user.location && <span>· {user.location}</span>}
        </div>
        {user.email && (
          <a href={`mailto:${user.email}`} className="text-[11px] text-[#7C3AED] hover:underline break-all">
            {user.email}
          </a>
        )}
      </div>
    </div>
  );
}

// One-tap "Connect Atlassian" (etc) card. Renders inline in the chat when the
// orchestrator emits a `needs_connection` event because the user asked
// something that requires an unlinked connector. Clicking starts the OAuth
// flow in the same window; the callback bounces back to
// /prototypes/staffbase-companion?connected=<provider>, which the shell
// already watches and refreshes connections from.
function ConnectorPromptCard({ connector }) {
  const c = connector || {};
  const color = c.color || '#7C3AED';
  return (
    <a
      href={c.connectUrl}
      style={{
        display: 'block', textDecoration: 'none',
        border: `1px solid ${color}33`,
        borderRadius: 16,
        background: 'white',
        padding: 14,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Soft accent strip in the connector colour */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${color}, ${color}88)`,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          display: 'grid', placeItems: 'center',
          color: 'white', background: color, flexShrink: 0,
          fontWeight: 800, fontSize: 18,
        }}>
          <Plug size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
              textTransform: 'uppercase', color, background: `${color}1A`,
              padding: '2px 6px', borderRadius: 6,
            }}>One-tap connect</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>
            Connect {c.name}
          </div>
          {c.description && (
            <div style={{ fontSize: 11, color: '#71717A', marginTop: 2, lineHeight: 1.35 }}>
              {c.description}
            </div>
          )}
        </div>
        <div
          style={{
            flexShrink: 0,
            padding: '8px 14px', borderRadius: 999,
            background: color, color: 'white',
            fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Connect <ChevronRight size={14} />
        </div>
      </div>
    </a>
  );
}

// ── Trivia question + result cards ──────────────────────────────────────────
// The trivia state machine emits trivia_question events with 3 options that
// hide identifying detail (title/date/description). The user picks ONE card;
// the click sends the option's label as a normal user message so the
// orchestrator can validate. Composer is disabled while a question is open
// (computed in the parent), so clicking is the ONLY way forward.

function CategoryLabel({ category }) {
  const map = {
    teammate: { label: 'Mystery teammate', color: '#7C3AED' },
    post: { label: 'Mystery post', color: '#0EA5E9' },
    channel: { label: 'Mystery channel', color: '#0EA5E9' },
  };
  const c = map[category] || { label: 'Trivia', color: '#7C3AED' };
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
      color: c.color, background: `${c.color}1A`,
      padding: '2px 7px', borderRadius: 6,
    }}>{c.label}</span>
  );
}

function TriviaOptionCard({ option, onClick, disabled }) {
  const initials = (option.label || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join('').toUpperCase();
  const color = option.kind === 'channel' ? '#0EA5E9'
    : option.kind === 'post' ? '#0369A1'
    : '#7C3AED';

  const visual = option.kind === 'teammate' ? (
    <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto 8px' }}>
      {option.avatar && (
        <img
          src={option.avatar}
          alt=""
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.style.display = 'grid'; }}
          style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', background: '#F4F4F5' }}
        />
      )}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        display: option.avatar ? 'none' : 'grid',
        placeItems: 'center', color: 'white', fontSize: 22, fontWeight: 800,
        background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
        position: option.avatar ? 'absolute' : undefined,
        top: option.avatar ? 0 : undefined, left: option.avatar ? 0 : undefined,
      }}>{initials}</div>
    </div>
  ) : option.kind === 'post' ? (
    <div style={{
      width: '100%', height: 72, marginBottom: 8,
      borderRadius: 10,
      background: option.image
        ? `url(${option.image}) center/cover, ${color}`
        : `linear-gradient(135deg, ${color}, #1e3a8a)`,
      display: 'grid', placeItems: 'center',
    }}>
      {!option.image && (
        <div style={{ color: 'white', fontSize: 26, fontWeight: 800, opacity: 0.6 }}>{initials}</div>
      )}
    </div>
  ) : (
    <div style={{
      width: '100%', height: 72, marginBottom: 8,
      borderRadius: 10,
      background: `linear-gradient(135deg, ${color}, #1e3a8a)`,
      display: 'grid', placeItems: 'center',
      color: 'white', fontSize: 28, fontWeight: 800,
    }}>#</div>
  );

  return (
    <button
      onClick={() => !disabled && onClick?.(option.label)}
      disabled={disabled}
      style={{
        flex: 1, minWidth: 0,
        background: 'white',
        border: '1px solid #E4E4E7', borderRadius: 14,
        padding: 12,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.12s ease',
        textAlign: 'center',
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 14px ${color}33`; } }}
      onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; } }}
    >
      {visual}
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#18181B',
        lineHeight: 1.25,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', minHeight: 30,
      }}>
        {option.label}
      </div>
    </button>
  );
}

function TriviaQuestion({ question, onPick }) {
  return (
    <div style={{
      marginTop: 4, marginBottom: 4,
      background: 'white', borderRadius: 16,
      border: '1px solid #E4E4E7',
      padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <CategoryLabel category={question.category} />
        <span style={{ fontSize: 10, color: '#A1A1AA', fontWeight: 600 }}>
          Round {question.round} of {question.total}
        </span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.4, color: '#18181B', marginBottom: 10 }}>
        <ReactMarkdown components={markdownComponents}>{question.clue}</ReactMarkdown>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {(question.options || []).map((opt) => (
          <TriviaOptionCard
            key={opt.id}
            option={opt}
            onClick={onPick}
            disabled={question.answered}
          />
        ))}
      </div>
    </div>
  );
}

// Shown when reloading a conversation whose trivia has already finished.
// Collapses the three result chips + their now-empty reveal lines into one
// tidy summary card so old conversations read cleanly.
function TriviaRecap({ recap }) {
  const { score = 0, total = 3, rounds = [] } = recap || {};
  const cleanSweep = total > 0 && score === total;
  return (
    <div style={{
      marginTop: 4, marginBottom: 4,
      background: 'white', borderRadius: 16,
      border: '1px solid #E4E4E7',
      padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
            Trivia recap
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#18181B' }}>
            {score}/{total}{cleanSweep ? ' · clean sweep' : ''}
          </div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 800, color: 'white', background: cleanSweep ? '#16A34A' : '#7C3AED',
          padding: '4px 10px', borderRadius: 999,
        }}>{score}/{total}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rounds.map((r, i) => {
          const catLabel = r.category === 'post' ? 'Mystery post'
            : r.category === 'channel' ? 'Mystery channel'
            : 'Mystery teammate';
          return (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{
                fontSize: 11, marginTop: 1,
                color: r.correct ? '#16A34A' : '#B45309',
              }}>{r.correct ? '✓' : '✗'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#71717A' }}>
                  Round {i + 1} · {catLabel}
                </div>
                <div style={{ fontSize: 12, color: '#18181B', lineHeight: 1.35 }}>
                  Picked <span style={{ fontWeight: 700 }}>{r.userGuess}</span>
                  {r.correct ? null : <> · correct was <span style={{ fontWeight: 700 }}>{r.correctLabel}</span></>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TriviaResult({ result }) {
  const color = result.correct ? '#16A34A' : '#B45309';
  const bg = result.correct ? '#DCFCE7' : '#FEF3C7';
  return (
    <div style={{
      marginTop: 4, marginBottom: 4,
      background: bg, borderRadius: 12,
      padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 16 }}>{result.correct ? '🎯' : '🤔'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.3 }}>
          {result.correct ? 'Nailed it' : 'Close, but no'}
        </div>
        <div style={{ fontSize: 11, color: '#52525B', lineHeight: 1.35 }}>
          {result.reveal}
        </div>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, color, background: 'white',
        padding: '4px 8px', borderRadius: 999, flexShrink: 0,
      }}>
        {result.score}/{result.scoreOutOf}
      </div>
    </div>
  );
}

// ── Item renderer ───────────────────────────────────────────────────────────

function Item({ item, userInitials, onSuggestion, suggestionsDisabled = false, sources = [], onOpenSources }) {
  if (item.kind === 'trace') return <TraceCard intent={item.intent} connectors={item.connectors} />;
  if (item.kind === 'tool') {
    return <ToolCallCard name={item.name} args={item.args} result={item.result} status={item.status} connector={item.connector} />;
  }
  if (item.kind === 'connector_error') {
    return (
      <div style={{ margin: '8px 0', border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#B91C1C' }}>
        Connector <span style={{ fontFamily: 'monospace' }}>{item.connector}</span> failed: {item.message}
      </div>
    );
  }
  if (item.kind === 'connect_prompt') {
    return (
      <div className="flex flex-col gap-2 my-2">
        {item.connectors.map((c) => (
          <ConnectorPromptCard key={c.id} connector={c} />
        ))}
      </div>
    );
  }
  if (item.kind === 'trivia_question') {
    return (
      <TriviaQuestion
        question={item}
        onPick={(label) => !item.answered && onSuggestion(label)}
      />
    );
  }
  if (item.kind === 'trivia_result') {
    return <TriviaResult result={item} />;
  }
  if (item.kind === 'trivia_recap') {
    return <TriviaRecap recap={item} />;
  }
  if (item.kind === 'chart') {
    return <AnalyticsChartCard chart={item.chart} source={item.source} />;
  }
  if (item.kind === 'card') {
    return <CardRouter card={item.card} source={item.source} />;
  }
  if (item.role === 'user') {
    return (
      <div className="cw-msg-row cw-user">
        <div className="cw-msg-avatar cw-user-avatar" style={{ background: 'linear-gradient(135deg, #18181B, #3F3F46)' }}>
          <span>{userInitials}</span>
        </div>
        <div className="cw-msg-body">
          <div className="cw-bubble cw-user">{item.text}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="cw-msg-row">
      <div className="cw-msg-avatar" style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white' }}>
        <span><Sparkles size={14} /></span>
      </div>
      <div className="cw-msg-body" style={{ maxWidth: '100%' }}>
        <div className="cw-bubble cw-ai" style={{ fontSize: 13, lineHeight: 1.5 }}>
          {item.text ? (
            <ReactMarkdown components={markdownComponents}>{item.text}</ReactMarkdown>
          ) : (item.streaming ? <span style={{ color: '#A1A1AA' }}>…</span> : null)}
        </div>
        {!item.streaming && (() => {
          const peopleSources = sources.filter((s) => extractUserCards(s).length > 0);
          const people = peopleSources.flatMap((s) => extractUserCards(s));
          const seen = new Set();
          const unique = people.filter((u) => {
            const k = `${u.id || ''}|${u.email || ''}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          return unique.length > 0 ? <UserCardCarousel users={unique} /> : null;
        })()}
        {!item.streaming && sources.length > 0 && (
          <SourcesBadge count={sources.length} onOpen={() => onOpenSources?.(sources)} />
        )}
        {!item.streaming && item.suggestions?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {item.suggestions.map((s, i) => {
              const label = typeof s === 'string' ? s : s.label;
              return (
                <button
                  key={i}
                  onClick={() => { if (!suggestionsDisabled) onSuggestion(label); }}
                  disabled={suggestionsDisabled}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 100,
                    background: suggestionsDisabled ? '#F4F4F5' : 'rgba(255,255,255,0.82)',
                    backdropFilter: suggestionsDisabled ? 'none' : 'blur(10px)',
                    border: `1px solid ${suggestionsDisabled ? '#E4E4E7' : 'rgba(255,255,255,0.7)'}`,
                    color: suggestionsDisabled ? '#A1A1AA' : '#111827',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: suggestionsDisabled ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: suggestionsDisabled ? 'none' : '0 1px 5px rgba(0,0,0,0.07)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!suggestionsDisabled) { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#7C3AED'; } }}
                  onMouseLeave={(e) => { if (!suggestionsDisabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.82)'; e.currentTarget.style.color = '#111827'; } }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Composer (rounded glass pill + circular send + AI disclaimer) ──────────

function Composer({ onSubmit, disabled, isMobile, placeholder }) {
  const [value, setValue] = useState('');
  const ref = useRef(null);

  function send() {
    const v = value.trim();
    if (!v || disabled) return;
    onSubmit(v);
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
  }
  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function onInput(e) {
    setValue(e.target.value);
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 80) + 'px'; }
  }

  const canSend = !!value.trim() && !disabled;

  return (
    <div style={{
      flexShrink: 0, position: 'relative', zIndex: 1,
      padding: '8px 12px 4px',
    }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
        borderRadius: 28, padding: '0 6px 0 18px',
        border: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        minHeight: 48,
      }}>
        <textarea
          ref={ref}
          value={value}
          onChange={onInput}
          onKeyDown={onKey}
          placeholder={placeholder || 'Ask Companion anything…'}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1, border: 'none', background: 'none', resize: 'none', outline: 'none',
            fontSize: isMobile ? 16 : 14, color: '#111827', lineHeight: 1.5, fontFamily: 'inherit',
            maxHeight: 80, padding: '13px 0', margin: 0, display: 'block',
          }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: canSend ? '#7C3AED' : 'rgba(124,58,237,0.25)',
            border: 'none', cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
            boxShadow: canSend ? '0 2px 8px rgba(124,58,237,0.5)' : 'none',
          }}
        >
          {disabled
            ? <Loader2 size={15} color="white" style={{ animation: 'spin 1s linear infinite' }} />
            : <Send size={15} color="white" />}
        </button>
      </div>
      <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 5, marginBottom: 3, fontWeight: 500 }}>
        Responses are AI generated. Check the answers.
      </div>
    </div>
  );
}

const MOCKED_ONLY_SAMPLES = [
  'Recent intranet posts',
  "What's my PTO balance?",
  'Posts about AI',
  'Open IT tickets',
];

const FULL_SAMPLES = [
  'Recent intranet posts',
  'My Confluence spaces',
  'High-priority Jira issues',
  "PTO balance",
  'Posts about AI',
];
