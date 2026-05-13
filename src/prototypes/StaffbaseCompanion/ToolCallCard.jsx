import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertCircle, Wrench, Database, AlertTriangle, BookOpen } from 'lucide-react';

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
    invoke: 'Handing off',
  };
  return map[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ToolCallCard({
  name, args, result, status, connector,
  connectorName, connectorColor, degraded, citations,
}) {
  const [open, setOpen] = useState(false);
  let StatusIcon, statusColor, statusLabel;
  if (status === 'running') { StatusIcon = Loader2; statusColor = '#7C3AED'; statusLabel = 'Running'; }
  else if (status === 'error') {
    StatusIcon = AlertCircle;
    statusColor = '#B91C1C';
    statusLabel = degraded ? 'Connector degraded' : 'Failed';
  }
  else if (status === 'pending') { StatusIcon = Wrench; statusColor = '#B45309'; statusLabel = 'Awaiting confirmation'; }
  else { StatusIcon = CheckCircle2; statusColor = '#16A34A'; statusLabel = 'Done'; }

  // Prefer the explicitly-passed connector metadata (from Studio); fall back
  // to the legacy hardcoded map for the legacy connector ids.
  const color = connectorColor || (connector ? (CONNECTOR_COLOR[connector] || '#71717A') : '#71717A');
  const connectorLabelText = connectorName || (connector ? (CONNECTOR_LABEL[connector] || connector) : null);
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
        {connectorLabelText && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
            padding: '2px 6px', borderRadius: 6, color: 'white',
            background: color, flexShrink: 0,
            maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {connectorLabelText.toUpperCase()}
          </span>
        )}
        {degraded && (
          <span title="Connector is reporting degraded performance" style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
            padding: '2px 5px', borderRadius: 6,
            color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D',
            flexShrink: 0,
          }}>
            <AlertTriangle size={9} /> DEGRADED
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
      {/* Soft error summary — shown when the tool returned an error, even
          when the card isn't expanded. Gives the user (and reading admin)
          one human sentence so they don't have to expand the raw JSON. */}
      {status === 'error' && !open && (
        <div style={{
          padding: '6px 12px 8px',
          borderTop: '1px solid rgba(0,0,0,0.04)',
          background: 'rgba(254, 242, 242, 0.4)',
          fontSize: 11.5, color: '#7F1D1D',
          display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <AlertCircle size={11} color="#B91C1C" style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{friendlyError(result, degraded)}</span>
        </div>
      )}
      {open && (
        <div style={{ padding: '4px 12px 10px', borderTop: '1px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.015)' }}>
          {status === 'error' && (
            <div style={{
              padding: '6px 8px', marginBottom: 6,
              borderRadius: 6, background: 'rgba(254, 242, 242, 0.7)',
              border: '1px solid rgba(252, 165, 165, 0.5)',
              fontSize: 11.5, color: '#7F1D1D',
            }}>
              {friendlyError(result, degraded)}
            </div>
          )}
          {args && Object.keys(args).length > 0 && (
            <Section title="Arguments" body={JSON.stringify(args, null, 2)} />
          )}
          {result !== undefined && (
            <Section title="Result" body={typeof result === 'string' ? result : JSON.stringify(result, null, 2)} />
          )}
        </div>
      )}
      {citations?.length > 0 && (
        <div style={{
          padding: '4px 12px 8px',
          borderTop: '1px dashed rgba(0,0,0,0.05)',
          background: 'rgba(248, 250, 252, 0.6)',
          display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
        }}>
          <BookOpen size={10} color="#71717A" />
          <span style={{ fontSize: 9, fontWeight: 700, color: '#71717A', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Sources
          </span>
          {citations.map((c, i) => (
            <span key={c.kbId || i} style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 6,
              background: 'white', border: '1px solid rgba(0,0,0,0.06)', color: '#52525B',
            }}>
              {c.name}{c.source ? ` · ${c.source}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Translate a tool-call error result into a one-sentence message a non-engineer
// can read. The orchestrator passes the raw error through, so we pattern-match
// on common shapes: timeouts, HTTP 4xx/5xx, network errors, write-cancel.
function friendlyError(result, degraded) {
  if (!result) return 'The tool didn\'t return a result.';
  if (typeof result === 'string') return result.slice(0, 180);
  if (result.cancelled) return 'You declined to run this action.';
  const raw = String(result.error || result.message || '').toLowerCase();
  if (!raw) return 'The tool returned an unexpected response.';
  if (raw.includes('timeout') || raw.includes('etimedout')) {
    return degraded
      ? 'This connector is responding slowly — the request timed out. Try again, or ask in a different way.'
      : 'The request timed out. Try again in a moment.';
  }
  if (raw.includes('econnrefused') || raw.includes('network') || raw.includes('fetch')) {
    return 'Couldn\'t reach the tool. The service may be down — try again in a few minutes.';
  }
  if (raw.includes('403') || raw.includes('forbidden') || raw.includes('access')) {
    return 'Access denied. You don\'t have permission for this action — check with your admin.';
  }
  if (raw.includes('404') || raw.includes('not found')) {
    return 'That item couldn\'t be found.';
  }
  if (raw.includes('500') || raw.includes('internal')) {
    return 'The connector hit an internal error. The team has been notified — try again later.';
  }
  // Fallback — show the raw error but trimmed.
  return String(result.error || result.message || JSON.stringify(result)).slice(0, 220);
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
