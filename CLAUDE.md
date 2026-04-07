# Staffbase Prototype Playground

This repo is a static prototyping site hosted on Netlify. The index page is a card gallery of all prototypes. Each prototype is a self-contained HTML file.

## Project structure

```
index.html                  ← Gallery page (card grid)
netlify.toml                ← Netlify deploy config
package.json                ← Local dev configuration
prototypes/
  <slug>.html               ← One file per prototype
```

## Development

Run the local development server:
```bash
npm install  # if first time
npm run dev  # starts server on http://localhost:3456
```

## How to add a new prototype

When asked to create a prototype for a Staffbase feature or epic, do **both** of the following:

### 1. Create the prototype HTML file

Create `prototypes/<slug>.html` where `<slug>` is a short kebab-case identifier (e.g. `onboarding-checklist`, `search-redesign`).

Every prototype file must include:

**a) The prototype nav bar** — copy this shell at the top of `<body>`, filling in the title, epic, and status tags:

```html
<nav class="proto-bar">
  <div class="proto-bar-left">
    <a class="proto-back" href="../index.html">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Gallery
    </a>
    <div class="proto-divider"></div>
    <span class="proto-title"><!-- Prototype Title --></span>
  </div>
  <div class="proto-tags">
    <span class="proto-tag tag-epic"><!-- Epic Name --></span>
    <span class="proto-tag tag-wip">In Progress</span>  <!-- tag-draft | tag-wip | tag-ready -->
  </div>
</nav>
```

Include these nav bar styles (copy from `prototypes/example-navigation-redesign.html`):
`.proto-bar`, `.proto-back`, `.proto-bar-left`, `.proto-divider`, `.proto-title`, `.proto-tags`, `.proto-tag`, `.tag-epic`, `.tag-draft`, `.tag-wip`, `.tag-ready`

**b) A header section** with the prototype title and a one-paragraph description of what's being explored.

**c) The actual prototype UI** — interactive HTML/CSS. Keep everything self-contained (no external JS frameworks, no CDN dependencies). Vanilla HTML, CSS, and JS only.

### 2. Register the prototype in index.html

Open `index.html` and add a new entry to the `PROTOTYPES` array (just above the `// ── ADD NEW PROTOTYPES ABOVE THIS LINE ──` comment):

```js
{
  id: "<slug>",
  title: "Human-readable title",
  description: "One or two sentences describing what this prototype explores.",
  epic: "Epic Name",          // e.g. "Navigation", "Onboarding", "Analytics"
  status: "wip",              // "draft" | "wip" | "ready"
  date: "YYYY-MM-DD",         // today's date
  emoji: "🧩",                // relevant emoji for the card thumbnail
  thumbBg: "#EDE9FE",         // thumbnail background colour (pick one that fits the epic)
  file: "prototypes/<slug>.html"
},
```

**Note on dependencies:** This project is intentionally kept simple. Use `package.json` only for local development tools (like the static server). Do not add build steps or runtime dependencies that would require a compilation step for the static HTML files.

## Epic colour palette (for thumbBg)

| Epic          | thumbBg   |
|---------------|-----------|
| Navigation    | `#EDE9FE` |
| Onboarding    | `#DCFCE7` |
| Analytics     | `#FEF9C3` |
| Notifications | `#FFE4E6` |
| Content       | `#E0F2FE` |
| Search        | `#FEF3C7` |
| Mobile        | `#F0FDF4` |
| Admin         | `#F1F5F9` |
| (new epic)    | pick a light pastel |

## Staffbase context

These prototypes are created in the context of Staffbase product work. Common epics include navigation, onboarding flows, content authoring, analytics dashboards, notifications, and admin tooling. Prototypes should reflect the Staffbase app shell where relevant (dark sidebar, white main area, purple accent `#7C3AED`).
