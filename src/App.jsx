import React from 'react'
import { Routes, Route, useParams, useNavigate, Link } from 'react-router-dom'
import { Sparkles, MessageCircle, Inbox, MessagesSquare } from 'lucide-react'
import NavigatorStudio from './prototypes/Navigator/NavigatorStudio'
import NavigatorV2Studio from './prototypes/NavigatorV2/NavigatorV2Studio'
import NavigatorV2Chat from './prototypes/NavigatorV2Chat/NavigatorV2Chat'
import NavigatorSetupStudio from './prototypes/NavigatorSetup/NavigatorSetupStudio'
import StaffbaseCompanion from './prototypes/StaffbaseCompanion'
import MCPDemoStudio from './prototypes/MCPDemo/MCPDemoStudio'
import A2ADemoStudio from './prototypes/A2ADemo/A2ADemoStudio'
import { TenantProvider } from './prototypes/AIAssistant/useActiveTenant'
import { TenantPicker } from './components/TenantPicker'

// ── Registry ──────────────────────────────────────────────────────────
// Three prototypes, all anchored to one canonical Staffbase Intranet workspace:
//
//   /navigator-studio           — admin: assistants, connectors, agents, KBs,
//                                  flows, workspace settings, Setup tab.
//   /staffbase-companion        — employee-facing chat. Real Staffbase auth,
//                                  Studio-driven Tier-1/Tier-2 orchestration,
//                                  per-user OAuth for external MCPs,
//                                  write actions gated by confirmation.
//                                  (Route MUST stay at this path — registered
//                                   OAuth callback URLs depend on it.)
// NavigatorSetup is kept routable at /navigator-setup so the in-Studio Setup
// tab and any external links continue to work, but it's not surfaced as a
// gallery card — it's folded into Studio's first tab.
const PROTOTYPES = [
  {
    id: "navigator-studio",
    title: "Navigator — Studio (Admin)",
    description: "Configure the Staffbase Intranet workspace: Setup discovery, assistants, MCP connectors (mock + real), external agents, knowledge bases, flows, and the team directory. Live preview reflects every change.",
    epic: "Navigator",
    status: "ready",
    icon: Sparkles,
    component: NavigatorStudio
  },
  {
    id: "staffbase-companion",
    title: "Staffbase Companion — Employee Chat",
    description: "The employee-facing chat. Studio-driven two-tier orchestration (flow / assistant routing → scoped tool catalog), live Campsite Intranet, HR / IT / Atlassian MCPs, A2A handoff to the Onboarding Agent, and per-user OAuth for external connectors.",
    epic: "Navigator",
    status: "live",
    icon: MessageCircle,
    component: StaffbaseCompanion
  },
  // ── Navigator V2 — the target concept (docs/navigator-concept.md) ──
  // Built as a separate pair so stakeholders can A/B the current approach
  // (cards above) against the new model in one deployment. Now wired to the
  // live runtime: V2 state persists per tenant inside navigator_config
  // (tenantOverrides.v2) and lib/v2-compiler.mjs emits the V1 entities the
  // orchestrator executes (connections / workflows / experts, origin:'v2').
  {
    id: "navigator-v2-studio",
    title: "Navigator Studio V2 (Target Concept)",
    description: "The admin surface inverted: home is the Question Log — clustered real demand, gaps, and Navigator's own proposals to approve, edit, or dismiss. Sources & Actions with risk tiers and inherited permissions, Behaviors as structured policy (no prompt textbox), processes described not built, and installable Packs. Edits compile to live runtime entities per tenant.",
    epic: "Navigator 2.0",
    status: "concept",
    icon: Inbox,
    component: NavigatorV2Studio
  },
  {
    id: "navigator-v2-chat",
    title: "Navigator V2 — Employee Chat (Target Concept)",
    description: "One Navigator, no expert picker. Live mode streams the real orchestrator with V2 trust moments — citations, plain-language progress narrative, action preview with risk tiers (assist / trigger / execute), receipts, and a client-side trust ladder. Scripted demo mode keeps the deterministic walkthrough. Built mobile-first (390px).",
    epic: "Navigator 2.0",
    status: "concept",
    icon: MessagesSquare,
    component: NavigatorV2Chat
  }
];

// Routes that stay reachable but aren't surfaced as gallery cards:
//   - navigator-discovery: the discovery wizard, launched from Studio's
//     Home tab. (The legacy `navigator-setup` slug is kept as an alias so
//     external links and any existing bookmarks keep working.)
//   - mcp-demo, a2a-demo: surfaced inside Studio as "Custom Integration"
//     cards on the MCP Connectors / External Agents tabs, so the protocol
//     showcase stays one click away from the workspace context.
const HIDDEN_ROUTES = [
  { id: "navigator-discovery", component: NavigatorSetupStudio },
  { id: "navigator-setup",     component: NavigatorSetupStudio }, // legacy alias
  { id: "mcp-demo",            component: MCPDemoStudio         },
  { id: "a2a-demo",            component: A2ADemoStudio         },
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
          <div className="flex items-center gap-4">
            <TenantPicker />
            <span className="text-[13px] text-[#A1A1AA]">{PROTOTYPES.length} Prototypes</span>
          </div>
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
              to={{ pathname: `/prototypes/${p.id}`, search: typeof window !== 'undefined' ? window.location.search : '' }}
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
  const proto = PROTOTYPES.find(p => p.id === id) || HIDDEN_ROUTES.find(p => p.id === id);
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
    <TenantProvider>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/prototypes/:id/*" element={<PrototypeViewer />} />
      </Routes>
    </TenantProvider>
  );
}
