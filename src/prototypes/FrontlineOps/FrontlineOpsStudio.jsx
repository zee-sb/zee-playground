import React, { useState, useRef } from 'react'
import { ArrowLeft, CheckCircle2, Circle, Camera, X, Users, Clock, MapPin, AlertTriangle, ChevronRight, Send, BarChart2, ClipboardList, LogOut, ChevronDown } from 'lucide-react'

// ── Data ──────────────────────────────────────────────────────────────────────

const LOCATIONS = [
  'Acme Store — Downtown',
  'Acme Store — Airport Terminal',
  'Acme Store — Westfield Mall',
]

const ROLES = [
  { id: 'manager',    title: 'Branch Manager',   emoji: '👔', color: '#7C3AED', desc: 'Oversight, safety, financials' },
  { id: 'supervisor', title: 'Shift Supervisor',  emoji: '🎯', color: '#2563EB', desc: 'Team lead, handovers, escalations' },
  { id: 'cook',       title: 'Line Cook',         emoji: '👨‍🍳', color: '#D97706', desc: 'Food prep, quality, temperatures' },
  { id: 'cleaner',    title: 'Cleaning Staff',    emoji: '🧹', color: '#059669', desc: 'Hygiene, sanitation, restrooms' },
]

const SHIFTS = [
  { id: 'morning',   label: 'Morning',   time: '6:00 AM – 2:00 PM',  emoji: '🌅' },
  { id: 'afternoon', label: 'Afternoon', time: '2:00 PM – 10:00 PM', emoji: '☀️' },
  { id: 'closing',   label: 'Closing',   time: '10:00 PM – 6:00 AM', emoji: '🌙' },
]

const PHASES = [
  { id: 'opening',  label: 'Opening',   icon: '🌅', color: '#F59E0B' },
  { id: 'midshift', label: 'Mid-Shift', icon: '☀️', color: '#3B82F6' },
  { id: 'closing',  label: 'Closing',   icon: '🌙', color: '#6366F1' },
]

