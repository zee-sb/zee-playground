import { useEffect, useMemo, useState } from 'react';
import { Check, BarChart2, Zap, Copy, Download, Plus, X } from 'lucide-react';
import { useNotification } from '../../components/NotificationProvider';

const PROVIDER_LABELS = { copilot_studio: 'Copilot Studio', gemini: 'Gemini', custom: 'Custom MCP' };
const PROVIDER_COLORS = { copilot_studio: '#0078d4', gemini: '#1a73e8', custom: '#6B7280' };

const TABS = ['Overview', 'Capabilities', 'Authentication', 'Test mode', 'Analytics'];
const TARGET_GROUP_OPTIONS = ['All Employees', 'Managers', 'HR Team', 'Finance Team', 'Legal Team', 'IT Team', 'New Joiners', 'Executives'];
const TARGET_USER_OPTIONS = [
  'alex.meyer@staffbase.com',
  'maria.schmidt@staffbase.com',
  'john.doe@staffbase.com',
  'liam.chen@staffbase.com',
  'sarah.lee@staffbase.com',
];

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: color || '#111827' }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function OverviewTab({ agent }) {
  const config = [
    ['Attachment', agent.attachment === 'standalone' ? 'Standalone' : `Attached to ${agent.parentAssistant}`],
    ['Provider', PROVIDER_LABELS[agent.provider] || agent.provider],
    ['Connection', 'MCP (Model Context Protocol)'],
    ['Endpoint', agent.endpoint || 'https://agent.example.com/mcp'],
    ['Authentication', (agent.authMethod || 'oauth2').toUpperCase()],
    ['Identity Context', agent.propagateIdentity ? 'User Delegation (Staffbase OIDC)' : 'Service Account'],
    ['Groups', (agent.groups || []).join(', ') || '—'],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Invocations (7d)" value="1,248" sub="+12% vs last week" color="#3B82F6" />
        <StatCard label="Avg latency" value={agent.latency || '1.2s'} sub="p95: 2.1s" />
        <StatCard label="Completion rate" value={`${agent.completionRate || 94}%`} sub="goal: >90%" color="#10B981" />
        <StatCard label="Fallback rate" value="6%" sub="14% last week" color="#F59E0B" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700">Configuration</h4>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {config.map(([key, val]) => (
              <tr key={key}>
                <td className="px-4 py-2.5 font-medium text-gray-500 w-40">{key}</td>
                <td className="px-4 py-2.5 text-gray-900 font-mono text-xs">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
        <span className="text-green-500 text-lg">●</span>
        <div>
          <div className="text-sm font-medium text-green-800">Agent healthy</div>
          <div className="text-xs text-green-700">Last successful ping 43s ago · MCP handshake OK</div>
        </div>
      </div>
    </div>
  );
}

function generateManifestYaml({ agentName, connectorName, endpoint, topics, capabilityMap }) {
  const capabilityLines = capabilityMap.map((capability) => [
    `  - id: ${capability.id}`,
    `    title: "${capability.title}"`,
    `    category: "${capability.category}"`,
    `    operation: "${capability.name}"`,
    `    source: "${capability.source}"`,
    `    sample_queries:`,
    ...capability.sampleQueries.map((query) => `      - "${query}"`),
  ].join('\n')).join('\n');

  return `# Navigator Agent Manifest
# Routing contract for: ${agentName}
# Derived from MCP discovery output

agent:
  name: "${agentName}"
  connector: "${connectorName}"
  protocol: "mcp"
  endpoint: "${endpoint}"

discovery:
  source: "tools/list"
  capabilities_detected: ${capabilityMap.length}

routing:
  topic_areas:
${topics.map((topic) => `    - ${topic}`).join('\n')}

  capability_map:
${capabilityLines}

  fallback:
    behavior: "route_to_global"
    escalation: "human_handoff"
`;
}

