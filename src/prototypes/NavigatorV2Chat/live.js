// Live engine for Navigator V2 — Employee Chat.
//
// Streams real orchestrator turns from /api/companion/chat (NDJSON), routes
// every event through the shared chat adapter (src/ui/chat-adapter.js —
// the stable RenderItem seam; NO orchestrator internals are parsed here),
// then reduces RenderItems into the same `part` schema the scripted demo
// renders. The V2 components (citations, progress narrative, preview /
// receipt cards, trust checkboxes, engine room) draw both modes.
//
// Trust ladder is client-side only: per user + per tool, persisted in
// localStorage. When set, the confirmation auto-sends and the compact
// auto-approved notice + receipt render instead of the preview card.

import { useCallback, useEffect, useRef, useState } from 'react'
import { adaptEvent, KINDS } from '../../ui/chat-adapter'
import { getMe, signInWithEmail, createConversation, streamPost } from '../StaffbaseCompanion/api'

let _lid = 0
const nid = () => `lv${++_lid}`

function withBranch(url, branchId) {
  if (!branchId) return url
  return `${url}${url.includes('?') ? '&' : '?'}branch=${encodeURIComponent(branchId)}`
}

// ── Trust ladder persistence (per user + tool) ──────────────────────────────

function trustKeyFor(userId) {
  return `navigatorV2Chat.liveTrust.${userId || 'anon'}`
}
export function loadLiveTrust(userId) {
  try { return JSON.parse(window.localStorage.getItem(trustKeyFor(userId))) || {} } catch { return {} }
}
export function saveLiveTrust(userId, map) {
  try { window.localStorage.setItem(trustKeyFor(userId), JSON.stringify(map)) } catch { /* noop */ }
}

// ── Plain-language relabeling of trace/tool events ──────────────────────────

function friendly(name) {
  return String(name || '').replace(/[_-]/g, ' ').trim()
}

function progressLabelForTool(props) {
  const sys = props.connectorName || props.connector || 'a source'
  const tool = friendly(props.name)
  if (/search|find|lookup|look up|list|get|check/i.test(tool)) return `Checking ${sys}`
  return `Working in ${sys} — ${tool}`
}

// Extract a trailing <suggestions>["...",...]</suggestions> block.
export function splitSuggestions(text) {
  const m = String(text || '').match(/<suggestions>\s*(\[[\s\S]*?\])\s*<\/suggestions>/i)
  if (!m) return { text: String(text || '').trim(), suggestions: [] }
  let suggestions = []
  try { suggestions = JSON.parse(m[1]).filter((s) => typeof s === 'string') } catch { /* ignore */ }
  return { text: String(text || '').replace(m[0], '').trim(), suggestions }
}

// ── The hook ────────────────────────────────────────────────────────────────

