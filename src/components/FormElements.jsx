import React from 'react';

/**
 * Fragment-like Segmented Control for Tone, answer length, etc.
 */
export const SegmentedControl = ({ options, value, onChange, label, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && <label className="text-[13px] font-semibold text-[#374151] block">{label}</label>}
      <div className="flex bg-[#F3F4F6] p-1 rounded-lg gap-1 w-fit">
        {options.map((opt) => {
          const isActive = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                isActive 
                  ? 'bg-white text-[#111827] shadow-sm' 
                  : 'text-[#6B7280] hover:text-[#374151]'
              }`}
            >
              {opt.icon && <span className="opacity-70">{opt.icon}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const Input = ({ label, description, ...props }) => {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-[13px] font-semibold text-[#374151] block">{label}</label>}
      <input
        className="w-full text-[14px] border border-[#D1D5DB] rounded-lg px-3 py-2 text-[#111827] focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6] outline-none transition-all placeholder:text-[#9CA3AF]"
        {...props}
      />
      {description && <p className="text-[12px] text-[#6B7280] leading-normal">{description}</p>}
    </div>
  );
};

export const Toggle = ({ label, description, checked, onChange, className = '' }) => {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
       <div className="space-y-0.5">
         {label && <div className="text-[13.5px] font-semibold text-[#111827]">{label}</div>}
         {description && <div className="text-[12.5px] text-[#6B7280] leading-relaxed">{description}</div>}
       </div>
       <button 
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-[#3B82F6]' : 'bg-[#E5E7EB]'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    </div>
  );
};

export const Select = ({ label, options, value, onChange }) => {
  return (
    <div className="space-y-1.5 font-sans">
      {label && <label className="text-[13px] font-semibold text-[#374151] block">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[14px] border border-[#D1D5DB] rounded-lg px-3 py-2 text-[#111827] bg-white focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6] outline-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};
