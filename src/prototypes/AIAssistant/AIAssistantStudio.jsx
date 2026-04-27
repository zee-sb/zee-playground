import React, { useState } from 'react';
import { ExternalLink, Smartphone, Check } from 'lucide-react';
import { useNotification } from '../../components/NotificationProvider';
import { StudioShell } from '../../components/StudioShell';
import { FeatureHeader } from '../../components/SettingsCard';
import IdentityTab from './IdentityTab';
import KnowledgeTab from './KnowledgeTab';
import SettingsTab from './SettingsTab';
import AnalyticsTab from './AnalyticsTab';
import BrandingTab from './BrandingTab';
import AssistantsTab from './AssistantsTab';
import AssistantDetail from './AssistantDetail';
import AssistantWizard from './AssistantWizard';
import ExternalAgentDetail from './ExternalAgentDetail';
import DeploymentTab from './DeploymentTab';
import FlowsTab from './FlowsTab';
import CapabilitiesTab from './CapabilitiesTab';
import PlatformConnectionsHub from './PlatformConnectionsHub';
import { ChatWidget } from '../../chat-widget/ChatWidget';
import { PhoneMockup } from '../../components/PhoneMockup';

const INITIAL_PLATFORM_CONNECTIONS = [
  {
    id: 'copilot-it-helpdesk',
    name: 'IT Helpdesk Agent',
    provider: 'Microsoft Copilot Studio',
    providerColor: '#0078d4',
    type: 'full_agent',
    status: 'connected',
    health: 'Healthy',
    latency: '310ms',
    lastSync: '3 mins ago',
    description: 'Enterprise IT support agent handling device, software, security, and service desk requests.',
    authMethod: 'entra',
    endpoint: 'https://copilot-it-helpdesk.api.staffbase.internal/mcp',
    agentMeta: {
      supportedTopics: ['IT Support', 'Device Management', 'Security', 'Software'],
      multiTurn: true,
      maxTurns: 10,
      confidenceThreshold: 0.80,
      fallbackBehavior: 'Escalate to human agent',
      userContextType: 'Entra ID JWT',
    },
    subTools: [
      { name: 'ServiceNow', purpose: 'Ticket creation and status' },
      { name: 'Microsoft Teams', purpose: 'User notifications' },
      { name: 'Azure AD', purpose: 'Identity & group membership lookup' },
    ],
    knowledgeBases: [
      { name: 'IT Wiki', source: 'SharePoint', articleCount: 847, lastSync: '2h ago' },
      { name: 'Confluence IT Docs', source: 'Confluence', articleCount: 234, lastSync: '6h ago' },
    ],
    tools: [
      {
        id: 'handle_it_request', name: 'handle_it_request', title: 'Handle IT Request',
        description: "Primary entry point — routes the user's IT request to the appropriate sub-system or knowledge base.",
        category: 'agent',
        inputSchema: [
          { name: 'user_message', type: 'string', required: true, desc: "The user's natural language IT request" },
          { name: 'user_id', type: 'string', required: true, desc: 'Entra ID object ID of the requesting user' },
          { name: 'conversation_id', type: 'string', required: false, desc: 'Multi-turn session ID for context continuity' },
        ],
      },
      {
        id: 'get_ticket_status', name: 'get_ticket_status', title: 'Get Ticket Status',
        description: 'Retrieves current status, comments, and SLA info for a ServiceNow incident.',
        category: 'data',
        inputSchema: [
          { name: 'ticket_id', type: 'string', required: true, desc: 'ServiceNow incident ID (e.g. INC0001234)' },
          { name: 'user_id', type: 'string', required: true, desc: 'Entra ID of requesting user (for auth check)' },
        ],
      },
      {
        id: 'search_it_knowledge', name: 'search_it_knowledge', title: 'Search IT Knowledge',
        description: 'Semantic search across IT Wiki (SharePoint) and Confluence IT Docs.',
        category: 'search',
        inputSchema: [
          { name: 'query', type: 'string', required: true, desc: 'Search query in natural language' },
          { name: 'source', type: 'enum: sharepoint | confluence | all', required: false, desc: 'Restrict search to a specific knowledge source' },
          { name: 'max_results', type: 'number', required: false, desc: 'Maximum articles to return (default 5)' },
        ],
      },
      {
        id: 'escalate_to_human', name: 'escalate_to_human', title: 'Escalate to Human',
        description: 'Creates a priority ServiceNow ticket and notifies the on-call IT team via Microsoft Teams.',
        category: 'escalation',
        inputSchema: [
          { name: 'reason', type: 'string', required: true, desc: 'Why the agent is escalating (shown to IT agent)' },
          { name: 'conversation_summary', type: 'string', required: true, desc: 'Summary of the conversation so far' },
          { name: 'priority', type: 'enum: medium | high | critical', required: false, desc: 'Escalation urgency level' },
        ],
      },
    ],
    navigatorEnabled: true,
    navigatorGroups: ['IT Team'],
    catalogCategory: 'Core systems',
    catalogPopularityRank: 2,
    connectorTypeLabel: 'External Assistant',
    connectorTrustLevel: 'verified',
    connectionLifecycleState: 'connected',
    toolRestrictions: { mode: 'role_based', restrictedToolIds: ['escalate_to_human'] },
    connectionState: 'connected',
    lastUsedAt: '5 mins ago',
    lastTestedAt: '12 mins ago',
    lastError: null,
    usageCount: 428,
    operationEvents: [
      { id: 'it-op-1', at: '10:42', type: 'test', status: 'success', message: 'Connection test succeeded in 241ms.' },
      { id: 'it-op-2', at: '10:17', type: 'invoke', status: 'success', message: 'External assistant invocation routed successfully.' },
      { id: 'it-op-3', at: '09:52', type: 'reconnect', status: 'success', message: 'Token refreshed and connector revalidated.' },
    ],
  },
  {
    id: 'gemini-hr-workday',
    name: 'HR Workday Agent',
    provider: 'Google Vertex AI / Gemini',
    providerColor: '#1a73e8',
    type: 'full_agent',
    status: 'connected',
    health: 'Healthy',
    latency: '420ms',
    lastSync: '8 mins ago',
    description: 'Google Gemini-powered HR agent for leave management, payroll queries, benefits, and onboarding — backed by Workday.',
    authMethod: 'google_oidc',
    endpoint: 'https://gemini-hr-workday.api.staffbase.internal/mcp',
    agentMeta: {
      supportedTopics: ['HR', 'Leave Management', 'Payroll', 'Benefits', 'Onboarding'],
      multiTurn: true,
      maxTurns: 8,
      confidenceThreshold: 0.75,
      fallbackBehavior: 'Return "contact HR team" response',
      userContextType: 'Google OIDC token',
    },
    subTools: [
      { name: 'Workday', purpose: 'Employee records, leave balances, payslips' },
      { name: 'Google Drive', purpose: 'HR policy documents' },
      { name: 'Google Calendar', purpose: 'Leave calendar visibility' },
    ],
    knowledgeBases: [
      { name: 'HR Policy Library', source: 'Google Drive', articleCount: 156, lastSync: '1h ago' },
      { name: 'Employee Handbook', source: 'Google Drive', articleCount: 48, lastSync: '12h ago' },
    ],
    tools: [
      {
        id: 'query_hr', name: 'query_hr', title: 'Query HR',
        description: 'Primary conversational entry point for all HR questions — routes to specialized sub-tools.',
        category: 'agent',
        inputSchema: [
          { name: 'user_message', type: 'string', required: true, desc: "The user's natural language HR question" },
          { name: 'employee_id', type: 'string', required: true, desc: 'Workday employee ID' },
          { name: 'conversation_id', type: 'string', required: false, desc: 'Session ID for multi-turn continuity' },
        ],
      },
      {
        id: 'get_leave_balance', name: 'get_leave_balance', title: 'Get Leave Balance',
        description: 'Returns current leave balances for all leave types from Workday.',
        category: 'data',
        inputSchema: [
          { name: 'employee_id', type: 'string', required: true, desc: 'Workday employee ID' },
          { name: 'leave_type', type: 'enum: vacation | sick | personal | all', required: false, desc: 'Filter by leave type (default: all)' },
        ],
      },
      {
        id: 'submit_leave_request', name: 'submit_leave_request', title: 'Submit Leave Request',
        description: 'Submits a leave request in Workday and adds the absence to Google Calendar.',
        category: 'action',
        inputSchema: [
          { name: 'employee_id', type: 'string', required: true, desc: 'Workday employee ID' },
          { name: 'leave_type', type: 'enum: vacation | sick | personal | parental', required: true, desc: 'Type of leave' },
          { name: 'start_date', type: 'string (ISO 8601)', required: true, desc: 'Leave start date' },
          { name: 'end_date', type: 'string (ISO 8601)', required: true, desc: 'Leave end date' },
          { name: 'notes', type: 'string', required: false, desc: 'Optional notes to manager' },
        ],
      },
      {
        id: 'search_hr_policies', name: 'search_hr_policies', title: 'Search HR Policies',
        description: 'Semantic search across HR Policy Library and Employee Handbook in Google Drive.',
        category: 'search',
        inputSchema: [
          { name: 'query', type: 'string', required: true, desc: 'Policy question in natural language' },
          { name: 'max_results', type: 'number', required: false, desc: 'Maximum documents to return (default 3)' },
        ],
      },
      {
        id: 'get_payslip', name: 'get_payslip', title: 'Get Payslip',
        description: "Returns a link to the employee's most recent payslip PDF from Workday.",
        category: 'data',
        inputSchema: [
          { name: 'employee_id', type: 'string', required: true, desc: 'Workday employee ID' },
          { name: 'period', type: 'string (YYYY-MM)', required: false, desc: 'Payroll period (default: most recent)' },
        ],
      },
    ],
    navigatorEnabled: true,
    navigatorGroups: [],
    catalogCategory: 'HR',
    catalogPopularityRank: 3,
    connectorTypeLabel: 'External Assistant',
    connectorTrustLevel: 'verified',
    connectionLifecycleState: 'restricted',
    toolRestrictions: { mode: 'group_based', restrictedToolIds: [] },
    connectionState: 'testing',
    lastUsedAt: '23 mins ago',
    lastTestedAt: '1 min ago',
    lastError: null,
    usageCount: 196,
    operationEvents: [
      { id: 'hr-op-1', at: '10:49', type: 'test', status: 'running', message: 'Connection test currently in progress.' },
      { id: 'hr-op-2', at: '10:11', type: 'invoke', status: 'success', message: 'Payroll question answered via linked assistant.' },
      { id: 'hr-op-3', at: '09:36', type: 'reconnect', status: 'success', message: 'Connector reconnected after credential refresh.' },
    ],
  },
  {
    id: 'zendesk-support',
    name: 'Zendesk Support',
    provider: 'Zendesk',
    providerColor: '#03363d',
    type: 'tool_server',
    status: 'connected',
    health: 'Healthy',
    latency: '190ms',
    lastSync: '1 min ago',
    description: 'Zendesk MCP Tool Server for support ticket management and knowledge base search. No agent routing — direct tool invocation.',
    authMethod: 'oauth2',
    endpoint: 'https://staffbase.zendesk.com/api/mcp/v1',
    agentMeta: null,
    subTools: [],
    knowledgeBases: [],
    tools: [
      {
        id: 'create_ticket', name: 'create_ticket', title: 'Create Ticket',
        description: 'Creates a new Zendesk support ticket on behalf of the user.',
        category: 'action',
        inputSchema: [
          { name: 'subject', type: 'string', required: true, desc: 'Ticket subject line' },
          { name: 'description', type: 'string', required: true, desc: 'Full description of the issue' },
          { name: 'requester_email', type: 'string', required: true, desc: 'Email of the user submitting the ticket' },
          { name: 'priority', type: 'enum: low | normal | high | urgent', required: false, desc: 'Ticket priority (default: normal)' },
          { name: 'tags', type: 'string[]', required: false, desc: 'Optional tags for categorization' },
        ],
      },
      {
        id: 'get_ticket', name: 'get_ticket', title: 'Get Ticket',
        description: 'Retrieves the full details of a Zendesk ticket by ID.',
        category: 'data',
        inputSchema: [
          { name: 'ticket_id', type: 'number', required: true, desc: 'Zendesk ticket ID' },
        ],
      },
      {
        id: 'update_ticket', name: 'update_ticket', title: 'Update Ticket',
        description: 'Adds a comment or updates the status/priority of an existing ticket.',
        category: 'action',
        inputSchema: [
          { name: 'ticket_id', type: 'number', required: true, desc: 'Zendesk ticket ID' },
          { name: 'comment', type: 'string', required: false, desc: 'Public or private comment to add' },
          { name: 'public', type: 'boolean', required: false, desc: 'Whether the comment is visible to the requester (default: true)' },
          { name: 'status', type: 'enum: open | pending | hold | solved | closed', required: false, desc: 'New ticket status' },
          { name: 'priority', type: 'enum: low | normal | high | urgent', required: false, desc: 'Updated priority' },
        ],
      },
      {
        id: 'search_tickets', name: 'search_tickets', title: 'Search Tickets',
        description: 'Searches Zendesk tickets using Zendesk query syntax.',
        category: 'search',
        inputSchema: [
          { name: 'query', type: 'string', required: true, desc: 'Zendesk search query (e.g. "status:open type:ticket")' },
          { name: 'sort_by', type: 'enum: created_at | updated_at | priority | status', required: false, desc: 'Sort order' },
          { name: 'page_size', type: 'number', required: false, desc: 'Results per page (default: 10, max: 100)' },
        ],
      },
      {
        id: 'search_knowledge_base', name: 'search_knowledge_base', title: 'Search Knowledge Base',
        description: 'Full-text search across all Zendesk Help Center articles.',
        category: 'search',
        inputSchema: [
          { name: 'query', type: 'string', required: true, desc: 'Natural language or keyword search' },
          { name: 'locale', type: 'string', required: false, desc: 'BCP-47 locale code (e.g. "en-us")' },
          { name: 'max_results', type: 'number', required: false, desc: 'Max articles to return (default: 5)' },
        ],
      },
      {
        id: 'get_article', name: 'get_article', title: 'Get Article',
        description: 'Fetches the full content of a Zendesk Help Center article by ID.',
        category: 'data',
        inputSchema: [
          { name: 'article_id', type: 'number', required: true, desc: 'Zendesk article ID' },
          { name: 'locale', type: 'string', required: false, desc: 'Article locale (default: account default)' },
        ],
      },
      {
        id: 'list_macros', name: 'list_macros', title: 'List Macros',
        description: 'Returns available Zendesk macros the agent can apply to tickets.',
        category: 'data',
        inputSchema: [
          { name: 'active', type: 'boolean', required: false, desc: 'Filter to active macros only (default: true)' },
          { name: 'category', type: 'string', required: false, desc: 'Filter by macro category name' },
        ],
      },
    ],
    navigatorEnabled: false,
    navigatorGroups: [],
    catalogCategory: 'Support',
    catalogPopularityRank: 7,
    connectorTypeLabel: 'Tool Server',
    connectorTrustLevel: 'custom',
    connectionLifecycleState: 'disabled',
    toolRestrictions: { mode: 'manual', restrictedToolIds: ['update_ticket'] },
    connectionState: 'error',
    lastUsedAt: '2 hours ago',
    lastTestedAt: '19 mins ago',
    lastError: '401 from upstream API: OAuth token expired.',
    usageCount: 73,
    operationEvents: [
      { id: 'zd-op-1', at: '10:35', type: 'test', status: 'error', message: 'Authentication failed with 401 (token expired).' },
      { id: 'zd-op-2', at: '09:58', type: 'invoke', status: 'success', message: 'Ticket status fetched successfully.' },
      { id: 'zd-op-3', at: '09:12', type: 'disable', status: 'success', message: 'Navigator availability was disabled by admin.' },
    ],
  },
];

