import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Store,
  Wrench,
  Server,
  Sparkles,
  Shield,
  Activity,
  ScrollText,
  ChevronDown,
  ChevronUp,
  X,
  LayoutGrid,
  MoreHorizontal,
} from 'lucide-react';
import { FeatureHeader, SettingsCard } from '../../components/SettingsCard';
import { Modal } from '../../components/Modal';
import { useNotification } from '../../components/NotificationProvider';

const CATEGORY_STYLES = {
  agent: 'bg-violet-50 text-violet-700 border-violet-200',
  action: 'bg-blue-50 text-blue-700 border-blue-200',
  search: 'bg-green-50 text-green-700 border-green-200',
  escalation: 'bg-orange-50 text-orange-700 border-orange-200',
  data: 'bg-slate-100 text-slate-700 border-slate-200',
};

const MARKETPLACE_INTEGRATIONS = [
  {
    id: 'zendesk',
    name: 'Zendesk',
    provider: 'Zendesk',
    logoUrl: 'https://cdn.simpleicons.org/zendesk',
    connectorType: 'Action',
    sourceCategory: 'Support',
    authModes: ['OAuth', 'API Key'],
    statusTag: 'Popular',
    description: 'Ticket operations and help center search.',
    capabilitySummary: ['Create ticket', 'Search tickets', 'Get article'],
    connectionType: 'tool_server',
  },
  {
    id: 'copilot_studio',
    name: 'Copilot Studio Agent',
    provider: 'Microsoft Copilot Studio',
    logoUrl: 'https://cdn.simpleicons.org/microsoft',
    connectorType: 'External Assistant',
    sourceCategory: 'Core systems',
    authModes: ['OAuth', 'Service account'],
    statusTag: 'Featured',
    description: 'Delegate to prebuilt Copilot agents.',
    capabilitySummary: ['Agent handoff', 'Context-aware replies', 'Escalation'],
    connectionType: 'full_agent',
  },
  {
    id: 'gemini',
    name: 'Gemini Workspace Agent',
    provider: 'Google Gemini',
    logoUrl: 'https://cdn.simpleicons.org/google',
    connectorType: 'External Assistant',
    sourceCategory: 'Core systems',
    authModes: ['OAuth'],
    statusTag: 'Featured',
    description: 'Google-powered assistant for HR and policy flows.',
    capabilitySummary: ['Q&A', 'Workflow actions', 'Knowledge retrieval'],
    connectionType: 'full_agent',
  },
  {
    id: 'jira',
    name: 'Jira',
    provider: 'Atlassian Jira',
    logoUrl: 'https://cdn.simpleicons.org/jira',
    connectorType: 'Action',
    sourceCategory: 'Dev tools',
    authModes: ['OAuth', 'API Key'],
    statusTag: 'Core',
    description: 'Issue management and sprint operations.',
    capabilitySummary: ['Create issue', 'Transition issue', 'Search board'],
    connectionType: 'tool_server',
  },
  {
    id: 'slack',
    name: 'Slack',
    provider: 'Slack',
    logoUrl: 'https://cdn.simpleicons.org/slack',
    connectorType: 'Mixed',
    sourceCategory: 'Core systems',
    authModes: ['OAuth'],
    statusTag: 'Core',
    description: 'Channel messages, notifications, approvals.',
    capabilitySummary: ['Send message', 'List channels', 'Post updates'],
    connectionType: 'tool_server',
  },
  {
    id: 'confluence',
    name: 'Confluence',
    provider: 'Atlassian Confluence',
    logoUrl: 'https://cdn.simpleicons.org/confluence',
    connectorType: 'Knowledge',
    sourceCategory: 'Support',
    authModes: ['OAuth', 'API Key'],
    statusTag: 'Knowledge',
    description: 'Enterprise wiki and knowledge retrieval.',
    capabilitySummary: ['Search pages', 'Read docs', 'Reference sources'],
    connectionType: 'tool_server',
  },
  {
    id: 'workday',
    name: 'Workday',
    provider: 'Workday',
    logoUrl: 'https://cdn.simpleicons.org/workday',
    connectorType: 'Mixed',
    sourceCategory: 'HR',
    authModes: ['Service account', 'OAuth'],
    statusTag: 'HR',
    description: 'Employee records and HR workflows.',
    capabilitySummary: ['Leave balance', 'Payslip info', 'Request actions'],
    connectionType: 'tool_server',
  },
  {
    id: 'servicenow',
    name: 'ServiceNow',
    provider: 'ServiceNow',
    logoUrl: 'https://cdn.simpleicons.org/servicenow',
    connectorType: 'Action',
    sourceCategory: 'Support',
    authModes: ['OAuth', 'Service account'],
    statusTag: 'Enterprise',
    description: 'ITSM incidents and service workflows.',
    capabilitySummary: ['Create incident', 'Get status', 'Escalate'],
    connectionType: 'tool_server',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    provider: 'Salesforce',
    logoUrl: 'https://cdn.simpleicons.org/salesforce',
    connectorType: 'Mixed',
    sourceCategory: 'Core systems',
    authModes: ['OAuth'],
    statusTag: 'CRM',
    description: 'CRM records, opportunities, and account workflows.',
    capabilitySummary: ['Lookup account', 'Create lead', 'Update opportunity'],
    connectionType: 'tool_server',
  },
  {
    id: 'github',
    name: 'GitHub',
    provider: 'GitHub',
    logoUrl: 'https://cdn.simpleicons.org/github',
    connectorType: 'Action',
    sourceCategory: 'Dev tools',
    authModes: ['OAuth', 'API Key'],
    statusTag: 'Dev',
    description: 'Pull requests, issues, and code insights.',
    capabilitySummary: ['Create issue', 'List PRs', 'Comment'],
    connectionType: 'tool_server',
  },
];

const PROVIDER_TEMPLATES = {
  zendesk: { name: 'Zendesk', color: '#03363d', type: 'tool_server' },
  copilot_studio: { name: 'Microsoft Copilot Studio', color: '#0078d4', type: 'full_agent' },
  gemini: { name: 'Google Vertex AI / Gemini', color: '#1a73e8', type: 'full_agent' },
  jira: { name: 'Atlassian Jira', color: '#0052cc', type: 'tool_server' },
  slack: { name: 'Slack', color: '#4A154B', type: 'tool_server' },
  confluence: { name: 'Atlassian Confluence', color: '#172b4d', type: 'tool_server' },
  workday: { name: 'Workday', color: '#f37021', type: 'tool_server' },
  servicenow: { name: 'ServiceNow', color: '#81b441', type: 'tool_server' },
  salesforce: { name: 'Salesforce', color: '#00A1E0', type: 'tool_server' },
  github: { name: 'GitHub', color: '#24292f', type: 'tool_server' },
  custom_mcp: { name: 'Custom MCP Tool Server', color: '#334155', type: 'tool_server' },
  from_scratch: { name: 'From Scratch', color: '#111827', type: 'tool_server' },
};

