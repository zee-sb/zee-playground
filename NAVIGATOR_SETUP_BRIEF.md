# Brief: Navigator Setup Discovery Prototype

## What to build

A new React prototype called **Navigator Setup** (`/prototypes/navigator-setup`).

The premise: when a customer gets Navigator, they should not have to configure it from scratch. This prototype demonstrates an "instant setup" flow — hit one button, discover everything about their Staffbase instance, and get a ready-made Navigator configuration proposal (Assistants, context prompts, knowledge links) they can review and accept with one click.

---

## Prototype location

- Component: `src/prototypes/NavigatorSetup/NavigatorSetupStudio.jsx`
- API handler: `api/navigator-setup.mjs`
- Register in `src/App.jsx` → `PROTOTYPES` array (id: `navigator-setup`, epic: `Navigator`, status: `ready`)

---

## Existing infrastructure to reuse

These files already exist — **do not reimplement them**:

| What | Path |
|------|------|
| Staffbase API client (posts, channels, users, search) | `lib/staffbase.mjs` |
| Auth header / BASE URL pattern | `lib/staffbase.mjs` — `authHeader()` + `get()` |
| Env var for API token | `STAFFBASE_API_TOKEN` |
| Staffbase design shell | `src/components/StudioShell.jsx` |
| Lucide icons already imported across prototypes | use same icon set |

Look at `src/prototypes/StaffbaseCompanion/` and `src/prototypes/Navigator/NavigatorStudio.jsx` to understand the shell and tab patterns before writing a single line.

---

## Backend: `api/navigator-setup.mjs`

Create a single Netlify serverless function that exposes two actions via `?action=` query param.

### `GET /api/navigator-setup?action=discover`

Runs the full discovery pass against the live Staffbase instance. Returns a structured payload:

```json
{
  "spaces": [...],        // list of spaces/channels with name, id, post count
  "topPosts": [...],      // top 20 posts by engagement (likes + comments)
  "recentPosts": [...],   // 20 most recent posts
  "channels": [...],      // all published channels with metadata
  "topicClusters": [...], // LLM-derived topic clusters (see below)
  "proposedAssistants": [...] // derived from topic clusters
}
```

To build this:

1. Call `listChannels()` from `lib/staffbase.mjs`
2. Call `listRecentPosts({ limit: 50 })` from `lib/staffbase.mjs`
3. Sort posts by `likes + comments` to find topPosts
4. POST to OpenAI (`process.env.OPENAI_API_KEY`, model `gpt-4o-mini`) with the channel list + top post titles/teasers. Ask it to:
   - Identify 3–7 topic clusters (e.g. "HR & Benefits", "IT & Tooling", "Company News", "Leadership Updates")
   - For each cluster: name, 2-sentence description, icon suggestion (Lucide name), list of matching channel IDs, sample post titles
   - Propose a Navigator Assistant for each cluster with: `name`, `description`, `systemPromptSnippet`, `knowledgeSources` (array of channel names + links)
5. Return the full payload as JSON

Use `process.env.OPENAI_API_KEY` which is already in `.env`.

### `GET /api/navigator-setup?action=search-preview&query=<term>`

Takes a `query` param, calls `searchPosts({ query, limit: 5 })` from `lib/staffbase.mjs`, and returns `{ query, results, hasResults }`. Used by the search preview panel.

---

## Frontend: `NavigatorSetupStudio.jsx`

Single-file React component. No sub-files needed unless it grows past ~400 lines. Use `useState` for all state.

### Layout

Use the `StudioShell` wrapper (already exists at `src/components/StudioShell.jsx`).

Three phases rendered in sequence, not as tabs — each phase becomes visible after the previous one completes:

---

### Phase 1 — Discover (always visible, top of page)

A hero card with:
- Title: "Navigator Setup"
- Subtitle: "Discover your intranet and generate a ready-to-use Navigator configuration."
- Big purple `Discover My Instance` button (primary, `#7C3AED`)
- When clicked: button shows spinner + "Discovering…", hits `GET /api/navigator-setup?action=discover`
- While loading: animated skeleton cards below (3 placeholder cards)
- On success: transitions to Phase 2

---

### Phase 2 — Discovery Results

Shown after successful discovery. Two columns:

**Left column — "What we found"**
- Stat cards (3 in a row): Total Channels · Total Posts Analyzed · Topic Clusters Found
- Channel list: scrollable list of all channels with their post count
- Top posts: top 5 posts by engagement, each showing title, channel, likes+comments count