const INITIAL_ASSISTANTS = [
  {
    id: 'travel',
    type: 'internal',
    name: 'Travel Policy',
    status: 'active',
    selectedGroups: ['All Employees'],
    targetGroups: ['All Employees'],
    targetUsers: ['alex.meyer@staffbase.com'],
    assignedCapabilityIds: [],
  },
  {
    id: 'it',
    type: 'internal',
    name: 'IT Support',
    status: 'active',
    selectedGroups: ['All Employees'],
    targetGroups: ['All Employees'],
    targetUsers: ['maria.schmidt@staffbase.com', 'liam.chen@staffbase.com'],
    assignedCapabilityIds: ['zendesk-support:create_ticket', 'zendesk-support:get_ticket'],
  },
  {
    id: 'hr',
    type: 'internal',
    name: 'HR Assistant',
    status: 'active',
    selectedGroups: ['All Employees', 'Managers'],
    targetGroups: ['All Employees', 'Managers'],
    targetUsers: ['john.doe@staffbase.com'],
    assignedCapabilityIds: ['gemini-hr-workday:query_hr'],
  },
  {
    id: 'ext-copilot-it',
    type: 'external',
    name: 'IT Helpdesk (Copilot Studio)',
    provider: 'copilot_studio',
    groups: ['All Employees'],
    status: 'active',
    latency: '1.2s',
    completionRate: 94,
    attachment: 'standalone',
    description: 'Specialist IT agent connected through MCP.',
    targetGroups: ['All Employees'],
    targetUsers: ['maria.schmidt@staffbase.com'],
    sourceConnectorId: 'copilot-it-helpdesk',
    sourceConnectorName: 'IT Helpdesk Agent',
  },
  {
    id: 'ext-gemini-hr',
    type: 'external',
    name: 'HR Workday Agent (Gemini)',
    provider: 'gemini',
    groups: ['HR Team', 'Managers'],
    status: 'active',
    latency: '0.8s',
    completionRate: 97,
    attachment: 'standalone',
    description: 'Specialist HR/Workday agent connected through MCP.',
    targetGroups: ['HR Team', 'Managers'],
    targetUsers: ['john.doe@staffbase.com'],
    sourceConnectorId: 'gemini-hr-workday',
    sourceConnectorName: 'HR Workday Agent',
  },
];

