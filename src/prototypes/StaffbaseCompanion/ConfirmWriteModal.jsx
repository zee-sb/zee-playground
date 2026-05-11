import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// Bottom sheet — anchored to the bottom of the closest relatively-positioned
// ancestor (the chat surface inside the phone frame on desktop, the chat
// container on mobile). Slides up on mount.
export default function ConfirmWriteModal({ toolCalls, onConfirm, onCancel, busy }) {
  if (!toolCalls?.length) return null;

  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end pointer-events-none">
      {/* Scrim */}
      <div
        onClick={busy ? undefined : onCancel}
        className="absolute inset-0 bg-black/40 pointer-events-auto transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
      />

      {/* Sheet */}
      <div
        className="relative bg-white rounded-t-2xl shadow-2xl overflow-hidden pointer-events-auto transition-transform duration-200 ease-out"
        style={{ transform: open ? 'translateY(0)' : 'translateY(100%)' }}
      >
        {/* Grab handle */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-9 h-1 rounded-full bg-[#E4E4E7]" />
        </div>

        <div className="px-5 py-3 border-b border-[#E4E4E7] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] grid place-items-center text-[#B45309] flex-shrink-0">
              <AlertTriangle size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[14px]">Confirm write action</div>
              <div className="text-[11px] text-[#71717A]">Companion will make this change in your real Atlassian instance.</div>
            </div>
          </div>
          <button onClick={onCancel} className="text-[#A1A1AA] hover:text-[#52525B] flex-shrink-0" disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 space-y-2 overflow-auto" style={{ maxHeight: '40vh' }}>
          {toolCalls.map((tc) => (
            <div key={tc.id} className="border border-[#E4E4E7] rounded-lg p-2.5 bg-[#FAFAFA]">
              <div className="font-mono text-[11px] font-bold mb-1.5">{tc.name}</div>
              <pre className="text-[10px] bg-white border border-[#E4E4E7] rounded p-2 overflow-auto whitespace-pre-wrap break-words text-[#18181B]" style={{ maxHeight: 180 }}>{JSON.stringify(tc.args, null, 2)}</pre>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#E4E4E7] flex items-center justify-end gap-2 bg-[#FAFAFA]">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#52525B] hover:bg-[#F4F4F5] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50"
          >
            {busy ? 'Running…' : 'Confirm and run'}
          </button>
        </div>
      </div>
    </div>
  );
}
