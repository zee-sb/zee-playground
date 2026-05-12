import React, { useEffect, useState } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';

// ── Atlassian / Jira / Confluence brand glyphs (minimal SVGs) ──────────────
// Keep these inline — no logo download, no licensing footgun. They're
// stylised geometric marks in the Atlassian blue, recognisable enough for
// a demo without claiming to be the official logo.

function AtlassianGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="aGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0052CC" />
          <stop offset="100%" stopColor="#2684FF" />
        </linearGradient>
      </defs>
      <path d="M7.5 13L2 22h11.5z" fill="url(#aGrad)" />
      <path d="M11.5 8L22 22H11.5z" fill="#2684FF" />
    </svg>
  );
}

function JiraGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="jGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2684FF" />
          <stop offset="100%" stopColor="#0052CC" />
        </linearGradient>
      </defs>
      <path
        d="M12 1L4 9.5h4.5L12 6V1zm0 11l3.5-3.5H20L12 17V12zm0 11l-3.5-3.5H4L12 12v11z"
        fill="url(#jGrad)"
      />
    </svg>
  );
}

function ConfluenceGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="cGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0052CC" />
          <stop offset="100%" stopColor="#2684FF" />
        </linearGradient>
      </defs>
      <path
        d="M2 18s2-4 6-4 5 3 9 3 5-2 5-2v3s-2 3-6 3-5-3-8-3-6 2-6 2v-2zm0-12s2-4 6-4 5 3 9 3 5-2 5-2v3s-2 3-6 3-5-3-8-3-6 2-6 2V6z"
        fill="url(#cGrad)"
      />
    </svg>
  );
}

// ── Action presentations ──────────────────────────────────────────────────
// Maps each known atlassian write tool to its human-readable shape: which
// product chip to show, what to call the action, and which arg fields to
// render as labelled rows. Everything else lives behind a 'Show payload'
// disclosure for the curious.

const PRODUCTS = {
  jira:       { glyph: JiraGlyph,       name: 'Jira',       color: '#0052CC' },
  confluence: { glyph: ConfluenceGlyph, name: 'Confluence', color: '#0052CC' },
  atlassian:  { glyph: AtlassianGlyph,  name: 'Atlassian',  color: '#0052CC' },
};

const ACTIONS = {
  create_issue: {
    label: 'Create Jira ticket',
    product: 'jira',
    summary: (a) => a.summary || '(untitled)',
    rows: [
      { key: 'summary',     label: 'Title' },
      { key: 'issueType',   label: 'Type' },
      { key: 'labels',      label: 'Labels' },
      { key: 'epicKey',     label: 'Epic' },
      { key: 'projectKey',  label: 'Project' },
      { key: 'assignToMe',  label: 'Assign to me' },
      { key: 'description', label: 'Description', long: true },
    ],
  },
  add_issue_comment: {
    label: 'Comment on Jira issue',
    product: 'jira',
    summary: (a) => a.issueKey ? `On ${a.issueKey}` : 'Comment',
    rows: [
      { key: 'issueKey', label: 'Issue' },
      { key: 'body',     label: 'Comment', long: true },
    ],
  },
  create_page: {
    label: 'Create Confluence page',
    product: 'confluence',
    summary: (a) => a.title || '(untitled)',
    rows: [
      { key: 'title',   label: 'Title' },
      { key: 'spaceId', label: 'Space' },
      { key: 'body',    label: 'Body', long: true },
    ],
  },
  update_page: {
    label: 'Update Confluence page',
    product: 'confluence',
    summary: (a) => a.title || (a.pageId ? `Page ${a.pageId}` : 'Update'),
    rows: [
      { key: 'pageId', label: 'Page' },
      { key: 'title',  label: 'New title' },
      { key: 'body',   label: 'New body', long: true },
    ],
  },
  add_page_comment: {
    label: 'Comment on Confluence page',
    product: 'confluence',
    summary: (a) => a.pageId ? `On page ${a.pageId}` : 'Comment',
    rows: [
      { key: 'pageId', label: 'Page' },
      { key: 'body',   label: 'Comment', long: true },
    ],
  },
};

function actionMeta(toolCall) {
  const name = toolCall?.name || '';
  const action = ACTIONS[name] || {
    label: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Write action',
    product: 'atlassian',
    summary: () => '',
    rows: [],
  };
  const product = PRODUCTS[action.product] || PRODUCTS.atlassian;
  return { action, product };
}

