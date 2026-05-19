import React from 'react'
import ToolCallCard from '../../../StaffbaseCompanion/ToolCallCard'

// Renders the conversation in chronological order. Tool turns use the same
// ToolCallCard the Companion chat uses so the transcript looks identical to
// what the employee saw.

function parseContent(c) {
  if (c == null) return null
  if (typeof c === 'string') {
    try { return JSON.parse(c) } catch { return c }
  }
  return c
}

function userText(content) {
  const c = parseContent(content)
  if (typeof c === 'string') return c
  return c?.text || c?.content || ''
}

function assistantText(content) {
  const c = parseContent(content)
  if (typeof c === 'string') return c
  return c?.content || ''
}

function toolMeta(content) {
  const c = parseContent(content)
  if (!c || typeof c !== 'object') return { name: null, content: null }
  let inner = c.content
  if (typeof inner === 'string') {
    try { inner = JSON.parse(inner) } catch { /* keep string */ }
  }
  return { name: c.name || null, content: inner }
}

export default function TranscriptViewer({ messages = [] }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280] mb-3">Transcript</div>
      <div className="space-y-3">
        {messages.map((m) => {
          if (m.role === 'user') {
            const text = userText(m.content)
            if (!text) return null
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] bg-[#111827] text-white text-[13px] rounded-2xl rounded-br-sm px-3.5 py-2 leading-relaxed whitespace-pre-wrap">
                  {text}
                  <div className="text-[10px] text-[#94A3B8] mt-1 text-right">{formatTime(m.created_at)}</div>
                </div>
              </div>
            )
          }
          if (m.role === 'assistant') {
            const text = assistantText(m.content)
            if (!text) return null
            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[80%] bg-[#FAFAFB] border border-[#F1F5F9] text-[#111827] text-[13px] rounded-2xl rounded-bl-sm px-3.5 py-2 leading-relaxed whitespace-pre-wrap">
                  {text}
                  <div className="text-[10px] text-[#94A3B8] mt-1">{formatTime(m.created_at)}</div>
                </div>
              </div>
            )
          }
          if (m.role === 'tool') {
            const meta = toolMeta(m.content)
            return (
              <div key={m.id} className="px-1">
                <ToolCallCard
                  name={meta.name}
                  result={meta.content}
                  status="done"
                />
              </div>
            )
          }
          if (m.role === 'system') {
            const c = parseContent(m.content)
            if (c?.session_lang) {
              return (
                <div key={m.id} className="text-center">
                  <span className="text-[10.5px] uppercase tracking-widest font-semibold text-[#94A3B8]">
                    Language: {c.session_lang}
                  </span>
                </div>
              )
            }
            return null
          }
          return null
        })}
      </div>
    </div>
  )
}

function formatTime(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
