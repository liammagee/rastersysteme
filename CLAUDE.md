# rastersysteme

Swiss 60-column grid slide system. Markdown → PPTX/HTML with Claude-directed design.

## Shell Rules

- **Never execute dynamic code via `node -e` or inline snippets.** Write scripts to a file first, validate them, then run with `node <file>`. This applies to all non-trivial code — even one-liners that do real work.
- **Never embed multi-line programs in Bash commands.** If you need a helper script (server, one-off tool), write it to a temp file first, then execute the file.
- **Never chain background servers with `&` + `sleep` + foreground commands.** Use existing project scripts (`server.js`, `qa-html.js`) or write a small orchestration script instead.
- Keep Bash commands short, single-purpose, and readable.

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
| `brief-extract.js` | Design fingerprinting — extract zone archetypes, palette, typography from composed markdown |
| `deck-audit.js` | Batch scanner: pair HTML decks with fingerprints + scores, write corpus entries |
| `corpus-synthesize.js` | Cross-deck analysis → data-driven composition rules in design-insights.md |
| `rubric-jsdom.js` | Offline rubric evaluation via jsdom (no Puppeteer/Chrome needed) |
| `run-rubric-eval.js` | Wrapper: starts temp HTTP server + runs rubric-headless evaluation |

## Rendering

```bash
# Render HTML from composed markdown
node -e "require('./raster.js').generateHTML('input.composed.md', 'output.html')"

# Render with theme
node -e "require('./raster.js').generateHTML('input.composed.md', 'output.html', {theme:'dark'})"
```

Themes: `light` (default), `dark`, `red`, `blue`

## Skills

> **Start here:** `/rs:help` — context-aware skill navigator. Scans your deck state and suggests what to do next.

**Composition & rendering:**

| Skill | Description |
|-------|-------------|
| `/rs:compose <source.md>` | Claude-directed composition with design directives |
| `/rs:build-deck <source.md>` | Full pipeline: compose → render → evaluate → fix → converge |
| `/rs:render <deck.composed.md>` | Re-render HTML from composed markdown |
| `/rs:compare <source.md>` | Multi-variant comparison (3-way or 12-way explosive) with rubric |
| `/rs:design-system list\|show\|generate` | Manage saved design systems |

**Slide editing:**

| Skill | Description |
|-------|-------------|
| `/rs:insert-slide <deck> after N` | Add a new slide with context-aware design |
| `/rs:edit-slide <deck> slide N` | Edit content, design, bg, font, typography |
| `/rs:delete-slide <deck> slide N` | Remove slide(s) with re-render |
| `/rs:diff <before> <after>` | Visual diff between deck versions |

**Images:**

| Skill | Description |
|-------|-------------|
| `/rs:imagine <source.md>` | Generate image prompts with visual thread |
| `/rs:splice-images <deck.html>` | Merge images with collision-aware placement |

**QA & presentation:**

| Skill | Description |
|-------|-------------|
| `/rs:qa-visual <deck.html>` | A11y + design consistency audit via Chrome |
| `/rs:qa-fix-loop <deck.html>` | Autonomous audit-fix-verify cycle (design-aware) |
| `/rs:preview <deck.html> slide N` | Interactive slide browsing in Chrome |
| `/rs:studio <deck.html>` | Open studio viewer (present + grid + QA) |
| `/rs:pace <deck> --duration N` | Add timing cues to speaker notes |
| `/rs:export <deck> --pdf\|--pptx` | Export to PDF or PowerPoint |

**Design rubric (see RUBRIC.md):**

| Skill | Description |
|-------|-------------|
| `/evaluate <deck.html>` | Score deck against 8-dimension rubric (computed + visual) |
| `/design <deck.composed.md>` | Apply rubric-targeted improvements to design directives |
| `/refine-loop <deck.html>` | Recursive evaluate → design → re-render until scores plateau |
| `/audit` | Scan decks/, extract fingerprints, pair with scores, synthesize corpus insights |

**Utilities:**

| Skill | Description |
|-------|-------------|
| `/rs:help` | Skill navigator — deck state, skill guide, next steps |
| `/rs:batch <skill> [files]` | Run any skill across multiple decks |
| `/rs:promote` | Triage untracked scripts into codebase or delete |
