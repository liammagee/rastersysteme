# rastersysteme

Swiss 60-column grid slide system. Markdown → PPTX/HTML with Claude-directed design.

## Quick Start

```bash
npm start              # interactive CLI wizard
npm test               # run all tests
npm run ui             # web dashboard (port 8800)
node pipeline.js       # staged pipeline: split → design → compose → render
```

## Architecture

```
content/week-N/*.md    → source markdown (one file per week)
  ↓ compose.js         → Claude designs grid layouts (JSON directives)
*.composed.md          → markdown with design directives injected
  ↓ raster.js          → renders to HTML + PPTX
decks/*.html           → final slide decks
```

## Key Files

| File | Role |
|------|------|
| `raster.js` | Core renderer — PPTX + HTML, themes, layouts, 60-col grid |
| `compose.js` | Claude-directed composition (JSON directives approach) |
| `pipeline.js` | Staged pipeline: split → design → compose → render |
| `server.js` | Web dashboard UI |
| `compare.js` | Multi-variant comparison with rubric evaluation |
| `qa.js` | Markdown-level QA (WCAG, design scoring, validation) |
| `qa-html.js` | Headless browser QA via Puppeteer |
| `qa-live.js` | Injectable browser audit overlay (press A in deck) |

## Rendering

```bash
# Render HTML from composed markdown
node -e "require('./raster.js').generateHTML('input.composed.md', 'output.html')"

# Render with theme
node -e "require('./raster.js').generateHTML('input.composed.md', 'output.html', {theme:'dark'})"
```

Themes: `light` (default), `dark`, `red`, `blue`
