import React from "react";
import { 
  BarChart2, Palmtree, CheckCircle, ClipboardList, Home, CreditCard, 
  Book, Laptop, Settings, Lock, Key, Ticket, Radio, Headphones, 
  Banknote, CircleDollarSign, Download, Calendar, HelpCircle, FileText, 
  Rocket, Target, PlusCircle, Library, Map, Plane, Utensils, Package,
  Gamepad, Brain, Zap, Wrench, Shield, Briefcase
} from "lucide-react";

/**
 * Scenario engine for scripted chat demos.
 */

// ── HR Workday Agent (External Gemini) ──────────────────────────────────────
export const hrWorkdayScenario = {
  id: 'hr-workday',
  trigger: ['leave', 'vacation', 'time off', 'holiday', 'day off', 'payslip', 'payroll', 'salary', 'workday', 'compensation'],
  requiredAction: 'gemini-workday:connect',
  agentSwitch: {
    id: 'ext-gemini-hr',
    name: 'HR Workday Agent',
    subtitle: 'Powered by Gemini AI',
    type: 'external',
    provider: 'gemini',
    avatar: <Brain size={18} />,
    color: '#1a73e8'
  },
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'I can help you with Workday HR tasks like booking leave or checking payslips. Pulling your profile securely...',
      delay: 800,
    },
    {
      role: 'ai',
      type: 'info_card',
      content: {
        title: 'Workday Profile Snapshot',
        icon: <Briefcase size={16} />,
        rows: [
          { label: 'Annual Leave', value: '12 days remaining' },
          { label: 'Next Pay Date', value: 'Apr 28, 2026' },
          { label: 'Latest Payslip', value: 'Ready to view', badge: { label: 'New', variant: 'info' } },
        ],
        badge: { label: 'Secure Connection', variant: 'success' },
      },
      delay: 1500,
    },
    {
      role: 'ai',
      type: 'action',
      content: {
        title: 'What would you like to do?',
        actions: [
          { id: 'leave', icon: <Palmtree size={16} />, label: 'Book Time Off', color: '#D1FAE5' },
          { id: 'payslip', icon: <CircleDollarSign size={16} />, label: 'View Latest Payslip', color: '#EDE9FE' }
        ],
      },
      delay: 800,
    },
  ],
  onActionClick: [
    {
      role: 'ai',
      type: 'text',
      text: 'Sure thing. Please select the dates for your leave request.',
      delay: 500,
      condition: (label) => label.includes('Leave')
    },
    {
      role: 'ai',
      type: 'form',
      condition: (label) => label.includes('Leave'),
      content: {
        id: 'leave_request',
        title: 'Request Time Off',
        icon: <Palmtree size={16} />,
        fields: [
          { id: 'from', label: 'Start date', type: 'date', defaultValue: '2026-04-14' },
          { id: 'to', label: 'End date', type: 'date', defaultValue: '2026-04-18' },
          {
            id: 'type',
            label: 'Leave type',
            type: 'select',
            options: [
              { value: 'annual', label: 'Annual Leave' },
              { value: 'sick', label: 'Sick Leave' },
              { value: 'personal', label: 'Personal Leave' }
            ],
            defaultValue: 'annual',
          },
          { id: 'note', label: 'Note to Manager', type: 'textarea', placeholder: 'e.g. Taking a family trip.' },
        ],
        submitLabel: 'Submit to Workday',
      },
      delay: 700,
    },
    {
      role: 'ai',
      type: 'text',
      condition: (label) => label.includes('Payslip'),
      text: 'Here is your latest payslip summary from Workday:',
      delay: 700,
    },
    {
      role: 'ai',
      type: 'info_card',
      condition: (label) => label.includes('Payslip'),
      content: {
        title: 'March 2026 Payslip',
        icon: <CircleDollarSign size={16} />,
        rows: [
          { label: 'Gross salary', value: '€5,800.00' },
          { label: 'Tax withheld', value: '−€1,392.00' },
          { label: 'Net pay', value: '€3,948.00', badge: { label: 'Paid Mar 31', variant: 'success' } },
        ],
        badge: { label: 'Verified', variant: 'info' },
      },
      delay: 1200,
    },
  ],
  onFormSubmit: [
    {
      role: 'ai',
      type: 'text',
      text: 'Syncing with Workday…',
      delay: 600,
    },
    {
      role: 'ai',
      type: 'confirm',
      content: {
        icon: <CheckCircle size={24} className="text-green-500" />,
        title: 'Time Off Request Submitted',
        subtitle: 'Your request has been successfully recorded in Workday.',
        chips: ['Pending Manager Approval', 'Calendar Updated', '12 → 7 days remaining'],
      },
      delay: 1500,
    },
  ],
}

