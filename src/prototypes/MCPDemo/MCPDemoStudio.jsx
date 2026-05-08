import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Plug, BookOpen, MessageSquare, ChevronRight, Loader2,
  CheckCircle, XCircle, User, Wrench, FileText, Zap, Send, RotateCcw,
  ChevronDown, ChevronUp, AlertCircle, Calendar, MapPin, Mail, Clock,
  Users, Building2, X,
} from 'lucide-react';

// ── Config ────────────────────────────────────────────────────────────────────

const DEMO_USERS = [
  { email: 'alice@acme.com', name: 'Alice Chen', role: 'HR Admin', color: '#7C3AED' },
  { email: 'bob@acme.com', name: 'Bob Smith', role: 'Software Engineer', color: '#2563EB' },
  { email: 'carol@acme.com', name: 'Carol Davis', role: 'Product Manager', color: '#059669' },
  { email: 'dave@acme.com', name: 'Dave Wilson', role: 'UX Designer', color: '#D97706' },
];

const MCP_BASE = '/api/mcp';
const AUTH_BASE = '/api/mcp-auth';
const CHAT_BASE = '/api/chat';

// ── MCP client helpers ────────────────────────────────────────────────────────

let reqId = 1;
function nextId() { return reqId++; }

async function mcpCall(method, params = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2025-03-26',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(MCP_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method, params }),
  });

  const text = await res.text();
  const jsonLine = text.split('\n').find(l => l.startsWith('data: ') || l.startsWith('{'));
  const raw = jsonLine?.startsWith('data: ') ? jsonLine.slice(6) : jsonLine || text;
  return JSON.parse(raw);
}

// ── Dept colors ───────────────────────────────────────────────────────────────

const DEPT_COLORS = {
  HR: '#7C3AED',
  Engineering: '#2563EB',
  Product: '#059669',
  Design: '#D97706',
  default: '#6B7280',
};

function deptColor(dept) { return DEPT_COLORS[dept] || DEPT_COLORS.default; }
function initials(name) { return name.split(' ').map(n => n[0]).join('').toUpperCase(); }

// ── Rich UI Cards ─────────────────────────────────────────────────────────────