export function useLiveNavigator(branchId, enabled) {
  // session.status: checking | signed-out | ready | unavailable
  const [session, setSession] = useState({ status: 'checking', user: null })
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [chips, setChips] = useState([])
  const [trust, setTrustState] = useState({})
  const convoRef = useRef(null)
  const trustRef = useRef({})
  const userIdRef = useRef(null)

  useEffect(() => { trustRef.current = trust }, [trust])

  // ── Session + hero (chips from the live config) ───────────────────────
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      const me = await getMe(branchId).catch(() => null)
      if (cancelled) return
      if (!me || me.mismatch) { setSession({ status: 'signed-out', user: null }); return }
      const user = me.user || me
      userIdRef.current = user.id || user.email || 'anon'
      setSession({ status: 'ready', user })
      setTrustState(loadLiveTrust(userIdRef.current))
      try {
        const resp = await fetch(withBranch('/api/companion/hero', branchId), { credentials: 'same-origin' })
        const ct = resp.headers.get('content-type') || ''
        if (resp.ok && ct.includes('application/json')) {
          const hero = await resp.json()
          if (!cancelled) {
            const wf = (hero.workflows || []).slice(0, 3).map((w) => w.name)
            const ex = (hero.experts || []).slice(0, 2).map((a) => a.description || `Ask about ${a.name}`)
            setChips([...wf, ...ex].filter(Boolean).slice(0, 4))
          }
        }
      } catch { /* hero is optional */ }
    })()
    return () => { cancelled = true }
  }, [branchId, enabled])

  const signIn = useCallback(async (email) => {
    const user = await signInWithEmail(email, branchId)
    userIdRef.current = user?.id || email
    setSession({ status: 'ready', user })
    setTrustState(loadLiveTrust(userIdRef.current))
    return user
  }, [branchId])

  const setTrust = useCallback((key, value) => {
    setTrustState((prev) => {
      const next = { ...prev, [key]: value }
      saveLiveTrust(userIdRef.current, next)
      return next
    })
  }, [])

  // ── Message/part plumbing (same shapes as the scripted engine) ────────
  const appendMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg])
    return msg.id
  }, [])
  const appendPart = useCallback((messageId, part) => {
    const withId = { ...part, partId: nid() }
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, parts: [...m.parts, withId] } : m))
    return withId.partId
  }, [])
  const updatePart = useCallback((messageId, partId, patch) => {
    setMessages((prev) => prev.map((m) => m.id !== messageId ? m : {
      ...m,
      parts: m.parts.map((p) => p.partId === partId ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p),
    }))
  }, [])

  // ── Turn reducer: RenderItems → V2 parts ──────────────────────────────
  // Per assistant turn we keep cursors into the growing message: the
  // streaming text part, the progress-narrative part, the citations part,
  // and the engine-room raw line buffer.
  function makeTurnState(messageId) {
    return {
      messageId,
      textPartId: null,
      text: '',
      progressPartId: null,
      progressSteps: [],
      citationsPartId: null,
      citations: [],
      engineLines: [],
      sawPending: false,
      // Set when a trusted (auto-approved) write was pending — the caller
      // sends the confirmation AFTER the stream closes, because the server
      // persists the pendingConfirmation row right before `done`.
      autoConfirm: false,
    }
  }

  const pushProgress = useCallback((turn, label) => {
    if (!label) return
    if (turn.progressSteps.some((s) => s.label === label)) return
    turn.progressSteps = [...turn.progressSteps, { label }]
    if (!turn.progressPartId) {
      turn.progressPartId = appendPart(turn.messageId, { type: 'progress', stepDelay: 250, steps: turn.progressSteps })
    } else {
      updatePart(turn.messageId, turn.progressPartId, { steps: turn.progressSteps })
    }
  }, [appendPart, updatePart])

  const flushText = useCallback((turn) => {
    const { text, suggestions } = splitSuggestions(turn.text)
    if (turn.textPartId) {
      updatePart(turn.messageId, turn.textPartId, { text })
    }
    if (suggestions.length) {
      appendPart(turn.messageId, { type: 'offers', buttons: suggestions.map((s) => ({ label: s, send: s })) })
    }
  }, [appendPart, updatePart])

  // Forward-declared so handleItem can trigger auto-approval.
  const confirmRef = useRef(null)

  const handleItem = useCallback((turn, item, rawEvent) => {
    switch (item.kind) {
      case KINDS.ASSISTANT_MESSAGE: {
        const delta = item.props?.delta
        if (!delta) return
        turn.text += delta
        if (!turn.textPartId) {
          turn.textPartId = appendPart(turn.messageId, { type: 'text', text: turn.text })
        } else {
          // Hide a trailing <suggestions> block while it streams in.
          updatePart(turn.messageId, turn.textPartId, { text: splitSuggestions(turn.text).text })
        }
        return
      }
      case KINDS.TRACE: {
        const route = item.props?.route || {}
        turn.engineLines.push(JSON.stringify(route).slice(0, 280))
        if (route.type === 'trace_route') {
          const kind = route.tier1?.kind
          if (kind === 'flow') pushProgress(turn, 'Recognized this as a process')
          else if (kind === 'general_chat') pushProgress(turn, 'Thinking it through')
          else pushProgress(turn, 'Composing the right sources & policy')
        }
        return
      }
      case KINDS.TOOL_CALL: {
        if (item.props?.status === 'running') {
          pushProgress(turn, progressLabelForTool(item.props))
          turn.engineLines.push(`tool_start: ${item.props.connector}.${item.props.name} ${JSON.stringify(item.props.args || {}).slice(0, 160)}`)
        } else {
          turn.engineLines.push(`tool_result: ${item.props?.name} → ${JSON.stringify(item.props?.result ?? null).slice(0, 200)}`)
          // JIT seam (cheap version): a tool that failed because the USER
          // hasn't linked the system → connect card instead of a raw error.
          const err = item.props?.result?.error
          if (typeof err === 'string' && /not[\s_-]?connected|connect .*account|no .*connection|unauthorized|401/i.test(err)) {
            const provider = /atlassian|jira|confluence/i.test(`${item.props.connector} ${err}`) ? 'atlassian' : null
            if (provider) {
              appendPart(turn.messageId, {
                type: 'connect',
                connectors: [{
                  name: 'Atlassian', provider,
                  description: 'Link your own Atlassian account so this action can run as you.',
                  connectUrl: `/api/connections/${provider}/connect`,
                }],
              })
            }
          }
        }
        return
      }
      case KINDS.CITATION: {
        const c = item.props
        const entry = { source: `${c.name}${c.source ? ` (${c.source})` : ''}`, title: c.docTitle || c.name, freshness: 'live' }
        if (turn.citations.some((x) => x.title === entry.title)) return
        turn.citations = [...turn.citations, entry]
        if (!turn.citationsPartId) {
          turn.citationsPartId = appendPart(turn.messageId, { type: 'citations', items: turn.citations })
        } else {
          updatePart(turn.messageId, turn.citationsPartId, { items: turn.citations })
        }
        return
      }
      case KINDS.FLOW_CARD: {
        const p = item.props || {}
        if (p.type === 'flow_started') pushProgress(turn, `Starting “${p.name}”`)
        if (p.type === 'flow_step' && p.label) pushProgress(turn, p.label)
        if (p.type === 'flow_completed') pushProgress(turn, 'Process completed')
        turn.engineLines.push(JSON.stringify(p).slice(0, 200))
        return
      }
      case KINDS.FORM: {
        pushProgress(turn, 'Waiting for your input')
        appendPart(turn.messageId, { type: 'liveForm', ...item.props })
        return
      }
      case KINDS.CONFIRM_SUMMARY: {
        pushProgress(turn, 'Waiting for your confirmation')
        appendPart(turn.messageId, { type: 'liveConfirm', ...item.props })
        return
      }
      case KINDS.TOOL_PENDING: {
        turn.sawPending = true
        const p = item.props
        const toolKey = `${p.connector}__${p.name}`
        const trusted = !!trustRef.current[toolKey]
        const fields = Object.entries(p.args || {}).map(([k, v]) => ({
          label: friendly(k),
          value: typeof v === 'string' ? v : JSON.stringify(v),
        }))
        if (trusted) {
          // Trust ladder: auto-send the confirmation, render the compact
          // notice — the receipt arrives on the confirm stream.
          pushProgress(turn, `Auto-approved (your rule) — running in ${p.connectorName}`)
          appendPart(turn.messageId, {
            type: 'autoApproved',
            text: `Auto-approved under your rule for “${friendly(p.name)}” — submitted to ${p.connectorName}, acting as you.`,
          })
          appendPart(turn.messageId, { type: 'reviewAutoApprovals' })
          turn.autoConfirm = true
        } else {
          pushProgress(turn, 'Waiting for your confirmation')
          appendPart(turn.messageId, {
            type: 'preview',
            live: true,
            toolCallId: p.toolCallId,
            tier: p.tier || null,
            toolKey,
            system: p.connectorName || p.connector,
            title: p.tier === 'trigger'
              ? `Here’s the request I’ve prepared for ${p.connectorName || p.connector} — you approve, a human submits it:`
              : `Here’s exactly what I’ll submit to ${p.connectorName || p.connector}, acting as you:`,
            fields,
          })
        }
        turn.engineLines.push(`tool_call_pending: ${toolKey} tier=${p.tier || 'default'} ${JSON.stringify(p.args || {}).slice(0, 160)}`)
        return
      }
      case KINDS.PREPARED: {
        const p = item.props
        appendPart(turn.messageId, {
          type: 'prepared',
          system: p.connectorName || p.connector,
          name: friendly(p.name),
          payload: p.payload || {},
          preparedAt: p.preparedAt,
        })
        pushProgress(turn, 'Prepared — handed to a human to submit')
        return
      }
      case KINDS.RECEIPT: {
        const p = item.props
        appendPart(turn.messageId, {
          type: 'receipt',
          title: p.summary || `${friendly(p.name)} done`,
          system: p.connectorName || p.connector,
          reference: p.referenceId || '—',
          lines: [
            { label: 'Action', value: friendly(p.name) },
            { label: 'When', value: p.ts ? new Date(p.ts).toLocaleTimeString() : 'just now' },
          ],
          undo: false,
        })
        return
      }
      case KINDS.NEEDS_CONNECTION: {
        appendPart(turn.messageId, { type: 'connect', connectors: item.props?.connectors || [] })
        return
      }
      case KINDS.AGENT_HANDOFF: {
        const p = item.props || {}
        appendPart(turn.messageId, {
          type: 'handoff',
          state: 'active',
          agent: p.agentName || p.agentId || 'External agent',
          text: p.message ? `Handed over with: “${String(p.message).slice(0, 140)}”` : 'An external agent has taken this over.',
        })
        return
      }
      case KINDS.REFUSAL: {
        appendPart(turn.messageId, { type: 'text', text: item.props?.message || 'That’s outside what I can help with.' })
        return
      }
      case KINDS.ERROR: {
        appendPart(turn.messageId, { type: 'note', text: `Something went wrong: ${item.props?.message || 'unknown error'}` })
        return
      }
      default: {
        if (rawEvent?.type) turn.engineLines.push(`${rawEvent.type}: ${JSON.stringify(rawEvent).slice(0, 160)}`)
      }
    }
  }, [appendPart, updatePart, pushProgress])

  const finishTurn = useCallback((turn) => {
    flushText(turn)
    if (turn.engineLines.length) {
      appendPart(turn.messageId, { type: 'engineRoom', lines: turn.engineLines.slice(0, 24) })
    }
  }, [appendPart, flushText])

  // ── Streaming ─────────────────────────────────────────────────────────
  const streamTurn = useCallback(async (url, body, messageId) => {
    const turn = makeTurnState(messageId)
    await streamPost(withBranch(url, branchId), body, (evt) => {
      // The adapter is the seam: raw NDJSON event → RenderItems.
      for (const item of adaptEvent(evt)) handleItem(turn, item, evt)
      if (evt.type === 'done' || evt.type === 'truncated') finishTurn(turn)
    })
    return turn
  }, [branchId, handleItem, finishTurn])

  const ensureConversation = useCallback(async () => {
    if (convoRef.current) return convoRef.current
    const convo = await createConversation('Navigator V2 live chat', branchId)
    convoRef.current = convo.id
    return convo.id
  }, [branchId])

  const send = useCallback(async (text) => {
    if (!text || busy || session.status !== 'ready') return
    setBusy(true)
    const userMsg = { id: nid(), role: 'user', parts: [{ partId: nid(), type: 'text', text }] }
    const assistantMsg = { id: nid(), role: 'assistant', parts: [] }
    appendMessage(userMsg)
    appendMessage(assistantMsg)
    try {
      const conversationId = await ensureConversation()
      const turn = await streamTurn('/api/companion/chat', { conversationId, message: text }, assistantMsg.id)
      if (turn.autoConfirm) {
        await confirmRef.current?.(assistantMsg.id, null, 'confirm', { auto: true })
      }
    } catch (err) {
      appendPart(assistantMsg.id, { type: 'note', text: `Live chat failed: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }, [busy, session.status, appendMessage, appendPart, ensureConversation, streamTurn])

  // Flow form / confirm submissions resume the paused step machine.
  const submitFlowInput = useCallback(async (messageId, payload) => {
    if (session.status !== 'ready') return
    setBusy(true)
    try {
      const conversationId = await ensureConversation()
      await streamTurn('/api/companion/chat', { conversationId, ...payload }, messageId)
    } catch (err) {
      appendPart(messageId, { type: 'note', text: `Submission failed: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }, [session.status, ensureConversation, streamTurn, appendPart])

  // Approve/cancel a pending write. `part` is null on trust-ladder auto-runs.
  const confirmPending = useCallback(async (messageId, part, decision, opts = {}) => {
    if (session.status !== 'ready') return
    if (part) updatePart(messageId, part.partId, { status: decision === 'confirm' ? 'approved' : 'cancelled', fieldsLocked: true })
    if (decision === 'cancel') {
      appendPart(messageId, { type: 'note', text: 'Cancelled — nothing was submitted.' })
    }
    setBusy(true)
    try {
      const conversationId = await ensureConversation()
      const turn = await streamTurn('/api/companion/confirm', { conversationId, decision }, messageId)
      // Trust-ladder offer: after a manually approved EXECUTE-tier action,
      // offer "don't ask again" for this tool. Trigger-tier prepares and
      // untiered (V1 default) writes never auto-approve.
      if (decision === 'confirm' && !opts.auto && part?.tier === 'execute' && part.toolKey && !trustRef.current[part.toolKey]) {
        appendPart(messageId, {
          type: 'trust',
          trustKey: part.toolKey,
          label: `Don’t ask again for “${friendly(part.toolKey.split('__')[1] || part.toolKey)}” in ${part.system}`,
        })
      }
      void turn
    } catch (err) {
      appendPart(messageId, { type: 'note', text: `Confirmation failed: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }, [session.status, ensureConversation, streamTurn, appendPart, updatePart])

  useEffect(() => { confirmRef.current = confirmPending }, [confirmPending])

  const reset = useCallback(() => {
    convoRef.current = null
    setMessages([])
  }, [])

  return {
    session, signIn,
    messages, busy, chips,
    send, submitFlowInput, confirmPending,
    trust, setTrust,
    reset,
  }
}
