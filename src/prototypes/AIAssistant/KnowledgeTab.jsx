import React, { useState } from 'react';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle, Select, Input } from '../../components/FormElements';
import { useNotification } from '../../components/NotificationProvider';
import { Folder } from 'lucide-react';

const KnowledgeTab = () => {
  const { success, info } = useNotification();
  const [useSharepoint, setUseSharepoint] = useState(true);
  const [scopingLevel, setScopingLevel] = useState('library');
  const [showOverrides, setShowOverrides] = useState(false);
  
  const [paths, setPaths] = useState([
    { id: 1, name: 'Marketing Assets', url: '/sites/marketing/Shared Documents' },
    { id: 2, name: 'HR Policies', url: '/sites/hr/Shared Documents/Policies' }
  ]);
  const [newPath, setNewPath] = useState('');

  const addPath = () => {
    if (!newPath) return;
    setPaths([...paths, { id: Date.now(), name: 'New Library', url: newPath }]);
    setNewPath('');
    success('Path Added', 'The new scoping path has been registered.');
  };

  const syncNow = () => {
    info('Sync Started', 'Navigator is re-indexing SharePoint sources...');
    setTimeout(() => {
      success('Sync Complete', '120 documents updated and indexed.');
    }, 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <SettingsCard title="Staffbase Knowledge" description="Connect your internal pages and news.">
        <Toggle 
          label="Internal Sync" 
          description="Automatically index all public Staffbase content for the assistant."
          checked={true}
          onChange={() => {}}
        />
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg">
           <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
           <span className="text-[12px] text-[#15803D] font-medium">Last synced 12 mins ago</span>
        </div>
      </SettingsCard>

      <SettingsCard 
        title="SharePoint Knowledge" 
        description="Restrict access to specific sites or folders."
      >
        <div className="flex justify-between items-start">
           <Toggle 
            label="Enable SharePoint" 
            description="Allow the assistant to search your connected SharePoint tenant."
            checked={useSharepoint}
            onChange={setUseSharepoint}
          />
          <button 
            onClick={syncNow}
            className="text-[11px] font-bold text-[#3B82F6] uppercase tracking-wider hover:underline"
          >
            Sync Now
          </button>
        </div>

        {useSharepoint && (
          <div className="pt-6 space-y-6 border-t border-[#F3F4F6] mt-4 animate-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-2 gap-6">
              <Input label="Tenant URL" value="https://acme.sharepoint.com" readOnly />
              <Select 
                label="Scoping Granularity"
                value={scopingLevel}
                onChange={setScopingLevel}
                options={[
                  { value: 'site', label: 'Entire Site' },
                  { value: 'library', label: 'Document Libraries' },
                  { value: 'folder', label: 'Folders' },
                ]}
              />
            </div>

            <div className="space-y-3">
              <label className="text-[13px] font-semibold text-[#374151]">Scope Allowlist</label>
              <div className="border border-[#E5E7EB] rounded-lg divide-y divide-[#F3F4F6]">
                {paths.map(path => (
                  <div key={path.id} className="flex items-center justify-between p-3 hover:bg-[#F9FAFB] transition-colors">
                    <div className="flex items-center gap-3">
                       <span className="text-[18px]"><Folder size={18} /></span>
                       <div>
                          <div className="text-[13px] font-medium text-[#111827]">{path.name}</div>
                          <div className="text-[11px] text-[#6B7280] font-mono">{path.url}</div>
                       </div>
                    </div>
                    <button 
                      onClick={() => {
                        setPaths(paths.filter(p => p.id !== path.id));
                        success('Path Removed', 'The resource has been unlinked from search.');
                      }}
                      className="text-[#EF4444] text-[12px] font-semibold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="p-2 bg-[#FAFBFC] flex gap-2">
                  <input 
                    className="flex-1 text-[13px] border border-[#D1D5DB] rounded-md px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-[#3B82F6]/20"
                    placeholder="Add path (e.g. /sites/finance)"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                  />
                  <button onClick={addPath} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[13px] font-semibold hover:bg-[#F9FAFB]">Add</button>
                </div>
              </div>
            </div>

            <div className="pt-4">
               <button 
                onClick={() => setShowOverrides(!showOverrides)}
                className="text-[13px] font-medium text-[#374151] flex items-center gap-2 hover:text-[#111827]"
               >
                 <span className={`transition-transform duration-200 ${showOverrides ? 'rotate-90' : ''}`}>▶</span> 
                 Assistant-Specific Overrides
               </button>
               {showOverrides && (
                 <div className="mt-4 p-5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl space-y-4 animate-in slide-in-from-top-2">
                    <Toggle 
                      label="Deep Indexing" 
                      description="Search through PDF attachments and embedded documents."
                      checked={true}
                      onChange={() => {}}
                    />
                    <Toggle 
                      label="Strict Permissions" 
                      description="Only show results that exactly match SharePoint ACLs (User Delegation)."
                      checked={true}
                      onChange={() => {}}
                    />
                    <div className="space-y-1.5">
                       <label className="text-[12px] font-bold text-[#111827] uppercase">Result Priority</label>
                       <Select options={[{value: 'high', label: 'Prefer SharePoint results'}, {value: 'balanced', label: 'Balanced'}]} />
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}
      </SettingsCard>
    </div>
  );
};

export default KnowledgeTab;
