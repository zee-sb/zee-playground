import React, { useState, useEffect } from 'react';
import { SettingsCard } from '../../components/SettingsCard';
import { Modal } from '../../components/Modal';
import { useNotification } from '../../components/NotificationProvider';
import { Input, Toggle, Select } from '../../components/FormElements';
import { 
  Wrench, 
  Ticket, 
  Leaf, 
  Check, 
  ChevronRight, 
  Plus, 
  ArrowLeft, 
  Globe, 
  Shield, 
  Zap, 
  History, 
  AlertCircle,
  Search,
  LayoutGrid,
  Settings,
  Activity,
  BarChart3,
  Layers,
  Lock,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  MoreVertical
} from 'lucide-react';

const IntegrationsTab = () => {
  const { success, error, info } = useNotification();
  const [activeView, setActiveView] = useState('overview'); // overview, catalog, skills, detail
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [connectingProvider, setConnectingProvider] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState('Overview');

  const [integrations, setIntegrations] = useState([
    { 
      id: 'servicenow', 
      name: 'ServiceNow', 
      status: 'connected', 
      icon: <Wrench size={24} />, 
      health: 'Healthy', 
      latency: '240ms',
      lastSync: '2 mins ago',
      description: 'ITSM and ticket management integration for enterprise support.',
      skillsEnabled: 2,
      category: 'ITSM',
      invocations: '1.2k',
      successRate: '99.4%'
    },
    { 
      id: 'jira', 
      name: 'Jira', 
      status: 'connected', 
      icon: <Ticket size={24} />, 
      health: 'Healthy', 
      latency: '180ms',
      lastSync: '5 mins ago',
      description: 'Agile project management and issue tracking.',
      skillsEnabled: 1,
      category: 'DevOps',
      invocations: '840',
      successRate: '100%'
    },
    { 
      id: 'bamboohr', 
      name: 'BambooHR', 
      status: 'disconnected', 
      icon: <Leaf size={24} />,
      description: 'HR management system for employee records and time off.',
      skillsEnabled: 0,
      category: 'HR',
      invocations: '0',
      successRate: '-'
    },
  ]);

  const [actions, setActions] = useState([
    { id: 'sn_1', providerId: 'servicenow', provider: 'ServiceNow', name: 'Create Incident', intent: 'it.ticket.create', enabled: true, safety: 'Auto-confirm', description: 'Automatically open an IT incident based on users problem description.' },
    { id: 'sn_2', providerId: 'servicenow', provider: 'ServiceNow', name: 'Check Ticket Status', intent: 'it.ticket.status', enabled: true, safety: 'Standard', description: 'Retrieve the latest status and comments for an existing incident.' },
    { id: 'ji_1', providerId: 'jira', provider: 'Jira', name: 'Create Bug', intent: 'it.dev.bug', enabled: true, safety: 'Auto-confirm', description: 'Log a developer bug in the relevant project board.' },
    { id: 'bhr_1', providerId: 'bamboohr', provider: 'BambooHR', name: 'Request Time Off', intent: 'hr.leave.request', enabled: false, safety: 'High-security', description: 'Submit a PTO request for approval by the manager.' },
  ]);

  const catalogProviders = [
    { id: 'salesforce', name: 'Salesforce', icon: <Shield size={24} />, category: 'CRM', description: 'Access customer data and opportunities.', popular: true },
    { id: 'slack', name: 'Slack', icon: <Zap size={24} />, category: 'Comm', description: 'Send notifications and messages to channels.' },
    { id: 'workday', name: 'Workday', icon: <Activity size={24} />, category: 'HR', description: 'Manage employee profiles and benefits.', popular: true },
    { id: 'custom_mcp', name: 'Custom MCP', icon: <ArrowUpRight size={24} />, category: 'Developer', description: 'Connect any MCP-compatible agent or server.' },
    { id: 'webhook', name: 'Webhook', icon: <Globe size={24} />, category: 'Developer', description: 'Legacy REST integration via secure webhooks.' },
  ];

  const handleConnectClick = (provider) => {
    setConnectingProvider(provider);
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  const handleIntegrationClick = (integration) => {
    setSelectedIntegration(integration);
    setActiveDetailTab('Overview');
    setActiveView('detail');
  };

  const finishWizard = () => {
    info('Establishing connection...', `Linking to ${connectingProvider.name} instance`);
    setTimeout(() => {
      setIntegrations(prev => {
        const idx = prev.findIndex(i => i.id === connectingProvider.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], status: 'connected', health: 'Healthy', latency: '210ms', lastSync: 'Just now' };
          return updated;
        }
        return [...prev, { 
          ...connectingProvider, 
          status: 'connected', 
          health: 'Healthy', 
          latency: '—', 
          lastSync: 'Just now', 
          skillsEnabled: 0,
          invocations: '0',
          successRate: '100%'
        }];
      });
      setIsWizardOpen(false);
      success('Success!', `${connectingProvider.name} is now part of your Assistant Network.`);
    }, 1200);
  };

  const toggleSkill = (skillId) => {
    setActions(prev => prev.map(a => a.id === skillId ? { ...a, enabled: !a.enabled } : a));
    success('Skill configuration saved');
  };

  // ── Sub-Components ───────────────────────────────────────────────────

  const TabButton = ({ id, label, icon: Icon, active, onClick }) => (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 text-[13px] font-bold border-b-2 transition-all ${
        active 
          ? 'border-[#111827] text-[#111827]' 
          : 'border-transparent text-[#94A3B8] hover:text-[#111827]'
      }`}
    >
      <Icon size={14} strokeWidth={active ? 2.5 : 2} />
      {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* ── TOP NAVIGATION ────────────────────────────────────────────── */}
      {activeView !== 'detail' && (
        <div className="flex items-center justify-between border-b border-[#E5E7EB] mb-8">
          <div className="flex">
            <TabButton 
              id="overview" label="Overview" icon={LayoutGrid} 
              active={activeView === 'overview'} onClick={() => setActiveView('overview')} 
            />
            <TabButton 
              id="catalog" label="Integration Catalog" icon={Layers} 
              active={activeView === 'catalog'} onClick={() => setActiveView('catalog')} 
            />
            <TabButton 
              id="skills" label="Skill Orchestration" icon={Zap} 
              active={activeView === 'skills'} onClick={() => setActiveView('skills')} 
            />
          </div>
          
          <div className="flex items-center gap-4 py-2">
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-focus-within:text-[#111827] transition-colors" size={14} />
                <input 
                  type="text" 
                  placeholder="Find a skill..." 
                  className="pl-9 pr-4 py-1.5 bg-[#F3F4F6] border-none rounded-full text-[12px] focus:ring-1 focus:ring-[#111827] w-48 focus:w-64 transition-all outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
          </div>
        </div>
      )}

      {/* ── OVERVIEW VIEW ─────────────────────────────────────────────── */}
      {activeView === 'overview' && (
        <div className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[15px] font-bold text-[#111827] uppercase tracking-wider flex items-center gap-2">
                <Activity size={16} className="text-[#3B82F6]" />
                Active Integrations
              </h3>
              <button 
                onClick={() => setActiveView('catalog')}
                className="text-[12px] font-bold text-[#3B82F6] hover:underline flex items-center gap-1"
              >
                Browse all tools <ChevronRight size={14} />
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-6">
               {integrations.filter(i => i.status === 'connected').map(i => (
                 <div 
                  key={i.id} 
                  onClick={() => handleIntegrationClick(i)}
                  className="group bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-[#111827]/10 cursor-pointer transition-all active:scale-[0.98] border-b-4 border-b-[#E5E7EB]"
                 >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex items-center justify-center text-[#111827] border border-[#F3F4FB] group-hover:scale-110 transition-transform">
                        {i.icon}
                      </div>
                      <div className="flex items-center gap-1 bg-[#F0FDF4] text-[#166534] text-[9px] font-black px-2 py-1 rounded-md tracking-tighter shadow-sm border border-[#DCFCE7]">
                        <Check size={10} strokeWidth={4} />
                        READY
                      </div>
                    </div>
                    <h4 className="font-bold text-[#111827] text-[17px] mb-1">{i.name}</h4>
                    <p className="text-[12px] text-[#94A3B8] line-clamp-2 leading-relaxed h-[36px]">{i.description}</p>
                    
                    <div className="mt-8 pt-4 border-t border-[#F3F4F6] grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[9px] font-bold text-[#94A3B8] uppercase">Latency</div>
                        <div className="text-[13px] font-bold text-[#111827]">{i.latency}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-[#94A3B8] uppercase">Skills</div>
                        <div className="text-[13px] font-bold text-[#111827]">{i.skillsEnabled} active</div>
                      </div>
                    </div>
                 </div>
               ))}
               
               <button 
                onClick={() => setActiveView('catalog')}
                className="bg-[#F8FAFC] border-2 border-dashed border-[#CBD5E1] rounded-2xl p-6 flex flex-col items-center justify-center text-[#64748B] hover:bg-white hover:border-[#111827] hover:text-[#111827] transition-all group min-h-[196px]"
               >
                 <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:bg-[#111827] group-hover:text-white transition-colors">
                   <Plus size={24} />
                 </div>
                 <span className="text-[14px] font-bold">Add New Integration</span>
                 <span className="text-[11px] opacity-60 mt-1 font-medium">Connect external SaaS or MCP</span>
               </button>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-8">
            <SettingsCard title="Infrastructure Health" description="Status of the global Staffbase Navigator API mesh.">
               <div className="space-y-4 pt-2">
                  {[
                    { label: 'Secure Gateway', status: 'Optimal', perf: '99.99%', color: '#22C55E' },
                    { label: 'Context Handshake', status: 'Operational', perf: '12ms avg', color: '#22C55E' },
                    { label: 'OIDC Provider', status: 'Operational', perf: 'Active', color: '#22C55E' },
                  ].map((sys, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-2xl border border-[#F1F5F9]">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: sys.color }} />
                        <span className="text-[13px] font-bold text-[#334155]">{sys.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[11px] font-medium text-[#64748B]">{sys.perf}</span>
                        <span className="text-[11px] font-black uppercase text-[#1E293B] tracking-tighter">{sys.status}</span>
                      </div>
                    </div>
                  ))}
               </div>
            </SettingsCard>
            
            <SettingsCard title="Global Governance" description="System-wide security policies for all integrations.">
               <div className="space-y-2">
                 <Toggle 
                  label="Context Isolation" 
                  description="Strictly segregate message history between disconnected integrations."
                  checked={true}
                  onChange={() => {}}
                 />
                 <Toggle 
                  label="PII Obfuscation" 
                  description="Mask sensitive user data before passing it to external providers."
                  checked={true}
                  onChange={() => {}}
                 />
                 <Toggle 
                  label="Execution Trace" 
                  description="Enable detailed telemetry for troubleshooting integration logic."
                  checked={false}
                  onChange={() => {}}
                 />
               </div>
            </SettingsCard>
          </div>
        </div>
      )}

      {/* ── CATALOG VIEW ──────────────────────────────────────────────── */}
      {activeView === 'catalog' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="text-center max-w-2xl mx-auto mb-10">
             <h2 className="text-[28px] font-bold text-[#111827] mb-2 tracking-tight">Integration Catalog</h2>
             <p className="text-[15px] text-[#64748B]">
               Extend Navigator's capabilities by connecting your enterprise toolset. All integrations use 
               <span className="text-[#3B82F6] font-bold mx-1 cursor-help underline decoration-dotted decoration-[#3B82F6]">Secure Connect</span> technology.
             </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {catalogProviders.map(p => {
              const connected = integrations.find(i => i.id === p.id && i.status === 'connected');
              return (
                <div key={p.id} className="bg-white border border-[#E5E7EB] rounded-3xl p-6 flex gap-5 hover:shadow-2xl hover:border-[#111827]/5 hover:-translate-y-1 transition-all group relative overflow-hidden">
                   {p.popular && (
                     <div className="absolute top-0 right-0 bg-[#7C3AED] text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest shadow-sm">
                       POPULAR
                     </div>
                   )}
                   <div className="w-16 h-16 bg-[#F8FAFC] rounded-2xl flex items-center justify-center text-[#111827] border border-[#F1F5F9] shrink-0 group-hover:scale-105 transition-transform duration-300">
                      {p.icon}
                   </div>
                   <div className="flex-1 pr-6">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-bold text-[18px] text-[#111827]">{p.name}</h4>
                        <span className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest bg-[#F1F5F9] px-2 py-0.5 rounded">{p.category}</span>
                      </div>
                      <p className="text-[13px] text-[#64748B] leading-relaxed mb-6">{p.description}</p>
                      {connected ? (
                        <button 
                          onClick={() => handleIntegrationClick(connected)}
                          className="flex items-center gap-2 text-[#22C55E] text-[13px] font-bold border-b border-[#22C55E] pb-0.5"
                        >
                          <Check size={16} /> Manage Active Connection
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleConnectClick(p)}
                          className="px-6 py-2 bg-[#111827] text-white text-[13px] font-bold rounded-xl hover:shadow-lg hover:shadow-[#111827]/20 transition-all flex items-center gap-2"
                        >
                          <Plus size={16} /> Add Integration
                        </button>
                      )}
                   </div>
                </div>
              );
            })}
          </div>

          <div className="bg-[#0F172A] rounded-[2.5rem] p-12 text-white relative overflow-hidden mt-12 shadow-2xl">
             <div className="relative z-10 grid grid-cols-2 items-center gap-12">
                <div>
                   <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-6">
                      Developer Preview
                   </div>
                   <h3 className="text-[32px] font-bold mb-4 tracking-tight leading-tight">Can't find what you need?<br/>Build a custom skill.</h3>
                   <p className="text-white/60 text-[16px] leading-relaxed mb-8">
                     Connect your proprietary APIs or internal data meshes directly to the Navigator brain using our standard MCP or Webhook connectors.
                   </p>
                   <div className="flex gap-4">
                      <button className="flex items-center gap-2 bg-white text-[#0F172A] px-6 py-3 rounded-2xl text-[14px] font-bold hover:scale-105 transition-all shadow-xl">
                         <Globe size={18} />
                         Define Webhook
                      </button>
                      <button className="flex items-center gap-2 bg-[#1E293B] border border-white/10 text-white px-6 py-3 rounded-2xl text-[14px] font-bold hover:bg-[#334155] transition-all">
                         Read API Docs <ExternalLink size={16} className="opacity-50" />
                      </button>
                   </div>
                </div>
                <div className="flex justify-center h-full relative">
                   <div className="w-full aspect-square bg-gradient-to-br from-blue-500/10 to-transparent rounded-full border border-white/5 absolute" />
                   <Globe className="text-white/10 animate-pulse relative" size={320} strokeWidth={1} />
                   <Zap className="absolute text-blue-500/40 drop-shadow-[0_0_20px_blue]" size={80} style={{ top: '30%', right: '20%' }} />
                </div>
             </div>
          </div>
        </div>
      )}

      {/* ── SKILLS ORCHESTRATION VIEW ──────────────────────────────────── */}
      {activeView === 'skills' && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="flex items-center justify-between mb-2">
              <div>
                 <h2 className="text-[20px] font-bold text-[#111827]">Skill Orchestration</h2>
                 <p className="text-[13px] text-[#64748B]">Manage how Navigator interprets and routes intents to your integrations.</p>
              </div>
              <button className="px-4 py-2 bg-white border border-[#E2E8F0] rounded-xl text-[13px] font-bold text-[#111827] shadow-sm hover:bg-[#F8FAFC]">
                 Export Mapping View
              </button>
           </div>

           <div className="bg-white border border-[#E5E7EB] rounded-[2rem] overflow-hidden shadow-sm">
              <table className="w-full text-left">
                 <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <tr>
                       <th className="px-8 py-5 text-[10px] font-black text-[#64748B] uppercase tracking-[0.1em]">Capability Source</th>
                       <th className="px-8 py-5 text-[10px] font-black text-[#64748B] uppercase tracking-[0.1em]">Target Intent</th>
                       <th className="px-8 py-5 text-[10px] font-black text-[#64748B] uppercase tracking-[0.1em]">Safety Logic</th>
                       <th className="px-8 py-5 text-[10px] font-black text-[#64748B] uppercase tracking-[0.1em] text-right">Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-[#F1F5F9]">
                    {actions.map(action => (
                      <tr key={action.id} className="hover:bg-[#FBFBFF] transition-colors group">
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 bg-white border border-[#E2E8F0] shadow-sm rounded-xl flex items-center justify-center text-[18px]">
                                 {integrations.find(i => i.id === action.providerId)?.icon || <Zap size={16}/>}
                               </div>
                               <div>
                                  <div className="text-[14px] font-extrabold text-[#1e293b]">{action.name}</div>
                                  <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-tight">{action.provider}</div>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                               <code className="text-[12px] bg-[#EEF2FF] px-3 py-1.5 rounded-lg text-[#4338CA] font-mono border border-[#E0E7FF] font-bold">
                                 {action.intent}
                               </code>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              action.safety === 'Auto-confirm' ? 'bg-[#ECFDF5] text-[#059669]' : 
                              action.safety === 'High-security' ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#FFFBEB] text-[#D97706]'
                            }`}>
                               <div className="w-1.5 h-1.5 rounded-full bg-current" />
                               {action.safety}
                            </div>
                         </td>
                         <td className="px-8 py-6 text-right">
                           <div className="flex justify-end gap-4 items-center">
                             <Toggle 
                              checked={action.enabled} 
                              onChange={() => toggleSkill(action.id)}
                              size="sm"
                             />
                             <button className="p-2 text-[#94A3B8] hover:text-[#111827] transition-all rounded-xl hover:bg-[#F3F4F6] hover:rotate-90">
                               <Settings size={16} />
                             </button>
                           </div>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* ── DETAIL VIEW ───────────────────────────────────────────────── */}
      {activeView === 'detail' && selectedIntegration && (
        <div className="space-y-8 animate-in slide-in-from-right-8 duration-700 ease-out">
           
           {/* Detail Header */}
           <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setActiveView('overview')}
                  className="w-12 h-12 bg-white border border-[#E5E7EB] rounded-2xl flex items-center justify-center text-[#64748B] hover:text-[#111827] hover:border-[#111827] hover:shadow-lg transition-all"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 bg-white border border-[#E5E7EB] rounded-[1.25rem] shadow-sm flex items-center justify-center transform -rotate-1 group-hover:rotate-0 transition-transform">
                      {selectedIntegration.icon}
                   </div>
                   <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-[28px] font-bold text-[#111827] tracking-tight">{selectedIntegration.name}</h2>
                        <span className="bg-[#DCFCE7] text-[#166534] text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-[0.1em] border border-[#BBF7D0]">CONNECTED</span>
                      </div>
                      <p className="text-[14px] text-[#64748B] font-medium">{selectedIntegration.description}</p>
                   </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <button className="px-5 py-2.5 bg-[#FEF2F2] text-[#DC2626] text-[13px] font-bold rounded-xl border border-[#FEE2E2] hover:bg-[#FEE2E2] transition-colors">
                    Disable
                 </button>
                 <button className="p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#111827] shadow-sm">
                    <MoreVertical size={20} />
                 </button>
              </div>
           </div>

           {/* Detail Tabs */}
           <div className="flex gap-1 border-b border-[#E2E8F0]">
              {['Overview', 'Skills', 'Authentication', 'Sync Logs'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveDetailTab(tab)}
                  className={`px-6 py-4 text-[13px] font-black uppercase tracking-widest border-b-2 transition-all -mb-px ${
                    activeDetailTab === tab 
                      ? 'border-[#3B82F6] text-[#3B82F6]' 
                      : 'border-transparent text-[#94A3B8] hover:text-[#475569]'
                  }`}
                >
                  {tab}
                </button>
              ))}
           </div>

           {/* TAB: OVERVIEW */}
           {activeDetailTab === 'Overview' && (
             <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="grid grid-cols-4 gap-6">
                   {[
                     { label: 'Network Health', value: selectedIntegration.health, sub: 'Stability: 99.9%', color: '#22C55E' },
                     { label: 'Avg Latency', value: selectedIntegration.latency, sub: 'p95: 340ms', color: '#111827' },
                     { label: 'Weekly Invocations', value: selectedIntegration.invocations, sub: '+12% from last week', color: '#111827' },
                     { label: 'Success Rate', value: selectedIntegration.successRate, sub: 'Target: >98%', color: '#22C55E' },
                   ].map(stat => (
                     <div key={stat.label} className="bg-white border border-[#E5E7EB] rounded-3xl p-6 shadow-sm">
                        <div className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.15em] mb-2">{stat.label}</div>
                        <div className="text-[24px] font-black tracking-tight" style={{ color: stat.color }}>{stat.value}</div>
                        <div className="text-[11px] font-medium text-[#64748B] mt-1">{stat.sub}</div>
                     </div>
                   ))}
                </div>

                <div className="grid grid-cols-3 gap-8">
                   <div className="col-span-2 space-y-6">
                      <SettingsCard title="Connection Performance (Live)" description="Real-time telemetry from the integration endpoint.">
                         <div className="h-[240px] w-full bg-[#F8FAFC] rounded-2xl border border-[#F1F5F9] flex flex-col items-center justify-center relative overflow-hidden">
                            {/* Mock Chart Area */}
                            <div className="flex items-end gap-1 h-[120px]">
                               {[40, 60, 45, 90, 65, 30, 75, 40, 85, 55, 45, 70, 50, 65].map((h, i) => (
                                 <div 
                                  key={i} 
                                  className="w-6 bg-blue-500/20 rounded-t-md hover:bg-blue-500 transition-all cursor-crosshair group" 
                                  style={{ height: `${h}%` }}
                                 >
                                    <div className="hidden group-hover:block absolute top-[10px] left-1/2 -translate-x-1/2 bg-[#111827] text-white text-[9px] px-2 py-1 rounded shadow-xl z-20">
                                       {h*4}ms
                                    </div>
                                 </div>
                               ))}
                            </div>
                            <div className="w-full h-[1px] bg-[#E2E8F0] mt-1 mb-8" />
                            <div className="flex gap-12 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">
                               <span>12:00 PM</span>
                               <span>12:15 PM</span>
                               <span>12:30 PM</span>
                               <span>12:45 PM</span>
                               <span>NOW</span>
                            </div>
                         </div>
                      </SettingsCard>
                   </div>
                   <div className="space-y-6">
                      <div className="bg-[#F0F9FF] border border-[#B9E6FE] rounded-[2rem] p-8 shadow-sm">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#0369A1] shadow-sm mb-6">
                          <Shield size={24} />
                        </div>
                        <h4 className="text-[18px] font-bold text-[#0369A1] mb-2 tracking-tight">Enterprise Security</h4>
                        <p className="text-[13px] text-[#0369A1]/80 leading-relaxed mb-6">
                          This connection is encrypted with RSA-4096 and uses the Staffbase Private Mesh. 
                          No raw credentials are ever exposed to the model.
                        </p>
                        <button className="text-[12px] font-black text-[#0369A1] uppercase tracking-widest hover:underline">
                          View Certificate Hub
                        </button>
                      </div>
                   </div>
                </div>
             </div>
           )}

           {/* TAB: SKILLS */}
           {activeDetailTab === 'Skills' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
                <SettingsCard title="Enabled Capabilities" description="Enable or disable specific skills this integration provides to Navigator.">
                   <div className="grid grid-cols-2 gap-4">
                      {actions.filter(a => a.providerId === selectedIntegration.id).map(skill => (
                        <div key={skill.id} className="bg-white border border-[#E2E8F0] p-6 rounded-[2rem] flex flex-col justify-between hover:border-[#111827] transition-all group">
                           <div className="flex justify-between items-start mb-6">
                              <div className="w-12 h-12 bg-[#F8FAFC] rounded-2xl flex items-center justify-center text-[#3B82F6] group-hover:bg-[#3B82F6] group-hover:text-white transition-all">
                                 <Zap size={20} />
                              </div>
                              <Toggle checked={skill.enabled} onChange={() => toggleSkill(skill.id)} />
                           </div>
                           <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-[16px] font-extrabold text-[#111827]">{skill.name}</h4>
                                <div className="text-[9px] font-black bg-[#F1F5F9] px-2 py-0.5 rounded uppercase">{skill.safety}</div>
                              </div>
                              <p className="text-[12px] text-[#64748B] mb-4 font-medium leading-relaxed">{skill.description}</p>
                              <code className="text-[11px] font-bold text-[#3B82F6] bg-blue-50 px-2.5 py-1 rounded-lg">
                                 {skill.intent}
                              </code>
                           </div>
                        </div>
                      ))}
                      <div className="bg-[#F8FAFC] border-2 border-dashed border-[#E2E8F0] rounded-[2rem] p-6 flex flex-col items-center justify-center text-[#94A3B8] hover:bg-white hover:border-[#3B82F6] group transition-all min-h-[220px]">
                         <div className="w-10 h-10 rounded-full border border-[#E2E8F0] flex items-center justify-center mb-3 group-hover:bg-[#3B82F6] group-hover:text-white group-hover:border-transparent transition-all">
                            <Plus size={20} />
                         </div>
                         <div className="text-[13px] font-extrabold text-[#64748B]">Map New Capability</div>
                         <div className="text-[11px] text-[#94A3B8] mt-1">Add custom logic for {selectedIntegration.name}</div>
                      </div>
                   </div>
                </SettingsCard>
             </div>
           )}

           {/* TAB: AUTHENTICATION */}
           {activeDetailTab === 'Authentication' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500 max-w-3xl">
                <SettingsCard title="Credential Configuration" description="Manage the secure OIDC/OAuth handshake for this connection.">
                   <div className="space-y-6 pt-2">
                      <Input label="Environment Endpoint" value={`https://staffbase-sandbox.${selectedIntegration.id === 'servicenow' ? 'service-now.com' : 'atlassian.net'}`} readOnly />
                      <div className="grid grid-cols-2 gap-6">
                         <Input label="Direct OIDC Client ID" value="0oa17..." type="password" readOnly />
                         <div className="space-y-1.5">
                            <label className="text-[12px] font-black text-[#64748B] uppercase tracking-widest">Global Client Secret</label>
                            <div className="flex gap-2">
                               <div className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-[14px] text-[#94A3B8]">••••••••••••••••</div>
                               <button className="px-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-[12px] font-black uppercase tracking-widest hover:bg-[#F8FAFC] transition-all">Rotate</button>
                            </div>
                         </div>
                      </div>
                      <div className="p-5 bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl">
                         <div className="flex items-center gap-3 mb-3">
                            <Lock size={16} className="text-[#64748B]" />
                            <h5 className="text-[13px] font-bold text-[#1E293B]">Scoped Authorization</h5>
                         </div>
                         <div className="flex flex-wrap gap-2">
                            {['api.read', 'api.write', 'user.profile', 'ticket.manage'].map(scope => (
                              <span key={scope} className="px-3 py-1 bg-white border border-[#E2E8F0] rounded-lg text-[11px] font-mono text-[#334155]">{scope}</span>
                            ))}
                         </div>
                      </div>
                   </div>
                </SettingsCard>
                
                <div className="flex items-center gap-3 p-4 bg-[#FEF2F2] border border-[#FEE2E2] rounded-2xl">
                   <AlertCircle className="text-[#DC2626] shrink-0" size={18} />
                   <div className="text-[12px] text-[#991B1B] leading-relaxed">
                      Changing the environment URL will invalidate the current secure token and require a full re-authorization.
                   </div>
                </div>
             </div>
           )}

           {/* TAB: SYNC LOGS */}
           {activeDetailTab === 'Sync Logs' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="bg-white border border-[#E2E8F0] rounded-[2rem] overflow-hidden shadow-sm">
                   <table className="w-full text-left font-mono">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                         <tr>
                            <th className="px-8 py-5 text-[10px] font-black text-[#64748B] uppercase tracking-[0.1em]">Timestamp</th>
                            <th className="px-8 py-5 text-[10px] font-black text-[#64748B] uppercase tracking-[0.1em]">Event Type</th>
                            <th className="px-8 py-5 text-[10px] font-black text-[#64748B] uppercase tracking-[0.1em]">Result</th>
                            <th className="px-8 py-5 text-[10px] font-black text-[#64748B] uppercase tracking-[0.1em] text-right">Details</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] text-[12px]">
                         {[
                           { time: '2026-04-13 13:42:01', type: 'FULL_SYNC', status: 'SUCCESS', id: 'evt_192' },
                           { time: '2026-04-13 13:30:45', type: 'TOKEN_REFRESH', status: 'SUCCESS', id: 'evt_191' },
                           { time: '2026-04-13 12:55:12', type: 'SCHEMA_FETCH', status: 'SUCCESS', id: 'evt_190' },
                           { time: '2026-04-13 12:15:00', type: 'FULL_SYNC', status: 'SUCCESS', id: 'evt_189' },
                           { time: '2026-04-13 11:30:22', type: 'WEBHOOK_REGISTER', status: 'SUCCESS', id: 'evt_188' },
                         ].map((log, i) => (
                           <tr key={i} className="hover:bg-[#F9FAFB] transition-colors group">
                              <td className="px-8 py-4 text-[#94A3B8]">{log.time}</td>
                              <td className="px-8 py-4 font-bold text-[#1E293B]">{log.type}</td>
                              <td className="px-8 py-4">
                                 <span className="bg-[#DCFCE7] text-[#166534] px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">{log.status}</span>
                              </td>
                              <td className="px-8 py-4 text-right">
                                 <button className="text-[#3B82F6] font-bold hover:underline">View Payload</button>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                   <div className="p-6 bg-[#F8FAFC] text-center">
                      <button className="flex items-center gap-2 mx-auto text-[13px] font-extrabold text-[#111827] hover:underline">
                         <RefreshCw size={14} /> Load Older Events
                      </button>
                   </div>
                </div>
             </div>
           )}
        </div>
      )}

      {/* ── CONNECTION WIZARD MODAL ────────────────────────────────────── */}
      <Modal 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)}
        title={`Add Integration: ${connectingProvider?.name}`}
        footer={
          <div className="flex justify-between items-center w-full px-2">
            <button 
              onClick={() => setIsWizardOpen(false)} 
              className="text-[13px] font-black uppercase tracking-widest text-[#94A3B8] hover:text-[#111827] transition-colors"
            >
              Terminate
            </button>
            <div className="flex gap-3">
              {wizardStep > 1 && (
                <button 
                  onClick={() => setWizardStep(s => s - 1)}
                  className="px-6 py-2.5 bg-white border border-[#E2E8F0] text-[13px] font-black uppercase tracking-widest rounded-xl hover:bg-[#F8FAFC]"
                >
                  Back
                </button>
              )}
              {wizardStep < 3 ? (
                <button 
                  onClick={() => setWizardStep(s => s + 1)}
                  className="px-8 py-2.5 bg-[#111827] text-white text-[13px] font-black uppercase tracking-widest rounded-xl hover:shadow-xl hover:scale-105 transition-all"
                >
                  Continue →
                </button>
              ) : (
                <button 
                  onClick={finishWizard}
                  className="px-8 py-2.5 bg-[#3B82F6] text-white text-[13px] font-black uppercase tracking-widest rounded-xl hover:bg-[#2563EB] shadow-xl shadow-blue-500/20"
                >
                  Confirm Joining
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="py-2">
           {/* Wizard Step Indicator */}
           <div className="flex gap-2 mb-10">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex-1">
                   <div className={`h-1.5 rounded-full transition-all duration-500 ${wizardStep >= s ? 'bg-[#111827]' : 'bg-[#E2E8F0]'}`} />
                   <div className={`text-[9px] font-bold mt-2 uppercase tracking-widest ${wizardStep >= s ? 'text-[#111827]' : 'text-[#94A3B8]'}`}>
                      {s === 1 ? 'Environment' : s === 2 ? 'Authentication' : 'Orchestration'}
                   </div>
                </div>
              ))}
           </div>
           
           <div className="min-h-[280px] animate-in slide-in-from-right-4 duration-300">
             {wizardStep === 1 && (
              <div className="space-y-6">
                 <div>
                    <h3 className="text-[18px] font-bold text-[#111827] mb-1">Define Instance</h3>
                    <p className="text-[13px] text-[#64748B]">Provide the base endpoint for your {connectingProvider?.name} workspace.</p>
                 </div>
                 <Input label="Workspace URL" placeholder={`https://company.${connectingProvider?.id === 'servicenow' ? 'service-now.com' : 'atlassian.net'}`} />
                 <Select label="Deployment Environment" options={['Production', 'Sandbox / Development', 'Internal Staging']} />
                 <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl flex gap-3">
                   <Shield className="text-[#166534] shrink-0" size={18} />
                   <p className="text-[12px] text-[#166534] leading-relaxed">
                     This URL is only used for metadata discovery and secure handshake. Your data remains encrypted at rest.
                   </p>
                 </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-6">
                 <div>
                    <h3 className="text-[18px] font-bold text-[#111827] mb-1">Establish Handshake</h3>
                    <p className="text-[13px] text-[#64748B]">Navigator will now redirect you to {connectingProvider?.name} to authorize access.</p>
                 </div>
                 <div className="p-8 border-2 border-dashed border-[#E2E8F0] rounded-[2rem] flex flex-col items-center justify-center text-center">
                    <div className="flex gap-4 items-center mb-6">
                       <div className="w-12 h-12 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-center shadow-sm">
                          <img src="/assets/staffbase-logo.svg" alt="Staffbase" className="w-6 opacity-80" />
                       </div>
                       <RefreshCw className="text-[#94A3B8] animate-spin-slow" size={20} />
                       <div className="w-12 h-12 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-center shadow-sm">
                          {connectingProvider?.icon}
                       </div>
                    </div>
                    <button className="px-6 py-2.5 bg-white border border-[#111827] text-[#111827] text-[13px] font-bold rounded-xl hover:bg-[#111827] hover:text-white transition-all">
                       Authorise via SSO
                    </button>
                    <p className="text-[11px] text-[#94A3B8] mt-4 max-w-[280px]">
                       You need Administrative privileges in {connectingProvider?.name} to approve these scopes.
                    </p>
                 </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-6">
                 <div>
                    <h3 className="text-[18px] font-bold text-[#111827] mb-1">Verify Orchestration</h3>
                    <p className="text-[13px] text-[#64748B]">Navigator detected the following capabilities. Confirm which ones to enable.</p>
                 </div>
                 <div className="space-y-2">
                    {['read_context', 'write_records', 'notify_users', 'search_knowledge'].map(scope => (
                      <div key={scope} className="flex items-center justify-between px-5 py-4 bg-[#F8FAFC] rounded-[1.25rem] border border-[#F1F5F9]">
                         <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-[#DCFCE7] text-[#166534] rounded-full flex items-center justify-center text-[10px]">
                               <Check size={14} strokeWidth={4} />
                            </div>
                            <code className="text-[12px] text-[#1E293B] font-bold font-mono">{scope}</code>
                         </div>
                         <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Authorized</span>
                      </div>
                    ))}
                 </div>
              </div>
            )}
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default IntegrationsTab;
