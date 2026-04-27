import { AppWindow, Sparkles, Plug, Globe, Link2, AlertTriangle, Zap } from "lucide-react";
import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

const PROVIDERS = [
  { id: 'copilot_studio', label: 'Copilot Studio', icon: <AppWindow size={24} />, description: 'Microsoft Copilot Studio agents via MCP' },
  { id: 'gemini', label: 'Gemini', icon: <Sparkles size={24} />, description: 'Google Gemini agents and Workspace integrations' },
  { id: 'custom', label: 'Custom MCP', icon: <Plug size={24} />, description: 'Any MCP-compatible agent or server' },
];

const TOPICS = ['IT Support', 'HR', 'Finance', 'Legal', 'Travel', 'Onboarding', 'Payroll', 'Facilities', 'Security', 'Sales', 'Product', 'Engineering'];
const ALL_GROUPS = ['All Employees', 'Managers', 'HR Team', 'Finance Team', 'Legal Team', 'IT Team', 'New Joiners', 'Executives'];

const STEPS = ['Attachment', 'Connection', 'Capabilities'];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < current ? 'bg-blue-500 text-white' : i === current ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {i < current ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${i === current ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`w-12 h-px mx-3 ${i < current ? 'bg-blue-400' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  );
}

function Step1Attachment({ data, setData, internalAssistants }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">How should this agent be attached?</h3>
        <p className="text-sm text-gray-500">Standalone agents respond independently. Attached agents act as a fallback or specialist under an internal assistant.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'standalone', label: 'Standalone', icon: <Globe size={24} />, desc: 'Responds to matched intents directly, independent of internal assistants' },
          { id: 'attached', label: 'Attached to internal', icon: <Link2 size={24} />, desc: 'Acts under a specific internal assistant — inherits its groups and escalation context' },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => setData(d => ({ ...d, attachmentMode: opt.id }))}
            className={`text-left p-4 rounded-xl border-2 transition-colors ${
              data.attachmentMode === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">{opt.icon}</div>
            <div className="font-medium text-gray-900 text-sm mb-1">{opt.label}</div>
            <div className="text-xs text-gray-500">{opt.desc}</div>
          </button>
        ))}
      </div>
      {data.attachmentMode === 'attached' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Attach to which internal assistant?</label>
          <select
            value={data.parentAssistant || ''}
            onChange={e => setData(d => ({ ...d, parentAssistant: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select assistant…</option>
            {internalAssistants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function Step2Connection({ data, setData }) {
  const [testStatus, setTestStatus] = useState(null);

  function testConnection() {
    setTestStatus('testing');
    setTimeout(() => setTestStatus(data.endpoint ? 'ok' : 'error'), 1400);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agent name</label>
          <input
            value={data.name || ''}
            onChange={e => setData(d => ({ ...d, name: e.target.value }))}
            placeholder="e.g. IT Helpdesk Agent"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            value={data.description || ''}
            onChange={e => setData(d => ({ ...d, description: e.target.value }))}
            placeholder="What does this agent handle?"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
        <div className="grid grid-cols-3 gap-2">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => setData(d => ({ ...d, provider: p.id }))}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${
                data.provider === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{p.icon}</span>
              <div className="text-xs font-semibold text-gray-900 mt-1">{p.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Connection type</label>
          <select
            value={data.connectionType || 'mcp'}
            onChange={e => setData(d => ({ ...d, connectionType: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="mcp">MCP (Model Context Protocol)</option>
            <option value="rest">REST API</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Authentication</label>
          <select
            value={data.authType || 'oauth2'}
            onChange={e => setData(d => ({ ...d, authType: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="oauth2">OAuth 2.0 (Client Credentials)</option>
            <option value="entra">Microsoft Entra ID</option>
            <option value="apikey">API Key</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
        <div className="flex gap-2">
          <input
            value={data.endpoint || ''}
            onChange={e => setData(d => ({ ...d, endpoint: e.target.value }))}
            placeholder="https://your-agent.example.com/mcp"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={testConnection}
            disabled={testStatus === 'testing'}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {testStatus === 'testing' ? '<Loader2 size={12} className="inline mr-1 animate-spin" /> Testing…' : 'Test connection'}
          </button>
        </div>
        {testStatus === 'ok' && <p className="text-xs text-green-600 mt-1"><Check size={12} className="inline" /> Connected — 142ms avg latency</p>}
        {testStatus === 'error' && <p className="text-xs text-red-500 mt-1"><X size={12} className="inline" /> Could not reach endpoint. Check URL and credentials.</p>}
      </div>

      {(data.authType === 'oauth2' || data.authType === 'entra') && (
        <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
            <input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
            <input
              type="password"
              placeholder="••••••••••••••••"
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {data.authType === 'entra' && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tenant ID</label>
              <input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Step3Capabilities({ data, setData }) {
  const [newExample, setNewExample] = useState('');

  function toggleTopic(t) {
    const topics = data.selectedTopics || [];
    setData(d => ({ ...d, selectedTopics: topics.includes(t) ? topics.filter(x => x !== t) : [...topics, t] }));
  }

  function toggleGroup(g) {
    const groups = data.selectedGroups || [];
    setData(d => ({ ...d, selectedGroups: groups.includes(g) ? groups.filter(x => x !== g) : [...groups, g] }));
  }

  function addExample() {
    if (!newExample.trim()) return;
    setData(d => ({ ...d, exampleQueries: [...(d.exampleQueries || []), newExample.trim()] }));
    setNewExample('');
  }

  function removeExample(i) {
    setData(d => ({ ...d, exampleQueries: d.exampleQueries.filter((_, idx) => idx !== i) }));
  }

  const hasConflict = (data.selectedTopics || []).includes('IT Support') && (data.selectedGroups || []).includes('All Employees');

  return (
    <div className="space-y-6">
      {hasConflict && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <span className="text-amber-500 mt-0.5"><AlertTriangle size={16} /></span>
          <div>
            <div className="text-sm font-medium text-amber-800">Potential routing conflict detected</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Another assistant (IT Support) already handles IT Support intents for All Employees.
              You can still connect this agent — an admin will need to set priority in Studio.
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">Topic areas</label>
        <p className="text-xs text-gray-500 mb-2">What domains does this agent handle? Used for intent routing.</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map(t => (
            <button
              key={t}
              onClick={() => toggleTopic(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                (data.selectedTopics || []).includes(t)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">Example queries</label>
        <p className="text-xs text-gray-500 mb-2">Help the router understand what kinds of questions this agent handles.</p>
        <div className="flex gap-2 mb-2">
          <input
            value={newExample}
            onChange={e => setNewExample(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addExample()}
            placeholder="e.g. Reset my laptop password"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={addExample} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors">+ Add</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(data.exampleQueries || []).map((q, i) => (
            <span key={i} className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-700">
              {q}
              <button onClick={() => removeExample(i)} className="text-gray-400 hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">Groups with access</label>
        <p className="text-xs text-gray-500 mb-2">Even when intent matches, only users in these groups can reach this agent.</p>
        <div className="flex flex-wrap gap-2">
          {ALL_GROUPS.map(g => (
            <button
              key={g}
              onClick={() => toggleGroup(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                (data.selectedGroups || []).includes(g)
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Confidence threshold: <span className="text-blue-600">{data.confidenceThreshold || 0.75}</span>
        </label>
        <input
          type="range" min="0.5" max="1" step="0.05"
          value={data.confidenceThreshold || 0.75}
          onChange={e => setData(d => ({ ...d, confidenceThreshold: parseFloat(e.target.value) }))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0.5 — Broad</span><span>1.0 — Strict</span></div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Fallback behaviour</label>
        <div className="space-y-2">
          {[['global', 'Route to global agent'], ['decline', 'Decline gracefully'], ['human', 'Escalate to human support']].map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio" name="fallback" value={val}
                checked={(data.fallback || 'global') === val}
                onChange={() => setData(d => ({ ...d, fallback: val }))}
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

const INTERNAL_STUBS = [
  { id: 'travel', name: 'Travel Policy', emoji: null },
  { id: 'it', name: 'IT Support', emoji: null },
  { id: 'hr', name: 'HR Assistant', emoji: null },
];

export default function ExternalAgentCreation({ onBack, onComplete, agentConnectors = [] }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ attachmentMode: 'standalone', confidenceThreshold: 0.75, fallback: 'global', selectedTopics: [], selectedGroups: [], exampleQueries: [], connectorId: '' });

  function next() { if (step < 2) setStep(s => s + 1); }
  function back() { if (step > 0) setStep(s => s - 1); else onBack(); }

  function finish() {
    const agent = {
      id: `ext-${Date.now()}`,
      type: 'external',
      name: data.name || 'New External Agent',
      provider: data.provider || 'custom',
      groups: data.selectedGroups || [],
      status: 'active',
      latency: '—',
      completionRate: 0,
      attachment: data.attachmentMode,
      ...data,
    };
    onComplete(agent);
  }

  const canProceed = step === 0
    ? (data.attachmentMode === 'standalone' || data.parentAssistant)
    : step === 1
    ? (data.name && data.endpoint && data.provider && data.connectorId)
    : ((data.selectedTopics || []).length > 0 && (data.selectedGroups || []).length > 0);

  return (
    <div className="animate-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={back} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
          ← 
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Connect External Agent</h2>
          <p className="text-sm text-gray-500">Add an MCP-connected agent to the Navigator network</p>
        </div>
      </div>

      <StepIndicator current={step} />

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        {agentConnectors.length === 0 && (
          <div className="mb-4 rounded-lg border border-[#DDD6FE] bg-violet-50 px-3 py-2 text-[12px] text-violet-800">
            Create an Agent MCP connector in Connectors first, then bind it here.
          </div>
        )}
        {step === 0 && <Step1Attachment data={data} setData={setData} internalAssistants={INTERNAL_STUBS} />}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bound Agent MCP connector</label>
              <select
                value={data.connectorId}
                onChange={(e) => {
                  const connector = agentConnectors.find((item) => item.id === e.target.value);
                  setData((draft) => ({
                    ...draft,
                    connectorId: e.target.value,
                    endpoint: connector?.endpoint || draft.endpoint,
                    provider: connector?.provider?.toLowerCase().includes('copilot') ? 'copilot_studio' : connector?.provider?.toLowerCase().includes('gemini') ? 'gemini' : 'custom',
                    name: draft.name || connector?.name || '',
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="">Select connector…</option>
                {agentConnectors.map((connector) => (
                  <option key={connector.id} value={connector.id}>{connector.name} · {connector.provider}</option>
                ))}
              </select>
            </div>
            <Step2Connection data={data} setData={setData} />
          </div>
        )}
        {step === 2 && <Step3Capabilities data={data} setData={setData} />}
      </div>

      <div className="flex justify-between">
        <button onClick={back} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors">
          {step === 0 ? 'Cancel' : '← Back'}
        </button>
        {step < 2
          ? <button onClick={next} disabled={!canProceed} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors" style={{ backgroundColor: '#3B82F6' }}>
              Next →
            </button>
          : <button onClick={finish} disabled={!canProceed} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors" style={{ backgroundColor: '#7C3AED' }}>
              <Zap size={14} className="inline mr-1" /> Connect agent
            </button>
        }
      </div>
    </div>
  );
}
