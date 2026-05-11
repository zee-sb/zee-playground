import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertCircle, Wrench, Database } from 'lucide-react';

const CONNECTOR_COLOR = {
  hr_portal: '#7C3AED',
  it_helpdesk: '#2563EB',
  intranet: '#0EA5E9',
  atlassian: '#0052CC',
};

const CONNECTOR_LABEL = {
  hr_portal: 'HR',
  it_helpdesk: 'IT',
  intranet: 'Intranet',
  atlassian: 'Atlassian',
};

// Friendly verb phrases for common tool names — keeps the trace readable.
function friendlyName(name) {
  if (!name) return '';
  const map = {
    list_spaces: 'Listing spaces',
    list_pages_in_space: 'Listing pages',
    get_page: 'Reading page',
    search_pages: 'Searching pages',
    create_page: 'Creating page',
    update_page: 'Updating page',
    add_page_comment: 'Adding page comment',
    list_projects: 'Listing projects',
    search_issues: 'Searching issues',
    get_issue: 'Reading issue',
    add_issue_comment: 'Adding issue comment',
    list_recent_posts: 'Listing recent posts',
    search_posts: 'Searching posts',
    get_post: 'Reading post',
    list_channels: 'Listing channels',
    search_users: 'Searching users',
    get_user: 'Reading user',
    check_pto_balance: 'Checking PTO balance',
    get_employee: 'Reading employee',
    list_tickets: 'Listing tickets',
  };
  return map[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ToolCallCard({ name, args, result, status, connector }) {
  const [open, setOpen] = useState(false);
  let StatusIcon, statusColor, statusLabel;
  if (status === 'running') { StatusIcon = Loader2; statusColor = '#7C3AED'; statusLabel = 'Running'; }
  else if (status === 'error') { StatusIcon = AlertCircle; statusColor = '#B91C1C'; statusLabel = 'Failed'; }
  else if (status === 'pending') { StatusIcon = Wrench; statusColor = '#B45309'; statusLabel = 'Awaiting confirmation'; }
  else { StatusIcon = CheckCircle2; statusColor = '#16A34A'; statusLabel = 'Done'; }

  const color = connector ? (CONNECTOR_COLOR[connector] || '#71717A') : '#71717A';
  const connectorLabel = connector ? (CONNECTOR_LABEL[connector] || connector) : null;
  const verb = friendlyName(name);

  return (
    <div style={{
      margin: '4px 0',
      border: '1px solid rgba(0,0,0,0.06)',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(10px)',
      fontSize: 12,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', textAlign: 'left',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#18181B',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.025)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {open ? <ChevronDown size={13} color="#9CA3AF" /> : <ChevronRight size={13} color="#9CA3AF" />}
        {connectorLabel && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
            padding: '2px 6px', borderRadius: 6, color: 'white',
            background: color, flexShrink: 0,
          }}>
            {connectorLabel.toUpperCase()}
          </span>
        )}
        <Database size={11} color="#9CA3AF" />
        <span style={{ fontWeight: 600, fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {verb}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: statusColor, fontWeight: 600, fontSize: 11, flexShrink: 0 }}>
          <StatusIcon size={12} style={status === 'running' ? { animation: 'spin 1s linear infinite' } : {}} />
          {statusLabel}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 12px 10px', borderTop: '1px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.015)' }}>
          {args && Object.keys(args).length > 0 && (
            <Section title="Arguments" body={JSON.stringify(args, null, 2)} />
          )}
          {result !== undefined && (
            <Section title="Result" body={typeof result === 'string' ? result : JSON.stringify(result, null, 2)} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, body }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <pre style={{
        margin: 0, fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        background: 'white', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 6,
        padding: '6px 8px', overflow: 'auto', maxHeight: 220, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        color: '#18181B',
      }}>{body}</pre>
    </div>
  );
}
