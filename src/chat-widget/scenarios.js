/**
 * Scenario engine for scripted chat demos.
 *
 * A scenario is triggered when any keyword in `trigger` matches
 * a user's message (case-insensitive substring match).
 *
 * Each message in the `messages` array has:
 *   role: 'ai' | 'user'
 *   type: 'text' | 'info_card' | 'form' | 'confirm' | 'action'
 *   text: string (for type='text')
 *   content: object (for card types)
 *   delay: ms to wait before showing this message (default 800 for ai, 400 for user)
 */

export const leaveScenario = {
  trigger: ['leave', 'vacation', 'time off', 'annual leave', 'pto', 'holiday', 'day off', 'days off'],
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'Of course! Let me pull up your leave balance first.',
      delay: 600,
    },
    {
      role: 'ai',
      type: 'info_card',
      content: {
        title: 'Your Leave Balance',
        icon: '📊',
        rows: [
          { label: 'Annual Leave', value: '12 days remaining' },
          { label: 'Sick Leave', value: '5 days remaining' },
          { label: 'Carryover', value: '3 days (exp. Dec 31)' },
          { label: 'Last taken', value: 'Feb 14, 2026', badge: { label: '18 days ago', variant: 'neutral' } },
        ],
        badge: { label: 'Up to date', variant: 'success' },
      },
      delay: 1400,
    },
    {
      role: 'ai',
      type: 'text',
      text: 'You have 12 days of annual leave available. Want me to submit a request? Just fill in the dates below:',
      delay: 900,
    },
    {
      role: 'ai',
      type: 'form',
      content: {
        id: 'leave_request',
        title: 'Leave Request',
        icon: '🌴',
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
              { value: 'personal', label: 'Personal Leave' },
              { value: 'maternity', label: 'Parental Leave' },
              { value: 'compassionate', label: 'Compassionate Leave' },
            ],
            defaultValue: 'annual',
          },
          { id: 'coverage', label: 'Covered by', type: 'text', placeholder: 'Colleague covering your work...' },
          { id: 'note', label: 'Note (optional)', type: 'textarea', placeholder: 'e.g. Family trip to Spain 🌞' },
        ],
        submitLabel: 'Submit Leave Request',
      },
      delay: 700,
    },
  ],
  onFormSubmit: [
    {
      role: 'ai',
      type: 'text',
      text: 'Submitting your request now…',
      delay: 400,
    },
    {
      role: 'ai',
      type: 'confirm',
      content: {
        icon: '✅',
        title: 'Leave Request Submitted',
        subtitle: 'Apr 14–18 · 5 days · Annual Leave',
        chips: ['Pending approval', 'Manager notified', '12 → 7 days remaining'],
      },
      delay: 1200,
    },
    {
      role: 'ai',
      type: 'info_card',
      content: {
        title: 'What happens next',
        icon: '📋',
        rows: [
          { label: '1. Manager review', value: 'Within 24h', badge: { label: 'Pending', variant: 'warning' } },
          { label: '2. HR confirmation', value: 'After approval' },
          { label: '3. Calendar blocked', value: 'Auto-updated' },
        ],
      },
      delay: 1400,
    },
    {
      role: 'ai',
      type: 'text',
      text: 'Your manager Priya Singh has been notified. You\'ll get an email once it\'s approved. Is there anything else I can help with?',
      delay: 1000,
    },
  ],
}

