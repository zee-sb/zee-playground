import React, { useState, useMemo } from 'react';
import { Search, User, Users, Shield, Zap, AlertTriangle, CheckCircle2, ChevronDown, Wrench } from 'lucide-react';

const MOCK_ENTITIES = [
  { id: 'g_all', type: 'group', name: 'All Employees', icon: Users, groups: ['All Employees'] },
  { id: 'g_hr', type: 'group', name: 'HR Team', icon: Users, groups: ['All Employees', 'HR Team'] },
  { id: 'g_it', type: 'group', name: 'IT Support', icon: Users, groups: ['All Employees', 'IT Team'] },
  { id: 'u_alex', type: 'user', name: 'Alex Meyer', subtitle: 'Software Engineer', icon: User, groups: ['All Employees', 'Engineering'] },
  { id: 'u_sarah', type: 'user', name: 'Sarah Connor', subtitle: 'HR Business Partner', icon: User, groups: ['All Employees', 'HR Team'] },
];

const TOPICS = ['IT Support', 'HR', 'Finance', 'Legal', 'Travel', 'Onboarding', 'Payroll', 'Security'];

export default function AccessExplorerTab({ assistants }) {
  const [selectedEntityId, setSelectedEntityId] = useState('g_all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedEntity = MOCK_ENTITIES.find(e => e.id === selectedEntityId);

  // Compute which assistants are available to the selected entity
  const availableAssistants = useMemo(() => {
    if (!selectedEntity) return [];
    return assistants.filter(a => {
      // An assistant is available if any of its targetGroups intersect with the entity's groups
      const targetGroups = a.targetGroups || a.groups || ['All Employees'];
      return selectedEntity.groups.some(g => targetGroups.includes(g));
    });
  }, [assistants, selectedEntity]);

  // Compute coverage map: Topic -> [Assistants handling it]
  const coverageMap = useMemo(() => {
    const map = {};
    TOPICS.forEach(topic => {
      map[topic] = availableAssistants.filter(a => {
        // Internal assistants in prototype often don't have explicit topics, map by name
        if (a.type === 'internal') {
          const nameLower = a.name.toLowerCase();
          if (topic === 'IT Support' && nameLower.includes('it')) return true;
          if (topic === 'Security' && nameLower.includes('it')) return true;
          if (topic === 'HR' && nameLower.includes('hr')) return true;
          if (topic === 'Payroll' && nameLower.includes('hr')) return true;
          if (topic === 'Travel' && nameLower.includes('travel')) return true;
          return false;
        } else {
          // External agents use selectedTopics
          const topics = a.selectedTopics || [];
          if (topics.length > 0) return topics.includes(topic);
          
          const nameLower = a.name.toLowerCase();
          if (topic === 'IT Support' && nameLower.includes('it')) return true;
          if (topic === 'HR' && nameLower.includes('hr')) return true;
          return false;
        }
      });
    });
    return map;
  }, [availableAssistants]);

  const conflicts = Object.entries(coverageMap).filter(([_, owners]) => owners.length > 1);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 max-w-5xl">
      <div className="flex flex-col gap-2">
        <h2 className="text-[20px] font-bold text-[#111827] flex items-center gap-2 tracking-tight">
          <Zap size={22} className="text-[#7C3AED]" />
          Access Explorer
        </h2>
        <p className="text-[14px] text-[#6B7280] max-w-2xl">
          Simulate the Navigator experience for a specific user or group. Discover exactly which assistants, topics, and tools are exposed to them.
        </p>
      </div>

      {/* Simulator Control Panel */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center shrink-0">
             <Search size={18} className="text-[#6B7280]" />
          </div>
          <div className="flex-1 max-w-md relative">
            <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Simulate access for</label>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full text-left h-[44px] px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg flex items-center justify-between hover:bg-[#F3F4F6] transition-colors focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] outline-none"
            >
              {selectedEntity ? (
                <div className="flex items-center gap-2">
                  <selectedEntity.icon size={16} className="text-[#475569]" />
                  <span className="text-[14px] font-semibold text-[#111827]">{selectedEntity.name}</span>
                  {selectedEntity.type === 'user' && <span className="text-[12px] text-[#6B7280]">• {selectedEntity.subtitle}</span>}
                </div>
              ) : (
                <span className="text-[14px] text-[#9CA3AF]">Select a user or group...</span>
              )}
              <ChevronDown size={16} className="text-[#9CA3AF]" />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white border border-[#E5E7EB] rounded-lg shadow-xl z-50 overflow-hidden py-1">
                <div className="px-3 py-2 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider bg-[#FAFAFA] border-b border-[#F3F4F6]">Users</div>
                {MOCK_ENTITIES.filter(e => e.type === 'user').map(entity => (
                  <button
                    key={entity.id}
                    onClick={() => { setSelectedEntityId(entity.id); setIsDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F3F4F6] flex items-center gap-3 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[12px]">
                      {entity.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#111827]">{entity.name}</div>
                      <div className="text-[12px] text-[#6B7280]">{entity.subtitle}</div>
                    </div>
                  </button>
                ))}
                <div className="px-3 py-2 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider bg-[#FAFAFA] border-y border-[#F3F4F6]">Groups</div>
                {MOCK_ENTITIES.filter(e => e.type === 'group').map(entity => (
                  <button
                    key={entity.id}
                    onClick={() => { setSelectedEntityId(entity.id); setIsDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F3F4F6] flex items-center gap-3 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Users size={14} />
                    </div>
                    <div className="text-[13px] font-bold text-[#111827]">{entity.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Context Alerts */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-[14px] font-bold text-amber-900 mb-1">Routing Conflicts Detected</h4>
            <p className="text-[13px] text-amber-800 leading-relaxed">
              This entity has access to multiple assistants claiming the same topics. Navigator will prioritize based on fallback rules, but this may cause unpredictable behavior.
            </p>
            <ul className="mt-3 space-y-2">
              {conflicts.map(([topic, owners]) => (
                <li key={topic} className="text-[12px] text-amber-800 flex items-center gap-2">
                  <span className="font-bold bg-amber-200/50 px-2 py-0.5 rounded">{topic}</span> is claimed by: 
                  {owners.map(o => (
                    <span key={o.id} className="inline-flex items-center gap-1 bg-white px-2 py-0.5 border border-amber-200 rounded shadow-sm text-amber-900 font-medium">
                      {o.emoji || '🤖'} {o.name}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Assigned Assistants */}
        <div className="col-span-1 space-y-4">
          <h3 className="text-[14px] font-bold text-[#111827] uppercase tracking-wider flex items-center gap-2">
            <Shield size={16} className="text-[#9CA3AF]" />
            Active Assistants ({availableAssistants.length})
          </h3>
          <div className="space-y-3">
            {availableAssistants.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-[#E5E7EB] rounded-lg text-[13px] text-[#6B7280]">
                No assistants assigned.
              </div>
            ) : (
              availableAssistants.map(assistant => (
                <div key={assistant.id} className="p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-sm flex items-start gap-3 relative overflow-hidden group">
                  <div className={`w-1.5 h-full absolute left-0 top-0 ${assistant.type === 'external' ? 'bg-[#7C3AED]' : 'bg-[#0055F9]'}`} />
                  <div className="w-10 h-10 rounded-full bg-[#F9FAFB] flex items-center justify-center text-[20px] shrink-0 border border-[#E5E7EB]">
                    {assistant.emoji || '🤖'}
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-[#111827] leading-tight">{assistant.name}</h4>
                    <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">{assistant.type} Agent</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Topic Coverage Map */}
        <div className="col-span-2 space-y-4">
          <h3 className="text-[14px] font-bold text-[#111827] uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#9CA3AF]" />
            Topic Coverage
          </h3>
          <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="px-4 py-3 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">Topic</th>
                  <th className="px-4 py-3 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">Handling Assistant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {TOPICS.map(topic => {
                  const owners = coverageMap[topic];
                  const hasConflict = owners.length > 1;
                  const isCovered = owners.length > 0;

                  return (
                    <tr key={topic} className={`hover:bg-[#F9FAFB] transition-colors ${hasConflict ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-3 text-[13px] font-medium text-[#111827]">
                        {topic}
                      </td>
                      <td className="px-4 py-3">
                        {!isCovered ? (
                          <span className="text-[12px] text-[#9CA3AF] italic">Uncovered (Falls back to Global)</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {owners.map(owner => (
                              <div key={owner.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-bold shadow-sm border ${
                                hasConflict ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-[#475569] border-[#E5E7EB]'
                              }`}>
                                {owner.emoji || '🤖'} {owner.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