function EmployeeCard({ emp }) {
  const color = deptColor(emp.department);
  return (
    <div className="flex items-start gap-3 p-3 bg-white border border-[#E5E7EB] rounded-xl shadow-sm">
      <div className="w-10 h-10 rounded-full grid place-items-center text-white text-sm font-bold shrink-0"
        style={{ background: color }}>
        {initials(emp.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#111827] text-sm">{emp.name}</p>
        <p className="text-xs text-[#6B7280]">{emp.title}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
          <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
            <Building2 size={10} style={{ color }} />{emp.department}
          </span>
          {emp.location && (
            <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
              <MapPin size={10} />{emp.location}
            </span>
          )}
          {emp.email && (
            <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
              <Mail size={10} />{emp.email}
            </span>
          )}
          {emp.startDate && (
            <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
              <Clock size={10} />Since {emp.startDate}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PtoBalanceCard({ data }) {
  const pct = Math.min(100, Math.round((data.ptoBalance / 30) * 100));
  const color = data.ptoBalance >= 15 ? '#059669' : data.ptoBalance >= 7 ? '#D97706' : '#DC2626';
  return (
    <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl grid place-items-center shrink-0"
          style={{ background: color + '18' }}>
          <span className="text-xl font-bold" style={{ color }}>{data.ptoBalance}</span>
          <span className="text-[9px] font-medium" style={{ color }}>DAYS</span>
        </div>
        <div>
          <p className="font-semibold text-[#111827] text-sm">{data.employee}</p>
          <p className="text-xs text-[#6B7280]">Available PTO balance</p>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-[10px] text-[#9CA3AF] mb-1">
          <span>0 days</span>
          <span>30 day max</span>
        </div>
        <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      {data.note && <p className="text-[11px] text-[#9CA3AF]">{data.note}</p>}
    </div>
  );
}

function PolicyResultCard({ policy }) {
  const catColors = {
    Benefits: '#7C3AED', 'Work Arrangements': '#2563EB',
    Compliance: '#DC2626', default: '#6B7280',
  };
  const color = catColors[policy.category] || catColors.default;
  return (
    <div className="p-3 bg-white border border-[#E5E7EB] rounded-xl shadow-sm space-y-1.5">
      <div className="flex items-start gap-2">
        <FileText size={14} className="mt-0.5 shrink-0" style={{ color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-[#111827]">{policy.title}</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: color + '15', color }}>
              {policy.category}
            </span>
          </div>
          {policy.lastUpdated && (
            <p className="text-[11px] text-[#9CA3AF]">Updated {policy.lastUpdated}</p>
          )}
          {policy.excerpt && (
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed line-clamp-3">
              {policy.excerpt.replace(/^#.*\n/, '').replace(/\*\*/g, '').trim()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DirectReportsCard({ manager, reports }) {
  const color = deptColor(manager?.department);
  return (
    <div className="p-3 bg-white border border-[#E5E7EB] rounded-xl shadow-sm space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-[#F3F4F6]">
        <div className="w-7 h-7 rounded-full grid place-items-center text-white text-xs font-bold"
          style={{ background: color }}>
          {initials(manager?.name || '?')}
        </div>
        <div>
          <p className="font-semibold text-xs text-[#111827]">{manager?.name}</p>
          <p className="text-[11px] text-[#6B7280]">{manager?.title}</p>
        </div>
        <span className="ml-auto text-[11px] text-[#9CA3AF]">{reports.length} report{reports.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {reports.map(r => (
          <div key={r.id} className="flex items-center gap-2 p-2 bg-[#F9FAFB] rounded-lg">
            <div className="w-6 h-6 rounded-full grid place-items-center text-white text-[10px] font-bold shrink-0"
              style={{ background: deptColor(r.department) }}>
              {initials(r.name)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[#111827] truncate">{r.name}</p>
              <p className="text-[10px] text-[#9CA3AF] truncate">{r.title}</p>
            </div>
          </div>
        ))}
        {reports.length === 0 && (
          <p className="text-xs text-[#9CA3AF] col-span-2">No direct reports found.</p>
        )}
      </div>
    </div>
  );
}

function RequestConfirmedCard({ data }) {
  return (
    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle size={15} className="text-emerald-500" />
        <span className="font-semibold text-emerald-800 text-sm">Time Off Request Submitted</span>
        <code className="ml-auto text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">
          {data.requestId}
        </code>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-white rounded-lg border border-emerald-100 text-center">
          <p className="text-[10px] text-[#6B7280] font-medium uppercase tracking-wide">From</p>
          <p className="text-xs font-semibold text-[#111827] mt-0.5">{data.startDate}</p>
        </div>
        <div className="p-2 bg-white rounded-lg border border-emerald-100 text-center">
          <p className="text-[10px] text-[#6B7280] font-medium uppercase tracking-wide">To</p>
          <p className="text-xs font-semibold text-[#111827] mt-0.5">{data.endDate}</p>
        </div>
        <div className="p-2 bg-white rounded-lg border border-emerald-100 text-center">
          <p className="text-[10px] text-[#6B7280] font-medium uppercase tracking-wide">Days</p>
          <p className="text-xs font-semibold text-emerald-700 mt-0.5">{data.daysRequested}</p>
        </div>
      </div>
      <p className="text-[11px] text-emerald-700">{data.message}</p>
    </div>
  );
}

// ── PTO Request Form (date picker with validation) ────────────────────────────

function PtoRequestForm({ suggestedArgs, onConfirm, onCancel }) {
  const today = new Date().toISOString().split('T')[0];
  const [start, setStart] = useState(suggestedArgs?.start_date || today);
  const [end, setEnd] = useState(suggestedArgs?.end_date || suggestedArgs?.start_date || today);
  const [reason, setReason] = useState(suggestedArgs?.reason || '');

  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const days = start && end && end >= start
    ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  const isPast = start < today;
  const isInvalidRange = end < start;
  const isValid = start >= today && end >= start;

  return (
    <div className="p-4 bg-white border-2 border-[#7C3AED] border-opacity-40 rounded-xl space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-[#EDE9FE] grid place-items-center">
          <Calendar size={13} className="text-[#7C3AED]" />
        </div>
        <span className="font-semibold text-sm text-[#111827]">Confirm Time Off Request</span>
        <button onClick={onCancel} className="ml-auto text-[#9CA3AF] hover:text-[#374151] transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">
            Start Date
          </label>
          <input type="date" value={start} min={today}
            onChange={e => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }}
            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors focus:border-[#7C3AED] ${isPast ? 'border-red-300 bg-red-50' : 'border-[#E5E7EB]'}`} />
          {isPast && <p className="text-[10px] text-red-500 mt-0.5">Date is in the past</p>}
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">
            End Date
          </label>
          <input type="date" value={end} min={start}
            onChange={e => setEnd(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors focus:border-[#7C3AED] ${isInvalidRange ? 'border-red-300 bg-red-50' : 'border-[#E5E7EB]'}`} />
          {isInvalidRange && <p className="text-[10px] text-red-500 mt-0.5">Must be on or after start</p>}
        </div>
      </div>

      {days > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
          <Calendar size={13} className="text-[#7C3AED]" />
          <span className="text-sm font-medium text-[#374151]">
            {days} day{days !== 1 ? 's' : ''} off
          </span>
          <span className="text-xs text-[#9CA3AF]">{start} → {end}</span>
        </div>
      )}

      <div>
        <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">
          Reason <span className="font-normal normal-case">(optional)</span>
        </label>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Vacation, personal, medical…"
          rows={2}
          className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm resize-none outline-none focus:border-[#7C3AED] transition-colors" />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onConfirm({ start_date: start, end_date: end, reason: reason || undefined })}
          disabled={!isValid}
          className="flex-1 py-2 bg-[#7C3AED] text-white rounded-lg text-sm font-semibold hover:bg-[#6D28D9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Submit Request
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Tool result renderer ──────────────────────────────────────────────────────

function ToolResultRenderer({ toolName, resultText }) {
  const [expanded, setExpanded] = useState(false);

  let richCard = null;
  try {
    const data = JSON.parse(resultText);

    if (toolName === 'lookup_employee' && Array.isArray(data)) {
      richCard = (
        <div className="space-y-2">
          {data.length === 0
            ? <p className="text-xs text-[#9CA3AF] italic">No employees found.</p>
            : data.map(e => <EmployeeCard key={e.id || e.email} emp={e} />)
          }
        </div>
      );
    } else if (toolName === 'check_pto_balance' && data.ptoBalance !== undefined) {
      richCard = <PtoBalanceCard data={data} />;
    } else if (toolName === 'submit_time_off_request' && data.requestId) {
      richCard = <RequestConfirmedCard data={data} />;
    } else if (toolName === 'search_policies' && Array.isArray(data)) {
      richCard = (
        <div className="space-y-2">
          {data.length === 0
            ? <p className="text-xs text-[#9CA3AF] italic">No policies matched.</p>
            : data.map(p => <PolicyResultCard key={p.id} policy={p} />)
          }
        </div>
      );
    } else if (toolName === 'get_direct_reports' && data.manager) {
      richCard = <DirectReportsCard manager={data.manager} reports={data.directReports || []} />;
    }
  } catch {}

  if (!richCard) {
    return (
      <pre className="text-[11px] font-mono text-[#1E3A5F] bg-white/60 rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap">
        {resultText?.length > 400 ? resultText.slice(0, 400) + '…' : resultText}
      </pre>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {richCard}
      <button onClick={() => setExpanded(o => !o)}
        className="flex items-center gap-1 text-[10px] text-[#6B7280] hover:text-[#374151] transition-colors mt-1">
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {expanded ? 'Hide' : 'Show'} raw JSON
      </button>
      {expanded && (
        <pre className="text-[10px] font-mono text-[#374151] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap">
          {resultText}
        </pre>
      )}
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function Badge({ children, color = '#7C3AED' }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: color + '18', color }}>
      {children}
    </span>
  );
}

function JsonViewer({ data }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(data, null, 2);
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] text-[#6B7280] hover:text-[#374151] transition-colors">
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? 'Hide' : 'Show'} raw JSON
      </button>
      {open && (
        <pre className="mt-2 p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-[11px] text-[#374151] overflow-auto max-h-64 font-mono">
          {json}
        </pre>
      )}
    </div>
  );
}

function StatusDot({ ok }) {
  return <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-gray-300'}`} />;
}

// ── Tab: Connect ──────────────────────────────────────────────────────────────

function ConnectTab({ session, onConnect, onDisconnect }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const connect = async (email) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(AUTH_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auth failed');

      const init = await mcpCall('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'navigator-demo', version: '1.0.0' },
      }, data.token);

      onConnect({ ...data, serverInfo: init.result?.serverInfo });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (session) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-4 p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle size={22} className="text-emerald-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-800">Connected to Acme HR Portal</p>
            <p className="text-sm text-emerald-700 mt-0.5">Authenticated as <strong>{session.user.name}</strong> · {session.user.title}</p>
            {session.serverInfo && (
              <p className="text-xs text-emerald-600 mt-1">{session.serverInfo.name} v{session.serverInfo.version}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
            <p className="text-[11px] text-[#6B7280] font-medium uppercase tracking-wide mb-1">Role</p>
            <p className="font-semibold text-[#111827]">{session.user.role}</p>
          </div>
          <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
            <p className="text-[11px] text-[#6B7280] font-medium uppercase tracking-wide mb-1">Department</p>
            <p className="font-semibold text-[#111827]">{session.user.department}</p>
          </div>
          <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] col-span-2">
            <p className="text-[11px] text-[#6B7280] font-medium uppercase tracking-wide mb-1">Bearer Token</p>
            <p className="font-mono text-xs text-[#374151] truncate">{session.token}</p>
          </div>
        </div>

        <button onClick={onDisconnect}
          className="w-full py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151] transition-colors">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-[#111827] mb-1">Simulated SSO Login</h3>
        <p className="text-sm text-[#6B7280]">Pick an Acme Corp employee to authenticate as. The server returns a Bearer token used for all MCP requests.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {DEMO_USERS.map(u => (
          <button key={u.email} onClick={() => connect(u.email)} disabled={loading}
            className="flex items-center gap-3 p-4 bg-white border border-[#E5E7EB] rounded-xl hover:border-[#7C3AED] hover:shadow-sm transition-all text-left disabled:opacity-50">
            <div className="w-9 h-9 rounded-full grid place-items-center text-white text-sm font-bold shrink-0"
              style={{ background: u.color }}>
              {u.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#111827] text-sm">{u.name}</p>
              <p className="text-xs text-[#6B7280]">{u.role} · {u.email}</p>
            </div>
            {loading ? <Loader2 size={16} className="animate-spin text-[#7C3AED]" /> : <ChevronRight size={16} className="text-[#9CA3AF]" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Explorer ─────────────────────────────────────────────────────────────

function ExplorerTab({ session }) {
  const [resources, setResources] = useState(null);
  const [tools, setTools] = useState(null);
  const [prompts, setPrompts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [fetchedContent, setFetchedContent] = useState({});
  const [loading, setLoading] = useState({});
  const token = session?.token;

  const load = useCallback(async (type) => {
    if (!token) return;
    setLoading(l => ({ ...l, [type]: true }));
    try {
      const methodMap = { resources: 'resources/list', tools: 'tools/list', prompts: 'prompts/list' };
      const res = await mcpCall(methodMap[type], {}, token);
      if (type === 'resources') setResources(res.result?.resources || []);
      if (type === 'tools') setTools(res.result?.tools || []);
      if (type === 'prompts') setPrompts(res.result?.prompts || []);
    } finally {
      setLoading(l => ({ ...l, [type]: false }));
    }
  }, [token]);

  useEffect(() => {
    if (token) { load('resources'); load('tools'); load('prompts'); }
  }, [token, load]);

  const fetchResource = async (uri) => {
    if (fetchedContent[uri]) { setSelected({ type: 'resource-content', uri }); return; }
    setLoading(l => ({ ...l, [uri]: true }));
    try {
      const res = await mcpCall('resources/read', { uri }, token);
      setFetchedContent(fc => ({ ...fc, [uri]: res.result?.contents?.[0] || res }));
      setSelected({ type: 'resource-content', uri });
    } finally {
      setLoading(l => ({ ...l, [uri]: false }));
    }
  };

  if (!session) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-center gap-3">
        <Plug size={32} className="text-[#D1D5DB]" />
        <p className="text-sm text-[#6B7280]">Connect to an account first to explore the MCP server.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-64 border-r border-[#E5E7EB] overflow-y-auto shrink-0">
        <div className="p-3 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen size={13} className="text-[#7C3AED]" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#7C3AED]">Resources</span>
            {loading.resources && <Loader2 size={10} className="animate-spin text-[#9CA3AF]" />}
          </div>
          {(resources || []).map(r => (
            <button key={r.uri} onClick={() => fetchResource(r.uri)}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${selected?.uri === r.uri ? 'bg-[#EDE9FE] text-[#7C3AED]' : 'hover:bg-[#F9FAFB] text-[#374151]'}`}>
              <FileText size={11} className="shrink-0" />
              <span className="truncate">{r.name || r.uri.replace('acme://', '')}</span>
              {loading[r.uri] && <Loader2 size={10} className="animate-spin ml-auto" />}
            </button>
          ))}
        </div>

        <div className="p-3 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-1.5 mb-2">
            <Wrench size={13} className="text-[#2563EB]" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#2563EB]">Tools</span>
            {loading.tools && <Loader2 size={10} className="animate-spin text-[#9CA3AF]" />}
          </div>
          {(tools || []).map(t => (
            <button key={t.name} onClick={() => setSelected({ type: 'tool', data: t })}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${selected?.data?.name === t.name ? 'bg-[#EFF6FF] text-[#2563EB]' : 'hover:bg-[#F9FAFB] text-[#374151]'}`}>
              <Zap size={11} className="shrink-0" />
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare size={13} className="text-[#059669]" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#059669]">Prompts</span>
            {loading.prompts && <Loader2 size={10} className="animate-spin text-[#9CA3AF]" />}
          </div>
          {(prompts || []).map(p => (
            <button key={p.name} onClick={() => setSelected({ type: 'prompt', data: p })}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${selected?.data?.name === p.name ? 'bg-[#ECFDF5] text-[#059669]' : 'hover:bg-[#F9FAFB] text-[#374151]'}`}>
              <MessageSquare size={11} className="shrink-0" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!selected && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2">
            <BookOpen size={28} className="text-[#D1D5DB]" />
            <p className="text-sm text-[#6B7280]">Select an item on the left to inspect it.</p>
          </div>
        )}

        {selected?.type === 'resource-content' && fetchedContent[selected.uri] && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-[#7C3AED]" />
              <span className="font-semibold text-sm text-[#111827]">{selected.uri}</span>
              <Badge color="#7C3AED">resource</Badge>
            </div>
            <pre className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-[11px] font-mono overflow-auto max-h-[480px] text-[#374151] whitespace-pre-wrap">
              {fetchedContent[selected.uri].text || JSON.stringify(fetchedContent[selected.uri], null, 2)}
            </pre>
          </div>
        )}

        {selected?.type === 'tool' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-[#2563EB]" />
              <span className="font-semibold text-sm text-[#111827]">{selected.data.name}</span>
              <Badge color="#2563EB">tool</Badge>
            </div>
            <p className="text-sm text-[#4B5563]">{selected.data.description}</p>
            {selected.data.inputSchema && (
              <>
                <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Input Schema</p>
                <pre className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-[11px] font-mono overflow-auto max-h-64 text-[#374151]">
                  {JSON.stringify(selected.data.inputSchema, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}

        {selected?.type === 'prompt' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-[#059669]" />
              <span className="font-semibold text-sm text-[#111827]">{selected.data.name}</span>
              <Badge color="#059669">prompt</Badge>
            </div>
            <p className="text-sm text-[#4B5563]">{selected.data.description}</p>
            {selected.data.arguments?.length > 0 && (
              <>
                <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Arguments</p>
                <div className="space-y-1.5">
                  {selected.data.arguments.map(a => (
                    <div key={a.name} className="flex items-center gap-2 p-2 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] text-xs">
                      <code className="font-mono text-[#7C3AED]">{a.name}</code>
                      {a.required && <Badge color="#DC2626">required</Badge>}
                      <span className="text-[#6B7280]">{a.description}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Chat ─────────────────────────────────────────────────────────────────

function ChatTab({ session }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [tools, setTools] = useState(null);
  const bottomRef = useRef(null);
  const formResolverRef = useRef(null);
  const token = session?.token;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!token || tools) return;
    mcpCall('tools/list', {}, token).then(res => {
      const t = res.result?.tools || [];
      setTools(t.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema || { type: 'object', properties: {} },
        },
      })));
    });
  }, [token, tools]);

  const callMcpTool = async (name, args) => {
    const res = await mcpCall('tools/call', { name, arguments: args }, token);
    const content = res.result?.content;
    if (Array.isArray(content)) return content.map(c => c.text || JSON.stringify(c)).join('\n');
    return JSON.stringify(res.result || res.error);
  };

  // Prompt user for PTO form confirmation; resolves with confirmed args or throws on cancel
  const awaitPtoForm = (args, formId) => new Promise((resolve, reject) => {
    formResolverRef.current = { resolve, reject, formId };
    setMessages(m => [...m, { role: 'pto-form', id: formId, suggestedArgs: args }]);
  });

  const handleFormConfirm = (args) => {
    const { resolve, formId } = formResolverRef.current || {};
    formResolverRef.current = null;
    setMessages(m => m.filter(msg => msg.id !== formId));
    resolve?.(args);
  };

  const handleFormCancel = () => {
    const { reject, formId } = formResolverRef.current || {};
    formResolverRef.current = null;
    setMessages(m => m.filter(msg => msg.id !== formId));
    reject?.(new Error('cancelled'));
  };

  const send = async (userText) => {
    if (!userText.trim() || sending) return;
    setSending(true);

    const userMsg = { role: 'user', content: userText };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');

    try {
      const today = new Date().toISOString().split('T')[0];
      const nextMonday = (() => {
        const d = new Date(); d.setDate(d.getDate() + (8 - d.getDay()) % 7 || 7); return d.toISOString().split('T')[0];
      })();
      const systemMessage = {
        role: 'system',
        content: `You are a helpful HR assistant for Acme Corp with access to HR tools.
Rules:
- Always call tools immediately without asking clarifying questions.
- For time-off requests: interpret relative dates ("next week", "Friday", "tomorrow") and call submit_time_off_request right away with calculated dates. The user will see a confirmation form to review and adjust before anything is submitted, so never ask them to confirm dates first.
- For employee lookups: call lookup_employee immediately with whatever name/dept/role was mentioned.
- For PTO balance checks: call check_pto_balance immediately.
- Today's date: ${today}. Next Monday: ${nextMonday}.
- Authenticated user: ${session?.user?.name} (${session?.user?.title}, ${session?.user?.department}).`,
      };
      let currentMessages = [systemMessage, ...history];
      for (let round = 0; round < 6; round++) {
        const res = await fetch(CHAT_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: currentMessages, tools: tools || [] }),
        });

        if (!res.ok) {
          const err = await res.json();
          setMessages(m => [...m, { role: 'error', content: err.error || 'Request failed' }]);
          break;
        }

        // Parse SSE stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const chunks = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try { chunks.push(JSON.parse(line.slice(6))); } catch {}
            }
          }
        }

        // Reconstruct message from stream chunks
        let fullContent = '';
        const toolCallsMap = {};

        for (const chunk of chunks) {
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) fullContent += delta.content;
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCallsMap[tc.index]) {
                toolCallsMap[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.id) toolCallsMap[tc.index].id = tc.id;
              if (tc.function?.name) toolCallsMap[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) toolCallsMap[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }

        const toolCalls = Object.values(toolCallsMap);

        if (toolCalls.length > 0) {
          const assistantMsg = { role: 'assistant', content: fullContent || null, tool_calls: toolCalls };
          currentMessages = [...currentMessages, assistantMsg];

          for (const tc of toolCalls) {
            let args = {};
            try { args = JSON.parse(tc.function.arguments); } catch {}

            if (tc.function.name === 'submit_time_off_request') {
              // Show interactive date form before executing the tool
              const formId = `form-${tc.id}`;
              try {
                const confirmedArgs = await awaitPtoForm(args, formId);
                args = confirmedArgs;
              } catch {
                // User cancelled the form
                setMessages(m => [...m, {
                  role: 'assistant',
                  content: "No problem — your time off request was cancelled. Let me know if you'd like to try again.",
                }]);
                setSending(false);
                return;
              }
            }

            // Show tool-call bubble
            setMessages(m => [...m, {
              role: 'tool-call',
              toolName: tc.function.name,
              args,
              id: tc.id,
              status: 'running',
            }]);

            const result = await callMcpTool(tc.function.name, args);

            setMessages(m => m.map(msg =>
              msg.id === tc.id ? { ...msg, status: 'done', result } : msg
            ));

            currentMessages = [...currentMessages, {
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            }];
          }
        } else {
          if (fullContent) {
            setMessages(m => [...m, { role: 'assistant', content: fullContent }]);
          }
          break;
        }
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'error', content: e.message }]);
    } finally {
      setSending(false);
    }
  };

  if (!session) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-center gap-3">
        <MessageSquare size={32} className="text-[#D1D5DB]" />
        <p className="text-sm text-[#6B7280]">Connect to an account first to start chatting.</p>
      </div>
    );
  }

  const suggestions = [
    'How much PTO do I have left?',
    'Find engineers on the team',
    'What is the remote work policy?',
    'Who reports to Carol Davis?',
    'I want to take next week off',
    'Search for parental leave info',
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-4 pt-4">
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] grid place-items-center mx-auto mb-2">
                <Zap size={20} className="text-[#7C3AED]" />
              </div>
              <p className="text-sm font-semibold text-[#111827]">Acme HR Assistant</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Powered by OpenAI + MCP tools</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-full text-xs text-[#374151] hover:border-[#7C3AED] hover:text-[#7C3AED] transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === 'user' && (
              <div className="flex justify-end">
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-[#7C3AED] text-white text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            )}

            {msg.role === 'assistant' && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-[#EDE9FE] grid place-items-center shrink-0 mt-0.5">
                  <Zap size={12} className="text-[#7C3AED]" />
                </div>
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-sm bg-white border border-[#E5E7EB] text-sm leading-relaxed text-[#111827] whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            )}

            {msg.role === 'pto-form' && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-[#EDE9FE] grid place-items-center shrink-0 mt-0.5">
                  <Calendar size={12} className="text-[#7C3AED]" />
                </div>
                <div className="flex-1 max-w-[90%]">
                  <PtoRequestForm
                    suggestedArgs={msg.suggestedArgs}
                    onConfirm={handleFormConfirm}
                    onCancel={handleFormCancel}
                  />
                </div>
              </div>
            )}

            {msg.role === 'tool-call' && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-[#EFF6FF] grid place-items-center shrink-0 mt-0.5">
                  <Wrench size={12} className="text-[#2563EB]" />
                </div>
                <div className="flex-1 max-w-[90%] p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs font-mono font-bold text-[#1D4ED8]">{msg.toolName}</code>
                    {msg.status === 'running'
                      ? <Loader2 size={11} className="animate-spin text-[#3B82F6]" />
                      : <CheckCircle size={11} className="text-emerald-500" />
                    }
                  </div>
                  <JsonViewer data={msg.args} />
                  {msg.result && (
                    <div className="mt-2">
                      <ToolResultRenderer toolName={msg.toolName} resultText={msg.result} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {msg.role === 'error' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <XCircle size={14} className="shrink-0" />
                {msg.content}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#E5E7EB] p-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about PTO, policies, employees…"
            rows={1}
            className="flex-1 resize-none px-3 py-2 border border-[#E5E7EB] rounded-xl text-sm outline-none focus:border-[#7C3AED] transition-colors"
            style={{ minHeight: '38px', maxHeight: '120px' }}
          />
          <button onClick={() => send(input)} disabled={sending || !input.trim()}
            className="w-9 h-9 bg-[#7C3AED] rounded-xl grid place-items-center text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-40 shrink-0">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])}
            className="mt-2 flex items-center gap-1 text-[11px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
            <RotateCcw size={10} /> Clear conversation
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MCPDemoStudio({ onBack }) {
  const [tab, setTab] = useState('connect');
  const [session, setSession] = useState(null);

  const tabs = [
    { id: 'connect', label: 'Connect', icon: Plug },
    { id: 'explorer', label: 'Explorer', icon: BookOpen },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <header className="bg-white border-b border-[#E4E4E7] px-6 h-14 flex items-center gap-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#6B7280] hover:text-[#111827] transition-colors text-sm">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="w-px h-5 bg-[#E4E4E7]" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#7C3AED] grid place-items-center">
            <Plug size={13} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-[#111827]">Acme HR Portal — MCP Server Demo</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusDot ok={!!session} />
          <span className="text-xs text-[#6B7280]">{session ? `${session.user.name}` : 'Not connected'}</span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 max-w-5xl mx-auto w-full gap-6 p-6">
        <div className="flex-1 bg-white rounded-2xl border border-[#E4E4E7] shadow-sm flex flex-col overflow-hidden" style={{ minHeight: '600px' }}>
          <div className="flex border-b border-[#E5E7EB] shrink-0">
            {tabs.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${active ? 'border-[#7C3AED] text-[#7C3AED]' : 'border-transparent text-[#6B7280] hover:text-[#374151]'}`}>
                  <Icon size={15} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {tab === 'connect' && <ConnectTab session={session} onConnect={setSession} onDisconnect={() => setSession(null)} />}
            {tab === 'explorer' && <ExplorerTab session={session} />}
            {tab === 'chat' && <ChatTab session={session} />}
          </div>
        </div>

        <div className="w-64 shrink-0 space-y-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-sm p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Server Info</p>
            <div className="space-y-2 text-sm">
              {[['Name', 'acme-hr-portal'], ['Version', '1.0.0'], ['Transport', 'HTTP (stateless)'], ['Protocol', '2025-03-26']].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[#6B7280]">{k}</span>
                  <span className="font-medium text-[#111827]">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-sm p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Capabilities</p>
            <div className="space-y-2">
              {[
                { label: '7 Resources', icon: FileText, color: '#7C3AED' },
                { label: '5 Tools', icon: Zap, color: '#2563EB' },
                { label: '3 Prompts', icon: MessageSquare, color: '#059669' },
                { label: 'Bearer Auth', icon: User, color: '#D97706' },
              ].map(({ label, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-[#374151]">
                  <Icon size={13} style={{ color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-sm p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Endpoints</p>
            <div className="space-y-1.5 text-xs font-mono">
              {[
                { method: 'POST', path: '/api/mcp', color: '#059669' },
                { method: 'GET', path: '/api/mcp', color: '#2563EB' },
                { method: 'POST', path: '/api/mcp-auth', color: '#059669' },
                { method: 'POST', path: '/api/chat', color: '#059669' },
              ].map(({ method, path, color }) => (
                <div key={path + method} className="flex items-center gap-2">
                  <span className="font-bold" style={{ color }}>{method}</span>
                  <span className="text-[#6B7280] truncate">{path}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
