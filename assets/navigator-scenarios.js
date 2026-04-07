/**
 * Unified Navigator scenarios — all chat flows for navigator-next-gen-experience.html
 * Uses the ChatWidget scenario format: { trigger[], messages[], onFormSubmit?, onActionClick? }
 */

// ── IT Support ─────────────────────────────────────────────────────

const IT_TICKET_SCENARIO = {
  trigger: ['it issue', 'it ticket', 'laptop', 'vpn', 'vpn issue', 'report an issue', 'it support', 'hardware', 'software issue', 'password', 'network', 'computer'],
  messages: [
    {
      role: 'ai', type: 'text',
      text: "I'll help you open an IT support ticket. What kind of issue are you running into?",
      delay: 600
    },
    {
      role: 'ai', type: 'action',
      content: {
        title: 'IT Support',
        description: 'Select the type of issue:',
        actions: [
          { id: 'hardware', icon: '💻', label: 'Hardware / Device', color: '#EDE9FE' },
          { id: 'software', icon: '⚙️', label: 'Software / App Access', color: '#E0F2FE' },
          { id: 'vpn', icon: '🔒', label: 'VPN / Network', color: '#FEF3C7' },
          { id: 'password', icon: '🔑', label: 'Password Reset', color: '#D1FAE5' },
        ]
      },
      delay: 900
    }
  ],
  onActionClick: [
    {
      role: 'ai', type: 'text',
      text: "Got it — raising a priority ticket for you now.",
      delay: 500
    },
    {
      role: 'ai', type: 'confirm',
      content: {
        icon: '🎫',
        title: 'IT Ticket Created',
        subtitle: 'A technician has been assigned and will contact you via Slack within 2 hours.',
        chips: ['Ticket #IT-4821', 'Priority: Medium', 'Assigned: Alex (IT)']
      },
      delay: 1200
    },
    {
      role: 'ai', type: 'text',
      text: "You'll get a Slack message from Alex shortly. Is there anything else I can help with?",
      delay: 1400
    }
  ]
};

const IT_LIST_SCENARIO = {
  trigger: ['my tickets', 'check my tickets', 'show tickets', 'open tickets', 'my it tickets'],
  messages: [
    {
      role: 'ai', type: 'text',
      text: 'Here are your active IT tickets:',
      delay: 700
    },
    {
      role: 'ai', type: 'info_card',
      content: {
        title: 'My IT Tickets',
        icon: '🎫',
        rows: [
          { label: 'INC0048291', value: 'VPN connectivity issue', badge: { label: 'In Progress', variant: 'warning' } },
          { label: 'INC0047853', value: 'Office printer not found', badge: { label: 'Open', variant: 'info' } },
          { label: 'INC0046902', value: 'Adobe CC Access', badge: { label: 'Pending', variant: 'neutral' } }
        ],
        badge: { label: '3 Open', variant: 'info' }
      },
      delay: 1000
    },
    {
      role: 'ai', type: 'text',
      text: 'Your VPN ticket (INC0048291) is in progress — Alex will follow up within the hour. Want to open a new ticket or check the status of one?',
      delay: 1300
    }
  ]
};

// ── Leave Management ───────────────────────────────────────────────

const LEAVE_BALANCE_SCENARIO = {
  trigger: ['leave balance', 'vacation days', 'days left', 'how many days', 'check leave', 'how much leave'],
  messages: [
    {
      role: 'ai', type: 'text',
      text: "Here's your current leave balance for 2026:",
      delay: 700
    },
    {
      role: 'ai', type: 'info_card',
      content: {
        title: 'Leave Balance 2026',
        icon: '📊',
        rows: [
          { label: 'Annual Leave', value: '18 days remaining' },
          { label: 'Sick Leave', value: '10 days remaining' },
          { label: 'Personal Days', value: '2 days remaining' },
          { label: 'Used this year', value: '4 days total', badge: { label: 'via BambooHR', variant: 'neutral' } }
        ],
        badge: { label: 'Up to date', variant: 'success' }
      },
      delay: 1200
    },
    {
      role: 'ai', type: 'text',
      text: "You've got plenty of leave available. Want me to submit a request right now?",
      delay: 1000
    }
  ]
};

