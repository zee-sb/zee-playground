# Staffbase Prototype Playground

This repo is a React-based prototyping site hosted on Netlify. It uses Vite for development and production builds.

## Project structure

```
index.html                  ← Vite entry point
src/
  App.jsx                   ← Prototype Studio Hub (routing & gallery)
  main.jsx                  ← Main entry point (React mount + Global API)
  prototypes/               ← Modern React-based prototypes
  chat-widget/              ← Production Chat Widget components
prototypes/
  legacy-gallery.html       ← Backup of old landing page
  *.html                    ← Legacy standalone HTML prototypes
dist/                       ← Build output (published to Netlify)
```

## Development

Run the local development server:
```bash
npm install  # if first time
npm run dev  # starts Vite on http://localhost:3456
```

## How to add a new prototype (Modern Way)

To add a new prototype using React and production components:

1. **Create the component**: Create `src/prototypes/MyNewProto.jsx`.
2. **Import Components**: Use production components like `ChatWidget` directly.
3. **Manage State**: Use React `useState` for full interactivity (adding, deleting, simulating).
4. **Register in App.jsx**: Add the new prototype to the `PROTOTYPES` array in `src/App.jsx`.

## Legacy Prototypes

Older prototypes are kept in the `prototypes/` directory as standalone HTML files. These are linked from the Studio Hub and open as direct browser navigations.

## Deployment

The site is built using Vite and deployed to Netlify.
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Hosting**: Netlify (configured in `netlify.toml`)

## Staffbase Context

Prototypes should reflect the Staffbase app shell where relevant (dark sidebar, white main area, purple accent `#7C3AED`).
- **Primary Color**: `#7C3AED`
- **Background**: `#F5F5F7`
- **Surface**: `#FFFFFF`
