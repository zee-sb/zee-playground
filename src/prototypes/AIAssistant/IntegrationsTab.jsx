import React from 'react';
import { Plug } from 'lucide-react';

export default function IntegrationsTab() {
  return (
    <div className="animate-in fade-in duration-300 bg-white border border-[#E5E7EB] rounded-xl p-8">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center border border-violet-200">
          <Plug size={18} />
        </div>
        <div>
          <h3 className="text-[16px] font-bold text-[#111827]">Integrations moved to Connectors</h3>
          <p className="text-[13px] text-[#6B7280] mt-1">
            This surface is intentionally deprecated. Use the Connectors module for onboarding,
            capability discovery, availability, access, and safety management.
          </p>
        </div>
      </div>
    </div>
  );
}
