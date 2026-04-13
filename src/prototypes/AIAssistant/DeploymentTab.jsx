import React, { useState, useEffect } from 'react';
import { SettingsCard } from '../../components/SettingsCard';
import { Zap, Check, Rocket } from 'lucide-react';

const DeploymentTab = () => {
  const [step, setStep] = useState(1); // 1: disconnected, 2: activating, 3: live
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (step === 2) {
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            setStep(3);
            return 100;
          }
          return p + 1;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [step]);

  const checklist = [
    { label: 'Cloud Infrastructure Provisioning', done: progress > 10 },
    { label: 'Knowledge Base Indexing (SharePoint)', done: progress > 40 },
    { label: 'Agent Routing Layer Setup', done: progress > 70 },
    { label: 'Final Safety & Bias Checks', done: progress > 95 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {step === 1 && (
        <SettingsCard title="Activate Navigator" description="Deployment typically takes 15-20 minutes.">
          <div className="text-center py-8">
            <div className="flex justify-center mb-4 text-[#3B82F6]"><Zap size={64} /></div>
            <h2 className="text-2xl font-bold text-[#111827]">Ready for deployment?</h2>
            <p className="text-[#6B7280] max-w-sm mx-auto mt-2">Activating Navigator will begin indexing your connected sources and preparing the AI model.</p>
            <button 
              onClick={() => { setStep(2); setProgress(0); }}
              className="mt-8 px-8 py-3 bg-[#111827] text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-lg"
            >
              Begin Activation
            </button>
          </div>
        </SettingsCard>
      )}

      {step === 2 && (
        <SettingsCard title="Activation in Progress" description="We are setting up your Navigator instance.">
          <div className="space-y-6">
            <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden">
                <div className="bg-[#3B82F6] h-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            
            <div className="space-y-3">
                {checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${item.done ? 'bg-[#22C55E] text-white' : 'border-2 border-gray-200'}`}>
                        {item.done && <Check size={16} />}
                      </div>
                      <span className={`text-[13.5px] ${item.done ? 'text-[#111827] font-medium' : 'text-[#9CA3AF]'}`}>{item.label}</span>
                  </div>
                ))}
            </div>
          </div>
        </SettingsCard>
      )}

      {step === 3 && (
        <SettingsCard title="Activation Complete" description="Your Navigator instance is live.">
          <div className="text-center py-8">
            <div className="flex justify-center mb-4 text-[#7B5CE3]"><Rocket size={64} /></div>
            <h2 className="text-2xl font-bold text-[#111827]">Navigator is Live!</h2>
            <p className="text-[#6B7280] max-w-sm mx-auto mt-2">You can now configure your AI Assistant and Knowledge sources.</p>
            <div className="mt-8 flex gap-3 justify-center">
                <button className="px-6 py-2 bg-[#E5E7EB] text-[#111827] font-bold rounded-lg hover:bg-gray-200">View Logs</button>
            </div>
          </div>
        </SettingsCard>
      )}
    </div>
  );
};

export default DeploymentTab;
