import React from 'react';

export const SettingsCard = ({ title, description, children, className = '' }) => {
  return (
    <div className={`bg-white border border-[#E5E7EB] rounded-[4px] mb-6 ${className}`}>
      {(title || description) && (
        <div className="px-8 py-6">
          {title && <h3 className="text-[16px] font-bold text-[#111827]">{title}</h3>}
          {description && <p className="text-[13px] text-[#6B7280] mt-1">{description}</p>}
        </div>
      )}
      <div className="px-8 pb-8 space-y-6">
        {children}
      </div>
    </div>
  );
};

export const FeatureHeader = ({ title, subtitle, tabs, activeTab, onTabChange, actions }) => {
  return (
    <div className="bg-white border-b border-[#E5E7EB] pt-8 px-8 shrink-0">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-[24px] font-bold text-[#111827] tracking-tight">{title}</h1>
            <p className="text-[14px] text-[#6B7280] mt-1">{subtitle}</p>
          </div>
          <div className="flex gap-3">
            {actions}
          </div>
        </div>

        {tabs && (
          <div className="flex gap-8">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`pb-3 text-[14px] font-medium transition-all relative ${
                    isActive ? 'text-[#111827]' : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3B82F6]" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
