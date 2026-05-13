export const A2A_REGISTRY = [
  {
    id: 'staffbase_onboarding_agent',
    name: 'Staffbase Onboarding Agent',
    description: 'Stage-aware onboarding agent for new Staffbase hires. Identifies the new joiner from their auth token and streams the Day One / First Week / First Month checklist with personalised context (department, office, manager).',
    endpoint: '/api/a2a',
    domains: ['onboarding', 'new hire', 'first day', 'first week', 'first month', 'day one', 'checklist', 'welcome', 'macbook', 'benefits enrollment'],
    color: '#00C7B2',
    icon: 'graduation-cap',
    authType: 'bearer',
    capabilities: { streaming: true, pushNotifications: false },
  },
];
