import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  formatDate,
} from './cardStyles';

const STATUS_TONE = {
  'To Do':        { bg: '#F1F5F9', fg: '#475569' },
  'In Progress':  { bg: '#DBEAFE', fg: '#1D4ED8' },
  'In Review':    { bg: '#FEF3C7', fg: '#92400E' },
  'Done':         { bg: '#DCFCE7', fg: '#166534' },
  'Cancelled':    { bg: '#FEE2E2', fg: '#991B1B' },
};

function statusTone(name) {
  if (!name) return { bg: '#F1F5F9', fg: '#475569' };
  return STATUS_TONE[name] || { bg: '#F1F5F9', fg: '#475569' };
}

export default function IssueList({ title, issues = [], source }) {
  if (!issues.length) {
    return (
      <div style={cardShell}>
        <div style={cardHeader}>
          <div style={cardTitle}>{title || 'Issues'}</div>
          <div style={liveBadge}>Jira</div>
        </div>
        <div style={{ color: TEXT_MUTED, fontSize: 12, padding: '10px 0' }}>
          No matching issues.
        </div>
      </div>
    );
  }
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{title || `Issues (${issues.length})`}</div>
        <div style={liveBadge}>Jira</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {issues.slice(0, 15).map((it) => {
          const tone = statusTone(it.status);
          return (
            <a
              key={it.key}
              href={it.url || undefined}
              target={it.url ? '_blank' : undefined}
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                border: '1px solid #EEF2F7', background: '#FFFFFF',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <span style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: 11, fontWeight: 600, color: STAFFBASE_TEAL_DEEP,
                flexShrink: 0, minWidth: 60,
              }}>
                {it.key}
              </span>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 12.5, color: TEXT_PRIMARY,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {it.summary || '(no summary)'}
              </span>
              {it.status ? (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  padding: '2px 6px', borderRadius: 999,
                  background: tone.bg, color: tone.fg, flexShrink: 0,
                }}>{it.status}</span>
              ) : null}
              {it.assignee ? (
                <span style={{ fontSize: 11, color: TEXT_SECONDARY, flexShrink: 0 }}>
                  {it.assignee}
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