const LEAVE_REQUEST_SCENARIO = {
  trigger: ['request leave', 'take leave', 'book leave', 'vacation', 'time off', 'day off', 'days off', 'annual leave', 'holiday'],
  messages: [
    {
      role: 'ai', type: 'text',
      text: "You have 18 days of annual leave available. Let me pull up the request form:",
      delay: 800
    },
    {
      role: 'ai', type: 'form',
      content: {
        id: 'leave_request',
        title: 'Leave Request',
        icon: '🌴',
        fields: [
          {
            id: 'type', label: 'Leave Type', type: 'select',
            options: [
              { value: 'annual', label: 'Annual Leave' },
              { value: 'sick', label: 'Sick Leave' },
              { value: 'personal', label: 'Personal Day' },
              { value: 'parental', label: 'Parental Leave' }
            ],
            defaultValue: 'annual'
          },
          { id: 'start', label: 'Start Date', type: 'date', defaultValue: '2026-04-14' },
          { id: 'end', label: 'End Date', type: 'date', defaultValue: '2026-04-18' },
          { id: 'coverage', label: 'Covered by', type: 'text', placeholder: 'Who covers your work?' },
          { id: 'note', label: 'Note (optional)', type: 'textarea', placeholder: 'Message for your manager...' }
        ],
        submitLabel: 'Submit Leave Request'
      },
      delay: 1000
    }
  ],
  onFormSubmit: [
    {
      role: 'ai', type: 'text',
      text: "Submitting your request now…",
      delay: 400
    },
    {
      role: 'ai', type: 'confirm',
      content: {
        icon: '✅',
        title: 'Leave Request Submitted',
        subtitle: 'Apr 14–18 · 5 working days · Annual Leave',
        chips: ['Pending approval', 'Manager notified', '18 → 13 days remaining']
      },
      delay: 1200
    },
    {
      role: 'ai', type: 'info_card',
      content: {
        title: 'What happens next',
        icon: '📋',
        rows: [
          { label: '1. Manager review', value: 'Within 24h', badge: { label: 'Pending', variant: 'warning' } },
          { label: '2. HR confirmation', value: 'After approval' },
          { label: '3. Calendar blocked', value: 'Auto-updated' }
        ]
      },
      delay: 1400
    },
    {
      role: 'ai', type: 'text',
      text: "Sarah Mueller (your manager) has been notified. You'll get an email when it's approved. Anything else?",
      delay: 1000
    }
  ]
};

// ── HR Policies ────────────────────────────────────────────────────

const POLICY_SCENARIO = {
  trigger: ['policy', 'policies', 'remote work', 'work from home', 'wfh', 'hr policy', 'rules', 'guidelines', 'handbook', 'hr policies'],
  messages: [
    {
      role: 'ai', type: 'text',
      text: "I can look up any company policy for you. Which one are you interested in?",
      delay: 700
    },
    {
      role: 'ai', type: 'action',
      content: {
        title: 'Policy Library',
        description: 'Select a topic to view:',
        actions: [
          { id: 'remote', icon: '🏠', label: 'Remote Work Policy', color: '#EDE9FE' },
          { id: 'expense', icon: '💳', label: 'Expense Guidelines', color: '#FEF3C7' },
          { id: 'leave_policy', icon: '🌴', label: 'Leave & Time Off', color: '#D1FAE5' },
          { id: 'conduct', icon: '📘', label: 'Code of Conduct', color: '#E0F2FE' }
        ]
      },
      delay: 1000
    }
  ],
  onActionClick: [
    {
      role: 'ai', type: 'info_card',
      content: {
        title: 'Remote Work Policy',
        icon: '🏠',
        rows: [
          { label: 'WFH days', value: 'Up to 3 days/week' },
          { label: 'Core hours', value: '10am – 3pm local time' },
          { label: 'Manager approval', value: 'Required > 2 weeks' },
          { label: 'Home office stipend', value: '€500/year' },
          { label: 'Effective', value: 'May 1, 2026', badge: { label: 'New', variant: 'info' } }
        ]
      },
      delay: 900
    },
    {
      role: 'ai', type: 'text',
      text: "Up to 3 remote days/week with manager approval. Core hours (10am–3pm local) must be honoured. Longer periods need written approval. Need the full PDF or want me to connect you with HR?",
      delay: 1400
    }
  ]
};

