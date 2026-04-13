import { useState } from 'react';
import { Check, BarChart2, Zap } from 'lucide-react';

const PROVIDER_LABELS = { copilot_studio: 'Copilot Studio', gemini: 'Gemini', custom: 'Custom MCP' };
const PROVIDER_COLORS = { copilot_studio: '#0078d4', gemini: '#1a73e8', custom: '#6B7280' };

const TABS = ['Overview', 'Capabilities', 'Authentication', 'Test mode', 'Analytics'];

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
    ['Groups', (agent.groups || []).join(', ') || '—'],
    ['Fallback', agent.fallback || 'Route to global agent'],
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

function CapabilitiesTab({ agent }) {
  const topics = agent.selectedTopics || ['IT Support', 'Security'];
  const examples = agent.exampleQueries || ['Reset my laptop password', 'VPN not connecting', 'Request software license'];
  const threshold = agent.confidenceThreshold || 0.75;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Declared intent areas</h4>
        <div className="flex flex-wrap gap-2 mb-4">
          {topics.map(t => (
            <span key={t} className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">{t}</span>
          ))}
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <div className="text-xs font-medium text-gray-600 mb-1">Confidence threshold</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${threshold * 100}%` }} />
            </div>
          </div>
          <div className="text-sm font-bold text-gray-800">{threshold}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Example queries</h4>
        <div className="flex flex-wrap gap-2">
          {examples.map((q, i) => (
            <span key={i} className="px-2.5 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-700">"{q}"</span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">These examples help the Navigator router decide when to call this agent.</p>
      </div>
    </div>
  );
}

function AuthenticationTab({ agent }) {
  const jwtPayload = JSON.stringify({
    sub: "user_12345",
    name: "Jane Smith",
    email: "jane.smith@company.com",
    role: "employee",
    department: "Engineering",
    groups: ["All Employees", "IT Team"],
    staffbase_instance: "company.staffbase.com",
    iat: 1712345678,
    exp: 1712346578
  }, null, 2);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-800">OAuth 2.0 credentials</h4>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">● Active</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Client ID</label>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
              <code className="text-xs text-gray-700 flex-1">a8f3d2e1-4b5c-4d9e-8f2a-1c3b5d7e9f01</code>
              <button className="text-xs text-gray-400 hover:text-gray-600">Copy</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Client Secret</label>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
              <code className="text-xs text-gray-400 flex-1">••••••••••••••••••••••••••••</code>
              <button className="text-xs text-blue-500 hover:text-blue-700 font-medium">Rotate secret</button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-1">Staffbase-issued JWT</h4>
        <p className="text-xs text-gray-500 mb-3">A short-lived token (15 min TTL) passed on every request so the agent can personalize without raw credential access.</p>
        <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">{jwtPayload}</pre>
      </div>
    </div>
  );
}

const TEST_USERS = ['Jane Smith (Engineering)', 'John Doe (HR)', 'Sarah Lee (IT Team)', 'Mark Chen (Finance)'];

function TestModeTab({ agent }) {
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
        latency: '1.1s',
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

export default function ExternalAgentDetail({ agent, onBack }) {
  const [activeTab, setActiveTab] = useState('Overview');

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
      {activeTab === 'Capabilities' && <CapabilitiesTab agent={agent} />}
      {activeTab === 'Authentication' && <AuthenticationTab agent={agent} />}
      {activeTab === 'Test mode' && <TestModeTab agent={agent} />}
      {activeTab === 'Analytics' && <AnalyticsTab />}
    </div>
  );
}
