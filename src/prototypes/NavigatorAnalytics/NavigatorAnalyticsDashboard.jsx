import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { BarChart2, Users, Zap, TrendingUp, RefreshCw, Building2, ArrowLeft } from 'lucide-react'
Chart.register(...registerables)

// ── Colours ──────────────────────────────────────────────────────────────
const C = {
  purple:'#7B5CE3', blue:'#3b82f6', green:'#22c55e',
  amber:'#f59e0b', orange:'#f97316', red:'#ef4444',
  muted:'rgba(255,255,255,0.18)', surface:'#13151f', surface2:'#1a1d2b',
  border:'rgba(255,255,255,0.07)',
}

// ── Shared chart defaults ────────────────────────────────────────────────
const BASE_OPTS = {
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{display:false}, tooltip:{backgroundColor:'#1a1d2b',borderColor:'rgba(255,255,255,0.12)',borderWidth:1} },
  scales:{
    x:{grid:{color:C.muted},ticks:{color:'rgba(255,255,255,0.38)',font:{size:10,family:'Inter'}}},
    y:{grid:{color:C.muted},ticks:{color:'rgba(255,255,255,0.38)',font:{size:10,family:'Inter'}}}
  }
}
const noAxes = { scales:{x:{display:false},y:{display:false}} }
const WEEKS12 = ['W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12']
const WEEKS8  = ['W5','W6','W7','W8','W9','W10','W11','W12']

