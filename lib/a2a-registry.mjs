export const A2A_REGISTRY = [
  {
    id: 'store_ops_agent',
    name: 'Acme Store Operations Agent',
    description: 'Role-aware shift checklists and procedure coordination for Acme store locations. Knows each employee\'s role and location from their auth context.',
    endpoint: '/api/a2a',
    domains: ['shift', 'store', 'checklist', 'procedures', 'opening', 'closing', 'my tasks', 'my shift', 'handover', 'morning tasks', 'daily tasks'],
    color: '#F59E0B',
    icon: 'clipboard-list',
    authType: 'bearer',
    capabilities: { streaming: true, pushNotifications: false },
  },
];
