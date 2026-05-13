# Navigator Flows — Implementation Brief

## What is this

Add a **Flows** system to the Navigator prototype. Flows are admin-defined, goal-driven workflows that the Navigator brain can invoke automatically when employee intent matches. The admin configures them in Navigator Studio; employees experience them in the Navigator Employee chat.

This is a **pure UI prototype** — no new backend required. All state lives in the existing `configStore` (localStorage), and flow invocation in the chat is simulated with scripted responses, just like the existing tool-call scenarios.

---

## Where things live today

| Thing | File |
|---|---|
| Admin Studio (main shell) | `src/prototypes/Navigator/NavigatorStudio.jsx` |
| Studio tabs | `src/prototypes/Navigator/tabs/` |
| Config store (data model + seed) | `src/prototypes/AIAssistant/configStore.js` |
| Config hook | `src/prototypes/AIAssistant/useConfigStore.js` |
| Employee chat | `src/prototypes/NavigatorOrchestrator/NavigatorOrchestratorStudio.jsx` |
| MCP tool catalogue | `MCP_TOOLS_BY_CATALOG` in `configStore.js` |
| Route registrations | `src/App.jsx` |

---

## Part 1 — Data model changes

### 1a. Add `flows` to `configStore.js`

Bump `CONFIG_VERSION` to `4` and add `flows: []` to the seed config.

**Flow schema:**
```js
{
  id: 'flow-abc123',           // generated on create
  name: 'Laptop Request',      // display name
  trigger: 'Employee asks for a new laptop, new equipment, or mentions their computer is broken',
  goal: 'IT ticket submitted with laptop model, OS preference, and delivery address confirmed',
  tools: [                     // array of { connectorId, toolId } pairs OR agentId strings
    { connectorId: 'acme_it', toolId: 'createTicket' },
    { connectorId: 'acme_it', toolId: 'getEquipment' },
  ],
  mode: 'suggested',           // 'suggested' | 'required'
  instructions: 'Ask for role first to recommend the right laptop tier.',  // optional
  onComplete: null,            // optional: string note like 'notify IT manager'
  status: 'active',            // 'active' | 'draft'
}
```

**Seed flows (3 examples to populate the demo):**

1. **Laptop Request** — trigger: `employee asks for a new laptop or equipment`, tools: `acme_it.createTicket + acme_it.getEquipment`, mode: `suggested`
2. **Request Time Off** — trigger: `employee wants to book leave, holiday, or PTO`, tools: `acme_hr.requestPto + acme_hr.getPtoBalance`, mode: `suggested`
3. **New Joiner Onboarding** — trigger: `employee just joined or says they are new, or asks what they need to do to get started`, tools: `acme_hr.getEmployee + acme_it.createTicket + acme_it.requestSoftware`, mode: `required`, instructions: `Check HR first to understand their role. Work through one step at a time.`

### 1b. Update `useConfigStore.js`

Add `setFlows` setter, mirroring the pattern of `setMcpConnectors`, `setExternalAgents`, etc.

---

## Part 2 — Admin Studio: Flows tab

### 2a. Add tab to `NavigatorStudio.jsx`

Add to the `TABS` array (after `kb`, before `workspace`):
```js
{ id: 'flows', label: 'Flows', icon: Workflow }  // Workflow icon from lucide-react
```

Add routing in the tab content section:
```jsx
{activeTabId === 'flows' && !detailFlow && (
  <FlowsList flows={config.flows || []} onSelect={handleSelectFlow} onCreate={handleCreateFlow} />
)}
{activeTabId === 'flows' && detailFlow && (
  <FlowDetail
    flow={detailFlow}
    isNew={detailFlowIsNew}
    mcpConnectors={config.mcpConnectors}
    externalAgents={config.externalAgents}
    onBack={() => navigate(`${basePath}/flows`)}
    onSave={handleSaveFlow}
    onDelete={handleDeleteFlow}
  />
)}
```

Wire up `handleCreateFlow`, `handleSelectFlow`, `handleSaveFlow`, `handleDeleteFlow` exactly like the existing assistant CRUD pattern.

Also update `ConfigSummary` to include a Flows stat.

### 2b. Create `src/prototypes/Navigator/tabs/FlowsList.jsx`

List view. Mirrors the style of `AssistantsList.jsx`.

Each flow card shows:
- Flow name (bold) + status badge (`active` = green pill, `draft` = grey)
- Trigger text (truncated, italic, grey)
- Mode badge: `suggested` (blue outline) or `required` (orange solid)
- Tool count: e.g. "2 tools"
- Click → opens FlowDetail

Empty state: "No flows yet. Create your first flow to guide employees through tasks." + Create button.

Header: "Flows" title + "New flow" button (purple, top-right).

### 2c. Create `src/prototypes/Navigator/tabs/FlowDetail.jsx`

Full-page form for creating/editing a flow. Same layout as `AssistantDetail.jsx` (left form, right preview panel).

**Left side — form fields:**

| Field | Input type | Notes |
|---|---|---|
| Name | text input | e.g. "Laptop Request" |
| Status | toggle | active / draft |
| Mode | segmented control (2 options) | `Suggested` / `Required`. Show a one-liner explanation under each. |
| Trigger | textarea (2 rows) | Label: "When should Navigator start this flow?" Placeholder: "Employee asks for a new laptop or mentions their computer is broken." |
| Goal | textarea (3 rows) | Label: "What does completion look like?" Placeholder: "IT ticket submitted with laptop model, OS preference, and delivery address." |
| Instructions | textarea (2 rows), optional | Label: "Additional guidance for the AI" Placeholder: "Ask for the employee's role first to suggest the right laptop tier." |
| On complete | text input, optional | Label: "On completion" Placeholder: "Notify IT manager" |

