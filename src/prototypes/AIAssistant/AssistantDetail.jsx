import React, { useState } from 'react';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle, Input, Select } from '../../components/FormElements';
import { useNotification } from '../../components/NotificationProvider';
import { 
  ArrowLeft,
  Trash2,
  Search,
  ChevronDown,
  FileText,
  Upload,
  Globe,
  Database,
  Shield,
  Zap,
  Check,
  ChevronRight,
  Sparkles
} from 'lucide-react';

const AssistantDetail = ({ assistant, onBack, capabilityIndex = {}, connectors = [], onAssistantUpdate }) => {
  const { success } = useNotification();
  const [name, setName] = useState(assistant.name || '');
  const [instructions, setInstructions] = useState(
    assistant.instructions || `This assistant helps employees with ${assistant.name?.toLowerCase()} related questions`
  );
  
  const [sharepointFiles, setSharepointFiles] = useState([
    { id: 1, name: 'Staffbase_Travel_Expense_Assistant_Policy_Manual.pdf', size: '2.4MB' }
  ]);

  const [selectedGroups, setSelectedGroups] = useState(assistant.selectedGroups || ['All Employees']);
  const [selectedUsers, setSelectedUsers] = useState(assistant.targetUsers || []);
  const ALL_GROUPS = ['All Employees', 'Managers', 'HR Team', 'Finance Team', 'Legal Team', 'IT Team', 'New Joiners', 'Executives'];
  const ALL_USERS = ['alex.meyer@staffbase.com', 'maria.schmidt@staffbase.com', 'john.doe@staffbase.com', 'liam.chen@staffbase.com', 'sarah.lee@staffbase.com'];

  const handleSave = () => {
    if (onAssistantUpdate) {
      onAssistantUpdate({
        ...assistant,
        name,
        instructions,
        selectedGroups,
        targetGroups: selectedGroups,
        targetUsers: selectedUsers,
      });
    }
    success('Saved successfully', `${name} settings have been updated.`);
  };

  const assignedCapabilities = (assistant.assignedCapabilityIds || [])
    .map((id) => capabilityIndex[id])
    .filter(Boolean);

  const connectorRows = connectors.map((connector) => {
    const connectorCapabilities = (connector.capabilities || []).filter((capability) =>
      (assistant.assignedCapabilityIds || []).includes(capability.id)
    );
    return {
      connector,
      connectorCapabilities,
      enabled: connectorCapabilities.length > 0,
    };
  });

  const toggleConnectorForAssistant = (connectorId, enabled) => {
    if (!onAssistantUpdate) return;
    const connector = connectors.find((item) => item.id === connectorId);
    if (!connector) return;
    const connectorCapabilityIds = (connector.capabilities || []).map((capability) => capability.id);
    const nextAssigned = enabled
      ? Array.from(new Set([...(assistant.assignedCapabilityIds || []), ...connectorCapabilityIds]))
      : (assistant.assignedCapabilityIds || []).filter((capabilityId) => !connectorCapabilityIds.includes(capabilityId));
    onAssistantUpdate({
      ...assistant,
      assignedCapabilityIds: nextAssigned,
      selectedGroups,
      name,
      instructions,
    });
  };

  return (
    <div className="flex-1 bg-[#F9FAFB] overflow-y-auto">
      {/* Platform Header */}
      <header className="h-[64px] bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-[#F3F4F6] rounded-full transition-colors text-[#6B7280]"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[20px] font-bold text-[#111827] tracking-tight">{name}</h1>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack} 
            className="text-[14px] font-medium text-[#EF4444] hover:underline"
          >
            Delete
          </button>
          <button 
            onClick={handleSave} 
            className="px-6 py-2 bg-[#0055F9] text-white text-[14px] font-bold rounded-md hover:bg-[#0044CC] transition-colors shadow-sm"
          >
            Save
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="max-w-[1000px] mx-auto py-8 px-8 space-y-6">
        
        {/* General Section */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
           <h2 className="text-[18px] font-bold text-[#111827] mb-6">General</h2>
           
           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[14px] font-bold text-[#111827]">Name</label>
                 <p className="text-[12px] text-[#6B7280]">Give this assistant a name. It will be visible to your users.</p>
                 <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-[40px] px-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px]"
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[14px] font-bold text-[#111827]">Instructions</label>
                 <div className="relative">
                    <textarea 
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      className="w-full min-h-[160px] p-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px] leading-relaxed resize-none"
                    />
                    <div className="text-right text-[11px] text-[#9CA3AF] mt-1">
                       {instructions.length}/2000
                    </div>
                 </div>
                 <p className="text-[12px] text-[#6B7280]">
                    Describe this Assistant's purpose and the questions it should answer. Navigator automatically uses this Assistant for questions that match these instructions.
                 </p>
              </div>
           </div>
        </div>

        {/* Sources Section */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
           <h2 className="text-[18px] font-bold text-[#111827] mb-6">Sources</h2>
           
           <div className="space-y-8">
              {/* Pages Search */}
              <div className="space-y-2">
                 <label className="text-[14px] font-bold text-[#111827]">Pages</label>
                 <p className="text-[12px] text-[#6B7280]">Select pages this Assistant uses to answer questions. You can select pages from all spaces here.</p>
                 <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={16} />
                    <input 
                      type="text"
                      placeholder="Search pages..."
                      className="w-full h-[40px] pl-10 pr-10 border border-[#E5E7EB] rounded-md focus:border-[#0055F9] outline-none text-[14px]"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={16} />
                 </div>
              </div>

              {/* Files Upload */}
              <div className="space-y-2">
                 <label className="text-[14px] font-bold text-[#111827]">Files</label>
                 <p className="text-[12px] text-[#6B7280]">Upload PDF files to this Assistant. The Assistant uses them to answer questions.</p>
                 
                 <div className="space-y-3 pt-2">
                    {sharepointFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-md bg-[#FAFAFA]">
                        <div className="flex items-center gap-3">
                           <FileText size={18} className="text-[#6B7280]" />
                           <span className="text-[13px] text-[#111827] font-medium">{file.name}</span>
                        </div>
                        <button className="text-[#EF4444] hover:bg-red-50 p-1.5 rounded transition-colors">
                           <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    
                    <div className="border-2 border-dashed border-[#E5E7EB] rounded-md p-10 flex flex-col items-center justify-center bg-[#FAFAFA] hover:border-[#0055F9] transition-all group">
                       <p className="text-[14px] text-[#6B7280] mb-4">Drag and drop files here to upload</p>
                       <div className="flex items-center gap-2">
                          <button className="px-4 py-2 border border-[#E5E7EB] bg-white rounded-md text-[13px] font-bold text-[#111827] flex items-center gap-2 hover:bg-[#F9FAFB] shadow-sm">
                             Choose from <ChevronDown size={14} />
                          </button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Visibility & Advanced (New Section to keep features) */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
           <h2 className="text-[18px] font-bold text-[#111827] mb-6">Orchestration & Visibility</h2>
           
           <div className="space-y-8">
              <div className="space-y-3">
                 <label className="text-[14px] font-bold text-[#111827]">Visibility Groups</label>
                 <p className="text-[12px] text-[#6B7280]">Control which user segments can route to this assistant.</p>
                 <div className="flex flex-wrap gap-2 pt-1">
                    {ALL_GROUPS.map(g => (
                      <button
                        key={g}
                        onClick={() => setSelectedGroups(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g])}
                        className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium transition-all ${
                          selectedGroups.includes(g) 
                            ? 'bg-[#0055F9] text-white border border-[#0055F9]' 
                            : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="space-y-3">
                 <label className="text-[14px] font-bold text-[#111827]">Target users</label>
                 <p className="text-[12px] text-[#6B7280]">Optional direct allowlist for specific users.</p>
                 <div className="flex flex-wrap gap-2 pt-1">
                    {ALL_USERS.map((user) => (
                      <button
                        key={user}
                        onClick={() => setSelectedUsers((prev) => prev.includes(user) ? prev.filter((item) => item !== user) : [...prev, user])}
                        className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium transition-all ${
                          selectedUsers.includes(user)
                            ? 'bg-[#0EA5E9] text-white border border-[#0EA5E9]'
                            : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        {user}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-[#F3F4F6]">
                 <div className="space-y-3">
                    <div className="flex justify-between">
                       <label className="text-[14px] font-bold text-[#111827]">Routing Sensitivity</label>
                       <span className="text-[13px] font-bold text-[#0055F9]">75%</span>
                    </div>
                    <input type="range" className="w-full accent-[#0055F9]" min="0" max="100" defaultValue="75" />
                    <div className="flex justify-between text-[11px] text-[#9CA3AF] uppercase font-bold tracking-wider">
                       <span>Broad</span>
                       <span>Precise</span>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[14px] font-bold text-[#111827]">Response Policy</label>
                    <Toggle label="Mirror User Permissions" description="Strictly adhere to source ACLs" checked={true} />
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
          <h2 className="text-[18px] font-bold text-[#111827] mb-2">Connectors</h2>
          <p className="text-[12px] text-[#6B7280] mb-5">
            Configure which global connectors are available to this assistant. Availability here is separate from connector-level user access rules.
          </p>
          <div className="overflow-hidden border border-[#E5E7EB] rounded-xl">
            <table className="w-full text-left">
              <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[10px] uppercase tracking-widest text-[#94A3B8]">
                <tr>
                  <th className="px-3 py-2">Connector</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Capabilities enabled for this assistant</th>
                </tr>
              </thead>
              <tbody className="text-[12px] divide-y divide-[#F1F5F9]">
                {connectorRows.map(({ connector, connectorCapabilities, enabled }) => (
                  <tr key={connector.id}>
                    <td className="px-3 py-2 font-semibold text-[#111827]">{connector.name}</td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) => toggleConnectorForAssistant(connector.id, event.target.checked)}
                        />
                        <span>{enabled ? 'Enabled' : 'Not available'}</span>
                      </label>
                    </td>
                    <td className="px-3 py-2 text-[#64748B]">
                      {connectorCapabilities.length > 0
                        ? connectorCapabilities.map((capability) => capability.title).join(', ')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
          <h2 className="text-[18px] font-bold text-[#111827] mb-2">Invocation Decision</h2>
          <p className="text-[12px] text-[#6B7280] mb-5">Runtime routing checks and capability assignment preview for this assistant.</p>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-3 border border-[#E5E7EB] rounded-lg bg-[#F8FAFC]">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#94A3B8]">Visibility</div>
              <div className="text-[13px] font-semibold text-[#111827]">{selectedGroups.length} groups · {selectedUsers.length} users</div>
            </div>
            <div className="p-3 border border-[#E5E7EB] rounded-lg bg-[#F8FAFC]">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#94A3B8]">Capabilities</div>
              <div className="text-[13px] font-semibold text-[#111827]">{assignedCapabilities.length} assigned</div>
            </div>
            <div className="p-3 border border-[#E5E7EB] rounded-lg bg-[#F8FAFC]">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#94A3B8]">Fallback</div>
              <div className="text-[13px] font-semibold text-[#111827]">Route to global</div>
            </div>
          </div>
          <div className="space-y-2">
            {assignedCapabilities.length === 0 && (
              <div className="text-[12px] text-[#6B7280] border border-dashed border-[#E5E7EB] rounded-lg p-4">
                No platform capabilities assigned yet. Attach capabilities from the assistant wizard.
              </div>
            )}
            {assignedCapabilities.map((capability) => (
              <div key={capability.id} className="border border-[#E5E7EB] rounded-lg px-3 py-2">
                <div className="text-[12px] font-semibold text-[#111827]">{capability.title}</div>
                <div className="text-[11px] text-[#6B7280]">{capability.description}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 border border-[#E5E7EB] rounded-lg p-4 bg-[#F8FAFC] text-[12px] text-[#334155]">
            <div className="font-semibold text-[#111827] mb-2">Test with this assistant</div>
            <div>Prompt: “My laptop is broken. Can you help?”</div>
            <div>Connector selected: {connectorRows.find((row) => row.enabled)?.connector?.name || 'No connector available'}</div>
            <div>Confirmation preview: {assignedCapabilities.some((cap) => cap.category === 'action') ? 'Ask before executing write actions' : 'Not required for read-only actions'}</div>
          </div>
        </div>

        {/* Bottom Support/Help as seen in modern apps */}
        <div className="flex justify-center pt-4 opacity-50">
           <div className="flex items-center gap-6 text-[12px] font-medium text-[#6B7280]">
              <a href="#" className="hover:underline">Documentation</a>
              <a href="#" className="hover:underline">Policy Hub</a>
              <a href="#" className="hover:underline">Support</a>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantDetail;