const TASKS = {
  manager: [
    { id: 'm1',  phase: 'opening',  title: 'Review overnight sales report',    desc: 'Check daily totals vs. target',              photo: false, critical: false },
    { id: 'm2',  phase: 'opening',  title: 'Verify all staff are present',      desc: 'Cross-check schedule vs. clock-ins',         photo: false, critical: true  },
    { id: 'm3',  phase: 'opening',  title: 'Inspect front-of-house area',       desc: 'Tables, floor, entrance — all clean?',       photo: true,  critical: false },
    { id: 'm4',  phase: 'opening',  title: 'Check cold storage temperatures',   desc: 'Fridge ≤4°C · Freezer ≤−18°C',              photo: true,  critical: true  },
    { id: 'm5',  phase: 'opening',  title: 'Confirm cash register float',       desc: 'Match opening float to paper log',           photo: false, critical: false },
    { id: 'm6',  phase: 'midshift', title: 'Midday team check-in',              desc: 'Brief standup — share performance vs. target', photo: false, critical: false },
    { id: 'm7',  phase: 'midshift', title: 'Review order queue & wait times',   desc: 'Target: under 5 minutes average',            photo: false, critical: false },
    { id: 'm8',  phase: 'midshift', title: 'Spot-check food quality',           desc: 'Sample from line for taste & presentation',  photo: false, critical: false },
    { id: 'm9',  phase: 'closing',  title: 'Count end-of-day till',             desc: 'Reconcile with POS totals',                  photo: false, critical: true  },
    { id: 'm10', phase: 'closing',  title: 'Lock up & set alarm',               desc: 'Check all entry points are secured',         photo: true,  critical: true  },
    { id: 'm11', phase: 'closing',  title: 'Complete incident log',             desc: 'Note any issues from the shift',             photo: false, critical: false },
  ],
  supervisor: [
    { id: 's1',  phase: 'opening',  title: 'Brief morning team',                desc: '5-min standup, share daily targets',         photo: false, critical: false },
    { id: 's2',  phase: 'opening',  title: 'Assign stations to staff',          desc: 'Match skills to busiest positions',          photo: false, critical: false },
    { id: 's3',  phase: 'opening',  title: 'Walk-the-line station check',       desc: 'All stations stocked before doors open?',    photo: true,  critical: true  },
    { id: 's4',  phase: 'opening',  title: 'Confirm food safety log complete',  desc: 'Verify temps logged by cook',                photo: false, critical: true  },
    { id: 's5',  phase: 'midshift', title: 'Monitor customer wait times',       desc: 'Flag if consistently over 5 min',            photo: false, critical: false },
    { id: 's6',  phase: 'midshift', title: 'Manage break schedule',             desc: 'No station left unmanned during breaks',     photo: false, critical: false },
    { id: 's7',  phase: 'midshift', title: 'Log any customer complaints',       desc: 'Record in the incident log',                 photo: false, critical: false },
    { id: 's8',  phase: 'closing',  title: 'Sign off all task completions',     desc: 'Verify cleaner & cook closing tasks done',   photo: false, critical: true  },
    { id: 's9',  phase: 'closing',  title: 'Prepare shift handover report',     desc: 'Incidents, stock notes, team performance',   photo: false, critical: true  },
    { id: 's10', phase: 'closing',  title: 'Lock POS terminals',                desc: 'Sign out all staff from registers',          photo: true,  critical: false },
  ],
  cook: [
    { id: 'c1',  phase: 'opening',  title: 'Sanitize all prep surfaces',        desc: 'Use approved food-safe solution',            photo: true,  critical: true  },
    { id: 'c2',  phase: 'opening',  title: 'Check stock & date labels',         desc: 'FIFO rotation — discard expired items',      photo: false, critical: true  },
    { id: 'c3',  phase: 'opening',  title: 'Preheat grills & fryers',           desc: 'Grill 180°C · Fryer 175°C',                  photo: false, critical: false },
    { id: 'c4',  phase: 'opening',  title: 'Set up morning prep station',       desc: 'Patties, buns, sauces ready at station',     photo: false, critical: false },
    { id: 'c5',  phase: 'midshift', title: 'Restock station from walk-in',      desc: 'Top up supplies before the lunch rush',      photo: false, critical: false },
    { id: 'c6',  phase: 'midshift', title: 'Clean fryer baskets mid-shift',     desc: 'Remove buildup between service periods',     photo: true,  critical: false },
    { id: 'c7',  phase: 'midshift', title: 'Log fryer temperatures',            desc: 'Record in paper log and app — required',     photo: false, critical: true  },
    { id: 'c8',  phase: 'closing',  title: 'Deep clean grill surface',          desc: 'Scrape, degrease, re-season',                photo: true,  critical: true  },
    { id: 'c9',  phase: 'closing',  title: 'Label & store all prepped food',    desc: 'Date/time label on every container',         photo: false, critical: true  },
    { id: 'c10', phase: 'closing',  title: 'Sanitize full prep area',           desc: 'Walls, floors, and all surfaces',            photo: true,  critical: true  },
    { id: 'c11', phase: 'closing',  title: 'Turn off all equipment safely',     desc: 'Fryers, grills, heat lamps, ventilation',    photo: false, critical: false },
  ],
  cleaner: [
    { id: 'cl1',  phase: 'opening',  title: 'Mop all dining area floors',       desc: 'Bleach solution · post wet floor signs',     photo: true,  critical: false },
    { id: 'cl2',  phase: 'opening',  title: 'Clean & restock restrooms',        desc: 'Soap, paper towels, sanitize surfaces',      photo: true,  critical: true  },
    { id: 'cl3',  phase: 'opening',  title: 'Wipe all tables & chairs',         desc: 'Approved surface sanitiser on all seating',  photo: false, critical: false },
    { id: 'cl4',  phase: 'opening',  title: 'Empty & reline all bins',          desc: 'Use correct bag size for each bin',          photo: false, critical: false },
    { id: 'cl5',  phase: 'midshift', title: 'Hourly restroom check',            desc: 'Log time on the door chart',                 photo: false, critical: false },
    { id: 'cl6',  phase: 'midshift', title: 'Spot-clean dining area',           desc: 'Tables, chairs, floor spills',               photo: false, critical: false },
    { id: 'cl7',  phase: 'midshift', title: 'Clear exterior & entrance',        desc: 'Sweep + remove litter outside',              photo: true,  critical: false },
    { id: 'cl8',  phase: 'closing',  title: 'Deep clean all restrooms',         desc: 'Toilets, sinks, drains, tiles',              photo: true,  critical: true  },
    { id: 'cl9',  phase: 'closing',  title: 'Full floor mop (all areas)',       desc: 'Include behind counters & kitchen entry',    photo: true,  critical: true  },
    { id: 'cl10', phase: 'closing',  title: 'Clean entrance & mat area',        desc: 'External mat, door handles, glass panels',   photo: false, critical: false },
    { id: 'cl11', phase: 'closing',  title: 'Final bin collection',             desc: 'All interior + exterior bins emptied',       photo: false, critical: false },
  ],
}

