// Client-side intent matcher + scripted scenarios for Navigator Flows.
// The orchestrator backend isn't aware of flows — when an employee's message
// matches a flow trigger we bypass `/api/orchestrate` and play a canned
// conversation instead. Mirrors the same "first notable-word hits" heuristic
// the Studio's planRoute() uses for assistants.

import { flowMatchesText } from '../AIAssistant/configStore'

export function matchFlowByText(text, flows = []) {
  if (!text || !flows.length) return null
  const active = flows.filter((f) => f.status === 'active')
  for (const f of active) {
    if (flowMatchesText(text, f)) return f
  }
  return null
}

// One scripted scenario per seed flow. Each scenario contains:
//   opening:  first assistant message after the flow fires
//   toolCall: optional simulated tool call rendered in the trace strip
//   followUp: second assistant message that lands ~900ms later
//
// Unrecognized (admin-authored) flows fall back to scenarioFor() defaults
// derived from name/goal so a custom flow still feels alive in the demo.
export const FLOW_SCENARIOS = {
  'flow-laptop': {
    opening:
      "I'll help you get that sorted. To make sure we request the right model, what's your role — engineering, sales, or ops?",
    toolCall: null,
    followUp:
      "Got it. I'm filing an IT ticket for a new laptop now — you'll get email confirmation shortly with delivery options.",
  },
  'flow-pto': {
    opening:
      "Happy to help you book some time off. Let me check your PTO balance first…",
    toolCall: { serverId: 'hr_portal', toolName: 'getPtoBalance', args: { user: 'me' } },
    followUp:
      'You have 19 days available. Which dates were you thinking of? I can submit the request once you confirm.',
  },
  'flow-onboarding': {
    opening:
      "Welcome! I'll walk you through getting set up. There are a few things we need to take care of — I'll go one at a time so it doesn't feel overwhelming. First, let me pull up your HR profile.",
    toolCall: { serverId: 'hr_portal', toolName: 'getEmployee', args: { email: 'me' } },
    followUp:
      "Great — you're set up in HR as an Office Worker at HQ. Next, let's request your laptop and core software access.",
  },
}

export function scenarioFor(flow) {
  if (!flow) {
    return {
      opening: "Let's work through this together.",
      toolCall: null,
      followUp: 'When you have what you need, I can take the next step.',
    }
  }
  return (
    FLOW_SCENARIOS[flow.id] || {
      opening: `Let's work on this together — ${flow.goal || flow.name}.`,
      toolCall: null,
      followUp: 'When you have what you need, I can take the next step.',
    }
  )
}
