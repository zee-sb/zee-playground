import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Bot, CheckCircle, Loader2, Circle, ChevronDown, ChevronUp,
  Zap, Share2, Shield, Wifi, AlertCircle, ClipboardList, Tag, Code,
  ArrowRight, Camera, MapPin,
} from 'lucide-react';

const A2A_BASE = '/api/a2a';

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ children, color = '#7C3AED', bg }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color, background: bg || color + '18', border: `1px solid ${color}30` }}>
      {children}
    </span>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-[#E4E4E7] rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-[#7C3AED] text-white'
          : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]'
      }`}
    >
      {children}
    </button>
  );
}

// ── Tab 1: Agent Card ─────────────────────────────────────────────────────────

function AgentCardTab({ agentCard, loading, error }) {
  const [jsonOpen, setJsonOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-3 text-[#6B7280]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Fetching Agent Card from /api/a2a…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }
  if (!agentCard) return null;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#F59E0B] grid place-items-center shrink-0">
            <ClipboardList size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-[#111827] text-lg leading-tight">{agentCard.name}</h2>
            <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">{agentCard.description}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge color="#F59E0B">v{agentCard.version}</Badge>
              <Badge color="#2563EB">{agentCard.provider?.organization}</Badge>
              <Badge color="#6B7280">{agentCard.url}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Capabilities */}
        <Card className="p-4">
          <h3 className="font-medium text-[#111827] text-sm mb-3 flex items-center gap-2">
            <Wifi size={14} className="text-[#F59E0B]" />
            Capabilities
          </h3>
          <div className="space-y-2">
            {Object.entries(agentCard.capabilities || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-[#6B7280] capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                <Badge color={v ? '#F59E0B' : '#6B7280'}>{v ? 'yes' : 'no'}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Auth */}
        <Card className="p-4">
          <h3 className="font-medium text-[#111827] text-sm mb-3 flex items-center gap-2">
            <Shield size={14} className="text-[#7C3AED]" />
            Authentication
          </h3>
          <div className="space-y-1">
            {agentCard.authentication?.schemes?.map(s => (
              <Badge key={s} color="#7C3AED">{s}</Badge>
            ))}
          </div>
          <p className="text-xs text-[#9CA3AF] mt-2">Same Bearer token as HR/IT MCP servers</p>
        </Card>
      </div>

      {/* Skills */}
      <div>
        <h3 className="font-medium text-[#111827] text-sm mb-2">Skills ({agentCard.skills?.length})</h3>
        {agentCard.skills?.map(skill => (
          <Card key={skill.id} className="p-4 mb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <ClipboardList size={14} className="text-[#F59E0B]" />
                  <span className="font-medium text-[#111827] text-sm">{skill.name}</span>
                  <Badge color="#F59E0B">{skill.id}</Badge>
                </div>
                <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">{skill.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {skill.tags?.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#F3F4F6] rounded text-[10px] text-[#6B7280]">
                      <Tag size={8} />{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {skill.examples?.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-medium">Example inputs</p>
                {skill.examples.map((ex, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[#374151] bg-[#F9FAFB] px-3 py-2 rounded-lg">
                    <span className="text-[#9CA3AF] shrink-0">"</span>
                    {ex}
                    <span className="text-[#9CA3AF]">"</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Callout */}
      <Card className="p-4 border-[#F59E0B] bg-[#FFFBEB]">
        <p className="text-sm text-[#78350F] leading-relaxed">
          <strong>Unlike MCP's <code className="bg-[#FEF3C7] px-1 py-0.5 rounded text-xs">initialize</code> handshake</strong> which returns a list of tools for an LLM to call, an <strong>Agent Card</strong> describes autonomous capabilities — what tasks this agent <em>owns end-to-end</em>, not which functions it exposes. The caller sends a task; the agent decides how to complete it.
        </p>
      </Card>

      {/* Raw JSON */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setJsonOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          <span className="flex items-center gap-2"><Code size={14} />Raw Agent Card JSON</span>
          {jsonOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {jsonOpen && (
          <pre className="px-4 pb-4 text-[11px] text-[#374151] bg-[#F9FAFB] overflow-x-auto leading-relaxed">
            {JSON.stringify(agentCard, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  );
}

// ── Step visualization ────────────────────────────────────────────────────────

const STEP_LABELS_STATIC = [
  'Loading shift checklist…',
  'Task 1 loaded',
  'Task 2 loaded',
  'Task 3 loaded',
  'Task 4 loaded',
  'Checklist ready',
];

function StepList({ steps, taskState }) {
  return (
    <div className="space-y-2">
      {STEP_LABELS_STATIC.map((staticLabel, idx) => {
        const stepNum = idx + 1;
        const liveStep = steps.find(s => s.step === stepNum);
        const label = liveStep?.label || staticLabel;
        const isDone = liveStep && (taskState === 'done' || steps.some(s => s.step > stepNum));
        const isActive = liveStep && !isDone && taskState === 'running';
        const isPending = !liveStep;

        return (
          <div key={stepNum} className="flex items-center gap-3">
            <div className="shrink-0 w-5 h-5 grid place-items-center">
              {isDone
                ? <CheckCircle size={18} className="text-[#059669]" />
                : isActive
                ? <Loader2 size={16} className="text-[#7C3AED] animate-spin" />
                : <Circle size={16} className="text-[#D1D5DB]" />
              }
            </div>
            <span className={`text-sm transition-colors ${
              isDone ? 'text-[#059669] font-medium' :
              isActive ? 'text-[#111827] font-medium' :
              'text-[#9CA3AF]'
            }`}>
              {isDone && stepNum === 6 ? label : label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Artifact card ─────────────────────────────────────────────────────────────

const PHASE_EMOJI = { opening: '🌅', midshift: '☀️', closing: '🌙' };
const PHASE_LABEL = { opening: 'Opening', midshift: 'Mid-Shift', closing: 'Closing' };
const ROLE_COLOR  = { manager: '#7C3AED', supervisor: '#2563EB', cook: '#D97706', cleaner: '#059669' };

function ArtifactCard({ artifact }) {
  const [expanded, setExpanded] = useState(false);
  const data = artifact?.parts?.[0]?.data;
  if (!data) return null;

  const { user, location, phase, tasks = [], summary } = data;
  const roleColor = ROLE_COLOR[user?.role] || '#6B7280';
  const initials = (user?.name || '?').split(' ').map(n => n[0]).join('').toUpperCase();
  const preview = tasks.slice(0, 4);

  return (
    <Card className="overflow-hidden border-[#F59E0B]">
      <div className="px-4 py-3 bg-[#FFFBEB] border-b border-[#FDE68A] flex items-center gap-2">
        <CheckCircle size={16} className="text-[#F59E0B]" />
        <span className="font-semibold text-[#78350F] text-sm">
          {PHASE_EMOJI[phase] || '📋'} {PHASE_LABEL[phase] || 'Shift'} Checklist Ready
        </span>
      </div>
      <div className="p-4 space-y-3">
        {/* User identity */}
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-bold shrink-0"
              style={{ background: roleColor }}>
              {initials}
            </div>
            <div>
              <p className="font-medium text-[#111827] text-sm">{user.name}</p>
              <p className="text-xs text-[#6B7280] flex items-center gap-1">
                {user.title}
                {location && <><span className="text-[#D1D5DB]">·</span><MapPin size={9} className="text-[#9CA3AF]" />{location}</>}
              </p>
            </div>
          </div>
        )}
        {/* Task preview */}
        {preview.length > 0 && (
          <div className="space-y-1.5">
            {preview.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-[#374151]">
                <Circle size={12} className="text-[#D1D5DB] shrink-0" />
                <span className="flex-1">{t.title}</span>
                {t.photo && <Camera size={10} className="text-[#9CA3AF] shrink-0" />}
                {t.critical && <span className="text-[10px] font-bold text-[#EF4444] bg-[#FEE2E2] px-1.5 py-0.5 rounded">req</span>}
              </div>
            ))}
            {tasks.length > 4 && (
              <p className="text-[11px] text-[#9CA3AF] pl-5">+{tasks.length - 4} more tasks</p>
            )}
          </div>
        )}
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          {summary?.total != null && <Badge color="#F59E0B">{summary.total} tasks</Badge>}
          {summary?.critical > 0 && <Badge color="#EF4444">{summary.critical} required</Badge>}
          {summary?.photos > 0 && <Badge color="#2563EB">{summary.photos} need photo</Badge>}
        </div>
        {/* Expandable JSON */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#374151] transition-colors"
        >
          <Code size={12} />
          {expanded ? 'Hide' : 'Show'} full artifact
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {expanded && (
          <pre className="text-[10px] bg-[#F9FAFB] p-3 rounded-lg overflow-x-auto text-[#374151] leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </Card>
  );
}

// ── Tab 2: Task Runner ────────────────────────────────────────────────────────

const QUICK_FILLS = [
  'What are my opening tasks for today?',
  'Show me my closing checklist',
  "What's on my mid-shift list?",
];

function TaskRunnerTab() {
  const [input, setInput] = useState(QUICK_FILLS[0]);
  const [mode, setMode] = useState('streaming');
  const [taskState, setTaskState] = useState('idle'); // idle | running | done | error
  const [steps, setSteps] = useState([]);
  const [artifact, setArtifact] = useState(null);
  const [error, setError] = useState('');
  const [taskId, setTaskId] = useState('');
  const abortRef = useRef(null);

  const runTask = async () => {
    if (taskState === 'running') return;
    setTaskState('running');
    setSteps([]);
    setArtifact(null);
    setError('');
    const tid = `task-${Date.now()}`;
    setTaskId(tid);

    if (mode === 'streaming') {
      try {
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        const res = await fetch(A2A_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tasks/sendSubscribe',
            params: {
              id: tid,
              message: {
                role: 'user',
                parts: [{ type: 'text', text: input }],
              },
            },
          }),
          signal: ctrl.signal,
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let finalHandled = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() || '';
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              const result = evt.result;
              if (!result) continue;
              const step = result.metadata?.step;
              const label = result.status?.message?.parts?.[0]?.text;
              if (step && label) {
                setSteps(prev => {
                  const existing = prev.find(s => s.step === step);
                  if (existing) return prev.map(s => s.step === step ? { ...s, label } : s);
                  return [...prev, { step, label }];
                });
              }
              if (result.final) {
                finalHandled = true;
                const art = result.artifacts?.[0];
                setArtifact(art || null);
                setTaskState('done');
              }
            } catch { /* skip malformed */ }
          }
        }
        if (!finalHandled) setTaskState('done');
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setTaskState('error');
        }
      }
    } else {
      // Single-shot
      try {
        const res = await fetch(A2A_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tasks/send',
            params: {
              id: tid,
              message: {
                role: 'user',
                parts: [{ type: 'text', text: input }],
              },
            },
          }),
        });
        const json = await res.json();
        const result = json.result;
        if (result?.status?.state === 'completed') {
          setSteps(STEP_LABELS_STATIC.map((label, i) => ({ step: i + 1, label })));
          setArtifact(result.artifacts?.[0]);
          setTaskState('done');
        } else {
          setError(json.error?.message || 'Unknown error');
          setTaskState('error');
        }
      } catch (err) {
        setError(err.message);
        setTaskState('error');
      }
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setTaskState('idle');
    setSteps([]);
    setArtifact(null);
    setError('');
    setTaskId('');
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <Card className="p-4 space-y-3">
        <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide">Task message</label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={2}
          disabled={taskState === 'running'}
          className="w-full text-sm border border-[#E4E4E7] rounded-lg px-3 py-2 text-[#111827] resize-none focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50"
        />
        {/* Quick fills */}
        <div className="flex flex-wrap gap-2">
          {QUICK_FILLS.map((q, i) => (
            <button
              key={i}
              onClick={() => setInput(q)}
              disabled={taskState === 'running'}
              className="text-[11px] px-2.5 py-1 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#78350F] rounded-full transition-colors disabled:opacity-40"
            >
              {q.replace(/^(What are my |Show me my |What's on my )/, '').replace(/ (tasks for today\?|checklist|list\?)$/, '')}
            </button>
          ))}
        </div>
        {/* Mode toggle + Run */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#F3F4F6] rounded-lg p-0.5 text-xs">
            {['streaming', 'single'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={taskState === 'running'}
                className={`px-3 py-1.5 rounded-md transition-colors capitalize ${
                  mode === m ? 'bg-white shadow-sm text-[#111827] font-medium' : 'text-[#6B7280]'
                }`}
              >
                {m === 'streaming' ? 'Streaming SSE' : 'Single-shot'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {taskState !== 'idle' && (
            <button onClick={reset} className="text-xs text-[#6B7280] hover:text-[#374151] underline">
              Reset
            </button>
          )}
          <button
            onClick={runTask}
            disabled={taskState === 'running' || !input.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {taskState === 'running' ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            {taskState === 'running' ? 'Delegating…' : 'Delegate Task'}
          </button>
        </div>
      </Card>

      {/* Task progress */}
      {(taskState === 'running' || taskState === 'done' || taskState === 'error') && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList size={14} className="text-[#F59E0B]" />
              <span className="text-xs font-medium text-[#374151]">Staffbase Onboarding Agent</span>
            </div>
            <div className="flex items-center gap-2">
              {taskId && <span className="text-[10px] text-[#9CA3AF] font-mono">{taskId}</span>}
              <Badge
                color={taskState === 'done' ? '#F59E0B' : taskState === 'error' ? '#DC2626' : '#7C3AED'}
              >
                {taskState === 'running' ? 'working' : taskState === 'error' ? 'failed' : 'completed'}
              </Badge>
            </div>
          </div>
          <StepList steps={steps} taskState={taskState} />
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </Card>
      )}

      {/* Artifact */}
      {artifact && <ArtifactCard artifact={artifact} />}
    </div>
  );
}

// ── Tab 3: Protocol Comparison ────────────────────────────────────────────────

function FlowBox({ children, color = '#7C3AED' }) {
  return (
    <div className="px-3 py-2 rounded-lg text-xs text-center font-medium"
      style={{ background: color + '15', border: `1px solid ${color}40`, color }}>
      {children}
    </div>
  );
}

function Arrow() {
  return <div className="flex justify-center"><ArrowRight size={14} className="text-[#D1D5DB]" /></div>;
}

function ComparisonTab() {
  return (
    <div className="space-y-6">
      {/* Table */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2">
          <div className="px-4 py-3 bg-[#F5F3FF] border-b border-r border-[#E4E4E7]">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-[#7C3AED]" />
              <span className="font-semibold text-[#7C3AED] text-sm">MCP — Tool Exposure</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">Navigator calls each tool individually</p>
          </div>
          <div className="px-4 py-3 bg-[#FFFBEB] border-b border-[#E4E4E7]">
            <div className="flex items-center gap-2">
              <Share2 size={14} className="text-[#F59E0B]" />
              <span className="font-semibold text-[#F59E0B] text-sm">A2A — Task Delegation</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">Navigator delegates to an autonomous agent</p>
          </div>
        </div>
        {[
          ['Loads 17 tools from HR + IT servers', 'Discovers 1 agent with 1 skill'],
          ['LLM decides which tools to call', 'LLM sends a single task message'],
          ['Synchronous per-tool results', 'Streams progressive status updates'],
          ['Navigator orchestrates each step', 'Agent owns its own orchestration'],
          ['Good for: queries, data lookups', 'Good for: complex multi-step workflows'],
          ['Config: tool schemas, namespacing', 'Config: Agent Card at a URL'],
        ].map(([left, right], i) => (
          <div key={i} className={`grid grid-cols-2 ${i < 5 ? 'border-b border-[#F3F4F6]' : ''}`}>
            <div className="px-4 py-2.5 text-sm text-[#374151] border-r border-[#F3F4F6]">{left}</div>
            <div className="px-4 py-2.5 text-sm text-[#374151]">{right}</div>
          </div>
        ))}
      </Card>

      {/* Flow diagrams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-[#7C3AED] uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Zap size={11} />MCP flow
          </h3>
          <div className="space-y-1.5">
            <FlowBox color="#7C3AED">User message</FlowBox>
            <Arrow />
            <FlowBox color="#7C3AED">Navigator LLM (intent → pick tools)</FlowBox>
            <Arrow />
            <FlowBox color="#2563EB">HR: lookup_employee</FlowBox>
            <Arrow />
            <FlowBox color="#2563EB">HR: search_policies</FlowBox>
            <Arrow />
            <FlowBox color="#2563EB">IT: create_ticket</FlowBox>
            <Arrow />
            <FlowBox color="#7C3AED">Navigator LLM (synthesize)</FlowBox>
            <Arrow />
            <FlowBox color="#6B7280">Response</FlowBox>
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-3">4+ round trips · Navigator orchestrates every step</p>
        </Card>

        <Card className="p-4">
          <h3 className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Share2 size={11} />A2A flow
          </h3>
          <div className="space-y-1.5">
            <FlowBox color="#F59E0B">User message</FlowBox>
            <Arrow />
            <FlowBox color="#F59E0B">Navigator LLM (intent → delegate)</FlowBox>
            <Arrow />
            <div className="border border-[#F59E0B]/30 rounded-xl p-3 space-y-1.5 bg-[#FFFBEB]">
              <p className="text-[10px] text-[#D97706] font-semibold uppercase tracking-wide mb-2">Store Ops Agent (autonomous)</p>
              <FlowBox color="#F59E0B">Decode auth token → identify role</FlowBox>
              <Arrow />
              <FlowBox color="#F59E0B">Select tasks for role + phase</FlowBox>
              <Arrow />
              <FlowBox color="#F59E0B">Stream checklist steps</FlowBox>
            </div>
            <Arrow />
            <FlowBox color="#6B7280">Response + checklist artifact</FlowBox>
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-3">1 task message · Agent owns orchestration</p>
        </Card>
      </div>

      {/* When to use each */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-xs font-medium text-[#374151] mb-2 flex items-center gap-1.5">
            <Zap size={12} className="text-[#7C3AED]" />Use MCP when…
          </h3>
          <ul className="space-y-1.5">
            {[
              "Ad-hoc data lookups (\"What's Alice's PTO balance?\")",
              'Cross-domain queries needing synthesis',
              'The LLM should choose which tools to use',
              'Results are returned immediately per tool',
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#6B7280]">
                <span className="text-[#7C3AED] font-bold mt-0.5">·</span>{t}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="text-xs font-medium text-[#374151] mb-2 flex items-center gap-1.5">
            <Share2 size={12} className="text-[#F59E0B]" />Use A2A when…
          </h3>
          <ul className="space-y-1.5">
            {[
              'Complex workflows with many sequential steps',
              'The agent needs domain expertise to orchestrate',
              'You want streaming progress updates',
              'The task result is a structured artifact',
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#6B7280]">
                <span className="text-[#F59E0B] font-bold mt-0.5">·</span>{t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function A2ADemoStudio({ onBack }) {
  const [tab, setTab] = useState('agent-card');
  const [agentCard, setAgentCard] = useState(null);
  const [cardLoading, setCardLoading] = useState(true);
  const [cardError, setCardError] = useState('');

  useEffect(() => {
    fetch(A2A_BASE)
      .then(r => r.json())
      .then(data => { setAgentCard(data); setCardLoading(false); })
      .catch(err => { setCardError(err.message); setCardLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#E4E4E7] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] transition-colors">
                <ArrowLeft size={16} />Back
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#F59E0B] rounded-lg grid place-items-center">
                <ClipboardList size={16} className="text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-[#111827] text-sm leading-tight">A2A Protocol Demo</h1>
                <p className="text-xs text-[#6B7280]">Staffbase Onboarding Agent · Google Agent-to-Agent</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span className="text-xs text-[#6B7280]">Agent online</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-white border border-[#E4E4E7] rounded-xl p-1 w-fit">
          <TabBtn active={tab === 'agent-card'} onClick={() => setTab('agent-card')}>
            Agent Card
          </TabBtn>
          <TabBtn active={tab === 'task-runner'} onClick={() => setTab('task-runner')}>
            Task Runner
          </TabBtn>
          <TabBtn active={tab === 'comparison'} onClick={() => setTab('comparison')}>
            Protocol Comparison
          </TabBtn>
        </div>

        {tab === 'agent-card' && (
          <AgentCardTab agentCard={agentCard} loading={cardLoading} error={cardError} />
        )}
        {tab === 'task-runner' && <TaskRunnerTab />}
        {tab === 'comparison' && <ComparisonTab />}
      </div>
    </div>
  );
}