const MOCK_TEAM = [
  { name: 'Jordan S.', role: 'supervisor', done: 7,  total: 10, color: '#2563EB' },
  { name: 'Maria C.',  role: 'cook',       done: 9,  total: 11, color: '#D97706' },
  { name: 'Dev P.',    role: 'cook',       done: 4,  total: 11, color: '#D97706' },
  { name: 'Priya K.',  role: 'cleaner',    done: 11, total: 11, color: '#059669' },
  { name: 'Leon T.',   role: 'cleaner',    done: 6,  total: 11, color: '#059669' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 56, stroke = 5, color = '#7C3AED' }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  )
}

function MiniBar({ pct, color }) {
  return (
    <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function TaskItem({ task, done, photoUrl, onToggle, onPhoto }) {
  const photoRef = useRef()
  const phaseColor = PHASES.find(p => p.id === task.phase)?.color ?? '#6B7280'

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0',
      borderBottom: '1px solid #F3F4F6',
      opacity: done ? 0.75 : 1, transition: 'opacity 0.2s',
    }}>
      {/* Checkbox */}
      <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, marginTop: 1 }}>
        {done
          ? <CheckCircle2 size={22} color="#059669" fill="#DCFCE7" />
          : <Circle size={22} color={task.critical ? '#EF4444' : '#D1D5DB'} />}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 14, fontWeight: 600,
            color: done ? '#6B7280' : '#111827',
            textDecoration: done ? 'line-through' : 'none',
            transition: 'all 0.2s',
          }}>{task.title}</span>
          {task.critical && !done && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#EF4444', background: '#FEE2E2', padding: '1px 6px', borderRadius: 8 }}>REQUIRED</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{task.desc}</div>

        {/* Photo area */}
        {task.photo && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {photoUrl ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={photoUrl} alt="proof" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '2px solid #059669' }} />
                <button onClick={() => onPhoto(null)} style={{ position: 'absolute', top: -6, right: -6, background: '#EF4444', border: 'none', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                  <X size={9} color="white" />
                </button>
              </div>
            ) : (
              <>
                <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) { onPhoto(URL.createObjectURL(file)); onToggle(true) }
                    e.target.value = ''
                  }} />
                <button onClick={() => photoRef.current?.click()} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                  background: done ? '#F3F4F6' : '#EFF6FF', border: `1px solid ${done ? '#E5E7EB' : '#BFDBFE'}`,
                  borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  color: done ? '#9CA3AF' : '#2563EB',
                }}>
                  <Camera size={12} />
                  {done ? 'Add photo proof' : 'Photo required'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function HandoverModal({ tasks, completions, photos, role, shift, location, onClose, onSubmit }) {
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const allTasks = tasks
  const done = allTasks.filter(t => completions[t.id])
  const skipped = allTasks.filter(t => !completions[t.id])
  const critical_skipped = skipped.filter(t => t.critical)

  function submit() {
    setSubmitted(true)
    onSubmit({ notes, done: done.length, skipped: skipped.length, critical: critical_skipped.length })
  }

  const roleObj = ROLES.find(r => r.id === role)
  const shiftObj = SHIFTS.find(s => s.id === shift)

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', flexDirection: 'column', borderRadius: 44 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {submitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Handover Submitted</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              Your shift summary has been sent to the next {roleObj?.title}.<br/>
              The incoming team has been notified.
            </div>
            {/* Summary card */}
            <div style={{ background: 'white', borderRadius: 16, padding: 16, width: '100%', textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Shift Summary — {shiftObj?.label}</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{done.length}</div>
                  <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600 }}>Completed</div>
                </div>
                {skipped.length > 0 && (
                  <div style={{ flex: 1, background: '#FEF2F2', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#EF4444' }}>{skipped.length}</div>
                    <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600 }}>Skipped</div>
                  </div>
                )}
              </div>
              {critical_skipped.length > 0 && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>Action needed for next shift</div>
                    {critical_skipped.map(t => (
                      <div key={t.id} style={{ fontSize: 11, color: '#B45309', marginTop: 3 }}>• {t.title}</div>
                    ))}
                  </div>
                </div>
              )}
              {notes && (
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{notes}</div>
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ padding: '12px 32px', background: '#7C3AED', border: 'none', borderRadius: 14, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'white' }}>End Shift Handover</div>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color="white" />
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1, background: 'rgba(5,150,105,0.2)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 12, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#34D399' }}>{done.length}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Done</div>
              </div>
              <div style={{ flex: 1, background: skipped.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(5,150,105,0.1)', border: `1px solid ${skipped.length > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(5,150,105,0.2)'}`, borderRadius: 12, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: skipped.length > 0 ? '#FCA5A5' : '#34D399' }}>{skipped.length}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Skipped</div>
              </div>
            </div>

            {/* Skipped tasks warning */}
            {critical_skipped.length > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6 }}>
                  <AlertTriangle size={13} color="#FBBF24" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#FCD34D' }}>Required tasks not completed</span>
                </div>
                {critical_skipped.map(t => (
                  <div key={t.id} style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', paddingLeft: 20, marginTop: 3 }}>• {t.title}</div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notes for next shift</div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any equipment issues, stock shortages, incidents, or reminders…"
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 12px',
                  color: 'white', fontSize: 13, lineHeight: 1.5, resize: 'none', outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            <button onClick={submit} style={{
              width: '100%', padding: '14px', background: 'linear-gradient(135deg, #7C3AED, #2563EB)',
              border: 'none', borderRadius: 14, color: 'white', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
            }}>
              <Send size={15} /> Submit Handover
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Phone frame ───────────────────────────────────────────────────────────────

function PhoneFrame({ children }) {
  return (
    <div style={{
      width: 375, flexShrink: 0,
      background: '#1a1a2e',
      borderRadius: 44,
      padding: '0',
      boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.12)',
      overflow: 'hidden', position: 'relative',
      display: 'flex', flexDirection: 'column',
      height: 780,
    }}>
      {/* Notch */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 126, height: 34, background: '#1a1a2e', borderRadius: '0 0 20px 20px', zIndex: 100 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F5F5F7', borderRadius: 44 }}>
        {children}
      </div>
    </div>
  )
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onStart }) {
  const [location, setLocation] = useState(LOCATIONS[0])
  const [role, setRole] = useState(null)
  const [shift, setShift] = useState(null)
  const [showLoc, setShowLoc] = useState(false)

  const canStart = role && shift

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: 40, width: '100%', maxWidth: 480, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 14px', background: 'linear-gradient(135deg, #F59E0B, #EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(245,158,11,0.4)', fontSize: 26 }}>
            📋
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: 'white', letterSpacing: '-0.5px' }}>Shift Ready</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 6, fontSize: 14 }}>Your daily procedures, done right</p>
        </div>

        {/* Location picker */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Location</div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowLoc(v => !v)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12, cursor: 'pointer', color: 'white', fontSize: 14, fontWeight: 600, textAlign: 'left',
            }}>
              <MapPin size={15} color="#F59E0B" />
              <span style={{ flex: 1 }}>{location}</span>
              <ChevronDown size={14} color="rgba(255,255,255,0.4)" />
            </button>
            {showLoc && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, overflow: 'hidden', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                {LOCATIONS.map(l => (
                  <button key={l} onClick={() => { setLocation(l); setShowLoc(false) }}
                    style={{ width: '100%', padding: '11px 14px', background: l === location ? 'rgba(245,158,11,0.15)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', color: l === location ? '#FCD34D' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: l === location ? 700 : 500, textAlign: 'left' }}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Role picker */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Your Role</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {ROLES.map(r => (
              <button key={r.id} onClick={() => setRole(r.id)}
                style={{
                  padding: '12px', background: role === r.id ? `${r.color}25` : 'rgba(255,255,255,0.05)',
                  border: `1.5px solid ${role === r.id ? r.color : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{r.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: role === r.id ? 'white' : 'rgba(255,255,255,0.7)' }}>{r.title}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, lineHeight: 1.3 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Shift picker */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Shift</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {SHIFTS.map(s => (
              <button key={s.id} onClick={() => setShift(s.id)}
                style={{
                  flex: 1, padding: '10px 8px', textAlign: 'center',
                  background: shift === s.id ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                  border: `1.5px solid ${shift === s.id ? '#7C3AED' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 18, marginBottom: 3 }}>{s.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: shift === s.id ? 'white' : 'rgba(255,255,255,0.6)' }}>{s.label}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{s.time.split('–')[0].trim()}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => canStart && onStart({ location, role, shift })}
          disabled={!canStart}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none',
            background: canStart ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'rgba(255,255,255,0.1)',
            color: canStart ? 'white' : 'rgba(255,255,255,0.3)',
            fontSize: 15, fontWeight: 800, cursor: canStart ? 'pointer' : 'not-allowed',
            boxShadow: canStart ? '0 4px 20px rgba(245,158,11,0.4)' : 'none',
            transition: 'all 0.2s', letterSpacing: '0.02em',
          }}>
          Start My Shift →
        </button>
      </div>
    </div>
  )
}

// ── Main app (inside phone frame) ─────────────────────────────────────────────

function ShiftApp({ session, onLogout }) {
  const { location, role, shift } = session
  const roleObj = ROLES.find(r => r.id === role)
  const shiftObj = SHIFTS.find(s => s.id === shift)
  const tasks = TASKS[role] ?? []

  const [activePhase, setActivePhase] = useState('opening')
  const [completions, setCompletions] = useState({})
  const [photos, setPhotos] = useState({})
  const [showHandover, setShowHandover] = useState(false)
  const [handoverDone, setHandoverDone] = useState(false)
  const [showTeam, setShowTeam] = useState(role === 'manager')

  const phaseTasks = tasks.filter(t => t.phase === activePhase)
  const totalDone = tasks.filter(t => completions[t.id]).length
  const pct = tasks.length ? Math.round((totalDone / tasks.length) * 100) : 0

  function toggle(taskId, forceDone) {
    setCompletions(prev => ({ ...prev, [taskId]: forceDone !== undefined ? forceDone : !prev[taskId] }))
  }

  function setPhoto(taskId, url) {
    setPhotos(prev => ({ ...prev, [taskId]: url }))
    if (url) setCompletions(prev => ({ ...prev, [taskId]: true }))
    else setCompletions(prev => ({ ...prev, [taskId]: false }))
  }

  const statusColor = pct === 100 ? '#059669' : pct > 60 ? '#F59E0B' : roleObj.color

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* App header */}
      <div style={{ background: `linear-gradient(135deg, ${roleObj.color}, ${roleObj.color}CC)`, padding: '44px 16px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{location.split(' — ')[1] ?? location}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>{roleObj.emoji} {roleObj.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>{shiftObj.emoji} {shiftObj.label} · {shiftObj.time}</div>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => {}}>
            <ProgressRing pct={pct} size={52} stroke={4} color="rgba(255,255,255,0.9)" />
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'white', lineHeight: 1 }}>{pct}%</div>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'white', borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600, whiteSpace: 'nowrap' }}>{totalDone}/{tasks.length}</span>
        </div>
      </div>

      {/* Manager team view toggle */}
      {role === 'manager' && (
        <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          {[{ id: false, label: 'My Tasks' }, { id: true, label: 'Team Overview' }].map(tab => (
            <button key={String(tab.id)} onClick={() => setShowTeam(tab.id)}
              style={{ flex: 1, padding: '10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: showTeam === tab.id ? roleObj.color : '#9CA3AF', borderBottom: `2px solid ${showTeam === tab.id ? roleObj.color : 'transparent'}`, transition: 'all 0.15s' }}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Team overview (manager only) */}
      {showTeam ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Team Progress — Today</div>
          {MOCK_TEAM.map(m => {
            const p = Math.round((m.done / m.total) * 100)
            return (
              <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 12px', background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: m.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                  {m.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{m.name}</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 6 }}>{ROLES.find(r => r.id === m.role)?.title}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: p === 100 ? '#059669' : p > 60 ? '#F59E0B' : '#EF4444' }}>{m.done}/{m.total}</span>
                  </div>
                  <MiniBar pct={p} color={p === 100 ? '#059669' : p > 60 ? '#F59E0B' : '#EF4444'} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {/* Phase tabs */}
          <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
            {PHASES.map(ph => {
              const phTasks = tasks.filter(t => t.phase === ph.id)
              const phDone = phTasks.filter(t => completions[t.id]).length
              const allDone = phDone === phTasks.length && phTasks.length > 0
              return (
                <button key={ph.id} onClick={() => setActivePhase(ph.id)}
                  style={{ flex: 1, padding: '10px 4px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: `2px solid ${activePhase === ph.id ? ph.color : 'transparent'}`, transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 14 }}>{allDone ? '✅' : ph.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: activePhase === ph.id ? ph.color : '#9CA3AF', marginTop: 2 }}>{ph.label}</div>
                  <div style={{ fontSize: 9, color: allDone ? '#059669' : '#D1D5DB', fontWeight: 600 }}>{phDone}/{phTasks.length}</div>
                </button>
              )
            })}
          </div>

          {/* Task list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
            {phaseTasks.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No tasks for this phase.</div>
            ) : (
              phaseTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  done={!!completions[task.id]}
                  photoUrl={photos[task.id] ?? null}
                  onToggle={(force) => toggle(task.id, force)}
                  onPhoto={(url) => setPhoto(task.id, url)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Bottom bar */}
      <div style={{ flexShrink: 0, padding: '10px 16px 28px', background: 'white', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 8 }}>
        <button onClick={onLogout} style={{ padding: '10px 14px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
          <LogOut size={13} /> Switch
        </button>
        <button
          onClick={() => setShowHandover(true)}
          disabled={handoverDone}
          style={{
            flex: 1, padding: '10px', borderRadius: 12, border: 'none',
            background: handoverDone ? '#F0FDF4' : pct === 100 ? 'linear-gradient(135deg, #059669, #047857)' : `linear-gradient(135deg, ${roleObj.color}, ${roleObj.color}CC)`,
            color: handoverDone ? '#059669' : 'white',
            fontSize: 13, fontWeight: 700, cursor: handoverDone ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: handoverDone ? 'none' : '0 2px 10px rgba(0,0,0,0.2)',
          }}>
          {handoverDone ? '✅ Handover submitted' : <><Send size={13} /> End Shift & Handover</>}
        </button>
      </div>

      {/* Handover overlay */}
      {showHandover && (
        <HandoverModal
          tasks={tasks}
          completions={completions}
          photos={photos}
          role={role}
          shift={shift}
          location={location}
          onClose={() => setShowHandover(false)}
          onSubmit={() => { setHandoverDone(true); setTimeout(() => setShowHandover(false), 3000) }}
        />
      )}
    </div>
  )
}

// ── Studio wrapper ────────────────────────────────────────────────────────────

export default function FrontlineOpsStudio({ onBack }) {
  const [session, setSession] = useState(null)

  if (!session) {
    return (
      <div style={{ position: 'relative' }}>
        <button onClick={onBack} style={{
          position: 'absolute', top: 20, left: 20, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 10, padding: '7px 12px', color: 'rgba(255,255,255,0.8)', fontSize: 13,
          fontWeight: 600, cursor: 'pointer',
        }}>
          <ArrowLeft size={14} /> Back
        </button>
        <LoginScreen onStart={setSession} />
      </div>
    )
  }

  const roleObj = ROLES.find(r => r.id === session.role)
  const tasks = TASKS[session.role] ?? []

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', gap: 28, fontFamily: 'inherit',
    }}>
      {/* Left panel */}
      <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'center' }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0', marginBottom: 4,
        }}>
          <ArrowLeft size={14} /> Back to Gallery
        </button>

        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Location</div>
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <MapPin size={14} color="#F59E0B" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{session.location.split(' — ')[0]}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{session.location.split(' — ')[1]}</div>
            </div>
          </div>
        </div>

        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>Task Breakdown</div>
        {PHASES.map(ph => {
          const phTasks = tasks.filter(t => t.phase === ph.id)
          return (
            <div key={ph.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{ph.icon} {ph.label}</span>
                <span style={{ fontSize: 11, color: ph.color, fontWeight: 700 }}>{phTasks.length} tasks</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {phTasks.map(t => (
                  <span key={t.id} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: `${ph.color}18`, color: ph.color, border: `1px solid ${ph.color}30`, fontWeight: 600 }}>
                    {t.photo ? '📷' : ''}{t.critical ? '⚠️' : ''}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                <span>{phTasks.filter(t => t.photo).length} need photo</span>
                <span>·</span>
                <span>{phTasks.filter(t => t.critical).length} required</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Phone */}
      <PhoneFrame>
        <ShiftApp session={session} onLogout={() => setSession(null)} />
      </PhoneFrame>

      {/* Right panel */}
      <div style={{ width: 230, flexShrink: 0, alignSelf: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>How Shift Ready Works</div>
        {[
          { step: '1', icon: '👔', label: 'Role-based checklists', desc: 'Each role gets their own set of opening, mid-shift, and closing tasks — nothing irrelevant.' },
          { step: '2', icon: '✅', label: 'Tap to complete', desc: 'Check off tasks as you go. Critical tasks are flagged in red until completed.' },
          { step: '3', icon: '📷', label: 'Photo proof', desc: 'Some tasks require a photo — tap the camera button, snap a pic, and it auto-marks as done.' },
          { step: '4', icon: '🤝', label: 'Shift handover', desc: 'At end of shift, submit a handover with notes. The next team sees what\'s done and what needs attention.' },
        ].map(({ step, icon, label, desc }) => (
          <div key={step} style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #F59E0B, #EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, marginTop: 1 }}>{icon}</div>
            <div>
              <div style={{ color: 'white', fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{label}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.5 }}>{desc}</div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Works everywhere</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Food service · Car washes · Retail stores · Hotels · Gyms · Any shift-based business with repeating procedures.
          </div>
        </div>
      </div>
    </div>
  )
}