const MOCK_DISCOVERY_BY_PROVIDER = {
  full_agent: {
    agentMeta: {
      supportedTopics: ['General Assistance', 'Knowledge Q&A', 'Workflow Execution'],
      multiTurn: true,
      maxTurns: 8,
      confidenceThreshold: 0.75,
      fallbackBehavior: 'Escalate to human support',
      userContextType: 'Signed Staffbase JWT',
    },
    subTools: [
      { name: 'ServiceNow', purpose: 'Ticket lifecycle operations' },
      { name: 'Workday', purpose: 'HR requests and approvals' },
      { name: 'Teams', purpose: 'Live escalations and notifications' },
    ],
    knowledgeBases: [
      { name: 'Company Knowledge', source: 'Confluence', articleCount: 312, lastSync: '2h ago' },
      { name: 'Policy Docs', source: 'SharePoint', articleCount: 188, lastSync: '6h ago' },
    ],
    tools: [
      {
        id: 'route_user_request',
        name: 'route_user_request',
        title: 'Route User Request',
        description: 'Primary conversational entry point that routes internally by intent and context.',
        category: 'agent',
        inputSchema: [
          { name: 'user_message', type: 'string', required: true, desc: 'User query in natural language' },
          { name: 'user_id', type: 'string', required: true, desc: 'Stable user identifier' },
          { name: 'conversation_id', type: 'string', required: false, desc: 'Session ID for multi-turn continuity' },
        ],
      },
      {
        id: 'search_knowledge',
        name: 'search_knowledge',
        title: 'Search Knowledge',
        description: 'Semantic retrieval across connected enterprise document sources.',
        category: 'search',
        inputSchema: [
          { name: 'query', type: 'string', required: true, desc: 'Search prompt' },
          { name: 'max_results', type: 'number', required: false, desc: 'Maximum result count' },
        ],
      },
      {
        id: 'handoff_to_human',
        name: 'handoff_to_human',
        title: 'Handoff to Human',
        description: 'Escalates unresolved requests to human support channels.',
        category: 'escalation',
        inputSchema: [
          { name: 'reason', type: 'string', required: true, desc: 'Reason for escalation' },
          { name: 'summary', type: 'string', required: true, desc: 'Conversation summary' },
        ],
      },
    ],
  },
  tool_server: {
    agentMeta: null,
    subTools: [],
    knowledgeBases: [],
    tools: [
      {
        id: 'create_ticket',
        name: 'create_ticket',
        title: 'Create Ticket',
        description: 'Creates a support request in external service.',
        category: 'action',
        inputSchema: [
          { name: 'subject', type: 'string', required: true, desc: 'Ticket subject' },
          { name: 'description', type: 'string', required: true, desc: 'Issue details' },
        ],
      },
      {
        id: 'get_ticket',
        name: 'get_ticket',
        title: 'Get Ticket',
        description: 'Fetches ticket status and latest updates by ticket ID.',
        category: 'data',
        inputSchema: [{ name: 'ticket_id', type: 'string', required: true, desc: 'External ticket id' }],
      },
      {
        id: 'search_tickets',
        name: 'search_tickets',
        title: 'Search Tickets',
        description: 'Searches historical requests by query or metadata.',
        category: 'search',
        inputSchema: [{ name: 'query', type: 'string', required: true, desc: 'Search expression' }],
      },
    ],
  },
};

