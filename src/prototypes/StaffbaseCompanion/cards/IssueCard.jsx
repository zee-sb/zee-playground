import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  formatDate,
} from './cardStyles';

export default function IssueCard({ issue, source }) {
  if (!issue) return null;
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{issue.key}</div>
        <div style={liveBadge}>Jira</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.3 }}>
        {issue.summary || '(no summary)'}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {issue.status ? (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
            background: '#F1F5F9', color: '#475569',
          }}>{issue.status}</span>
        ) : null}
        {issue.priority ? (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
            background: '#FEF3C7', color: '#92400E',
          }}>{issue.priority}</span>
        ) : null}
        {issue.issueType ? (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
            background: '#EDE9FE', color: '#5B21B6',
          }}>{issue.issueType}</span>
        ) : null}
      </div>
      {issue.description ? (
        <div style={{
          marginTop: 10, padding: 10, background: '#F8FAFC', borderRadius: 8,
          fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.55,
          maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap',
        }}>
          {issue.description.slice(0, 1200)}{issue.description.length > 1200 ? '…' : ''}
        </div>
      ) : null}
      <div style={{ marginTop: 12, display: 'flex', gap: 14, fontSize: 12, color: TEXT_MUTED, flexWrap: 'wrap' }}>
        {issue.assignee ? <span>Assignee: <span style={{ color: TEXT_SECONDARY }}>{issue.assignee}</span></span> : null}
        {issue.reporter ? <span>Reporter: <span style={{ color: TEXT_SECONDARY }}>{issue.reporter}</span></span> : null}
        {issue.updated ? <span>Updated {formatDate(issue.updated)}</span> : null}
        {issue.url ? (
          <a href={issue.url} target="_blank" rel="noopener noreferrer"
             style={{ marginLeft: 'auto', color: STAFFBASE_TEAL_DEEP, textDecoration: 'none', fontWeight: 600 }}>
            Open in Jira →
          </a>
        ) : null}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
