import React, { useState } from 'react';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle, Select } from '../../components/FormElements';
import { useNotification } from '../../components/NotificationProvider';

const SettingsTab = () => {
  const { success, info } = useNotification();
  const [visibility, setVisibility] = useState('all');
  const [showDesktop, setShowDesktop] = useState(true);
  const [showMobile, setShowMobile] = useState(true);
  const [allowFeedback, setAllowFeedback] = useState(true);

  const handleSave = () => {
    success('Settings Saved', 'Visibility and feedback preferences have been applied.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <SettingsCard title="AI Assistant Visibility" description="Control who can see and use the assistant.">
        <Select 
          label="Visibility"
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'all', label: 'For all users' },
            { value: 'group', label: 'For specific groups' },
          ]}
        />

        <div className="pt-6 space-y-4 border-t border-[#F3F4F6]">
           <label className="text-[13px] font-semibold text-[#374151]">Show on</label>
           <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${showDesktop ? 'bg-[#EFF6FF] border-[#3B82F6]' : 'bg-white border-[#E5E7EB] hover:bg-[#F9FAFB]'}`}>
                 <input type="checkbox" checked={showDesktop} onChange={(e) => setShowDesktop(e.target.checked)} className="w-4 h-4 rounded text-[#3B82F6]" />
                 <div className="flex flex-col">
                   <span className="text-[14px] font-semibold text-[#111827]">Desktop</span>
                   <span className="text-[12px] text-[#6B7280]">Staffbase Studio & Web App</span>
                 </div>
              </label>
              <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${showMobile ? 'bg-[#EFF6FF] border-[#3B82F6]' : 'bg-white border-[#E5E7EB] hover:bg-[#F9FAFB]'}`}>
                 <input type="checkbox" checked={showMobile} onChange={(e) => setShowMobile(e.target.checked)} className="w-4 h-4 rounded text-[#3B82F6]" />
                 <div className="flex flex-col">
                   <span className="text-[14px] font-semibold text-[#111827]">Mobile</span>
                   <span className="text-[12px] text-[#6B7280]">Native App (iOS & Android)</span>
                 </div>
              </label>
           </div>
        </div>
      </SettingsCard>

      <SettingsCard title="User Feedback" description="Configure analytics and employee reporting.">
        <Toggle 
          label="Allow users to report an issue"
          description="Allow employees to report feedback on the conversation and on individual replies."
          checked={allowFeedback}
          onChange={setAllowFeedback}
        />

        <div className="pt-6 space-y-4 border-t border-[#F3F4F6]">
           <label className="text-[13px] font-semibold text-[#374151]">Analytics access</label>
           <p className="text-[12.5px] text-[#6B7280]">Select who can access conversation logs and analytics.</p>
           
           <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-[#D1D5DB]" />
                <span className="text-[14px] text-[#374151]">User Groups</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked disabled className="w-4 h-4 rounded border-[#D1D5DB]" />
                <span className="text-[14px] text-[#374151]">Users</span>
              </label>
           </div>

           <div className="mt-4 p-3 bg-white border border-[#E5E7EB] rounded-lg flex flex-wrap gap-2">
              {['Thilo Schmalfuß', 'Felicia Flemming', 'Annemarie Ellmers'].map(user => (
                <span key={user} className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#F3F4FB] text-[#111827] text-[12px] font-medium rounded-md">
                   <span className="w-4 h-4 rounded-full bg-[#6366F1] flex items-center justify-center text-[8px] text-white">
                     {user.split(' ').map(n=>n[0]).join('')}
                   </span>
                   {user}
                   <button className="text-[#9CA3AF] hover:text-[#EF4444]">×</button>
                </span>
              ))}
              <input className="flex-1 text-[13px] outline-none min-w-[1200px]" placeholder="Add user or group..." />
           </div>
        </div>
      </SettingsCard>

      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave}
          className="px-6 py-2 bg-[#111827] text-white text-[13.5px] font-bold rounded-lg shadow-sm hover:opacity-90"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;