**Tools picker (the key piece):**

Label: "Tools available in this flow"
Subtext: "Select from your connected MCPs and agents. The Navigator brain can only use what you give it."

Render a grouped checklist:
- One group per connected MCP connector (`status === 'connected'`), showing the connector name and logo chip as a group header
- Under each group: individual tools from `connector.tools[]`, each as a checkbox row showing `tool.name` + `tool.description`
- A second section "External Agents" lists connected agents as single-item checkboxes (the whole agent is the tool)
- Unchecked by default on new; pre-checked on edit based on `flow.tools[]`

If no connectors are connected: show a muted notice "No connectors connected yet — go to MCP Connectors to add some."

**Right side — preview panel:**

Show a read-only card that renders the current form state as a flow definition preview. Style it like the code block in the existing `FlowsTab.jsx`, using the dark terminal style (`bg-[#111827]`, green text).

```
trigger:      Employee asks for a new laptop...
goal:         IT ticket submitted with...
tools:        acme_it.createTicket, acme_it.getEquipment
mode:         suggested
instructions: Ask for role first...
```

Below the preview card, show a "Trace simulation" section: a small chat bubble sequence showing what the employee would see when this flow is invoked. Two messages: Navigator saying "I can help with that — let me start a laptop request" and a second bubble showing a form-like confirmation. This is purely cosmetic/illustrative, no interaction needed.

**Footer actions:** Save (primary, purple) + Delete (destructive, only on existing flows) + Back link.

---

## Part 3 — Employee chat: Flow invocation

File: `src/prototypes/NavigatorOrchestrator/NavigatorOrchestratorStudio.jsx`

### 3a. Suggestion chips

The chip picker already uses `pickRoleChips()` from `chipRules.js`. Add a new chip source: active flows from `config.flows`.

In the initial launchpad chip area, active flows with `mode: 'suggested'` should appear as chips alongside the existing role chips. Chip label = flow name. Chip style: use a distinctive purple/violet tint (e.g. `bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]`) so they're visually distinct from tool chips.

When an employee taps a flow chip, inject the flow's trigger text as the user message and proceed to the scripted flow response (see 3b).

### 3b. Scripted flow response

When a message matches a flow trigger (simple string-match heuristic: does the message contain any notable word from the trigger?), display a special "flow invocation" message instead of a plain AI bubble.

The flow invocation message has two parts:
1. A **flow header banner** at the top of the message, styled distinctively:
   - Small label: "Flow" (purple badge)
   - Flow name in bold
   - Mode badge: "Suggested" or "Required"
   - Goal text in small grey italic below

2. Below the banner, a **normal AI text bubble** with a contextual opening line, e.g.:
   - Laptop Request: *"I'll help you get that sorted. To make sure we request the right model, what's your role — are you in engineering, sales, or ops?"*
   - Time Off: *"Happy to help you book some time off. Let me check your PTO balance first..."* followed by a simulated tool-call card showing `getPtoBalance` running.
   - New Joiner Onboarding: *"Welcome! I'll walk you through getting set up. There are a few things we need to take care of — I'll go one at a time so it doesn't feel overwhelming."*

Write 3 scripted flow conversations (one per seed flow) as entries in a `FLOW_SCENARIOS` object, keyed by flow id. Each scenario has:
```js
{
  opening: 'string',              // first AI message
  toolCall: { name, args } | null, // optional simulated tool call to show
  followUp: 'string',             // second AI message after tool call (or just a second turn)
}
```

### 3c. Required flow blocking (visual only)

If a `required` flow is active and the employee tries to send a free-text message mid-flow, show a soft inline notice: *"Complete this flow first, or type 'skip' to dismiss it."* No actual blocking logic needed — just a one-time appearance after the first non-flow message, then it disappears.

### 3d. Flow indicator in chat header

While a flow is "active" (i.e. the last AI message was a flow invocation), show a subtle pill in the chat header:

```
[Flow: Laptop Request ×]
```

Clicking × dismisses the flow (clears the indicator, no other state change). This reinforces the "bounded session" concept visually.

---

## Part 4 — Navigator Studio right rail update

The existing "View as" right rail in `NavigatorStudio.jsx` should show active flows for the selected user.

Add a new `ImpactSection` after the existing ones:
```
icon: Workflow
title: "Flows available"
count: active flows count
```

List each active flow with its name and mode badge. No audience filtering needed for flows (they're workspace-wide for the prototype).

---

## Out of scope for this prototype

- AI-generated flow definition from natural language description (that's the "Admin + AI assist" authoring mode — save for next iteration)
- Real intent matching (use simple string heuristic, same as the existing `planRoute` function)
- Persistent flow state across sessions (flow progress is not saved)
- Per-flow audience targeting

---

## Acceptance checklist

- [ ] Admin can create a flow with all 5 fields + tool picker
- [ ] Tool picker shows grouped checkboxes from all connected MCP connectors
- [ ] Flow definition preview updates live as admin types
- [ ] 3 seed flows appear on first load
- [ ] Flows tab appears in Navigator Studio nav
- [ ] Active flows appear in the right-rail "View as" panel
- [ ] Employee chat shows flow chips in the launchpad
- [ ] Tapping a flow chip invokes the scripted flow response with flow header banner
- [ ] Flow indicator appears in chat header while flow is active
- [ ] Required flows show the soft blocking notice
- [ ] No TypeErrors — all new fields have safe defaults/fallbacks
