import React from 'react';
import { Signal, Battery } from 'lucide-react';

export const PhoneMockup = ({ children }) => {
  return (
    <div className="relative group select-none flex flex-col items-center">
      {/* Outer Case / Shadow */}
      <div className="relative w-[440px] h-[880px] bg-[#09090B] rounded-[4.5rem] p-3 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/10 flex flex-col transition-transform duration-500 hover:scale-[1.01]">
        
        {/* Antenna / Side Buttons Simulation */}
        <div className="absolute -left-[3px] top-40 w-[3px] h-12 bg-[#27272A] rounded-l-md" /> {/* Action Button */}
        <div className="absolute -left-[3px] top-60 w-[3px] h-20 bg-[#27272A] rounded-l-md" /> {/* Volume Up */}
        <div className="absolute -left-[3px] top-[260px] w-[3px] h-20 bg-[#27272A] rounded-l-md" /> {/* Volume Down */}
        <div className="absolute -right-[3px] top-64 w-[3px] h-24 bg-[#27272A] rounded-r-md" /> {/* Power Button */}

        {/* Dynamic Island */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-32 h-8 bg-black rounded-[2rem] z-50 flex items-center justify-end px-4 gap-2 border border-white/5">
           <div className="w-2.5 h-2.5 rounded-full bg-[#1e1e1e] ring-1 ring-white/10" /> {/* Camera hole */}
        </div>

        {/* Screen Area */}
        <div className="relative flex-1 bg-white rounded-[3.8rem] overflow-hidden flex flex-col border-[2px] border-[#18181B]">
           {/* Top Status Bar (Fake) */}
           <div className="h-10 px-10 flex justify-between items-end pb-1 text-[12px] font-bold text-black z-40">
              <span>9:41</span>
              <div className="flex gap-1.5 items-center">
                 <span className="text-[14px] flex items-center"><Signal size={14} /></span>
                 <span className="text-[14px] flex items-center"><Battery size={14} /></span>
              </div>
           </div>

           {/* Injected App Content */}
           <div className="flex-1 overflow-hidden relative">
              {children}
           </div>

           {/* Bottom Home Indicator */}
           <div className="h-8 w-full flex items-center justify-center shrink-0">
              <div className="w-32 h-1.5 bg-black/10 rounded-full" />
           </div>
        </div>
      </div>

      {/* Glossy Overlay Reflection */}
      <div className="absolute inset-0 pointer-events-none rounded-[4.5rem] overflow-hidden opacity-20">
         <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-br from-white/30 to-transparent skew-x-[-20deg] translate-x-1/2" />
      </div>
    </div>
  );
};
