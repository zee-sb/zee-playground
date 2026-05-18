import React from 'react';
import { BookOpen, Workflow, GitBranch, Plug, X, ChevronRight, ChevronLeft } from 'lucide-react';
import ToolCallCard from './ToolCallCard.jsx';
import TraceCard from './TraceCard.jsx';
import FlowTimeline from './FlowTimeline.jsx';
import ConnectionsPanel from './ConnectionsPanel.jsx';
import { BRAND } from './lib/tokens.js';
import { useInspector } from './lib/InspectorContext.jsx';

const RAIL_WIDTH = 56;
const PANEL_WIDTH = 360;

const TABS = [
  { id: 'sources', label: 'Sources', icon: BookOpen, hint: 'Tool results and citations for the current answer.' },
  { id: 'flow', label: 'Workflow', icon: Workflow, hint: 'Progress and steps of the active workflow.' },
  { id: 'trace', label: 'Trace', icon: GitBranch, hint: 'How Navigator routed your last message.' },
  { id: 'connections', label: 'Connections', icon: Plug, hint: 'External services this Navigator is wired up to.' },
];

export default function InspectorDock({ connections = [], onConnectionsChanged }) {
  const inspector = useInspector();
  const { open, tab, sources, flow, trace, openTab, close, toggle } = inspector;

  // Badge counts for the rail — tells the user when there's something new
  // behind a collapsed tab.
  const badges = {
    sources: sources.sources?.length || 0,
    flow: flow.active ? '●' : 0,
    trace: trace.traceItem ? 1 : 0,
    connections: connections.length || 0,
  };

  return (
    <aside
      style={{
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        background: BRAND.surface,
        borderLeft: `1px solid ${BRAND.hairline}`,
        transition: 'width 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        width: open ? RAIL_WIDTH + PANEL_WIDTH : RAIL_WIDTH,
        minWidth: 0,
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* Expanded panel — sits to the LEFT of the rail. We render it first
          in DOM so the rail tabs stay anchored to the right edge regardless
          of open/closed state. */}
      <div
        style={{
          width: PANEL_WIDTH,
          flexShrink: 0,
          display: open ? 'flex' : 'none',
          flexDirection: 'column',
          borderRight: `1px solid ${BRAND.hairline}`,
          minHeight: 0,
        }}
      >
        <DockPanel
          tab={tab}
          sources={sources}
          flow={flow}
          trace={trace}
          connections={connections}
          onConnectionsChanged={onConnectionsChanged}
          onClose={close}
        />
      </div>

      {/* Vertical icon rail, always visible. The chevron at the top toggles
          the panel open/closed; tab icons below switch the active tab and
          open the panel if it's currently collapsed. */}
      <div
        style={{
          width: RAIL_WIDTH,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: 4,
          background: BRAND.surfaceMuted,
        }}
      >
        <button
          onClick={toggle}
          aria-label={open ? 'Collapse inspector' : 'Expand inspector'}
          title={open ? 'Collapse' : 'Expand'}
          style={{
            width: 36, height: 36, borderRadius: 10,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: BRAND.muted,
            marginBottom: 8,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = BRAND.bg; e.currentTarget.style.color = BRAND.ink; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = BRAND.muted; }}
        >
          {open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {TABS.map((t) => {
          const Icon = t.icon;
          const active = open && tab === t.id;
          const badge = badges[t.id];
          return (
            <button
              key={t.id}
              onClick={() => openTab(t.id)}
              aria-label={t.label}
              title={`${t.label} — ${t.hint}`}
              style={{
                position: 'relative',
                width: 38, height: 38, borderRadius: 10,
                display: 'grid', placeItems: 'center',
                background: active ? BRAND.tealSoft : 'transparent',
                border: active ? `1px solid ${BRAND.teal}33` : '1px solid transparent',
                color: active ? BRAND.tealDeep : BRAND.muted,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (active) return;
                e.currentTarget.style.background = BRAND.bg;
                e.currentTarget.style.color = BRAND.ink;
              }}
              onMouseLeave={(e) => {
                if (active) return;
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = BRAND.muted;
              }}
            >
              <Icon size={16} />
              {!!badge && badge !== 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  minWidth: 16, height: 16, borderRadius: 999,
                  padding: '0 4px',
                  background: typeof badge === 'string' ? BRAND.teal : BRAND.assistant,
                  color: 'white', fontSize: 9.5, fontWeight: 700,
                  display: 'grid', placeItems: 'center',
                  border: `2px solid ${BRAND.surfaceMuted}`,
                }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// ─── Panel body ────────────────────────────────────────────────────────────

function DockPanel({ tab, sources, flow, trace, connections, onConnectionsChanged, onClose }) {
  const TAB = TABS.find((t) => t.id === tab) || TABS[0];
  const Icon = TAB.icon;

  return (
    <>
      {/* Panel header — title, hint, close. Sticky so the body scrolls
          underneath it. */}
      <div style={{
        flexShrink: 0,
        padding: '14px 16px',
        borderBottom: `1px solid ${BRAND.hairline}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: BRAND.tealSoft, color: BRAND.tealDeep,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <Icon size={14} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink, letterSpacing: '-0.1px' }}>
            {TAB.label}
          </div>
          <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 1, lineHeight: 1.35 }}>
            {TAB.hint}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close inspector"
          style={{
            width: 28, height: 28, borderRadius: 8,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: BRAND.muted, flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = BRAND.bg; e.currentTarget.style.color = BRAND.ink; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = BRAND.muted; }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Panel body — scrollable, content varies per tab. */}
      <div style={{
        flex: 1, overflowY: 'auto', minHeight: 0,
        background: BRAND.surface,
      }}>
        {tab === 'sources' && <SourcesTab sources={sources} />}
        {tab === 'flow' && <FlowTab flow={flow} />}
        {tab === 'trace' && <TraceTab trace={trace} />}
        {tab === 'connections' && (
          <ConnectionsTab connections={connections} onChanged={onConnectionsChanged} />
        )}
      </div>
    </>
  );
}

// ─── Tab contents ─────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div style={{
      padding: '40px 24px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: BRAND.bg, color: BRAND.mutedSoft,
        display: 'grid', placeItems: 'center',
      }}>
        <Icon size={20} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.ink }}>{title}</div>
      <div style={{ fontSize: 12, color: BRAND.muted, lineHeight: 1.5, maxWidth: 260 }}>{body}</div>
    </div>
  );
}

function SourcesTab({ sources }) {
  const list = sources.sources || [];
  if (list.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No sources yet"
        body="When Navigator runs a tool to answer your question, the results land here so you can cross-reference them while reading."
      />
    );
  }
  return (
    <div style={{ padding: '12px 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((s, i) => (
        <ToolCallCard
          key={s.id || i}
          name={s.name}
          args={s.args}
          result={s.result}
          status={s.status}
          connector={s.connector}
          connectorName={s.connectorName}
          connectorColor={s.connectorColor}
          degraded={s.degraded}
          citations={s.citations}
        />
      ))}
    </div>
  );
}

function FlowTab({ flow }) {
  const item = flow.flowItem;
  if (!flow.active || !item) {
    return (
      <EmptyState
        icon={Workflow}
        title="No workflow running"
        body="Start a workflow from the chat (Time off, Laptop request, etc.) and its full step-by-step timeline will appear here."
      />
    );
  }
  // Render a read-only mirror of the inline FlowTimeline. The actual
  // interactive flow card still lives in the chat thread — this view is
  // for keeping the whole step list visible while you scroll the messages.
  if (item.stepMachine) {
    return (
      <div style={{ padding: '10px 12px 16px' }}>
        <FlowTimeline
          flow={item}
          busy={false}
          // Interactive callbacks intentionally no-op'd here — the dock is a
          // read-only mirror. Submissions happen inline in the chat thread.
          onFormSubmit={() => {}}
          onConfirm={() => {}}
          onCancel={() => {}}
          onPhotoValidate={() => {}}
          onPhotoAccept={() => {}}
          onPhotoRetake={() => {}}
        />
      </div>
    );
  }
  return (
    <EmptyState
      icon={Workflow}
      title="Workflow active"
      body={item.name || 'A workflow is running. Its inline card in the chat shows the current step.'}
    />
  );
}

function TraceTab({ trace }) {
  const item = trace.traceItem;
  if (!item) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No trace yet"
        body="Ask anything and Navigator's routing decision — which expert, MCP, or workflow it chose — will appear here for inspection."
      />
    );
  }
  return (
    <div style={{ padding: '12px 12px 16px' }}>
      <TraceCard
        route={item.route}
        intent={item.intent}
        connectors={item.connectors}
      />
    </div>
  );
}

function ConnectionsTab({ connections, onChanged }) {
  return (
    <div style={{ padding: '4px 0' }}>
      <ConnectionsPanel connections={connections} onChanged={onChanged} />
    </div>
  );
}