// ── Chart configs ────────────────────────────────────────────────────────
const CHARTS = {
  wau: { type:'line', data:{ labels:WEEKS12, datasets:[{ label:'WAU', data:[680,710,740,790,820,870,920,960,1010,1050,1100,1150], borderColor:C.purple, backgroundColor:'rgba(123,92,227,0.08)', borderWidth:2, pointRadius:3, pointBackgroundColor:C.purple, tension:0.3, fill:true }] }, options:{ ...BASE_OPTS, plugins:{...BASE_OPTS.plugins} } },
  newret: { type:'bar', data:{ labels:WEEKS12, datasets:[ { label:'New', data:[180,160,190,170,200,185,210,195,220,200,230,210], backgroundColor:C.purple, borderRadius:3, stack:'s' }, { label:'Returning', data:[500,550,550,620,620,685,710,765,790,850,870,940], backgroundColor:'rgba(123,92,227,0.3)', stack:'s' } ] }, options:{ ...BASE_OPTS, scales:{x:{...BASE_OPTS.scales.x,stacked:true,grid:{display:false}},y:{...BASE_OPTS.scales.y,stacked:true}} } },
  nrs: { type:'line', data:{ labels:WEEKS12, datasets:[ { label:'NRS', data:[55,57,59,61,62,63,65,66,67,67,68,68], borderColor:C.amber, backgroundColor:'rgba(245,158,11,0.08)', borderWidth:2.5, pointRadius:3, pointBackgroundColor:C.amber, tension:0.3, fill:true }, { label:'Target (75)', data:Array(12).fill(75), borderColor:'rgba(34,197,94,0.5)', borderDash:[5,4], borderWidth:1.5, pointRadius:0, fill:false }, { label:'Critical (55)', data:Array(12).fill(55), borderColor:'rgba(239,68,68,0.4)', borderDash:[3,3], borderWidth:1, pointRadius:0, fill:false } ] }, options:{ ...BASE_OPTS, plugins:{...BASE_OPTS.plugins,legend:{display:true,position:'bottom',labels:{boxWidth:10,padding:12,color:'rgba(255,255,255,0.38)',font:{size:10}}}}, scales:{...BASE_OPTS.scales,y:{...BASE_OPTS.scales.y,min:40,max:90}} } },
  states: { type:'bar', data:{ labels:WEEKS8, datasets:[ { label:'resolved', data:[44,45,47,48,49,51,52,52], backgroundColor:'rgba(34,197,94,0.85)', stack:'s' }, { label:'partially', data:[18,19,18,20,21,20,22,22], backgroundColor:'rgba(245,158,11,0.8)', stack:'s' }, { label:'unresolved', data:[16,16,15,14,13,13,12,12], backgroundColor:'rgba(249,115,22,0.8)', stack:'s' }, { label:'redirect', data:[22,20,20,18,17,16,14,14], backgroundColor:'rgba(239,68,68,0.8)', stack:'s', borderRadius:3 } ] }, options:{ ...BASE_OPTS, scales:{x:{...BASE_OPTS.scales.x,stacked:true,grid:{display:false}},y:{...BASE_OPTS.scales.y,stacked:true,ticks:{...BASE_OPTS.scales.y.ticks,callback:v=>v+'%'},max:100}} } },
  intents: { type:'bar', data:{ labels:['HR policy lookup','Leave request','Payslip / payroll','IT password reset','Benefits info','Onboarding tasks','Submit expense','Find colleague','IT support ticket','Book meeting room'], datasets:[{ data:[18.2,14.8,12.1,9.6,8.4,7.2,6.8,5.9,5.4,4.8], backgroundColor:'rgba(123,92,227,0.7)', borderRadius:4, hoverBackgroundColor:C.purple }] }, options:{ ...BASE_OPTS, indexAxis:'y', scales:{x:{...BASE_OPTS.scales.x,ticks:{...BASE_OPTS.scales.x.ticks,callback:v=>v+'%'}},y:{...BASE_OPTS.scales.y,grid:{display:false}}} } },
  modality: { type:'doughnut', data:{ labels:['Text','Voice'], datasets:[{ data:[69,31], backgroundColor:[C.blue,C.purple], borderColor:'transparent', borderWidth:0 }] }, options:{ responsive:true, maintainAspectRatio:false, cutout:'72%', plugins:{legend:{display:false},tooltip:{backgroundColor:'#1a1d2b',borderColor:'rgba(255,255,255,0.12)',borderWidth:1}} } },
  freq: { type:'bar', data:{ labels:['1 conv/mo','2–4','5–9','10+'], datasets:[{ data:[52,28,12,8], backgroundColor:['rgba(255,255,255,0.2)','rgba(59,130,246,0.6)','rgba(123,92,227,0.7)',C.purple], borderRadius:6 }] }, options:{ ...BASE_OPTS, scales:{x:{...BASE_OPTS.scales.x,grid:{display:false}},y:{...BASE_OPTS.scales.y,ticks:{...BASE_OPTS.scales.y.ticks,callback:v=>v+'%'},max:65}} } },
  csat: { type:'line', data:{ labels:WEEKS8, datasets:[{ label:'CSAT %', data:[66,68,70,71,72,73,74,75], borderColor:C.green, backgroundColor:'rgba(34,197,94,0.08)', borderWidth:2, pointRadius:3, pointBackgroundColor:C.green, tension:0.3, fill:true }] }, options:{ ...BASE_OPTS, scales:{...BASE_OPTS.scales,y:{...BASE_OPTS.scales.y,min:55,max:85,ticks:{...BASE_OPTS.scales.y.ticks,callback:v=>v+'%'}}} } },
}

// ── Data ────────────────────────────────────────────────────────────────
const FAILING_INTENTS = [
  { name:'Submit expense report',   n:847, nrs:38, frr:22, esc:48, csat:41, type:'Capability gap' },
  { name:'Book a meeting room',     n:612, nrs:44, frr:31, esc:39, csat:53, type:'Capability gap' },
  { name:'Find colleague details',  n:503, nrs:51, frr:38, esc:22, csat:58, type:'Answer quality' },
  { name:'IT support ticket',       n:389, nrs:55, frr:42, esc:28, csat:62, type:'Mixed' },
  { name:'Update personal info',    n:241, nrs:57, frr:45, esc:19, csat:61, type:'Answer quality' },
]
const COMPANIES = [
  { name:'Energie AG',    u:892,  a:38, cpw:3.2, nrs:82, frr:71, esc:8,  csat:88 },
  { name:'Acme GmbH',     u:1240, a:31, cpw:2.8, nrs:76, frr:63, esc:11, csat:81 },
  { name:'TechCo DE',     u:445,  a:27, cpw:4.1, nrs:73, frr:60, esc:13, csat:79 },
  { name:'BauWerk',       u:312,  a:16, cpw:1.9, nrs:68, frr:54, esc:18, csat:72 },
  { name:'RetailGroup',   u:278,  a:22, cpw:2.1, nrs:65, frr:51, esc:19, csat:70 },
  { name:'FinanzPlus',    u:198,  a:13, cpw:1.6, nrs:61, frr:47, esc:22, csat:65 },
  { name:'HealthNet',     u:143,  a:9,  cpw:1.4, nrs:54, frr:38, esc:29, csat:58 },
  { name:'StadtVerwalt',  u:87,   a:5,  cpw:1.2, nrs:48, frr:32, esc:34, csat:51 },
]
const COHORT = [
  { w:'Mar W1', n:124, r:[100,48,38,31,28,24,22,20,18] },
  { w:'Mar W2', n:138, r:[100,44,36,30,26,22,20,18,null] },
  { w:'Mar W3', n:151, r:[100,47,39,32,28,25,22,null,null] },
  { w:'Mar W4', n:163, r:[100,50,41,34,30,26,null,null,null] },
  { w:'Apr W1', n:181, r:[100,52,43,36,31,null,null,null,null] },
  { w:'Apr W2', n:197, r:[100,55,45,37,null,null,null,null,null] },
  { w:'Apr W3', n:218, r:[100,57,46,null,null,null,null,null,null] },
  { w:'Apr W4', n:241, r:[100,58,null,null,null,null,null,null,null] },
]

