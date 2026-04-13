import React, { useState } from 'react';
import { ExternalLink, Smartphone } from 'lucide-react';
import { StudioShell } from '../../components/StudioShell';
import { FeatureHeader } from '../../components/SettingsCard';
import IdentityTab from './IdentityTab';
import KnowledgeTab from './KnowledgeTab';
import SettingsTab from './SettingsTab';
import AnalyticsTab from './AnalyticsTab';
import BrandingTab from './BrandingTab';
import AssistantsTab from './AssistantsTab';
import AssistantDetail from './AssistantDetail';
import ExternalAgentCreation from './ExternalAgentCreation';
import ExternalAgentDetail from './ExternalAgentDetail';
import IntegrationsTab from './IntegrationsTab';
import DeploymentTab from './DeploymentTab';
import FlowsTab from './FlowsTab';
import { ChatWidget } from '../../chat-widget/ChatWidget';
import { PhoneMockup } from '../../components/PhoneMockup';

const AIAssistantStudio = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('identity');
  const [showPreview, setShowPreview] = useState(true);
  const [isFloating, setIsFloating] = useState(true);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [selectedExternalAgent, setSelectedExternalAgent] = useState(null);
  const [creatingExternalAgent, setCreatingExternalAgent] = useState(false);

  const tabs = [
    { id: 'identity', label: 'Identity' },
    { id: 'assistants', label: 'Assistants' },
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'flows', label: 'Explore Flows' },
    { id: 'branding', label: 'Branding' },
    { id: 'settings', label: 'Settings' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'deployment', label: 'Deployment' },
  ];

  return (
    <StudioShell activeSidebarItem="AI Assistant">
      <FeatureHeader 
        title="AI Assistant"
        subtitle="Configure AI Assistant settings and preferences"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          <>
            <button className="px-5 py-1.5 bg-[#111827] text-white text-[13px] font-bold rounded-md shadow-sm hover:opacity-90 transition-opacity">
              Save All Changes
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-hidden flex origin-top-left transition-all duration-500">
        {/* Settings Column */}
        <div className={`flex-1 overflow-y-auto p-8 bg-[#F9FAFB] transition-all duration-500 ease-in-out`}>
           <div className="max-w-[1000px] mx-auto">
              {activeTab === 'identity' && <IdentityTab />}
              {activeTab === 'knowledge' && <KnowledgeTab />}
              {activeTab === 'branding' && <BrandingTab />}
              {activeTab === 'assistants' && !selectedAssistant && !selectedExternalAgent && !creatingExternalAgent && (
                <AssistantsTab
                  onSelect={setSelectedAssistant}
                  onSelectExternal={setSelectedExternalAgent}
                  onCreateExternal={() => setCreatingExternalAgent(true)}
                />
              )}
              {activeTab === 'assistants' && selectedAssistant && (
                <AssistantDetail
                  assistant={selectedAssistant}
                  onBack={() => setSelectedAssistant(null)}
                />
              )}
              {activeTab === 'assistants' && creatingExternalAgent && (
                <ExternalAgentCreation
                  onBack={() => setCreatingExternalAgent(false)}
                  onComplete={(agent) => { setCreatingExternalAgent(false); setSelectedExternalAgent(agent); }}
                />
              )}
              {activeTab === 'assistants' && selectedExternalAgent && (
                <ExternalAgentDetail
                  agent={selectedExternalAgent}
                  onBack={() => setSelectedExternalAgent(null)}
                />
              )}
              {activeTab === 'integrations' && <IntegrationsTab />}
              {activeTab === 'flows' && <FlowsTab />}
              {activeTab === 'deployment' && <DeploymentTab />}
              {activeTab === 'settings' && <SettingsTab />}
              {activeTab === 'analytics' && <AnalyticsTab />}
           </div>
        </div>

        {/* Optional Live Preview (Mobile) */}
        {showPreview && (
          <div className="w-[600px] border-l border-[#E5E7EB] bg-[#F1F3FB] flex flex-col items-center justify-center p-12 shrink-0 relative shadow-inner overflow-hidden">
             <button 
               onClick={() => setShowPreview(false)}
               className="absolute top-6 right-6 text-[12px] font-bold text-[#94A3B8] hover:text-[#111827] uppercase tracking-widest z-50 transition-colors"
             >
               Hide Preview
             </button>
             
             <div className="relative w-full max-w-[440px] animate-in slide-in-from-right-12 duration-700 ease-out">
                <PhoneMockup>
                  {isFloating ? (
                    <div className="flex flex-col items-center justify-center h-full bg-[#F8FAFC] text-[#94A3B8] p-10 text-center">
                      <div className="relative mb-6">
                        <div className="text-[#94A3B8] filter grayscale opacity-50 flex justify-center">
                          <Smartphone size={64} strokeWidth={1} />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-[#7B5CE3] text-white p-2 rounded-full shadow-lg animate-pulse">
                           <ExternalLink size={20} strokeWidth={2.5} />
                        </div>
                      </div>
                      <div className="text-[15px] font-bold text-[#475569] uppercase tracking-widest mb-3">Floating Mode</div>
                      <p className="text-[13px] leading-relaxed mb-8 px-4 font-medium text-[#64748B]">
                        The Navigator is now decoupled for high-priority testing.
                      </p>
                      <button 
                        onClick={() => setIsFloating(false)}
                        className="px-6 py-2 bg-[#7B5CE3] text-white text-[13px] font-bold rounded-xl shadow-[0_4px_12px_rgba(123,92,227,0.3)] hover:scale-105 transition-all"
                      >
                        Dock to Sidebar
                      </button>
                    </div>
                  ) : (
                    <div className="relative h-full">
                       <button 
                          onClick={() => setIsFloating(true)}
                          className="absolute top-4 right-4 z-[60] bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm border border-black/5 hover:scale-110 transition-all text-[#7B5CE3]"
                          title="Pop out to floating mode"
                       >
                          <ExternalLink size={18} strokeWidth={2.5} />
                       </button>
                       <ChatWidget 
                          agentName={selectedAssistant ? selectedAssistant.name : "Staff Scout"}
                          agentSubtitle={selectedAssistant ? selectedAssistant.description : "Ask me anything!"}
                          enabledActions={
                             selectedAssistant?.id === 'it' ? ['service-now:create'] :
                             selectedAssistant?.id === 'travel' ? ['bamboo-hr:request-leave'] :
                             selectedAssistant?.id === 'hr' ? ['bamboo-hr:request-leave', 'zendesk:create'] :
                             ['service-now:create', 'bamboo-hr:request-leave', 'zendesk:create']
                          }
                          initialMessages={[
                            { 
                              role: 'ai', 
                              type: 'text', 
                              text: selectedAssistant 
                                ? `Hello! I'm the ${selectedAssistant.name}. How can I help with ${selectedAssistant.id} queries?`
                                : "Hello! I'm your AI Assistant. I can help with policies, IT issues, and more." 
                            }
                          ]}
                       />
                    </div>
                  )}
                </PhoneMockup>
             </div>

             {isFloating && (
                <ChatWidget 
                  variant="floating"
                  agentName={selectedAssistant ? selectedAssistant.name : "Staff Scout"}
                  agentSubtitle={selectedAssistant ? selectedAssistant.description : "Ask me anything!"}
                  enabledActions={
                     selectedAssistant?.id === 'it' ? ['service-now:create'] :
                     selectedAssistant?.id === 'travel' ? ['bamboo-hr:request-leave'] :
                     selectedAssistant?.id === 'hr' ? ['bamboo-hr:request-leave', 'zendesk:create'] :
                     ['service-now:create', 'bamboo-hr:request-leave', 'zendesk:create']
                  }
                  initialMessages={[
                    { 
                      role: 'ai', 
                      type: 'text', 
                      text: selectedAssistant 
                        ? `Hello! I'm the ${selectedAssistant.name}. How can I help with ${selectedAssistant.id} queries?`
                        : "Hello! I'm your AI Assistant. I can help with policies, IT issues, and more." 
                    }
                  ]}
                />
             )}
          </div>
        )}

        {!showPreview && (
          <button 
            onClick={() => setShowPreview(true)}
            className="absolute bottom-6 right-6 w-12 h-12 bg-[#111827] text-white rounded-full shadow-lg flex items-center justify-center text-[20px] hover:scale-110 transition-all z-50 animate-bounce"
          >
            <Smartphone size={20} />
          </button>
        )}
      </div>
    </StudioShell>
  );
};

export default AIAssistantStudio;
