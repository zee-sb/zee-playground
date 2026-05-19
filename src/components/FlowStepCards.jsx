// New step-card variants added in v9. Each card is a self-contained React
// component that renders inside the Companion chat and emits a `values`
// payload through `onSubmit` when the step completes. The orchestrator
// receives the payload via the existing flow-submission pathway.
//
// All cards share the same shape as FormCard / ConfirmCard:
//   props: { step, busy, onSubmit, onCancel, theme, submitted, submittedSummary }
//
// Each card renders a "submitted" stub once it's done so subsequent re-renders
// from the chat history stay visually consistent with FormCard's behavior.

import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle, Loader2, UserCheck, Hourglass, FileUp, PenLine,
  MapPin, ScanLine, Clock, Bell, X, Camera, Upload,
} from 'lucide-react';
import {
  STAFFBASE_TEAL, STAFFBASE_TEAL_DEEP, NEUTRAL_BORDER,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from '../prototypes/StaffbaseCompanion/cards/cardStyles.js';

const SHELL = {
  margin: '8px 0', padding: 14, background: '#FFFFFF',
  border: `1px solid ${NEUTRAL_BORDER}`, borderRadius: 12,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

function SubmittedStub({ icon: Icon = CheckCircle, summary, color = STAFFBASE_TEAL }) {
  return (
    <div style={SHELL}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={18} color={color} />
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{summary}</span>
      </div>
    </div>
  );
}

function CardHeader({ icon: Icon, color, title, description }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: description ? 4 : 10 }}>
        <Icon size={16} color={color} />
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{title}</div>
      </div>
      {description && (
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 10, lineHeight: 1.4 }}>
          {description}
        </div>
      )}
    </>
  );
}