// ── Small reusable components ────────────────────────────────────────────
const Card = ({ children, style={}, className='' }) => (
  <div className={className} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px', overflow:'hidden', ...style }}>{children}</div>
)
const KpiCard = ({ label, value, color, delta, deltaUp, sub, target, formula, band }) => (
  <Card style={{ position:'relative' }}>
    <div style={{ position:'absolute', top:0, left:0, right:0, height:3, borderRadius:'14px 14px 0 0', background:color }} />
    <div style={{ fontSize:11, fontWeight:500, color:'rgba(255,255,255,0.38)', marginBottom:8 }}>{label}</div>
    <div style={{ fontSize:28, fontWeight:800, color, lineHeight:1, marginBottom:8, letterSpacing:'-0.5px' }}>{value}</div>
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: formula?6:0 }}>
      <span style={{ fontSize:11, fontWeight:600, padding:'2px 6px', borderRadius:4, background: deltaUp?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)', color: deltaUp?C.green:C.red }}>{delta}</span>
      {sub && <span style={{ fontSize:11, color:'rgba(255,255,255,0.38)' }}>{sub}</span>}
    </div>
    {formula && <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', marginBottom:4, fontFamily:'monospace' }}>{formula}</div>}
    {target && <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>{target}</div>}
    {band && <div style={{ display:'flex', height:6, borderRadius:4, overflow:'hidden', marginTop:8, gap:0 }}>
      <div style={{ flex:1, background:C.red, opacity:.6 }}/><div style={{ flex:1, background:C.orange, opacity:.6 }}/>
      <div style={{ flex:2, background:C.amber, opacity:.8 }}/><div style={{ flex:3, background:C.green, opacity:.6 }}/>
    </div>}
    {band && <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'rgba(255,255,255,0.2)', marginTop:3 }}>
      <span>0 · Critical</span><span>55</span><span>70</span><span>85 · Excellent</span>
    </div>}
  </Card>
)
const ChartCard = ({ title, sub, h=180, children, extra }) => (
  <Card>
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4 }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600 }}>{title}</div>
        {sub && <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)', marginTop:2, marginBottom:12 }}>{sub}</div>}
      </div>
      {extra}
    </div>
    <div style={{ position:'relative', height:h }}>{children}</div>
  </Card>
)

