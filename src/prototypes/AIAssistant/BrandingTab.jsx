import React, { useState } from 'react';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle, Input, Select } from '../../components/FormElements';
import { useNotification } from '../../components/NotificationProvider';

const BrandingTab = () => {
  const { success } = useNotification();
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [showVoice, setShowVoice] = useState(true);
  const [showAttach, setShowAttach] = useState(true);
  const [cornerStyle, setCornerStyle] = useState('rounded');
  const [fontFamily, setFontFamily] = useState('sans');

  const handleSave = () => {
    success('Branding Updated', 'Navigator visual themes have been applied across all clients.');
  };

  const colors = [
    { label: 'Staffbase Blue', hex: '#3B82F6' },
    { label: 'Indigo', hex: '#6366F1' },
    { label: 'Emerald', hex: '#10B981' },
    { label: 'Rose', hex: '#F43F5E' },
    { label: 'Slate', hex: '#475569' },
    { label: 'Amber', hex: '#F59E0B' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <SettingsCard title="Visual Theme" description="Match Navigator to your corporate identity.">
        <div className="space-y-6">
           <div className="space-y-3">
              <label className="text-[12px] font-bold text-[#111827] uppercase tracking-widest">Primary Color</label>
              <div className="flex flex-wrap gap-4">
                 {colors.map(c => (
                    <button 
                      key={c.hex}
                      onClick={() => setPrimaryColor(c.hex)}
                      className={`w-12 h-12 rounded-full border-4 transition-all ${primaryColor === c.hex ? 'border-[#111827] scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                 ))}
                 <div className="flex items-center gap-2 ml-4">
                    <input 
                      type="color" 
                      value={primaryColor} 
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded-md border-0 bg-transparent p-0 overflow-hidden cursor-pointer"
                    />
                    <span className="text-[14px] font-mono text-[#6B7280] font-bold uppercase">{primaryColor}</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#F3F4F6]">
              <Select 
                label="Corner Style" 
                value={cornerStyle}
                onChange={setCornerStyle}
                options={[{value: 'sharp', label: 'Sharp'}, {value: 'rounded', label: 'Rounded'}, {value: 'pill', label: 'Pill'}]} 
              />
              <Select 
                label="Font Family" 
                value={fontFamily}
                onChange={setFontFamily}
                options={[{value: 'sans', label: 'Sans Serif'}, {value: 'serif', label: 'Serif'}, {value: 'mono', label: 'Mono Space'}]} 
              />
           </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Feature Toggles" description="Control which interactive elements are visible in the chat widget.">
         <div className="grid grid-cols-2 gap-x-12 gap-y-6">
            <Toggle 
              label="Voice Support" 
              description="Enable transcript-to-speech for responses."
              checked={showVoice}
              onChange={setShowVoice}
            />
            <Toggle 
              label="Attachments" 
              description="Allow users to upload files for context."
              checked={showAttach}
              onChange={setShowAttach}
            />
            <Toggle 
              label="Feedback Loop" 
              description="Include thumbs up/down after every response."
              checked={true}
              onChange={() => {}}
            />
            <Toggle 
              label="Proactive Prompts" 
              description="Show suggested quick actions."
              checked={true}
              onChange={() => {}}
            />
         </div>
      </SettingsCard>

      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave}
          className="px-6 py-2 bg-[#111827] text-white text-[13.5px] font-bold rounded-lg shadow-sm hover:opacity-90"
        >
          Save Branding
        </button>
      </div>
    </div>
  );
};

export default BrandingTab;