function PrimaryBtn({ disabled, onClick, children, color = STAFFBASE_TEAL }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 8, border: 'none',
        background: color, color: 'white',
        fontSize: 12.5, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 8,
        border: `1px solid ${NEUTRAL_BORDER}`, background: '#FFFFFF',
        color: TEXT_SECONDARY, fontSize: 12.5, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

// ── Approval ──────────────────────────────────────────────────────────────
export function ApprovalCard({ step, busy, onSubmit, submitted, submittedSummary }) {
  const a = step?.approval || {};
  const [waited, setWaited] = useState(0);
  const COLOR = '#DC2626';
  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setWaited((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [submitted]);

  if (submitted) return <SubmittedStub icon={UserCheck} color={COLOR} summary={submittedSummary || 'Approval recorded'} />;

  const routeLabel = {
    manager: 'your manager', hr: 'HR', it: 'IT', finance: 'Finance',
    role: a.approver || 'the approver', named: a.approver || 'the approver',
  }[a.route || 'manager'];

  // Mock approval — in prod this would be triggered server-side; for the
  // prototype we expose buttons so the demo can move forward.
  return (
    <div style={SHELL}>
      <CardHeader icon={Hourglass} color={COLOR} title={a.title || 'Waiting for approval'} description={a.message} />
      <div style={{
        marginBottom: 10, padding: '8px 10px',
        background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
      }}>
        <div style={{ fontSize: 11.5, color: '#7F1D1D', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Routed to <b>{routeLabel}</b> · SLA {a.slaHours || 24}h · waited {waited}s</span>
        </div>
      </div>
      {/* Demo affordances — in production these would not exist on the employee side */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${NEUTRAL_BORDER}` }}>
        <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Demo: simulate the approver
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <PrimaryBtn color="#16A34A" disabled={busy} onClick={() => onSubmit?.({ decision: 'approved', approver: routeLabel })}>
            Approve
          </PrimaryBtn>
          <SecondaryBtn disabled={busy} onClick={() => onSubmit?.({ decision: 'rejected', approver: routeLabel, note: 'Not now — see comment.' })}>
            Reject
          </SecondaryBtn>
        </div>
      </div>
    </div>
  );
}

// ── File upload ──────────────────────────────────────────────────────────
export function FileUploadCard({ step, busy, onSubmit, onCancel, submitted, submittedSummary }) {
  const f = step?.file || {};
  const COLOR = '#9333EA';
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  if (submitted) {
    return <SubmittedStub icon={FileUp} color={COLOR} summary={submittedSummary || 'File uploaded'} />;
  }

  function pickFile(e) {
    setErr('');
    const f0 = e.target.files?.[0];
    if (!f0) return;
    const maxBytes = (f.maxMB || 10) * 1024 * 1024;
    if (f0.size > maxBytes) {
      setErr(`File too large — keep it under ${f.maxMB} MB.`);
      return;
    }
    setFile(f0);
  }

  function submit() {
    if (!file && f.required !== false) {
      setErr('Please choose a file first.');
      return;
    }
    if (!file) {
      onSubmit?.({ name: null, sizeBytes: 0, mimeType: null, dataUrl: null });
      return;
    }
    // Read into a data URL — small files only; for big files in production
    // you'd upload to object storage and pass back a URL token.
    const r = new FileReader();
    r.onload = () => onSubmit?.({
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      dataUrl: typeof r.result === 'string' ? r.result : null,
    });
    r.onerror = () => setErr('Could not read the file.');
    r.readAsDataURL(file);
  }

  const accept = f.kind === 'pdf' ? 'application/pdf'
    : f.kind === 'image' ? 'image/*'
    : f.kind === 'document' ? '.pdf,.doc,.docx,.txt,application/pdf'
    : undefined;

  return (
    <div style={SHELL}>
      <CardHeader icon={FileUp} color={COLOR} title={f.title || 'Upload a file'} description={f.description} />
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={pickFile}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%', padding: '20px 12px', borderRadius: 10,
          border: `2px dashed ${file ? COLOR : NEUTRAL_BORDER}`,
          background: file ? '#FAF5FF' : '#FAFAFB',
          color: file ? '#581C87' : TEXT_SECONDARY,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}
      >
        <Upload size={16} />
        {file ? (
          <>
            <span style={{ wordBreak: 'break-all', textAlign: 'center' }}>{file.name}</span>
            <span style={{ fontSize: 10.5, color: TEXT_MUTED }}>{(file.size / 1024).toFixed(0)} KB · tap to replace</span>
          </>
        ) : (
          <>
            <span>Tap to choose a file</span>
            <span style={{ fontSize: 10.5, color: TEXT_MUTED }}>
              {f.kind === 'pdf' ? 'PDFs only' : f.kind === 'image' ? 'Images only' : 'Up to ' + (f.maxMB || 10) + ' MB'}
            </span>
          </>
        )}
      </button>
      {err && <div style={{ marginTop: 8, fontSize: 11, color: '#B91C1C' }}>{err}</div>}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onCancel && <SecondaryBtn disabled={busy} onClick={onCancel}>Cancel</SecondaryBtn>}
        <PrimaryBtn disabled={busy} color={COLOR} onClick={submit}>{f.submitLabel || 'Upload'}</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Signature ────────────────────────────────────────────────────────────
export function SignatureCard({ step, busy, onSubmit, submitted, submittedSummary }) {
  const s = step?.signature || {};
  const COLOR = '#0D9488';
  const [typed, setTyped] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const canvasRef = useRef(null);

  if (submitted) {
    return <SubmittedStub icon={PenLine} color={COLOR} summary={submittedSummary || 'Signed'} />;
  }

  function startDraw(e) {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    const rect = c.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y);
    c.dataset.drawing = '1';
    setDrawn(true);
  }
  function moveDraw(e) {
    const c = canvasRef.current; if (!c || c.dataset.drawing !== '1') return;
    e.preventDefault();
    const ctx = c.getContext('2d');
    const rect = c.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineTo(x, y); ctx.stroke();
  }
  function endDraw() {
    const c = canvasRef.current; if (!c) return;
    c.dataset.drawing = '0';
  }
  function clearDraw() {
    const c = canvasRef.current; if (!c) return;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setDrawn(false);
  }

  function submit() {
    if (s.required !== false) {
      if (s.kind === 'draw' && !drawn) return;
      if (s.kind === 'type' && !typed.trim()) return;
      if (s.kind === 'click' && !acknowledged) return;
    }
    const payload = {
      kind: s.kind || 'draw',
      acceptedAt: new Date().toISOString(),
    };
    if (s.kind === 'draw') payload.signatureDataUrl = canvasRef.current?.toDataURL('image/png') || null;
    if (s.kind === 'type') payload.typedName = typed.trim();
    onSubmit?.(payload);
  }

  return (
    <div style={SHELL}>
      <CardHeader icon={PenLine} color={COLOR} title={s.title || 'Sign to acknowledge'} />
      {s.description && (
        <div style={{
          marginBottom: 10, padding: 10, borderRadius: 8,
          background: '#F0FDFA', border: '1px solid #99F6E4',
          fontSize: 12, color: '#134E4A', lineHeight: 1.5,
          maxHeight: 140, overflowY: 'auto',
        }}>
          {s.description}
        </div>
      )}
      <div style={{
        marginBottom: 10, padding: '6px 10px', borderRadius: 6,
        background: '#FAFAFB', border: `1px solid ${NEUTRAL_BORDER}`,
        fontSize: 11.5, color: TEXT_PRIMARY, fontStyle: 'italic',
      }}>
        "{s.attestation || 'I have read and agree to the policy above.'}"
      </div>

      {(s.kind || 'draw') === 'draw' && (
        <div>
          <canvas
            ref={canvasRef}
            width={400}
            height={120}
            onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}
            style={{
              width: '100%', maxWidth: 400, height: 120,
              border: `1px solid ${NEUTRAL_BORDER}`, borderRadius: 8,
              background: '#FFFFFF', touchAction: 'none', cursor: 'crosshair',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>Sign in the box above with your mouse or finger.</span>
            <button type="button" onClick={clearDraw} style={{ fontSize: 11, color: COLOR, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear</button>
          </div>
        </div>
      )}

      {s.kind === 'type' && (
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type your full name"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: `1px solid ${NEUTRAL_BORDER}`,
            fontSize: 16, fontFamily: 'cursive', color: TEXT_PRIMARY,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}

      {s.kind === 'click' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: TEXT_PRIMARY }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>I acknowledge and accept.</span>
        </label>
      )}

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryBtn disabled={busy} color={COLOR} onClick={submit}>Sign &amp; continue</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Location ─────────────────────────────────────────────────────────────
export function LocationCard({ step, busy, onSubmit, submitted, submittedSummary }) {
  const l = step?.location || {};
  const COLOR = '#16A34A';
  const [state, setState] = useState({ status: 'idle', coords: null, err: null });

  if (submitted) {
    return <SubmittedStub icon={MapPin} color={COLOR} summary={submittedSummary || 'Location shared'} />;
  }

  function fetchLocation() {
    setState({ status: 'pending', coords: null, err: null });
    if (!navigator.geolocation) {
      setState({ status: 'error', coords: null, err: 'Your device does not support location sharing.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: 'ok',
          coords: {
            lat: pos.coords.latitude, lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            // Address would normally come from a reverse-geocoder; we stub it
            // here so the card has something to show without a network hop.
            address: `≈${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          },
          err: null,
        });
      },
      (err) => setState({ status: 'error', coords: null, err: err.message || 'Could not read location.' }),
      { enableHighAccuracy: l.accuracy === 'precise' }
    );
  }

  function useSimulated() {
    // Berlin HQ stub — for environments where geolocation is blocked.
    setState({
      status: 'ok',
      coords: { lat: 52.5200, lng: 13.4050, accuracy: 35, address: 'Staffbase HQ, Berlin' },
      err: null,
    });
  }

  function submit() {
    if (!state.coords) return;
    onSubmit?.(state.coords);
  }

  return (
    <div style={SHELL}>
      <CardHeader icon={MapPin} color={COLOR} title={l.title || 'Share your location'} description={l.description} />
      {state.status === 'ok' && state.coords ? (
        <div style={{
          padding: 10, borderRadius: 8,
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          fontSize: 12, color: '#14532D',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <CheckCircle size={13} /> Captured
          </div>
          <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 11.5 }}>
            {state.coords.address}
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#22633D' }}>
            ±{Math.round(state.coords.accuracy)}m accuracy
          </div>
        </div>
      ) : state.status === 'error' ? (
        <div style={{
          padding: 10, borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA',
          fontSize: 12, color: '#7F1D1D',
        }}>
          {state.err}
          <div style={{ marginTop: 6 }}>
            <button type="button" onClick={useSimulated} style={{ fontSize: 11, fontWeight: 600, color: COLOR, background: 'transparent', border: 'none', cursor: 'pointer' }}>
              Use simulated location (Staffbase HQ)
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          padding: 12, borderRadius: 8, textAlign: 'center',
          background: '#FAFAFB', border: `1px dashed ${NEUTRAL_BORDER}`,
        }}>
          <button type="button" onClick={fetchLocation} disabled={state.status === 'pending'} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: COLOR, color: 'white', fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {state.status === 'pending'
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Locating…</>
              : <><MapPin size={12} /> Share my location</>}
          </button>
          <div style={{ marginTop: 6, fontSize: 11, color: TEXT_MUTED }}>
            <button type="button" onClick={useSimulated} style={{ fontSize: 11, color: TEXT_MUTED, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Or use a simulated location
            </button>
          </div>
        </div>
      )}
      {state.status === 'ok' && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <PrimaryBtn disabled={busy} color={COLOR} onClick={submit}>Continue</PrimaryBtn>
        </div>
      )}
    </div>
  );
}

