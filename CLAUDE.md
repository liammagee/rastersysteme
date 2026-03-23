# rastersysteme

Swiss 60-column grid slide system. Markdown → PPTX/HTML with Claude-directed design.

## Skills

### /qa-visual
Run a visual accessibility audit on an HTML slideshow using Claude in Chrome.
Opens the slideshow, screenshots each slide, checks computed contrast ratios,
overflow, broken images. Reports findings with screenshots of problem slides.

Usage: `/qa-visual decks/week-1.html`

### /qa-fix-loop
Autonomous a11y fix cycle: audit → analyze → fix code → re-render → verify.
Uses Chrome for auditing AND repo access for fixing. Continues until all
issues are resolved or the user stops it.

Usage: `/qa-fix-loop decks/week-1.html`

## Key files

- `raster.js` — core renderer (PPTX + HTML), themes, layouts, grid system
- `compose.js` — Claude-directed composition (JSON directives approach)
- `compare.js` — multi-variant comparison with rubric evaluation
- `rastersysteme.js` — interactive CLI wizard (`npm start`)
- `qa.js` — markdown-level QA (WCAG, design scoring, validation)
- `qa-html.js` — headless browser QA via Puppeteer
- `qa-live.js` — injectable browser audit overlay (press A)
- `SPEC.md` — formal markdown slide specification

## Conventions

- All tools use `chalk.dim/red/cyan/green/yellow` for console output (standard ANSI)
- Tests in `raster.test.js` (core) and `tools.test.js` (tools) — run with `npm test`
- Design systems saved in `design-systems/`, master sets in `master-sets/`
- Composed markdown uses `<!-- layout: name -->`, `<!-- bg: HEX -->`, `<!-- font: Name -->`, `<!-- transition: name -->`
