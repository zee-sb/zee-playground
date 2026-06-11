import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ChevronDown, ChevronUp, Send, Sparkles, Check, X, Pencil, ExternalLink,
  ShieldCheck, Zap, Undo2, Route, Flag, CircleCheck, Loader2, BadgeCheck, User, Settings2, Bot,
  Plug, FileText,
} from 'lucide-react'
import { PERSONAS, CONTINUATIONS, matchScript, fallbackScript } from './scripts'
import { recordChatEscalation } from '../NavigatorV2/useV2Store'
import { useActiveTenant } from '../AIAssistant/useActiveTenant'
import { useLiveNavigator } from './live'

/**
 * Navigator V2 — Employee Chat (target concept).
 *
 * One Navigator: no expert picker, no assistant gallery. Two modes:
 *
 *   Scripted demo — the original deterministic engine (scripts.js),
 *                   unchanged. Persona switcher applies here only.
 *   Live          — streams real turns from /api/companion/chat through the
 *                   shared chat adapter (src/ui/chat-adapter.js) and renders
 *                   them with the V2 trust components: citations, plain-
 *                   language progress narrative (raw trace stays in the
 *                   collapsed engine room), preview → receipt, trust ladder
 *                   with client-side auto-approvals, JIT connect cards.
 *                   Default whenever a tenant is active.
 *
 * Layout is mobile-first: a single column that looks right at 390px
 * (the concept's litmus test) and simply centers on desktop.
 */

const TEAL = '#00A593'
const TRUST_KEY = 'navigatorV2Chat.trust'

