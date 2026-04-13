import React, { useState } from 'react';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle, Input, Select } from '../../components/FormElements';
import { useNotification } from '../../components/NotificationProvider';
import { Settings, Headphones, Search, FileText, Folder } from 'lucide-react';

const AssistantDetail = ({ assistant, onBack }) => {
  const { success } = useNotification();
  const [name, setName] = useState(assistant.name);
  const [instructions, setInstructions] = useState(`This assistant helps employees with ${assistant.name.toLowerCase()} related questions`);
  const [intentTriggers, setIntentTriggers] = useState(
    `Handles questions about ${assistant.name.toLowerCase()} policies, requests, and related queries. Examples: booking requests, approval status, policy clarifications.`
  );
  const ALL_GROUPS = ['All Employees', 'Managers', 'HR Team', 'Finance Team', 'Legal Team', 'IT Team', 'New Joiners', 'Executives'];
  const [selectedGroups, setSelectedGroups] = useState(['All Employees']);
  const toggleGroup = (g) => setSelectedGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  
  // Sources State
  const [sharepointFiles, setSharepointFiles] = useState([
    { id: 1, name: 'Travel_Guidelines_2024.pdf', site: 'Finance' },
    { id: 2, name: 'Corporate_Booking_Matrix.xlsx', site: 'Operations' }
  ]);
  
  // Integrations State
  const [integrations, setIntegrations] = useState([
    { 
      id: 'service-now', 
      name: 'ServiceNow', 
      icon: <Settings size={24} />,
      enabled: true, 
      actions: [
        { id: 'create', label: 'Create Ticket', active: true },
        { id: 'status', label: 'Check Status', active: true },
        { id: 'resolve', label: 'Resolve Incident', active: false }
      ]
    },
    { 
      id: 'zendesk', 
      name: 'Zendesk', 
      icon: <Headphones size={24} />,
      enabled: false, 
      actions: [
        { id: 'create', label: 'Create Support Ticket', active: true },
        { id: 'comment', label: 'Add Comment', active: true }
      ]
    }
  ]);

  const toggleIntegration = (intId) => {
    setIntegrations(integrations.map(int => 
      int.id === intId ? { ...int, enabled: !int.enabled } : int
    ));
  };

  const toggleAction = (intId, actId) => {
    setIntegrations(integrations.map(int => 
      int.id === intId ? { 
        ...int, 
        actions: int.actions.map(act => act.id === actId ? { ...act, active: !act.active } : act) 
      } : int
    ));
  };

  const handleSave = () => {
    success('Assistant Updated', `${name} settings have been saved successfully.`);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">
      {/* Header Breadcrumb */}
      <div className="flex items-center gap-4 mb-2">
         <button 
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:border-[#111827] transition-all"
         >
           ←
         </button>
         <div>
            <div className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest">Assistant Detail</div>
            <h1 className="text-[24px] font-extrabold text-[#111827] tracking-tight">{name}</h1>
         </div>
         <div className="ml-auto flex items-center gap-3">
            <button onClick={onBack} className="text-[13px] font-bold text-[#EF4444] hover:underline">Delete</button>
            <button onClick={handleSave} className="px-6 py-2 bg-[#3B82F6] text-white text-[13px] font-bold rounded-lg shadow-sm hover:bg-[#2563EB]">Save</button>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* General Settings */}
        <SettingsCard title="General" description="Basic identity and behavioral instructions for this specialized agent.">
          <div className="space-y-6">
             <Input label="Name" value={name} onChange={setName} placeholder="e.g. Travel Policy" />
             <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#374151]">Instructions</label>
                <textarea 
                  className="w-full min-h-[120px] p-4 bg-white border border-[#E5E7EB] rounded-xl text-[14px] text-[#374151] outline-none focus:ring-2 focus:ring-[#3B82F6]/20 transition-all leading-relaxed"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Explain the purpose of this assistant and the questions it should handle..."
                />
             </div>
          </div>
        </SettingsCard>

        {/* Routing & Access */}
        <SettingsCard title="Routing & Access" description="Define when this assistant is invoked and who can access it.">
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#374151]">Intent triggers</label>
              <p className="text-[12px] text-[#9CA3AF]">Describe the types of queries this assistant should handle. Used by the Navigator router to match user intent.</p>
              <textarea
                className="w-full min-h-[100px] p-4 bg-white border border-[#E5E7EB] rounded-xl text-[14px] text-[#374151] outline-none focus:ring-2 focus:ring-[#3B82F6]/20 transition-all leading-relaxed"
                value={intentTriggers}
                onChange={(e) => setIntentTriggers(e.target.value)}
                placeholder="Describe the kinds of questions this assistant handles..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-[#374151]">Groups with access</label>
              <p className="text-[12px] text-[#9CA3AF]">Even when intent matches, only users in these groups will be routed to this assistant.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_GROUPS.map(g => (
                  <button
                    key={g}
                    onClick={() => toggleGroup(g)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedGroups.includes(g)
                        ? 'bg-[#3B82F6] text-white'
                        : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {selectedGroups.length === 0 && (
                <p className="text-xs text-[#EF4444]">At least one group must be selected.</p>
              )}
            </div>
          </div>
        </SettingsCard>

        {/* Knowledge Sources */}
        <SettingsCard title="Sources" description="Connect internal documents and pages to feed the assistant's knowledge base.">
           <div className="space-y-6">
              <div className="space-y-3">
                 <label className="text-[13px] font-bold text-[#111827] uppercase tracking-widest">Pages</label>
                 <div className="flex items-center justify-between p-3 bg-white border border-[#E5E7EB] border-dashed rounded-xl text-[#9CA3AF] text-[13px] cursor-pointer hover:border-[#3B82F6] transition-colors">
                    <span>Search for Staffbase pages...</span>
                    <span><Search size={16} /></span>
                 </div>
              </div>

              <div className="space-y-3">
                 <label className="text-[13px] font-bold text-[#111827] uppercase tracking-widest">SharePoint Files</label>
                 <div className="border border-[#E5E7EB] rounded-xl divide-y divide-[#F3F4F6] overflow-hidden">
                    {sharepointFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-4 bg-white">
                         <div className="flex items-center gap-3">
                            <span className="text-[18px]"><FileText size={18} /></span>
                            <div>
                               <div className="text-[13px] font-bold text-[#111827]">{file.name}</div>
                               <div className="text-[11px] text-[#6B7280]">Site: {file.site}</div>
                            </div>
                         </div>
                         <button className="text-[#EF4444] text-[13px]">Remove</button>
                      </div>
                    ))}
                    <div className="p-3 bg-[#F9FAFB] flex justify-center">
                       <button className="text-[13px] font-bold text-[#3B82F6] flex items-center gap-2">
                          <span><Folder size={16} /></span> Choose from SharePoint sites...
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        </SettingsCard>

        {/* Granular Integrations */}
        <SettingsCard title="Integrations & Actions" description="Enable specific system operations for this assistant.">
           <div className="space-y-6">
              {integrations.map(int => (
                <div key={int.id} className={`p-5 rounded-2xl border transition-all ${int.enabled ? 'border-[#3B82F6] bg-[#F8FAFF]' : 'border-[#E5E7EB] bg-white opacity-60'}`}>
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                         <span className="text-[24px]">{int.icon}</span>
                         <div>
                            <div className="text-[15px] font-bold text-[#111827]">{int.name}</div>
                            <div className="text-[11px] text-[#6B7280]">Granular Action Permissions</div>
                         </div>
                      </div>
                      <Toggle checked={int.enabled} onChange={() => toggleIntegration(int.id)} />
                   </div>

                   {int.enabled && (
                     <div className="pt-4 border-t border-[#3B82F6]/10 space-y-3 animate-in fade-in duration-300">
                        {int.actions.map(act => (
                          <div key={act.id} className="flex items-center justify-between px-3 py-2 bg-white/50 rounded-lg">
                             <span className="text-[13px] font-medium text-[#374151]">{act.label}</span>
                             <button 
                              onClick={() => toggleAction(int.id, act.id)}
                              className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded ${act.active ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}
                             >
                               {act.active ? 'Enabled' : 'Disabled'}
                             </button>
                          </div>
                        ))}
                     </div>
                   )}
                </div>
              ))}
           </div>
        </SettingsCard>
      </div>
    </div>
  );
};

export default AssistantDetail;