export const policyScenario = {
  trigger: ['policy', 'policies', 'remote', 'work from home', 'wfh', 'hr policy', 'rules', 'handbook', 'guidelines'],
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'I can look up any company policy for you. Which topic are you interested in?',
      delay: 700,
    },
    {
      role: 'ai',
      type: 'action',
      content: {
        title: 'Policy Topics',
        description: 'Select a policy to view details:',
        actions: [
          { id: 'remote', icon: '🏠', label: 'Remote Work Policy', color: '#EDE9FE' },
          { id: 'expense', icon: '💳', label: 'Expense Guidelines', color: '#FEF3C7' },
          { id: 'leave_policy', icon: '🌴', label: 'Leave & Time Off', color: '#D1FAE5' },
          { id: 'conduct', icon: '📘', label: 'Code of Conduct', color: '#E0F2FE' },
        ],
      },
      delay: 1000,
    },
  ],
  onActionClick: [
    {
      role: 'ai',
      type: 'info_card',
      content: {
        title: 'Remote Work Policy',
        icon: '🏠',
        rows: [
          { label: 'WFH days', value: 'Up to 3 days/week' },
          { label: 'Core hours', value: '10am – 3pm local time' },
          { label: 'Manager approval', value: 'Required for > 2 weeks' },
          { label: 'Equipment', value: 'Home office stipend: €500/yr' },
          { label: 'Last updated', value: 'Jan 15, 2026', badge: { label: 'Current', variant: 'success' } },
        ],
      },
      delay: 900,
    },
    {
      role: 'ai',
      type: 'text',
      text: 'Employees can work remotely up to 3 days/week. Core collaboration hours (10am–3pm) must be honoured in your local timezone. Longer remote periods require written manager approval. Need the full policy PDF or want me to connect you with HR?',
      delay: 1400,
    },
  ],
}

export const itScenario = {
  trigger: ['it', 'laptop', 'computer', 'access', 'password', 'software', 'hardware', 'vpn', 'ticket', 'support', 'issue', 'broken', 'not working'],
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'I\'ll help you with that! What kind of IT issue are you running into?',
      delay: 600,
    },
    {
      role: 'ai',
      type: 'action',
      content: {
        title: 'IT Support',
        description: 'Select the type of issue:',
        actions: [
          { id: 'hardware', icon: '💻', label: 'Hardware / Device Issue', color: '#EDE9FE' },
          { id: 'software', icon: '⚙️', label: 'Software / App Access', color: '#E0F2FE' },
          { id: 'vpn', icon: '🔒', label: 'VPN / Network Problem', color: '#FEF3C7' },
          { id: 'password', icon: '🔑', label: 'Password Reset', color: '#D1FAE5' },
        ],
      },
      delay: 900,
    },
  ],
  onActionClick: [
    {
      role: 'ai',
      type: 'text',
      text: 'Got it. Raising a priority ticket now — you\'re next in the queue.',
      delay: 600,
    },
    {
      role: 'ai',
      type: 'confirm',
      content: {
        icon: '🎫',
        title: 'IT Ticket Created',
        subtitle: 'A technician has been assigned and will contact you shortly.',
        chips: ['Ticket #IT-4821', 'Priority: Medium', 'ETA: ~2 hours'],
      },
      delay: 1200,
    },
    {
      role: 'ai',
      type: 'info_card',
      content: {
        title: 'Ticket Status',
        icon: '📡',
        rows: [
          { label: 'Assigned to', value: 'Alex from IT Support' },
          { label: 'Response time', value: 'Within 2 business hours' },
          { label: 'Contact method', value: 'Slack + Email' },
          { label: 'Status', badge: { label: 'In Queue', variant: 'warning' } },
        ],
      },
      delay: 1400,
    },
    {
      role: 'ai',
      type: 'text',
      text: 'You\'ll get a Slack message and email from Alex within 2 hours. Is there anything else I can help with in the meantime?',
      delay: 1000,
    },
  ],
}