// ── IT Helpdesk (External Copilot Studio) ───────────────────────────────────
export const itCopilotScenario = {
  id: 'it-helpdesk',
  trigger: ['it', 'laptop', 'computer', 'access', 'password', 'software', 'hardware', 'vpn', 'ticket', 'support', 'broken', 'not working', 'helpdesk'],
  requiredAction: 'copilot-studio:connect',
  agentSwitch: {
    id: 'ext-copilot-it',
    name: 'IT Helpdesk',
    subtitle: 'Powered by MS Copilot Studio',
    type: 'external',
    provider: 'copilot_studio',
    avatar: <Wrench size={18} />,
    color: '#0078d4'
  },
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'Analyzing your network profile... I see you are on the London VPN node. What IT issue can I assist with?',
      delay: 1000,
    },
    {
      role: 'ai',
      type: 'action',
      content: {
        title: 'IT Helpdesk Categories',
        description: 'Select an issue type to proceed:',
        actions: [
          { id: 'hardware', icon: <Laptop size={16} />, label: 'Hardware/Device', color: '#EDE9FE' },
          { id: 'vpn', icon: <Lock size={16} />, label: 'VPN/Network', color: '#FEF3C7' },
          { id: 'password', icon: <Key size={16} />, label: 'Password Reset', color: '#D1FAE5' },
        ],
      },
      delay: 900,
    },
  ],
  onActionClick: [
    {
      role: 'ai',
      type: 'text',
      text: 'Understood. Let me create an urgent ServiceNow incident for this.',
      delay: 600,
    },
    {
      role: 'ai',
      type: 'confirm',
      content: {
        icon: <Ticket size={16} />,
        title: 'ServiceNow Incident Created',
        subtitle: 'Our regional IT team has been immediately pinged.',
        chips: ['INC-98214', 'Priority: High', 'Status: Assigned to Tech'],
      },
      delay: 1400,
    },
    {
      role: 'ai',
      type: 'text',
      text: 'I have logged `INC-98214`. A technician named Alex just grabbed your ticket. Is there anything else you need checking?',
      delay: 1000,
    },
  ],
}

// ── Travel Policy & Booking (Internal) ──────────────────────────────────────
export const travelScenario = {
  id: 'travel-internal',
  trigger: ['travel', 'flight', 'hotel', 'train', 'book trip'],
  agentSwitch: {
    id: 'travel',
    name: 'Travel Assistant',
    subtitle: 'Internal Travel Rules',
    type: 'internal',
    avatar: <Plane size={18} />,
    color: '#3B82F6'
  },
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'I can help you review travel policies and initiate a booking.',
      delay: 600,
    },
    {
      role: 'ai',
      type: 'info_card',
      content: {
        title: 'Your Travel Allowance',
        icon: <Utensils size={16} />,
        rows: [
          { label: 'Hotel Cap', value: '€200 per night (EU)' },
          { label: 'Flight Class', value: 'Economy (flights < 6h)' },
          { label: 'Per Diem', value: '€60 / day meals' },
        ],
        badge: { label: 'Policy Active', variant: 'success' },
      },
      delay: 1100,
    },
    {
      role: 'ai',
      type: 'form',
      content: {
        id: 'travel_booking',
        title: 'Initiate Travel Request',
        icon: <Plane size={16} />,
        fields: [
          { id: 'destination', label: 'Destination City', type: 'text', placeholder: 'e.g. Berlin, Germany' },
          { id: 'depart', label: 'Departure', type: 'date' },
          { id: 'return', label: 'Return', type: 'date' },
          { id: 'reason', label: 'Business Reason', type: 'textarea' },
        ],
        submitLabel: 'Send to TravelDesk',
      },
      delay: 900,
    },
  ],
  onFormSubmit: [
    {
      role: 'ai',
      type: 'confirm',
      content: {
        icon: <CheckCircle size={24} className="text-green-500" />,
        title: 'Travel Request Forwarded',
        subtitle: 'Egencia will email you flight options shortly.',
        chips: ['Ref: TR-7742', 'In budget'],
      },
      delay: 1200,
    },
  ],
}

