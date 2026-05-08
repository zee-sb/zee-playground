import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Plug, BookOpen, MessageSquare, ChevronRight, Loader2, CheckCircle, XCircle, User, Wrench, FileText, Zap, Send, RotateCcw, Copy, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

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
  // Response may be plain JSON or SSE; parse the first JSON object found
  const jsonLine = text.split('\n').find(l => l.startsWith('data: ') || l.startsWith('{'));
  const raw = jsonLine?.startsWith('data: ') ? jsonLine.slice(6) : jsonLine || text;
  return JSON.parse(raw);
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

      // Verify the MCP server responds to initialize
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
      {/* Left list */}
      <div className="w-64 border-r border-[#E5E7EB] overflow-y-auto shrink-0">
        {/* Resources */}
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

        {/* Tools */}
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

        {/* Prompts */}
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

      {/* Right detail */}
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
  const token = session?.token;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load tools once connected
  useEffect(() => {
    if (!token || tools) return;
    mcpCall('tools/list', {}, token).then(res => {
      const t = res.result?.tools || [];
      // Convert MCP tool schema to OpenAI function format
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

  const send = async (userText) => {
    if (!userText.trim() || sending) return;
    setSending(true);

    const userMsg = { role: 'user', content: userText };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');

    try {
      let currentMessages = [...history];
      // Agentic loop: keep going until no more tool calls
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

        // Parse SSE stream into a complete message
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

        // Reconstruct full message from chunks
        let fullContent = '';
        const toolCallsMap = {};

        for (const chunk of chunks) {
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) fullContent += delta.content;
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCallsMap[tc.index]) toolCallsMap[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              if (tc.id) toolCallsMap[tc.index].id = tc.id;
              if (tc.function?.name) toolCallsMap[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) toolCallsMap[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }

        const toolCalls = Object.values(toolCallsMap);

        if (toolCalls.length > 0) {
          // Append assistant message with tool calls
          const assistantMsg = { role: 'assistant', content: fullContent || null, tool_calls: toolCalls };
          currentMessages = [...currentMessages, assistantMsg];

          // Display tool call bubbles and execute each
          for (const tc of toolCalls) {
            let args = {};
            try { args = JSON.parse(tc.function.arguments); } catch {}

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
          // Continue loop to get final response
        } else {
          // Final text response
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
    'What is the remote work policy?',
    "Who reports to Carol Davis?",
    'I need to take time off next week',
    'Find engineers on the team',
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
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
            {msg.role === 'tool-call' && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-[#EFF6FF] grid place-items-center shrink-0 mt-0.5">
                  <Wrench size={12} className="text-[#2563EB]" />
                </div>
                <div className="flex-1 max-w-[85%] p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs font-mono font-bold text-[#1D4ED8]">{msg.toolName}</code>
                    {msg.status === 'running'
                      ? <Loader2 size={11} className="animate-spin text-[#3B82F6]" />
                      : <CheckCircle size={11} className="text-emerald-500" />
                    }
                  </div>
                  <JsonViewer data={msg.args} />
                  {msg.result && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-[#1D4ED8] uppercase tracking-wide mb-1">Result</p>
                      <pre className="text-[11px] font-mono text-[#1E3A5F] bg-white/60 rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                        {msg.result.length > 400 ? msg.result.slice(0, 400) + '…' : msg.result}
                      </pre>
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

      {/* Input */}
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
      {/* Header */}
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
        {/* Left panel — tabs + content */}
        <div className="flex-1 bg-white rounded-2xl border border-[#E4E4E7] shadow-sm flex flex-col overflow-hidden" style={{ minHeight: '600px' }}>
          {/* Tab bar */}
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

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {tab === 'connect' && <ConnectTab session={session} onConnect={setSession} onDisconnect={() => setSession(null)} />}
            {tab === 'explorer' && <ExplorerTab session={session} />}
            {tab === 'chat' && <ChatTab session={session} />}
          </div>
        </div>

        {/* Right panel — server info */}
        <div className="w-64 shrink-0 space-y-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-sm p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Server Info</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Name</span>
                <span className="font-medium text-[#111827]">acme-hr-portal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Version</span>
                <span className="font-medium text-[#111827]">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Transport</span>
                <span className="font-medium text-[#111827]">HTTP (stateless)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Protocol</span>
                <span className="font-medium text-[#111827]">2025-03-26</span>
              </div>
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
