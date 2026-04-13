import { ArrowLeft, AppWindow, Sparkles, Plug, Globe, Link2, AlertTriangle, Zap, Check, Loader2, X, Brain, Shield, Info, ArrowRight, Users, ExternalLink, FileUp, FileText, Database, Folder, ChevronDown, Trash2, Search, ChevronRight } from "lucide-react";
import { useState } from 'react';

const PROVIDERS = [
  { id: 'copilot_studio', label: 'Copilot Studio', icon: <AppWindow size={24} />, description: 'Microsoft Copilot Studio agents via MCP' },
  { id: 'gemini', label: 'Gemini', icon: <Sparkles size={24} />, description: 'Google Gemini agents and Workspace integrations' },
  { id: 'custom', label: 'Custom MCP', icon: <Plug size={24} />, description: 'Any MCP-compatible agent or server' },
];

const TOPICS = ['IT Support', 'HR', 'Finance', 'Legal', 'Travel', 'Onboarding', 'Payroll', 'Facilities', 'Security', 'Sales', 'Product', 'Engineering'];
const ALL_GROUPS = ['All Employees', 'Managers', 'HR Team', 'Finance Team', 'Legal Team', 'IT Team', 'New Joiners', 'Executives'];

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-2 scrollbar-hide">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all duration-300 ${
              i < current ? 'bg-[#0055F9] text-white' : i === current ? 'bg-[#0055F9] text-white shadow-sm' : 'bg-[#E5E7EB] text-[#6B7280]'
            }`}>
              {i < current ? <Check size={14} strokeWidth={3} /> : i + 1}
            </div>
            <span className={`text-[13px] font-bold ${i === current ? 'text-[#111827]' : 'text-[#9CA3AF]'}`}>{label}</span>
          </div>
          {i < steps.length - 1 && <div className={`w-16 h-[2px] mx-4 rounded-full ${i < current ? 'bg-[#0055F9]' : 'bg-[#E5E7EB]'}`} />}
        </div>
      ))}
    </div>
  );
}

// ── STEP 0: TYPE SELECTION ───────────────────────────────────────────
function StepTypeSelection({ onSelect }) {
  const options = [
    {
      id: 'internal',
      title: 'Native Assistant',
      desc: 'Build directly within Staffbase. Powered by our native LLM and your connected Knowledge Base.',
      icon: <Brain size={28} className="text-[#0055F9]" />,
      color: 'blue'
    },
    {
      id: 'external',
      title: 'External Agent (MCP)',
      desc: 'Connect an existing specialist agent from Copilot Studio, Gemini, or any custom MCP server.',
      icon: <Zap size={28} className="text-[#7C3AED]" />,
      color: 'purple'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-2xl mx-auto">
      <div className="text-center">
        <h3 className="text-[24px] font-bold text-[#111827] tracking-tight mb-2">Build a new Assistant</h3>
        <p className="text-[14px] text-[#6B7280]">Choose how you want to expand the Navigator network.</p>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className="text-left p-8 bg-white border border-[#E5E7EB] rounded-lg transition-all hover:border-[#0055F9] hover:shadow-lg group"
          >
            <div className="w-14 h-14 rounded-md bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center mb-6 group-hover:bg-[#0055F9]/5 transition-colors">
              {opt.icon}
            </div>
            <h4 className="text-[18px] font-bold text-[#111827] mb-2 flex items-center gap-2">
              {opt.title}
              <ChevronRight size={18} className="text-[#0055F9] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </h4>
            <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── NATIVE WIZARD STEPS ──────────────────────────────────────────────
function StepInternalIdentity({ data, setData }) {
  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <div>
        <h3 className="text-[18px] font-bold text-[#111827] mb-1 tracking-tight">Assistant Identity</h3>
        <p className="text-[13px] text-[#6B7280]">Set the basic persona and behavioral rules for this specialist.</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-3 space-y-2">
            <label className="text-[14px] font-bold text-[#111827]">Name</label>
            <input
              value={data.name || ''}
              onChange={e => setData(d => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Travel Policy Assistant"
               className="w-full h-[40px] px-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px]"
            />
          </div>
          <div className="col-span-1 space-y-2">
            <label className="text-[14px] font-bold text-[#111827]">Icon</label>
            <input
              value={data.emoji || ''}
              onChange={e => setData(d => ({ ...d, emoji: e.target.value }))}
              placeholder="e.g. ✈️"
               className="w-full h-[40px] px-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px] text-center"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[14px] font-bold text-[#111827]">Instructions</label>
          <div className="relative">
             <textarea
               value={data.instructions || ''}
               onChange={e => setData(d => ({ ...d, instructions: e.target.value }))}
               placeholder="How should this assistant behave?"
               className="w-full min-h-[160px] p-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px] leading-relaxed resize-none"
             />
             <div className="text-right text-[11px] text-[#9CA3AF] mt-1">{(data.instructions || '').length}/2000</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepKnowledgeSources({ data, setData }) {
  const [uploading, setUploading] = useState(false);
  const selectedSources = data.knowledgeSources || [];

  function handleUpload() {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setData(d => ({
        ...d,
        uploadedFiles: [...(d.uploadedFiles || []), { name: 'Staffbase_Policy_Document.pdf', size: '2.4MB' }]
      }));
    }, 1500);
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <div>
        <h3 className="text-[18px] font-bold text-[#111827] mb-1 tracking-tight">Sources</h3>
        <p className="text-[13px] text-[#6B7280]">Connect information repositories this assistant can access.</p>
      </div>

      <div className="space-y-8">
         <div className="space-y-2">
            <label className="text-[14px] font-bold text-[#111827]">Pages</label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={16} />
              <input 
                type="text"
                placeholder="Search Staffbase pages..."
                className="w-full h-[40px] pl-10 pr-10 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px]"
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={16} />
            </div>
         </div>

         <div className="space-y-2">
            <label className="text-[14px] font-bold text-[#111827]">Files</label>
            <div className="space-y-3">
               {(data.uploadedFiles || []).map((file, i) => (
                 <div key={i} className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-md bg-[#FAFAFA]">
                    <div className="flex items-center gap-3">
                       <FileText size={18} className="text-[#6B7280]" />
                       <span className="text-[13px] text-[#111827] font-medium">{file.name}</span>
                    </div>
                    <button onClick={() => setData(d => ({ ...d, uploadedFiles: d.uploadedFiles.filter((_, idx) => idx !== i) }))} className="text-[#EF4444] p-1.5 hover:bg-red-50 rounded">
                       <Trash2 size={16} />
                    </button>
                 </div>
               ))}
               
               <div 
                  onClick={handleUpload}
                  className="border-2 border-dashed border-[#E5E7EB] rounded-md p-10 flex flex-col items-center justify-center bg-[#FAFAFA] hover:border-[#0055F9] cursor-pointer transition-all"
               >
                  {uploading ? (
                    <Loader2 size={24} className="text-[#0055F9] animate-spin mb-2" />
                  ) : (
                    <>
                      <p className="text-[14px] text-[#6B7280] mb-4">Drag and drop files here to upload</p>
                      <button className="px-4 py-2 border border-[#E5E7EB] bg-white rounded-md text-[13px] font-bold text-[#111827] flex items-center gap-2 shadow-sm">
                        Choose from <ChevronDown size={14} />
                      </button>
                    </>
                  )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

// ── EXTERNAL WIZARD STEPS ──────────────────────────────
function StepExternalConnection({ data, setData }) {
  const [testStatus, setTestStatus] = useState(null);

  function testConnection() {
    setTestStatus('testing');
    setTimeout(() => setTestStatus(data.endpoint ? 'ok' : 'error'), 1400);
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <div>
        <h3 className="text-[18px] font-bold text-[#111827] mb-1 tracking-tight">Establish Connection</h3>
        <p className="text-[13px] text-[#6B7280]">Connect the remote agent via Model Context Protocol (MCP).</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-3 space-y-2">
            <label className="text-[14px] font-bold text-[#111827]">Agent Name</label>
            <input
              value={data.name || ''}
              onChange={e => setData(d => ({ ...d, name: e.target.value }))}
              placeholder="e.g. HR Workday Integration"
               className="w-full h-[40px] px-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px]"
            />
          </div>
          <div className="col-span-1 space-y-2">
            <label className="text-[14px] font-bold text-[#111827]">Icon</label>
            <input
              value={data.emoji || ''}
              onChange={e => setData(d => ({ ...d, emoji: e.target.value }))}
              placeholder="e.g. ⚡"
               className="w-full h-[40px] px-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px] text-center"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
             <label className="text-[14px] font-bold text-[#111827]">Auth Method</label>
             <select 
               className="w-full h-[40px] px-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px] bg-white cursor-pointer"
               value={data.authMethod || 'oauth2'}
               onChange={e => setData(d => ({ ...d, authMethod: e.target.value }))}
             >
                <option value="none">None / Public</option>
                <option value="apikey">API Key</option>
                <option value="oauth2">OAuth 2.1 (OIDC/PKCE)</option>
                <option value="managed">Managed Identity</option>
             </select>
          </div>
          <div className="space-y-2">
             <label className="text-[14px] font-bold text-[#111827]">Endpoint URL</label>
             <div className="flex gap-2">
                <input 
                  type="text" 
                  value={data.endpoint || ''}
                  onChange={e => setData(d => ({ ...d, endpoint: e.target.value }))}
                  className="flex-1 h-[40px] px-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px] font-mono"
                  placeholder="https://..."
                />
                <button onClick={testConnection} className="px-4 h-[40px] bg-[#111827] text-white rounded-md text-[13px] font-bold">
                   {testStatus === 'testing' ? <Loader2 size={16} className="animate-spin" /> : 'Test'}
                </button>
             </div>
          </div>
        </div>

        <div className="p-6 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg">
           <div className="flex items-center justify-between">
              <div>
                 <h4 className="text-[14px] font-bold text-[#111827]">User Delegation</h4>
                 <p className="text-[12px] text-[#6B7280]">Identify the user on the downstream agent.</p>
              </div>
              <button 
                onClick={() => setData(d => ({ ...d, propagateIdentity: !d.propagateIdentity }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all ${data.propagateIdentity ? 'bg-[#0055F9]' : 'bg-[#E5E7EB]'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ${data.propagateIdentity ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

// ── UNIFIED STEP: CAPABILITIES & GOVERNANCE ───────────────────────────
function StepUnifiedGovernance({ data, setData }) {
  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <div>
        <h3 className="text-[18px] font-bold text-[#111827] mb-1 tracking-tight">Configuration & Governance</h3>
        <p className="text-[13px] text-[#6B7280]">Control when and how this assistant is triggered.</p>
      </div>

      <div className="space-y-6">
         <div className="space-y-3">
            <label className="text-[14px] font-bold text-[#111827]">Visibility Groups</label>
            <div className="flex flex-wrap gap-2">
               {ALL_GROUPS.map(g => (
                 <button
                   key={g}
                   onClick={() => setData(d => ({ ...d, selectedGroups: d.selectedGroups.includes(g) ? d.selectedGroups.filter(x => x !== g) : [...d.selectedGroups, g]}))}
                   className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium transition-all ${
                     data.selectedGroups.includes(g) 
                        ? 'bg-[#0055F9] text-white' 
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
               <label className="text-[14px] font-bold text-[#111827]">Routing Sensitivity</label>
               <input 
                 type="range" 
                 className="w-full accent-[#0055F9]" 
                 value={data.routingSensitivity || 50}
                 onChange={e => setData(d => ({ ...d, routingSensitivity: parseInt(e.target.value) }))}
               />
               <div className="flex justify-between text-[11px] text-[#9CA3AF] uppercase font-bold tracking-wider pt-1">
                  <span>Broad</span>
                  <span>Precise</span>
               </div>
            </div>
            <div className="space-y-3">
               <label className="text-[14px] font-bold text-[#111827]">Safety Mode</label>
               <div className="flex gap-2">
                  {['Standard', 'Strict', 'Audit'].map(mode => (
                    <button 
                      key={mode}
                      onClick={() => setData(d => ({ ...d, safetyMode: mode }))}
                      className={`flex-1 py-1.5 rounded-md text-[12px] font-bold border transition-all ${
                        (data.safetyMode || 'Standard') === mode 
                          ? 'border-[#0055F9] bg-[#0055F9]/5 text-[#0055F9]' 
                          : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

export default function AssistantWizard({ onBack, onComplete }) {
  const [creationType, setCreationType] = useState(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ 
    selectedTopics: [], 
    selectedGroups: ['All Employees'], 
    safetyMode: 'Standard',
    routingSensitivity: 50,
    uploadedFiles: []
  });

  const internalSteps = ['Identity', 'Sources', 'Configuration'];
  const externalSteps = ['Connection', 'Configuration'];
  const activeSteps = creationType === 'internal' ? internalSteps : externalSteps;

  function handleTypeSelect(type) {
    setCreationType(type);
    setStep(1);
    setData(d => ({ ...d, type }));
  }

  function finish() {
    onComplete({
      id: `ast-${Date.now()}`,
      status: 'active',
      ...data,
      type: creationType,
      emoji: data.emoji || (creationType === 'internal' ? '🤖' : '🔌')
    });
  }

  const canProceed = step === 0 ? true
    : creationType === 'internal'
      ? (step === 1 ? (data.name && data.instructions) : step === 2 ? true : (data.selectedGroups.length > 0))
      : (step === 1 ? (data.name && data.endpoint) : true);

  return (
    <div className="max-w-[1000px] mx-auto py-12 px-8">
      {step > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-4">
                <button onClick={() => setStep(0)} className="p-2 hover:bg-[#F3F4F6] rounded-full transition-colors text-[#6B7280]">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-[24px] font-bold text-[#111827] tracking-tight leading-none">Create Assistant</h2>
             </div>
             <button onClick={() => onBack()} className="text-[14px] font-bold text-[#6B7280] hover:text-[#111827]">Cancel</button>
          </div>
          <StepIndicator current={step - 1} steps={activeSteps} />
        </div>
      )}

      <div className={step === 0 ? "" : "bg-white border border-[#E5E7EB] rounded-lg p-10"}>
        {step === 0 && <StepTypeSelection onSelect={handleTypeSelect} />}
        {step === 1 && (creationType === 'internal' ? <StepInternalIdentity data={data} setData={setData} /> : <StepExternalConnection data={data} setData={setData} />)}
        {step === 2 && (creationType === 'internal' ? <StepKnowledgeSources data={data} setData={setData} /> : <StepUnifiedGovernance data={data} setData={setData} />)}
        {step === 3 && creationType === 'internal' && <StepUnifiedGovernance data={data} setData={setData} />}
      </div>

      {step > 0 && (
        <div className="mt-8 flex justify-between items-center">
           <button onClick={() => setStep(s => s - 1)} className="text-[13px] font-bold text-[#6B7280] hover:text-[#111827]">Back</button>
           <div className="flex gap-4">
              {step < activeSteps.length ? (
                <button 
                  onClick={() => setStep(s => s + 1)} 
                  disabled={!canProceed}
                  className="px-8 py-2.5 bg-[#0055F9] text-white text-[14px] font-bold rounded-md hover:bg-[#0044CC] transition-colors shadow-sm disabled:opacity-50"
                >
                  Continue
                </button>
              ) : (
                <button 
                  onClick={finish}
                  disabled={!canProceed}
                  className="px-8 py-2.5 bg-[#0055F9] text-white text-[14px] font-bold rounded-md hover:bg-[#0044CC] transition-colors shadow-sm disabled:opacity-50"
                >
                  Create Assistant
                </button>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
