import { Plane, Laptop, Users, CircleDollarSign, Scale, PartyPopper, Zap, Brain, Info, Link2 } from "lucide-react";
import { useState } from 'react';

const internalAssistants = [
  { id: 'travel', type: 'internal', name: 'Travel Policy', emoji: <Plane size={18} className="text-blue-500" />, groups: ['All Employees'], status: 'active', priority: 1, intents: 3 },
  { id: 'it', type: 'internal', name: 'IT Support', emoji: <Laptop size={18} className="text-gray-700" />, groups: ['All Employees'], status: 'active', priority: 2, intents: 5 },
  { id: 'hr', type: 'internal', name: 'HR Assistant', emoji: <Users size={18} className="text-indigo-500" />, groups: ['All Employees', 'Managers'], status: 'active', priority: 3, intents: 7 },
  { id: 'finance', type: 'internal', name: 'Finance & Expenses', emoji: <CircleDollarSign size={18} className="text-green-600" />, groups: ['Finance Team'], status: 'active', priority: 4, intents: 4 },
  { id: 'legal', type: 'internal', name: 'Legal & Compliance', emoji: <Scale size={18} className="text-slate-600" />, groups: ['Legal Team', 'Managers'], status: 'inactive', priority: 5, intents: 2 },
  { id: 'onboarding', type: 'internal', name: 'Onboarding', emoji: <PartyPopper size={18} className="text-yellow-500" />, groups: ['New Joiners'], status: 'active', priority: 6, intents: 6 },
];

const externalAssistants = [
  {
    id: 'ext-copilot-it',
    type: 'external',
    name: 'IT Helpdesk (Copilot Studio)',
    provider: 'copilot_studio',
    groups: ['All Employees'],
    targetGroups: ['All Employees'],
    targetUsers: ['maria.schmidt@staffbase.com'],
    sourceConnectorId: 'copilot-it-helpdesk',
    sourceConnectorName: 'IT Helpdesk Agent',
    status: 'active',
    latency: '1.2s',
    completionRate: 94,
    attachment: 'standalone',
  },
  {
    id: 'ext-gemini-hr',
    type: 'external',
    name: 'HR Workday Agent (Gemini)',
    provider: 'gemini',
    groups: ['HR Team', 'Managers'],
    targetGroups: ['HR Team', 'Managers'],
    targetUsers: ['john.doe@staffbase.com'],
    sourceConnectorId: 'gemini-hr-workday',
    sourceConnectorName: 'HR Workday Agent',
    status: 'active',
    latency: '0.8s',
    completionRate: 97,
    attachment: 'standalone',
  },
];

const PROVIDER_LABELS = { copilot_studio: 'Copilot Studio', gemini: 'Gemini', custom: 'Custom MCP' };
const PROVIDER_COLORS = { copilot_studio: '#0078d4', gemini: '#1a73e8', custom: '#6B7280' };

function TypeBadge({ type }) {
  if (type === 'external') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
        <Zap size={12} className="inline mx-1" /> External
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
      <Brain size={12} className="inline mx-1" /> Internal
    </span>
  );
}

function StatusDot({ status }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
      <span className={status === 'active' ? 'text-green-700' : 'text-gray-400'}>
        {status === 'active' ? 'Active' : 'Inactive'}
      </span>
    </span>
  );
}

function ProviderBadge({ provider }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ backgroundColor: PROVIDER_COLORS[provider] || '#6B7280' }}
    >
      {PROVIDER_LABELS[provider] || provider}
    </span>
  );
}

