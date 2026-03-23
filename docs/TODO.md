# rastersysteme — TODO

## Completed

- [x] compare.js — multi-style comparison and evaluation
- [x] RUBRIC schema (7 criteria, 100 total points)
- [x] Variant runner (compose × 3 intensities)
- [x] Evaluation prompt builder + parser
- [x] Comparison report generator (3-column HTML with slide previews)
- [x] CLI with --skip-eval, --no-pptx, --theme, --model, --slides flags
- [x] Content completeness rules in intensity prompts
- [x] adaptThemeForBg in generateHTML and generateReview
- [x] Font/style/bg overrides in compare report previews
- [x] WCAG AA colour contrast across all themes (0 errors)
- [x] QA tool (a11y, design scoring, layout validation, intensity compliance)
- [x] Studio viewer (present/grid/QA modes)
- [x] Incremental compose (batched, resumable, 5 stages)
- [x] Stall detection + auto-retry for Claude calls
- [x] Persistent logging on all failure paths
- [x] Parameterised design directive (<!-- design: {...} -->)
- [x] Image generation (imagine.js) + splicing (splice-images.js)
- [x] npm start wizard with full pipeline integration
- [x] 192 tests

## Priority 1 — Design quality

### Design directive adoption
Claude often falls back to `<!-- layout: -->` instead of `<!-- design: {...} -->`.
- [ ] Post-compose validation: check % of slides using design vs layout directives
- [ ] Warning if < 80% of slides use design directives
- [ ] Retry/repair step: re-send non-design slides with explicit instruction
- [ ] Add design directive examples to each intensity prompt (concrete JSON)

### Cross-batch coherence
Batched composition breaks chromatic/layout arcs at batch boundaries.
- [ ] Include "context summary" with each batch: previous batch's bg colours,
      layouts used, font choices, accent positions — so the next batch continues
- [ ] Validate chromatic arc continuity post-assembly (no sudden jumps)
- [ ] Option to re-compose specific batches while keeping others cached

### Design system reuse
Each compose run generates a new design system. Need brand consistency.
- [ ] `--design-system <path>` flag to load a saved design-system.json
- [ ] `npm run compose -- slides.md --save-design` to export the system
- [ ] Design system library: save/name/list/apply design systems
- [ ] Design system preview: render sample slides showing the system

## Priority 2 — Presentation quality

### Presenter mode (dual-window)
- [ ] HTML slideshow opens second window for speaker notes
- [ ] BroadcastChannel API syncs slide navigation between windows
- [ ] Notes window shows: current notes, next slide preview, elapsed timer
- [ ] Countdown timer option (set presentation duration)
- [ ] Slide progress bar in notes window

### Slide transitions
- [ ] Crossfade between slides (300ms default, configurable)
- [ ] Per-slide transition override via design directive
- [ ] Transition options: fade, slide-left, slide-up, none
- [ ] Respect `prefers-reduced-motion` media query

### PDF export
- [ ] `--format pdf` flag using Puppeteer to screenshot HTML slides
- [ ] One page per slide, landscape, 16:9
- [ ] Speaker notes as PDF annotations or appendix pages
- [ ] Batch export: `npm run batch -- pdf ./decks`

## Priority 3 — Developer experience

### Hot reload / watch mode
- [ ] `npm run compose -- slides.md --watch` re-renders on .composed.md change
- [ ] Uses fs.watch + debounce (300ms)
- [ ] Browser auto-refreshes via injected WebSocket or LiveReload
- [ ] Shows incremental render time after each change

### Visual diff between versions
- [ ] Compare two .composed.md files side-by-side
- [ ] Highlight slides where design directives differ
- [ ] Show palette/font/layout changes as a summary
- [ ] Integrate into compare report as "before/after" mode

### HTML/PPTX rendering parity
- [ ] Audit CSS color rules that hard-code values instead of using var()
- [ ] Ensure design directive renders identically in HTML and PPTX
- [ ] Test: generate both formats, screenshot HTML, compare visually
- [ ] Section label accent-light CSS rule conflict

## Priority 4 — Pipeline robustness

### Smarter retry logic
- [ ] Exponential backoff on repeated stalls (30s, 60s, 120s)
- [ ] Detect rate limiting vs connection failure (different retry strategies)
- [ ] Max retries per batch (currently 1, should be configurable)
- [ ] Report batch success/failure stats at end of pipeline

### Content fidelity enforcement
- [ ] Pre-compose: extract all URLs, emails, dates, percentages from source
- [ ] Post-compose: verify each token appears in output
- [ ] Auto-repair: re-inject missing tokens into the closest matching slide
- [ ] Slide-by-slide content diff (not just token presence)

### Parallel batch execution
- [ ] Run 2-3 batches in parallel (with rate limit awareness)
- [ ] Stagger start times to avoid API quota spikes
- [ ] Share rate limit state across parallel workers

## Priority 5 — Polish

### Better default rendering
`node raster.js deck.md --format html` should look great out of the box
without needing compose.js. Auto-detect content structure, apply sensible
layout variety, build a basic chromatic arc from the theme palette.
- [ ] Smart auto-layout that goes beyond the simple detection rules
- [ ] Auto bg-override on section slides (use theme.bgDark)
- [ ] Auto ### labels from slide structure (use ## heading text as label)
- [ ] Sensible layout rotation (don't default everything to split)

### README overhaul
README has grown stale vs the actual toolchain.
- [ ] Architecture diagram showing all tools and their relationships
- [ ] Quick start that actually works end-to-end
- [ ] Tool reference table with all npm scripts
- [ ] Examples section with screenshots
- [ ] Link to SPEC.md for formal format docs

### Test coverage for new tools
watch.js, diff-slides.js, pace.js, design-system.js, splice-images.js,
export-pdf.js, grid-compose.js, imagine.js have no unit tests.
- [ ] pace.js: estimateSlideWeight, paceSlides, injectTimestamps
- [ ] diff-slides.js: extractDirectives, diffSlides
- [ ] design-system.js: saveSystem, loadSystem, listSystems
- [ ] imagine.js: buildImagePrompt, parseSlideRange
- [ ] splice-images.js: placementCSS, algorithmicPlan
- [ ] compose.js: parseDirectives, assembleComposed, callClaudeWithRetry
- [ ] grid-compose.js: buildGridPrompt, renderGridSlideHTML

## Future / Nice to have

### Theme × intensity matrix
Run all intensities × all themes = 12 variants. Report as 2D matrix.

### Custom intensity axis
`--custom-brief "minimal serif"` to compare arbitrary briefs beyond
the 3 fixed intensities.

### Side-by-side slide navigator
Synchronized navigator in comparison report: advancing slides on one
column advances all three. Full JS navigation adapted to N sync decks.

### Automated best-pick
Function that takes N evaluations and returns the recommended variant
with confidence score and reasoning.

### Folder/batch comparison
Run comparison across all .md files in a folder, producing a summary
of which intensity works best for different content types.

### Template / master slide system
Define reusable slide masters (title page, section divider, content)
as design directive templates. Apply consistently across decks.

### Export to Reveal.js / Google Slides API
Alternative output formats beyond PPTX and self-contained HTML.