function ToolsTable({ tools }) {
  const [expandedTools, setExpandedTools] = useState({});
  return (
    <div className="space-y-2">
      {tools.map((tool) => {
        const expanded = expandedTools[tool.id] === true;
        return (
          <div key={tool.id} className="border border-[#E5E7EB] rounded-xl bg-white">
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-[#111827]">{tool.title}</span>
                  <code className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded font-mono">{tool.name}</code>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_STYLES[tool.category] || CATEGORY_STYLES.data}`}>
                    {tool.category}
                  </span>
                </div>
                <p className="text-[12px] text-[#64748B] mt-0.5">{tool.description}</p>
              </div>
              <button
                onClick={() => setExpandedTools((prev) => ({ ...prev, [tool.id]: !expanded }))}
                className="p-1 text-[#94A3B8] hover:text-[#111827] transition-colors"
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
            {expanded && (
              <div className="border-t border-[#F1F5F9] px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-2">Input Schema</div>
                <div className="space-y-1.5">
                  {tool.inputSchema.map((param) => (
                    <div key={param.name} className="flex items-start gap-2 text-[12px]">
                      <code className="font-mono font-bold text-[#7C3AED] shrink-0">{param.name}</code>
                      <span className="text-[#94A3B8] shrink-0">{param.type}{param.required ? '' : '?'}</span>
                      <span className="text-[#64748B]">- {param.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const RISK_BY_CATEGORY = {
  search: 'Read',
  data: 'Read',
  action: 'Write',
  escalation: 'Destructive',
  agent: 'External assistant',
};

const MARKETPLACE_RISK_SUMMARY = {
  zendesk: 'Moderate — can create and update support tickets; user-visible in Zendesk.',
  copilot_studio: 'High — full assistant delegation; review tool exposure and PII flow.',
  gemini: 'High — model-assisted responses; validate grounding and data residency.',
  jira: 'Moderate — issue lifecycle writes and search across your Jira data.',
  slack: 'Moderate — can post to channels; scope OAuth to required workspaces only.',
  confluence: 'Lower — read-heavy; control spaces linked to the assistant.',
  workday: 'High — employee data; restrict access and use least privilege.',
  servicenow: 'Moderate — ITSM actions can change production records.',
  salesforce: 'High — CRM writes and lookups; use field-level security policies.',
  github: 'Moderate — issues and PRs; review org/repo scope and secrets.',
  custom_mcp: 'Unverified — treat as high risk until you review tools list and policy.',
  from_scratch: 'Unverified — you will define capabilities and access rules manually.',
};

const QUICK_PATHS = [
  { id: 'support', label: 'Support & ITSM', category: 'Support' },
  { id: 'dev', label: 'Dev & docs', category: 'Dev tools' },
  { id: 'core', label: 'Core systems', category: 'Core systems' },
  { id: 'hr', label: 'HR & payroll', category: 'HR' },
];

const AUTH_MODE_FILTER_OPTIONS = ['', 'OAuth', 'API Key', 'Service account'];

function authLabelToMethod(label) {
  if (label === 'OAuth') return 'oauth2';
  if (label === 'API Key') return 'apikey';
  if (label === 'Service account') return 'service_account';
  return 'oauth2';
}

function MarketplaceLogo({ name, color, src, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const initials = useMemo(
    () => (name || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
    [name]
  );
  if (failed || !src) {
    return (
      <div
        className="shrink-0 rounded-xl flex items-center justify-center text-white text-[12px] font-bold"
        style={{ width: size, height: size, backgroundColor: color || '#64748B' }}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-xl object-contain bg-white border border-[#E5E7EB]"
      onError={() => setFailed(true)}
    />
  );
}

function AddPlatformConnectionWizard({ isOpen, onClose, onComplete, assistants = [] }) {
  const { success, error } = useNotification();
  const [flowStage, setFlowStage] = useState(1);
  const [installStep, setInstallStep] = useState(0);
  const [browseMode, setBrowseMode] = useState('all');
  const [quickPathCategory, setQuickPathCategory] = useState(null);
  const [selectedEntryId, setSelectedEntryId] = useState(MARKETPLACE_INTEGRATIONS[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterConnectorType, setFilterConnectorType] = useState('');
  const [filterSourceCategory, setFilterSourceCategory] = useState('');
  const [filterAuthMode, setFilterAuthMode] = useState('');
  const [sortBy, setSortBy] = useState('recommended');

  const [connectionType, setConnectionType] = useState('tool_server');
  const [template, setTemplate] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [owner, setOwner] = useState('Navigator Admin Team');
  const [environment, setEnvironment] = useState('production');
  const [authMethod, setAuthMethod] = useState('oauth2');
  const [testState, setTestState] = useState('idle');
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState(null);
  const [assignNavigator, setAssignNavigator] = useState(true);
  const [assistantToggles, setAssistantToggles] = useState({});
  const [accessModel, setAccessModel] = useState('everyone');
  const [safetyDefaults, setSafetyDefaults] = useState({
    requireConfirmation: true,
    allowAutonomousExecution: false,
    allowMultiStep: true,
    sendUserProfile: false,
    sendConversation: true,
    maskSensitiveData: true,
    logFullPayload: true,
  });

  const selectedProvider = template ? PROVIDER_TEMPLATES[template] : null;
  const selectedEntry = useMemo(
    () => MARKETPLACE_INTEGRATIONS.find((e) => e.id === selectedEntryId) || null,
    [selectedEntryId]
  );

  const uniqueConnectorTypes = useMemo(
    () => [...new Set(MARKETPLACE_INTEGRATIONS.map((e) => e.connectorType))].sort(),
    []
  );
  const uniqueSourceCategories = useMemo(
    () => [...new Set(MARKETPLACE_INTEGRATIONS.map((e) => e.sourceCategory))].sort(),
    []
  );

  const filteredCatalog = useMemo(() => {
    let list = [...MARKETPLACE_INTEGRATIONS];
    if (browseMode === 'featured') {
      list = list.filter((e) => e.statusTag === 'Featured' || e.statusTag === 'Popular' || e.statusTag === 'Core');
    }
    if (quickPathCategory) {
      list = list.filter((e) => e.sourceCategory === quickPathCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.provider.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      );
    }
    if (filterConnectorType) list = list.filter((e) => e.connectorType === filterConnectorType);
    if (filterSourceCategory) list = list.filter((e) => e.sourceCategory === filterSourceCategory);
    if (filterAuthMode) {
      list = list.filter((e) => e.authModes.includes(filterAuthMode));
    }
    if (sortBy === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortBy === 'type') list.sort((a, b) => a.connectorType.localeCompare(b.connectorType) || a.name.localeCompare(b.name));
    else {
      const score = (e) => (e.statusTag === 'Featured' ? 0 : e.statusTag === 'Popular' ? 1 : 2);
      list.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
    }
    return list;
  }, [
    browseMode, quickPathCategory, searchQuery, filterConnectorType, filterSourceCategory, filterAuthMode, sortBy,
  ]);

  useEffect(() => {
    if (flowStage !== 1 || !isOpen) return;
    if (filteredCatalog.length === 0) return;
    if (!filteredCatalog.some((e) => e.id === selectedEntryId)) {
      setSelectedEntryId(filteredCatalog[0].id);
    }
  }, [flowStage, isOpen, filteredCatalog, selectedEntryId]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (searchQuery.trim()) chips.push({ key: 'q', label: `Search: ${searchQuery.trim()}`, clear: () => setSearchQuery('') });
    if (filterConnectorType) chips.push({ key: 'ct', label: `Type: ${filterConnectorType}`, clear: () => setFilterConnectorType('') });
    if (filterSourceCategory) chips.push({ key: 'sc', label: `Category: ${filterSourceCategory}`, clear: () => setFilterSourceCategory('') });
    if (filterAuthMode) chips.push({ key: 'am', label: `Auth: ${filterAuthMode}`, clear: () => setFilterAuthMode('') });
    if (quickPathCategory) chips.push({ key: 'qp', label: `Path: ${quickPathCategory}`, clear: () => { setQuickPathCategory(null); } });
    if (browseMode === 'featured') chips.push({ key: 'br', label: 'Browse: Featured', clear: () => setBrowseMode('all') });
    return chips;
  }, [searchQuery, filterConnectorType, filterSourceCategory, filterAuthMode, quickPathCategory, browseMode]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setFilterConnectorType('');
    setFilterSourceCategory('');
    setFilterAuthMode('');
    setQuickPathCategory(null);
    setBrowseMode('all');
  }, []);

  const initWizardState = useCallback(() => {
    setFlowStage(1);
    setInstallStep(0);
    setBrowseMode('all');
    setQuickPathCategory(null);
    setSelectedEntryId(MARKETPLACE_INTEGRATIONS[0]?.id ?? null);
    setSearchQuery('');
    setFilterConnectorType('');
    setFilterSourceCategory('');
    setFilterAuthMode('');
    setSortBy('recommended');
    setConnectionType('tool_server');
    setTemplate(null);
    setName('');
    setDescription('');
    setEndpoint('');
    setOwner('Navigator Admin Team');
    setEnvironment('production');
    setAuthMethod('oauth2');
    setTestState('idle');
    setDiscovering(false);
    setDiscovered(null);
    setAssignNavigator(true);
    setAssistantToggles({});
    setAccessModel('everyone');
    setSafetyDefaults({
      requireConfirmation: true,
      allowAutonomousExecution: false,
      allowMultiStep: true,
      sendUserProfile: false,
      sendConversation: true,
      maskSensitiveData: true,
      logFullPayload: true,
    });
  }, []);

  useEffect(() => {
    if (isOpen) initWizardState();
  }, [isOpen, initWizardState]);

  const handleClose = () => {
    initWizardState();
    onClose();
  };

  const beginInstallFromEntry = (entry) => {
    if (!entry) return;
    setTemplate(entry.id);
    setConnectionType(entry.connectionType);
    setName(entry.name);
    setDescription(entry.description);
    setEndpoint(`https://mcp.staffbase.local/connectors/${entry.id}/mcp`);
    setAuthMethod(authLabelToMethod(entry.authModes[0] || 'OAuth'));
    setTestState('idle');
    setDiscovered(null);
    setFlowStage(2);
    setInstallStep(0);
  };

  const startCustomMcp = () => {
    setTemplate('custom_mcp');
    setConnectionType('tool_server');
    setName('Custom MCP Server');
    setDescription('User-defined MCP tool server');
    setEndpoint('https://');
    setAuthMethod('oauth2');
    setTestState('idle');
    setDiscovered(null);
    setFlowStage(2);
    setInstallStep(0);
  };

  const startFromScratch = () => {
    setTemplate('from_scratch');
    setConnectionType('tool_server');
    setName('New connector');
    setDescription('Configure manually after publish');
    setEndpoint('https://');
    setAuthMethod('oauth2');
    setTestState('idle');
    setDiscovered(null);
    setFlowStage(2);
    setInstallStep(0);
  };

  const runConnectionTest = () => {
    setTestState('testing');
    setTimeout(() => {
      if (!endpoint.trim().startsWith('http')) {
        setTestState('error');
        error('Connection test failed', 'Please provide a valid endpoint URL.');
        return;
      }
      setTestState('success');
      success('Connection healthy', 'Endpoint responded successfully.');
    }, 1000);
  };

  const runDiscovery = () => {
    setDiscovering(true);
    setTimeout(() => {
      const source = MOCK_DISCOVERY_BY_PROVIDER[connectionType];
      setDiscovered({
        ...source,
        tools: source.tools.map((tool) => ({
          ...tool,
          friendlyName: tool.title,
          aiDescription: tool.description,
          riskLevel: RISK_BY_CATEGORY[tool.category] || 'Read',
          enabled: true,
          requiresConfirmation: tool.category === 'action' || tool.category === 'escalation',
        })),
      });
      setDiscovering(false);
    }, 1300);
  };

  const finish = () => {
    const templateColor = selectedProvider?.color || '#334155';
    const source = discovered || MOCK_DISCOVERY_BY_PROVIDER[connectionType];
    onComplete({
      id: `${(name || selectedProvider?.name || 'connection').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      template,
      name: name || selectedProvider?.name || 'New Connection',
      provider: selectedProvider?.name || 'Custom Provider',
      providerColor: templateColor,
      type: connectionType,
      status: 'connected',
      health: 'Healthy',
      latency: '205ms',
      lastSync: 'Just now',
      lastChecked: 'Just now',
      description: connectionType === 'full_agent'
        ? (description || 'Newly connected external assistant discovered from MCP endpoint.')
        : (description || 'Newly connected MCP tool server with direct tool execution.'),
      authMethod,
      endpoint,
      owner,
      environment,
      agentMeta: source.agentMeta,
      subTools: source.subTools,
      knowledgeBases: source.knowledgeBases,
      tools: source.tools,
      navigatorEnabled: assignNavigator,
      navigatorGroups: [],
      accessSummary: accessModel === 'everyone' ? 'All employees' : accessModel === 'group' ? '3 groups' : 'Custom',
      assistantAvailability: Object.entries(assistantToggles)
        .filter(([, enabled]) => enabled)
        .map(([assistantId]) => assistantId),
      safety: safetyDefaults,
      catalogCategory: selectedEntry?.sourceCategory || 'General',
      catalogPopularityRank: selectedEntry?.statusTag === 'Featured' ? 1 : selectedEntry?.statusTag === 'Popular' ? 2 : 6,
      connectorTypeLabel: connectionType === 'full_agent' ? 'External Assistant' : 'Tool Server',
      connectorTrustLevel: template === 'custom_mcp' || template === 'from_scratch' ? 'custom' : 'verified',
      connectionLifecycleState: testState === 'success' ? 'connected' : 'available',
      connectionState: testState === 'success' ? 'connected' : 'testing',
      lastUsedAt: 'Never',
      lastTestedAt: testState === 'success' ? 'Just now' : 'Not tested',
      lastError: null,
      usageCount: 0,
      operationEvents: [
        { id: `op-${Date.now()}-1`, at: 'Now', type: 'test', status: testState === 'success' ? 'success' : 'running', message: 'Initial connector validation executed from setup wizard.' },
        { id: `op-${Date.now()}-2`, at: 'Now', type: 'publish', status: 'success', message: 'Connector published from Connectors module.' },
      ],
    });
    initWizardState();
    onClose();
  };

  const installLabels = [
    'Connection details',
    'Auth & test',
    'Discovery',
    'Availability, access & safety',
    'Review & publish',
  ];

  const installStepValid = useMemo(
    () => [
      name.trim().length > 0 && endpoint.trim().length > 0,
      testState === 'success',
      discovered !== null,
      true,
      true,
    ],
    [name, endpoint, testState, discovered]
  );

  const modalTitle = flowStage === 1 ? 'Add Connector · Marketplace' : `Install connector · ${installLabels[installStep]}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      panelClassName="max-w-[min(96vw,1200px)] w-full"
      bodyClassName="p-0 max-h-[min(88vh,900px)] overflow-hidden flex flex-col"
      footer={(
        <div className="flex items-center justify-between w-full">
          <button type="button" onClick={handleClose} className="text-[12px] font-bold uppercase tracking-widest text-[#94A3B8] hover:text-[#111827]">Cancel</button>
          <div className="flex items-center gap-2">
            {flowStage === 2 && (
              <button
                type="button"
                onClick={() => {
                  if (installStep > 0) setInstallStep((s) => s - 1);
                  else setFlowStage(1);
                }}
                className="px-4 py-2 border border-[#E2E8F0] rounded-lg text-[12px] font-bold hover:bg-[#F8FAFC]"
              >
                {installStep === 0 ? '← Marketplace' : 'Back'}
              </button>
            )}
            {flowStage === 1 ? null : installStep < 4 ? (
              <button
                type="button"
                disabled={!installStepValid[installStep]}
                onClick={() => setInstallStep((s) => s + 1)}
                className="px-5 py-2 bg-[#111827] text-white rounded-lg text-[12px] font-bold disabled:opacity-40"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="px-5 py-2 bg-[#7C3AED] text-white rounded-lg text-[12px] font-bold"
              >
                <Check size={14} className="inline mr-1" />
                Publish connector
              </button>
            )}
          </div>
        </div>
      )}
    >
      {flowStage === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_minmax(260px,31%)] min-h-[min(70vh,640px)] divide-y lg:divide-y-0 lg:divide-x divide-[#E5E7EB]">
          <aside className="p-4 bg-[#FAFAFB] space-y-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">Catalog</div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => { setBrowseMode('featured'); setQuickPathCategory(null); }}
                className={`w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold ${browseMode === 'featured' ? 'bg-violet-100 text-violet-800' : 'hover:bg-white'}`}
              >
                <Star size={14} className="shrink-0" /> Featured
              </button>
              <button
                type="button"
                onClick={() => { setBrowseMode('all'); setQuickPathCategory(null); }}
                className={`w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold ${browseMode === 'all' && !quickPathCategory ? 'bg-violet-100 text-violet-800' : 'hover:bg-white'}`}
              >
                <LayoutGrid size={14} className="shrink-0" /> All integrations
              </button>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-2">Quick paths</div>
              <div className="space-y-1">
                {QUICK_PATHS.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => { setBrowseMode('all'); setQuickPathCategory(p.category); setFilterSourceCategory(''); }}
                    className={`w-full text-left rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${quickPathCategory === p.category ? 'bg-white border border-violet-200 text-violet-800' : 'text-[#64748B] hover:bg-white'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-[#E5E7EB] flex items-center gap-2 text-[11px] text-[#64748B]">
              <Store size={12} className="shrink-0" />
              <span>Staffbase integration marketplace</span>
            </div>
          </aside>

          <div className="p-4 flex flex-col min-h-0 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={16} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search connectors…"
                  className="w-full h-9 pl-9 pr-3 border border-[#E5E7EB] rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2 mb-2">
              <div className="flex items-center gap-1 text-[#94A3B8]">
                <SlidersHorizontal size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Filters</span>
              </div>
              <select
                value={filterConnectorType}
                onChange={(e) => setFilterConnectorType(e.target.value)}
                className="h-8 border border-[#E5E7EB] rounded-lg px-2 text-[11px] bg-white"
              >
                <option value="">Connector type</option>
                {uniqueConnectorTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={filterSourceCategory}
                onChange={(e) => setFilterSourceCategory(e.target.value)}
                className="h-8 border border-[#E5E7EB] rounded-lg px-2 text-[11px] bg-white"
              >
                <option value="">Source category</option>
                {uniqueSourceCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={filterAuthMode}
                onChange={(e) => setFilterAuthMode(e.target.value)}
                className="h-8 border border-[#E5E7EB] rounded-lg px-2 text-[11px] bg-white"
              >
                <option value="">Auth mode</option>
                {AUTH_MODE_FILTER_OPTIONS.filter(Boolean).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-8 border border-[#E5E7EB] rounded-lg px-2 text-[11px] bg-white"
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="name-asc">Sort: A–Z</option>
                <option value="name-desc">Sort: Z–A</option>
                <option value="type">Sort: Connector type</option>
              </select>
            </div>
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {activeFilterChips.map((c) => (
                  <span key={c.key} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-[#F1F5F9] text-[11px] text-[#334155]">
                    {c.label}
                    <button type="button" onClick={c.clear} className="p-0.5 rounded hover:bg-[#E2E8F0]" aria-label="Remove filter">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button type="button" onClick={clearAllFilters} className="text-[11px] font-bold text-violet-600 hover:underline">
                  Clear all
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredCatalog.map((entry) => {
                  const prov = PROVIDER_TEMPLATES[entry.id];
                  const active = entry.id === selectedEntryId;
                  return (
                    <button
                      type="button"
                      key={entry.id}
                      onClick={() => setSelectedEntryId(entry.id)}
                      className={`text-left p-3 rounded-xl border flex gap-3 transition-colors ${active ? 'border-violet-400 bg-violet-50/50 ring-1 ring-violet-200' : 'border-[#E5E7EB] bg-white hover:border-[#CBD5E1]'}`}
                    >
                      <MarketplaceLogo name={entry.name} color={prov?.color} src={entry.logoUrl} size={40} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-[#111827] truncate">{entry.name}</div>
                        <div className="text-[10px] text-[#64748B] font-medium mt-0.5">{entry.connectorType} · {entry.sourceCategory}</div>
                        <p className="text-[11px] text-[#94A3B8] line-clamp-2 mt-1">{entry.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredCatalog.length === 0 && (
                <div className="text-center py-12 text-[12px] text-[#94A3B8]">No matches — adjust filters or search.</div>
              )}
            </div>
          </div>

          <aside className="p-4 bg-[#FAFAFB] border-t lg:border-t-0 border-[#E5E7EB] flex flex-col min-h-0">
            {selectedEntry ? (
              <>
                <div className="flex items-start gap-3 mb-3">
                  <MarketplaceLogo
                    name={selectedEntry.name}
                    color={PROVIDER_TEMPLATES[selectedEntry.id]?.color}
                    src={selectedEntry.logoUrl}
                    size={48}
                  />
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold text-[#111827] leading-tight">{selectedEntry.name}</h3>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{selectedEntry.provider}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-200 text-violet-700 bg-violet-50">
                      {selectedEntry.statusTag}
                    </span>
                  </div>
                </div>
                <p className="text-[12px] text-[#475569] leading-relaxed mb-3">{selectedEntry.description}</p>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-1.5">Capabilities</div>
                <ul className="text-[12px] text-[#334155] space-y-1 mb-3 list-disc pl-4">
                  {selectedEntry.capabilitySummary.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-1.5">Auth</div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedEntry.authModes.map((a) => (
                    <span key={a} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-[#E5E7EB] text-[#475569]">{a}</span>
                  ))}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-1.5">Risk summary</div>
                <p className="text-[12px] text-[#334155] leading-snug p-2.5 rounded-lg bg-amber-50/80 border border-amber-100 mb-4">
                  {MARKETPLACE_RISK_SUMMARY[selectedEntry.id] || 'Review access scope and test in sandbox before production.'}
                </p>
                <div className="mt-auto space-y-2">
                  <button
                    type="button"
                    onClick={() => beginInstallFromEntry(selectedEntry)}
                    className="w-full py-2.5 rounded-lg bg-[#111827] text-white text-[12px] font-bold hover:opacity-95"
                  >
                    Install & Connect
                  </button>
                  <button
                    type="button"
                    onClick={startCustomMcp}
                    className="w-full py-2 rounded-lg border border-[#E5E7EB] bg-white text-[12px] font-bold text-[#334155] hover:bg-[#F8FAFC] flex items-center justify-center gap-1.5"
                  >
                    <Wrench size={14} /> Use Custom MCP
                  </button>
                  <button
                    type="button"
                    onClick={startFromScratch}
                    className="w-full py-2 rounded-lg text-[12px] font-bold text-violet-700 hover:underline"
                  >
                    Start from scratch
                  </button>
                </div>
              </>
            ) : (
              <div className="text-[12px] text-[#94A3B8]">Select a connector from the catalog.</div>
            )}
          </aside>
        </div>
      )}

      {flowStage === 2 && (
        <div className="p-6 overflow-y-auto flex-1 min-h-0 max-h-[min(80vh,820px)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-[#94A3B8]">
              Step {installStep + 1} of 5
            </div>
            <div className="flex flex-wrap gap-1">
              {installLabels.map((label, i) => (
                <span
                  key={label}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    i === installStep ? 'border-violet-400 bg-violet-50 text-violet-800' : i < installStep ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-[#E5E7EB] text-[#94A3B8]'
                  }`}
                >
                  {i + 1}. {label}
                </span>
              ))}
            </div>
          </div>

          {installStep === 0 && (
            <div className="space-y-4 max-w-3xl">
              <h3 className="text-[17px] font-bold text-[#111827]">Connection details</h3>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#64748B]">Connector name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-[13px] outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  placeholder="Connection name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#64748B]">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-[13px] outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  placeholder="What this connector is for"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#64748B]">Endpoint URL</label>
                  <input
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-[12px] font-mono outline-none focus:ring-1 focus:ring-[#7C3AED]"
                    placeholder="https://example.com/mcp"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#64748B]">Owner</label>
                  <input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-[13px] outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#64748B]">Environment</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-[13px] bg-white"
                  >
                    <option value="production">Production</option>
                    <option value="sandbox">Sandbox</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {installStep === 1 && (
            <div className="space-y-4 max-w-3xl">
              <h3 className="text-[17px] font-bold text-[#111827]">Authentication & test</h3>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#64748B]">Authentication method</label>
                <select
                  value={authMethod}
                  onChange={(e) => setAuthMethod(e.target.value)}
                  className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-[13px] bg-white"
                >
                  <option value="oauth2">OAuth 2.0</option>
                  <option value="entra">Entra ID JWT</option>
                  <option value="google_oidc">Google OIDC</option>
                  <option value="apikey">API Key</option>
                  <option value="service_account">Service account</option>
                </select>
              </div>
              <p className="text-[12px] text-[#64748B]">Run a test call to confirm the endpoint and credentials are valid before discovery.</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={runConnectionTest}
                  className="px-4 h-9 bg-[#111827] text-white rounded-lg text-[12px] font-bold"
                >
                  {testState === 'testing' ? <Loader2 size={14} className="animate-spin inline" /> : 'Test connection'}
                </button>
                {testState === 'success' && <span className="text-[12px] text-green-600 font-semibold">Connected successfully</span>}
                {testState === 'error' && <span className="text-[12px] text-red-600 font-semibold">Connection failed</span>}
                {testState === 'idle' && <span className="text-[12px] text-[#94A3B8]">Test required to continue</span>}
              </div>
            </div>
          )}

          {installStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-[17px] font-bold text-[#111827]">Capability discovery</h3>
              <p className="text-[12px] text-[#64748B]">
                Simulate MCP discovery from <code className="bg-[#F1F5F9] px-1.5 py-0.5 rounded">tools/list</code> and provider metadata.
              </p>
              {discovering ? (
                <div className="p-4 border border-[#DDD6FE] bg-[#F5F3FF] rounded-xl text-[12px] text-[#7C3AED] flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Discovering tools and metadata...
                </div>
              ) : discovered ? (
                <div className="space-y-3">
                  <div className="p-4 border border-[#DCFCE7] bg-[#F0FDF4] rounded-xl text-[12px] text-[#166534]">
                    Discovery complete: {discovered.tools.length} tools found.
                  </div>
                  <ToolsTable tools={discovered.tools} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={runDiscovery}
                  className="px-4 py-2 bg-[#7C3AED] text-white rounded-lg text-[12px] font-bold"
                >
                  Start discovery
                </button>
              )}
            </div>
          )}

          {installStep === 3 && (
            <div className="space-y-6 max-w-3xl">
              <h3 className="text-[17px] font-bold text-[#111827]">Availability, access & safety</h3>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] mb-2">Availability</div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={assignNavigator} onChange={(e) => setAssignNavigator(e.target.checked)} />
                  Available in Global Navigator
                </label>
                <div className="border border-[#E5E7EB] rounded-xl p-3 mt-2">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[#64748B] mb-2">Specific assistants</div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {assistants.map((assistant) => (
                      <label key={assistant.id} className="flex items-center justify-between text-[13px]">
                        <span>{assistant.name}</span>
                        <input
                          type="checkbox"
                          checked={assistantToggles[assistant.id] === true}
                          onChange={(event) => setAssistantToggles((prev) => ({ ...prev, [assistant.id]: event.target.checked }))}
                        />
                      </label>
                    ))}
                    {assistants.length === 0 && <p className="text-[12px] text-[#94A3B8]">No assistants in this environment.</p>}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] mb-2">Access</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'everyone', label: 'Everyone · All employees' },
                    { id: 'group', label: 'Group-based access' },
                    { id: 'attribute', label: 'Attribute/role rules' },
                    { id: 'custom', label: 'Custom user targeting' },
                  ].map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => setAccessModel(option.id)}
                      className={`text-left p-3 border rounded-lg text-[12px] ${accessModel === option.id ? 'border-[#7C3AED] bg-violet-50' : 'border-[#E5E7EB] bg-white'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] mb-2">Safety</div>
                <div className="space-y-2 text-[13px]">
                  {[
                    ['requireConfirmation', 'Require user confirmation'],
                    ['allowAutonomousExecution', 'Allow autonomous execution'],
                    ['allowMultiStep', 'Allow multi-step use'],
                    ['sendUserProfile', 'Allow sending user profile context'],
                    ['sendConversation', 'Allow sending conversation context'],
                    ['maskSensitiveData', 'Mask sensitive data before sending'],
                    ['logFullPayload', 'Log full request and response'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between border border-[#E5E7EB] rounded-lg px-3 py-2">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={safetyDefaults[key]}
                        onChange={(event) => setSafetyDefaults((prev) => ({ ...prev, [key]: event.target.checked }))}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {installStep === 4 && (
            <div className="space-y-4 max-w-3xl">
              <h3 className="text-[17px] font-bold text-[#111827]">Review & publish</h3>
              <div className="p-4 border border-[#E5E7EB] rounded-xl bg-[#F8FAFC] space-y-2 text-[12px]">
                <div><span className="font-bold text-[#334155]">Name:</span> {name}</div>
                <div><span className="font-bold text-[#334155]">Type:</span> {connectionType === 'full_agent' ? 'Full AI Agent' : 'MCP Tool Server'}</div>
                <div><span className="font-bold text-[#334155]">Provider:</span> {selectedProvider?.name || 'Custom Provider'}</div>
                <div><span className="font-bold text-[#334155]">Endpoint:</span> <code className="font-mono break-all">{endpoint}</code></div>
                <div><span className="font-bold text-[#334155]">Auth:</span> {authMethod}</div>
                <div><span className="font-bold text-[#334155]">Discovered tools:</span> {discovered?.tools?.length ?? 0}</div>
                <div><span className="font-bold text-[#334155]">Available in:</span> {assignNavigator ? 'Navigator' : 'Not assigned'}</div>
                <div><span className="font-bold text-[#334155]">Access:</span> {accessModel}</div>
                <div><span className="font-bold text-[#334155]">Assistants:</span> {Object.values(assistantToggles).filter(Boolean).length} selected</div>
              </div>
              <div className="p-4 border border-blue-200 bg-blue-50 rounded-xl text-[12px] text-blue-800">
                Connector is ready to publish. You can still adjust settings from the connection detail view after creation.
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

const PlatformConnectionsHub = ({
  connections,
  assistants = [],
  onAdd,
  onUpdate,
  onUpdateAssistants,
  onNavigateToNavigator,
}) => {
  const { success } = useNotification();
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [hubSurface, setHubSurface] = useState('configured');
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [rowMenuConnectionId, setRowMenuConnectionId] = useState(null);

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedConnectionId) || null,
    [connections, selectedConnectionId]
  );

  const totalTools = connections.reduce((sum, connection) => sum + connection.tools.length, 0);
  const visibleConnections = connections.filter((connection) => connection.removed !== true);
  const configuredConnections = visibleConnections.filter((connection) => connection.connectionLifecycleState !== 'available');
  const directoryEntries = MARKETPLACE_INTEGRATIONS.map((entry) => {
    const connected = visibleConnections.find((connection) => connection.template === entry.id || connection.name === entry.name || connection.provider === (PROVIDER_TEMPLATES[entry.id]?.name || entry.provider));
    return { ...entry, connected };
  });
  const connectionStateStyles = {
    connected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    testing: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    disabled: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const usageByConnection = useMemo(() => {
    const out = {};
    visibleConnections.forEach((connection) => {
      out[connection.id] = assistants
        .filter((assistant) => (assistant.assignedCapabilityIds || []).some((capId) => capId.startsWith(`${connection.id}:`)))
        .map((assistant) => assistant.name);
    });
    return out;
  }, [assistants, visibleConnections]);
  const linkedExternalByConnection = useMemo(() => {
    const out = {};
    visibleConnections.forEach((connection) => {
      out[connection.id] = assistants.filter((assistant) => assistant.type === 'external' && assistant.sourceConnectorId === connection.id);
    });
    return out;
  }, [assistants, visibleConnections]);

  const applyConnectionState = (connection, patch) => {
    const updated = { ...connection, ...patch };
    onUpdate(updated);
    return updated;
  };

  const updateLinkedExternalAssistants = (connectionId, patchFactory) => {
    if (!onUpdateAssistants) return;
    onUpdateAssistants((prev) => prev.map((assistant) => {
      if (assistant.type !== 'external' || assistant.sourceConnectorId !== connectionId) return assistant;
      return { ...assistant, ...patchFactory(assistant) };
    }));
  };

  const appendOperationEvent = (connection, event) => {
    const existing = connection.operationEvents || [];
    return [{ id: `${connection.id}-${Date.now()}`, ...event }, ...existing].slice(0, 10);
  };

  const applyRowAction = (connection, action) => {
    if (action === 'test') {
      const updated = applyConnectionState(connection, {
        connectionState: 'testing',
        lastTestedAt: 'Just now',
        operationEvents: appendOperationEvent(connection, {
          at: 'Now',
          type: 'test',
          status: 'running',
          message: 'Manual test initiated from configured connectors table.',
        }),
      });
      setTimeout(() => {
        onUpdate({
          ...updated,
          connectionState: connection.connectionState === 'error' ? 'error' : 'connected',
          operationEvents: appendOperationEvent(updated, {
            at: 'Now',
            type: 'test',
            status: connection.connectionState === 'error' ? 'error' : 'success',
            message: connection.connectionState === 'error'
              ? 'Test failed: upstream auth challenge still unresolved.'
              : 'Test succeeded and connector is healthy.',
          }),
        });
      }, 800);
      return;
    }
    if (action === 'reconnect') {
      applyConnectionState(connection, {
        connectionState: 'connected',
        connectionLifecycleState: 'connected',
        status: 'connected',
        health: 'Healthy',
        lastTestedAt: 'Just now',
        lastError: null,
        operationEvents: appendOperationEvent(connection, {
          at: 'Now',
          type: 'reconnect',
          status: 'success',
          message: 'Connector reconnected and credentials refreshed.',
        }),
      });
      success('Connector reconnected', `${connection.name} is connected again.`);
      return;
    }
    if (action === 'toggle') {
      const isDisabled = connection.connectionState === 'disabled';
      applyConnectionState(connection, {
        connectionState: isDisabled ? 'connected' : 'disabled',
        connectionLifecycleState: isDisabled ? 'connected' : 'disabled',
        status: isDisabled ? 'connected' : 'disabled',
        health: isDisabled ? 'Healthy' : 'Disabled',
        operationEvents: appendOperationEvent(connection, {
          at: 'Now',
          type: isDisabled ? 'enable' : 'disable',
          status: 'success',
          message: isDisabled ? 'Connector enabled.' : 'Connector disabled by admin.',
        }),
      });
      updateLinkedExternalAssistants(connection.id, () => ({
        linkedConnectorState: isDisabled ? 'connected' : 'disabled',
        linkedConnectorStatusNote: isDisabled
          ? 'Linked connector enabled.'
          : 'Linked connector disabled in Configured connectors.',
      }));
      return;
    }
    if (action === 'remove') {
      applyConnectionState(connection, {
        removed: true,
        connectionState: 'disabled',
        connectionLifecycleState: 'disabled',
        status: 'disabled',
        health: 'Removed',
        operationEvents: appendOperationEvent(connection, {
          at: 'Now',
          type: 'remove',
          status: 'success',
          message: 'Connector removed from configured registry.',
        }),
      });
      updateLinkedExternalAssistants(connection.id, () => ({
        linkedConnectorState: 'disabled',
        linkedConnectorStatusNote: 'Connector removed from configured registry.',
        bindingMode: 'degraded',
      }));
      success('Connector removed', `${connection.name} has been removed from configured connectors.`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <FeatureHeader
        title="Connectors"
        subtitle="Configure connectors globally once, then assign to Navigator and specialized assistants."
        actions={(
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2 bg-[#111827] text-white text-[12px] font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus size={14} /> Add Connector
          </button>
        )}
      />

      <div className="flex-1 overflow-y-auto p-8 bg-[#F9FAFB]">
        <div className="max-w-full mx-auto">
          {!selectedConnection && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-white border border-[#E5E7EB] rounded-xl px-6 py-5 flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-[#111827] font-semibold">
                    {visibleConnections.length} connectors · {totalTools} capabilities discovered
                  </div>
                  <div className="text-[12px] text-[#64748B] mt-1">
                    Directory is for discovery. Configured is for runtime operations. External assistants only consume linked configured connectors.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setQuickMenuOpen((prev) => !prev)}
                      className="h-9 w-9 rounded-lg border border-[#E5E7EB] text-[#475569] grid place-items-center hover:bg-[#F8FAFC]"
                    >
                      <Plus size={14} />
                    </button>
                    {quickMenuOpen && (
                      <div className="absolute right-0 top-10 w-44 rounded-lg border border-[#E5E7EB] bg-white shadow-lg z-20 p-1">
                        <button
                          onClick={() => {
                            setHubSurface('directory');
                            setQuickMenuOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-2 text-[12px] font-medium rounded hover:bg-[#F8FAFC]"
                        >
                          Browse connectors
                        </button>
                        <button
                          onClick={() => {
                            setIsWizardOpen(true);
                            setQuickMenuOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-2 text-[12px] font-medium rounded hover:bg-[#F8FAFC]"
                        >
                          Add custom connector
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={onNavigateToNavigator}
                    className="text-[12px] font-bold text-[#2563EB] hover:underline"
                  >
                    Back to Navigator
                  </button>
                </div>
              </div>

              <div className="flex gap-1 border-b border-[#E2E8F0]">
                {[
                  { id: 'directory', label: 'Directory' },
                  { id: 'configured', label: 'Configured' },
                ].map((surface) => (
                  <button
                    key={surface.id}
                    onClick={() => setHubSurface(surface.id)}
                    className={`px-4 py-3 text-[12px] font-bold uppercase tracking-widest border-b-2 -mb-px ${hubSurface === surface.id ? 'border-[#7C3AED] text-[#7C3AED]' : 'border-transparent text-[#94A3B8] hover:text-[#475569]'}`}
                  >
                    {surface.label}
                  </button>
                ))}
              </div>

              {hubSurface === 'directory' ? (
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {directoryEntries.map((entry) => (
                      <div key={entry.id} className="border border-[#E5E7EB] rounded-xl p-4 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[14px] font-bold text-[#111827]">{entry.name}</div>
                            <div className="text-[11px] text-[#64748B] mt-0.5">{entry.connectorType} · {entry.sourceCategory}</div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${entry.connected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'}`}>
                            {entry.connected ? 'Configured' : 'Available'}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#64748B] mt-2 line-clamp-2">{entry.description}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[11px] text-[#64748B]">{entry.statusTag} · {entry.authModes.join(', ')}</span>
                          {entry.connected ? (
                            <button
                              onClick={() => {
                                setSelectedConnectionId(entry.connected.id);
                                setActiveTab('Overview');
                              }}
                              className="text-[12px] font-bold text-[#2563EB] hover:underline"
                            >
                              Open
                            </button>
                          ) : (
                            <button
                              onClick={() => setIsWizardOpen(true)}
                              className="text-[12px] font-bold text-[#2563EB] hover:underline"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[10px] uppercase tracking-widest text-[#94A3B8]">
                      <tr>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Connection state</th>
                        <th className="px-4 py-3">Last tested</th>
                        <th className="px-4 py-3">Used by</th>
                        <th className="px-4 py-3">Policy</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-[12px] divide-y divide-[#F1F5F9]">
                      {configuredConnections.map((connection) => (
                        <tr key={connection.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 font-semibold text-[#111827]">{connection.name}</td>
                          <td className="px-4 py-3 text-[#64748B]">{connection.connectorTypeLabel || (connection.type === 'full_agent' ? 'External Assistant' : 'Tool Server')}</td>
                          <td className="px-4 py-3 text-[#64748B]">{connection.catalogCategory || 'General'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${connectionStateStyles[connection.connectionState] || connectionStateStyles.disabled}`}>
                              {connection.connectionState || 'disabled'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#64748B]">{connection.lastTestedAt || 'Never'}</td>
                          <td className="px-4 py-3 text-[#64748B]">
                            {connection.navigatorEnabled ? 'Navigator' : '—'}
                            {(linkedExternalByConnection[connection.id] || []).length > 0
                              ? `, ${(linkedExternalByConnection[connection.id] || []).map((assistant) => assistant.name).join(', ')}`
                              : ''}
                          </td>
                          <td className="px-4 py-3 text-[#64748B]">{connection.toolRestrictions?.mode || 'none'}</td>
                          <td className="px-4 py-3">
                            <div className="relative">
                              <button
                                onClick={() => setRowMenuConnectionId((prev) => prev === connection.id ? null : connection.id)}
                                className="h-8 w-8 rounded-md border border-[#E5E7EB] text-[#64748B] grid place-items-center hover:bg-[#F8FAFC]"
                              >
                                <MoreHorizontal size={14} />
                              </button>
                              {rowMenuConnectionId === connection.id && (
                                <div className="absolute right-0 top-9 w-40 rounded-lg border border-[#E5E7EB] bg-white shadow-lg z-20 p-1">
                                  <button onClick={() => { setSelectedConnectionId(connection.id); setActiveTab('Overview'); setRowMenuConnectionId(null); }} className="w-full text-left px-2.5 py-1.5 rounded text-[12px] hover:bg-[#F8FAFC]">Open detail</button>
                                  <button onClick={() => { applyRowAction(connection, 'test'); setRowMenuConnectionId(null); }} className="w-full text-left px-2.5 py-1.5 rounded text-[12px] hover:bg-[#F8FAFC]">Test connection</button>
                                  <button onClick={() => { applyRowAction(connection, 'reconnect'); setRowMenuConnectionId(null); }} className="w-full text-left px-2.5 py-1.5 rounded text-[12px] hover:bg-[#F8FAFC]">Reconnect</button>
                                  <button onClick={() => { applyRowAction(connection, 'toggle'); setRowMenuConnectionId(null); }} className="w-full text-left px-2.5 py-1.5 rounded text-[12px] hover:bg-[#F8FAFC]">{connection.connectionState === 'disabled' ? 'Enable' : 'Disable'}</button>
                                  <button onClick={() => { applyRowAction(connection, 'remove'); setRowMenuConnectionId(null); }} className="w-full text-left px-2.5 py-1.5 rounded text-[12px] text-[#DC2626] hover:bg-red-50">Remove</button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedConnection && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedConnectionId(null)}
                    className="w-10 h-10 bg-white border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#111827]"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[24px] font-bold text-[#111827]">{selectedConnection.name}</h2>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${selectedConnection.type === 'full_agent' ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                        {selectedConnection.type === 'full_agent' ? 'Full Agent' : 'Tool Server'}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#64748B] mt-1">{selectedConnection.provider} · {selectedConnection.endpoint}</p>
                  </div>
                </div>
                <button
                  onClick={onNavigateToNavigator}
                  className="px-4 py-2 border border-[#E2E8F0] bg-white rounded-lg text-[12px] font-bold hover:bg-[#F8FAFC] flex items-center gap-1"
                >
                  Go to Navigator <ExternalLink size={13} />
                </button>
              </div>

              <div className="flex gap-1 border-b border-[#E2E8F0]">
                {['Overview', 'Capabilities', 'Tool permission restrictions', 'Connection endpoint', 'Governance', 'Linked assistants', 'Recent operations'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-[12px] font-bold uppercase tracking-widest border-b-2 -mb-px ${activeTab === tab ? 'border-[#7C3AED] text-[#7C3AED]' : 'border-transparent text-[#94A3B8] hover:text-[#475569]'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === 'Overview' && (
                <div className="space-y-6">
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (!selectedConnection) return;
                        onUpdate({ ...selectedConnection, lastSync: 'Just now' });
                        success('Connection refreshed', `${selectedConnection.name} metadata has been refreshed.`);
                      }}
                      className="px-4 py-2 border border-[#E2E8F0] bg-white rounded-lg text-[12px] font-bold hover:bg-[#F8FAFC]"
                    >
                      Refresh metadata
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'State', value: selectedConnection.connectionState || selectedConnection.status, icon: Check },
                      { label: 'Health', value: selectedConnection.health, icon: Activity },
                      { label: 'Last used', value: selectedConnection.lastUsedAt || 'Never', icon: Activity },
                      { label: 'Usage count', value: `${selectedConnection.usageCount || 0}`, icon: Server },
                    ].map((metric) => (
                      <div key={metric.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1">{metric.label}</div>
                        <div className="text-[20px] font-bold text-[#111827]">{metric.value}</div>
                      </div>
                    ))}
                  </div>

                  <SettingsCard title="Connection Details">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[13px]"><span className="text-[#64748B]">Provider</span><span className="font-semibold">{selectedConnection.provider}</span></div>
                      <div className="flex items-center justify-between text-[13px]"><span className="text-[#64748B]">Auth Method</span><span className="font-semibold">{selectedConnection.authMethod}</span></div>
                      <div className="flex items-center justify-between text-[13px]"><span className="text-[#64748B]">Last Sync</span><span className="font-semibold">{selectedConnection.lastSync}</span></div>
                      <div className="flex items-center justify-between text-[13px]"><span className="text-[#64748B]">Last Tested</span><span className="font-semibold">{selectedConnection.lastTestedAt || 'Never'}</span></div>
                      <div className="flex items-center justify-between text-[13px]"><span className="text-[#64748B]">Navigator Scope</span><span className="font-semibold">{selectedConnection.navigatorEnabled ? 'Enabled' : 'Disabled'}</span></div>
                      <div className="flex items-center justify-between text-[13px]"><span className="text-[#64748B]">Owner</span><span className="font-semibold">{selectedConnection.owner || 'Admin'}</span></div>
                    </div>
                  </SettingsCard>
                  <SettingsCard title="Runtime snapshot">
                    <div className="space-y-2">
                      {(linkedExternalByConnection[selectedConnection.id] || []).length === 0 && (
                        <p className="text-[12px] text-[#94A3B8]">No external assistants linked to this connector.</p>
                      )}
                      {(linkedExternalByConnection[selectedConnection.id] || []).map((assistant) => (
                        <div key={assistant.id} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2">
                          <span className="text-[12px] font-semibold text-[#111827]">{assistant.name}</span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${connectionStateStyles[selectedConnection.connectionState] || connectionStateStyles.disabled}`}>
                            {selectedConnection.connectionState || 'disabled'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </SettingsCard>
                </div>
              )}

              {activeTab === 'Capabilities' && (
                <div className="space-y-4">
                  {selectedConnection.type === 'full_agent' ? (
                    <>
                      <div className="p-4 border border-violet-200 bg-violet-50 rounded-xl">
                        <div className="flex items-center gap-2 text-[13px] font-bold text-violet-700 mb-1">
                          <Sparkles size={14} /> Full AI Agent
                        </div>
                        <p className="text-[12px] text-violet-700/90">
                          This provider handles internal routing, context retention, and sub-tool orchestration.
                        </p>
                      </div>

                      {selectedConnection.agentMeta && (
                        <SettingsCard title="Agent Metadata">
                          <div className="grid grid-cols-2 gap-3 text-[12px]">
                            <div><span className="text-[#64748B]">Topics:</span> {selectedConnection.agentMeta.supportedTopics.join(', ')}</div>
                            <div><span className="text-[#64748B]">Multi-turn:</span> {selectedConnection.agentMeta.multiTurn ? 'Enabled' : 'Disabled'}</div>
                            <div><span className="text-[#64748B]">Max turns:</span> {selectedConnection.agentMeta.maxTurns}</div>
                            <div><span className="text-[#64748B]">Confidence:</span> {selectedConnection.agentMeta.confidenceThreshold}</div>
                            <div><span className="text-[#64748B]">Fallback:</span> {selectedConnection.agentMeta.fallbackBehavior}</div>
                            <div><span className="text-[#64748B]">User context:</span> {selectedConnection.agentMeta.userContextType}</div>
                          </div>
                        </SettingsCard>
                      )}

                      <SettingsCard title="Connected Sub-Tools">
                        <div className="flex flex-wrap gap-2">
                          {selectedConnection.subTools.map((tool) => (
                            <span key={tool.name} className="text-[11px] px-3 py-1 rounded-full border border-[#E2E8F0] bg-white">
                              <span className="font-bold text-[#111827]">{tool.name}</span>
                              <span className="text-[#64748B]"> · {tool.purpose}</span>
                            </span>
                          ))}
                        </div>
                      </SettingsCard>

                      <SettingsCard title="Knowledge Bases">
                        <div className="overflow-hidden border border-[#E5E7EB] rounded-xl">
                          <table className="w-full text-left">
                            <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[10px] uppercase tracking-widest text-[#94A3B8]">
                              <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Source</th>
                                <th className="px-4 py-3">Articles</th>
                                <th className="px-4 py-3">Last Sync</th>
                              </tr>
                            </thead>
                            <tbody className="text-[12px] divide-y divide-[#F1F5F9]">
                              {selectedConnection.knowledgeBases.map((base) => (
                                <tr key={base.name}>
                                  <td className="px-4 py-3 font-semibold text-[#111827]">{base.name}</td>
                                  <td className="px-4 py-3 text-[#64748B]">{base.source}</td>
                                  <td className="px-4 py-3 text-[#64748B]">{base.articleCount}</td>
                                  <td className="px-4 py-3 text-[#64748B]">{base.lastSync}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </SettingsCard>
                    </>
                  ) : (
                    <div className="p-4 border border-blue-200 bg-blue-50 rounded-xl text-blue-800">
                      <div className="font-bold text-[13px] mb-1">MCP Tool Server</div>
                      <p className="text-[12px]">Direct tool invocation with no agent-level routing or internal orchestration.</p>
                    </div>
                  )}

                  <SettingsCard title="Exposed Capabilities (tools/list)">
                    <div className="text-[11px] text-[#64748B] mb-3">
                      Categories: <span className="font-semibold">agent</span>, <span className="font-semibold">action</span>, <span className="font-semibold">search</span>, <span className="font-semibold">escalation</span>, <span className="font-semibold">data</span>
                    </div>
                    <ToolsTable tools={selectedConnection.tools} />
                  </SettingsCard>
                </div>
              )}

              {activeTab === 'Governance' && (
                <SettingsCard title="Governance">
                  <div className="space-y-3 text-[13px]">
                    <label className="flex items-center justify-between border border-[#E5E7EB] rounded-lg px-3 py-2">
                      <span>Global Navigator</span>
                      <input
                        type="checkbox"
                        checked={selectedConnection.navigatorEnabled}
                        onChange={(event) => onUpdate({ ...selectedConnection, navigatorEnabled: event.target.checked })}
                      />
                    </label>
                    {assistants.map((assistant) => {
                      const hasCapability = (assistant.assignedCapabilityIds || []).some((id) => id.startsWith(`${selectedConnection.id}:`));
                      return (
                        <label key={assistant.id} className="flex items-center justify-between border border-[#E5E7EB] rounded-lg px-3 py-2">
                          <span>{assistant.name}</span>
                          <input
                            type="checkbox"
                            checked={hasCapability}
                            onChange={(event) => {
                              if (!onUpdateAssistants) return;
                              onUpdateAssistants((prev) => prev.map((a) => {
                                if (a.id !== assistant.id) return a;
                                if (event.target.checked) {
                                  const addIds = selectedConnection.capabilities.map((cap) => cap.id);
                                  return { ...a, assignedCapabilityIds: Array.from(new Set([...(a.assignedCapabilityIds || []), ...addIds])) };
                                }
                                return { ...a, assignedCapabilityIds: (a.assignedCapabilityIds || []).filter((id) => !id.startsWith(`${selectedConnection.id}:`)) };
                              }));
                            }}
                          />
                        </label>
                      );
                    })}
                    <div className="p-3 border border-[#E5E7EB] rounded-lg bg-[#F8FAFC] text-[12px] text-[#334155]">
                      Policy mode: <span className="font-semibold">{selectedConnection.toolRestrictions?.mode || 'none'}</span>
                    </div>
                  </div>
                </SettingsCard>
              )}

              {activeTab === 'Linked assistants' && (
                <SettingsCard title="Linked assistants">
                  <div className="space-y-2 text-[12px]">
                    {(linkedExternalByConnection[selectedConnection.id] || []).length === 0 ? (
                      <div className="p-3 border border-[#E5E7EB] rounded-lg bg-[#F8FAFC]">
                        No external assistants are currently bound to this connector.
                      </div>
                    ) : (
                      (linkedExternalByConnection[selectedConnection.id] || []).map((assistant) => (
                        <div key={assistant.id} className="p-3 border border-[#E5E7EB] rounded-lg flex items-center justify-between">
                          <span className="font-semibold text-[#111827]">{assistant.name}</span>
                          <span className="text-[#64748B]">{assistant.bindingMode || 'full'} binding</span>
                        </div>
                      ))
                    )}
                  </div>
                </SettingsCard>
              )}

              {activeTab === 'Tool permission restrictions' && (
                <SettingsCard title="Tool permission restrictions">
                  <div className="space-y-2 text-[13px]">
                    {selectedConnection.tools.map((tool) => {
                      const risk = RISK_BY_CATEGORY[tool.category] || 'Read';
                      const requires = risk === 'Write' || risk === 'Destructive' || risk === 'External assistant';
                      return (
                        <div key={tool.id} className="border border-[#E5E7EB] rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-[#111827]">{tool.title}</div>
                            <div className="text-[12px] text-[#64748B]">{risk} · {requires ? 'Ask before executing' : 'No confirmation'}</div>
                          </div>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${requires ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                            {requires ? 'Confirmed' : 'Auto'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </SettingsCard>
              )}

              {activeTab === 'Connection endpoint' && (
                <div className="space-y-4">
                  <SettingsCard title="Connection endpoint">
                    <div className="space-y-2 text-[13px]">
                      <div className="flex items-center justify-between"><span className="text-[#64748B]">Method</span><span className="font-semibold">{selectedConnection.authMethod}</span></div>
                      <div className="flex items-center justify-between"><span className="text-[#64748B]">Endpoint</span><code className="text-[12px]">{selectedConnection.endpoint}</code></div>
                      <div className="flex items-center justify-between"><span className="text-[#64748B]">Token Rotation</span><span className="font-semibold text-[#16A34A]">Enabled</span></div>
                    </div>
                  </SettingsCard>
                  <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[12px] text-[#334155] flex items-start gap-2">
                    <Shield size={14} className="mt-0.5" />
                    Credentials are encrypted at rest and never exposed to runtime prompts.
                  </div>
                </div>
              )}

              {activeTab === 'Recent operations' && (
                <SettingsCard title="Recent operations">
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      ['Uptime', '99.95%'],
                      ['Last handshake', selectedConnection.lastTestedAt || selectedConnection.lastSync],
                      ['Latency', selectedConnection.latency],
                      ['Error rate', selectedConnection.connectionState === 'error' ? '3.8%' : '0.2%'],
                    ].map(([label, value]) => (
                      <div key={label} className="p-3 border border-[#E5E7EB] rounded-lg bg-white">
                        <div className="text-[10px] uppercase tracking-widest text-[#94A3B8]">{label}</div>
                        <div className="text-[14px] font-semibold text-[#111827]">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">Recent operations</div>
                    {(selectedConnection.operationEvents || []).map((event) => (
                      <div key={event.id} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12px]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#334155]">{event.type}</span>
                          <span className="text-[#94A3B8]">{event.at}</span>
                        </div>
                        <div className="text-[#64748B] mt-0.5">{event.message}</div>
                      </div>
                    ))}
                  </div>
                </SettingsCard>
              )}
            </div>
          )}
        </div>
      </div>

      <AddPlatformConnectionWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        assistants={assistants}
        onComplete={(newConnection) => {
          onAdd(newConnection);
          success('Connector added', `${newConnection.name} is now available globally.`);
        }}
      />
    </div>
  );
};

export default PlatformConnectionsHub;
