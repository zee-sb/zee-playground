// Presentation registry — maps a PresentationHint.kind to a React component.
//
// Components consume clean adapter shapes. They do NOT read orchestrator
// internals (tier1.kind, intent.reasoning, raw NDJSON events). The
// chat-adapter translates events into RenderItems before they reach here.
//
// Today: the registry is bootstrap. Existing component implementations live
// at src/prototypes/StaffbaseCompanion/{CardRouter, FlowCard, ToolCallCard,
// TraceCard}.jsx. They migrate into this directory in a follow-up. The
// registry as defined here is intentionally tiny — adopt incrementally by
// pointing render switches at `lookup(kind)`.

/** @typedef {{ kind: string, props?: object }} PresentationHint */

const REGISTRY = new Map();

/**
 * Register a component for a `PresentationHint.kind`. Last write wins —
 * call sites may override registry entries during testing or theming.
 */
export function register(kind, Component) {
  REGISTRY.set(kind, Component);
}

/**
 * Look up a component for a kind. Returns `null` if no component is
 * registered — callers should render a generic fallback (e.g. JSON
 * pretty-print with a "raw" badge).
 */
export function lookup(kind) {
  return REGISTRY.get(kind) || null;
}

/**
 * Snapshot of all registered kinds — useful for debug overlays / docs.
 */
export function listRegisteredKinds() {
  return [...REGISTRY.keys()];
}

// Seed kinds the team should expect (Staffbase server already emits these
// via legacy {cards: { type: ... }}; once Phase 3 envelope migration lands,
// they arrive via PresentationHint.kind directly):
//
//   - "user"        single user profile
//   - "user-grid"   list/grid of users (employee directory)
//   - "post"        single Staffbase post
//   - "post-list"   list of posts
//   - "kpi"         single big number + delta
//   - "leaderboard" ranked list (analytics)
//   - "timeline"    time-bucketed sequence
//   - "chart"       Chart.js-shaped {kind, title, labels, datasets}
//   - "capabilities"  tool/agent inventory display
//   - "mixed"       polymorphic composite
//   - "form"        flow form step (renders FormStep.spec)
//   - "confirm-summary"  flow confirm step
//   - "flow-card"   flow progress card
//   - "flow-suggestion-chip"  suggested-mode start chip
//
// Concrete components register themselves at module load. Until that
// migration completes, the existing ChatPanel switches continue to work
// unchanged — this registry is purely additive.
