// Shared styling tokens for chat-rendered cards. Matches AnalyticsChartCard.

export const cardShell = {
  margin: '8px 0',
  padding: 14,
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

export const cardHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 10,
};

export const cardTitle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#0F172A',
};

export const liveBadge = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#00736A',
  background: '#D7F4F0',
  padding: '2px 8px',
  borderRadius: 999,
};

export const sourceLine = {
  marginTop: 10,
  fontSize: 10,
  color: '#94A3B8',
};

export const STAFFBASE_TEAL = '#00C7B2';
export const STAFFBASE_TEAL_DEEP = '#00736A';
export const NEUTRAL_BG = '#F5F5F7';
export const NEUTRAL_BORDER = '#E2E8F0';
export const TEXT_PRIMARY = '#0F172A';
export const TEXT_SECONDARY = '#475569';
export const TEXT_MUTED = '#94A3B8';

export function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarColor(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 35%, 78%)`;
}

export function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

export function timeAgo(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (Number.isNaN(diff)) return '';
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const dd = Math.floor(h / 24);
    if (dd < 30) return `${dd}d ago`;
    return formatDate(iso);
  } catch { return ''; }
}
