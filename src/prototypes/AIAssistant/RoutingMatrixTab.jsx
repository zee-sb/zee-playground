import React from 'react';
import { Network, Search, AlertTriangle, Shield, Check } from 'lucide-react';

const TOPICS = ['IT Support', 'HR', 'Finance', 'Legal', 'Travel', 'Onboarding', 'Payroll', 'Facilities', 'Security', 'Sales', 'Product', 'Engineering'];
const ALL_GROUPS = ['All Employees', 'Managers', 'HR Team', 'Finance Team', 'Legal Team', 'IT Team', 'New Joiners', 'Executives'];

export default function RoutingMatrixTab({ assistants }) {
  // We compute the "owners" of each Topic x Group intersection.
  // An assistant owns a intersection if:
  // 1. It targets the Group (or 'All Employees')
  // 2. It has the Topic in its `selectedTopics` OR if it's internal we can just look at its name/assigned capabilities (for prototype, we'll map a few explicitly if missing).

  const getOwners = (topic, group) => {
    return assistants.filter(a => {
      // Group check
      const targetsGroup = a.targetGroups?.includes(group) || a.targetGroups?.includes('All Employees') || a.groups?.includes(group) || a.groups?.includes('All Employees');
      if (!targetsGroup) return false;

      // Topic check (Internal assistants in prototype don't have explicit topics set by default, so we mock it based on name)
      if (a.type === 'internal') {
        const nameLower = a.name.toLowerCase();
        if (topic === 'IT Support' && nameLower.includes('it')) return true;
        if (topic === 'Security' && nameLower.includes('it')) return true;
        if (topic === 'HR' && nameLower.includes('hr')) return true;
        if (topic === 'Payroll' && nameLower.includes('hr')) return true;
        if (topic === 'Travel' && nameLower.includes('travel')) return true;
        return false;
      } else {
        // External
        const topics = a.selectedTopics || [];
        if (topics.length > 0) return topics.includes(topic);
        
        // Mock fallback for prototype data
        const nameLower = a.name.toLowerCase();
        if (topic === 'IT Support' && nameLower.includes('it')) return true;
        if (topic === 'HR' && nameLower.includes('hr')) return true;
        if (topic === 'Payroll' && nameLower.includes('hr')) return true;
        return false;
      }
    });
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-[20px] font-bold text-[#111827] flex items-center gap-2 mb-1 tracking-tight">
          <Network size={22} className="text-[#0055F9]" />
          Routing Map
        </h2>
        <p className="text-[14px] text-[#6B7280]">
          Visualize which assistant handles which topics across different employee groups. 
          Use this to identify overlap conflicts or coverage gaps.
        </p>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[12px] font-medium text-[#475569]">
                <div className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-400"></div> Covered
              </div>
              <div className="flex items-center gap-2 text-[12px] font-medium text-[#475569]">
                <div className="w-3 h-3 rounded-full bg-amber-100 border border-amber-400 flex items-center justify-center">
                  <AlertTriangle size={8} className="text-amber-600" />
                </div> Conflict
              </div>
              <div className="flex items-center gap-2 text-[12px] font-medium text-[#475569]">
                <div className="w-3 h-3 rounded-full bg-[#F3F4F6] border border-[#D1D5DB]"></div> Gap
              </div>
           </div>
           
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={14} />
              <input 
                type="text" 
                placeholder="Search topics..."
                className="pl-9 pr-4 py-1.5 border border-[#E5E7EB] rounded-md text-[12px] focus:outline-none focus:ring-1 focus:ring-[#0055F9] w-64 bg-white shadow-sm"
              />
           </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-4 bg-[#F8FAFC] border-b border-r border-[#E5E7EB] text-[12px] font-bold text-[#475569] min-w-[140px] sticky left-0 z-10 shadow-[1px_0_0_#E5E7EB]">
                  Topic / Intent
                </th>
                {ALL_GROUPS.map(g => (
                  <th key={g} className="p-4 bg-white border-b border-[#E5E7EB] text-[12px] font-bold text-[#475569] min-w-[160px] text-center">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOPICS.map((topic, idx) => (
                <tr key={topic} className="hover:bg-[#F8FAFC] transition-colors group">
                  <td className="p-4 border-b border-r border-[#E5E7EB] text-[13px] font-medium text-[#111827] sticky left-0 bg-white group-hover:bg-[#F8FAFC] z-10 shadow-[1px_0_0_#E5E7EB]">
                    {topic}
                  </td>
                  {ALL_GROUPS.map(group => {
                    const owners = getOwners(topic, group);
                    const isConflict = owners.length > 1;
                    const isCovered = owners.length === 1;
                    
                    return (
                      <td key={`${topic}-${group}`} className={`p-3 border-b border-[#E5E7EB] ${isConflict ? 'bg-amber-50/50' : ''}`}>
                        {owners.length === 0 ? (
                          <div className="h-8 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-[#E5E7EB]"></div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 items-center">
                            {owners.map(owner => (
                              <div 
                                key={owner.id} 
                                className={`px-2 py-1 rounded w-full flex items-center justify-center gap-1.5 text-[11px] font-bold ${
                                  owner.type === 'internal' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {owner.emoji || (owner.type === 'internal' ? '🤖' : '🔌')}
                                <span className="truncate max-w-[110px]">{owner.name}</span>
                              </div>
                            ))}
                            {isConflict && (
                               <div className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-1">
                                 <AlertTriangle size={10} /> Routing Conflict
                               </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
