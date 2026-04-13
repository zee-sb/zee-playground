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

const AssistantDetail = ({ assistant, onBack }) => {
  const { success } = useNotification();
  const [name, setName] = useState(assistant.name || '');
  const [instructions, setInstructions] = useState(
    assistant.instructions || `This assistant helps employees with ${assistant.name?.toLowerCase()} related questions`
  );
  
  const [sharepointFiles, setSharepointFiles] = useState([
    { id: 1, name: 'Staffbase_Travel_Expense_Assistant_Policy_Manual.pdf', size: '2.4MB' }
  ]);

  const [selectedGroups, setSelectedGroups] = useState(assistant.selectedGroups || ['All Employees']);
  const ALL_GROUPS = ['All Employees', 'Managers', 'HR Team', 'Finance Team', 'Legal Team', 'IT Team', 'New Joiners', 'Executives'];

  const handleSave = () => {
    success('Saved successfully', `${name} settings have been updated.`);
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