export default function AssistantsTab({
  onSelect,
  onSelectExternal,
  onCreateExternal = () => {},
  hasAgentConnector = true,
  assistants = null,
  connectors = [],
}) {
  const [filter, setFilter] = useState('all');

  const defaultAll = [...internalAssistants, ...externalAssistants];
  const assistantMap = new Map(defaultAll.map((assistant) => [assistant.id, assistant]));
  (assistants || []).forEach((assistant) => {
    const existing = assistantMap.get(assistant.id) || {};
    assistantMap.set(assistant.id, {
      ...existing,
      ...assistant,
      groups: assistant.groups || assistant.targetGroups || assistant.selectedGroups || existing.groups || [],
    });
  });
  const allAssistants = Array.from(assistantMap.values());
  const internal = allAssistants.filter((assistant) => assistant.type !== 'external');
  const external = allAssistants.filter((assistant) => assistant.type === 'external');
  const visible = filter === 'all' ? allAssistants : filter === 'internal' ? internal : external;
  const connectorById = new Map((connectors || []).map((connection) => [connection.id, connection]));

  const connectionStateStyles = {
    connected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    testing: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    disabled: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Assistants</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {internal.length} internal · {external.length} external connected
          </p>
          <p className="text-xs text-gray-500 mt-1">
            External assistants run through linked MCP connectors in Connectors &gt; Configured.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelect({ _new: true })}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13.5px] font-bold text-white transition-all hover:scale-105 shadow-[0_4px_12px_rgba(59,130,246,0.3)] active:scale-[0.98]"
            style={{ backgroundColor: '#3B82F6' }}
          >
            + Create Assistant
          </button>
          <button
            onClick={onCreateExternal}
            disabled={!hasAgentConnector}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13.5px] font-bold text-white transition-all hover:scale-105 shadow-[0_4px_12px_rgba(124,58,237,0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <Zap size={14} /> Create External Assistant
          </button>
        </div>
      </div>
      {!hasAgentConnector && (
        <div className="mb-4 rounded-xl border border-[#DDD6FE] bg-violet-50 px-4 py-3 text-[12px] text-violet-800">
          Create an Agent MCP connector in the top-level Connectors module before adding external assistants.
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          ['all', 'All'],
          ['internal', <><Brain size={12} className="inline mx-1" /> Internal</>],
          ['external', <><Zap size={12} className="inline mx-1" /> External</>]
        ].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* External agents info callout */}
      {filter === 'external' && (
        <div className="flex items-start gap-3 p-4 mb-2 bg-purple-50 border border-purple-200 rounded-xl">
          <Info size={15} className="text-purple-600 mt-0.5 shrink-0" />
          <p className="text-[13px] text-purple-800">
            <span className="font-bold">External agents</span> connect via MCP and handle specific employee intents. Navigator routes queries to them automatically based on their declared capabilities. User context (role, region, groups) is passed with every request so agents can personalize their responses.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Targeting</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visible.map((a) => (
              (() => {
                const groupList = a.groups || a.selectedGroups || [];
                const userList = a.targetUsers || [];
                const linkedConnector = a.type === 'external'
                  ? connectorById.get(a.sourceConnectorId)
                  : null;
                const linkedConnectorName = linkedConnector?.name || a.sourceConnectorName || 'Unlinked connector';
                const linkedState = linkedConnector?.connectionState || 'disabled';
                return (
              <tr
                key={a.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => a.type === 'external' ? onSelectExternal(a) : onSelect(a)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {a.emoji && <span className="text-lg">{a.emoji}</span>}
                    <span className="font-medium text-gray-900">{a.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={a.type} />
                  {a.provider && <ProviderBadge provider={a.provider} />}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {groupList.slice(0, 2).map(g => (
                      <span key={g} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{g}</span>
                    ))}
                    {groupList.length > 2 && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-400">+{groupList.length - 2}</span>
                    )}
                    {userList.length > 0 && (
                      <span className="px-2 py-0.5 bg-sky-50 rounded text-xs text-sky-700">{userList.length} user{userList.length === 1 ? '' : 's'}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {a.type === 'internal'
                    ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Link2 size={12} />
                        {(a.assignedCapabilityIds || []).length} capabilit{(a.assignedCapabilityIds || []).length === 1 ? 'y' : 'ies'}
                      </span>
                    )
                    : (
                      <div className="space-y-1">
                        <div className="text-gray-700">{a.completionRate || 94}% completion · {a.latency || '1.2s'}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-500">Linked MCP:</span>
                          <span className="text-[11px] font-semibold text-gray-800">{linkedConnectorName}</span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${connectionStateStyles[linkedState] || connectionStateStyles.disabled}`}>
                            {linkedState}
                          </span>
                        </div>
                      </div>
                    )
                  }
                </td>
                <td className="px-4 py-3"><StatusDot status={a.status} /></td>
                <td className="px-4 py-3 text-right text-gray-400 text-xs">›</td>
              </tr>
                );
              })()
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="text-center py-12 text-gray-400">No assistants found.</div>
        )}
      </div>
    </div>
  );
}
