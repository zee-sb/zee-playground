import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronUp, MoreVertical, ChevronLeft, Sparkles, RefreshCw, Mail, Star, X, Palmtree, Laptop, CreditCard, FileText, Banknote, Headphones, Brain, Zap, Wrench, Package, Plane, Briefcase } from 'lucide-react'
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

function WelcomeState({ agentAvatar, agentName, agentSubtitle, suggestions, onSuggestion, scenarios = [] }) {
  // Extract agents from scenarios to display as 'Available Assistants'
  const subAgents = scenarios.filter(s => !s.fallback && s.agentSwitch).map(s => s.agentSwitch)

  return (
    <div className="cw-welcome">
      <div className="cw-welcome-avatar-wrap">
        <div className="cw-welcome-avatar">{agentAvatar}</div>
        <div className="cw-welcome-online-dot" />
      </div>
      <div className="cw-welcome-name" style={{ fontSize: '20px', letterSpacing: '-0.02em' }}>{agentName}</div>
      <div className="cw-welcome-subtitle">{agentSubtitle || 'Your AI assistant. Ask me anything.'}</div>
      
      {subAgents.length > 0 && (
        <div className="cw-agents-directory mt-6 mb-4 w-full px-4">
           <div className="cw-welcome-divider-text">Your Assistants</div>
           <div className="grid grid-cols-2 gap-2 mt-3">
              {subAgents.map((agent, i) => (
                <button
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-gray-50 text-left transition-all hover:border-[#3B82F6]"
                  onClick={() => onSuggestion(agent.name)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: agent.color }}>
                    {agent.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-gray-900 truncate">{agent.name}</div>
                    <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                      {agent.type === 'external' ? <Zap size={8} /> : <Brain size={8} />}
                      {agent.type === 'external' ? 'External MCP' : 'Internal'}
                    </div>
                  </div>
                </button>
              ))}
           </div>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <>
          <div className="cw-welcome-divider-text mt-2">Quick actions</div>
          <div className="cw-welcome-chips px-4 pb-4">
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
    { icon: <Briefcase size={14} />, label: 'My Payslip' },
    { icon: <FileText size={14} />, label: 'HR policies' }
  ],
  onMinimize,
  isOpen: controlledIsOpen,
  onOpenChange,
  defaultOpen = false,
  _onSendRef,
  enabledActions = [],
  variant = 'inline', // 'inline' | 'floating'
}) {
  const defaultAgent = {
    name: agentName,
    subtitle: agentSubtitle,
    avatar: agentAvatar,
    color: theme.primary || '#7B5CE3',
    isDefault: true
  }

  const userInitials = getInitials(userName)
  const userAvatarColor = getAvatarColor(userName)
  
  const [isOpen, setIsOpen] = useState(controlledIsOpen ?? defaultOpen)
  const [activeAgent, setActiveAgent] = useState(defaultAgent)
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
    root.style.setProperty('--cw-primary', activeAgent.color)
  }, [activeAgent.color])

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
          setActiveSuggestions(suggestions) // can filter by active agent here
        })
      }
    }

    if (event.type === 'action_click') {
      if (pendingScenario?.onActionClick) {
        // filter the onActionClick messages by condition if provided
        const conditionedMessages = pendingScenario.onActionClick.filter(m => !m.condition || m.condition(event.label))
        
        if (conditionedMessages.length > 0) {
          addMessage({ role: 'user', type: 'text', text: event.label })
          playScenarioMessages(conditionedMessages, () => {
            setPendingScenario(null)
            setActiveSuggestions(suggestions)
          })
        } else {
           handleSend(event.label)
        }
      } else {
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
    setActiveAgent(defaultAgent)
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
        subtitle: 'Your rating helps us improve.',
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
      
      // Simulate Handoff / Context Switch if needed
      if (scenario.agentSwitch && activeAgent.name !== scenario.agentSwitch.name) {
          // Switch Agent Context
          setIsTyping(true)
          const tHandoff = setTimeout(() => {
             setIsTyping(false)
             
             // Setup new agent state
             const newAgent = scenario.agentSwitch;
             setActiveAgent({
                ...newAgent,
                isDefault: false
             })

             // Add a system handoff message visually simulating the connection
             addMessage({
                role: 'ai',
                type: 'text',
                text: `Routing your request to ${newAgent.name}...`,
             })
             
             // Begin playing scenario messages with short delay
             setTimeout(() => {
               playScenarioMessages(scenario.messages, () => {
                  if (!scenario.onFormSubmit && !scenario.onActionClick) {
                    setActiveSuggestions(suggestions)
                  }
                })
             }, 800)

          }, 1000)
          scenarioTimersRef.current.push(tHandoff)
      } else {
        // Direct Play if already active / no switch
        playScenarioMessages(scenario.messages, () => {
          if (!scenario.onFormSubmit && !scenario.onActionClick) {
            setActiveSuggestions(suggestions)
          }
        })
      }
    } else {
      setIsTyping(true)
      const t = setTimeout(() => {
        setIsTyping(false)
        addMessage({
          role: 'ai',
          type: 'text',
          text: `I'm looking into "${text}" for you. Which domain is this related to so I can connect you to the right assistant?`,
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

  const chatContent = (
    <>
      <div className={`cw-screen ${isOpen ? 'cw-open' : ''}`}>
        <div className="cw-header" style={{ borderBottomColor: `${activeAgent.color}20`, backgroundColor: `${activeAgent.color}05` }}>
          <button className="cw-header-back" onClick={close} aria-label="Close chat">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          
          <div className="cw-header-agent relative group">
            <div className="cw-header-avatar-wrap relative">
              <div className="cw-header-avatar text-white shadow-sm" style={{ backgroundColor: activeAgent.color }}>
                {activeAgent.avatar}
              </div>
              <div className="cw-header-online" />
              {!activeAgent.isDefault && (
                 <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                    {activeAgent.type === 'external' ? <Zap size={10} className="text-amber-500" /> : <Brain size={10} className="text-blue-500" />}
                 </div>
              )}
            </div>
            <div className="cw-header-info">
              <span className="cw-header-name flex items-center gap-1.5">
                 {activeAgent.name}
                 {!activeAgent.isDefault && activeAgent.type === 'external' && (
                    <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 4px', background: `${activeAgent.color}15`, color: activeAgent.color, borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                       {activeAgent.provider === 'copilot_studio' ? 'Copilot' : 'Gemini'}
                    </span>
                 )}
              </span>
              <span className="cw-header-status text-gray-500">
                {isTyping ? 'Gathering insights…' : activeAgent.subtitle}
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

        {isEmpty ? (
          <WelcomeState
            agentAvatar={
               <div className="w-16 h-16 bg-[#111827] rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto mb-4">
                  <Sparkles size={32} />
               </div>
            }
            agentName="Staffbase Navigator"
            agentSubtitle="I can connect you to internal knowledge, HR, IT systems, and specialized external Copilots."
            suggestions={suggestions}
            onSuggestion={handleSend}
            scenarios={scenarios}
          />
        ) : (
          <div className="cw-messages">
            <div className="cw-date-divider"><span>Today</span></div>
            {messages.map(msg => (
              <Message
                key={msg.id}
                message={msg}
                agentAvatar={
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs shadow-sm" style={{ backgroundColor: activeAgent.color }}>
                    {activeAgent.avatar}
                  </div>
                }
                userInitials={userInitials}
                userAvatarColor={userAvatarColor}
                onAction={handleAction}
              />
            ))}
            {isTyping && <TypingIndicator agentAvatar={
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs shadow-sm" style={{ backgroundColor: activeAgent.color }}>
                 {activeAgent.avatar}
              </div>
            } />}
            <div ref={messagesEndRef} />
          </div>
        )}

        {!isEmpty && activeSuggestions.length > 0 && (
          <SuggestionChips
            suggestions={activeSuggestions}
            onSelect={handleSend}
          />
        )}

        <ChatInput onSend={handleSend} placeholder={`Message ${activeAgent.name}…`} />
      </div>
    </>
  )

  const widgetContent = (
    <div className={`cw-root ${variant === 'floating' ? 'cw-root-floating' : ''}`}>
      {!isOpen && (
        <FloatingBar
          agentAvatar={
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow" style={{ backgroundColor: activeAgent.color }}>
               {activeAgent.avatar}
            </div>
          }
          agentName={activeAgent.name}
          onOpen={open}
          unreadCount={unreadCount}
        />
      )}
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
