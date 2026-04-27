import { ArrowLeft, AppWindow, Sparkles, Plug, Globe, Link2, AlertTriangle, Zap, Check, Loader2, X, Brain, Shield, Info, ArrowRight, Users, ExternalLink, FileUp, FileText, Database, Folder, ChevronDown, Trash2, Search, ChevronRight } from "lucide-react";
import { useState, useEffect } from 'react';
import { useNotification } from '../../components/NotificationProvider';

const PROVIDERS = [
  { id: 'copilot_studio', label: 'Copilot Studio', icon: <AppWindow size={24} />, description: 'Microsoft Copilot Studio agents via MCP' },
  { id: 'gemini', label: 'Gemini', icon: <Sparkles size={24} />, description: 'Google Gemini agents and Workspace integrations' },
  { id: 'custom', label: 'Custom MCP', icon: <Plug size={24} />, description: 'Any MCP-compatible agent or server' },
];

const TOPICS = ['IT Support', 'HR', 'Finance', 'Legal', 'Travel', 'Onboarding', 'Payroll', 'Facilities', 'Security', 'Sales', 'Product', 'Engineering'];
const ALL_GROUPS = ['All Employees', 'Managers', 'HR Team', 'Finance Team', 'Legal Team', 'IT Team', 'New Joiners', 'Executives'];
const ALL_USERS = [
  'alex.meyer@staffbase.com',
  'maria.schmidt@staffbase.com',
  'john.doe@staffbase.com',
  'liam.chen@staffbase.com',
  'sarah.lee@staffbase.com',
];

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
function StepExternalConnection({ data, setData, agentConnectors = [] }) {
  const selectedConnector = agentConnectors.find((connector) => connector.id === data.connectorId) || null;
  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <div>
        <h3 className="text-[18px] font-bold text-[#111827] mb-1 tracking-tight">Bind existing Agent MCP connector</h3>
        <p className="text-[13px] text-[#6B7280]">External assistants must be created from an existing Agent connector managed in top-level Connectors.</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[14px] font-bold text-[#111827]">Agent connector</label>
          <select
            value={data.connectorId || ''}
            onChange={(e) => {
              const connector = agentConnectors.find((item) => item.id === e.target.value);
              setData((draft) => ({
                ...draft,
                connectorId: e.target.value,
                name: draft.name || connector?.name || '',
                provider: connector?.provider?.toLowerCase().includes('copilot') ? 'copilot_studio' : connector?.provider?.toLowerCase().includes('gemini') ? 'gemini' : 'custom',
                endpoint: connector?.endpoint || '',
                description: connector?.description || draft.description || '',
              }));
            }}
            className="w-full h-[40px] px-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px] bg-white"
          >
            <option value="">Select an Agent MCP connector…</option>
            {agentConnectors.map((connector) => (
              <option key={connector.id} value={connector.id}>{connector.name} · {connector.provider}</option>
            ))}
          </select>
        </div>
        {selectedConnector && (
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-[12px]">
            <div><span className="font-bold text-[#475569]">Provider:</span> {selectedConnector.provider}</div>
            <div><span className="font-bold text-[#475569]">Endpoint:</span> {selectedConnector.endpoint}</div>
            <div><span className="font-bold text-[#475569]">Health:</span> {selectedConnector.health}</div>
            <div><span className="font-bold text-[#475569]">Capabilities:</span> {(selectedConnector.tools || []).length}</div>
          </div>
        )}
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-3 space-y-2">
            <label className="text-[14px] font-bold text-[#111827]">Assistant display name</label>
            <input
              value={data.name || ''}
              onChange={e => setData(d => ({ ...d, name: e.target.value }))}
              placeholder="e.g. IT Helpdesk Assistant"
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

// ── EXTERNAL STEP: CAPABILITIES ──────────────────────────────────────
function StepExternalCapabilities({ data, setData }) {
  const { success } = useNotification();
  const [newQuery, setNewQuery] = useState('');
  const [manifestParsed, setManifestParsed] = useState(false);
  const manifestMode = data.manifestMode || 'wizard';

  function toggleTopic(t) {
    const topics = data.selectedTopics || [];
    setData(d => ({
      ...d,
      selectedTopics: topics.includes(t) ? topics.filter(x => x !== t) : [...topics, t],
    }));
  }

  function addQuery() {
    if (!newQuery.trim()) return;
    setData(d => ({ ...d, exampleQueries: [...(d.exampleQueries || []), newQuery.trim()] }));
    setNewQuery('');
  }

  function removeQuery(i) {
    setData(d => ({ ...d, exampleQueries: (d.exampleQueries || []).filter((_, idx) => idx !== i) }));
  }

  function parseManifest() {
    setData(d => ({
      ...d,
      selectedTopics: ['IT Support', 'Security'],
      exampleQueries: ['Reset my laptop password', 'VPN not connecting', 'Request software license'],
      confidenceThreshold: 0.75,
      fallback: 'global',
      manifestMode: 'wizard',
    }));
    setManifestParsed(true);
    success('Manifest parsed', '2 intents detected from Navigator Agent Manifest');
  }

  const hasConflict = (data.selectedTopics || []).includes('IT Support') &&
    (data.selectedGroups || ['All Employees']).includes('All Employees');

  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <div>
        <h3 className="text-[18px] font-bold text-[#111827] mb-1 tracking-tight">Declare Capabilities</h3>
        <p className="text-[13px] text-[#6B7280]">
          Tell Navigator what this agent handles. This becomes the routing contract — Navigator uses it to decide when to call this agent.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-[#F3F4F6] rounded-lg w-fit">
        {[['wizard', 'Wizard'], ['manifest', 'Upload Manifest']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setData(d => ({ ...d, manifestMode: val }))}
            className={`px-4 py-1.5 rounded-md text-[13px] font-bold transition-all ${
              manifestMode === val ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Manifest upload mode */}
      {manifestMode === 'manifest' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[14px] font-bold text-[#111827]">Navigator Agent Manifest (YAML)</label>
            <textarea
              value={data.manifestYaml || ''}
              onChange={e => setData(d => ({ ...d, manifestYaml: e.target.value }))}
              placeholder={`navigator_manifest_version: "1.0"\nagent:\n  id: "acme-it-helpdesk"\n  display_name: "IT Helpdesk Agent"\n  provider: "copilot_studio"\ncapabilities:\n  intents:\n    - id: "password_reset"\n      description: "User wants to reset a password"\n      example_queries: ["I can't log in", "reset my password"]\n  topics: ["IT Support", "Security"]\nrouting:\n  priority: 10\n  fallback_behavior: "pass_to_global_agent"`}
              className="w-full min-h-[200px] p-4 border border-[#E5E7EB] rounded-md font-mono text-[12px] leading-relaxed bg-[#FAFAFA] focus:ring-1 focus:ring-[#0055F9] outline-none resize-none"
            />
          </div>
          <button
            onClick={parseManifest}
            className="px-6 py-2 bg-[#111827] text-white text-[13px] font-bold rounded-md hover:bg-[#1F2937] transition-colors"
          >
            Parse Manifest
          </button>
          {manifestParsed && (
            <div className="flex items-center gap-2 p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg text-[13px] text-[#166534] font-medium">
              <Check size={14} strokeWidth={3} /> Parsed — 2 intents detected. Switching to wizard view.
            </div>
          )}
          <p className="text-[12px] text-[#9CA3AF]">Paste your Navigator Agent Manifest YAML. Click Parse to auto-fill the wizard fields.</p>
        </div>
      )}

      {/* Wizard mode */}
      {manifestMode === 'wizard' && (
        <div className="space-y-6">
          {hasConflict && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[13px] font-bold text-amber-800">Potential routing conflict</div>
                <div className="text-[12px] text-amber-700 mt-0.5">
                  The existing IT Support assistant already covers IT Support intents for All Employees.
                  You can still connect — adjust routing priority in the Configuration step.
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-[14px] font-bold text-[#111827]">Topic areas</label>
              <p className="text-[12px] text-[#6B7280] mt-0.5">What domains does this agent handle? Navigator uses these for intent routing.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map(t => (
                <button
                  key={t}
                  onClick={() => toggleTopic(t)}
                  className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium transition-all ${
                    (data.selectedTopics || []).includes(t)
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[14px] font-bold text-[#111827]">Example queries</label>
              <p className="text-[12px] text-[#6B7280] mt-0.5">Add at least 3 examples to help Navigator understand when to route here.</p>
            </div>
            <div className="flex gap-2">
              <input
                value={newQuery}
                onChange={e => setNewQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addQuery()}
                placeholder="e.g. Reset my laptop password"
                className="flex-1 h-[40px] px-4 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#0055F9] outline-none text-[14px]"
              />
              <button
                onClick={addQuery}
                className="px-4 h-[40px] bg-[#F3F4F6] text-[#111827] rounded-md text-[13px] font-bold hover:bg-[#E5E7EB] transition-colors"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(data.exampleQueries || []).map((q, i) => (
                <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F4F6] rounded-lg text-[12px] text-[#374151]">
                  "{q}"
                  <button onClick={() => removeQuery(i)} className="text-[#9CA3AF] hover:text-[#EF4444] ml-0.5">×</button>
                </span>
              ))}
            </div>
            {(data.exampleQueries || []).length > 0 && (data.exampleQueries || []).length < 3 && (
              <p className="text-[12px] text-amber-600">
                Add {3 - (data.exampleQueries || []).length} more example{3 - (data.exampleQueries || []).length !== 1 ? 's' : ''} (minimum 3 recommended)
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[14px] font-bold text-[#111827]">
              Confidence threshold: <span className="text-[#7C3AED]">{data.confidenceThreshold || 0.75}</span>
            </label>
            <input
              type="range" min="0.5" max="1" step="0.05"
              value={data.confidenceThreshold || 0.75}
              onChange={e => setData(d => ({ ...d, confidenceThreshold: parseFloat(e.target.value) }))}
              className="w-full accent-[#7C3AED]"
            />
            <div className="flex justify-between text-[11px] text-[#9CA3AF] uppercase font-bold tracking-wider">
              <span>0.5 — Broad matching</span><span>1.0 — Strict matching</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[14px] font-bold text-[#111827]">Fallback behavior</label>
            <div className="space-y-2">
              {[
                ['global', 'Route to global agent', 'Navigator handles the query as a fallback'],
                ['decline', 'Decline gracefully', 'Agent tells the user it cannot help with this'],
                ['human', 'Escalate to human support', 'Route to a live support agent'],
              ].map(([val, label, desc]) => (
                <label key={val} className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E7EB] cursor-pointer hover:bg-[#F9FAFB] transition-colors">
                  <input
                    type="radio" name="fallback" value={val}
                    checked={(data.fallback || 'global') === val}
                    onChange={() => setData(d => ({ ...d, fallback: val }))}
                    className="mt-0.5 accent-[#7C3AED]"
                  />
                  <div>
                    <div className="text-[13px] font-bold text-[#111827]">{label}</div>
                    <div className="text-[12px] text-[#6B7280]">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Routing preview */}
      {(data.selectedTopics || []).length > 0 && (
        <div className="p-4 bg-[#F5F3FF] border border-[#DDD6FE] rounded-lg">
          <div className="text-[12px] font-bold text-[#7C3AED] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Zap size={12} /> Routing Preview
          </div>
          <p className="text-[13px] text-[#4C1D95] mb-2">Navigator will route queries matching these topics to this agent:</p>
          <div className="flex flex-wrap gap-1.5">
            {(data.selectedTopics || []).map(t => (
              <span key={t} className="px-2.5 py-1 bg-[#7C3AED] text-white rounded-full text-[11px] font-bold">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── UNIFIED STEP: CAPABILITIES & GOVERNANCE ───────────────────────────
function StepUnifiedGovernance({ data, setData, platformConnections = [] }) {
  const capabilityCatalog = platformConnections.flatMap((connection) =>
    (connection.capabilities || []).map((capability) => ({
      id: capability.id,
      connectionName: connection.name,
      connectionType: connection.connectionType || connection.type,
      title: capability.title,
    }))
  );

  function toggleCapability(capabilityId) {
    const selected = data.assignedCapabilityIds || [];
    setData((draft) => ({
      ...draft,
      assignedCapabilityIds: selected.includes(capabilityId)
        ? selected.filter((id) => id !== capabilityId)
        : [...selected, capabilityId],
    }));
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <div>
        <h3 className="text-[18px] font-bold text-[#111827] mb-1 tracking-tight">Configuration & Governance</h3>
        <p className="text-[13px] text-[#6B7280]">Control when and how this assistant is triggered.</p>
      </div>

      <div className="space-y-6">
         <div className="space-y-3">
            <label className="text-[14px] font-bold text-[#111827]">Assigned Platform Capabilities</label>
            <p className="text-[12px] text-[#6B7280]">Select platform-managed capabilities this assistant may invoke.</p>
            <div className="grid grid-cols-2 gap-2">
               {capabilityCatalog.map((capability) => {
                 const selected = (data.assignedCapabilityIds || []).includes(capability.id);
                 return (
                   <button
                     key={capability.id}
                     onClick={() => toggleCapability(capability.id)}
                     className={`text-left px-3 py-2 rounded-lg border transition-all ${
                       selected
                         ? 'border-[#0055F9] bg-[#EFF6FF]'
                         : 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]'
                     }`}
                   >
                     <div className="text-[12px] font-bold text-[#111827]">{capability.title}</div>
                     <div className="text-[11px] text-[#6B7280]">{capability.connectionName} · {capability.connectionType === 'full_agent' ? 'Agent' : 'Tool Server'}</div>
                   </button>
                 );
               })}
            </div>
         </div>

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

         <div className="space-y-3">
            <label className="text-[14px] font-bold text-[#111827]">Target users</label>
            <p className="text-[12px] text-[#6B7280]">Optional direct allowlist for individual users.</p>
            <div className="flex flex-wrap gap-2">
               {ALL_USERS.map((user) => (
                 <button
                   key={user}
                   onClick={() => setData((d) => ({
                     ...d,
                     targetUsers: (d.targetUsers || []).includes(user)
                       ? (d.targetUsers || []).filter((item) => item !== user)
                       : [...(d.targetUsers || []), user],
                   }))}
                   className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                     (data.targetUsers || []).includes(user)
                       ? 'bg-[#0EA5E9] text-white'
                       : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]'
                   }`}
                 >
                   {user}
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

export default function AssistantWizard({ onBack, onComplete, startExternal = false, platformConnections = [] }) {
  const [creationType, setCreationType] = useState(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    selectedTopics: [],
    selectedGroups: ['All Employees'],
    targetUsers: [],
    exampleQueries: [],
    confidenceThreshold: 0.75,
    fallback: 'global',
    manifestMode: 'wizard',
    manifestYaml: '',
    safetyMode: 'Standard',
    routingSensitivity: 50,
    uploadedFiles: [],
    assignedCapabilityIds: [],
  });

  const internalSteps = ['Identity', 'Sources', 'Configuration'];
  const externalSteps = ['Profile', 'Routing', 'Configuration'];
  const activeSteps = creationType === 'internal' ? internalSteps : externalSteps;

  function handleTypeSelect(type) {
    setCreationType(type);
    setStep(1);
    setData(d => ({ ...d, type }));
  }

  // If launched from "Connect External Agent" shortcut, skip type selection
  useEffect(() => {
    if (startExternal) handleTypeSelect('external');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    const selectedConnector = (platformConnections || []).find((connection) => connection.id === data.connectorId);
    onComplete({
      id: `ast-${Date.now()}`,
      status: 'active',
      ...data,
      type: creationType,
      groups: data.selectedGroups,
      targetGroups: data.selectedGroups,
      targetUsers: data.targetUsers || [],
      sourceConnectorId: selectedConnector?.id,
      sourceConnectorName: selectedConnector?.name || data.sourceConnectorName,
      bindingMode: selectedConnector ? 'full' : 'degraded',
      provider: data.provider || (selectedConnector?.provider?.toLowerCase().includes('copilot') ? 'copilot_studio' : selectedConnector?.provider?.toLowerCase().includes('gemini') ? 'gemini' : 'custom'),
      description: data.description || selectedConnector?.description || 'External MCP-connected assistant',
      emoji: data.emoji || (creationType === 'internal' ? '🤖' : '🔌')
    });
  }

  const canProceed = step === 0 ? true
    : creationType === 'internal'
      ? (step === 1 ? (data.name && data.instructions) : step === 2 ? true : (data.selectedGroups.length > 0))
      : step === 1 ? (data.name && data.connectorId)
      : step === 2 ? ((data.selectedTopics || []).length > 0 && (data.exampleQueries || []).length > 0)
      : true;

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
        {step === 1 && (creationType === 'internal'
          ? <StepInternalIdentity data={data} setData={setData} />
          : <StepExternalConnection data={data} setData={setData} agentConnectors={platformConnections.filter((connection) => connection.type === 'full_agent')} />
        )}
        {step === 2 && (creationType === 'internal' ? <StepKnowledgeSources data={data} setData={setData} /> : <StepExternalCapabilities data={data} setData={setData} />)}
        {step === 3 && <StepUnifiedGovernance data={data} setData={setData} platformConnections={platformConnections} />}
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