// ── Barcode ──────────────────────────────────────────────────────────────
export function BarcodeCard({ step, busy, onSubmit, submitted, submittedSummary }) {
  const b = step?.barcode || {};
  const COLOR = '#EA580C';
  const [value, setValue] = useState('');

  if (submitted) {
    return <SubmittedStub icon={ScanLine} color={COLOR} summary={submittedSummary || 'Code scanned'} />;
  }

  // Full camera scanning requires a vendor lib (e.g. ZXing). For the prototype
  // we render a manual-entry fallback that's the same shape an actual scanner
  // would produce, and a "Simulate scan" affordance that's useful for demos.
  return (
    <div style={SHELL}>
      <CardHeader icon={ScanLine} color={COLOR} title={b.title || 'Scan a code'} description={b.description} />
      <div style={{
        padding: 12, borderRadius: 8,
        background: '#FFF7ED', border: '1px solid #FED7AA',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Camera size={14} color={COLOR} />
          <span style={{ fontSize: 12, color: '#7C2D12', fontWeight: 600 }}>
            Point your camera at the code, or enter it manually below.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setValue(`DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)}
          style={{
            fontSize: 11, fontWeight: 600, color: COLOR,
            background: 'transparent', border: `1px solid ${COLOR}`,
            padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
          }}
        >
          Simulate scan
        </button>
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. ABC-12345"
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8,
          border: `1px solid ${NEUTRAL_BORDER}`,
          fontSize: 14, fontFamily: 'monospace', color: TEXT_PRIMARY,
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryBtn
          disabled={busy || (b.required !== false && !value.trim())}
          color={COLOR}
          onClick={() => onSubmit?.({ value: value.trim(), format: b.format || 'any' })}
        >
          Use this code
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── Wait ─────────────────────────────────────────────────────────────────
export function WaitCard({ step, busy, onSubmit, submitted, submittedSummary }) {
  const w = step?.wait || {};
  const COLOR = '#7C3AED';

  if (submitted) {
    return <SubmittedStub icon={Clock} color={COLOR} summary={submittedSummary || 'Resumed after waiting'} />;
  }

  return (
    <div style={SHELL}>
      <CardHeader
        icon={Clock} color={COLOR}
        title={`Paused — resuming in ${w.amount ?? 1} ${w.unit || 'hours'}`}
      />
      <div style={{
        padding: 10, borderRadius: 8,
        background: '#F5F3FF', border: '1px solid #DDD6FE',
        fontSize: 12, color: '#5B21B6',
      }}>
        {w.message || `We'll continue this in ${w.amount || 1} ${w.unit || 'hours'}.`}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: TEXT_MUTED, textAlign: 'center' }}>
        You'll get a push notification when this resumes.
      </div>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${NEUTRAL_BORDER}` }}>
        <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Demo: skip the wait
        </div>
        <PrimaryBtn disabled={busy} color={COLOR} onClick={() => onSubmit?.({})}>
          Continue now
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── Notify ───────────────────────────────────────────────────────────────
// Notify is fire-and-forget — the chat just shows a confirmation card that
// the message went out, and the step auto-advances.
export function NotifyCard({ step, busy, onSubmit, submitted, submittedSummary }) {
  const n = step?.notify || {};
  const COLOR = '#2563EB';
  // Auto-dispatch on first render to mimic real fire-and-forget behavior.
  useEffect(() => {
    if (submitted) return;
    const t = setTimeout(() => onSubmit?.({}), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  if (submitted) return <SubmittedStub icon={Bell} color={COLOR} summary={submittedSummary || `${channelLabel(n.channel)} sent`} />;

  return (
    <div style={SHELL}>
      <CardHeader icon={Bell} color={COLOR} title={`Sending ${channelLabel(n.channel)}…`} />
      <div style={{
        padding: 10, borderRadius: 8,
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        fontSize: 12, color: '#1E3A8A',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          <span><b>{recipientLabel(n.to)}</b> · {n.title || 'Notification'}</span>
        </div>
        {n.body && <div style={{ marginTop: 4, fontSize: 11.5 }}>{n.body}</div>}
      </div>
    </div>
  );
}

function channelLabel(c) {
  if (c === 'email') return 'email';
  if (c === 'in_app') return 'in-app banner';
  return 'push notification';
}
function recipientLabel(to) {
  if (!to || to === 'employee') return 'You';
  if (to === 'manager') return 'Your manager';
  if (typeof to === 'string' && to.startsWith('role:')) return `${to.slice(5)} team`;
  return to;
}