// ── Expenses ───────────────────────────────────────────────────────

const EXPENSE_SCENARIO = {
  trigger: ['expense', 'expenses', 'receipt', 'reimburse', 'reimbursement', 'claim', 'submit expense'],
  messages: [
    {
      role: 'ai', type: 'text',
      text: "Happy to help you submit an expense claim. Fill in the details and I'll route it to Finance:",
      delay: 700
    },
    {
      role: 'ai', type: 'form',
      content: {
        id: 'expense_claim',
        title: 'Expense Claim',
        icon: '💳',
        fields: [
          {
            id: 'category', label: 'Category', type: 'select',
            options: [
              { value: 'travel', label: '✈️ Travel' },
              { value: 'meals', label: '🍽️ Meals & Entertainment' },
              { value: 'equipment', label: '💻 Equipment' },
              { value: 'training', label: '📚 Training & Development' },
              { value: 'other', label: '📦 Other' }
            ],
            defaultValue: 'travel'
          },
          { id: 'amount', label: 'Amount (€)', type: 'number', placeholder: '0.00' },
          { id: 'merchant', label: 'Merchant / Vendor', type: 'text', placeholder: 'e.g. Lufthansa, Marriott...' },
          { id: 'date', label: 'Date of Expense', type: 'date', defaultValue: new Date().toISOString().split('T')[0] },
          { id: 'description', label: 'Description', type: 'textarea', placeholder: 'What was this expense for?' }
        ],
        submitLabel: 'Submit for Approval'
      },
      delay: 600
    }
  ],
  onFormSubmit: [
    {
      role: 'ai', type: 'confirm',
      content: {
        icon: '💸',
        title: 'Expense Submitted',
        subtitle: 'Your claim has been sent to the Finance team for approval.',
        chips: ['Claim #EXP-2891', 'Pending review', 'Payment in 5–7 days']
      },
      delay: 1100
    },
    {
      role: 'ai', type: 'text',
      text: "Finance will review within 2 business days. Once approved, reimbursement arrives in 5–7 days. Want to submit another?",
      delay: 1400
    }
  ]
};

// ── Payslip ────────────────────────────────────────────────────────

const PAYSLIP_SCENARIO = {
  trigger: ['payslip', 'payroll', 'salary', 'pay slip', 'my pay', 'earnings', 'compensation'],
  messages: [
    {
      role: 'ai', type: 'text',
      text: "Here's your latest payslip summary:",
      delay: 700
    },
    {
      role: 'ai', type: 'info_card',
      content: {
        title: 'March 2026 Payslip',
        icon: '💰',
        rows: [
          { label: 'Gross salary', value: '€5,800.00' },
          { label: 'Tax withheld', value: '−€1,392.00' },
          { label: 'Social security', value: '−€460.00' },
          { label: 'Net pay', value: '€3,948.00', badge: { label: 'Paid Mar 31', variant: 'success' } }
        ],
        badge: { label: 'via Workday', variant: 'neutral' }
      },
      delay: 1200
    },
    {
      role: 'ai', type: 'action',
      content: {
        title: 'Payslip Options',
        actions: [
          { id: 'download', icon: '⬇️', label: 'Download PDF', color: '#EDE9FE' },
          { id: 'history', icon: '📅', label: 'View Pay History', color: '#E0F2FE' },
          { id: 'ytd', icon: '📊', label: 'Year-to-Date Summary', color: '#D1FAE5' }
        ]
      },
      delay: 900
    }
  ],
  onActionClick: [
    {
      role: 'ai', type: 'confirm',
      content: {
        icon: '📄',
        title: 'Payslip Ready',
        subtitle: 'Your March 2026 payslip has been sent to your work email.',
        chips: ['Mar 2026', '€3,948.00 net', 'Sent to email']
      },
      delay: 900
    }
  ]
};