let _id = 0
const nextId = () => `m${++_id}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadTrust() {
  try { return JSON.parse(window.localStorage.getItem(TRUST_KEY)) || {} } catch { return {} }
}
function saveTrust(t) {
  try { window.localStorage.setItem(TRUST_KEY, JSON.stringify(t)) } catch { /* noop */ }
}

export default function NavigatorV2Chat() {
  const { branchId } = useActiveTenant()
  // Mode: 'live' is the default when a tenant is present; 'scripted' keeps
  // the original demo engine untouched. User toggle wins once used.
  const [modeOverride, setModeOverride] = useState(null)
  const mode = modeOverride || (branchId ? 'live' : 'scripted')
  const live = useLiveNavigator(branchId, mode === 'live')

  const [persona, setPersona] = useState(PERSONAS[0])
  const [messages, setMessages] = useState(() => [greetingMessage(PERSONAS[0])])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [contractOpen, setContractOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [trust, setTrustState] = useState(() => (typeof window === 'undefined' ? {} : loadTrust()))
  const runIdRef = useRef(0)
  const trustRef = useRef(trust)
  const scrollRef = useRef(null)

  const isLive = mode === 'live'
  const shownMessages = isLive ? live.messages : messages
  const shownBusy = isLive ? live.busy : busy

  useEffect(() => { trustRef.current = trust; saveTrust(trust) }, [trust])
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [shownMessages, shownBusy])

  const setTrust = useCallback((key, value) => {
    setTrustState((prev) => ({ ...prev, [key]: value }))
  }, [])

  function switchPersona(id) {
    const p = PERSONAS.find((x) => x.id === id)
    if (!p) return
    runIdRef.current += 1 // cancel any running script
    setPersona(p)
    setMessages([greetingMessage(p)])
    setBusy(false)
    setContractOpen(false)
  }

  // ── Script runner ─────────────────────────────────────────────────────────

  const appendPart = useCallback((messageId, part) => {
    const withId = { ...part, partId: nextId() }
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, parts: [...m.parts, withId] } : m))
    return withId.partId
  }, [])

  const updatePart = useCallback((messageId, partId, patch) => {
    setMessages((prev) => prev.map((m) => m.id !== messageId ? m : {
      ...m,
      parts: m.parts.map((p) => p.partId === partId ? { ...p, ...patch } : p),
    }))
  }, [])

  const runSteps = useCallback(async (messageId, steps) => {
    const runId = runIdRef.current
    for (const step of steps) {
      if (runIdRef.current !== runId) return
      if (step.effect === 'recordEscalation') {
        recordChatEscalation(step.payload)
        continue
      }
      await sleep(step.delay || 400)
      if (runIdRef.current !== runId) return
      appendPart(messageId, step.part)
      if (step.part.type === 'progress') {
        // Let the narrative play out before the next part lands.
        await sleep((step.part.steps.length) * (step.part.stepDelay || 900) + 200)
      }
    }
  }, [appendPart])

  const send = useCallback(async (rawText) => {
    const text = (rawText ?? input).trim()
    if (!text) return
    if (isLive) {
      if (live.busy || live.session.status !== 'ready') return
      setInput('')
      await live.send(text)
      return
    }
    if (busy) return
    setInput('')
    const userMsg = { id: nextId(), role: 'user', parts: [{ partId: nextId(), type: 'text', text }] }
    const assistantMsg = { id: nextId(), role: 'assistant', parts: [] }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setBusy(true)
    const ctx = { trust: trustRef.current, persona }
    const steps = matchScript(text, persona.id, ctx) || fallbackScript(persona.name)
    await runSteps(assistantMsg.id, steps)
    setBusy(false)
  }, [input, busy, persona, runSteps, isLive, live])

  // Approve / cancel on an action preview card. Live preview parts carry
  // `live: true` and route to /api/companion/confirm; scripted ones play
  // their canned continuation.
  const handleApprove = useCallback(async (messageId, part) => {
    if (part.live) {
      await live.confirmPending(messageId, part, 'confirm')
      return
    }
    updatePart(messageId, part.partId, { status: 'approved' })
    const continuation = CONTINUATIONS[part.continuation]
    if (continuation) {
      setBusy(true)
      await runSteps(messageId, continuation)
      setBusy(false)
    }
  }, [updatePart, runSteps, live])

  const handleCancel = useCallback((messageId, part) => {
    if (part.live) {
      live.confirmPending(messageId, part, 'cancel')
      return
    }
    updatePart(messageId, part.partId, { status: 'cancelled' })
    appendPart(messageId, { type: 'text', text: 'Cancelled — nothing was submitted. The draft is gone.' })
  }, [updatePart, appendPart, live])

  const handleUndo = useCallback((messageId, part) => {
    updatePart(messageId, part.partId, { undone: true })
    appendPart(messageId, { type: 'note', text: `Undone — ${part.reference} was withdrawn in ${part.system}. Nothing remains on file.` })
  }, [updatePart, appendPart])

  const trustRules = isLive
    ? Object.entries(live.trust).filter(([, v]) => v)
    : Object.entries(trust).filter(([, v]) => v)

  const liveUser = live.session.user
  const liveReady = live.session.status === 'ready'
  const chips = isLive
    ? (live.chips.length ? live.chips : ['What can you help me with?', 'Request time off', 'I need a new laptop'])
    : persona.chips
  const composerDisabled = isLive ? (live.busy || !liveReady) : busy

  return (
    <div className="min-h-[100dvh] bg-[#F5F5F7] flex justify-center">
      <div className="w-full max-w-[480px] h-[100dvh] flex flex-col bg-white sm:border-x sm:border-[#E5E7EB]">

        {/* ── Header ── */}
        <header className="shrink-0 border-b border-[#E5E7EB] bg-white z-20">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <Link to="/" className="p-1.5 -ml-1 text-[#6B7280] hover:text-[#111827]" aria-label="Back to gallery">
              <ArrowLeft size={17} />
            </Link>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: '#00C7B2' }}>
              <Sparkles size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-[#111827] leading-tight">Navigator</div>
              <div className="text-[10.5px] text-[#9CA3AF] leading-tight">One assistant — no expert picker</div>
            </div>
            {/* Mode toggle: scripted demo vs the live orchestrator */}
            <div className="inline-flex bg-[#F3F4F6] rounded-full p-0.5 shrink-0" role="tablist" aria-label="Chat mode">
              {[['scripted', 'Scripted demo'], ['live', 'Live']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setModeOverride(id)}
                  className={`px-2.5 py-1 text-[10.5px] font-bold rounded-full transition-colors ${
                    mode === id ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Persona switcher — scripted demo only (live mode uses the real session user) */}
            {!isLive && (
              <div className="relative">
                <select
                  value={persona.id}
                  onChange={(e) => switchPersona(e.target.value)}
                  className="appearance-none text-[11px] font-bold text-[#374151] bg-[#F3F4F6] border border-[#E5E7EB] rounded-full pl-3 pr-7 py-1.5 cursor-pointer outline-none max-w-[150px] truncate"
                  aria-label="Demo persona (scripted mode only)"
                  title="Persona switcher — affects the scripted demo only"
                >
                  {PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              </div>
            )}
          </div>

          {/* Context contract chip */}
          <button
            onClick={() => setContractOpen(!contractOpen)}
            className="w-full flex items-center gap-1.5 px-4 py-1.5 bg-[#F7FEFC] border-t border-[#E6FBF8] text-left"
          >
            <BadgeCheck size={12} className="shrink-0" style={{ color: TEAL }} />
            <span className="text-[11px] text-[#067A6E] font-semibold truncate">
              {isLive
                ? (liveReady
                    ? `Answering as: ${[liveUser?.displayName || liveUser?.name || liveUser?.email, liveUser?.department, liveUser?.title].filter(Boolean).join(' · ')}`
                    : live.session.status === 'checking' ? 'Connecting to your workspace…' : 'Live mode — sign in below')
                : `Answering as: ${persona.contractLine}`}
            </span>
            {contractOpen ? <ChevronUp size={12} className="ml-auto text-[#9CA3AF] shrink-0" /> : <ChevronDown size={12} className="ml-auto text-[#9CA3AF] shrink-0" />}
          </button>
          {contractOpen && (isLive
            ? <LiveContractPanel user={liveUser} />
            : <ContractPanel persona={persona} />)}
        </header>

        {/* ── Messages ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4 bg-[#FAFAFA]">
          {isLive && live.session.status === 'signed-out' && (
            <LiveSignInCard onSignIn={live.signIn} onFallback={() => setModeOverride('scripted')} />
          )}
          {isLive && liveReady && shownMessages.length === 0 && (
            <MessageBubble
              message={{ id: 'live-greeting', role: 'assistant', parts: [
                { partId: 'live-greeting-text', type: 'text', text: `Hi${liveUser?.displayName ? ` ${String(liveUser.displayName).split(' ')[0]}` : ''} — this is the live Navigator. I answer from your workspace's connected sources with citations, and I always show you exactly what I'd do before doing it.` },
                { partId: 'live-greeting-note', type: 'note', text: 'Live mode: real orchestrator, real tools, V2 trust moments.' },
              ] }}
              persona={persona} trust={live.trust} setTrust={live.setTrust}
              onApprove={() => {}} onCancel={() => {}} onUndo={() => {}}
              onSend={send} onReview={() => setReviewOpen(true)} updatePart={() => {}}
            />
          )}
          {shownMessages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              persona={persona}
              trust={isLive ? live.trust : trust}
              setTrust={isLive ? live.setTrust : setTrust}
              onApprove={(part) => handleApprove(m.id, part)}
              onCancel={(part) => handleCancel(m.id, part)}
              onUndo={(part) => handleUndo(m.id, part)}
              onSend={send}
              onReview={() => setReviewOpen(true)}
              onFlowInput={isLive ? (payload) => live.submitFlowInput(m.id, payload) : undefined}
              updatePart={(partId, patch) => updatePart(m.id, partId, patch)}
            />
          ))}
          {shownBusy && <TypingDots />}
        </div>

        {/* ── Composer ── */}
        <div className="shrink-0 border-t border-[#E5E7EB] bg-white px-3 pt-2 pb-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => send(c)}
                disabled={composerDisabled}
                className="shrink-0 text-[11.5px] font-semibold text-[#067A6E] bg-[#E6FBF8] hover:bg-[#D2F7F1] px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
              >
                {c}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); send() }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isLive && !liveReady ? 'Sign in to use live mode…' : 'Ask Navigator anything…'}
              className="flex-1 text-[13.5px] px-3.5 py-2.5 bg-[#F3F4F6] rounded-full outline-none focus:ring-2 focus:ring-[#00C7B2]/40 text-[#111827]"
            />
            <button
              type="submit"
              disabled={composerDisabled || !input.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-opacity"
              style={{ background: TEAL }}
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {reviewOpen && (
        <AutoApprovalsModal
          rules={trustRules}
          onRemove={(key) => (isLive ? live.setTrust(key, false) : setTrust(key, false))}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  )
}

function greetingMessage(persona) {
  return {
    id: nextId(), role: 'assistant',
    parts: [
      { partId: nextId(), type: 'text', text: persona.greeting },
      { partId: nextId(), type: 'note', text: 'Demo tip: the suggested questions below are scripted end-to-end.' },
    ],
  }
}

// ── Context contract panel ───────────────────────────────────────────────────

function ContractPanel({ persona }) {
  const [reported, setReported] = useState(false)
  return (
    <div className="px-4 py-3 bg-[#F7FEFC] border-t border-[#E6FBF8]">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#067A6E] mb-2">
        What Navigator knows about you
      </div>
      <div className="space-y-1.5">
        {persona.contract.map((c, i) => (
          <div key={i} className="flex items-baseline gap-2 text-[12px]">
            <span className="w-[68px] shrink-0 font-bold text-[#374151]">{c.label}</span>
            <span className="text-[#111827]">{c.value}</span>
            <span className="ml-auto text-[10px] text-[#9CA3AF] text-right">{c.source}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 pt-2.5 border-t border-[#E6FBF8] flex items-center justify-between gap-2">
        <p className="text-[10.5px] text-[#6B7280] leading-snug">
          These fields filter what I retrieve and parameterize what I do. Nothing else is used.
        </p>
        {reported ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#166534] shrink-0">
            <CircleCheck size={12} /> Flagged to HR data team
          </span>
        ) : (
          <button
            onClick={() => setReported(true)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B91C1C] hover:underline shrink-0"
          >
            <Flag size={11} /> Report wrong
          </button>
        )}
      </div>
    </div>
  )
}

// ── Message + part renderers ─────────────────────────────────────────────────

function MessageBubble({ message, persona, trust, setTrust, onApprove, onCancel, onUndo, onSend, onReview, onFlowInput, updatePart }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white" style={{ background: '#111827' }}>
          {message.parts[0]?.text}
        </div>
      </div>
    )
  }
  if (message.parts.length === 0) return null
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5" style={{ background: '#00C7B2' }}>
        <Sparkles size={13} />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {message.parts.map((part) => (
          <Part
            key={part.partId}
            part={part}
            persona={persona}
            trust={trust}
            setTrust={setTrust}
            onApprove={() => onApprove(part)}
            onCancel={() => onCancel(part)}
            onUndo={() => onUndo(part)}
            onSend={onSend}
            onReview={onReview}
            onFlowInput={onFlowInput}
            updatePart={updatePart}
          />
        ))}
      </div>
    </div>
  )
}

function Part(props) {
  const { part } = props
  switch (part.type) {
    case 'text':          return <TextPart part={part} />
    case 'note':          return <p className="text-[11px] text-[#9CA3AF] italic px-1">{part.text}</p>
    case 'citations':     return <Citations part={part} />
    case 'policyBadge':   return <PolicyBadge part={part} />
    case 'quote':         return <QuotePart part={part} />
    case 'progress':      return <ProgressNarrative part={part} />
    case 'preview':       return <PreviewCard {...props} />
    case 'receipt':       return <ReceiptCard {...props} />
    case 'trust':         return <TrustCheckbox {...props} />
    case 'autoApproved':  return <AutoApprovedNotice part={part} />
    case 'reviewAutoApprovals': return (
      <button onClick={props.onReview} className="text-[11.5px] font-bold hover:underline px-1" style={{ color: TEAL }}>
        Review my auto-approvals →
      </button>
    )
    case 'escalation':    return <EscalationCard part={part} />
    case 'handoff':       return <HandoffCard part={part} />
    case 'agentText':     return <AgentTextPart part={part} />
    case 'offers':        return <Offers part={part} onSend={props.onSend} />
    case 'engineRoom':    return <EngineRoom part={part} />
    // Live-mode parts (real orchestrator stream via src/ui/chat-adapter.js)
    case 'connect':       return <ConnectCard part={part} />
    case 'liveForm':      return <LiveFormCard part={part} onFlowInput={props.onFlowInput} updatePart={props.updatePart} />
    case 'liveConfirm':   return <LiveConfirmCard part={part} onFlowInput={props.onFlowInput} updatePart={props.updatePart} />
    case 'prepared':      return <PreparedCard part={part} />
    default:              return null
  }
}

function TextPart({ part }) {
  return (
    <div className="bg-white border border-[#EFEFF1] rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-sm">
      {part.heading && <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: TEAL }}>{part.heading}</div>}
      <p className="text-[13.5px] leading-relaxed text-[#1F2937] whitespace-pre-line">{part.text}</p>
    </div>
  )
}

