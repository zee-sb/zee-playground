import React from 'react'
import { Workflow, ChevronRight, Heart, MessageCircle, Share2, Megaphone } from 'lucide-react'

/**
 * "Embed flow in a Staffbase post" preview.
 *
 * Demonstrates the highest-leverage non-chat entry point: a post in the
 * employee feed with a Start-flow CTA. The data on this page is mocked to
 * look like a real Campsite post. The admin's takeaway is "I can launch
 * this from Comms, not just chat."
 */
export default function FlowEmbedPreview({ workflow }) {
  return (
    <div>
      <p className="text-[12px] text-[#6B7280] mb-3 leading-relaxed">
        Paste a flow CTA into any Staffbase news post. When an employee taps <b>Start</b>, the Navigator chat opens with this flow pre-loaded.
      </p>
      <div className="bg-[#F5F5F7] rounded-xl p-3">
        {/* Mock Campsite post */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#00C7B2] text-white flex items-center justify-center text-[12px] font-bold">HR</div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold text-[#111827]">People Team</div>
              <div className="text-[10.5px] text-[#94A3B8]">3 min read · Posted just now</div>
            </div>
          </div>
          <div className="px-4 pb-2">
            <h2 className="text-[15px] font-bold text-[#111827] mb-1">Summer's here — a friendlier way to book time off</h2>
            <p className="text-[12.5px] text-[#374151] leading-relaxed">
              We've made requesting time off a one-tap experience. No more chasing forms — Navigator handles the dates, your balance, and pings your manager. Try it below.
            </p>
          </div>

          {/* Embedded flow CTA — this is the new bit */}
          <div className="mx-4 mb-4 p-3 rounded-lg border border-[#00C7B2]/30 bg-gradient-to-br from-[#00C7B2]/8 to-white">
            <div className="flex items-center gap-2 mb-1.5">
              <Megaphone size={12} className="text-[#0F766E]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0F766E]">Quick action</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-white border border-[#00C7B2]/40 flex items-center justify-center shrink-0">
                <Workflow size={18} className="text-[#0F766E]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#0F766E]">{workflow.name || 'Workflow'}</div>
                <div className="text-[11.5px] text-[#0F766E]/80 truncate">{workflow.goal || 'Tap Start to begin.'}</div>
              </div>
              <button className="px-3 py-1.5 bg-[#0F766E] text-white text-[12px] font-bold rounded-lg shadow-sm flex items-center gap-1">
                Start <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Mock engagement bar */}
          <div className="px-4 py-2 border-t border-[#F1F5F9] flex items-center gap-4 text-[#6B7280] text-[11px]">
            <span className="inline-flex items-center gap-1"><Heart size={12} /> 24</span>
            <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> 3</span>
            <span className="inline-flex items-center gap-1 ml-auto"><Share2 size={12} /> Share</span>
          </div>
        </div>
      </div>

      <div className="mt-3 px-3 py-2 bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg text-[11px] text-[#075985]">
        <b>Why this matters:</b> news posts are the most-read internal surface at most Staffbase customers. Embedding flows here turns "did anyone see the announcement?" into "did anyone use it?" — and you can measure both.
      </div>
    </div>
  )
}