**Right column — "What employees are reading"**
- A small search preview widget: text input + "Preview" button
  - On submit: calls `?action=search-preview&query=<term>`, shows top 5 results
  - Each result: title, channel, teaser excerpt, link chip
  - If no results: red "No content found for this topic" chip — this is the gap signal
- Below: pre-populated with the top 3 topic cluster names as suggestion chips users can click to instantly search

---

### Phase 3 — Proposed Configuration

Shown below Phase 2 after discovery completes. Title: "Proposed Navigator Setup".

For each proposed Assistant (3–7 cards in a responsive grid):

```
┌─────────────────────────────────────┐
│ [Icon]  Assistant Name              │
│         Brief description           │
│                                     │
│  System prompt snippet (monospace,  │
│  collapsible, max 3 lines shown)    │
│                                     │
│  Knowledge Sources:                 │
│  • [Channel Name →] (link chip)     │
│  • [Channel Name →] (link chip)     │
│                                     │
│  [✓ Include in Setup]  (toggle)     │
└─────────────────────────────────────┘
```

Toggling a card checks/unchecks it. All start checked.

Below all cards: a sticky footer bar with:
- "X of Y Assistants selected"
- `Apply Configuration` button — on click, saves to `localStorage` key `navigator-config` in the same format that `NavigatorStudio` uses (look at `src/prototypes/AIAssistant/useConfigStore.js` to see the schema). Show a success toast: "Configuration applied — open Navigator Studio to review."
- Secondary link: "Open Navigator Studio →" that navigates to `/prototypes/navigator-studio`

---

## Design system

Follow all existing conventions:
- Background: `#F5F5F7`
- Surface (cards): `#FFFFFF`
- Primary: `#7C3AED`
- Border: `#E4E4E7`
- Text primary: `#18181B`
- Text muted: `#71717A`
- Success green: `#166534` on `#DCFCE7`
- Border radius on cards: `rounded-2xl`
- Shadows: `shadow-sm` → `shadow-xl` on hover
- Font: system sans (no custom import needed, Tailwind default)

All Tailwind classes. No inline styles except where Tailwind can't reach (e.g. exact hex for the primary color).

---

## Error states

- If `STAFFBASE_API_TOKEN` is missing: show a yellow warning banner at top — "Staffbase API token not configured. Set STAFFBASE_API_TOKEN in .env to enable live discovery."
- If the discovery call fails: show an error card with the error message + a Retry button
- If OpenAI call fails: still show the raw discovery data (channels + posts), but replace the AI-derived clusters with a fallback: one Assistant per channel, name = channel name

---

## Registration in App.jsx

Add to the `PROTOTYPES` array:

```js
import NavigatorSetupStudio from './prototypes/NavigatorSetup/NavigatorSetupStudio'

{
  id: "navigator-setup",
  title: "Navigator — Setup Wizard",
  description: "One-click instance discovery: analyzes your Staffbase channels and posts, clusters content into topics, and proposes a ready-made Navigator configuration with named Assistants, context prompts, and knowledge sources.",
  epic: "Navigator",
  status: "ready",
  icon: Zap,   // import Zap from 'lucide-react'
  component: NavigatorSetupStudio
}
```

Place it **first** in the PROTOTYPES array — it's the entry point to the whole Navigator setup flow.

---

## Build & test checklist

1. `npm run dev` — confirm prototype loads at `/prototypes/navigator-setup`
2. Click Discover — verify spinner appears, API call fires
3. Confirm channels + posts render in Phase 2
4. Confirm search preview works for at least one query (try "benefits" or "IT")
5. Confirm empty-search state shows the "No content found" chip
6. Confirm Phase 3 cards render with toggles
7. Click Apply — open `/prototypes/navigator-studio` and confirm Assistants list populated
8. `npm run build` — must complete with no errors

---

## Notes

- The `api/navigator-setup.mjs` function follows the same pattern as `api/orchestrate.mjs` — look there for the Netlify serverless function structure (export default async function handler(req, res)).
- Keep the OpenAI prompt compact — send channel names + top 20 post titles/teasers only. Don't send full post content (token cost + latency).
- The `searchPosts` function in `lib/staffbase.mjs` does keyword matching on title/teaser — make this clear to users ("Preview how Navigator would find content for a topic").