function Citations({ part }) {
  return (
    <div className="bg-white border border-[#EFEFF1] rounded-xl px-3 py-2 shadow-sm space-y-1.5">
      {part.items.map((c, i) => (
        <a key={i} href="#" onClick={(e) => e.preventDefault()} className="flex items-start gap-2 group">
          <ExternalLink size={11} className="mt-1 shrink-0 text-[#9CA3AF] group-hover:text-[#00A593]" />
          <span className="text-[11.5px] leading-snug">
            <span className="font-semibold text-[#1D4ED8] group-hover:underline">{c.title}</span>
            <span className="text-[#9CA3AF]"> · {c.source} · {c.freshness}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

function PolicyBadge({ part }) {
  return (
    <div className="inline-flex items-start gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-3 py-2">
      <ShieldCheck size={13} className="text-[#B45309] mt-0.5 shrink-0" />
      <div>
        <div className="text-[11px] font-bold text-[#92400E]">{part.label}</div>
        {part.detail && <div className="text-[10.5px] text-[#A16207] leading-snug mt-0.5">{part.detail}</div>}
      </div>
    </div>
  )
}

function QuotePart({ part }) {
  return (
    <div className="bg-white border border-[#EFEFF1] rounded-2xl rounded-tl-md px-3.5 py-3 shadow-sm">
      <blockquote className="border-l-[3px] pl-3 text-[13px] leading-relaxed text-[#1F2937] italic" style={{ borderColor: TEAL }}>
        {part.text}
      </blockquote>
      <div className="text-[10.5px] text-[#9CA3AF] mt-2">{part.source}</div>
    </div>
  )
}

/**
 * Progress narrative — the employee-facing replacement for the intent
 * trace. Reveals plain-language steps one by one.
 */
function ProgressNarrative({ part }) {
  const [revealed, setRevealed] = useState(1)
  useEffect(() => {
    if (revealed >= part.steps.length) return
    const t = setTimeout(() => setRevealed((r) => r + 1), part.stepDelay || 900)
    return () => clearTimeout(t)
  }, [revealed, part.steps.length, part.stepDelay])

  return (
    <div className="bg-white border border-[#EFEFF1] rounded-xl px-3.5 py-2.5 shadow-sm space-y-1.5">
      {part.steps.slice(0, revealed).map((s, i) => {
        const isLast = i === revealed - 1
        const waiting = /waiting/i.test(s.label)
        const active = isLast && (revealed < part.steps.length || waiting)
        return (
          <div key={i} className="flex items-center gap-2">
            {active && !waiting
              ? <Loader2 size={12} className="animate-spin shrink-0" style={{ color: TEAL }} />
              : waiting && isLast
                ? <span className="w-3 h-3 rounded-full border-2 shrink-0 animate-pulse" style={{ borderColor: TEAL }} />
                : <Check size={12} className="shrink-0 text-[#16A34A]" />}
            <span className={`text-[12px] ${active ? 'text-[#111827] font-semibold' : 'text-[#6B7280]'}`}>{s.label}{active && !waiting ? '…' : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

function PreviewCard({ part, onApprove, onCancel, updatePart }) {
  const [editing, setEditing] = useState(false)
  const status = part.status || 'pending'

  function setField(idx, value) {
    const fields = part.fields.map((f, i) => i === idx ? { ...f, value } : f)
    updatePart(part.partId, { fields })
  }

  return (
    <div className={`border rounded-2xl shadow-sm overflow-hidden ${status === 'cancelled' ? 'opacity-50' : ''}`} style={{ borderColor: status === 'approved' ? '#BBF7D0' : '#99E8DE', background: 'white' }}>
      <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ background: status === 'approved' ? '#F0FDF4' : '#F7FEFC' }}>
        <Settings2 size={13} style={{ color: status === 'approved' ? '#16A34A' : TEAL }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: status === 'approved' ? '#166534' : '#067A6E' }}>
          Action preview · {part.system}
        </span>
      </div>
      <div className="px-3.5 py-3">
        <p className="text-[12.5px] text-[#374151] leading-snug mb-2.5">{part.title}</p>
        <div className="space-y-1.5">
          {part.fields.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="w-[96px] shrink-0 text-[#9CA3AF] font-semibold">{f.label}</span>
              {editing && f.editable && status === 'pending' ? (
                <input
                  value={f.value}
                  onChange={(e) => setField(i, e.target.value)}
                  className="flex-1 px-2 py-1 bg-white border border-[#99E8DE] rounded-md outline-none focus:border-[#00A593] text-[#111827] font-semibold"
                />
              ) : (
                <span className="text-[#111827] font-semibold">{f.value}{f.editable && status === 'pending' && <span className="text-[#C0C4CC] font-normal"> ✎</span>}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-2.5 text-[10.5px] text-[#9CA3AF]">
          <User size={10} /> Acting as you — under your own {part.system} permissions.
        </div>
      </div>
      {status === 'pending' && (
        <div className="px-3.5 py-2.5 border-t border-[#F3F4F6] flex items-center gap-2">
          <button onClick={onApprove} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-white" style={{ background: TEAL }}>
            <Check size={13} /> Approve
          </button>
          <button onClick={() => setEditing(!editing)} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-[12px] font-semibold text-[#374151] hover:border-[#00A593]">
            <Pencil size={12} className="inline mr-1" />{editing ? 'Done' : 'Edit'}
          </button>
          <button onClick={onCancel} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-[12px] font-semibold text-[#6B7280] hover:text-[#B91C1C] hover:border-[#FECACA]">
            Cancel
          </button>
        </div>
      )}
      {status === 'approved' && (
        <div className="px-3.5 py-2 border-t border-[#F3F4F6] text-[11px] font-bold text-[#166534] flex items-center gap-1.5">
          <CircleCheck size={12} /> Approved by you
        </div>
      )}
      {status === 'cancelled' && (
        <div className="px-3.5 py-2 border-t border-[#F3F4F6] text-[11px] font-bold text-[#9CA3AF] flex items-center gap-1.5">
          <X size={12} /> Cancelled
        </div>
      )}
    </div>
  )
}

function ReceiptCard({ part, onUndo }) {
  return (
    <div className="bg-white border border-[#BBF7D0] rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3.5 py-2.5 bg-[#F0FDF4] flex items-center gap-2">
        <CircleCheck size={13} className="text-[#16A34A]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#166534]">Receipt · {part.system}</span>
        <span className="ml-auto text-[10px] font-mono text-[#16A34A]">{part.reference}</span>
      </div>
      <div className="px-3.5 py-3">
        <div className="text-[13px] font-bold text-[#111827] mb-2">{part.title}</div>
        <div className="space-y-1">
          {part.lines.map((l, i) => (
            <div key={i} className="flex items-baseline gap-2 text-[12px]">
              <span className="w-[96px] shrink-0 text-[#9CA3AF] font-semibold">{l.label}</span>
              <span className="text-[#374151]">{l.value}</span>
            </div>
          ))}
        </div>
        {part.undo && (
          part.undone ? (
            <div className="mt-2.5 text-[11px] font-bold text-[#9CA3AF] flex items-center gap-1"><Undo2 size={11} /> Undone</div>
          ) : (
            <button onClick={onUndo} className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-bold hover:underline" style={{ color: TEAL }}>
              <Undo2 size={11} /> Undo this
            </button>
          )
        )}
      </div>
    </div>
  )
}

function TrustCheckbox({ part, trust, setTrust }) {
  const checked = !!trust[part.trustKey]
  return (
    <label className="flex items-start gap-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setTrust(part.trustKey, e.target.checked)}
        className="mt-0.5 accent-[#00A593]"
      />
      <span className="text-[12px] leading-snug text-[#374151]">
        <strong>{part.label}</strong>
        <span className="block text-[10.5px] text-[#9CA3AF] mt-0.5">
          You'll still get a receipt every time, and you can revoke this anytime.
          {checked && ' ✓ Saved — try the same request again.'}
        </span>
      </span>
    </label>
  )
}

function AutoApprovedNotice({ part }) {
  return (
    <div className="flex items-start gap-2 bg-[#E6FBF8] border border-[#99E8DE] rounded-xl px-3 py-2">
      <Zap size={12} className="mt-0.5 shrink-0" style={{ color: TEAL }} />
      <p className="text-[11.5px] leading-snug text-[#067A6E] font-semibold">{part.text}</p>
    </div>
  )
}

function EscalationCard({ part }) {
  return (
    <div className="bg-white border border-[#DDD6FE] rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3.5 py-2.5 bg-[#F5F3FF] flex items-center gap-2">
        <Route size={13} className="text-[#6D28D9]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6D28D9]">Routed to a human</span>
        <span className="ml-auto text-[10px] font-mono text-[#7C3AED]">{part.reference}</span>
      </div>
      <div className="px-3.5 py-3">
        <p className="text-[12.5px] text-[#374151] leading-snug">{part.text}</p>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-[#6B7280]">
          <span><strong className="text-[#111827]">{part.to}</strong></span>
          <span>·</span>
          <span>expected reply: {part.eta}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * A2A handoff marker — the employee always sees who is talking. In the
 * Studio, the agent is just another source card; here, the takeover and the
 * return are both labeled moments.
 */
function HandoffCard({ part }) {
  const returned = part.state === 'returned'
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3 py-2 border ${returned ? 'bg-[#F7FEFC] border-[#99E8DE]' : 'bg-[#EEF2FF] border-[#C7D2FE]'}`}>
      {returned ? <Sparkles size={12} className="mt-0.5 shrink-0" style={{ color: TEAL }} /> : <Bot size={12} className="mt-0.5 shrink-0 text-[#4338CA]" />}
      <div>
        <div className={`text-[10px] font-bold uppercase tracking-widest ${returned ? 'text-[#067A6E]' : 'text-[#4338CA]'}`}>
          {returned ? 'Back with Navigator' : `Handed over to ${part.agent}`}
        </div>
        <p className={`text-[11.5px] leading-snug mt-0.5 ${returned ? 'text-[#067A6E]' : 'text-[#4338CA]'}`}>{part.text}</p>
      </div>
    </div>
  )
}

function AgentTextPart({ part }) {
  return (
    <div className="bg-white border border-[#C7D2FE] rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#4338CA] mb-1">
        <Bot size={11} /> {part.agent}
      </div>
      <p className="text-[13.5px] leading-relaxed text-[#1F2937] whitespace-pre-line">{part.text}</p>
    </div>
  )
}

function Offers({ part, onSend }) {
  const [used, setUsed] = useState(false)
  return (
    <div className="flex flex-wrap gap-1.5">
      {part.buttons.map((b, i) => (
        <button
          key={i}
          disabled={used}
          onClick={() => { setUsed(true); onSend(b.send) }}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white px-3.5 py-2 rounded-full disabled:opacity-40 transition-opacity"
          style={{ background: TEAL }}
        >
          <Sparkles size={12} /> {b.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Engine room — the old-style developer trace, kept as a collapsed
 * disclosure for comparison. Employees never need it; demo audiences love it.
 */
function EngineRoom({ part }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="px-1">
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-[10px] font-mono text-[#C0C4CC] hover:text-[#9CA3AF]">
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />} engine room
      </button>
      {open && (
        <div className="mt-1 bg-[#111827] rounded-lg px-3 py-2 space-y-0.5">
          {part.lines.map((l, i) => (
            <div key={i} className="text-[10px] font-mono text-[#9CA3AF] leading-relaxed">{l}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-2 items-center">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: '#00C7B2' }}>
        <Sparkles size={13} />
      </div>
      <div className="bg-white border border-[#EFEFF1] rounded-2xl rounded-tl-md px-3.5 py-3 shadow-sm flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#C0C4CC] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  )
}

// ── Live-mode components ─────────────────────────────────────────────────────

/** Context contract from the real session user — same panel, live facts. */
function LiveContractPanel({ user }) {
  const rows = [
    { label: 'Name', value: user?.displayName || user?.name || '—', source: 'Staffbase profile' },
    { label: 'Email', value: user?.email || '—', source: 'Staffbase profile' },
    { label: 'Role', value: user?.title || '—', source: 'Staffbase profile' },
    { label: 'Team', value: user?.department || '—', source: 'Staffbase profile' },
  ]
  return (
    <div className="px-4 py-3 bg-[#F7FEFC] border-t border-[#E6FBF8]">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#067A6E] mb-2">
        What Navigator knows about you (live session)
      </div>
      <div className="space-y-1.5">
        {rows.map((c, i) => (
          <div key={i} className="flex items-baseline gap-2 text-[12px]">
            <span className="w-[68px] shrink-0 font-bold text-[#374151]">{c.label}</span>
            <span className="text-[#111827]">{c.value}</span>
            <span className="ml-auto text-[10px] text-[#9CA3AF] text-right">{c.source}</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 pt-2.5 border-t border-[#E6FBF8] text-[10.5px] text-[#6B7280] leading-snug">
        These fields come from your real workspace session and parameterize what Navigator retrieves and does.
      </p>
    </div>
  )
}

/** Email sign-in for live mode — same auth path the V1 Companion uses. */
function LiveSignInCard({ onSignIn, onFallback }) {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  async function submit(e) {
    e.preventDefault()
    if (!email.trim() || pending) return
    setPending(true); setError(null)
    try { await onSignIn(email.trim()) }
    catch (err) { setError(err.detail || err.message || 'Sign-in failed') }
    finally { setPending(false) }
  }
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm px-4 py-4 max-w-[360px] mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <User size={14} style={{ color: TEAL }} />
        <span className="text-[13px] font-bold text-[#111827]">Sign in for live mode</span>
      </div>
      <p className="text-[11.5px] text-[#6B7280] leading-snug mb-3">
        Live mode streams real orchestrator turns against your workspace. Sign in with your Staffbase directory email.
      </p>
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          type="email"
          className="flex-1 text-[12.5px] px-3 py-2 bg-[#F3F4F6] rounded-lg outline-none focus:ring-2 focus:ring-[#00C7B2]/40"
        />
        <button type="submit" disabled={pending || !email.trim()} className="px-3 py-2 rounded-lg text-[12px] font-bold text-white disabled:opacity-40" style={{ background: TEAL }}>
          {pending ? '…' : 'Sign in'}
        </button>
      </form>
      {error && <p className="text-[11px] text-[#B91C1C] mt-2">{error}</p>}
      <button onClick={onFallback} className="mt-2.5 text-[11px] font-semibold text-[#6B7280] hover:underline">
        Server unreachable? Switch to the scripted demo →
      </button>
    </div>
  )
}

/** JIT connection affordance — replaces a raw auth error / needs_connection. */
function ConnectCard({ part }) {
  return (
    <div className="space-y-2">
      {(part.connectors || []).map((c) => (
        <div key={c.provider || c.id} className="bg-white border border-[#99E8DE] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-3.5 py-2.5 bg-[#F7FEFC] flex items-center gap-2">
            <Plug size={13} style={{ color: TEAL }} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#067A6E]">Connection needed</span>
          </div>
          <div className="px-3.5 py-3">
            <div className="text-[13px] font-bold text-[#111827]">{c.name}</div>
            {c.description && <p className="text-[11.5px] text-[#6B7280] leading-snug mt-0.5">{c.description}</p>}
            <a
              href={c.connectUrl}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-white"
              style={{ background: TEAL }}
            >
              <Plug size={12} /> Connect {c.name}
            </a>
            <p className="text-[10.5px] text-[#9CA3AF] mt-2">One tap — Navigator acts under your own {c.name} permissions afterwards.</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Inline form for a paused flow step (live mode). */
function LiveFormCard({ part, onFlowInput, updatePart }) {
  const spec = part.spec || {}
  const [values, setValues] = useState(() => ({ ...(part.initialValues || {}) }))
  const submitted = part.submitted
  function setField(id, v) { setValues((prev) => ({ ...prev, [id]: v })) }
  function submit(e) {
    e.preventDefault()
    if (submitted || !onFlowInput) return
    updatePart?.(part.partId, { submitted: true, values })
    onFlowInput({ formSubmission: { flowId: part.flowId, stepId: part.stepId, values } })
  }
  return (
    <form onSubmit={submit} className={`bg-white border border-[#99E8DE] rounded-2xl shadow-sm overflow-hidden ${submitted ? 'opacity-60' : ''}`}>
      <div className="px-3.5 py-2.5 bg-[#F7FEFC] flex items-center gap-2">
        <FileText size={13} style={{ color: TEAL }} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#067A6E]">{spec.title || 'A few details'}</span>
      </div>
      <div className="px-3.5 py-3 space-y-2.5">
        {spec.description && <p className="text-[11.5px] text-[#6B7280] leading-snug">{spec.description}</p>}
        {(spec.fields || []).map((f) => (
          <label key={f.id} className="block">
            <span className="block text-[11px] font-bold text-[#374151] mb-1">{f.label}{f.required && ' *'}</span>
            {f.type === 'textarea' ? (
              <textarea
                value={values[f.id] ?? ''}
                onChange={(e) => setField(f.id, e.target.value)}
                disabled={submitted}
                rows={2}
                className="w-full text-[12.5px] px-2.5 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg outline-none focus:border-[#00A593]"
              />
            ) : (f.type === 'select' || f.type === 'radio') && Array.isArray(f.options) ? (
              <select
                value={values[f.id] ?? ''}
                onChange={(e) => setField(f.id, e.target.value)}
                disabled={submitted}
                className="w-full text-[12.5px] px-2.5 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg outline-none focus:border-[#00A593]"
              >
                <option value="">Choose…</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'}
                value={values[f.id] ?? ''}
                onChange={(e) => setField(f.id, e.target.value)}
                disabled={submitted}
                placeholder={f.placeholder || ''}
                className="w-full text-[12.5px] px-2.5 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg outline-none focus:border-[#00A593]"
              />
            )}
          </label>
        ))}
        {!submitted ? (
          <button type="submit" className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-white" style={{ background: TEAL }}>
            {spec.submitLabel || 'Submit'}
          </button>
        ) : (
          <div className="text-[11px] font-bold text-[#166534] flex items-center gap-1.5"><CircleCheck size={12} /> Sent</div>
        )}
      </div>
    </form>
  )
}

/** Inline confirm step for a paused flow (live mode). */
function LiveConfirmCard({ part, onFlowInput, updatePart }) {
  const summary = part.summary || {}
  const decided = part.decided
  function decide(accepted) {
    if (decided || !onFlowInput) return
    updatePart?.(part.partId, { decided: accepted ? 'confirmed' : 'cancelled' })
    onFlowInput({ confirmResponse: { flowId: part.flowId, stepId: part.stepId, accepted, cancelTo: summary.cancelTo } })
  }
  return (
    <div className={`bg-white border border-[#99E8DE] rounded-2xl shadow-sm overflow-hidden ${decided === 'cancelled' ? 'opacity-60' : ''}`}>
      <div className="px-3.5 py-2.5 bg-[#F7FEFC] flex items-center gap-2">
        <ShieldCheck size={13} style={{ color: TEAL }} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#067A6E]">{summary.title || 'Confirm'}</span>
      </div>
      <div className="px-3.5 py-3">
        {summary.description && <p className="text-[11.5px] text-[#6B7280] leading-snug mb-2">{summary.description}</p>}
        <div className="space-y-1.5">
          {(summary.rows || []).map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="w-[96px] shrink-0 text-[#9CA3AF] font-semibold">{r.label}</span>
              <span className="text-[#111827] font-semibold">{r.value}</span>
            </div>
          ))}
        </div>
        {!decided ? (
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => decide(true)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-white" style={{ background: TEAL }}>
              <Check size={13} /> {summary.confirmLabel || 'Confirm'}
            </button>
            <button onClick={() => decide(false)} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-[12px] font-semibold text-[#6B7280] hover:text-[#B91C1C] hover:border-[#FECACA]">
              {summary.cancelLabel || 'Cancel'}
            </button>
          </div>
        ) : (
          <div className={`mt-3 text-[11px] font-bold flex items-center gap-1.5 ${decided === 'confirmed' ? 'text-[#166534]' : 'text-[#9CA3AF]'}`}>
            {decided === 'confirmed' ? <><CircleCheck size={12} /> Confirmed</> : <><X size={12} /> Cancelled</>}
          </div>
        )}
      </div>
    </div>
  )
}

/** Trigger-tier outcome — the prepared payload, handed off, NOT executed. */
function PreparedCard({ part }) {
  return (
    <div className="bg-white border border-[#C7D2FE] rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3.5 py-2.5 bg-[#EEF2FF] flex items-center gap-2">
        <FileText size={13} className="text-[#4338CA]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#4338CA]">Prepared — not executed · {part.system}</span>
      </div>
      <div className="px-3.5 py-3">
        <div className="text-[13px] font-bold text-[#111827] mb-1.5">{part.name}</div>
        <div className="space-y-1">
          {Object.entries(part.payload || {}).map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2 text-[12px]">
              <span className="w-[96px] shrink-0 text-[#9CA3AF] font-semibold">{k.replace(/[_-]/g, ' ')}</span>
              <span className="text-[#374151] break-all">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
            </div>
          ))}
        </div>
        <p className="text-[10.5px] text-[#6B7280] leading-snug mt-2.5">
          Trigger-tier action: Navigator drafted this, but a human submits it in {part.system}. Nothing has been written anywhere.
        </p>
      </div>
    </div>
  )
}

function AutoApprovalsModal({ rules, onRemove, onClose }) {
  const LABELS = { timeOffUnder3: 'Time-off requests (under 3 days) — submit without asking' }
  const pretty = (key) => LABELS[key]
    || `${key.split('__').pop().replace(/[_-]/g, ' ')}${key.includes('__') ? ` (${key.split('__')[0].replace(/^v2-/, '')})` : ''} — run without asking`
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center gap-2">
          <Zap size={15} style={{ color: TEAL }} />
          <span className="text-[14px] font-bold text-[#111827] flex-1">Your auto-approvals</span>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#111827]" aria-label="Close"><X size={15} /></button>
        </div>
        <div className="px-5 py-4">
          {rules.length === 0 ? (
            <p className="text-[12.5px] text-[#6B7280]">No auto-approval rules. Every action will show you a preview first.</p>
          ) : (
            <div className="space-y-2">
              {rules.map(([key]) => (
                <div key={key} className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2.5">
                  <span className="text-[12px] text-[#374151] flex-1">{pretty(key)}</span>
                  <button onClick={() => onRemove(key)} className="text-[11px] font-bold text-[#B91C1C] hover:underline shrink-0">Revoke</button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10.5px] text-[#9CA3AF] mt-3 leading-snug">
            Scoped per action type and only for you. Receipts are always kept — auto-approval skips the question, never the record.
          </p>
        </div>
      </div>
    </div>
  )
}