const NrsPill = ({ v }) => {
  const [cls,col] = v>=75?['🟢',C.green]:v>=55?['🟡',C.amber]:['🔴',C.red]
  return <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:100,fontSize:11,fontWeight:700, background:`${col}20`,color:col }}>{cls} {v}</span>
}
const MiniBar = ({ pct, color }) => (
  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
    <div style={{ flex:1,height:6,borderRadius:3,background:C.surface2,overflow:'hidden' }}>
      <div style={{ height:'100%',borderRadius:3,background:color,width:`${pct}%` }}/>
    </div>
    <span style={{ fontSize:11,fontWeight:600,color,width:36,textAlign:'right' }}>{pct}%</span>
  </div>
)
const SectionHead = ({ n, title, tag, tagColor='#7B5CE3' }) => (
  <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16,marginTop:28 }}>
    <div style={{ width:22,height:22,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.38)',flexShrink:0 }}>{n}</div>
    <span style={{ fontSize:14,fontWeight:700 }}>{title}</span>
    {tag && <span style={{ fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:4,background:`${tagColor}20`,color:tagColor,textTransform:'uppercase',letterSpacing:'0.05em' }}>{tag}</span>}
  </div>
)
const CohortCell = ({ v }) => {
  const bg = v===null?'rgba(255,255,255,0.04)':v===100?'rgba(123,92,227,0.8)':v>=50?`rgba(123,92,227,${(v/100*0.9).toFixed(2)})`:v>=30?`rgba(59,130,246,${(v/100*1.2).toFixed(2)})`:`rgba(255,255,255,${(v/100*0.5).toFixed(2)})`
  const fg = v===null?'rgba(255,255,255,0.15)':v>=40?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.7)'
  return <div style={{ width:44,height:26,borderRadius:4,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,background:bg,color:fg,margin:1 }}>{v===null?'—':v+'%'}</div>
}

// ── useChart hook ──────────────────────────────────────────────────────
function useChart(ref, cfg) {
  useEffect(() => {
    if (!ref.current) return
    const ch = new Chart(ref.current, cfg)
    return () => ch.destroy()
  }, [])
}