function CapabilitiesTab({ agent, linkedConnector }) {
  const { success } = useNotification();
  const [view, setView] = useState('form');
  const discoveredTools = linkedConnector?.tools || [];
  const capabilityMap = useMemo(
    () => discoveredTools.map((tool) => ({
      id: `${linkedConnector?.id || 'connector'}:${tool.id}`,
      name: tool.name,
      title: tool.title,
      category: tool.category,
      source: linkedConnector?.name || 'Unknown connector',
      sampleQueries: [
        `Run ${tool.title} for this user`,
        `Help me with ${tool.title.toLowerCase()}`,
      ],
      inputSchema: tool.inputSchema || [],
    })),
    [discoveredTools, linkedConnector]
  );
  const topics = agent.selectedTopics || linkedConnector?.agentMeta?.supportedTopics || ['IT Support'];
  const yaml = generateManifestYaml({
    agentName: agent.name,
    connectorName: linkedConnector?.name || agent.sourceConnectorName || 'Unlinked connector',
    endpoint: linkedConnector?.endpoint || agent.endpoint || 'n/a',
    topics,
    capabilityMap,
  });

  function handleCopy() {
    navigator.clipboard?.writeText(yaml);
    success('Copied', 'Manifest YAML copied to clipboard.');
  }

  function handleDownload() {
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.name.replace(/\s+/g, '-').toLowerCase()}-manifest.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    success('Downloaded', 'Manifest YAML file downloaded.');
  }

  return (
    <div className="space-y-5">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {[['form', 'Form'], ['yaml', 'Manifest YAML']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setView(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'yaml' && (
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Copy size={12} /> Copy YAML
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download size={12} /> Download .yaml
            </button>
          </div>
        )}
      </div>

      {view === 'form' && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Discovery source</h4>
            <p className="text-xs text-gray-600">
              Capability map is simulated from MCP `tools/list` on the linked connector: <span className="font-semibold">{linkedConnector?.name || 'Unlinked connector'}</span>.
            </p>
          </div>

          <div className="space-y-3">
            {capabilityMap.map((capability) => (
              <div key={capability.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{capability.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{capability.name} · {capability.category}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-violet-50 text-violet-700 border-violet-200">
                    discovered
                  </span>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1.5">Sample routing queries</div>
                  <div className="flex flex-wrap gap-1.5">
                    {capability.sampleQueries.map((query) => (
                      <span key={query} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-700">
                        "{query}"
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1.5">Input schema</div>
                  <div className="space-y-1">
                    {capability.inputSchema.map((param) => (
                      <div key={param.name} className="text-xs text-gray-600">
                        <span className="font-semibold text-gray-800">{param.name}</span> · {param.type}{param.required ? '' : ' (optional)'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <Zap size={15} className="text-purple-600 mt-0.5 shrink-0" />
            <p className="text-[13px] text-purple-800">
              Navigator will route queries across <span className="font-bold">{topics.length} topic area{topics.length !== 1 ? 's' : ''}</span> and <span className="font-bold">{capabilityMap.length} discovered capabilities</span> from this linked MCP connector.
            </p>
          </div>
        </>
      )}

      {view === 'yaml' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-800">Navigator Agent Manifest</h4>
            <p className="text-xs text-gray-500 mt-0.5">The routing contract Navigator uses to decide when to call this agent</p>
          </div>
          <pre className="text-[12px] bg-gray-900 text-green-400 p-5 overflow-x-auto font-mono leading-relaxed">{yaml}</pre>
        </div>
      )}
    </div>
  );
}

function AuthenticationTab({ agent }) {
  const authMethod = agent.authMethod || 'oauth2';
  const jwtPayload = JSON.stringify({
    iss: "Navigator",
    sub: "usr_sb_99482",
    aud: agent.name.replace(/\s+/g, '-').toLowerCase(),
    context: {
      user: {
        email: "jane.smith@company.com",
        groups: ["Engineering", "All Employees"],
        region: "EMEA"
      },
      delegation: agent.propagateIdentity ? "OIDC_ON_BEHALF_OF" : "SERVICE_PRINCIPAL"
    },
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900
  }, null, 2);

  return (
    <div className="space-y-5">
      {authMethod === 'oauth2' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[15px] font-bold text-gray-900">OAuth 2.1 / OIDC Details</h4>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-full">Handshake Verified</span>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Client Identifier</label>
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 font-mono text-[11px] text-gray-600">
                    sb-navigator-agent-{agent.id.slice(-4)}
                  </div>
               </div>
               <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Authorization Scopes</label>
                  <div className="flex flex-wrap gap-1">
                    {['openid', 'profile', 'mcp.execute', 'tools.read'].map(s => (
                      <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">{s}</span>
                    ))}
                  </div>
               </div>
            </div>
            <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]">
               <div className="text-[11px] font-bold text-gray-700 mb-2">Protocol: PKCE (Proof Key for Code Exchange)</div>
               <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                 This agent uses OIDC federation. Navigator provides a secure, short-lived session token during tool execution.
               </p>
               <button className="text-[11px] font-black text-blue-600 uppercase tracking-widest hover:underline">Re-authenticate Service</button>
            </div>
          </div>
        </div>
      )}

      {agent.propagateIdentity && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-[#F9FAFB] flex items-center justify-between">
            <div>
              <h4 className="text-[14px] font-bold text-gray-900">Identity Context (MCP Header)</h4>
              <p className="text-[11px] text-gray-500">The delegated principal sent to {agent.name}</p>
            </div>
            <Zap size={16} className="text-[#7C3AED]" />
          </div>
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-bold text-emerald-600">
               <Check size={14} strokeWidth={3} /> Trusted delegation active via {agent.provider === 'copilot_studio' ? 'Entra ID' : 'Google Identity'}
            </div>
            <pre className="text-[12px] bg-gray-900 text-green-400 rounded-xl p-5 overflow-x-auto font-mono leading-relaxed shadow-inner">{jwtPayload}</pre>
          </div>
        </div>
      )}

      {!agent.propagateIdentity && (
        <div className="p-8 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-center">
           <p className="text-sm text-gray-500 mb-2">This agent is running under a static **Service Account**.</p>
           <button className="text-xs font-bold text-blue-600 hover:underline">Switch to User Delegation</button>
        </div>
      )}
    </div>
  );
}

const TEST_USERS = ['Jane Smith (Engineering)', 'John Doe (HR)', 'Sarah Lee (IT Team)', 'Mark Chen (Finance)'];

function TestModeTab({ agent, policyProfile }) {
  const [testUser, setTestUser] = useState(TEST_USERS[0]);
  const [testQuery, setTestQuery] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);

  function runTest() {
    if (!testQuery.trim()) return;
    setIsRunning(true);
    setResult(null);
    setTimeout(() => {
      setIsRunning(false);
      setResult({
        intent: (agent.selectedTopics || ['IT Support'])[0],
        confidence: 0.91,
        groupCheck: 'passed',
        policyCheck: policyProfile?.visibility?.enabled ? 'passed' : 'skipped',
        invocationCheck: policyProfile?.invocation?.enabled ? 'passed' : 'skipped',
        latency: '1.1s',
        fallbackReason: null,
        response: `Hi Jane! I can help you with that. Based on your request about "${testQuery}", I'm connecting to the ${agent.name} system to resolve this for you.\n\nPlease allow 2-3 minutes for the ticket to be created and assigned to the right team.`,
        type: 'external',
      });
    }, 1600);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Test as user</label>
          <select
            value={testUser}
            onChange={e => setTestUser(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TEST_USERS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Query</label>
          <div className="flex gap-2">
            <input
              value={testQuery}
              onChange={e => setTestQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runTest()}
              placeholder="e.g. My laptop won't connect to VPN"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={runTest}
              disabled={isRunning || !testQuery}
              className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors"
              style={{ backgroundColor: '#7C3AED' }}
            >
              {isRunning ? '…' : 'Run'}
            </button>
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Routing query → checking intent match → calling agent…
        </div>
      )}

      {result && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">Routing decision</div>
            <div className="p-4 grid grid-cols-4 gap-4 text-center">
              <div><div className="text-xs text-gray-400 mb-1">Intent matched</div><div className="text-sm font-semibold text-blue-600">{result.intent}</div></div>
              <div><div className="text-xs text-gray-400 mb-1">Confidence</div><div className="text-sm font-semibold text-green-600">{result.confidence}</div></div>
              <div><div className="text-xs text-gray-400 mb-1">Group check</div><div className="text-sm font-semibold text-green-600"><Check size={16} className="inline"/> {result.groupCheck}</div></div>
              <div><div className="text-xs text-gray-400 mb-1">Latency</div><div className="text-sm font-semibold text-gray-700">{result.latency}</div></div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Invocation Decision</div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">Visibility policy: <span className="font-semibold text-green-700">{result.policyCheck}</span></div>
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">Invocation policy: <span className="font-semibold text-green-700">{result.invocationCheck}</span></div>
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">Fallback reason: <span className="font-semibold text-gray-700">{result.fallbackReason || 'none'}</span></div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agent response</div>
            <p className="text-sm text-gray-800 whitespace-pre-line">{result.response}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-4 opacity-30 pointer-events-none select-none">
        {['Invocations over time', 'Completion rate trend', 'Latency distribution', 'Fallback reasons'].map(c => (
          <div key={c} className="bg-gray-100 rounded-xl h-40 flex items-end p-3">
            <div className="text-xs text-gray-400 font-medium">{c}</div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center bg-white border border-gray-200 rounded-2xl px-8 py-6 shadow-sm">
          <div className="mb-2"><BarChart2 size={32} /></div>
          <div className="text-sm font-semibold text-gray-800">Available in V1</div>
          <div className="text-xs text-gray-500 mt-1">Full analytics coming after MVP rollout</div>
        </div>
      </div>
    </div>
  );
}

export default function ExternalAgentDetail({
  agent,
  onBack,
  policyProfile,
  connectors = [],
  onOpenConnectors = () => {},
  onAgentUpdate = () => {},
}) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [targetGroups, setTargetGroups] = useState(agent.targetGroups || agent.groups || ['All Employees']);
  const [targetUsers, setTargetUsers] = useState(agent.targetUsers || []);
  const linkedConnector = (connectors || []).find((connection) => connection.id === agent.sourceConnectorId) || null;
  const linkedName = linkedConnector?.name || agent.sourceConnectorName || 'Unlinked connector';
  const linkedState = linkedConnector?.connectionState || 'disabled';
  const linkedStatusStyles = {
    connected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    testing: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    disabled: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  useEffect(() => {
    setTargetGroups(agent.targetGroups || agent.groups || ['All Employees']);
    setTargetUsers(agent.targetUsers || []);
  }, [agent.id, agent.targetGroups, agent.groups, agent.targetUsers]);

  return (
    <div className="animate-in slide-in-from-right-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">←</button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{agent.name}</h2>
              <span
                className="px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: PROVIDER_COLORS[agent.provider] || '#6B7280' }}
              >
                {PROVIDER_LABELS[agent.provider] || agent.provider}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                <Zap size={14} className="inline mx-1" />  External
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{agent.description || 'External MCP-connected agent'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-green-700 text-xs font-medium">Active</span>
          </span>
          <button className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors text-gray-600">
            Disable
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 rounded-xl border border-[#E5E7EB] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Linked MCP Connector</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[#111827]">{linkedName}</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${linkedStatusStyles[linkedState] || linkedStatusStyles.disabled}`}>
                {linkedState}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-[#64748B]">
              {linkedConnector
                ? `${linkedConnector.provider} · Last used ${linkedConnector.lastUsedAt || 'Never'} · Last tested ${linkedConnector.lastTestedAt || 'Never'}`
                : 'This external assistant is not linked to a configured MCP connector.'}
            </p>
          </div>
          <button
            onClick={onOpenConnectors}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors text-gray-700"
          >
            Open in Connectors
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-[#E5E7EB] bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Assistant targeting</div>
            <p className="mt-1 text-[12px] text-[#64748B]">Select one or more groups and/or users for this external assistant.</p>
          </div>
          <button
            onClick={() => {
              onAgentUpdate({
                ...agent,
                groups: targetGroups,
                targetGroups,
                targetUsers,
              });
            }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors text-gray-700"
          >
            Save targeting
          </button>
        </div>
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-gray-600 mb-1.5">Groups</div>
          <div className="flex flex-wrap gap-2">
            {TARGET_GROUP_OPTIONS.map((group) => (
              <button
                key={group}
                onClick={() => setTargetGroups((prev) => prev.includes(group) ? prev.filter((item) => item !== group) : [...prev, group])}
                className={`px-3 py-1 rounded-full text-[12px] border ${
                  targetGroups.includes(group)
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-gray-600 mb-1.5">Users</div>
          <div className="flex flex-wrap gap-2">
            {TARGET_USER_OPTIONS.map((user) => (
              <button
                key={user}
                onClick={() => setTargetUsers((prev) => prev.includes(user) ? prev.filter((item) => item !== user) : [...prev, user])}
                className={`px-3 py-1 rounded-full text-[12px] border ${
                  targetUsers.includes(user)
                    ? 'bg-sky-50 border-sky-200 text-sky-700'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {user}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            {tab === 'Analytics' && <span className="ml-1 text-xs text-gray-300">V1</span>}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && <OverviewTab agent={agent} />}
      {activeTab === 'Capabilities' && <CapabilitiesTab agent={agent} linkedConnector={linkedConnector} />}
      {activeTab === 'Authentication' && <AuthenticationTab agent={agent} />}
      {activeTab === 'Test mode' && <TestModeTab agent={agent} policyProfile={policyProfile} />}
      {activeTab === 'Analytics' && <AnalyticsTab />}
    </div>
  );
}
