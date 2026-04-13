import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronUp, MoreVertical, ChevronLeft, Sparkles, RefreshCw, Mail, Star, X, Palmtree, Laptop, CreditCard, FileText, Banknote, Headphones } from 'lucide-react'
import { Message } from './Message.jsx'
import { TypingIndicator } from './TypingIndicator.jsx'
import { SuggestionChips } from './SuggestionChips.jsx'
import { ChatInput } from './ChatInput.jsx'
import { matchScenario, defaultScenarios } from './scenarios.jsx'
import { PhoneMockup } from '../components/PhoneMockup.jsx'
import './styles.css'

let msgIdCounter = 0
function nextId() { return ++msgIdCounter }

function getInitials(name) {
  if (!name || name === 'You') return 'Me'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(str) {
  const colors = ['#7B5CE3','#EC4899','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6']
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

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
          <ChevronUp size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

function WelcomeState({ agentAvatar, agentName, agentSubtitle, suggestions, onSuggestion, enabledActions = [], scenarios = [] }) {
  const filteredSuggestions = suggestions.filter(s => {
    const label = typeof s === 'string' ? s : s.label;
    // Find the scenario that WOULD match this chip if everything was enabled
    const potentialScenario = scenarios.find(scenario => 
      !scenario.fallback && scenario.trigger.some(kw => label.toLowerCase().includes(kw))
    );
    
    // If it requires an action that isn't enabled, hide the chip
    if (potentialScenario?.requiredAction && !enabledActions.includes(potentialScenario.requiredAction)) {
      return false;
    }
    return true;
  });

  return (
    <div className="cw-welcome">
      <div className="cw-welcome-avatar-wrap">
        <div className="cw-welcome-avatar">{agentAvatar}</div>
        <div className="cw-welcome-online-dot" />
      </div>
      <div className="cw-welcome-name">{agentName}</div>
      <div className="cw-welcome-subtitle">{agentSubtitle || 'Your AI assistant. Ask me anything.'}</div>
      {filteredSuggestions && filteredSuggestions.length > 0 && (
        <>
          <div className="cw-welcome-divider-text">Quick actions</div>
          <div className="cw-welcome-chips">
            {filteredSuggestions.map((s, i) => (
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

function HeaderMenu({ onNewChat, onEmailTranscript, onRateChat, onEndChat }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleOut(e) {
      if (!menuRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOut)
    return () => document.removeEventListener('mousedown', handleOut)
  }, [open])

  const items = [
    { icon: <RefreshCw size={16} />, label: 'New conversation', action: onNewChat },
    { icon: <Mail size={16} />, label: 'Email transcript', action: onEmailTranscript },
    { icon: <Star size={16} />, label: 'Rate this chat', action: onRateChat },
    null, // divider
    { icon: <X size={16} />, label: 'End conversation', action: onEndChat, danger: true },
  ]

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        className={`cw-header-menu ${open ? 'cw-header-menu-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="More options"
      >
        <MoreVertical size={18} strokeWidth={2} />
      </button>
      {open && (
        <div className="cw-dropdown">
          {items.map((item, i) =>
            item === null ? (
              <div key={i} className="cw-dropdown-divider" />
            ) : (
              <button
                key={i}
                className={`cw-dropdown-item ${item.danger ? 'cw-dropdown-item-danger' : ''}`}
                onClick={() => { item.action?.(); setOpen(false) }}
              >
                <span className="cw-dropdown-icon">{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

export function ChatWidget({
  agentName = 'Navigator',
  agentSubtitle = 'Your AI work assistant · Always available',
  agentAvatar = <Sparkles size={20} />,
  userName = 'You',
  theme = {},
  initialMessages = [],
  scenarios = defaultScenarios,
  suggestions = [
    { icon: <Palmtree size={14} />, label: 'Request leave' },
    { icon: <Laptop size={14} />, label: 'IT support' },
    { icon: <CreditCard size={14} />, label: 'Submit expense' },
    { icon: <FileText size={14} />, label: 'HR policies' },
    { icon: <Banknote size={14} />, label: 'My payslip' },
    { icon: <Headphones size={14} />, label: 'Zendesk support' },
  ],
  onMinimize,
  isOpen: controlledIsOpen,
  onOpenChange,
  defaultOpen = false,
  _onSendRef,
  enabledActions = [],
  variant = 'inline', // 'inline' | 'floating'
}) {
  const primary = theme.primary || '#7B5CE3'
  const userInitials = getInitials(userName)
  const userAvatarColor = getAvatarColor(userName)
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

  function clearMessages() {
    clearScenarioTimers()
    setMessages([])
    setActiveSuggestions([])
    setIsTyping(false)
    setPendingScenario(null)
    // brief toast welcome back
    setTimeout(() => {
      addMessage({
        role: 'ai',
        type: 'text',
        text: 'Starting a new conversation. How can I help you?',
      })
      setActiveSuggestions(suggestions)
    }, 300)
  }

  function emailTranscript() {
    addMessage({
      role: 'ai',
      type: 'text',
      text: '✓ Transcript sent to your work email. You\'ll receive it within a few minutes.',
    })
  }

  function rateChat() {
    addMessage({
      role: 'ai',
      type: 'confirm',
      content: {
        icon: <Star size={24} className="text-yellow-400" />,
        title: 'Thanks for the feedback!',
        subtitle: 'Your rating helps us improve Navigator.',
        chips: ['Helpful', 'Quick response', 'Accurate'],
      },
    })
  }

  function handleSend(text) {
    if (!text.trim()) return

    addMessage({ role: 'user', type: 'text', text })
    setActiveSuggestions([])
    clearScenarioTimers()

    const scenario = matchScenario(text, scenarios, enabledActions)
    if (scenario) {
      setPendingScenario(scenario)
      playScenarioMessages(scenario.messages, () => {
        if (!scenario.onFormSubmit && !scenario.onActionClick) {
          setActiveSuggestions(suggestions.filter(s => {
             const m = matchScenario(typeof s === 'string' ? s : s.label, scenarios, enabledActions);
             if (!m || !m.requiredAction) return true;
             return enabledActions.includes(m.requiredAction);
          }))
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
        setActiveSuggestions(suggestions.filter(s => {
           const m = matchScenario(typeof s === 'string' ? s : s.label, scenarios, enabledActions);
           if (!m || !m.requiredAction) return true;
           return enabledActions.includes(m.requiredAction);
        }))
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

  const chatContent = (
    <>
      {/* Full chat screen */}
      <div className={`cw-screen ${isOpen ? 'cw-open' : ''}`}>
        {/* Header */}
        <div className="cw-header">
          <button className="cw-header-back" onClick={close} aria-label="Close chat">
            <ChevronLeft size={18} strokeWidth={2.5} />
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
          <HeaderMenu
            onNewChat={clearMessages}
            onEmailTranscript={emailTranscript}
            onRateChat={rateChat}
            onEndChat={close}
          />
        </div>

        {/* Messages or welcome */}
        {isEmpty ? (
          <WelcomeState
            agentAvatar={agentAvatar}
            agentName={agentName}
            agentSubtitle={agentSubtitle}
            suggestions={suggestions}
            onSuggestion={handleSend}
            enabledActions={enabledActions}
            scenarios={scenarios}
          />
        ) : (
          <div className="cw-messages">
            <div className="cw-date-divider"><span>Today</span></div>
            {messages.map(msg => (
              <Message
                key={msg.id}
                message={msg}
                agentAvatar={agentAvatar}
                userInitials={userInitials}
                userAvatarColor={userAvatarColor}
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
    </>
  )

  const widgetContent = (
    <div className={`cw-root ${variant === 'floating' ? 'cw-root-floating' : ''}`}>
      {/* Floating bar — shown when closed */}
      {!isOpen && (
        <FloatingBar
          agentAvatar={agentAvatar}
          agentName={agentName}
          onOpen={open}
          unreadCount={unreadCount}
        />
      )}

      {/* Conditional Phone Mockup wrapping */}
      {variant === 'floating' && isOpen ? (
        <PhoneMockup>
          {chatContent}
        </PhoneMockup>
      ) : (
        chatContent
      )}
    </div>
  )

  if (variant === 'floating') {
    return createPortal(widgetContent, document.body)
  }

  return widgetContent
}
