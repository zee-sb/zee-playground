import React from 'react';

export const Modal = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl w-full max-w-[600px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
        <div className="px-6 py-4 border-b border-[#F3F4FB] flex justify-between items-center">
          <h3 className="text-[17px] font-bold text-[#111827]">{title}</h3>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#111827] text-[20px]">×</button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 bg-[#FAFBFC] border-t border-[#F3F4FB] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
