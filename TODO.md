# rastersysteme — TODO

## Active

### compare.js — Multi-style comparison and evaluation
- [x] Architecture blueprint (see compare.js header)
- [ ] RUBRIC schema (7 criteria, 100 total points)
- [ ] Variant runner (compose × 3 intensities → composed.md + HTML + PPTX)
- [ ] Evaluation prompt builder (source + composed + mechanical QA → Claude)
- [ ] Evaluation parser (JSON extraction with fence-stripping and fallback)
- [ ] Evaluator (calls Claude per variant, scores against rubric)
- [ ] Comparison report generator (3-column HTML with slide previews, rubric table, strengths/weaknesses)
- [ ] CLI with --skip-eval, --no-pptx, --theme, --model flags
- [ ] compare.test.js (rubric integrity, prompt builder, parser, report structure)
- [ ] Package.json: add "compare" script and bin entry

### Content completeness at radical intensity
- [x] Updated INTENSITY.radical to distinguish design radicalism from content deletion
- [x] Added rule 4b (content completeness)
- [ ] Validate with A/B comparison across multiple source files

### HTML/PPTX rendering parity
- [x] adaptThemeForBg applied in generateHTML
- [x] Removed !important from title/section CSS
- [x] Fixed fontStyle || bgStyle merge bug
- [x] Applied adaptThemeForBg in generateReview
- [ ] Audit remaining CSS color rules that hard-code values instead of using var()
- [ ] Section label accent-light CSS rule conflict (line 1385 vs 1445)

### Presenter view (dual-window notes sync)
- [ ] HTML slideshow opens second window for speaker notes
- [ ] BroadcastChannel API syncs slide navigation between windows
- [ ] Notes window shows: current notes, next slide preview, timer
- [ ] Investigate integration with machinespirits-ide presenter tool

## Future

### Theme × intensity matrix
Run `faithful/moderate/radical × light/dark/red/blue` = 12 variants.
Report needs a 2D matrix view. `runVariants` function signature should
accept `options.themes: string[]`.

### Custom intensity / brief axis
`--custom-brief "minimal serif" --custom-brief "aggressive brutalist"` to
compare arbitrary briefs beyond the 3 fixed intensities.

### Incremental evaluation
`--skip-compose` flag: if .composed.md files already exist, skip Claude
composition and only run evaluation. Saves 3× ~5 minutes when iterating
on rubric or report format.

### Side-by-side slide navigator
Synchronized navigator in comparison report: advancing slides on one
column advances all three simultaneously. Requires the full JS navigation
logic from generateHTML adapted to 3 synchronous decks.

### Export comparison report to PDF
wkhtmltopdf or puppeteer conversion. Too heavy a dependency for now.

### Automated best-pick
Function that takes 3 evaluations and returns the recommended variant
with confidence score and reasoning. Straightforward once score structure
is stable.

### rastersysteme.js integration
Add `[v] compare variants` option to the post-render interactive menu.

### Folder/batch mode for compare
Run comparison across all .md files in a folder, producing a summary
report of which intensity works best for different content types.
