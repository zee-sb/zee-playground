import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import { NotificationProvider } from './components/NotificationProvider'
import { ChatWidget } from './chat-widget/ChatWidget.jsx'
import {
  defaultScenarios,
  leaveScenario,
  policyScenario,
  itScenario,
  expenseScenario,
  payslipScenario,
  onboardingScenario,
} from './chat-widget/scenarios.jsx'

// ── App Rendering ──────────────────────────────────────────────────
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <BrowserRouter>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </BrowserRouter>
  )
}

// ── Public API (Legacy & Library Support) ──────────────────────────
const instances = new WeakMap()

function init(containerOrSelector, config = {}) {
  const target =
    typeof containerOrSelector === 'string'
      ? document.querySelector(containerOrSelector)
      : containerOrSelector

  if (!target) return null

  let reactSend = null
  const root = createRoot(target)

  function WidgetWrapper() {
    return (
      <ChatWidget 
        {...config} 
        _onSendRef={(fn) => { reactSend = fn }}
      />
    )
  }

  root.render(<WidgetWrapper />)
  
  const handle = {
    send(text) { reactSend?.(text) },
    unmount() { root.unmount() }
  }
  instances.set(target, handle)
  return handle
}

const ChatWidgetAPI = {
  init,
  scenarios: {
    defaults: defaultScenarios,
    leave: leaveScenario,
    policy: policyScenario,
    it: itScenario,
    expense: expenseScenario,
    payslip: payslipScenario,
    onboarding: onboardingScenario,
  },
}

if (typeof window !== 'undefined') {
  window.ChatWidget = ChatWidgetAPI
}

export default ChatWidgetAPI
