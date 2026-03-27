# Code Conventions

- **Never use smart/curly quotes** (`"" ''` U+201C–201F) in code, JSON, markdown, or composed files. Always use straight ASCII quotes (`"` `'`). Smart quotes silently break JSON parsing in design directives.
- All CLI tools use `chalk.dim/red/cyan/green/yellow` for console output (standard ANSI)
- Tests live in `raster.test.js` (core) and `tools.test.js` (tools) — run with `npm test`
- Node.js built-in test runner (no Jest/Mocha)
- Design systems saved in `design-systems/`, master sets in `master-sets/`
- Content lives in `content/week-N/`, composed output in `decks/`
- HTML files are generated (gitignored except `index.html` and `ballistic-computer-sim.html`)
- PPTX files are generated (gitignored)
- Composed markdown (`*.composed.md`) is generated (gitignored)
