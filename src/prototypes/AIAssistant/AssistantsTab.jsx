import { Plane, Laptop, Users, CircleDollarSign, Scale, PartyPopper, Zap, Brain } from "lucide-react";
import { useState } from 'react';
import {  } from 'lucide-react';

const internalAssistants = [
  { id: 'travel', type: 'internal', name: 'Travel Policy', emoji: <Plane size={18} className="text-blue-500" />, groups: ['All Employees'], status: 'active', priority: 1, intents: 3 },
  { id: 'it', type: 'internal', name: 'IT Support', emoji: <Laptop size={18} className="text-gray-700" />, groups: ['All Employees'], status: 'active', priority: 2, intents: 5 },
  { id: 'hr', type: 'internal', name: 'HR Assistant', emoji: <Users size={18} className="text-indigo-500" />, groups: ['All Employees', 'Managers'], status: 'active', priority: 3, intents: 7 },
  { id: 'finance', type: 'internal', name: 'Finance & Expenses', emoji: <CircleDollarSign size={18} className="text-green-600" />, groups: ['Finance Team'], status: 'active', priority: 4, intents: 4 },
  { id: 'legal', type: 'internal', name: 'Legal & Compliance', emoji: <Scale size={18} className="text-slate-600" />, groups: ['Legal Team', 'Managers'], status: 'inactive', priority: 5, intents: 2 },
  { id: 'onboarding', type: 'internal', name: 'Onboarding', emoji: <PartyPopper size={18} className="text-yellow-500" />, groups: ['New Joiners'], status: 'active', priority: 6, intents: 6 },
];

const externalAssistants = [
  { id: 'ext-copilot-it', type: 'external', name: 'IT Helpdesk (Copilot Studio)', provider: 'copilot_studio', groups: ['All Employees'], status: 'active', latency: '1.2s', completionRate: 94, attachment: 'standalone' },
  { id: 'ext-gemini-hr', type: 'external', name: 'HR Workday Agent (Gemini)', provider: 'gemini', groups: ['HR Team', 'Managers'], status: 'active', latency: '0.8s', completionRate: 97, attachment: 'standalone' },
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

export default function AssistantsTab({ onSelect, onSelectExternal, onCreateExternal }) {
  const [filter, setFilter] = useState('all');

  const allAssistants = [...internalAssistants, ...externalAssistants];
  const visible = filter === 'all' ? allAssistants
    : filter === 'internal' ? internalAssistants
    : externalAssistants;

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Assistants</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {internalAssistants.length} internal · {externalAssistants.length} external connected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateExternal}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-50 transition-colors"
          >
            <Zap size={14} className="inline mr-1" /> Connect External
          </button>
          <button
            onClick={() => onSelect({ _new: true })}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#3B82F6' }}
          >
            + Create Assistant
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {[['all', 'All'], ['internal', '<Brain size={12} className="inline mx-1" /> Internal'], ['external', '<Zap size={12} className="inline mx-1" /> External']].map(([val, label]) => (
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

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Groups</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visible.map((a) => (
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
                    {a.groups.slice(0, 2).map(g => (
                      <span key={g} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{g}</span>
                    ))}
                    {a.groups.length > 2 && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-400">+{a.groups.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {a.type === 'internal'
                    ? <span>{a.intents} intent{a.intents !== 1 ? 's' : ''} · P{a.priority}</span>
                    : <span>{a.completionRate}% completion · {a.latency}</span>
                  }
                </td>
                <td className="px-4 py-3"><StatusDot status={a.status} /></td>
                <td className="px-4 py-3 text-right text-gray-400 text-xs">›</td>
              </tr>
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
