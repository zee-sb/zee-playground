import React from 'react';
import { SettingsCard } from '../../components/SettingsCard';

const CapabilitiesTab = ({
  platformConnections,
  assistantAssignments = [],
  onNavigate,
}) => {
  const getUsage = (connectionId) => {
    const usedBy = assistantAssignments
      .filter((assistant) => (assistant.assignedCapabilityIds || []).some((capId) => capId.startsWith(`${connectionId}:`)))
      .map((assistant) => assistant.name);
    return usedBy.length === 0 ? 'None' : usedBy.join(', ');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <SettingsCard
        title="Navigator · Connector Summary"
        description="Connector lifecycle is managed in the top-level Connectors module. This page shows effective coverage only."
      >
        <div className="overflow-hidden border border-[#E5E7EB] rounded-xl">
          <table className="w-full text-left">
            <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[10px] uppercase tracking-widest text-[#94A3B8]">
              <tr>
                <th className="px-4 py-3">Connector</th>
                <th className="px-4 py-3">Navigator availability</th>
                <th className="px-4 py-3">Available capabilities</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Used in assistants</th>
              </tr>
            </thead>
            <tbody className="text-[12px] divide-y divide-[#F1F5F9]">
              {platformConnections.map((connection) => (
                <tr key={connection.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#111827]">{connection.name}</div>
                    <div className="text-[#64748B]">{connection.type === 'full_agent' ? 'External assistant' : 'Action/knowledge connector'}</div>
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{connection.navigatorEnabled ? 'Enabled' : 'Not assigned'}</td>
                  <td className="px-4 py-3 text-[#111827]">{(connection.tools || []).length} actions/resources</td>
                  <td className="px-4 py-3 text-[#64748B]">{connection.navigatorGroups?.length ? `${connection.navigatorGroups.length} groups` : 'All employees'}</td>
                  <td className="px-4 py-3 text-[#64748B]">{getUsage(connection.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
        <div className="text-[11px] font-black uppercase tracking-widest text-[#64748B] mb-2">Important UX Rule</div>
        <p className="text-[13px] text-[#475569]">
          Connectors are configured globally once. Navigator and assistants only consume those global assignments.
        </p>
        <button
          onClick={() => onNavigate('connections')}
          className="mt-3 text-[12px] font-bold text-[#2563EB] hover:underline"
        >
          Open Connectors module →
        </button>
      </div>
    </div>
  );
};

export default CapabilitiesTab;
