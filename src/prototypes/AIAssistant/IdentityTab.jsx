import React, { useState } from 'react';
import { SettingsCard } from '../../components/SettingsCard';
import { Input, SegmentedControl } from '../../components/FormElements';
import { useNotification } from '../../components/NotificationProvider';
import { Briefcase, Smile, BookOpen, ShieldCheck, Minus } from 'lucide-react';

const IdentityTab = () => {
  const { success } = useNotification();
  const [name, setName] = useState('Staff Scout');
  const [slogan, setSlogan] = useState('Ask me anything!');
  const [tone, setTone] = useState('friendly');
  const [formality, setFormality] = useState('casual');
  const [emoji, setEmoji] = useState('allowed');
  const [length, setLength] = useState('standard');

  const handleSave = () => {
    success('Identity Updated', 'Navigator identity settings have been persisted.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <SettingsCard title="Common Settings" description="General identification for the assistant.">
        <Input 
          label="Name (Required)" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          description="Choose how the assistant is named in the header and conversation."
        />
        <div className="relative">
          <Input 
            label="Slogan (Required)" 
            value={slogan} 
            onChange={(e) => setSlogan(e.target.value)}
            description="Shown under the assistant's logo before a conversation begins."
            maxLength={50}
          />
          <span className="absolute right-0 bottom-6 text-[11px] text-[#9CA3AF] font-medium">
            {slogan.length}/50
          </span>
        </div>
      </SettingsCard>

      <SettingsCard title="Personality Settings" description="Configure the tone and response style.">
        <SegmentedControl 
          label="Tone"
          value={tone}
          onChange={setTone}
          options={[
            { id: 'professional', label: 'Professional', icon: <Briefcase size={16} /> },
            { id: 'friendly', label: 'Friendly', icon: <Smile size={16} /> },
            { id: 'factual', label: 'Factual', icon: <BookOpen size={16} /> },
            { id: 'compliant', label: 'Compliant', icon: <ShieldCheck size={16} /> },
          ]}
        />

        <SegmentedControl 
          label="Formality"
          value={formality}
          onChange={setFormality}
          options={[
            { id: 'neutral', label: 'Neutral' },
            { id: 'formal', label: 'Formal' },
            { id: 'casual', label: 'Casual' },
          ]}
        />

        <SegmentedControl 
          label="Emoji Usage"
          value={emoji}
          onChange={setEmoji}
          options={[
            { id: 'none', label: 'None' },
            { id: 'minimal', label: 'Minimal' },
            { id: 'allowed', label: 'Allowed' },
          ]}
        />

        <SegmentedControl 
          label="Answer Length"
          value={length}
          onChange={setLength}
          options={[
            { id: 'short', label: 'Short', icon: <Minus size={16} /> },
            { id: 'standard', label: 'Standard', icon: '≡' },
            { id: 'detailed', label: 'Detailed', icon: '≣' },
          ]}
        />
      </SettingsCard>

      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave}
          className="px-6 py-2 bg-[#111827] text-white text-[13.5px] font-bold rounded-lg shadow-sm hover:opacity-90"
        >
          Save Identity
        </button>
      </div>
    </div>
  );
};

export default IdentityTab;
