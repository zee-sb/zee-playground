import React, { useState, useRef, useEffect, useContext, createContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Monitor, Zap, ChevronDown, ChevronRight,
  Send, LogOut, CheckCircle, Loader2, AlertCircle, Wifi,
  Calendar, MapPin, Mail, Clock, Building2, X, FileText, Wrench,
  ThumbsUp, ThumbsDown, Copy, Check, Globe,
  UserPlus, Share2, Bot, Circle, ClipboardList, Camera, RotateCcw, Database,
  Settings, Newspaper, Thermometer, Hash, ShieldOff, Sparkles,
} from 'lucide-react';
import { STRINGS, SUPPORTED_LANGS, LANG_META, t as tBase, loadLang, saveLang } from './i18n';
import { useConfigStore } from '../AIAssistant/useConfigStore';
import { deriveLiveOrchestrator } from '../AIAssistant/configStore';

// ── Language context ─────────────────────────────────────────────────────────
const LangContext = createContext('en');
const useLang = () => useContext(LangContext);
const useT = () => {
  const lang = useLang();
  return (key) => tBase(lang, key);
};

// ── Responsive hook ──────────────────────────────────────────────────────────
// Returns true when the viewport is phone-sized (≤768px). Drives the mobile
// layout switch: full-bleed chat with no phone-mock, no sidebars, and a
// keyboard-aware input bar.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// Mirrors window.visualViewport.height into a state value. iOS Safari does not
// honor `interactive-widget=resizes-content`, so we use this to size the chat
// shell when the soft keyboard is open. Falls back to null on browsers that
// don't expose visualViewport.
function useVisualViewportHeight() {
  const [height, setHeight] = useState(() =>
    typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.height : null
  );
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setHeight(vv.height);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return height;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Default catalog of MCP servers and A2A agents the orchestrator backend supports.
// Each entry is keyed by the literal id the backend recognizes (`/api/orchestrate`
// uses `hr_portal`, `it_helpdesk`, `store_ops_agent`).
//
// At runtime the live registry is intersected with the studio config — only
// servers/agents that are connected AND referenced by an active assistant in
// `configStore` appear in the login screen, sidebar, and routing trace.
const DEFAULT_REGISTRY = [
  {
    id: 'hr_portal', name: 'Acme HR Portal',
    description: 'Employee directory, PTO, policies, org chart',
    domains: ['hr', 'pto', 'employees', 'policies'],
    endpoint: '/api/mcp',
    color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', Icon: Users,
  },
  {
    id: 'it_helpdesk', name: 'IT Helpdesk',
    description: 'Tickets, equipment, software access',
    domains: ['it', 'tickets', 'equipment', 'access'],
    endpoint: '/api/mcp-it',
    color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', Icon: Monitor,
  },
  {
    id: 'intranet', name: 'Acme Intranet',
    description: 'Leadership memos, product launches, team wikis, events, ERG pages, employee spotlights',
    domains: ['intranet', 'news', 'leadership', 'wiki', 'event', 'spotlight', 'erg', 'announcement'],
    endpoint: '/api/mcp-intranet',
    color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD', Icon: Newspaper,
  },
];

const DEFAULT_A2A_AGENTS = [
  {
    id: 'store_ops_agent', name: 'Store Operations Agent',
    description: 'Role-aware shift checklists for Acme store locations',
    domains: ['shift', 'checklist', 'opening', 'closing', 'my tasks'],
    color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', Icon: ClipboardList,
    isA2A: true,
  },
];

// Lookup unions — used by `serverConfig()` to render trace cards / sources.
// These never shrink; only the runtime registry derived from config does.
const REGISTRY = DEFAULT_REGISTRY;
const A2A_AGENTS = DEFAULT_A2A_AGENTS;

const INITIAL_SUGGESTIONS = [
  "What's my PTO balance?",
  "Do I have open IT tickets?",
  "What are the company benefits?",
  "Request access to GitHub",
];

const INITIAL_CHIPS = [
  { label: "PTO balance",        full: "What's my PTO balance?" },
  { label: "Open IT tickets",    full: "Do I have open IT tickets?" },
  { label: "Benefits & perks",   full: "What are the company benefits?" },
  { label: "Remote work policy", full: "What's the remote work policy?" },
  { label: "Request GitHub",     full: "Request access to GitHub" },
  { label: "Who's my manager?",  full: "Who is my manager?" },
  { label: "My opening tasks",   full: "What are my opening tasks for today?" },
];

// Suggestion chips that should open a form instead of sending as text
const FORM_TRIGGER_PHRASES = [
  "submit a time off request",
  "request time off",
  "take time off",
  "book pto",
  "request pto",
];

const TICKET_FORM_TRIGGER_PHRASES = [
  "submit a support ticket",
  "create a ticket",
  "open a ticket",
  "submit a ticket",
  "log a ticket",
  "report an issue",
];

const DEMO_USERS = [
  { email: 'alice@acme.com', name: 'Alice Chen',  storeRole: 'Branch Manager',   location: 'Acme Store — Downtown',        avatar: 'AC', color: '#7C3AED' },
  { email: 'bob@acme.com',   name: 'Bob Smith',   storeRole: 'Line Cook',         location: 'Acme Store — Airport Terminal', avatar: 'BS', color: '#D97706' },
  { email: 'carol@acme.com', name: 'Carol Davis', storeRole: 'Shift Supervisor',  location: 'Acme Store — Downtown',        avatar: 'CD', color: '#2563EB' },
  { email: 'dave@acme.com',  name: 'Dave Wilson', storeRole: 'Cleaning Staff',    location: 'Acme Store — Westfield Mall',  avatar: 'DW', color: '#059669' },
];

const ROLE_SUBTITLES = {
  'Branch Manager':  'I can pull up your shift checklist, check team attendance, and handle store management.',
  'Line Cook':       'I can load your task list, look up food safety policies, and log equipment issues.',
  'Shift Supervisor':'I can fetch your shift checklist, manage team assignments, and prepare handovers.',
  'Cleaning Staff':  'I can load your task list, check cleaning protocols, and submit supply requests.',
};

// ── Chip catalogue (no role/time logic — that lives in pickRoleChips) ────────
// `requires` lists the server ids needed for the chip to be useful. Chips with
// missing capabilities are filtered out before rendering. `kind: 'shift'` is
// the leading A2A chip; phase swaps based on time of day.

const SHIFT_CHIPS = {
  opening:  { label: 'My opening tasks',  full: 'What are my opening tasks for today?',  requires: ['store_ops_agent'], kind: 'shift' },
  midshift: { label: 'Mid-shift tasks',   full: "What's on my mid-shift list?",           requires: ['store_ops_agent'], kind: 'shift' },
  closing:  { label: 'My closing tasks',  full: 'What are my closing tasks for tonight?', requires: ['store_ops_agent'], kind: 'shift' },
};

const COMMON_CHIPS = {
  pto_balance:        { label: 'PTO balance',         full: "What's my PTO balance?",                            requires: ['hr_portal'] },
  open_tickets:       { label: 'Open IT tickets',     full: 'Do I have any open IT tickets?',                    requires: ['it_helpdesk'] },
  food_safety:        { label: 'Food safety policy',  full: "What's the food safety policy?",                    requires: ['hr_portal'] },
  team_attendance:    { label: 'Team attendance',     full: 'Who is on shift today and who is absent?',          requires: ['hr_portal'] },
  team_org:           { label: 'Team org chart',      full: 'Show me the team org chart',                        requires: ['hr_portal'] },
  request_access:     { label: 'Request access',      full: 'Request access to the reporting dashboard',         requires: ['it_helpdesk'] },
  supply_request:     { label: 'Supply request',      full: 'I need to submit a cleaning supplies request',      requires: ['it_helpdesk'] },
  safety_policy:      { label: 'Safety policy',       full: "What's the workplace health and safety policy?",    requires: ['hr_portal'] },
  report_equipment:   { label: 'Report equipment',    full: 'I need to report a fryer equipment issue',          requires: ['it_helpdesk'] },
  // Intranet chips — vary the message per day of week so it doesn't feel canned.
  latest_leadership:  { label: 'Latest leadership',   full: 'Show me the latest leadership post',                requires: ['intranet'] },
  q2_priorities:      { label: 'Q2 priorities',       full: 'What are the Q2 priorities from the CEO?',          requires: ['intranet'] },
  whats_new:          { label: "What's new",          full: "What's new on the company intranet this week?",      requires: ['intranet'] },
  team_wiki:          { label: 'My team wiki',        full: 'Open my team wiki',                                  requires: ['intranet'] },
};

const ROLE_FOLLOWUPS = {
  'Branch Manager':   ['team_attendance', 'pto_balance', 'open_tickets',      'whats_new'],
  'Line Cook':        ['food_safety',     'report_equipment', 'pto_balance',  'latest_leadership'],
  'Shift Supervisor': ['team_org',        'request_access',   'pto_balance',  'whats_new'],
  'Cleaning Staff':   ['safety_policy',   'supply_request',   'pto_balance',  'latest_leadership'],
};

function shiftPhaseFor(now = new Date()) {
  const h = now.getHours();
  if (h >= 18 || h < 5) return 'closing';
  if (h >= 12) return 'midshift';
  return 'opening';
}

// Build the chips for the empty-state launchpad. Combines:
// - role (which followups make sense)
// - time of day (which shift phase chip leads)
// - available capabilities (drop chips routing to nothing)
// - day of week (swap one chip on Mon/Tue mornings)
function pickRoleChips({ role, capabilities, now }) {
  const phase = shiftPhaseFor(now);
  const day = now.getDay();           // 0 Sun … 6 Sat
  const hour = now.getHours();
  const has = (id) => !id || capabilities.has(id);
  const canUse = (chip) => (chip.requires || []).every(has);

  const out = [];
  // 1) leading shift chip — only if Store Ops is connected.
  const shiftChip = SHIFT_CHIPS[phase];
  if (canUse(shiftChip)) out.push(shiftChip);

  // 2) role-specific followups, capability-filtered, deduped.
  const ids = ROLE_FOLLOWUPS[role] || ROLE_FOLLOWUPS['Branch Manager'];
  // Monday/Tuesday morning bias toward leadership news.
  const biased = (day === 1 || day === 2) && hour < 12 ? ['latest_leadership', ...ids] : ids;
  for (const id of biased) {
    const chip = COMMON_CHIPS[id];
    if (chip && canUse(chip) && !out.includes(chip)) out.push(chip);
    if (out.length >= 4) break;
  }
  return out;
}

// Translated display labels for ROLE_CHIPS (full message stays English for reliable intent classification)
const CHIP_LABEL_I18N = {
  en: {
    'My opening tasks': 'My opening tasks', 'Team attendance': 'Team attendance',
    'PTO balance': 'PTO balance', 'Open IT tickets': 'Open IT tickets',
    'Food safety policy': 'Food safety policy', 'Closing checklist': 'Closing checklist',
    'Report equipment': 'Report equipment', 'Team org chart': 'Team org chart',
    'Mid-shift tasks': 'Mid-shift tasks', 'Request access': 'Request access',
    'Safety policy': 'Safety policy', 'Supply request': 'Supply request',
    'My closing tasks': 'My closing tasks',
    'Latest leadership': 'Latest leadership', 'Q2 priorities': 'Q2 priorities',
    "What's new": "What's new", 'My team wiki': 'My team wiki',
  },
  de: {
    'My opening tasks': 'Öffnungsaufgaben', 'Team attendance': 'Teamanwesenheit',
    'PTO balance': 'Urlaubskonto', 'Open IT tickets': 'Offene IT-Tickets',
    'Food safety policy': 'Lebensmittelsicherheit', 'Closing checklist': 'Abschluss-Checkliste',
    'Report equipment': 'Gerät melden', 'Team org chart': 'Organigramm',
    'Mid-shift tasks': 'Mittschicht-Aufgaben', 'Request access': 'Zugang beantragen',
    'Safety policy': 'Sicherheitsrichtlinie', 'Supply request': 'Nachschub beantragen',
  },
  fr: {
    'My opening tasks': "Tâches d'ouverture", 'Team attendance': "Présence équipe",
    'PTO balance': 'Solde congés', 'Open IT tickets': 'Tickets IT ouverts',
    'Food safety policy': 'Sécurité alimentaire', 'Closing checklist': 'Liste de fermeture',
    'Report equipment': 'Signaler équipement', 'Team org chart': 'Organigramme',
    'Mid-shift tasks': 'Tâches mi-service', 'Request access': 'Demander accès',
    'Safety policy': 'Politique sécurité', 'Supply request': 'Demande matériel',
  },
  es: {
    'My opening tasks': 'Tareas de apertura', 'Team attendance': 'Asistencia equipo',
    'PTO balance': 'Saldo vacaciones', 'Open IT tickets': 'Tickets TI abiertos',
    'Food safety policy': 'Política alimentaria', 'Closing checklist': 'Lista de cierre',
    'Report equipment': 'Reportar equipo', 'Team org chart': 'Organigrama',
    'Mid-shift tasks': 'Tareas mitad turno', 'Request access': 'Solicitar acceso',
    'Safety policy': 'Política seguridad', 'Supply request': 'Solicitud suministros',
  },
  it: {
    'My opening tasks': 'Attività di apertura', 'Team attendance': 'Presenze team',
    'PTO balance': 'Saldo ferie', 'Open IT tickets': 'Ticket IT aperti',
    'Food safety policy': 'Sicurezza alimentare', 'Closing checklist': 'Lista di chiusura',
    'Report equipment': 'Segnala attrezzatura', 'Team org chart': 'Organigramma',
    'Mid-shift tasks': 'Attività metà turno', 'Request access': 'Richiedere accesso',
    'Safety policy': 'Politica sicurezza', 'Supply request': 'Richiesta forniture',
  },
  nl: {
    'My opening tasks': 'Openingstaken', 'Team attendance': 'Teamaanwezigheid',
    'PTO balance': 'Verlofsaldo', 'Open IT tickets': 'Open IT-tickets',
    'Food safety policy': 'Voedselveiligheid', 'Closing checklist': 'Afsluitchecklist',
    'Report equipment': 'Apparatuur melden', 'Team org chart': 'Teamorganogram',
    'Mid-shift tasks': 'Middendienst taken', 'Request access': 'Toegang aanvragen',
    'Safety policy': 'Veiligheidsbeleid', 'Supply request': 'Materiaal aanvragen',
  },
  pl: {
    'My opening tasks': 'Zadania otwarcia', 'Team attendance': 'Obecność zespołu',
    'PTO balance': 'Saldo urlopowe', 'Open IT tickets': 'Zgłoszenia IT',
    'Food safety policy': 'Bezpieczeństwo żywności', 'Closing checklist': 'Lista zamknięcia',
    'Report equipment': 'Zgłoś sprzęt', 'Team org chart': 'Schemat org.',
    'Mid-shift tasks': 'Zadania śródzmianowe', 'Request access': 'Wnioskuj o dostęp',
    'Safety policy': 'Polityka bezpieczeństwa', 'Supply request': 'Zamówienie materiałów',
  },
};

const DEPT_COLORS = {
  HR: '#7C3AED', Engineering: '#2563EB', Product: '#059669', Design: '#D97706', default: '#6B7280',
};

function deptColor(dept) { return DEPT_COLORS[dept] || DEPT_COLORS.default; }
function initials(name) { return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase(); }
function serverConfig(serverId) {
  return REGISTRY.find(s => s.id === serverId) ?? { name: serverId, color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' };
}

// ── Rich card components ──────────────────────────────────────────────────────

function EmployeeCard({ emp }) {
  const color = deptColor(emp.department);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
        {initials(emp.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{emp.name}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{emp.title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
          {emp.department && <span style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3 }}><Building2 size={9} color={color} />{emp.department}</span>}
          {emp.location && <span style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={9} />{emp.location}</span>}
          {emp.email && <span style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={9} />{emp.email}</span>}
          {emp.startDate && <span style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} />Since {emp.startDate}</span>}
        </div>
      </div>
    </div>
  );
}

function PtoBalanceCard({ data }) {
  const t = useT();
  const pct = Math.min(100, Math.round((data.ptoBalance / 30) * 100));
  const color = data.ptoBalance >= 15 ? '#059669' : data.ptoBalance >= 7 ? '#D97706' : '#DC2626';
  return (
    <div style={{ padding: '12px 14px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: color + '18', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{data.ptoBalance}</span>
          <span style={{ fontSize: 8, fontWeight: 700, color, textTransform: 'uppercase' }}>{t('days')}</span>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{data.employee}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>{t('available')}</div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9CA3AF', marginBottom: 3 }}>
          <span>0 days</span><span>30 day max</span>
        </div>
        <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.7s ease' }} />
        </div>
      </div>
      {data.note && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>{data.note}</div>}
    </div>
  );
}

function PolicyResultCard({ policy }) {
  const catColors = { Benefits: '#7C3AED', 'Work Arrangements': '#2563EB', Compliance: '#DC2626', default: '#6B7280' };
  const color = catColors[policy.category] || catColors.default;
  return (
    <div style={{ padding: '10px 12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <FileText size={13} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>{policy.title}</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: color + '15', color }}>{policy.category}</span>
          </div>
          {policy.lastUpdated && <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3 }}>Updated {policy.lastUpdated}</div>}
          {policy.excerpt && (
            <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {policy.excerpt.replace(/^#.*\n/, '').replace(/\*\*/g, '').trim()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Intranet article cards ────────────────────────────────────────────────────

const INTRANET_CATEGORY_STYLE = {
  leadership: { color: '#0369A1', bg: '#E0F2FE', label: 'Leadership' },
  product:    { color: '#7C3AED', bg: '#F5F3FF', label: 'Product' },
  team_wiki:  { color: '#059669', bg: '#ECFDF5', label: 'Team Wiki' },
  event:      { color: '#D97706', bg: '#FFFBEB', label: 'Event' },
  erg:        { color: '#DB2777', bg: '#FDF2F8', label: 'Culture' },
  spotlight:  { color: '#EA580C', bg: '#FFF7ED', label: 'Spotlight' },
  default:    { color: '#0EA5E9', bg: '#F0F9FF', label: 'Intranet' },
};

function IntranetArticleCard({ article }) {
  const style = INTRANET_CATEGORY_STYLE[article.category] || INTRANET_CATEGORY_STYLE.default;
  return (
    <div style={{ padding: '10px 12px', background: 'white', border: '1px solid #E5E7EB', borderLeft: `3px solid ${style.color}`, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Newspaper size={13} color={style.color} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>{article.title}</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: style.bg, color: style.color }}>
              {article.categoryLabel || style.label}
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>
            {article.author}{article.authorTitle ? ` · ${article.authorTitle}` : ''} · {article.publishedAt}
          </div>
          {(article.summary || article.excerpt) && (
            <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {(article.summary || article.excerpt).replace(/^#.*\n/, '').replace(/\*\*/g, '').trim()}
            </div>
          )}
          {article.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {article.tags.slice(0, 4).map(tag => (
                <span key={tag} style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: '#F3F4F6', color: '#6B7280' }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DirectReportsCard({ manager, reports }) {
  const t = useT();
  const color = deptColor(manager?.department);
  return (
    <div style={{ padding: '10px 12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid #F3F4F6', marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>{initials(manager?.name)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#111827' }}>{manager?.name}</div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>{manager?.title}</div>
        </div>
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{reports.length} {reports.length !== 1 ? t('reports') : t('report')}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {reports.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#F9FAFB', borderRadius: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: deptColor(r.department), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, flexShrink: 0 }}>{initials(r.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
              <div style={{ fontSize: 9, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
            </div>
          </div>
        ))}
        {reports.length === 0 && <div style={{ fontSize: 11, color: '#9CA3AF', gridColumn: 'span 2' }}>{t('noReports')}</div>}
      </div>
    </div>
  );
}

function RequestConfirmedCard({ data }) {
  const t = useT();
  return (
    <div style={{ padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <CheckCircle size={13} color="#10B981" />
        <span style={{ fontWeight: 700, fontSize: 12, color: '#065F46' }}>{t('timeOffSubmitted')}</span>
        <code style={{ marginLeft: 'auto', fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 8, fontFamily: 'monospace' }}>{data.requestId}</code>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        {[[t('from'), data.startDate], [t('to'), data.endDate], [t('daysCol'), data.daysRequested]].map(([label, val]) => (
          <div key={label} style={{ padding: '6px 8px', background: 'white', border: '1px solid #D1FAE5', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: label === t('daysCol') ? '#10B981' : '#111827', marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#065F46' }}>{data.message}</div>
    </div>
  );
}

// ── IT-specific rich cards ────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  critical: { color: '#DC2626', bg: '#FEF2F2', label: '🔴' },
  high:     { color: '#EA580C', bg: '#FFF7ED', label: '🟠' },
  medium:   { color: '#D97706', bg: '#FFFBEB', label: '🟡' },
  low:      { color: '#2563EB', bg: '#EFF6FF', label: '🔵' },
};
const STATUS_STYLES = {
  open:     { color: '#059669', bg: '#F0FDF4', label: 'Open' },
  resolved: { color: '#6B7280', bg: '#F9FAFB', label: '✅ Resolved' },
  closed:   { color: '#6B7280', bg: '#F9FAFB', label: 'Closed' },
};

function TicketCard({ ticket }) {
  const prio = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.low;
  const status = STATUS_STYLES[ticket.status] || STATUS_STYLES.open;
  return (
    <div style={{ padding: '10px 12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <code style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>{ticket.id}</code>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: status.bg, color: status.color }}>{status.label}</span>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: prio.bg, color: prio.color, marginLeft: 'auto' }}>{prio.label} {ticket.priority}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', marginBottom: 3 }}>{ticket.title}</div>
      {ticket.updates?.length > 0 && (
        <div style={{ fontSize: 10, color: '#6B7280', borderTop: '1px solid #F3F4F6', paddingTop: 5, marginTop: 4 }}>
          {ticket.updates[ticket.updates.length - 1]}
        </div>
      )}
    </div>
  );
}

function TicketListCard({ data }) {
  const t = useT();
  if (!data.tickets?.length) {
    return <div style={{ fontSize: 12, color: '#6B7280', padding: '8px 12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12 }}>{t('noTickets')}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.tickets.map(tk => <TicketCard key={tk.id} ticket={tk} />)}
    </div>
  );
}

function EquipmentCard({ data }) {
  const t = useT();
  return (
    <div style={{ padding: '10px 12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: '#111827', marginBottom: 6 }}>
        {data.employee} — {t('employees')}
      </div>
      {data.equipment?.length === 0 && <div style={{ fontSize: 11, color: '#9CA3AF' }}>No equipment assigned.</div>}
      {data.equipment?.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i > 0 ? '1px solid #F3F4F6' : 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Monitor size={13} color="#2563EB" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{item.type}</div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>{item.model}</div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: item.condition === 'good' ? '#F0FDF4' : '#FFFBEB', color: item.condition === 'good' ? '#059669' : '#D97706' }}>{item.condition}</span>
        </div>
      ))}
    </div>
  );
}

function TicketCreatedCard({ data }) {
  const t = useT();
  const prio = PRIORITY_STYLES[data.priority] || PRIORITY_STYLES.medium;
  return (
    <div style={{ padding: '12px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <CheckCircle size={13} color="#2563EB" />
        <span style={{ fontWeight: 700, fontSize: 12, color: '#1E40AF' }}>{t('ticketCreated')}</span>
        <code style={{ marginLeft: 'auto', fontSize: 10, background: '#DBEAFE', color: '#1E40AF', padding: '1px 6px', borderRadius: 8, fontFamily: 'monospace' }}>{data.ticketId}</code>
      </div>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', marginBottom: 6 }}>{data.title}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: prio.bg, color: prio.color }}>{prio.label} {data.priority}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#F3F4F6', color: '#374151', textTransform: 'capitalize' }}>{data.category}</span>
      </div>
      <div style={{ fontSize: 10, color: '#1E40AF', marginTop: 6 }}>{data.message}</div>
    </div>
  );
}

function SoftwareRequestCard({ data }) {
  const t = useT();
  return (
    <div style={{ padding: '12px 14px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <CheckCircle size={13} color="#7C3AED" />
        <span style={{ fontWeight: 700, fontSize: 12, color: '#5B21B6' }}>{t('accessRequest')}</span>
        <code style={{ marginLeft: 'auto', fontSize: 10, background: '#EDE9FE', color: '#5B21B6', padding: '1px 6px', borderRadius: 8, fontFamily: 'monospace' }}>{data.requestId}</code>
      </div>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', marginBottom: 2 }}>{data.systemName}</div>
      <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>{data.systemDescription}</div>
      <div style={{ fontSize: 10, color: '#5B21B6' }}>{data.message}</div>
    </div>
  );
}

// ── Rich card renderer — maps tool name + result to a card ────────────────────

function RichCards({ toolResults }) {
  if (!toolResults?.length) return null;
  const cards = [];

  for (const { toolName, result } of toolResults) {
    try {
      // HR tools
      if (toolName === 'lookup_employee') {
        const data = typeof result === 'string' ? JSON.parse(result) : result;
        if (Array.isArray(data)) {
          cards.push(...data.map((emp, i) => <EmployeeCard key={`emp-${i}`} emp={emp} />));
        } else if (data?.name) {
          cards.push(<EmployeeCard key="emp" emp={data} />);
        }
      } else if (toolName === 'check_pto_balance' && (typeof result === 'object' ? result : JSON.parse(result))?.ptoBalance !== undefined) {
        const data = typeof result === 'object' ? result : JSON.parse(result);
        cards.push(<PtoBalanceCard key="pto" data={data} />);
      } else if (toolName === 'submit_time_off_request') {
        const data = typeof result === 'object' ? result : JSON.parse(result);
        if (data?.requestId) cards.push(<RequestConfirmedCard key="req" data={data} />);
      } else if (toolName === 'search_policies') {
        const data = typeof result === 'string' ? JSON.parse(result) : result;
        if (Array.isArray(data)) {
          cards.push(...data.map((p, i) => <PolicyResultCard key={`pol-${i}`} policy={p} />));
        }
      } else if (toolName === 'get_direct_reports') {
        const data = typeof result === 'object' ? result : JSON.parse(result);
        if (data?.manager) cards.push(<DirectReportsCard key="dr" manager={data.manager} reports={data.directReports || []} />);
      }
      // IT tools
      else if (toolName === 'create_ticket') {
        const data = typeof result === 'object' ? result : JSON.parse(result);
        if (data?.ticketId) cards.push(<TicketCreatedCard key="ticket-new" data={data} />);
      } else if (toolName === 'get_ticket') {
        const data = typeof result === 'object' ? result : JSON.parse(result);
        if (data?.id) cards.push(<TicketCard key="ticket-detail" ticket={data} />);
      } else if (toolName === 'list_my_tickets') {
        const data = typeof result === 'object' ? result : JSON.parse(result);
        if (data?.tickets) cards.push(<TicketListCard key="ticket-list" data={data} />);
      } else if (toolName === 'lookup_equipment') {
        const data = typeof result === 'object' ? result : JSON.parse(result);
        if (data?.equipment) cards.push(<EquipmentCard key="equip" data={data} />);
      } else if (toolName === 'request_software_access') {
        const data = typeof result === 'object' ? result : JSON.parse(result);
        if (data?.requestId) cards.push(<SoftwareRequestCard key="sar" data={data} />);
      }
      // Intranet tools
      else if (toolName === 'search_articles' || toolName === 'list_recent') {
        const data = typeof result === 'string' ? JSON.parse(result) : result;
        if (Array.isArray(data)) {
          cards.push(...data.slice(0, 4).map((a, i) => <IntranetArticleCard key={`art-${a.id || i}`} article={a} />));
        }
      } else if (toolName === 'get_article') {
        const data = typeof result === 'string' ? JSON.parse(result) : result;
        if (data?.id) cards.push(<IntranetArticleCard key={`art-${data.id}`} article={data} />);
      }
    } catch { /* skip malformed results */ }
  }

  if (!cards.length) return null;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{cards}</div>;
}

// ── Sources badge (replaces inline rich cards) ────────────────────────────────

function SourcesBadge({ toolResults, onOpen }) {
  if (!toolResults?.length) return null;
  // Count distinct result types as "sources"
  const count = toolResults.filter(tr => {
    try { const d = typeof tr.result === 'string' ? JSON.parse(tr.result) : tr.result; return d && Object.keys(d).length > 0; }
    catch { return false; }
  }).length;
  if (!count) return null;
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        marginTop: 6, padding: '4px 10px',
        background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.14)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.07)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
    >
      <Database size={10} color="#7C3AED" />
      <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED' }}>
        {count} {count === 1 ? 'source' : 'sources'}
      </span>
      <ChevronRight size={10} color="#7C3AED" />
    </button>
  );
}

// ── Sources bottom sheet (rendered at phone-frame level) ──────────────────────

function SourcesBottomSheet({ toolResults, onClose, fullScreen = false }) {
  const cards = [];
  for (const tr of (toolResults || [])) {
    try {
      const { toolName, result } = tr;
      const data = typeof result === 'string' ? JSON.parse(result) : result;
      if (toolName === 'lookup_employee') {
        if (Array.isArray(data)) cards.push(...data.map((emp, i) => <EmployeeCard key={`emp-${i}`} emp={emp} />));
        else if (data?.name) cards.push(<EmployeeCard key="emp" emp={data} />);
      } else if (toolName === 'check_pto_balance' && data?.ptoBalance !== undefined) {
        cards.push(<PtoBalanceCard key="pto" data={data} />);
      } else if (toolName === 'submit_time_off_request' && data?.requestId) {
        cards.push(<RequestConfirmedCard key="req" data={data} />);
      } else if (toolName === 'search_policies' && Array.isArray(data)) {
        cards.push(...data.map((p, i) => <PolicyResultCard key={`pol-${i}`} policy={p} />));
      } else if (toolName === 'get_direct_reports' && data?.manager) {
        cards.push(<DirectReportsCard key="dr" manager={data.manager} reports={data.directReports || []} />);
      } else if (toolName === 'create_ticket' && data?.ticketId) {
        cards.push(<TicketCreatedCard key="ticket-new" data={data} />);
      } else if (toolName === 'get_ticket' && data?.id) {
        cards.push(<TicketCard key="ticket-detail" ticket={data} />);
      } else if (toolName === 'list_my_tickets' && data?.tickets) {
        cards.push(<TicketListCard key="ticket-list" data={data} />);
      } else if (toolName === 'lookup_equipment' && data?.equipment) {
        cards.push(<EquipmentCard key="equip" data={data} />);
      } else if (toolName === 'request_software_access' && data?.requestId) {
        cards.push(<SoftwareRequestCard key="sar" data={data} />);
      } else if ((toolName === 'search_articles' || toolName === 'list_recent') && Array.isArray(data)) {
        cards.push(...data.map((a, i) => <IntranetArticleCard key={`art-${a.id || i}`} article={a} />));
      } else if (toolName === 'get_article' && data?.id) {
        cards.push(<IntranetArticleCard key={`art-${data.id}`} article={data} />);
      }
    } catch { /* skip */ }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: fullScreen ? 'fixed' : 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 40,
          borderRadius: fullScreen ? 0 : 40,
        }}
      />
      {/* Sheet */}
      <div style={{
        position: fullScreen ? 'fixed' : 'absolute',
        bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'white',
        borderRadius: fullScreen ? '24px 24px 0 0' : '24px 24px 40px 40px',
        maxHeight: fullScreen ? '85dvh' : '72%',
        paddingBottom: fullScreen ? 'env(safe-area-inset-bottom, 0px)' : 0,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
        animation: 'slideUp 0.22s ease-out',
      }}>
        {/* Handle + header */}
        <div style={{ padding: '10px 16px 8px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: '#E5E7EB', borderRadius: 2, margin: '0 auto 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={13} color="#7C3AED" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                Sources
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 6px', borderRadius: 10 }}>
                {cards.length}
              </span>
            </div>
            <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={14} color="#6B7280" />
            </button>
          </div>
        </div>
        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cards.length > 0 ? cards : (
            <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '24px 0' }}>No source data available</div>
          )}
        </div>
      </div>
    </>
  );
}

// ── PTO request form ──────────────────────────────────────────────────────────

function PtoRequestForm({ onConfirm, onCancel }) {
  const t = useT();
  const today = new Date().toISOString().split('T')[0];
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [reason, setReason] = useState('');

  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const days = start && end && end >= start
    ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1 : 0;

  const isPast = start < today;
  const isInvalidRange = end < start;
  const isValid = start >= today && end >= start;

  const inputStyle = (hasError) => ({
    width: '100%', padding: '7px 10px', border: `1px solid ${hasError ? '#FCA5A5' : '#E5E7EB'}`,
    borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box',
    background: hasError ? '#FEF2F2' : 'white', color: '#111827',
  });

  return (
    <div style={{ padding: '12px 14px', background: 'white', border: '2px solid #DDD6FE', borderRadius: 14, boxShadow: '0 2px 8px rgba(124,58,237,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Calendar size={12} color="#7C3AED" />
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#111827', flex: 1 }}>{t('timeOff')}</span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('startDate')}</label>
          <input type="date" value={start} min={today}
            onChange={e => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }}
            style={inputStyle(isPast)} />
          {isPast && <div style={{ fontSize: 9, color: '#EF4444', marginTop: 2 }}>{t('pastDate')}</div>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('endDate')}</label>
          <input type="date" value={end} min={start}
            onChange={e => setEnd(e.target.value)}
            style={inputStyle(isInvalidRange)} />
          {isInvalidRange && <div style={{ fontSize: 9, color: '#EF4444', marginTop: 2 }}>{t('afterStart')}</div>}
        </div>
      </div>

      {days > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 8 }}>
          <Calendar size={11} color="#7C3AED" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{days} {days !== 1 ? t('daysOff') : t('dayOff')}</span>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{start} → {end}</span>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          {t('reason')} <span style={{ fontWeight: 400, textTransform: 'none' }}>{t('optional')}</span>
        </label>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder={t('reasonPlaceholder')} rows={2}
          style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onConfirm({ start_date: start, end_date: end, reason: reason || undefined })}
          disabled={!isValid}
          style={{
            flex: 1, padding: '8px', background: isValid ? '#7C3AED' : '#E5E7EB', color: isValid ? 'white' : '#9CA3AF',
            border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: isValid ? 'pointer' : 'not-allowed',
          }}>
          {t('submitRequest')}
        </button>
        <button onClick={onCancel} style={{ padding: '8px 12px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

// ── Ticket Form ───────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  { value: 'low',      label: '🔵 Low',      color: '#3B82F6' },
  { value: 'medium',   label: '🟡 Medium',   color: '#D97706' },
  { value: 'high',     label: '🟠 High',     color: '#EA580C' },
  { value: 'critical', label: '🔴 Critical', color: '#DC2626' },
];

const CATEGORY_OPTIONS = [
  { value: 'hardware', label: '🖥️ Hardware' },
  { value: 'software', label: '💻 Software' },
  { value: 'access',   label: '🔑 Access' },
  { value: 'network',  label: '🌐 Network' },
  { value: 'other',    label: '📋 Other' },
];

function TicketForm({ onConfirm, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('software');

  const isValid = title.trim().length >= 3 && description.trim().length >= 10;

  const fieldStyle = {
    width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB',
    borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box',
    color: '#111827', fontFamily: 'inherit',
  };
  const labelStyle = {
    display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
  };

  return (
    <div style={{ padding: '12px 14px', background: 'white', border: '2px solid #BFDBFE', borderRadius: 14, boxShadow: '0 2px 8px rgba(37,99,235,0.10)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wrench size={12} color="#2563EB" />
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#111827', flex: 1 }}>New Support Ticket</span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Short summary of the issue"
          style={fieldStyle}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the problem in detail…"
          rows={3}
          style={{ ...fieldStyle, resize: 'none' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={fieldStyle}>
            {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={fieldStyle}>
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onConfirm({ title: title.trim(), description: description.trim(), priority, category })}
          disabled={!isValid}
          style={{
            flex: 1, padding: '8px', background: isValid ? '#2563EB' : '#E5E7EB',
            color: isValid ? 'white' : '#9CA3AF', border: 'none', borderRadius: 8,
            fontSize: 12, fontWeight: 700, cursor: isValid ? 'pointer' : 'not-allowed',
          }}>
          Submit Ticket
        </button>
        <button onClick={onCancel} style={{ padding: '8px 12px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Suggestion chips ──────────────────────────────────────────────────────────

function SuggestionChips({ items, onSelect, disabled, large }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: large ? 'column' : 'row', flexWrap: large ? undefined : 'wrap', gap: large ? 8 : 6, padding: large ? '4px 0' : '6px 0 4px', alignItems: large ? 'flex-start' : undefined }}>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => !disabled && onSelect(item)}
          disabled={disabled}
          style={{
            padding: large ? '11px 16px' : '6px 13px',
            borderRadius: large ? 100 : 20,
            background: disabled ? '#F4F4F5' : 'white',
            border: `1px solid ${disabled ? '#E4E4E7' : 'rgba(0,0,0,0.1)'}`,
            color: disabled ? '#A1A1AA' : '#111827',
            fontSize: large ? 14 : 12,
            fontWeight: large ? 400 : 500,
            cursor: disabled ? 'default' : 'pointer',
            whiteSpace: 'nowrap', lineHeight: 1.4, transition: 'all 0.15s',
            boxShadow: disabled ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            textAlign: 'left',
          }}
          onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.color = '#7C3AED'; }}}
          onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = '#111827'; }}}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

// ── Feedback buttons ──────────────────────────────────────────────────────────

function FeedbackButtons() {
  const [copied, setCopied] = useState(false);
  const [voted, setVoted] = useState(null);
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
      {[
        { icon: ThumbsUp, key: 'up', active: voted === 'up' },
        { icon: ThumbsDown, key: 'down', active: voted === 'down' },
      ].map(({ icon: Icon, key, active }) => (
        <button key={key} onClick={() => setVoted(v => v === key ? null : key)}
          style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid',
            borderColor: active ? '#7C3AED' : 'rgba(0,0,0,0.1)',
            background: active ? '#F5F3FF' : 'white',
            color: active ? '#7C3AED' : '#9CA3AF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
          <Icon size={13} />
        </button>
      ))}
      <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{
          width: 30, height: 30, borderRadius: 8, border: '1px solid',
          borderColor: copied ? '#059669' : 'rgba(0,0,0,0.1)',
          background: copied ? '#F0FDF4' : 'white',
          color: copied ? '#059669' : '#9CA3AF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

// ── A2A Delegation card (in chat) ─────────────────────────────────────────────

const ROLE_TITLE = { manager: 'Branch Manager', supervisor: 'Shift Supervisor', cook: 'Line Cook', cleaner: 'Cleaning Staff' };
const PHASE_EMOJI = { opening: '🌅', midshift: '☀️', closing: '🌙' };
const PHASE_LABEL = { opening: 'Opening', midshift: 'Mid-Shift', closing: 'Closing' };
const ROLE_COLOR  = { manager: '#7C3AED', supervisor: '#2563EB', cook: '#D97706', cleaner: '#059669' };

function HandoverReceiptCard({ artifact }) {
  const data = artifact?.parts?.[0]?.data;
  if (!data) return null;
  const { user, location, phase, generatedAt, receiptId, message } = data;
  const time = generatedAt ? new Date(generatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  return (
    <div style={{ padding: '12px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <CheckCircle size={14} color="#059669" />
        <span style={{ fontWeight: 700, fontSize: 13, color: '#065F46' }}>
          {PHASE_EMOJI[phase] || '✅'} {PHASE_LABEL[phase] || ''} Shift Handover Submitted
        </span>
        {receiptId && (
          <code style={{ marginLeft: 'auto', fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 8, fontFamily: 'monospace' }}>{receiptId}</code>
        )}
      </div>
      {user && (
        <div style={{ fontSize: 11, color: '#065F46', marginBottom: 6 }}>
          {user.name} · {ROLE_TITLE[user.role] || user.title} · {location}
        </div>
      )}
      {time && (
        <div style={{ fontSize: 10, color: '#047857', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} /> {time}
        </div>
      )}
      {message && (
        <div style={{ fontSize: 11, color: '#065F46', lineHeight: 1.5 }}>{message}</div>
      )}
    </div>
  );
}

// Interactive shift-checklist card. Operations agent emits per-task directives
// (`inputType: check | photo | temp_log | count`); this card renders the right
// control for each row and tracks completion state in the parent message so it
// survives re-renders, persistence, and rehydration. When all critical tasks
// are done the user can submit a shift handover, which posts a synthetic
// follow-up message (handled via onSubmit prop) and locks the card.
function A2ADelegationCard({ artifact, state, onStateChange, onSubmit, disabled }) {
  const data = artifact?.parts?.[0]?.data;
  // State lives in the message (`msg.checklistState`); local hooks just mirror
  // it for fast updates. Hooks stay above the early-return for stable ordering.
  const doneIds = useMemo(() => new Set(state?.doneIds || []), [state]);
  const photoIds = useMemo(() => new Set(state?.photoIds || []), [state]);
  const values = state?.values || {};
  const submitted = !!state?.submitted;

  const update = (patch) => {
    onStateChange?.({
      doneIds: [...doneIds],
      photoIds: [...photoIds],
      values: { ...values },
      submitted,
      ...patch,
    });
  };

  if (!data) return null;
  const { user, location, phase, tasks, summary, directives } = data;
  const roleColor = ROLE_COLOR[user?.role] || '#F59E0B';
  const locked = submitted || disabled;

  const isReady = (t) => {
    if (t.inputType === 'photo') return doneIds.has(t.id) && photoIds.has(t.id);
    if (t.inputType === 'temp_log' || t.inputType === 'count') {
      return doneIds.has(t.id) && values[t.id]?.trim().length > 0;
    }
    return doneIds.has(t.id);
  };

  const completedCount = (tasks || []).filter(isReady).length;
  const total = tasks?.length || 0;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const criticalDone = (tasks || []).filter(t => t.critical).every(isReady);
  const allCritical = (tasks || []).filter(t => t.critical).length;
  const canSubmit = total > 0 && criticalDone && !submitted && !disabled;

  const toggleDone = (t) => {
    if (locked) return;
    const next = new Set(doneIds);
    if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
    update({ doneIds: [...next] });
  };

  const togglePhoto = (t) => {
    if (locked) return;
    const next = new Set(photoIds);
    if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
    update({ photoIds: [...next] });
  };

  const setValue = (taskId, v) => {
    if (locked) return;
    update({ values: { ...values, [taskId]: v } });
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    update({ submitted: true });
    const prompt = directives?.submitPrompt
      || `All ${PHASE_LABEL[phase] || phase} tasks complete — submit shift handover for ${user?.name || 'me'}.`;
    onSubmit?.(prompt);
  };

  const headerColor = criticalDone ? '#059669' : '#92400E';
  const headerBg = criticalDone ? '#ECFDF5' : '#FFFBEB';
  const headerBorder = criticalDone ? '#A7F3D0' : '#FDE68A';

  return (
    <div style={{ padding: '12px 12px', background: headerBg, border: `1px solid ${headerBorder}`, borderRadius: 12, marginTop: 6 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <ClipboardList size={13} color={criticalDone ? '#059669' : '#D97706'} />
        <span style={{ fontWeight: 700, fontSize: 12, color: headerColor, flex: 1 }}>
          {PHASE_EMOJI[phase]} {PHASE_LABEL[phase]} Shift Checklist
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: criticalDone ? '#D1FAE5' : '#FEF3C7', color: headerColor }}>
          {completedCount}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: criticalDone ? '#10B981' : '#F59E0B', borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>

      {/* User row */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: roleColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
            {(user.name || '').split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{user.name}</div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>{ROLE_TITLE[user.role] || user.title} · {location}</div>
          </div>
        </div>
      )}

      {/* Interactive task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {(tasks || []).map((t) => {
          const checked = doneIds.has(t.id);
          const ready = isReady(t);
          const baseRow = {
            display: 'flex', flexDirection: 'column', gap: 6,
            padding: '8px 10px',
            background: ready ? 'rgba(16,185,129,0.08)' : 'white',
            border: `1px solid ${ready ? '#A7F3D0' : t.critical ? '#FCA5A5' : '#E5E7EB'}`,
            borderRadius: 10,
          };
          return (
            <div key={t.id} style={baseRow}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <button
                  onClick={() => toggleDone(t)}
                  aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
                  style={{
                    width: 18, height: 18, borderRadius: 5, marginTop: 1,
                    border: `1.5px solid ${checked ? '#10B981' : t.critical ? '#EF4444' : '#9CA3AF'}`,
                    background: checked ? '#10B981' : 'white',
                    cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  {checked && <Check size={11} color="white" />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', textDecoration: ready ? 'line-through' : 'none' }}>
                      {t.title}
                    </span>
                    {t.critical && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#FEE2E2', color: '#991B1B' }}>
                        Required
                      </span>
                    )}
                    {t.inputType === 'photo' && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#F3F4F6', color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Camera size={9} /> Photo
                      </span>
                    )}
                    {t.inputType === 'temp_log' && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#FEF3C7', color: '#92400E', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Thermometer size={9} /> Temp
                      </span>
                    )}
                    {t.inputType === 'count' && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#EDE9FE', color: '#5B21B6', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Hash size={9} /> Count
                      </span>
                    )}
                  </div>
                  {t.desc && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{t.desc}</div>}
                </div>
              </div>

              {/* Per-task input controls (shown when checked) */}
              {checked && t.inputType === 'photo' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 26 }}>
                  <button
                    onClick={() => togglePhoto(t)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 8px', borderRadius: 6,
                      border: `1px solid ${photoIds.has(t.id) ? '#A7F3D0' : '#D1D5DB'}`,
                      background: photoIds.has(t.id) ? '#ECFDF5' : 'white',
                      color: photoIds.has(t.id) ? '#065F46' : '#374151',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {photoIds.has(t.id) ? <Check size={10} /> : <Camera size={10} />}
                    {photoIds.has(t.id) ? 'Photo captured' : 'Capture photo'}
                  </button>
                  {!photoIds.has(t.id) && (
                    <span style={{ fontSize: 9, color: '#9CA3AF' }}>Required to complete</span>
                  )}
                </div>
              )}
              {checked && (t.inputType === 'temp_log' || t.inputType === 'count') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 26 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={values[t.id] || ''}
                    onChange={e => setValue(t.id, e.target.value)}
                    disabled={locked}
                    placeholder={t.inputType === 'temp_log' ? 'e.g. 4' : 'count'}
                    style={{
                      width: 70, padding: '3px 6px', fontSize: 11,
                      border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none',
                      background: locked ? '#F9FAFB' : 'white',
                    }}
                  />
                  <span style={{ fontSize: 10, color: '#6B7280' }}>
                    {t.inputType === 'temp_log' ? '°C' : 'units'}
                  </span>
                  {!values[t.id]?.toString().trim() && (
                    <span style={{ fontSize: 9, color: '#9CA3AF' }}>Required to complete</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary badges */}
      {summary && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#FEF3C7', color: '#92400E' }}>{summary.total} tasks</span>
          {summary.critical > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#FEE2E2', color: '#991B1B' }}>{summary.critical} required</span>}
          {summary.photos > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#F3F4F6', color: '#6B7280' }}>{summary.photos} need photo</span>}
        </div>
      )}

      {/* Submit handover */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 8,
          border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
          background: submitted ? '#D1FAE5' : canSubmit ? 'linear-gradient(135deg, #10B981, #059669)' : '#F3F4F6',
          color: submitted ? '#065F46' : canSubmit ? 'white' : '#9CA3AF',
          fontSize: 12, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        {submitted ? <><Check size={12} /> Handover submitted</>
          : canSubmit ? <><Send size={12} /> {directives?.submitLabel || `Submit ${PHASE_LABEL[phase] || ''} shift report`}</>
          : <>Complete {allCritical} required {allCritical === 1 ? 'task' : 'tasks'} to submit</>}
      </button>
    </div>
  );
}

// ── Compact routing trace (inside phone) ─────────────────────────────────────

function CompactTrace({ trace }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!trace || (!trace.domains?.length && !trace.streaming && !trace.isA2ADelegation && !trace.outOfScope)) return null;

  // Out-of-scope refusal variant — shown when the orchestrator short-circuits.
  if (trace.outOfScope) {
    return (
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px',
            background: 'rgba(243,244,246,0.95)', border: '1px solid #E5E7EB',
            borderRadius: 8, fontSize: 11, color: '#374151',
            width: '100%', textAlign: 'left',
          }}
        >
          <ShieldOff size={10} color="#6B7280" />
          <span style={{ fontWeight: 600, fontSize: 10, color: '#374151', flex: 1 }}>
            Outside enterprise scope
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}>
            Refused
          </span>
        </div>
      </div>
    );
  }

  // A2A delegation variant
  if (trace.isA2ADelegation) {
    const steps = trace.a2aSteps || [];
    const lastStep = steps[steps.length - 1];
    const awaitingInput = trace.streaming && lastStep?.directive?.awaitsInput;
    return (
      <div style={{ marginBottom: 6 }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px',
            background: 'rgba(255,251,235,0.95)', border: '1px solid #FDE68A',
            borderRadius: 8, cursor: 'pointer', fontSize: 11, color: '#78350F',
            width: '100%', textAlign: 'left',
          }}
        >
          {trace.streaming
            ? <Loader2 size={10} color="#F59E0B" style={{ animation: 'spin 1s linear infinite' }} />
            : <Share2 size={10} color="#F59E0B" />}
          <span style={{ fontWeight: 600, fontSize: 10, color: '#78350F', flex: 1 }}>
            {trace.streaming ? `Delegating to ${trace.agentName || 'Store Operations Agent'}…` : `Delegated to ${trace.agentName || 'Store Operations Agent'}`}
          </span>
          {awaitingInput && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#DBEAFE', color: '#1E40AF', border: '1px solid #BFDBFE', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Sparkles size={9} /> awaiting you
            </span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D' }}>A2A</span>
          {!trace.streaming && (open ? <ChevronDown size={10} color="#F59E0B" /> : <ChevronRight size={10} color="#F59E0B" />)}
        </button>
        {open && !trace.streaming && steps.length > 0 && (
          <div style={{ marginTop: 3, padding: '6px 8px', background: 'rgba(255,251,235,0.95)', border: '1px solid #FDE68A', borderRadius: 8 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <CheckCircle size={9} color="#F59E0B" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#374151', flex: 1 }}>{s.label}</span>
                {s.directive?.inputType === 'photo' && <Camera size={9} color="#9CA3AF" />}
                {s.directive?.inputType === 'temp_log' && <Thermometer size={9} color="#D97706" />}
                {s.directive?.inputType === 'count' && <Hash size={9} color="#5B21B6" />}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const serverBadges = trace.domains?.map(id => {
    const s = serverConfig(id);
    return (
      <span key={id} style={{
        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10,
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      }}>{s.name?.split(' ')[0]}</span>
    );
  });

  return (
    <div style={{ marginBottom: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px',
          background: 'rgba(241,245,249,0.9)', border: '1px solid #E2E8F0',
          borderRadius: 8, cursor: 'pointer', fontSize: 11, color: '#64748B',
          width: '100%', textAlign: 'left',
        }}
      >
        {trace.streaming
          ? <Loader2 size={10} color="#F59E0B" style={{ animation: 'spin 1s linear infinite' }} />
          : <Zap size={10} color="#F59E0B" />}
        <span style={{ fontWeight: 600, fontSize: 10, color: '#475569', flex: 1 }}>
          {trace.streaming ? t('routing') : `${t('routedVia')} ${trace.serversQueried?.length ?? 1} ${(trace.serversQueried?.length ?? 1) !== 1 ? t('servers') : t('server')}`}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>{serverBadges}</div>
        {!trace.streaming && (open ? <ChevronDown size={10} color="#94A3B8" /> : <ChevronRight size={10} color="#94A3B8" />)}
      </button>

      {open && !trace.streaming && (
        <div style={{
          marginTop: 3, padding: '6px 8px', background: 'rgba(248,250,252,0.95)',
          border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11,
        }}>
          <div style={{ color: '#64748B', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: '#334155' }}>{t('intent')} </span>{trace.reasoning}
          </div>
          <div style={{ color: '#94A3B8', fontSize: 10, marginBottom: 4 }}>
            {trace.toolCount} {t('toolsLoaded')} {trace.serversQueried?.length ?? 0} {(trace.serversQueried?.length ?? 0) !== 1 ? t('servers') : t('server')}
          </div>
          {trace.toolCalls?.map((tc, i) => {
            const s = serverConfig(tc.serverId);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <CheckCircle size={9} color={s.color} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 3, background: s.bg, color: s.color }}>{s.name?.split(' ')[0]}</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#334155' }}>{tc.toolName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Chat message ──────────────────────────────────────────────────────────────

function ChatMessage({ msg, onSuggestionSelect, onOpenSources, loading, onA2ASubmit, onChecklistStateChange }) {
  const t = useT();
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, paddingLeft: 40 }}>
        <div style={{
          background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
          color: 'white', borderRadius: '18px 18px 4px 18px',
          padding: '10px 14px', fontSize: 14, lineHeight: 1.5,
          boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === 'assistant') {
    return (
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, paddingRight: 32, alignItems: 'flex-start' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #7C3AED, #2563EB)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(124,58,237,0.4)', marginTop: 2,
        }}>
          <Zap size={13} color="white" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {msg.trace && <CompactTrace trace={msg.trace} />}
          {msg.content ? (
            <div style={{
              background: 'white', borderRadius: '4px 18px 18px 18px',
              padding: '10px 14px', fontSize: 13.5, lineHeight: 1.6, color: '#111827',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
          ) : (
            <div style={{
              background: 'white', borderRadius: '4px 18px 18px 18px',
              padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
              display: 'flex', alignItems: 'center', gap: 6, color: '#A1A1AA', fontSize: 13.5,
            }}>
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              <span>{t('thinking')}</span>
            </div>
          )}
          {/* Sources badge — opens bottom sheet */}
          <SourcesBadge toolResults={msg.toolResults} onOpen={() => onOpenSources?.(msg.toolResults)} />
          {/* A2A delegation artifact card */}
          {msg.a2aArtifact && (
            (msg.a2aArtifact?.parts?.[0]?.data?.kind === 'handover_receipt')
              ? <HandoverReceiptCard artifact={msg.a2aArtifact} />
              : <A2ADelegationCard
                  artifact={msg.a2aArtifact}
                  state={msg.checklistState}
                  onStateChange={onChecklistStateChange}
                  onSubmit={onA2ASubmit}
                  disabled={loading}
                />
          )}
          {/* Feedback buttons only on completed messages */}
          {msg.content && !loading && <FeedbackButtons />}
          {msg.suggestions?.length > 0 && (
            <SuggestionChips items={msg.suggestions} onSelect={onSuggestionSelect} disabled={loading} />
          )}
        </div>
      </div>
    );
  }

  // PTO form message type
  if (msg.role === 'pto-form') {
    return (
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, paddingRight: 8, alignItems: 'flex-start' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #7C3AED, #2563EB)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: 2,
        }}>
          <Calendar size={13} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PtoRequestForm
            onConfirm={msg.onConfirm}
            onCancel={msg.onCancel}
          />
        </div>
      </div>
    );
  }

  // Ticket form message type
  if (msg.role === 'ticket-form') {
    return (
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, paddingRight: 8, alignItems: 'flex-start' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #2563EB, #0EA5E9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: 2,
        }}>
          <Wrench size={13} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TicketForm
            onConfirm={msg.onConfirm}
            onCancel={msg.onCancel}
          />
        </div>
      </div>
    );
  }

  return null;
}

// ── Phone frame ───────────────────────────────────────────────────────────────

function PhoneFrame({ children }) {
  return (
    <div style={{ position: 'relative', width: 390, flexShrink: 0 }}>
      {[100, 148].map(top => (
        <div key={top} style={{ position: 'absolute', left: -4, top, width: 4, height: 30, background: '#2A2A2E', borderRadius: '2px 0 0 2px' }} />
      ))}
      <div style={{ position: 'absolute', right: -4, top: 120, width: 4, height: 56, background: '#2A2A2E', borderRadius: '0 2px 2px 0' }} />
      <div style={{
        width: 390, height: 760,
        background: 'linear-gradient(160deg, #2C2C2E 0%, #1C1C1E 60%)',
        borderRadius: 52, padding: 13,
        boxShadow: [
          '0 0 0 1px rgba(255,255,255,0.08)', '0 0 0 3px #0A0A0A',
          '0 40px 80px rgba(0,0,0,0.7)', '0 20px 40px rgba(0,0,0,0.5)',
          'inset 0 1px 0 rgba(255,255,255,0.1)',
        ].join(', '),
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 13, left: '50%', transform: 'translateX(-50%)', width: 130, height: 36, background: '#0A0A0A', borderRadius: 20, zIndex: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1A1A1A' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1A1A1A' }} />
        </div>
        <div style={{ width: '100%', height: '100%', background: 'white', borderRadius: 40, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Full-screen purple gradient fixed at the bottom, behind everything */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
            background: 'radial-gradient(ellipse 140% 100% at 50% 110%, #7C3AED 0%, rgba(124,58,237,0.55) 35%, rgba(124,58,237,0.15) 60%, transparent 80%)',
            pointerEvents: 'none', zIndex: 0, borderRadius: '0 0 40px 40px',
          }} />
          {children}
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false }));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })), 10000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ height: 50, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', display: 'flex', alignItems: 'flex-end', padding: '0 22px 8px', flexShrink: 0 }}>
      <span style={{ color: 'white', fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>{time}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 12 }}>
          {[4, 6, 9, 12].map((h, i) => <div key={i} style={{ width: 3, height: h, background: i < 3 ? 'white' : 'rgba(255,255,255,0.4)', borderRadius: 1 }} />)}
        </div>
        <Wifi size={13} color="white" />
        <div style={{ width: 22, height: 11, borderRadius: 3, border: '1.5px solid white', display: 'flex', alignItems: 'center', padding: '1px', position: 'relative' }}>
          <div style={{ width: '75%', height: '100%', background: 'white', borderRadius: 1.5 }} />
          <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 2, height: 5, background: 'white', borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

// ── Language picker ──────────────────────────────────────────────────────────
function LanguagePicker({ lang, onChange, variant = 'dark' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const meta = LANG_META[lang] ?? LANG_META.en;
  const isDark = variant === 'dark';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 20, padding: '4px 10px',
          color: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.9)',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
        <Globe size={11} />
        <span style={{ fontSize: 13, lineHeight: 1 }}>{meta.flag}</span>
        <span>{meta.code.toUpperCase()}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
          background: '#1F1F23', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: 4, minWidth: 160,
          boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
        }}>
          {SUPPORTED_LANGS.map(code => {
            const m = LANG_META[code];
            const active = code === lang;
            return (
              <button key={code}
                onClick={() => { onChange(code); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 10px', borderRadius: 8, border: 'none',
                  background: active ? 'rgba(124,58,237,0.25)' : 'transparent',
                  color: active ? 'white' : 'rgba(255,255,255,0.85)',
                  fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{m.flag}</span>
                <span style={{ flex: 1 }}>{m.native}</span>
                {active && <Check size={11} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AppHeader({ user, onLogout, onClear, hasMessages, lang, onLangChange }) {
  const t = useT();
  const userDemo = DEMO_USERS.find(u => u.email === user?.email) ?? DEMO_USERS[0];
  return (
    <div style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', padding: '8px 18px 14px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)' }}>
          <Zap size={18} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 16, lineHeight: 1.2, letterSpacing: '-0.3px' }}>Navigator</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 500 }}>{t('appSubtitle')}</div>
        </div>
        {hasMessages && (
          <button
            onClick={onClear}
            title="Reset demo (clears chat and saved checklists)"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 10px', height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', flexShrink: 0, color: 'white', fontSize: 11, fontWeight: 600 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          >
            <RotateCcw size={12} color="white" />
            Reset
          </button>
        )}
        <LanguagePicker lang={lang} onChange={onLangChange} />
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 10px', color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: userDemo.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800 }}>{userDemo.avatar}</div>
          {user?.name?.split(' ')[0]}
        </button>
      </div>
    </div>
  );
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onConnect, lang, onLangChange, registry = DEFAULT_REGISTRY, a2aAgents = DEFAULT_A2A_AGENTS }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isMobile = useIsMobile();

  async function connect(email) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mcp-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onConnect(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'center',
      justifyContent: isMobile ? 'flex-start' : 'center',
      padding: isMobile ? 0 : 24,
      position: 'relative',
    }}>
      <div style={{
        position: isMobile ? 'static' : 'absolute',
        top: isMobile ? undefined : 24,
        right: isMobile ? undefined : 24,
        width: isMobile ? '100%' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        padding: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 8px' : 0,
        zIndex: 5,
        flexShrink: 0,
      }}>
        <Link
          to="/prototypes/navigator-studio"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600,
            textDecoration: 'none', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
        >
          <Settings size={13} />
          Open Studio
        </Link>
        <LanguagePicker lang={lang} onChange={onLangChange} />
      </div>
      <div style={isMobile ? {
        width: '100%',
        padding: '8px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)',
      } : {
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: 40, width: '100%', maxWidth: 460, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 16px', background: 'linear-gradient(135deg, #7C3AED, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
            <Zap size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'white', letterSpacing: '-0.5px' }}>{t('loginTitle')}</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 6, fontSize: 14, lineHeight: 1.5 }}>{t('loginSubtitle')}</p>
        </div>

        {/* Connected systems — driven by Studio config */}
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Connected systems</span>
          <Link
            to="/prototypes/navigator-studio"
            style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', textTransform: 'none', letterSpacing: 0, fontSize: 10, fontWeight: 600 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
          >
            Configure →
          </Link>
        </div>
        {registry.length === 0 ? (
          <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 12, padding: '12px 14px', marginBottom: 8, fontSize: 11, color: 'rgba(252,165,165,0.95)', lineHeight: 1.5 }}>
            <strong>No MCP servers wired up.</strong> Open Studio and connect at least one MCP, then assign it to an active assistant.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {registry.map(s => (
              <div key={s.id} style={{ flex: '1 1 calc(50% - 4px)', minWidth: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <s.Icon size={13} color="white" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name.split(' ').slice(0, 2).join(' ')}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>MCP · tool calls</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* A2A Agent cards */}
        {a2aAgents.map(s => (
          <div key={s.id} style={{ background: 'rgba(5,150,105,0.1)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(5,150,105,0.25)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.Icon size={13} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{s.name}</div>
              <div style={{ fontSize: 9, color: '#34D399', fontWeight: 500 }}>A2A · autonomous tasks</div>
            </div>
            <div style={{ fontSize: 10, color: '#FCD34D', background: 'rgba(245,158,11,0.2)', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>Shift procedures</div>
          </div>
        ))}

        {/* User picker */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{t('signInAs')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DEMO_USERS.map(u => (
            <button key={u.email} onClick={() => connect(u.email)} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.15s', textAlign: 'left', width: '100%' }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = `${u.color}22`; e.currentTarget.style.borderColor = `${u.color}55`; }}}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: u.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{u.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{u.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{u.storeRole}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.location}</div>
              </div>
            </button>
          ))}
        </div>
        {error && <div style={{ marginTop: 14, color: '#FCA5A5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={13} /> {error}</div>}
      </div>
    </div>
  );
}

// ── Session persistence (per-user chat history + checklist state) ────────────
// Stored in localStorage so the demo survives reloads. We strip transient bits
// (form-message callback fns, sources sheet) and only persist the role-safe
// data on each message. Rehydrated on connect; cleared by the Reset button.

const SESSION_PREFIX = 'staffbase.navigator.session.';

function sessionKeyFor(emailOrId) {
  return `${SESSION_PREFIX}${(emailOrId || 'anon').toLowerCase()}`;
}

function persistableMessages(messages) {
  return (messages || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role,
      content: m.content,
      trace: m.trace ? { ...m.trace, streaming: false } : undefined,
      suggestions: m.suggestions,
      toolResults: m.toolResults,
      a2aArtifact: m.a2aArtifact,
      checklistState: m.checklistState,
    }));
}

function loadSession(userId) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(sessionKeyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSession(userId, messages) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(sessionKeyFor(userId), JSON.stringify(persistableMessages(messages)));
  } catch { /* quota / serialization */ }
}

function clearSession(userId) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(sessionKeyFor(userId));
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NavigatorOrchestratorStudio() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverTools, setServerTools] = useState({});
  const [lang, setLangState] = useState(() => loadLang());
  const setLang = (l) => { setLangState(l); saveLang(l); };
  const [openSources, setOpenSources] = useState(null); // toolResults array or null
  const isMobile = useIsMobile();
  const visualViewportHeight = useVisualViewportHeight();

  // Persist messages whenever they change (per-user). We don't persist on every
  // streaming delta — only when role is user/assistant — but the simplest
  // correct version is to write on each setMessages call. Tiny payloads.
  useEffect(() => {
    if (user?.email) saveSession(user.email, messages);
  }, [messages, user?.email]);

  // Live registry — what THIS deployment of Navigator is configured to route to.
  // Sourced from the Studio config (localStorage). An MCP only appears here when
  // it's connected AND at least one active assistant references it. Same for A2A.
  // The defaults are the union of "what the backend can serve"; filtering yields
  // "what THIS admin actually wired up".
  const { config } = useConfigStore();
  const { liveRegistry, liveA2AAgents } = useMemo(() => {
    const live = deriveLiveOrchestrator(config);
    const liveMcpIds = new Set(live.mcps.map(m => m.id));
    const liveAgentIds = new Set(live.agents.map(a => a.id));
    return {
      liveRegistry: DEFAULT_REGISTRY.filter(s => liveMcpIds.has(s.id)),
      liveA2AAgents: DEFAULT_A2A_AGENTS.filter(s => liveAgentIds.has(s.id)),
    };
  }, [config]);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function connect(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
    // Rehydrate prior chat history for this user (if any).
    setMessages(loadSession(newUser.email));
    const counts = {};
    // Only query MCPs the studio has actually wired up. If everything's been
    // disabled in Studio, this loop runs zero times and the chat starts toolless.
    await Promise.all(
      liveRegistry.map(async (s) => {
        try {
          const endpoint = s.endpoint || (s.id === 'hr_portal' ? '/api/mcp' : '/api/mcp-it');
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', Authorization: `Bearer ${newToken}` },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
          });
          const text = await res.text();
          for (const line of text.trim().split('\n')) {
            const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
            try { const obj = JSON.parse(jsonStr); if (obj.result?.tools) { counts[s.id] = obj.result.tools.length; break; } } catch { /* skip */ }
          }
        } catch { /* offline */ }
      })
    );
    setServerTools(counts);
  }

  async function sendMessage(text, { skipFormCheck = false } = {}) {
    if (!text.trim() || loading) return;

    // Intercept form trigger phrases — show form instead of sending
    const lower = text.trim().toLowerCase();
    if (!skipFormCheck && FORM_TRIGGER_PHRASES.some(p => lower.includes(p))) {
      showPtoForm();
      return;
    }
    if (!skipFormCheck && TICKET_FORM_TRIGGER_PHRASES.some(p => lower.includes(p))) {
      showTicketForm();
      return;
    }

    const userMsg = { role: 'user', content: text.trim() };
    const newMessages = [...messages.filter(m => m.role !== 'pto-form' && m.role !== 'ticket-form'), userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const assistantIdx = newMessages.length;
    const emptyTrace = { streaming: true, domains: [], reasoning: '', serversQueried: [], toolCount: 0, toolCalls: [] };
    setMessages(prev => [...prev.filter(m => m.role !== 'pto-form' && m.role !== 'ticket-form'), { role: 'assistant', content: '', trace: emptyTrace, suggestions: [], toolResults: [] }]);

    const history = newMessages.map(m => ({ role: m.role, content: m.content }));
    // Recent topics — last few user messages, trimmed. Lets the orchestrator
    // vary follow-up suggestions and avoid recommending things just asked.
    const recentTopics = newMessages
      .filter(m => m.role === 'user')
      .slice(-4, -1)              // exclude the message we're about to send
      .map(m => (m.content || '').trim().slice(0, 80));
    const clientNow = new Date();
    const clientTz = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
      catch { return 'UTC'; }
    })();

    try {
      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          token,
          lang,
          clientTime: clientNow.toISOString(),
          clientTz,
          recentTopics,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentTrace = { ...emptyTrace };
      let fullContent = '';
      let toolResults = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let event;
          try { event = JSON.parse(line); } catch { continue; }

          if (event.type === 'trace_intent') {
            currentTrace = { ...currentTrace, domains: event.domains, reasoning: event.reasoning, inScope: event.inScope !== false };
          } else if (event.type === 'refusal') {
            currentTrace = { ...currentTrace, outOfScope: true, refusalReason: event.reasoning };
          } else if (event.type === 'trace_tools') {
            currentTrace = { ...currentTrace, serversQueried: event.serversQueried, toolCount: event.toolCount };
          } else if (event.type === 'tool_start') {
            currentTrace = { ...currentTrace, toolCalls: [...currentTrace.toolCalls, { serverId: event.serverId, toolName: event.toolName, args: event.args }] };
          } else if (event.type === 'tool_result') {
            toolResults = [...toolResults, { toolName: event.toolName, result: event.result }];
          } else if (event.type === 'delta') {
            fullContent += event.content;
          } else if (event.type === 'a2a_delegate') {
            currentTrace = { ...currentTrace, isA2ADelegation: true, agentId: event.agentId, agentName: event.agentName, taskId: event.taskId, a2aSteps: [] };
          } else if (event.type === 'a2a_update') {
            const newStep = { step: event.step, label: event.label, done: false, directive: event.directive };
            currentTrace = { ...currentTrace, a2aSteps: [...(currentTrace.a2aSteps || []), newStep] };
          } else if (event.type === 'a2a_done') {
            currentTrace = { ...currentTrace, a2aArtifact: event.artifact };
            if (event.summary) fullContent = event.summary;
          } else if (event.type === 'done') {
            currentTrace = { ...currentTrace, streaming: false };
            if (event.cleanContent !== undefined) fullContent = event.cleanContent;
            setMessages(prev => {
              const updated = [...prev];
              updated[assistantIdx] = { role: 'assistant', content: fullContent, trace: { ...currentTrace }, suggestions: event.suggestions || [], toolResults, a2aArtifact: currentTrace.a2aArtifact || null };
              return updated;
            });
            if (event.ticketForm) {
              setTimeout(() => showTicketForm(), 50);
            }
            continue;
          }

          setMessages(prev => {
            const updated = [...prev];
            updated[assistantIdx] = { role: 'assistant', content: fullContent, trace: { ...currentTrace }, suggestions: [], toolResults, a2aArtifact: currentTrace.a2aArtifact || null };
            return updated;
          });
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[assistantIdx] = { role: 'assistant', content: `Something went wrong: ${err.message}`, trace: null, suggestions: [], toolResults: [] };
        return updated;
      });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function showPtoForm() {
    if (messages.some(m => m.role === 'pto-form')) return; // only one at a time
    const formMsg = {
      role: 'pto-form',
      onConfirm: (args) => {
        setMessages(prev => prev.filter(m => m.role !== 'pto-form'));
        const dateStr = `Please submit a time off request from ${args.start_date} to ${args.end_date}${args.reason ? ` for: ${args.reason}` : ''}`;
        sendMessage(dateStr, { skipFormCheck: true });
      },
      onCancel: () => setMessages(prev => prev.filter(m => m.role !== 'pto-form')),
    };
    setMessages(prev => [...prev, formMsg]);
  }

  function showTicketForm() {
    if (messages.some(m => m.role === 'ticket-form')) return;
    const formMsg = {
      role: 'ticket-form',
      onConfirm: (args) => {
        setMessages(prev => prev.filter(m => m.role !== 'ticket-form'));
        const msg = `Submit a support ticket — Title: ${args.title}, Description: ${args.description}, Priority: ${args.priority}, Category: ${args.category}`;
        sendMessage(msg, { skipFormCheck: true });
      },
      onCancel: () => setMessages(prev => prev.filter(m => m.role !== 'ticket-form')),
    };
    setMessages(prev => [...prev, formMsg]);
  }

  function logout() {
    setUser(null); setToken(null); setMessages([]); setServerTools({}); setOpenSources(null);
  }

  function clearMessages() {
    setMessages([]); setInput(''); setOpenSources(null);
  }

  // Reset the demo for the current user — wipes persisted chat + checklist
  // state. Keeps the user signed in so they can immediately try a fresh flow.
  function resetSession() {
    if (user?.email) clearSession(user.email);
    setMessages([]); setInput(''); setOpenSources(null);
  }

  if (!user) return (
    <LangContext.Provider value={lang}>
      <LoginScreen
        onConnect={connect}
        lang={lang}
        onLangChange={setLang}
        registry={liveRegistry}
        a2aAgents={liveA2AAgents}
      />
    </LangContext.Provider>
  );

  const userDemo = DEMO_USERS.find(u => u.email === user.email) ?? DEMO_USERS[0];
  const tt = (key) => tBase(lang, key);

  // The chat shell — header, messages, input, sources sheet — is shared
  // between the desktop phone-mock and the full-bleed mobile layout. We render
  // it once into `chatBody` and place it inside the appropriate wrapper below.
  const chatBody = (
    <>
      <AppHeader user={user} onLogout={logout} onClear={resetSession} hasMessages={messages.length > 0} lang={lang} onLangChange={setLang} />

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', background: 'transparent', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', padding: '12px 12px 0' }}>
        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 16px 12px' }}>
            {/* Hero section */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingBottom: 16 }}>
              {/* Avatar with glow */}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <div style={{ position: 'absolute', inset: -14, background: `radial-gradient(circle, ${userDemo.color}33 0%, transparent 70%)`, borderRadius: '50%' }} />
                <div style={{ width: 58, height: 58, borderRadius: '50%', background: userDemo.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, position: 'relative', boxShadow: `0 6px 24px ${userDemo.color}55` }}>
                  {userDemo.avatar}
                </div>
              </div>
              {/* Name + role + location */}
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
                Hi, {user.name.split(' ')[0]}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: userDemo.color, marginTop: 4, marginBottom: 3 }}>
                {userDemo.storeRole}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={10} />
                {userDemo.location}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.55, maxWidth: 250 }}>
                {ROLE_SUBTITLES[userDemo.storeRole] || tt('appSubtitle')}
              </div>
            </div>

            {/* Role-specific chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                const capabilityIds = new Set([
                  ...liveRegistry.map(s => s.id),
                  ...liveA2AAgents.map(s => s.id),
                ]);
                const chips = pickRoleChips({
                  role: userDemo.storeRole,
                  capabilities: capabilityIds,
                  now: new Date(),
                });
                const labelMap = CHIP_LABEL_I18N[lang] ?? CHIP_LABEL_I18N.en;
                const isShiftFirst = chips[0]?.kind === 'shift';
                const shiftChip = isShiftFirst ? chips[0] : null;
                const rest = isShiftFirst ? chips.slice(1) : chips;
                return (
                  <>{shiftChip && (
                    <button
                      onClick={() => sendMessage(shiftChip.full)}
                      disabled={loading}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 14px', borderRadius: 14,
                        background: 'rgba(245,158,11,0.1)', backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(245,158,11,0.35)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.2)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <ClipboardList size={12} color="white" />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#78350F' }}>{labelMap[shiftChip.label] ?? shiftChip.label}</span>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#D97706', background: 'rgba(245,158,11,0.15)', padding: '2px 7px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', letterSpacing: '0.05em' }}>A2A</span>
                    </button>
                  )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
                      {rest.map((chip, i) => (
                        <button key={i} onClick={() => !loading && sendMessage(chip.full)} disabled={loading}
                          style={{
                            padding: '8px 13px', borderRadius: 20,
                            background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.7)',
                            color: '#111827', fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                            boxShadow: '0 1px 5px rgba(0,0,0,0.07)',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = userDemo.color; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.82)'; e.currentTarget.style.color = '#111827'; }}
                        >
                          {labelMap[chip.label] ?? chip.label}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            msg={msg}
            onSuggestionSelect={sendMessage}
            onOpenSources={setOpenSources}
            loading={loading}
            onA2ASubmit={(prompt) => sendMessage(prompt, { skipFormCheck: true })}
            onChecklistStateChange={(nextState) => setMessages(prev => {
              const updated = [...prev];
              if (updated[i]) updated[i] = { ...updated[i], checklistState: nextState };
              return updated;
            })}
          />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div style={{
        flexShrink: 0, position: 'relative', zIndex: 1,
        padding: isMobile
          ? '8px 12px calc(env(safe-area-inset-bottom, 0px) + 6px)'
          : '8px 12px 4px',
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
          borderRadius: 28, padding: '0 6px 0 18px',
          border: '1px solid rgba(255,255,255,0.7)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          minHeight: 48,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }}}
            onFocus={() => {
              if (!isMobile) return;
              // iOS Safari animates the keyboard in over ~250ms. After it
              // settles, scroll the latest message + input bar back into view
              // — the textarea blur-out will already have moved the layout.
              setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
              }, 280);
            }}
            placeholder={tt('inputPlaceholder')}
            disabled={loading}
            rows={1}
            style={{
              flex: 1, border: 'none', background: 'none', resize: 'none', outline: 'none',
              fontSize: isMobile ? 16 : 14, color: '#111827', lineHeight: 1.5, fontFamily: 'inherit',
              maxHeight: 80, padding: '13px 0', margin: 0, display: 'block',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && !loading ? '#7C3AED' : 'rgba(124,58,237,0.25)',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              boxShadow: input.trim() && !loading ? '0 2px 8px rgba(124,58,237,0.5)' : 'none',
            }}
          >
            {loading
              ? <Loader2 size={15} color="white" style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={15} color="white" />}
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 5, marginBottom: 3, fontWeight: 500 }}>
          {tt('aiDisclaimer')}
        </div>
      </div>

      {/* Sources bottom sheet */}
      {openSources && (
        <SourcesBottomSheet toolResults={openSources} onClose={() => setOpenSources(null)} fullScreen={isMobile} />
      )}
    </>
  );

  // ── Mobile: full-bleed chat, no phone-mock, no sidebars ────────────────────
  if (isMobile) {
    return (
      <LangContext.Provider value={lang}>
        <div style={{
          // visualViewport.height shrinks when the iOS keyboard opens; falling
          // back to 100dvh so Chrome/Android (which honor
          // interactive-widget=resizes-content) get the same behavior.
          height: visualViewportHeight ? `${visualViewportHeight}px` : '100dvh',
          width: '100%',
          position: 'fixed', top: 0, left: 0, right: 0,
          display: 'flex', flexDirection: 'column',
          background: 'white',
          overflow: 'hidden',
          fontFamily: 'inherit',
        }}>
          {/* Same purple ambient gradient that lives inside the desktop phone */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
            background: 'radial-gradient(ellipse 140% 100% at 50% 110%, #7C3AED 0%, rgba(124,58,237,0.55) 35%, rgba(124,58,237,0.15) 60%, transparent 80%)',
            pointerEvents: 'none', zIndex: 0,
          }} />
          {chatBody}
          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          `}</style>
        </div>
      </LangContext.Provider>
    );
  }

  return (
    <LangContext.Provider value={lang}>
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', gap: 28, fontFamily: 'inherit',
    }}>
      {/* ── Left panel ─────────────────────────────────────────────── */}
      <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{tt('mcpNetwork')}</span>
          <Link
            to="/prototypes/navigator-studio"
            style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', textTransform: 'none', letterSpacing: 0, fontSize: 10, fontWeight: 600 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
          >
            Studio →
          </Link>
        </div>
        {liveRegistry.length === 0 && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            No MCPs configured. Wire one up in Studio.
          </div>
        )}
        {liveRegistry.map(s => {
          const active = serverTools[s.id] != null;
          return (
            <div key={s.id} style={{ background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '12px 14px', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: active ? s.color : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: active ? `0 4px 12px ${s.color}50` : 'none', flexShrink: 0, transition: 'all 0.3s' }}>
                  <s.Icon size={15} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>{s.name}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: active ? s.color : 'rgba(255,255,255,0.3)' }}>
                    {active ? `${serverTools[s.id]} ${tt('toolsLabel')} · ${tt('online')}` : tt('offline')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {s.domains.map(d => (
                  <span key={d} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: active ? `${s.color}20` : 'rgba(255,255,255,0.05)', color: active ? s.color : 'rgba(255,255,255,0.25)', border: `1px solid ${active ? `${s.color}40` : 'rgba(255,255,255,0.08)'}` }}>{d}</span>
                ))}
              </div>
            </div>
          );
        })}

        {liveA2AAgents.length > 0 && (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2, marginTop: 6 }}>A2A Agents</div>
        )}
        {liveA2AAgents.map(s => (
          <div key={s.id} style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 14, padding: '12px 14px', transition: 'all 0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${s.color}50`, flexShrink: 0 }}>
                <s.Icon size={15} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>{s.name}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: s.color }}>1 skill · autonomous</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {s.domains.map(d => (
                <span key={d} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}>{d}</span>
              ))}
            </div>
          </div>
        ))}

        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{tt('signedInAs')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: userDemo.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{userDemo.avatar}</div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{user.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{user.storeRole}</div>
            </div>
          </div>
          <button onClick={logout}
            style={{ marginTop: 10, width: '100%', padding: '6px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#FCA5A5'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
          >
            <LogOut size={11} /> {tt('signOut')}
          </button>
        </div>
      </div>

      {/* ── Phone frame ────────────────────────────────────────────── */}
      <PhoneFrame>
        <StatusBar />
        {chatBody}
        {/* Home indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8, position: 'relative', zIndex: 1 }}>
          <div style={{ width: 120, height: 4, background: 'rgba(255,255,255,0.4)', borderRadius: 2 }} />
        </div>
      </PhoneFrame>

      {/* ── Right panel ─────────────────────────────────────────────── */}
      <div style={{ width: 240, flexShrink: 0, alignSelf: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>{tt('howItWorks')}</div>
        {[
          { step: '1', label: tt('step1Label'), desc: tt('step1Desc') },
          { step: '2', label: tt('step2Label'), desc: tt('step2Desc') },
          { step: '3', label: tt('step3Label'), desc: tt('step3Desc') },
          { step: '4', label: tt('step4Label'), desc: tt('step4Desc') },
        ].map(({ step, label, desc }) => (
          <div key={step} style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white', marginTop: 1 }}>{step}</div>
            <div>
              <div style={{ color: 'white', fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{label}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.5 }}>{desc}</div>
            </div>
          </div>
        ))}

        {messages.some(m => m.role === 'assistant' && m.trace?.serversQueried?.length > 0) && (() => {
          const lastTrace = [...messages].reverse().find(m => m.role === 'assistant' && m.trace?.serversQueried?.length > 0)?.trace;
          if (!lastTrace) return null;
          return (
            <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{tt('lastRoute')}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 6, lineHeight: 1.4 }}>{lastTrace.reasoning}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {lastTrace.toolCalls?.map((tc, i) => {
                  const s = serverConfig(tc.serverId);
                  return <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: `${s.color}25`, color: s.color, border: `1px solid ${s.color}40`, fontWeight: 600 }}>{tc.toolName}</span>;
                })}
              </div>
            </div>
          );
        })()}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
    </LangContext.Provider>
  );
}
