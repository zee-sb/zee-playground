import {
  cardShell, cardHeader, cardTitle, liveBadge, sourceLine,
  STAFFBASE_TEAL_DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from './cardStyles';

export default function ProjectList({ title, projects = [], badge, source }) {
  if (!projects.length) {
    return (
      <div style={cardShell}>
        <div style={cardHeader}>
          <div style={cardTitle}>{title || 'Projects'}</div>
          <div style={liveBadge}>{badge || 'Atlassian'}</div>
        </div>
        <div style={{ color: TEXT_MUTED, fontSize: 12, padding: '10px 0' }}>
          Nothing to show.
        </div>
      </div>
    );
  }
  return (
    <div style={cardShell}>
      <div style={cardHeader}>
        <div style={cardTitle}>{title || `Projects (${projects.length})`}</div>
        <div style={liveBadge}>{badge || 'Atlassian'}</div>
      </div>
      <div style={{
        display: 'grid', gap: 6,
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      }}>
        {projects.slice(0, 24).map((p) => (
          <a
            key={p.id || p.key}
            href={p.url || undefined}
            target={p.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            style={{
              padding: '8px 10px', borderRadius: 8,
              border: '1px solid #EEF2F7', background: '#FFFFFF',
              textDecoration: 'none', color: 'inherit',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}
          >
            {p.key ? (
              <div style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: 10, fontWeight: 700, color: STAFFBASE_TEAL_DEEP,
                letterSpacing: '0.04em',
              }}>{p.key}</div>
            ) : null}
            <div style={{
              fontSize: 12.5, fontWeight: 600, color: TEXT_PRIMARY, lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {p.name || p.key}
            </div>
            {p.type ? (
              <div style={{ fontSize: 10, color: TEXT_MUTED }}>{p.type}</div>
            ) : null}
          </a>
        ))}
      </div>
      {source ? <div style={sourceLine}>{source}</div> : null}
    </div>
  );
}
