import React from 'react'
import { ScoreDot } from './EvalScoreBar'

const STATE_PILL = {
  resolved:    { fg: '#065F46', bg: '#ECFDF5', label: 'Resolved' },
  processing:  { fg: '#3730A3', bg: '#EEF2FF', label: 'Processing' },
  unresolved:  { fg: '#92400E', bg: '#FEF3C7', label: 'Unresolved' },
  escalated:   { fg: '#991B1B', bg: '#FEE2E2', label: 'Escalated' },
}

const ISSUE_LABEL = {
  none: '—',
  inaccurate: 'Inaccurate',
  unhelpful: 'Unhelpful',
  inappropriate: 'Inappropriate',
  other: 'Other',
}

export default function ConversationsTable({ rows, onSelect }) {
  if (!rows || rows.length === 0) return null
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-[#FAFAFB] border-b border-[#E5E7EB]">
          <tr>
            <Th>Conversation</Th>
            <Th>Topic</Th>
            <Th>Mode</Th>
            <Th>Device</Th>
            <Th>Lang.</Th>
            <Th align="right">Msgs</Th>
            <Th>Resolution</Th>
            <Th>Hallu.</Th>
            <Th>Friction</Th>
            <Th>State</Th>
            <Th>Reported</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const state = STATE_PILL[r.resolution_state] || STATE_PILL.processing
            const reported = r.reported_issue && r.reported_issue !== 'none'
            return (
              <tr
                key={r.id}
                onClick={() => onSelect?.(r)}
                className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#FAFAFB] cursor-pointer"
              >
                <Td>
                  <div className="text-[12.5px] font-semibold text-[#111827] truncate max-w-[280px]">{r.title}</div>
                  <div className="text-[11px] text-[#94A3B8]">{formatDate(r.created_at)}</div>
                </Td>
                <Td>
                  <span className="inline-flex items-center text-[10.5px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
                    {r.primary_topic || 'Other'}
                  </span>
                </Td>
                <Td>{r.mode || 'text'}</Td>
                <Td>{r.device || 'desktop'}</Td>
                <Td>{(r.language || 'en').toUpperCase()}</Td>
                <Td align="right" mono>{r.message_count}</Td>
                <Td><ScoreDot dimension="resolution" value={r.scores?.resolution?.value} /></Td>
                <Td><ScoreDot dimension="hallucination" value={r.scores?.hallucination?.value} /></Td>
                <Td><ScoreDot dimension="friction" value={r.scores?.friction?.value} /></Td>
                <Td>
                  <span
                    className="inline-flex items-center text-[10.5px] font-semibold tracking-wide px-1.5 py-0.5 rounded"
                    style={{ background: state.bg, color: state.fg }}
                  >
                    {state.label}
                  </span>
                </Td>
                <Td>
                  <span className={'text-[11px] ' + (reported ? 'text-[#B91C1C] font-semibold' : 'text-[#94A3B8]')}>
                    {ISSUE_LABEL[r.reported_issue] || '—'}
                  </span>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, align = 'left' }) {
  return (
    <th
      className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#6B7280]"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left', mono = false }) {
  return (
    <td
      className={'px-3 py-3 text-[12px] text-[#374151] ' + (mono ? 'tabular-nums ' : '')}
      style={{ textAlign: align }}
    >
      {children}
    </td>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
