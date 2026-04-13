import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, HelpCircle, Users, Settings, FileText } from 'lucide-react';

const SidebarItem = ({ label, active, icon, onClick, sub = false }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-[13.5px] transition-colors ${
      active 
        ? 'bg-[#EFF6FF] text-[#1D4ED8] font-medium' 
        : 'text-[#374151] hover:bg-[#F9FAFB]'
    } ${sub ? 'pl-8' : ''}`}
  >
    {icon && <span className="text-[16px]">{icon}</span>}
    {label}
  </button>
);

const SidebarSection = ({ title }) => (
  <div className="px-3 pt-6 pb-2 text-[11px] font-bold text-[#9CA3AF] tracking-widest uppercase">
    {title}
  </div>
);

export const StudioShell = ({ children, activeSidebarItem }) => {
  return (
    <div className="flex flex-col h-screen bg-[#F3F4FB] font-sans selection:bg-[#3B82F6]/20">
      {/* Top Navigation */}
      <nav className="h-[52px] bg-white border-b border-[#E5E7EB] flex items-center shrink-0 px-4 z-50">
        <Link to="/" className="flex items-center gap-3 mr-8 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 bg-[#111827] rounded-md flex items-center justify-center text-white text-[14px]">
            <span><Sparkles size={18} /></span>
          </div>
          <span className="font-bold text-[14.5px] text-[#111827] tracking-tight">Staffbase Studio</span>
        </Link>

        <div className="flex gap-1">
          {['Dashboard', 'Planning', 'Content', 'Email', 'Screens', 'Files', 'Analytics'].map((n) => (
            <Link 
              key={n} 
              to={n === 'Dashboard' ? '/' : '#'} 
              className={`px-3 py-1 text-[13.5px] rounded-md font-medium transition-colors ${
                n === 'Content' ? 'bg-[#111827] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]'
              }`}
            >
              {n}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <button className="text-[#6B7280] hover:text-[#111827]"><span className="text-[18px]"><HelpCircle size={18} /></span></button>
          <button className="text-[#6B7280] hover:text-[#111827]"><span className="text-[18px]"><Users size={18} /></span></button>
          <button className="text-[#6B7280] hover:text-[#111827]"><span className="text-[18px]"><Settings size={18} /></span></button>
          <div className="w-8 h-8 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-[12px] font-bold border-2 border-white shadow-sm">
            ZA
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[240px] bg-white border-r border-[#E5E7EB] overflow-y-auto flex flex-col p-2 shrink-0">
          <div className="mb-4">
             <div className="px-3 py-2">
                <div className="flex items-center justify-between border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-[#F9FAFB] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] flex items-center"><FileText size={14} /></span>
                    <span className="text-[13px] font-semibold text-[#111827]">All content</span>
                  </div>
                  <span className="text-[#9CA3AF] text-[10px]">▼</span>
                </div>
             </div>
          </div>

          <SidebarSection title="Content" />
          <SidebarItem label="News" />
          <SidebarItem label="Pages" />
          <SidebarItem label="Embedded Pages" />
          <SidebarItem label="Surveys" />
          <SidebarItem label="Links" />
          <SidebarItem label="Chat" />
          <SidebarItem label="Journeys" />
          <SidebarItem label="Directory" />
          <SidebarItem label="Forms" />
          <SidebarItem label="Integrated Content" />
          
          <div className="mt-2 pl-3">
             <button className="flex items-center gap-2 text-[13px] font-semibold text-[#3B82F6] hover:underline">
               <span className="text-[14px]">+</span> Add Plugin
             </button>
          </div>

          <SidebarSection title="System" />
          <SidebarItem label="Trash" />
          <SidebarItem label="Spaces" />
          <SidebarItem label="Menu" />
          <SidebarItem label="AI Assistant" active={activeSidebarItem === 'AI Assistant'} />
          <SidebarItem label="Launchpad" />
          <SidebarItem label="Print on Demand" />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
};
