import React, { useState } from 'react';
import { SettingsCard } from '../../components/SettingsCard';
import { Modal } from '../../components/Modal';
import { useNotification } from '../../components/NotificationProvider';
import { Input, Toggle, Select } from '../../components/FormElements';
import { Wrench, Ticket, Leaf, Check } from 'lucide-react';

const IntegrationsTab = () => {
  const { success, error, info } = useNotification();
  const [activeView, setActiveView] = useState('dashboard'); // dashboard, connections, mapping
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState(1);
  const [connectingProvider, setConnectingProvider] = useState(null);

  const [integrations, setIntegrations] = useState([
    { id: 'servicenow', name: 'ServiceNow', status: 'connected', icon: <Wrench size={16} />, health: 'Healthy' },
    { id: 'jira', name: 'Jira', status: 'connected', icon: <Ticket size={16} />, health: 'Healthy' },
    { id: 'bamboohr', name: 'BambooHR', status: 'disconnected', icon: <Leaf size={16} /> },
  ]);

  const [actions, setActions] = useState([
    { id: 'sn_1', provider: 'ServiceNow', name: 'Create Incident', intent: 'it.ticket.create', enabled: true },
    { id: 'sn_2', provider: 'ServiceNow', name: 'Check Ticket Status', intent: 'it.ticket.status', enabled: true },
    { id: 'ji_1', provider: 'Jira', name: 'Create Bug', intent: 'it.dev.bug', enabled: true },
  ]);

  const handleConnect = (provider) => {
    setConnectingProvider(provider);
    setConnectStep(1);
    setIsConnectModalOpen(true);
  };

  const finishConnection = () => {
    info('Validating credentials...', `Testing connection to ${connectingProvider.name}`);
    setTimeout(() => {
      setIntegrations(prev => prev.map(i => i.id === connectingProvider.id ? { ...i, status: 'connected', health: 'Healthy' } : i));
      setIsConnectModalOpen(false);
      success('Connected!', `${connectingProvider.name} is now successfully integrated.`);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex gap-2 border-b border-[#E5E7EB] pb-4 mb-6">
        <button 
          onClick={() => setActiveView('dashboard')} 
          className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-colors ${activeView === 'dashboard' ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}
        >
          Dashboard
        </button>
        <button 
          onClick={() => setActiveView('connections')} 
          className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-colors ${activeView === 'connections' ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}
        >
          All Integrations
        </button>
        <button 
          onClick={() => setActiveView('mapping')} 
          className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-colors ${activeView === 'mapping' ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}
        >
          Action Mapping
        </button>
      </div>

      {activeView === 'dashboard' && (
        <>
          <div className="grid grid-cols-3 gap-6">
             {integrations.filter(i => i.status === 'connected').map(i => (
               <div key={i.id} className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-[32px]">{i.icon}</div>
                    <span className="bg-[#DCFCE7] text-[#166534] text-[10px] font-bold px-2 py-0.5 rounded uppercase">Connected</span>
                  </div>
                  <h4 className="font-bold text-[#111827]">{i.name}</h4>
                  <p className="text-[12px] text-[#6B7280] mt-1">API Status: <span className="text-[#15803D] font-medium">{i.health}</span></p>
               </div>
             ))}
             <button 
              onClick={() => setActiveView('connections')}
              className="bg-[#F3F4F6] border-2 border-dashed border-[#D1D5DB] rounded-xl p-5 flex flex-col items-center justify-center text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-all"
             >
               <span className="text-[24px] mb-2">+</span>
               <span className="text-[13px] font-bold">Add Integration</span>
             </button>
          </div>

          <SettingsCard title="Global Controls" description="Configuration affecting all conversational actions.">
             <Toggle 
              label="Contextual Awareness" 
              description="Allow actions to access previous message history for parameters."
              checked={true}
              onChange={() => {}}
             />
             <Toggle 
              label="Debug Logging" 
              description="Enable detailed trace logging in the Agent Network Network console."
              checked={false}
              onChange={() => info('Logging Enabled', 'Trace logs will now appear in the Agent console.')}
             />
          </SettingsCard>
        </>
      )}

      {activeView === 'connections' && (
        <div className="grid grid-cols-2 gap-6">
          {integrations.map(i => (
            <div key={i.id} className="bg-white border border-[#E5E7EB] rounded-2xl p-6 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-4 items-center">
                <div className="w-14 h-14 bg-[#F9FAFB] rounded-xl flex items-center justify-center text-[28px] border border-[#F3F4FB]">
                  {i.icon}
                </div>
                <div>
                  <h3 className="font-bold text-[15px] text-[#111827]">{i.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${i.status === 'connected' ? 'bg-[#22C55E]' : 'bg-[#9CA3AF]'}`} />
                    <span className="text-[12px] text-[#6B7280]">{i.status === 'connected' ? 'Authorized' : 'Requires setup'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {i.status === 'connected' ? (
                  <>
                    <button className="px-3 py-1.5 text-[12px] font-bold text-[#EF4444] border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2]">Disconnect</button>
                    <button className="px-4 py-1.5 bg-white border border-[#D1D5DB] text-[13px] font-bold rounded-lg hover:bg-[#F9FAFB]">Manage</button>
                  </>
                ) : (
                  <button 
                    onClick={() => handleConnect(i)}
                    className="px-6 py-1.5 bg-[#111827] text-white text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeView === 'mapping' && (
        <SettingsCard title="Action to Intent Mapping" description="Assign integration capabilities to Navigator intents.">
           <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
              <table className="w-full text-left">
                 <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                       <th className="px-6 py-3 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Source Action</th>
                       <th className="px-6 py-3 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Navigator Intent</th>
                       <th className="px-6 py-3 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Safety</th>
                       <th className="px-6 py-3 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-[#F3F4FB]">
                    {actions.map(action => (
                      <tr key={action.id} className="hover:bg-[#FAFBFC] transition-colors">
                         <td className="px-6 py-4">
                            <div className="text-[13.5px] font-bold text-[#111827]">{action.name}</div>
                            <div className="text-[11px] text-[#A1A1AA] uppercase tracking-wider">{action.provider}</div>
                         </td>
                         <td className="px-6 py-4">
                            <code className="text-[12px] bg-[#F1F5F9] px-2 py-0.5 rounded text-[#475569]">{action.intent}</code>
                         </td>
                         <td className="px-6 py-4">
                            <span className="inline-flex px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-[10px] font-bold">Auto-confirm</span>
                         </td>
                         <td className="px-6 py-4">
                            <button 
                              onClick={() => success('Mapping Updated', `Intent ${action.intent} updated.`)}
                              className="text-[13px] font-semibold text-[#1D4ED8] hover:underline"
                            >
                              Edit Mapping
                            </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </SettingsCard>
      )}

      <Modal 
        isOpen={isConnectModalOpen} 
        onClose={() => setIsConnectModalOpen(false)}
        title={`Connect to ${connectingProvider?.name}`}
        footer={
          <>
            <button onClick={() => setIsConnectModalOpen(false)} className="px-4 py-2 text-[13px] font-medium text-[#6B7280]">Cancel</button>
            {connectStep === 1 ? (
              <button 
                onClick={() => setConnectStep(2)}
                className="px-6 py-2 bg-[#111827] text-white text-[13px] font-bold rounded-lg hover:opacity-90"
              >
                Authenticate
              </button>
            ) : (
              <button 
                onClick={finishConnection}
                className="px-6 py-2 bg-[#3B82F6] text-white text-[13px] font-bold rounded-lg hover:bg-[#2563EB]"
              >
                Authorise Scopes
              </button>
            )}
          </>
        }
      >
        {connectStep === 1 && (
          <div className="space-y-4">
             <div className="p-4 bg-[#F0F9FF] border border-[#B9E6FE] rounded-xl flex gap-3">
                <span className="text-[20px]">ℹ️</span>
                <p className="text-[13px] text-[#0369A1] leading-relaxed">
                  You will be redirected to {connectingProvider?.name} to grant Staffbase access to your data. No credentials are stored directly.
                </p>
             </div>
             <Input label="Environment URL" value={`https://staffbase-sandbox.${connectingProvider?.id === 'servicenow' ? 'service-now.com' : 'atlassian.net'}`} />
             <Input label="Client ID (OIDC)" placeholder="0oa1..." />
          </div>
        )}
        {connectStep === 2 && (
          <div className="space-y-4">
             <p className="text-[14px] text-[#374151]">Confirm that Staffbase Navigator can access the following scopes in {connectingProvider?.name}:</p>
             <div className="space-y-2">
                {['read:incidents', 'create:incidents', 'user:context'].map(scope => (
                  <div key={scope} className="flex items-center gap-2 px-3 py-2 bg-[#F9FAFB] rounded-lg">
                     <span className="text-[#22C55E]"><Check size={16} /></span>
                     <code className="text-[12px] text-[#111827]">{scope}</code>
                  </div>
                ))}
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default IntegrationsTab;