export const expenseScenario = {
  trigger: ['expense', 'receipt', 'reimburse', 'reimbursement', 'claim', 'spend', 'spent'],
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'Happy to help you submit an expense claim! Fill in the details below and I\'ll route it to Finance.',
      delay: 700,
    },
    {
      role: 'ai',
      type: 'form',
      content: {
        id: 'expense_claim',
        title: 'Expense Claim',
        icon: '💳',
        fields: [
          {
            id: 'category',
            label: 'Category',
            type: 'select',
            options: [
              { value: 'travel', label: '✈️ Travel' },
              { value: 'meals', label: '🍽️ Meals & Entertainment' },
              { value: 'equipment', label: '💻 Equipment' },
              { value: 'training', label: '📚 Training & Development' },
              { value: 'other', label: '📦 Other' },
            ],
            defaultValue: 'travel',
          },
          { id: 'amount', label: 'Amount (€)', type: 'number', placeholder: '0.00' },
          { id: 'merchant', label: 'Merchant / Vendor', type: 'text', placeholder: 'e.g. Lufthansa, Marriott...' },
          { id: 'date', label: 'Date of expense', type: 'date', defaultValue: new Date().toISOString().split('T')[0] },
          { id: 'project', label: 'Project code (optional)', type: 'text', placeholder: 'e.g. Q2-Marketing' },
          { id: 'description', label: 'Description', type: 'textarea', placeholder: 'What was this expense for?' },
        ],
        submitLabel: 'Submit for Approval',
      },
      delay: 600,
    },
  ],
  onFormSubmit: [
    {
      role: 'ai',
      type: 'text',
      text: 'Submitting your claim to Finance now…',
      delay: 400,
    },
    {
      role: 'ai',
      type: 'confirm',
      content: {
        icon: '💸',
        title: 'Expense Submitted',
        subtitle: 'Your claim has been sent to the Finance team for approval.',
        chips: ['Claim #EXP-2891', 'Pending review', 'Payment in 5–7 days'],
      },
      delay: 1100,
    },
    {
      role: 'ai',
      type: 'text',
      text: 'The Finance team will review within 2 business days. Once approved, reimbursement typically lands in your account within 5–7 days. Need to submit another one?',
      delay: 1400,
    },
  ],
}

export const payslipScenario = {
  trigger: ['payslip', 'payroll', 'salary', 'pay slip', 'pay stub', 'compensation', 'earnings', 'my pay'],
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'Here\'s your latest payslip summary:',
      delay: 700,
    },
    {
      role: 'ai',
      type: 'info_card',
      content: {
        title: 'March 2026 Payslip',
        icon: '💰',
        rows: [
          { label: 'Gross salary', value: '€5,800.00' },
          { label: 'Tax withheld', value: '−€1,392.00' },
          { label: 'Social security', value: '−€460.00' },
          { label: 'Net pay', value: '€3,948.00', badge: { label: 'Paid Mar 31', variant: 'success' } },
        ],
        badge: { label: 'Latest', variant: 'info' },
      },
      delay: 1200,
    },
    {
      role: 'ai',
      type: 'action',
      content: {
        title: 'What would you like to do?',
        actions: [
          { id: 'download', icon: '⬇️', label: 'Download PDF', color: '#EDE9FE' },
          { id: 'history', icon: '📅', label: 'View Pay History', color: '#E0F2FE' },
          { id: 'ytd', icon: '📊', label: 'Year-to-Date Summary', color: '#D1FAE5' },
          { id: 'question', icon: '❓', label: 'Ask a Payroll Question', color: '#FEF3C7' },
        ],
      },
      delay: 1000,
    },
  ],
  onActionClick: [
    {
      role: 'ai',
      type: 'confirm',
      content: {
        icon: '📄',
        title: 'Payslip Ready',
        subtitle: 'Your March 2026 payslip PDF has been prepared.',
        chips: ['Mar 2026', '€3,948.00 net', 'Sent to email'],
      },
      delay: 900,
    },
    {
      role: 'ai',
      type: 'text',
      text: 'A copy has also been sent to your work email. Your full payslip archive is available in the HR portal. Any questions about your pay?',
      delay: 1200,
    },
  ],
}

