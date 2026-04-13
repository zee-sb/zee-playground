import React from 'react';
import { SettingsCard } from '../../components/SettingsCard';

const AnalyticsTab = () => {
  const stats = [
    { label: 'Total Interactions', value: '12,482', change: '+14%', trend: 'up' },
    { label: 'Resolution Rate', value: '89.2%', change: '+2.4%', trend: 'up' },
    { label: 'Avg. Response Time', value: '1.2s', change: '-0.1s', trend: 'down' },
    { label: 'User Satisfaction', value: '4.8/5', change: '+0.2', trend: 'up' },
  ];

  const topIntents = [
    { name: 'Policy Search', count: 4201, color: '#3B82F6' },
    { name: 'IT Support', count: 3120, color: '#6366F1' },
    { name: 'Leave Requests', count: 2450, color: '#8B5CF6' },
    { name: 'Employee Directory', count: 1820, color: '#EC4899' },
    { name: 'Other', count: 891, color: '#94A3B8' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-sm">
             <div className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">{s.label}</div>
             <div className="flex items-end gap-3">
                <span className="text-[24px] font-bold text-[#111827]">{s.value}</span>
                <span className={`text-[12px] font-bold pb-1 ${s.trend === 'up' ? 'text-[#22C55E]' : 'text-[#3B82F6]'}`}>
                   {s.change}
                </span>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <SettingsCard title="Engagement Trend" description="Interactions over the last 30 days." className="col-span-2">
           <div className="h-[240px] flex items-end justify-between gap-1 pt-4">
              {[40, 60, 45, 70, 85, 55, 60, 40, 75, 90, 100, 80, 65, 45, 30, 50, 70, 95, 80, 60].map((h, i) => (
                <div key={i} className="flex-1 group relative">
                   <div 
                    style={{ height: `${h}%` }} 
                    className="bg-[#3B82F6]/10 group-hover:bg-[#3B82F6] transition-all rounded-t-sm"
                   />
                   <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#111827] text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {h * 10} msgs
                   </div>
                </div>
              ))}
           </div>
           <div className="flex justify-between mt-4 text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest px-2">
              <span>Mar 12</span>
              <span>Mar 20</span>
              <span>Today</span>
           </div>
        </SettingsCard>

        <SettingsCard title="Top Intents" description="Most common triggers.">
           <div className="space-y-4 pt-2">
              {topIntents.map(intent => (
                <div key={intent.name} className="space-y-1.5">
                   <div className="flex justify-between text-[12px]">
                      <span className="font-semibold text-[#374151]">{intent.name}</span>
                      <span className="text-[#6B7280]">{intent.count}</span>
                   </div>
                   <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${(intent.count / 4201) * 100}%`, backgroundColor: intent.color }} 
                        className="h-full rounded-full"
                      />
                   </div>
                </div>
              ))}
           </div>
        </SettingsCard>
      </div>
    </div>
  );
};

export default AnalyticsTab;