const DEFAULT_POLICIES = {
  visibility: { enabled: true, mode: 'group_allowlist' },
  invocation: { enabled: true, mode: 'assistant_scoped' },
  data: { piiObfuscation: true, contextIsolation: true, traceEnabled: false },
};

function enrichConnections(connections) {
  return connections.map((connection) => ({
    ...connection,
    connectionType: connection.type,
    capabilities: (connection.tools || []).map((tool) => ({
      id: `${connection.id}:${tool.id}`,
      connectionId: connection.id,
      title: tool.title,
      category: tool.category,
      description: tool.description,
      inputSchema: tool.inputSchema || [],
    })),
    policyBindings: connection.policyBindings || [],
    attachments: connection.attachments || [],
    catalogCategory: connection.catalogCategory || 'General',
    catalogPopularityRank: connection.catalogPopularityRank || 99,
    connectorTypeLabel: connection.connectorTypeLabel || (connection.type === 'full_agent' ? 'External Assistant' : 'Tool Server'),
    connectorTrustLevel: connection.connectorTrustLevel || 'verified',
    connectionLifecycleState: connection.connectionLifecycleState || 'connected',
    toolRestrictions: connection.toolRestrictions || { mode: 'none', restrictedToolIds: [] },
    connectionState: connection.connectionState || (connection.status === 'connected' ? 'connected' : 'disabled'),
    lastUsedAt: connection.lastUsedAt || 'Never',
    lastTestedAt: connection.lastTestedAt || 'Never',
    lastError: connection.lastError || null,
    usageCount: connection.usageCount || 0,
    operationEvents: connection.operationEvents || [],
  }));
}