export const onboardingScenario = {
  trigger: ['onboard', 'new hire', 'first day', 'getting started', 'setup', 'checklist', 'welcome', 'orientation'],
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'Welcome to Staffbase! 🎉 Let me check your onboarding progress.',
      delay: 600,
    },
    {
      role: 'ai',
      type: 'info_card',
      content: {
        title: 'Onboarding Checklist',
        icon: '🚀',
        rows: [
          { label: '✅ Profile completed', value: 'Done', badge: { label: 'Complete', variant: 'success' } },
          { label: '✅ Laptop setup', value: 'Done', badge: { label: 'Complete', variant: 'success' } },
          { label: '⏳ Benefits enrollment', value: 'Due Apr 15', badge: { label: 'Pending', variant: 'warning' } },
          { label: '⏳ Compliance training', value: 'Due Apr 20', badge: { label: 'Pending', variant: 'warning' } },
          { label: '❌ Team intro meeting', value: 'Not scheduled', badge: { label: 'Todo', variant: 'neutral' } },
        ],
        badge: { label: '2/5 complete', variant: 'warning' },
      },
      delay: 1400,
    },
    {
      role: 'ai',
      type: 'text',
      text: 'You\'re 2/5 through your first week checklist. Want me to help you knock out the remaining items?',
      delay: 900,
    },
    {
      role: 'ai',
      type: 'action',
      content: {
        title: 'Next Steps',
        actions: [
          { id: 'benefits', icon: '🏥', label: 'Complete Benefits Enrollment', color: '#D1FAE5' },
          { id: 'training', icon: '📚', label: 'Start Compliance Training', color: '#EDE9FE' },
          { id: 'meeting', icon: '📅', label: 'Schedule Team Intro', color: '#E0F2FE' },
          { id: 'tour', icon: '🗺️', label: 'Take the Platform Tour', color: '#FEF3C7' },
        ],
      },
      delay: 800,
    },
  ],
  onActionClick: [
    {
      role: 'ai',
      type: 'text',
      text: 'Great choice! I\'ve queued that up for you.',
      delay: 500,
    },
    {
      role: 'ai',
      type: 'confirm',
      content: {
        icon: '🎯',
        title: 'Task Started',
        subtitle: 'Your onboarding coordinator has been notified and will send you next steps.',
        chips: ['On track', 'ETA: 30 min', 'Mentor notified'],
      },
      delay: 1000,
    },
    {
      role: 'ai',
      type: 'text',
      text: 'Your onboarding buddy Sarah will reach out via Slack shortly. You\'re doing great — most people take 2 weeks to get this far! Is there anything else you\'d like to set up?',
      delay: 1300,
    },
  ],
}

export const defaultScenario = {
  trigger: [],
  fallback: true,
  messages: [
    {
      role: 'ai',
      type: 'text',
      text: 'I\'m here to help! Here\'s what I can do for you right now:',
      delay: 700,
    },
    {
      role: 'ai',
      type: 'action',
      content: {
        title: 'Quick Actions',
        description: 'Tap any option to get started:',
        actions: [
          { id: 'leave', icon: '🌴', label: 'Request Leave', color: '#D1FAE5' },
          { id: 'it support', icon: '💻', label: 'IT Support', color: '#EDE9FE' },
          { id: 'submit expense', icon: '💳', label: 'Submit Expense', color: '#FEF3C7' },
          { id: 'hr policy', icon: '📄', label: 'HR Policies', color: '#E0F2FE' },
          { id: 'my payslip', icon: '💰', label: 'View Payslip', color: '#FCE7F3' },
        ],
      },
      delay: 900,
    },
  ],
  // No onActionClick here — widget will route action clicks back through handleSend
}

export const defaultScenarios = [
  leaveScenario,
  policyScenario,
  itScenario,
  expenseScenario,
  payslipScenario,
  onboardingScenario,
  defaultScenario,
]

/**
 * Match user message against scenario triggers.
 * Returns the matched scenario or the fallback.
 */
export function matchScenario(text, scenarios) {
  const lower = text.toLowerCase()
  for (const scenario of scenarios) {
    if (scenario.fallback) continue
    if (scenario.trigger.some(kw => lower.includes(kw))) {
      return scenario
    }
  }
  return scenarios.find(s => s.fallback) || null
}