// ── Workday / Performance ──────────────────────────────────────────

const WORKDAY_SCENARIO = {
  trigger: ['workday', 'performance review', 'self-assessment', 'q1 self-assessment', 'performance', 'goals', 'review'],
  messages: [
    {
      role: 'ai', type: 'text',
      text: "Let me check your Workday account for your performance details.",
      delay: 600
    },
    {
      role: 'ai', type: 'info_card',
      content: {
        title: 'Performance Overview',
        icon: '📋',
        rows: [
          { label: 'Review cycle', value: 'Q1 2026' },
          { label: 'Self-assessment', value: 'Due Apr 30', badge: { label: 'Pending', variant: 'warning' } },
          { label: 'Manager review', value: 'May 15', badge: { label: 'Upcoming', variant: 'neutral' } },
          { label: 'Goals set', value: '4 of 5 complete' }
        ],
        badge: { label: 'Action needed', variant: 'warning' }
      },
      delay: 1200
    },
    {
      role: 'ai', type: 'action',
      content: {
        title: 'Next Steps',
        actions: [
          { id: 'start_review', icon: '✍️', label: 'Start Self-Assessment', color: '#EDE9FE' },
          { id: 'view_goals', icon: '🎯', label: 'View My Goals', color: '#D1FAE5' },
          { id: 'past_reviews', icon: '📚', label: 'Past Reviews', color: '#E0F2FE' }
        ]
      },
      delay: 1000
    }
  ],
  onActionClick: [
    {
      role: 'ai', type: 'confirm',
      content: {
        icon: '✅',
        title: 'Action Started',
        subtitle: "I've opened your self-assessment in Workday. You'll also get a link via email.",
        chips: ['Due Apr 30', '5 sections', 'Est. 15 min']
      },
      delay: 1000
    },
    {
      role: 'ai', type: 'text',
      text: "Your previous responses have been pre-filled where possible to save you time. Is there anything else I can help with?",
      delay: 1400
    }
  ]
};

// ── Fallback ───────────────────────────────────────────────────────

const DEFAULT_SCENARIO = {
  trigger: [],
  fallback: true,
  messages: [
    {
      role: 'ai', type: 'text',
      text: "I'm here to help! Here's what I can do for you:",
      delay: 700
    },
    {
      role: 'ai', type: 'action',
      content: {
        title: 'Quick Actions',
        description: 'Tap any option to get started:',
        actions: [
          { id: 'request leave', icon: '🌴', label: 'Request Leave', color: '#D1FAE5' },
          { id: 'it support', icon: '💻', label: 'IT Support', color: '#EDE9FE' },
          { id: 'submit expense', icon: '💳', label: 'Submit Expense', color: '#FEF3C7' },
          { id: 'hr policies', icon: '📄', label: 'HR Policies', color: '#E0F2FE' },
          { id: 'my payslip', icon: '💰', label: 'View Payslip', color: '#FCE7F3' }
        ]
      },
      delay: 900
    }
  ]
};

// ── Export ─────────────────────────────────────────────────────────

const NAVIGATOR_SCENARIOS = [
  WORKDAY_SCENARIO,
  LEAVE_BALANCE_SCENARIO,
  LEAVE_REQUEST_SCENARIO,
  IT_TICKET_SCENARIO,
  IT_LIST_SCENARIO,
  POLICY_SCENARIO,
  EXPENSE_SCENARIO,
  PAYSLIP_SCENARIO,
  DEFAULT_SCENARIO
];

if (typeof window !== 'undefined') {
  window.NAVIGATOR_SCENARIOS = NAVIGATOR_SCENARIOS;
}
