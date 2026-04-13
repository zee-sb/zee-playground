import React, { useState } from 'react';
import { SettingsCard } from '../../components/SettingsCard';
import { ChatWidget } from '../../chat-widget/ChatWidget';
import { PhoneMockup } from '../../components/PhoneMockup';
import { useNotification } from '../../components/NotificationProvider';
import { Menu, Plane, Zap, CircleDollarSign, Sparkles, Home, Search, Bell, User } from 'lucide-react';

const FlowsTab = () => {
  const { info, success } = useNotification();
  const [activeFlow, setActiveFlow] = useState('framework'); // framework, actions, nextgen

  // Chat UI Framework State
  const [activeSchema, setActiveSchema] = useState('text');
  const schemas = {
    text: { type: 'text', content: 'Standard text response with markdown support.' },
    info: { type: 'info_card', title: 'Global Travel Policy', content: 'All travel must be approved...' },
    form: { type: 'form', title: 'Request Leave', fields: [{ name: 'days', type: 'number', label: 'Days' }] },
    redirect: { type: 'redirect', label: 'Open HR Portal', url: 'https://hr.staffbase.com' },
  };

  // Chat Action Flows State
  const [scenario, setScenario] = useState('global');
  const scenarios = {
    global: { name: 'Global Assistant', greeting: "I'm your organization's assistant. How can I help today?" },
    it: { name: 'IT Support', greeting: "Welcome to IT Support. Need help with a ticket or hardware?" },
    hr: { name: 'Human Resources', greeting: "HR Assistant here. I can help with leave, benefits, and policies." },
  };
  const handleScenarioChange = (key) => {
    setScenario(key);
    info('Assistant Switched', `Now routing intents to the ${scenarios[key].name}.`);
  };

  // Next Gen Experience State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pendingNotification, setPendingNotification] = useState(null);
  const [chatKey, setChatKey] = useState(0);
  const [initialMsg, setInitialMsg] = useState("Ready to assist! You can ask about your trip, request leave, or find policies.");

  const simulateNotification = () => {
    setPendingNotification({
      title: 'Priya Singh (Manager)',
      body: "I've approved your leave request for next week! 🌴",
      action: 'Check updated balance'
    });
  };

  const handleNotificationClick = () => {
    setInitialMsg("Your leave request for Apr 14-18 has been approved. Your balance is now 7 days. Need anything else?");
    setChatKey(prev => prev + 1);
    setIsChatOpen(true);
    setPendingNotification(null);
    success('Deep Link Activated', 'Opening Navigator with notification context.');
  };

  const triggerAction = (label, msg) => {
    setInitialMsg(msg);
    setChatKey(prev => prev + 1);
    setIsChatOpen(true);
    success('Action Triggered', `Navigator intent for "${label}" has been activated with context.`);
  };

  return (
    <div className="flex-1 flex overflow-hidden -m-8 h-[calc(100vh-140px)] animate-in fade-in duration-300">
      
      {/* Sidebar Controls */}
      <div className="w-[320px] bg-white border-r border-[#E5E7EB] p-8 overflow-y-auto shrink-0 flex flex-col">
         <h2 className="text-[18px] font-bold text-[#111827] mb-6">Explore Flows</h2>
         
         <div className="flex flex-col gap-2 mb-8">
            <button 
              onClick={() => setActiveFlow('framework')}
              className={`p-3 rounded-lg text-left text-[14px] font-bold transition-all ${activeFlow === 'framework' ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}
            >
              1. Component Framework
            </button>
            <button 
              onClick={() => setActiveFlow('actions')}
               className={`p-3 rounded-lg text-left text-[14px] font-bold transition-all ${activeFlow === 'actions' ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}
            >
              2. Scenario Routing
            </button>
            <button 
              onClick={() => setActiveFlow('nextgen')}
               className={`p-3 rounded-lg text-left text-[14px] font-bold transition-all ${activeFlow === 'nextgen' ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}
            >
              3. Deep Link & Mobile App
            </button>
         </div>

         <div className="flex-1">
            {activeFlow === 'framework' && (
              <div className="space-y-4 animate-in slide-in-from-left-2">
                 <div className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">Response Types</div>
                 {Object.keys(schemas).map(key => (
                    <button 
                      key={key}
                      onClick={() => setActiveSchema(key)}
                      className={`w-full p-3 rounded-xl border text-left transition-all ${activeSchema === key ? 'bg-[#EFF6FF] border-[#3B82F6]' : 'bg-white border-[#E5E7EB]'}`}
                    >
                       <div className="text-[13px] font-bold text-[#111827] capitalize">{key} Card</div>
                    </button>
                 ))}
                 <pre className="mt-4 p-4 bg-[#111827] text-[#86EFAC] rounded-lg text-[10px] overflow-x-auto font-mono">
                    {JSON.stringify(schemas[activeSchema], null, 2)}
                 </pre>
              </div>
            )}

            {activeFlow === 'actions' && (
              <div className="space-y-3 animate-in slide-in-from-left-2">
                 <div className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">Intent Routing Targets</div>
                 {Object.keys(scenarios).map(key => (
                    <button 
                      key={key}
                      onClick={() => handleScenarioChange(key)}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${scenario === key ? 'bg-[#EFF6FF] border-[#3B82F6]' : 'bg-white border-[#E5E7EB]'}`}
                    >
                       <div className="text-[13px] font-bold text-[#111827] uppercase tracking-wide">{scenarios[key].name}</div>
                       <div className="text-[11px] text-[#6B7280] mt-1 line-clamp-2">{scenarios[key].greeting}</div>
                    </button>
                 ))}
              </div>
            )}

            {activeFlow === 'nextgen' && (
              <div className="space-y-4 animate-in slide-in-from-left-2">
                 <div className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">App Integrations</div>
                 <button 
                  onClick={simulateNotification}
                  className="w-full p-4 bg-white border border-[#E5E7EB] rounded-2xl text-left hover:border-[#3B82F6] transition-all group"
                 >
                    <div className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-widest mb-1">Simulator</div>
                    <div className="text-[13px] font-bold text-[#111827] group-hover:text-[#3B82F6]">Push Notification</div>
                    <p className="text-[11px] text-[#6B7280] mt-1 italic">Push approval request to Phone.</p>
                 </button>
                 <div className="p-4 bg-[#F9FAFB] rounded-xl text-[11px] text-[#6B7280]">
                    Try clicking the <Sparkles size={24} /> icon on the phone mockup, or tapping the Quick Actions to see deep linking.
                 </div>
              </div>
            )}
         </div>
      </div>

      {/* Preview Canvas */}
      <div className="flex-1 bg-[#F1F3FB] flex items-center justify-center p-8 relative overflow-y-auto">
         {activeFlow === 'framework' && (
           <PhoneMockup>
              <ChatWidget 
                 agentName="Schema Explorer"
                 initialMessages={[
                    { role: 'user', type: 'text', text: `Show me the ${activeSchema} example` },
                    { role: 'ai', ...schemas[activeSchema] }
                 ]}
              />
           </PhoneMockup>
         )}

         {activeFlow === 'actions' && (
           <PhoneMockup>
              <ChatWidget 
                 key={scenario}
                 agentName={scenarios[scenario].name}
                 initialMessages={[
                    { role: 'ai', type: 'text', text: scenarios[scenario].greeting }
                 ]}
              />
           </PhoneMockup>
         )}

         {activeFlow === 'nextgen' && (
           <PhoneMockup>
              <div className="relative flex-1 bg-white overflow-hidden flex flex-col h-full">
                {pendingNotification && (
                  <div 
                    onClick={handleNotificationClick}
                    className="absolute top-14 left-4 right-4 bg-white/90 backdrop-blur-md border border-[#E5E7EB] rounded-2xl p-4 shadow-xl z-[100] cursor-pointer animate-in slide-in-from-top-full duration-500"
                  >
                     <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 font-bold text-[13px] text-[#111827]">
                           <span className="w-5 h-5 bg-[#3B82F6] rounded-md flex items-center justify-center text-[10px] text-white">SB</span>
                           {pendingNotification.title}
                        </div>
                        <span className="text-[10px] text-[#9CA3AF]">now</span>
                     </div>
                     <p className="text-[12px] text-[#4B5563] leading-snug">{pendingNotification.body}</p>
                     <div className="mt-2 text-[11px] font-bold text-[#3B82F6] uppercase tracking-wider">Tap to view response →</div>
                  </div>
                )}
                <header className="px-6 pt-12 pb-4">
                   <div className="flex justify-between items-center text-[24px] mb-8 opacity-20">
                      <span><Menu size={20} /></span>
                      <div className="w-10 h-10 rounded-full bg-slate-200" />
                   </div>
                   <div className="text-[12px] font-bold text-[#94A3B8] uppercase tracking-widest">Good Morning</div>
                   <div className="text-[26px] font-extrabold text-[#111827] tracking-tight">Hello, Alex</div>
                </header>
                <div className="flex-1 px-6 space-y-6 overflow-y-auto pb-24">
                   <div className="p-6 bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                      <div className="relative z-10">
                        <div className="text-[12px] font-bold opacity-70 uppercase tracking-widest mb-1">Coming up</div>
                        <div className="text-[18px] font-bold">Flight to London</div>
                        <div className="text-[13px] opacity-80 mt-0.5">BA202 · Tomorrow at 08:30</div>
                      </div>
                      <div className="absolute top-0 right-0 p-4 opacity-10"><Plane size={40} /></div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div 
                        onClick={() => triggerAction('Leave', 'I want to request leave for next week.')}
                        className="p-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[1.5rem] flex flex-col items-center gap-3 cursor-pointer hover:border-[#3B82F6] hover:bg-white transition-all shadow-sm active:scale-95"
                      >
                         <span className="drop-shadow-sm"><Zap size={30} /></span>
                         <span className="text-[13px] font-bold text-[#1E293B]">Leave</span>
                      </div>
                      <div 
                        onClick={() => triggerAction('Expenses', 'Help me submit a new travel expense.')}
                        className="p-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[1.5rem] flex flex-col items-center gap-3 cursor-pointer hover:border-[#3B82F6] hover:bg-white transition-all shadow-sm active:scale-95"
                      >
                         <span className="drop-shadow-sm"><CircleDollarSign size={30} /></span>
                         <span className="text-[13px] font-bold text-[#1E293B]">Expenses</span>
                      </div>
                   </div>
                   <div className="p-5 border border-[#F1F5F9] bg-[#F8FAFC]/50 rounded-2xl">
                      <div className="text-[14px] font-bold text-[#111827]">New Policy Update</div>
                      <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed italic">"Remote work guidelines for Q3 have been updated..."</p>
                   </div>
                </div>
                {!isChatOpen && (
                   <button 
                    onClick={() => setIsChatOpen(true)}
                    className="absolute bottom-24 right-6 w-14 h-14 bg-[#111827] rounded-full shadow-2xl flex items-center justify-center text-[24px] hover:scale-110 active:scale-95 transition-all z-40 border-2 border-white"
                   >
                     <Sparkles size={24} />
                   </button>
                )}
                {isChatOpen && (
                  <div className="absolute inset-0 z-[1000] animate-in slide-in-from-bottom duration-500 flex flex-col shadow-2xl">
                     <div className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-[#F1F5F9] flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                           <span className="text-[13px] font-bold text-[#111827]">Navigator</span>
                        </div>
                        <button 
                          onClick={() => setIsChatOpen(false)}
                          className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[18px] font-bold text-[#374151]"
                        >
                          ×
                        </button>
                     </div>
                     <div className="flex-1 bg-white relative">
                        <ChatWidget 
                           key={chatKey}
                           agentName="Navigator"
                           initialMessages={[
                              { role: 'ai', type: 'text', text: initialMsg }
                           ]}
                        />
                     </div>
                  </div>
                )}
                <div className="h-20 bg-white border-t border-[#F1F5F9] flex items-center justify-around px-8 shrink-0 z-10 transition-transform duration-300">
                   <span className="text-[24px]"><Home size={24} /></span>
                   <span className="text-[24px] opacity-20"><Search size={24} /></span>
                   <span className="text-[24px] opacity-20"><Bell size={24} /></span>
                   <span className="text-[24px] opacity-20"><User size={24} /></span>
                </div>
              </div>
           </PhoneMockup>
         )}
      </div>
    </div>
  );
};

export default FlowsTab;