const AIAssistantStudio = ({ onBack }) => {
  const [currentModule, setCurrentModule] = useState('navigator');
  const [platformConnections, setPlatformConnections] = useState(enrichConnections(INITIAL_PLATFORM_CONNECTIONS));
  const [assistantAssignments, setAssistantAssignments] = useState(INITIAL_ASSISTANTS);
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);
  const [activeTab, setActiveTab] = useState('identity');
  const [showPreview, setShowPreview] = useState(true);
  const [isFloating, setIsFloating] = useState(true);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [selectedExternalAgent, setSelectedExternalAgent] = useState(null);
  const { success } = useNotification();

  const hasAgentConnector = platformConnections.some((connection) => connection.type === 'full_agent');

  const handleCreateExternal = () => {
    if (!hasAgentConnector) {
      setCurrentModule('connections');
      return;
    }
    setSelectedAssistant({ _new: true, _startExternal: true });
  };

  const handleSaveAll = () => {
    success('Workspace Saved', 'All Navigator configuration changes have been persisted across the network.');
  };

  const handleNavigatorScopeChange = (connectionId, enabled, groups) => {
    setPlatformConnections(prev => prev.map(c =>
      c.id === connectionId ? { ...c, navigatorEnabled: enabled, navigatorGroups: groups } : c
    ));
  };

  const handleAddPlatformConnection = (newConn) => {
    setPlatformConnections(prev => [...enrichConnections([newConn]), ...prev]);
  };

  const handleUpdateAssistant = (updatedAssistant) => {
    setAssistantAssignments((prev) =>
      prev.map((assistant) => (assistant.id === updatedAssistant.id ? updatedAssistant : assistant))
    );
    setSelectedAssistant((prev) => (prev && prev.id === updatedAssistant.id ? updatedAssistant : prev));
  };

  const allCapabilities = platformConnections.flatMap((connection) => connection.capabilities || []);
  const capabilitiesById = allCapabilities.reduce((acc, capability) => {
    acc[capability.id] = capability;
    return acc;
  }, {});

  const tabs = [
    { id: 'identity', label: 'Identity' },
    { id: 'assistants', label: 'Assistants' },
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'capabilities', label: 'Connectors' },
    { id: 'flows', label: 'Explore Flows' },
    { id: 'branding', label: 'Branding' },
    { id: 'settings', label: 'Settings' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'deployment', label: 'Deployment' },
  ];

  return (
    <StudioShell
      activeSidebarItem={currentModule === 'connections' ? 'Connectors' : 'Navigator'}
      onNavigatorClick={() => setCurrentModule('navigator')}
      onConnectionsClick={() => setCurrentModule('connections')}
    >
      {currentModule === 'connections' ? (
        <PlatformConnectionsHub
          connections={platformConnections}
          assistants={assistantAssignments}
          onAdd={handleAddPlatformConnection}
          onUpdate={(updated) => setPlatformConnections(prev => prev.map(c => c.id === updated.id ? updated : c))}
          onUpdateAssistants={setAssistantAssignments}
          onNavigateToNavigator={() => setCurrentModule('navigator')}
        />
      ) : (
        <>
          <FeatureHeader
            title="Navigator"
            subtitle="Configure Navigator settings and preferences"
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            actions={
              <button
                onClick={handleSaveAll}
                className="px-5 py-1.5 bg-[#111827] text-white text-[13px] font-bold rounded-md shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Check size={14} />
                Save All Changes
              </button>
            }
          />

          <div className="flex-1 overflow-hidden flex origin-top-left transition-all duration-500">
            <div className="flex-1 overflow-y-auto p-8 bg-[#F9FAFB] transition-all duration-500 ease-in-out">
              <div className="max-w-full mx-auto">
                {activeTab === 'identity' && <IdentityTab />}
                {activeTab === 'knowledge' && <KnowledgeTab />}
                {activeTab === 'branding' && <BrandingTab />}
                {activeTab === 'assistants' && !selectedAssistant && !selectedExternalAgent && (
                  <AssistantsTab
                    assistants={assistantAssignments}
                    connectors={platformConnections}
                    hasAgentConnector={hasAgentConnector}
                    onSelect={setSelectedAssistant}
                    onSelectExternal={setSelectedExternalAgent}
                    onCreateExternal={handleCreateExternal}
                  />
                )}
                {activeTab === 'assistants' && selectedAssistant && selectedAssistant._new && (
                  <AssistantWizard
                    platformConnections={platformConnections}
                    onBack={() => setSelectedAssistant(null)}
                    onComplete={(assistant) => {
                      const connector = platformConnections.find((connection) => connection.id === assistant.sourceConnectorId);
                      const mergedAssistant = {
                        ...assistant,
                        assignedCapabilityIds: assistant.assignedCapabilityIds || [],
                        targetGroups: assistant.targetGroups || assistant.selectedGroups || [],
                        targetUsers: assistant.targetUsers || [],
                        sourceConnectorName: assistant.sourceConnectorName || connector?.name || null,
                      };
                      setAssistantAssignments(prev => [mergedAssistant, ...prev]);
                      if (mergedAssistant.type === 'external') {
                        setSelectedAssistant(null);
                        setSelectedExternalAgent(mergedAssistant);
                        return;
                      }
                      setSelectedAssistant(mergedAssistant);
                    }}
                    startExternal={selectedAssistant._startExternal === true}
                    agentConnectors={platformConnections.filter((connection) => connection.type === 'full_agent')}
                  />
                )}
                {activeTab === 'assistants' && selectedAssistant && !selectedAssistant._new && (
                  <AssistantDetail
                    assistant={selectedAssistant}
                    connectors={platformConnections}
                    capabilityIndex={capabilitiesById}
                    onAssistantUpdate={handleUpdateAssistant}
                    onBack={() => setSelectedAssistant(null)}
                  />
                )}
                {activeTab === 'assistants' && selectedExternalAgent && (
                  <ExternalAgentDetail
                    agent={selectedExternalAgent}
                    connectors={platformConnections}
                    policyProfile={policies}
                    onAgentUpdate={(updatedAssistant) => {
                      setAssistantAssignments((prev) =>
                        prev.map((assistant) => (assistant.id === updatedAssistant.id ? updatedAssistant : assistant))
                      );
                      setSelectedExternalAgent((prev) => (prev && prev.id === updatedAssistant.id ? updatedAssistant : prev));
                    }}
                    onOpenConnectors={() => {
                      setCurrentModule('connections');
                      setSelectedExternalAgent(null);
                    }}
                    onBack={() => setSelectedExternalAgent(null)}
                  />
                )}
                {activeTab === 'capabilities' && (
                  <CapabilitiesTab
                    platformConnections={platformConnections}
                    assistantAssignments={assistantAssignments}
                    onNavigate={setCurrentModule}
                  />
                )}
                {activeTab === 'flows' && <FlowsTab />}
                {activeTab === 'deployment' && <DeploymentTab />}
                {activeTab === 'settings' && <SettingsTab />}
                {activeTab === 'analytics' && <AnalyticsTab />}
              </div>
            </div>

            {showPreview && (
              <div className="w-[600px] border-l border-[#E5E7EB] bg-[#F1F3FB] flex flex-col items-center justify-center p-12 shrink-0 relative shadow-inner overflow-hidden">
                <button
                  onClick={() => setShowPreview(false)}
                  className="absolute top-6 right-6 text-[12px] font-bold text-[#94A3B8] hover:text-[#111827] uppercase tracking-widest z-50 transition-colors"
                >
                  Hide Preview
                </button>

                <div className="relative w-full max-w-[440px] animate-in slide-in-from-right-12 duration-700 ease-out">
                  <PhoneMockup>
                    {isFloating ? (
                      <div className="flex flex-col items-center justify-center h-full bg-[#F8FAFC] text-[#94A3B8] p-10 text-center">
                        <div className="relative mb-6">
                          <div className="text-[#94A3B8] filter grayscale opacity-50 flex justify-center">
                            <Smartphone size={64} strokeWidth={1} />
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-[#7B5CE3] text-white p-2 rounded-full shadow-lg animate-pulse">
                            <ExternalLink size={20} strokeWidth={2.5} />
                          </div>
                        </div>
                        <div className="text-[15px] font-bold text-[#475569] uppercase tracking-widest mb-3">Floating Mode</div>
                        <p className="text-[13px] leading-relaxed mb-8 px-4 font-medium text-[#64748B]">
                          The Navigator is now decoupled for high-priority testing.
                        </p>
                        <button
                          onClick={() => setIsFloating(false)}
                          className="px-6 py-2 bg-[#7B5CE3] text-white text-[13px] font-bold rounded-xl shadow-[0_4px_12px_rgba(123,92,227,0.3)] hover:scale-105 transition-all"
                        >
                          Dock to Sidebar
                        </button>
                      </div>
                    ) : (
                      <div className="relative h-full">
                        <button
                          onClick={() => setIsFloating(true)}
                          className="absolute top-4 right-4 z-[60] bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm border border-black/5 hover:scale-110 transition-all text-[#7B5CE3]"
                          title="Pop out to floating mode"
                        >
                          <ExternalLink size={18} strokeWidth={2.5} />
                        </button>
                        <ChatWidget enabledActions={['gemini-workday:connect', 'copilot-studio:connect']} />
                      </div>
                    )}
                  </PhoneMockup>
                </div>

                {isFloating && (
                  <ChatWidget variant="floating" enabledActions={['gemini-workday:connect', 'copilot-studio:connect']} />
                )}
              </div>
            )}

            {!showPreview && (
              <button
                onClick={() => setShowPreview(true)}
                className="absolute bottom-6 right-6 w-12 h-12 bg-[#111827] text-white rounded-full shadow-lg flex items-center justify-center text-[20px] hover:scale-110 transition-all z-50 animate-bounce"
              >
                <Smartphone size={20} />
              </button>
            )}
          </div>
        </>
      )}
    </StudioShell>
  );
};

export default AIAssistantStudio;
