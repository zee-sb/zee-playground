import React from 'react'
import { Routes, Route, useParams, useNavigate, Link } from 'react-router-dom'
import { Sparkles, BarChart2, Plug, Bot, ClipboardList, MessageCircle, Building2 } from 'lucide-react'
import NavigatorStudio from './prototypes/Navigator/NavigatorStudio'
import NavigatorOrchestratorStudio from './prototypes/NavigatorOrchestrator/NavigatorOrchestratorStudio'
import NavigatorAnalyticsDashboard from './prototypes/NavigatorAnalytics/NavigatorAnalyticsDashboard'
import MCPDemoStudio from './prototypes/MCPDemo/MCPDemoStudio'
import A2ADemoStudio from './prototypes/A2ADemo/A2ADemoStudio'
import FrontlineOpsStudio from './prototypes/FrontlineOps/FrontlineOpsStudio'
import StaffbaseCompanion from './prototypes/StaffbaseCompanion'

// ── Registry ──────────────────────────────────────────────────────────
// Navigator is two linked prototypes sharing one localStorage config blob:
//   /navigator-studio   — admin configures assistants, MCPs, agents, knowledge
//   /navigator-employee — orchestrator chat (real LLM, streaming SSE,
//                          intent trace, tool-call cards). Reflects whatever
//                          the Studio has wired up.
const PROTOTYPES = [
  {
    id: "navigator-studio",
    title: "Navigator — Studio (Admin)",
    description: "Admin configuration: assistants with sub-agent links, MCP connectors, external/A2A agents, and knowledge bases. Live preview reflects every change.",
    epic: "Navigator",
    status: "ready",
    icon: Sparkles,
    component: NavigatorStudio
  },
  {
    id: "navigator-employee",
    title: "Navigator — Employee",
    description: "What an end-user sees. Real LLM-backed chat with streaming SSE, intent classification trace, and tool-call result cards. The orchestrator only sees MCPs and agents the Studio has connected and assigned to active assistants.",
    epic: "Navigator",
    status: "ready",
    icon: MessageCircle,
    component: NavigatorOrchestratorStudio
  },
  {
    id: "navigator-analytics-dashboard",
    title: "Navigator Analytics Dashboard",
    description: "Full analytics dashboard spec for the data analyst — Adoption, Quality (NRS formula), Engagement, Retention, and Company-level breakdown with mock data.",
    epic: "Navigator",
    status: "ready",
    icon: BarChart2,
    component: NavigatorAnalyticsDashboard
  },
  {
    id: "mcp-demo",
    title: "Acme HR Portal — MCP Server",
    description: "Live MCP server demo with simulated SSO auth, employee resources, HR tools (PTO, org chart, policy search), and an OpenAI-powered chat interface that exercises tool calling.",
    epic: "Navigator",
    status: "ready",
    icon: Plug,
    component: MCPDemoStudio
  },
  {
    id: "frontline-ops",
    title: "Shift Ready — Frontline Ops",
    description: "Role-based shift checklists for frontline workers. Branch Manager, Line Cook, Cleaner, Supervisor each get their own opening/mid-shift/closing tasks with photo proof and shift handover.",
    epic: "Navigator",
    status: "ready",
    icon: ClipboardList,
    component: FrontlineOpsStudio
  },
  {
    id: "a2a-demo",
    title: "Acme Store Operations Agent — A2A Protocol",
    description: "Google's Agent-to-Agent (A2A) protocol demo. Discover agent capabilities via Agent Card, delegate shift checklist requests with streaming status updates, and compare A2A delegation vs MCP tool calling.",
    epic: "Navigator",
    status: "ready",
    icon: Bot,
    component: A2ADemoStudio
  },
  {
    id: "staffbase-companion",
    title: "Staffbase Companion — Real Atlassian MCP",
    description: "Sign in with your real Atlassian account and chat with the assistant against your live Confluence + Jira via the official Atlassian Remote MCP server. Per-user OAuth, RBAC preserved, write actions gated by explicit confirmation.",
    epic: "Internal",
    status: "live",
    icon: Building2,
    component: StaffbaseCompanion
  }
];

// ── Shared Gallery Component ──────────────────────────────────────────
const Gallery = () => {
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#18181B] font-sans pb-20">
      <header className="bg-white border-b border-[#E4E4E7] px-10">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#111827] rounded-lg grid place-items-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="font-semibold text-[15px]">Staffbase Studio</span>
          </div>
          <span className="text-[13px] text-[#A1A1AA]">{PROTOTYPES.length} Prototypes</span>
        </div>
      </header>

      <section className="max-w-[1200px] mx-auto px-10 pt-16 pb-12">
        <h1 className="text-[32px] font-bold tracking-tight mb-3">Prototype Studio</h1>
        <p className="text-[17px] text-[#71717A] max-w-2xl leading-relaxed">
          The central hub for interactive product explorations across Navigator, Employee Experience, and Admin Tooling.
        </p>
      </section>

      <div className="max-w-[1200px] mx-auto px-10">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6">
          {PROTOTYPES.map(p => (
            <Link
              key={p.id}
              to={`/prototypes/${p.id}`}
              className="bg-white border border-[#E4E4E7] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col"
            >
              <div className="h-[200px] grid place-items-center relative bg-[#F5F3FF]">
                <div className="drop-shadow-sm group-hover:scale-110 transition-transform duration-300">
                  <p.icon size={56} className="text-[#7B5CE3]" />
                </div>
                <span className="absolute top-4 right-4 bg-[#DCFCE7] text-[#166534] text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                  {p.status}
                </span>
              </div>
              <div className="p-6 flex flex-col flex-1 gap-3">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#3B82F6]">{p.epic}</span>
                <h3 className="text-lg font-bold text-[#18181B] group-hover:text-[#3B82F6] transition-colors leading-tight">{p.title}</h3>
                <p className="text-[14px] text-[#71717A] leading-relaxed flex-1">{p.description}</p>
                <div className="pt-4 mt-2 border-t border-[#F1F5F9] flex justify-between items-center">
                  <span className="text-[12px] font-medium text-[#A1A1AA]">React · Chart.js</span>
                  <span className="text-[13px] font-bold text-[#3B82F6] group-hover:translate-x-1 transition-transform">Open Prototype →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Prototype Wrapper ─────────────────────────────────────────────────
const PrototypeViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const proto = PROTOTYPES.find(p => p.id === id);
  if (!proto) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-gray-500 mb-8">Prototype not found.</p>
      <Link to="/" className="px-6 py-2 bg-black text-white rounded-lg">Back to Gallery</Link>
    </div>
  );
  const Component = proto.component;
  return <Component onBack={() => navigate('/')} />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Gallery />} />
      <Route path="/prototypes/:id/*" element={<PrototypeViewer />} />
    </Routes>
  );
}
