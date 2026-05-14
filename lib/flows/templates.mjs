// Starter templates shown in the Studio "Templates" picker. Cloning a
// template creates a fresh flow with `status: 'draft'` so admins can review
// and edit before activating.
//
// Tool references use the seeded connector ids (hr_portal, it_helpdesk,
// kb-hr, etc.). If a workspace doesn't have those connectors yet, the
// editor flags the steps with a warning chip — same behavior as the AI
// scaffold path.

const PTO_TEMPLATE = {
  name: 'Request time off',
  trigger: 'Employee wants to book leave, holiday, vacation, or PTO',
  goal: 'PTO request submitted with dates and reason confirmed',
  mode: 'suggested',
  status: 'draft',
  tools: [
    { connectorId: 'hr_portal', toolId: 'check_pto_balance' },
    { connectorId: 'hr_portal', toolId: 'submit_time_off_request' },
  ],
  instructions: 'Collect dates and reason, show a balance summary, confirm, then submit.',
  steps: [
    {
      id: 'collect-dates',
      type: 'form',
      label: 'Collect dates',
      spec: {
        title: 'Request time off',
        description: "We'll check your balance and submit this for approval.",
        submitLabel: 'Next',
        fields: [
          {
            id: 'start_date', label: 'Start date', type: 'date', required: true,
            description: 'First day off (YYYY-MM-DD).',
          },
          {
            id: 'end_date', label: 'End date', type: 'date', required: true,
            description: 'Last day off (YYYY-MM-DD).',
          },
          {
            id: 'reason', label: 'Reason', type: 'textarea', required: false,
            description: 'A short note for your manager.',
            validation: { maxLength: 280 },
          },
        ],
      },
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirm before submitting',
      summary: {
        title: 'Submit your PTO request?',
        rows: [
          { label: 'Start', value: '{{collect-dates.start_date}}' },
          { label: 'End', value: '{{collect-dates.end_date}}' },
          { label: 'Reason', value: '{{collect-dates.reason}}' },
        ],
        confirmLabel: 'Submit to HR',
        cancelLabel: 'Edit dates',
        cancelTo: 'collect-dates',
      },
    },
    {
      id: 'submit',
      type: 'tool',
      label: 'Submit to HR',
      tool: { connectorId: 'hr_portal', toolId: 'submit_time_off_request' },
      args: {
        start_date: '{{collect-dates.start_date}}',
        end_date: '{{collect-dates.end_date}}',
        reason: '{{collect-dates.reason}}',
      },
    },
  ],
};

const ONBOARDING_TEMPLATE = {
  name: 'Onboard a new joiner',
  trigger: 'Employee just joined, new hire, day one onboarding',
  goal: 'Equipment ticket filed and onboarding agent engaged for the new hire',
  mode: 'suggested',
  status: 'draft',
  tools: [
    { connectorId: 'it_helpdesk', toolId: 'create_ticket' },
    { connectorId: 'staffbase_onboarding_agent', toolId: 'invoke' },
  ],
  steps: [
    {
      id: 'collect-joiner',
      type: 'form',
      label: 'New hire details',
      spec: {
        title: 'Onboarding intake',
        submitLabel: 'Continue',
        fields: [
          { id: 'full_name', label: 'Full name', type: 'text', required: true },
          { id: 'start_date', label: 'Start date', type: 'date', required: true },
          {
            id: 'laptop_tier', label: 'Laptop tier', type: 'select', required: true,
            options: [
              { value: 'standard', label: 'Standard (MacBook Air)' },
              { value: 'pro', label: 'Pro (MacBook Pro 14")' },
              { value: 'engineer', label: 'Engineer (MacBook Pro 16")' },
            ],
          },
          { id: 'address', label: 'Shipping address', type: 'textarea', required: true },
        ],
      },
    },
    {
      id: 'file-it-ticket',
      type: 'tool',
      label: 'File IT equipment ticket',
      tool: { connectorId: 'it_helpdesk', toolId: 'create_ticket' },
      args: {
        title: 'New hire equipment — {{collect-joiner.full_name}}',
        body: 'Tier: {{collect-joiner.laptop_tier}}\nStart: {{collect-joiner.start_date}}\nShip to: {{collect-joiner.address}}',
        category: 'equipment',
      },
    },
    {
      id: 'invoke-onboarding-agent',
      type: 'tool',
      label: 'Engage onboarding agent',
      tool: { connectorId: 'staffbase_onboarding_agent', toolId: 'invoke' },
      args: {
        message: 'New hire {{collect-joiner.full_name}} starting {{collect-joiner.start_date}}. Generate a Day-1 checklist.',
      },
    },
  ],
};

const EXPENSE_TEMPLATE = {
  name: 'File an expense',
  trigger: 'Employee wants to file an expense, reimbursement, receipt',
  goal: 'Expense submitted with amount, category, and receipt note',
  mode: 'suggested',
  status: 'draft',
  tools: [],
  steps: [
    {
      id: 'collect-expense',
      type: 'form',
      label: 'Expense details',
      spec: {
        title: 'File an expense',
        submitLabel: 'Review',
        fields: [
          {
            id: 'amount', label: 'Amount (USD)', type: 'number', required: true,
            validation: { min: 0.01, max: 10000 },
          },
          {
            id: 'category', label: 'Category', type: 'select', required: true,
            options: [
              { value: 'travel', label: 'Travel' },
              { value: 'meals', label: 'Meals' },
              { value: 'software', label: 'Software' },
              { value: 'office', label: 'Office supplies' },
              { value: 'other', label: 'Other' },
            ],
          },
          {
            id: 'date', label: 'Expense date', type: 'date', required: true,
          },
          {
            id: 'memo', label: 'Memo', type: 'textarea', required: false,
            validation: { maxLength: 240 },
          },
        ],
      },
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirm submission',
      summary: {
        title: 'Submit this expense?',
        rows: [
          { label: 'Amount', value: '${{collect-expense.amount}}' },
          { label: 'Category', value: '{{collect-expense.category}}' },
          { label: 'Date', value: '{{collect-expense.date}}' },
          { label: 'Memo', value: '{{collect-expense.memo}}' },
        ],
        confirmLabel: 'Submit',
        cancelLabel: 'Edit',
        cancelTo: 'collect-expense',
      },
    },
  ],
};

export const FLOW_TEMPLATES = [
  { id: 'tpl-pto', icon: '🌴', template: PTO_TEMPLATE,
    summary: '3 steps · Collect dates → Confirm → Submit to HR' },
  { id: 'tpl-onboarding', icon: '🎉', template: ONBOARDING_TEMPLATE,
    summary: '3 steps · Collect new-hire info → File IT ticket → Engage onboarding agent' },
  { id: 'tpl-expense', icon: '🧾', template: EXPENSE_TEMPLATE,
    summary: '2 steps · Collect details → Confirm' },
];

export function instantiateTemplate(template) {
  // Deep clone with a fresh id.
  const t = JSON.parse(JSON.stringify(template));
  t.id = `flow-${Math.random().toString(36).slice(2, 8)}`;
  return t;
}