// ── Core Onboarding (Internal) ──────────────────────────────────────────────
export const onboardingScenario = {
  id: 'onboarding-internal',
  trigger: ['onboard', 'new hire', 'checklist', 'getting started', 'setup', 'welcome', 'orientation'],
  agentSwitch: {
    id: 'onboarding',
    name: 'Onboarding Guide',
    subtitle: 'Your day 1 companion',
    type: 'internal',
    avatar: <Rocket size={18} />,
    color: '#EAB308'
  },
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'Welcome aboard! Let\'s get your accounts synchronized and systems set up.',
      delay: 600,
    },
    {
      role: 'ai',
      type: 'info_card',
      content: {
        title: 'First Week Checklist',
        icon: <Package size={16} />,
        rows: [
          { label: '✅ Core Login', value: 'Done', badge: { label: 'Complete', variant: 'success' } },
          { label: '⏳ Access Badges', value: 'Pending HR', badge: { label: 'In Progress', variant: 'warning' } },
          { label: '❌ Team Intro', value: 'Required', badge: { label: 'To do', variant: 'neutral' } },
        ],
        badge: { label: '33% complete', variant: 'warning' },
      },
      delay: 1500,
    },
    {
      role: 'ai',
      type: 'action',
      content: {
        title: 'Next Steps',
        actions: [
          { id: 'badge', icon: <Lock size={16} />, label: 'Check Badge Status', color: '#D1FAE5' },
          { id: 'intro', icon: <Calendar size={16} />, label: 'Schedule Team Intro', color: '#EDE9FE' },
        ],
      },
      delay: 900,
    },
  ],
  onActionClick: [
    {
      role: 'ai',
      type: 'text',
      text: 'Excellent. I have updated your manager so they can facilitate this right away.',
      delay: 800,
    },
  ],
}

// ── Core Policy Search (Internal) ───────────────────────────────────────────
export const policyScenario = {
  id: 'policy-search',
  trigger: ['policy', 'remote', 'wfh', 'handbook', 'guidelines', 'rules'],
  agentSwitch: {
    id: 'hr',
    name: 'Knowledge Assistant',
    subtitle: 'Searching internal docs...',
    type: 'internal',
    avatar: <Book size={18} />,
    color: '#8B5CF6'
  },
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'I found several documents regarding internal policies. Here is the Remote Work Policy overview.',
      delay: 700,
    },
    {
      role: 'ai',
      type: 'info_card',
      content: {
        title: 'Remote Work Policy',
        icon: <Home size={16} />,
        rows: [
          { label: 'WFH limits', value: 'Up to 3 days/week' },
          { label: 'Core hours', value: '10am – 3pm local' },
          { label: 'Stipend', value: '€500/year for tech' },
        ],
        badge: { label: 'Updated 2026', variant: 'info' },
      },
      delay: 1200,
    },
  ],
}

// ── Default Fallback ────────────────────────────────────────────────────────
export const defaultScenario = {
  trigger: [],
  fallback: true,
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'I am your unified AI Assistant. For complex tasks, I might route you to a specialized agent.',
      delay: 700,
    },
    {
      role: 'ai',
      type: 'action',
      content: {
        title: 'Available Assistants & Actions',
        description: 'Or type what you need:',
        actions: [
          { id: 'hr-workday', icon: <Brain size={16} />, label: 'HR Workday Agent', color: '#E0F2FE' },
          { id: 'it-copilot', icon: <Wrench size={16} />, label: 'IT Helpdesk', color: '#EDE9FE' },
          { id: 'travel', icon: <Plane size={16} />, label: 'Travel Policies', color: '#D1FAE5' },
          { id: 'onboarding', icon: <Rocket size={16} />, label: 'Onboarding', color: '#FEF3C7' },
        ],
      },
      delay: 900,
    },
  ],
  // No onActionClick means we just let it feed back into the chat as a message
}

export const defaultScenarios = [
  hrWorkdayScenario,
  itCopilotScenario,
  travelScenario,
  onboardingScenario,
  policyScenario,
  defaultScenario,
]

export function matchScenario(text, scenarios, enabledActions = []) {
  const lower = text.toLowerCase()
  // A scenario gated by `requiredAction` only matches when that action is enabled.
  // This is the seam that lets admin connect/disconnect drive the chat experience.
  const isAvailable = (scenario) =>
    !scenario.requiredAction || enabledActions.includes(scenario.requiredAction)

  for (const scenario of scenarios) {
    if (scenario.fallback) continue
    if (!isAvailable(scenario)) continue

    if (scenario.trigger.some(kw => lower.includes(kw))) {
      return scenario
    }
  }

  // also allow exact matching on the 'id' for direct assistant invocation
  for (const scenario of scenarios) {
    if (scenario.fallback) continue
    if (!isAvailable(scenario)) continue
    if (scenario.agentSwitch && text.toLowerCase().includes(scenario.agentSwitch.name.toLowerCase())) {
        return scenario
    }
  }

  return scenarios.find(s => s.fallback) || null
}