function formatValue(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ── Per-call card ─────────────────────────────────────────────────────────

function ActionCard({ tc }) {
  const { action, product } = actionMeta(tc);
  const Glyph = product.glyph;
  const [showDetails, setShowDetails] = useState(false);
  const args = tc.args || {};

  // Split rows into "main" (shown by default, only those with values) and
  // optional "long" rows (descriptions/bodies) which get a folded-but-visible
  // preview with a 'Read more' affordance.
  const presentRows = action.rows.filter((r) => args[r.key] !== undefined && args[r.key] !== '');

  return (
    <div className="border border-[#E4E4E7] rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-gradient-to-b from-[#F8FAFC] to-white border-b border-[#E4E4E7]">
        <div
          className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0"
          style={{ background: '#E6EFFC' }}
        >
          <Glyph size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: product.color, background: `${product.color}1A` }}
            >
              {product.name}
            </span>
            <span className="text-[11px] text-[#71717A] font-semibold">Write action</span>
          </div>
          <div className="text-[14px] font-bold text-[#18181B] leading-tight truncate mt-0.5">
            {action.label}
          </div>
          {action.summary(args) && (
            <div className="text-[12px] text-[#52525B] truncate mt-0.5">
              {action.summary(args)}
            </div>
          )}
        </div>
      </div>

      {/* Rows */}
      {presentRows.length > 0 && (
        <div className="px-3 py-2.5 space-y-1.5">
          {presentRows.map((row) => {
            const v = args[row.key];
            if (row.long) {
              return (
                <div key={row.key} className="pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] mb-1">
                    {row.label}
                  </div>
                  <div
                    className="text-[12px] text-[#18181B] bg-[#FAFAFA] border border-[#E4E4E7] rounded-md p-2 whitespace-pre-wrap break-words leading-relaxed"
                    style={{ maxHeight: 160, overflow: 'auto' }}
                  >
                    {formatValue(v)}
                  </div>
                </div>
              );
            }
            return (
              <div key={row.key} className="flex items-baseline gap-2 text-[12px]">
                <div className="text-[#71717A] flex-shrink-0 w-20">{row.label}</div>
                <div className="text-[#18181B] flex-1 min-w-0 break-words">{formatValue(v)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disclosure: raw payload */}
      <button
        onClick={() => setShowDetails((s) => !s)}
        className="w-full px-3 py-2 flex items-center gap-1 text-[11px] font-semibold text-[#71717A] hover:bg-[#FAFAFA] border-t border-[#F4F4F5]"
      >
        {showDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {showDetails ? 'Hide technical payload' : 'Show technical payload'}
      </button>
      {showDetails && (
        <pre
          className="text-[10px] bg-[#FAFAFA] border-t border-[#F4F4F5] p-3 overflow-auto whitespace-pre-wrap break-words text-[#52525B] font-mono"
          style={{ maxHeight: 200 }}
        >
{JSON.stringify(args, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Modal shell (bottom sheet) ────────────────────────────────────────────

export default function ConfirmWriteModal({ toolCalls, onConfirm, onCancel, busy }) {
  if (!toolCalls?.length) return null;

  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Use the first tool's product to colour the header chip and CTA, since
  // 99% of the time a single confirm is one tool. (Mixed-product confirms
  // still work — we just pick the first one's brand for accent.)
  const firstMeta = actionMeta(toolCalls[0]);
  const accent = firstMeta.product.color;

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end pointer-events-none">
      <div
        onClick={busy ? undefined : onCancel}
        className="absolute inset-0 bg-black/40 pointer-events-auto transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
      />

      <div
        className="relative bg-white rounded-t-2xl shadow-2xl overflow-hidden pointer-events-auto transition-transform duration-200 ease-out flex flex-col"
        style={{ transform: open ? 'translateY(0)' : 'translateY(100%)', maxHeight: '80%' }}
      >
        <div className="pt-2 pb-1 flex justify-center flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-[#E4E4E7]" />
        </div>

        <div className="px-5 py-3 border-b border-[#E4E4E7] flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">Confirm to run</div>
            <div className="font-bold text-[15px] text-[#18181B] truncate">
              {firstMeta.action.label}
              {toolCalls.length > 1 ? ` + ${toolCalls.length - 1} more` : ''}
            </div>
            <div className="text-[11px] text-[#71717A] mt-0.5 leading-snug">
              Companion will make this change in your real Atlassian instance.
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-full bg-[#F4F4F5] hover:bg-[#E4E4E7] grid place-items-center text-[#52525B] flex-shrink-0"
            disabled={busy}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-3 py-3 space-y-2 overflow-auto flex-1">
          {toolCalls.map((tc) => (
            <ActionCard key={tc.id} tc={tc} />
          ))}
        </div>

        <div className="px-4 py-3 border-t border-[#E4E4E7] flex items-center justify-end gap-2 bg-[#FAFAFA] flex-shrink-0">
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
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: accent }}
          >
            {busy ? 'Running…' : 'Confirm and run'}
          </button>
        </div>
      </div>
    </div>
  );
}
