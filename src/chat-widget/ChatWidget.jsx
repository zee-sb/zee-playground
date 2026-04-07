import { useState, useRef, useEffect, useCallback } from 'react'
import { Message } from './Message.jsx'
import { TypingIndicator } from './TypingIndicator.jsx'
import { SuggestionChips } from './SuggestionChips.jsx'
import { ChatInput } from './ChatInput.jsx'
import { matchScenario, defaultScenarios } from './scenarios.js'
import './styles.css'

let msgIdCounter = 0
function nextId() { return ++msgIdCounter }

function FloatingBar({ agentAvatar, agentName, onOpen, unreadCount }) {
  return (
    <div className="cw-floating-bar">
      <div className="cw-floating-inner" onClick={onOpen}>
        <div className="cw-floating-avatar">
          {agentAvatar}
          {unreadCount > 0 && <span className="cw-floating-badge">{unreadCount}</span>}
        </div>
        <span className="cw-floating-placeholder">Ask {agentName} anything…</span>
        <button className="cw-floating-send" onClick={onOpen} aria-label="Open chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function WelcomeState({ agentAvatar, agentName, agentSubtitle, suggestions, onSuggestion }) {
  return (
    <div className="cw-welcome">
      <div className="cw-welcome-avatar-wrap">
        <div className="cw-welcome-avatar">{agentAvatar}</div>
        <div className="cw-welcome-online-dot" />
      </div>
      <div className="cw-welcome-name">{agentName}</div>
      <div className="cw-welcome-subtitle">{agentSubtitle || 'Your AI assistant. Ask me anything.'}</div>
      {suggestions && suggestions.length > 0 && (
        <>
          <div className="cw-welcome-divider-text">Quick actions</div>
          <div className="cw-welcome-chips">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="cw-suggestion-chip"
                onClick={() => onSuggestion(typeof s === 'string' ? s : s.label)}
              >
                {typeof s === 'object' && s.icon && <span className="cw-chip-icon">{s.icon}</span>}
                {typeof s === 'string' ? s : s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function ChatWidget({
  agentName = 'Navigator',
  agentSubtitle = 'Your AI work assistant · Always available',
  agentAvatar = '🔮',
  theme = {},
  initialMessages = [],
  scenarios = defaultScenarios,
  suggestions = [
    { icon: '🌴', label: 'Request leave' },
    { icon: '💻', label: 'IT support' },
    { icon: '💳', label: 'Submit expense' },
    { icon: '📄', label: 'HR policies' },
    { icon: '💰', label: 'My payslip' },
  ],
  onMinimize,
  isOpen: controlledIsOpen,
  onOpenChange,
  defaultOpen = false,
  _onSendRef,
}) {
  const primary = theme.primary || '#7B5CE3'
  const [isOpen, setIsOpen] = useState(controlledIsOpen ?? defaultOpen)
  const [messages, setMessages] = useState(() =>
    initialMessages.map(m => ({ ...m, id: nextId() }))
  )
  const [isTyping, setIsTyping] = useState(false)
  const [activeSuggestions, setActiveSuggestions] = useState([])
  const [pendingScenario, setPendingScenario] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef(null)
  const scenarioTimersRef = useRef([])

  // Sync controlled open state
  useEffect(() => {
    if (controlledIsOpen !== undefined) setIsOpen(controlledIsOpen)
  }, [controlledIsOpen])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Clear unread on open
  useEffect(() => {
    if (isOpen) setUnreadCount(0)
  }, [isOpen])

  // CSS custom property for theme
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--cw-primary', primary)
  }, [primary])

  function open() {
    setIsOpen(true)
    onOpenChange?.(true)
  }

  function close() {
    setIsOpen(false)
    onOpenChange?.(false)
    onMinimize?.()
  }

  function addMessage(msg) {
    const newMsg = { ...msg, id: nextId(), timestamp: Date.now() }
    setMessages(prev => [...prev, newMsg])
    if (!isOpen && msg.role === 'ai') {
      setUnreadCount(c => c + 1)
    }
    return newMsg
  }

  function clearScenarioTimers() {
    scenarioTimersRef.current.forEach(t => clearTimeout(t))
    scenarioTimersRef.current = []
  }

  function playScenarioMessages(msgList, onDone) {
    clearScenarioTimers()
    let totalDelay = 0
    msgList.forEach((msg, index) => {
      const typingDelay = totalDelay
      const typingDuration = msg.delay || (msg.role === 'ai' ? 900 : 300)
      const msgDelay = totalDelay + typingDuration

      if (msg.role === 'ai') {
        const t1 = setTimeout(() => setIsTyping(true), typingDelay)
        const t2 = setTimeout(() => {
          setIsTyping(false)
          addMessage(msg)
          if (index === msgList.length - 1) onDone?.()
        }, msgDelay)
        scenarioTimersRef.current.push(t1, t2)
      } else {
        const t = setTimeout(() => addMessage(msg), msgDelay)
        scenarioTimersRef.current.push(t)
      }

      totalDelay = msgDelay + 300
    })
  }

  function handleAction(event) {
    if (event.type === 'form_submit') {
      if (pendingScenario?.onFormSubmit) {
        addMessage({ role: 'user', type: 'text', text: '✓ Form submitted' })
        playScenarioMessages(pendingScenario.onFormSubmit, () => {
          setPendingScenario(null)
          setActiveSuggestions(suggestions)
        })
      }
    }

    if (event.type === 'action_click') {
      if (pendingScenario?.onActionClick) {
        // Play scripted response for this scenario
        addMessage({ role: 'user', type: 'text', text: event.label })
        playScenarioMessages(pendingScenario.onActionClick, () => {
          setPendingScenario(null)
          setActiveSuggestions(suggestions)
        })
      } else {
        // No scripted response — route the action label as a new user message
        // This fixes the defaultScenario action card routing
        handleSend(event.label)
      }
    }
  }

  function handleSend(text) {
    if (!text.trim()) return

    addMessage({ role: 'user', type: 'text', text })
    setActiveSuggestions([])
    clearScenarioTimers()

    const scenario = matchScenario(text, scenarios)
    if (scenario) {
      setPendingScenario(scenario)
      playScenarioMessages(scenario.messages, () => {
        if (!scenario.onFormSubmit && !scenario.onActionClick) {
          setActiveSuggestions(suggestions)
        }
      })
    } else {
      setIsTyping(true)
      const t = setTimeout(() => {
        setIsTyping(false)
        addMessage({
          role: 'ai',
          type: 'text',
          text: `I'm looking into "${text}" for you. Can you give me a bit more detail about what you need? I can help with leave requests, IT support, expenses, HR policies, and more.`,
        })
        setActiveSuggestions(suggestions)
      }, 1200)
      scenarioTimersRef.current.push(t)
    }
  }

  // Expose programmatic send to parent (handle.send)
  useEffect(() => {
    if (typeof _onSendRef === 'function') {
      _onSendRef(handleSend)
    }
  }, [])

  const isEmpty = messages.length === 0 && !isTyping

  return (
    <div className="cw-root">
      {/* Floating bar — shown when closed */}
      {!isOpen && (
        <FloatingBar
          agentAvatar={agentAvatar}
          agentName={agentName}
          onOpen={open}
          unreadCount={unreadCount}
        />
      )}

      {/* Full chat screen */}
      <div className={`cw-screen ${isOpen ? 'cw-open' : ''}`}>
        {/* Header */}
        <div className="cw-header">
          <button className="cw-header-back" onClick={close} aria-label="Close chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="cw-header-agent">
            <div className="cw-header-avatar-wrap">
              <div className="cw-header-avatar">{agentAvatar}</div>
              <div className="cw-header-online" />
            </div>
            <div className="cw-header-info">
              <span className="cw-header-name">{agentName}</span>
              <span className="cw-header-status">
                {isTyping ? 'Typing…' : 'Online · replies instantly'}
              </span>
            </div>
          </div>
          <button className="cw-header-menu" aria-label="More options">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>

        {/* Messages or welcome */}
        {isEmpty ? (
          <WelcomeState
            agentAvatar={agentAvatar}
            agentName={agentName}
            agentSubtitle={agentSubtitle}
            suggestions={suggestions}
            onSuggestion={handleSend}
          />
        ) : (
          <div className="cw-messages">
            <div className="cw-date-divider"><span>Today</span></div>
            {messages.map(msg => (
              <Message
                key={msg.id}
                message={msg}
                agentAvatar={agentAvatar}
                onAction={handleAction}
              />
            ))}
            {isTyping && <TypingIndicator agentAvatar={agentAvatar} />}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Suggestions */}
        {!isEmpty && activeSuggestions.length > 0 && (
          <SuggestionChips
            suggestions={activeSuggestions}
            onSelect={handleSend}
          />
        )}

        {/* Input */}
        <ChatInput onSend={handleSend} placeholder={`Message ${agentName}…`} />
      </div>
    </div>
  )
}