// ── Main Component ───────────────────────────────────────────────────────
export default function NavigatorAnalyticsDashboard({ onBack }) {
  const refs = {
    wau: useRef(), newret: useRef(), nrs: useRef(), states: useRef(),
    intents: useRef(), modality: useRef(), freq: useRef(), csat: useRef(),
  }
  Object.entries(refs).forEach(([k,r]) => useChart(r, CHARTS[k]))

  const S = { // layout styles
    layout: { display:'flex', minHeight:'100vh', background:'#0b0d14', fontFamily:'Inter,-apple-system,sans-serif', color:'#e8eaf0' },
    sidebar: { width:220, flexShrink:0, background:C.surface, borderRight:`1px solid ${C.border}`, padding:'24px 16px', display:'flex', flexDirection:'column' },
    main: { flex:1, overflow:'hidden' },
    topbar: { background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'0 28px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 },
    content: { padding:'24px 28px 60px' },
    grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 },
    grid3: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:14, marginBottom:14 },
    grid4: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:14 },
    grid6: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:14 },
    navItem: (active) => ({ display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,fontSize:13,fontWeight:500,color:active?C.purple:'rgba(255,255,255,0.38)',background:active?'rgba(123,92,227,0.15)':'transparent',cursor:'pointer',marginBottom:2 }),
    tag: { fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',padding:'10px 16px',color:'rgba(255,255,255,0.25)' },
    label: { fontSize:11,fontWeight:500,color:'rgba(255,255,255,0.38)',marginBottom:6,marginTop:16 },
    sel: { width:'100%',background:C.surface2,border:`1px solid rgba(255,255,255,0.12)`,borderRadius:8,color:'#e8eaf0',fontSize:12,fontWeight:500,padding:'6px 10px',fontFamily:'inherit' },
    th: { background:C.surface2,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'rgba(255,255,255,0.38)',padding:'12px 16px',textAlign:'left',borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap' },
    td: { padding:'12px 16px',fontSize:12,borderBottom:`1px solid ${C.border}`,verticalAlign:'middle' },
  }

  return (
    <div style={S.layout}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:28 }}>
          <div style={{ width:32,height:32,background:C.purple,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'#fff' }}>N</div>
          <div><div style={{ fontSize:14,fontWeight:700 }}>Navigator</div><div style={{ fontSize:10,color:'rgba(255,255,255,0.38)' }}>Analytics</div></div>
        </div>
        {onBack && <div onClick={onBack} style={{ ...S.navItem(false), marginBottom:16, cursor:'pointer' }}><ArrowLeft size={14}/> Back to Gallery</div>}
        <div style={S.tag}>SECTIONS</div>
        {[['◈','Overview',BarChart2,true],['📈','Adoption',TrendingUp,false],['⬡','Quality',Zap,false],['◎','Engagement',BarChart2,false],['↺','Retention',RefreshCw,false],['▦','Companies',Building2,false]].map(([icon,label,,active],i) =>
          <div key={i} style={S.navItem(active)}><span style={{ width:16,textAlign:'center' }}>{icon}</span>{label}{label==='Quality'&&<span style={{ marginLeft:'auto',background:C.purple,color:'#fff',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:100 }}>NRS</span>}</div>
        )}
        <div style={{ marginTop:'auto' }}>
          <div style={S.tag}>FILTERS</div>
          <div style={S.label}>Company</div>
          <select style={S.sel}><option>All companies</option><option>Energie AG</option><option>Acme GmbH</option></select>
          <div style={S.label}>Device</div>
          <select style={S.sel}><option>All devices</option><option>Mobile</option><option>Desktop</option></select>
          <div style={S.label}>Modality</div>
          <select style={S.sel}><option>All (Voice + Text)</option><option>Voice</option><option>Text</option></select>
        </div>
      </aside>

      {/* Main */}
      <div style={S.main}>
        {/* Topbar */}
        <div style={S.topbar}>
          <div style={{ fontSize:16,fontWeight:700 }}>Navigator Performance Dashboard</div>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <div style={{ background:'rgba(123,92,227,0.15)',border:'1px solid rgba(123,92,227,0.3)',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:600,color:C.purple }}>📅 Last 30 days ▾</div>
            <div style={{ fontSize:11,color:'rgba(255,255,255,0.38)' }}>Updated daily · <span style={{ color:C.green }}>●</span> Live</div>
          </div>
        </div>

        <div style={S.content}>
          {/* Exec callout */}
          <div style={{ background:'rgba(123,92,227,0.08)',border:'1px solid rgba(123,92,227,0.2)',borderLeft:'3px solid #7B5CE3',borderRadius:8,padding:'12px 16px',fontSize:12,color:'rgba(255,255,255,0.6)',marginBottom:20,lineHeight:1.6 }}>
            <strong style={{ color:'#e8eaf0' }}>What this dashboard answers:</strong>&nbsp; (1) Are employees <strong style={{ color:'#e8eaf0' }}>adopting</strong> Navigator? &nbsp;·&nbsp; (2) Is it <strong style={{ color:'#e8eaf0' }}>resolving</strong> their problems? (NRS) &nbsp;·&nbsp; (3) Is it <strong style={{ color:'#e8eaf0' }}>containing</strong> without escalation? &nbsp;·&nbsp; (4) Are users forming a <strong style={{ color:'#e8eaf0' }}>habit</strong>? &nbsp;·&nbsp; (5) Where is it <strong style={{ color:'#e8eaf0' }}>failing</strong>?
          </div>

          {/* ── Section 1: KPI Cards ── */}
          <SectionHead n="1" title="Top-Line KPIs" tag="Always visible" />
          <div style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10 }}>Adoption</div>
          <div style={{ ...S.grid6, marginBottom:14 }}>
            <KpiCard label="Monthly Active Users"  value="3,247" color={C.purple} delta="▲ 18%" deltaUp sub="vs prior period" />
            <KpiCard label="Adoption Rate"         value="4.2%"  color={C.blue}   delta="▲ 0.8pp" deltaUp sub="of eligible users" target="Target: 20% — early GA" />
            <KpiCard label="Total Conversations"   value="18,429" color="rgba(255,255,255,0.7)" delta="▲ 24%" deltaUp sub="vs prior period" />
          </div>
          <div style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10 }}>Quality</div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:28 }}>
            <KpiCard label="Navigator Resolution Score" value="68" color={C.amber} delta="▲ 4 pts" deltaUp sub="Target: 75" formula="AVG(resolution_score) × 100" band />
            <KpiCard label="Full Resolution Rate"  value="52%" color={C.green}  delta="▲ 5pp"  deltaUp sub="Target: 60%" formula="COUNT(score=1.0) / total" />
            <KpiCard label="Containment Rate"      value="79%" color={C.blue}   delta="▲ 3pp"  deltaUp sub="Target: 85%" formula="COUNT(score>0.0) / total" />
            <KpiCard label="Escalation Rate"       value="21%" color={C.red}    delta="▼ 3pp"  deltaUp={true} sub="Target: <15%" formula="COUNT(score=0.0) / total" />
          </div>

          {/* ── Section 2: Adoption ── */}
          <SectionHead n="2" title="Adoption" tag="Growing" />
          <div style={S.grid2}>
            <ChartCard title="Weekly Active Users" sub="Unique users with ≥1 conversation per ISO week" h={180}><canvas ref={refs.wau}/></ChartCard>
            <ChartCard title="New vs Returning Users" sub="New = first conversation ever this week" h={180}><canvas ref={refs.newret}/></ChartCard>
          </div>

          {/* ── Section 3: Quality ── */}
          <SectionHead n="3" title="Quality" tag="NRS 68 · Needs Work" tagColor={C.amber} />
          <div style={{ display:'flex',alignItems:'center',gap:10,background:C.surface2,borderRadius:8,padding:'8px 12px',marginBottom:20,fontSize:11 }}>
            <span style={{ color:'rgba(255,255,255,0.38)' }}>LLM Eval Coverage</span>
            <div style={{ flex:1,height:6,background:C.border,borderRadius:3,overflow:'hidden' }}><div style={{ height:'100%',borderRadius:3,background:C.purple,width:'87%' }}/></div>
            <span style={{ fontWeight:700 }}>87%</span>
            <span style={{ color:'rgba(255,255,255,0.38)' }}>of conversations scored · Target: &gt;80% ✓</span>
          </div>
          <div style={S.grid2}>
            <ChartCard title="NRS Trend (Weekly)" sub="AVG(resolution_score) × 100 — with target bands" h={200}><canvas ref={refs.nrs}/></ChartCard>
            <ChartCard title="Resolution State Breakdown" sub="4-state composition — use % view for leadership" h={200}>
              <div style={{ display:'flex',gap:16,flexWrap:'wrap',marginBottom:10 }}>
                {[['resolved',C.resolved||C.green],['partially',C.amber],['unresolved',C.orange],['redirect',C.red]].map(([l,c])=>(
                  <div key={l} style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:'rgba(255,255,255,0.38)' }}><div style={{ width:8,height:8,borderRadius:'50%',background:c }}/>{l}</div>
                ))}
              </div>
              <div style={{ position:'relative',height:150 }}><canvas ref={refs.states}/></div>
            </ChartCard>
          </div>
          <div style={S.grid2}>
            <ChartCard title="CSAT Trend" sub="thumbs_up / (thumbs_up + thumbs_down) × 100 · null excluded" h={160}><canvas ref={refs.csat}/></ChartCard>
            <Card>
              <div style={{ fontSize:13,fontWeight:600,marginBottom:4 }}>User Feedback Volume</div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.38)',marginBottom:16 }}>Feedback Rate: 34% of conversations receive any rating</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12 }}>
                {[['👍','Thumbs Up',2841,C.green,'▲ 12%'],['👎','Thumbs Down',941,C.red,'▼ 8%'],['⚑','Reported',287,C.orange,'▼ 21%']].map(([icon,label,val,col,d])=>(
                  <div key={label} style={{ textAlign:'center',padding:16,background:`${col}15`,borderRadius:10 }}>
                    <div style={{ fontSize:24,fontWeight:800,color:col }}>{val.toLocaleString()}</div>
                    <div style={{ fontSize:10,color:'rgba(255,255,255,0.38)',marginTop:4 }}>{icon} {label}</div>
                    <div style={{ fontSize:10,color:col,fontWeight:600,marginTop:2 }}>{d}</div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:'center',marginTop:16,fontSize:12,color:'rgba(255,255,255,0.38)' }}>CSAT: <strong style={{ color:C.green }}>75.1%</strong> · Thumbs-rated conversations: 3,782</div>
            </Card>
          </div>

          {/* ── Failing Intents Table ── */}
          <SectionHead n="" title="⚑ Failing Intents — Direct Sprint Input" tag="N≥20 · NRS<60" tagColor={C.red} />
          <div style={{ background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.15)',borderLeft:'3px solid #ef4444',borderRadius:8,padding:'10px 14px',fontSize:11,color:'rgba(255,255,255,0.6)',marginBottom:14,lineHeight:1.6 }}>
            <strong style={{ color:'#e8eaf0' }}>How to read:</strong> High Escalation % = capability gap (Navigator can't do it). Low Escalation + High Unresolved = answer quality problem (Navigator tries but fails). Fix differently.
          </div>
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden',marginBottom:24 }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead><tr>
                {['Intent','Conversations','NRS','Full Res %','Escalation %','CSAT %','Failure type'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>{FAILING_INTENTS.map((r,i)=>(
                <tr key={i} style={{ background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                  <td style={{ ...S.td,fontWeight:600 }}>{r.name}</td>
                  <td style={S.td}>{r.n.toLocaleString()}</td>
                  <td style={S.td}><NrsPill v={r.nrs}/></td>
                  <td style={S.td}><MiniBar pct={r.frr} color={r.frr>=60?C.green:r.frr>=40?C.amber:C.red}/></td>
                  <td style={{ ...S.td,color:r.esc>=30?C.red:r.esc>=20?C.orange:C.amber,fontWeight:700 }}>{r.esc}%</td>
                  <td style={{ ...S.td,color:r.csat>=75?C.green:r.csat>=60?C.amber:C.red }}>{r.csat}%</td>
                  <td style={S.td}><span style={{ fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:4,background:r.type==='Capability gap'?'rgba(239,68,68,0.12)':r.type==='Answer quality'?'rgba(245,158,11,0.12)':'rgba(249,115,22,0.12)',color:r.type==='Capability gap'?C.red:r.type==='Answer quality'?C.amber:C.orange }}>{r.type}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          {/* ── Section 4: Engagement ── */}
          <SectionHead n="4" title="Engagement" tag="How users interact" tagColor={C.green} />
          <div style={S.grid3}>
            <ChartCard title="Top Intents by Volume" sub="% of total conversations" h={230}><canvas ref={refs.intents}/></ChartCard>
            <Card>
              <div style={{ fontSize:13,fontWeight:600,marginBottom:4 }}>Voice vs Text</div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.38)',marginBottom:12 }}>Modality split</div>
              <div style={{ height:130,position:'relative' }}><canvas ref={refs.modality}/></div>
              <div style={{ textAlign:'center',marginTop:12 }}>
                <div style={{ fontSize:20,fontWeight:800,color:C.purple }}>31%</div>
                <div style={{ fontSize:11,color:'rgba(255,255,255,0.38)' }}>Voice · growing +4pp MoM</div>
              </div>
            </Card>
            <Card>
              <div style={{ fontSize:13,fontWeight:600,marginBottom:4 }}>Device Breakdown</div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.38)',marginBottom:12 }}>By conversation volume</div>
              {[['Mobile','58%',C.purple],['Desktop','37%',C.blue],['Tablet','5%','rgba(255,255,255,0.2)']].map(([d,p,c])=>(
                <div key={d} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4 }}>
                    <span style={{ color:'rgba(255,255,255,0.5)' }}>{d}</span><span style={{ fontWeight:700,color:c }}>{p}</span>
                  </div>
                  <div style={{ height:6,borderRadius:3,background:C.surface2,overflow:'hidden' }}>
                    <div style={{ height:'100%',borderRadius:3,background:c,width:p }}/>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* ── Section 5: Retention ── */}
          <SectionHead n="5" title="Retention & Recurring Usage" tag="Habit formation" />
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:14 }}>
            <KpiCard label="WAU/MAU Stickiness" value="22%" color={C.purple} delta="▲ 2pp" deltaUp sub="Target: >25%" />
            <KpiCard label="Week-1 Retention"   value="31%" color={C.amber}  delta="▲ 4pp" deltaUp sub="Target: >40%" />
            <KpiCard label="Power User Rate"    value="8.3%" color={C.green} delta="▲ 1.2pp" deltaUp sub="≥10 convs/month" />
            <KpiCard label="Median Time to 2nd Conv." value="4.2d" color="rgba(255,255,255,0.7)" delta="▼ 0.8d" deltaUp sub="improving" />
          </div>
          <div style={S.grid2}>
            <ChartCard title="Usage Frequency Distribution" sub="% of MAU by conversations per month" h={160}><canvas ref={refs.freq}/></ChartCard>
            <Card>
              <div style={{ fontSize:13,fontWeight:600,marginBottom:2 }}>Cohort Retention Heatmap</div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.38)',marginBottom:12 }}>% still active N weeks after first use · Min cohort: 10 users</div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse',fontSize:10 }}>
                  <thead><tr>
                    <th style={{ padding:'4px 10px',textAlign:'left',color:'rgba(255,255,255,0.38)',fontWeight:600,whiteSpace:'nowrap' }}>Cohort</th>
                    {Array.from({length:9},(_,i)=><th key={i} style={{ padding:'4px 6px',textAlign:'center',color:'rgba(255,255,255,0.38)',fontWeight:600 }}>W{i}</th>)}
                  </tr></thead>
                  <tbody>{COHORT.map((row,i)=>(
                    <tr key={i}>
                      <td style={{ padding:'2px 10px',color:'rgba(255,255,255,0.38)',whiteSpace:'nowrap',fontSize:10 }}>{row.w} <span style={{ color:'rgba(255,255,255,0.2)',fontSize:9 }}>n={row.n}</span></td>
                      {row.r.map((v,j)=><td key={j} style={{ padding:'2px 2px' }}><CohortCell v={v}/></td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* ── Section 6: Company Table ── */}
          <SectionHead n="6" title="Company-Level Summary" tag="GTM / CSM view" />
          <div style={{ background:'rgba(123,92,227,0.08)',border:'1px solid rgba(123,92,227,0.2)',borderLeft:'3px solid #7B5CE3',borderRadius:8,padding:'10px 14px',fontSize:11,color:'rgba(255,255,255,0.6)',marginBottom:14 }}>
            <strong style={{ color:'#e8eaf0' }}>Flags:</strong>&nbsp; 🔴 NRS &lt; 55 &nbsp;·&nbsp; 🔴 Escalation Rate &gt; 20% &nbsp;·&nbsp; 🟠 Adoption Rate &lt; 5%
          </div>
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead><tr>
                {['Company','Active Users','Adoption Rate','Convs/User/Wk','NRS','Full Res %','Escalation %','CSAT','Resolution mix'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>{COMPANIES.map((c,i)=>{
                const mix = [c.frr, Math.round((100-c.frr-c.esc)*0.6), Math.round((100-c.frr-c.esc)*0.4), c.esc]
                return (
                  <tr key={i} style={{ background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                    <td style={{ ...S.td,fontWeight:600 }}>{c.name}</td>
                    <td style={S.td}>{c.u.toLocaleString()}</td>
                    <td style={S.td}><span style={{ fontSize:10,fontWeight:600,padding:'2px 6px',borderRadius:4,background:c.a>=20?`${C.green}20`:c.a>=5?`${C.amber}20`:`${C.red}20`,color:c.a>=20?C.green:c.a>=5?C.amber:C.red }}>{c.a<5?'⚑ ':''}{c.a}%</span></td>
                    <td style={{ ...S.td,fontWeight:600 }}>{c.cpw}x</td>
                    <td style={S.td}><NrsPill v={c.nrs}/></td>
                    <td style={{ ...S.td,color:c.frr>=60?C.green:c.frr>=40?C.amber:C.red,fontWeight:700 }}>{c.frr}%</td>
                    <td style={S.td}><span style={{ fontSize:10,fontWeight:600,padding:'2px 6px',borderRadius:4,background:c.esc>20?`${C.red}20`:c.esc>10?`${C.amber}20`:`${C.green}20`,color:c.esc>20?C.red:c.esc>10?C.amber:C.green }}>{c.esc>20?'⚑ ':''}{c.esc}%</span></td>
                    <td style={{ ...S.td,color:c.csat>=75?C.green:c.csat>=60?C.amber:C.red,fontWeight:700 }}>{c.csat}%</td>
                    <td style={S.td}>
                      <div style={{ display:'flex',height:8,borderRadius:4,overflow:'hidden',gap:1,width:120 }}>
                        <div style={{ flex:mix[0],background:C.green,opacity:.85 }}/>
                        <div style={{ flex:mix[1],background:C.amber,opacity:.8 }}/>
                        <div style={{ flex:mix[2],background:C.orange,opacity:.8 }}/>
                        <div style={{ flex:mix[3],background:C.red,opacity:.8 }}/>
                      </div>
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>

        </div>{/* /content */}
      </div>{/* /main */}
    </div>
  )
}
