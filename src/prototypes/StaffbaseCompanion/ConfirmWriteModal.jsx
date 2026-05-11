import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmWriteModal({ toolCalls, onConfirm, onCancel, busy }) {
  if (!toolCalls?.length) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-[520px] w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E4E7] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] grid place-items-center text-[#B45309]">
              <AlertTriangle size={16} />
            </div>
            <div>
              <div className="font-bold text-[15px]">Confirm write action</div>
              <div className="text-[12px] text-[#71717A]">Companion will make this change in your real Atlassian instance.</div>
            </div>
          </div>
          <button onClick={onCancel} className="text-[#A1A1AA] hover:text-[#52525B]" disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-auto">
          {toolCalls.map((tc) => (
            <div key={tc.id} className="border border-[#E4E4E7] rounded-lg p-3 bg-[#FAFAFA]">
              <div className="font-mono text-[12px] font-bold mb-2">{tc.name}</div>
              <pre className="text-[11px] bg-white border border-[#E4E4E7] rounded p-2 overflow-auto max-h-[260px] whitespace-pre-wrap break-words text-[#18181B]">{JSON.stringify(tc.args, null, 2)}</pre>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-[#E4E4E7] flex items-center justify-end gap-2 bg-[#FAFAFA]">
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
