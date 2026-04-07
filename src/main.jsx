import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ChatWidget } from './chat-widget/ChatWidget.jsx'
import {
  defaultScenarios,
  leaveScenario,
  policyScenario,
  itScenario,
  expenseScenario,
  payslipScenario,
  onboardingScenario,
} from './chat-widget/scenarios.js'

// ── Public API ──────────────────────────────────────────────────
// ChatWidget.init(container, config) → handle
// handle.open()         — open widget
// handle.close()        — close widget
// handle.send(text)     — send message programmatically
// handle.unmount()      — destroy widget

const instances = new WeakMap()

function init(containerOrSelector, config = {}) {
  const container =
    typeof containerOrSelector === 'string'
      ? document.querySelector(containerOrSelector)
      : containerOrSelector

  if (!container) {
    console.warn('[ChatWidget] Container not found:', containerOrSelector)
    return null
  }

  let reactSetOpen = null
  let reactSend = null

  function WidgetWrapper() {
    const [isOpen, setIsOpen] = useState(config.defaultOpen ?? false)

    useEffect(() => {
      reactSetOpen = setIsOpen
    }, [])

    return React.createElement(ChatWidget, {
      ...config,
      isOpen,
      onOpenChange: (v) => {
        setIsOpen(v)
        config.onOpenChange?.(v)
      },
      // Inject a send callback via a ref-like prop
      _onSendRef: (fn) => { reactSend = fn },
    })
  }

  const root = createRoot(container)
  root.render(React.createElement(WidgetWrapper))

  const handle = {
    open()        { reactSetOpen?.(true) },
    close()       { reactSetOpen?.(false) },
    send(text)    { reactSend?.(text) },
    unmount()     { root.unmount() },
  }

  instances.set(container, handle)
  return handle
}

function open(containerOrHandle) {
  if (containerOrHandle && typeof containerOrHandle.open === 'function') {
    containerOrHandle.open()
  } else if (containerOrHandle instanceof Element) {
    instances.get(containerOrHandle)?.open()
  }
}

function close(containerOrHandle) {
  if (containerOrHandle && typeof containerOrHandle.close === 'function') {
    containerOrHandle.close()
  } else if (containerOrHandle instanceof Element) {
    instances.get(containerOrHandle)?.close()
  }
}

// ── Export global ────────────────────────────────────────────────
const ChatWidgetAPI = {
  init,
  open,
  close,
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

// Expose as global (IIFE build)
if (typeof window !== 'undefined') {
  window.ChatWidget = ChatWidgetAPI
}

export default ChatWidgetAPI
