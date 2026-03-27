---
name: build-deck
description: End-to-end deck builder — compose with opus, render, then loop evaluate/design/re-render until rubric scores converge. One command to go from source markdown to polished deck.
user_invocable: true
---

# Build Deck

Full pipeline: **compose (opus) → render → evaluate → design-fix → re-render → re-evaluate → repeat**.

Converges when all rubric dimensions hit target or scores plateau.

## Arguments

`/build-deck content/week-2/week-2.md`
`/build-deck content/week-2/week-2.md --target 9 --max 5`
`/build-deck content/week-2/week-2.md --brief "warm editorial, deep navy dividers"`
`/build-deck content/week-2/week-2.md --theme dark --intensity maximal`

Defaults: target=8 per dimension, max iterations=4, model=opus, theme=light, intensity=moderate.

## How to work

### Phase 1: Compose (opus)

```bash
node compose.js <source.md> decks/<name>.composed.md --model opus [--theme T] [--intensity I] [--brief "..."]
```

Read the output. Verify:
- Design plan is coherent (palette, arc, grid strategy)
- All slides got design directives (count `<!-- design:` occurrences vs slide count)
- No smart quotes in JSON directives (fix with `sed` if found)

### Phase 2: Render, splice images, evaluate

Write a temp render script (never use inline `node -e`):

```bash
# Write to tmp file, then execute
cat > /tmp/render-deck.js << 'EOF'
const r = require('./raster.js');
r.generateHTML('decks/<name>.composed.md', 'decks/<name>.html');
console.log('OK');
EOF
node /tmp/render-deck.js
```

**Always splice images before evaluating** if an image set exists for the source content:

```bash
# Check for images
ls content/week-N/images/ content/week-N/week-N-images/ 2>/dev/null
# If found, splice them in
node splice-images.js decks/<name>.html <images-dir>
# Evaluate the spliced version
```

Start a file server if not already running (use `/tmp/serve-deck.js` or `server.js --port 8701`), then evaluate:

```bash
node run-rubric-eval.js decks/<name>.html --json
```

Record baseline scores. Print a summary table:

```
| Dimension      | Score |
|----------------|-------|
| Accessibility  |   X.X |
| Grid           |   X.X |
| Color          |   X.X |
| Coherence      |   X.X |
| Images         |   X.X |
| **Total**      | XX.X/50 |
```

### Phase 3: Refine loop

For each iteration (up to `--max`, default 4):

**a) Check convergence**
- If ALL dimensions >= target: done, report success.
- If total improved < 0.5 from previous iteration: done, diminishing returns.

**b) Identify weak dimensions**
Sort dimensions by score. Pick the bottom 2-3 below target.

**c) Apply design fixes to composed markdown**

Follow the design-polish skill and the `/design` skill patterns:

- **Low accessibility**: Check contrast — `enforceContrast` handles this in the renderer, but composition may assign problematic colors. Darken text colors in directives. Check for overflows (zones exceeding grid bounds).
- **Low grid**: Rotate zone archetypes — ensure no two adjacent slides share the same layout pattern. Vary `col` start positions (2, 4, 6, 8, not always 0).
- **Low color**: Check chromatic arc. Add/move dark divider slides at section boundaries. Ensure bg variety >= 3 unique backgrounds.
- **Low coherence**: Keep title sizes to 4-5 variants (within the 2-6 range the rubric rewards). Ensure consistent font families. Check accent usage.
- **Low images**: Check for overlaps (the renderer handles this, but composition can help by including `"role":"image"` zones). Verify placement variety — images shouldn't all land right.

Edit the `.composed.md` file directly. Make 3-5 targeted changes per iteration.

**d) Re-render and re-evaluate**

```bash
node -e "require('./raster.js').generateHTML('decks/<name>.composed.md', 'decks/<name>.html'); console.log('OK')"
node rubric-headless.js decks/<name>.html --json
```

Print iteration results with delta from previous.

### Phase 4: Final verification

After the loop converges:

1. **Screenshot key slides** (first, middle, last, any that were changed):
   Write a temp puppeteer script, run it, read the screenshots, clean up.

2. **Smart quote check**: Verify no `\u201c`/`\u201d` in the composed markdown.

3. **Print final summary**:
```
Build complete: <name>
  Composed: N slides with opus
  Score: XX.X/50 (XX%) after K iterations
  Baseline → Final: XX.X → XX.X
  Dimensions: A=X.X G=X.X C=X.X Co=X.X I=X.X
```

4. **Offer next steps**: "/preview to browse in Chrome", "/qa-visual for accessibility audit", "/commit to save"

## Key rules

- **Always use opus for compose** — high specificity of design briefs requires it.
- **Never embed multi-line node scripts in bash** — write to temp file, run, clean up.
- **Never use smart/curly quotes** — they break JSON design directive parsing.
- **Font floor is enforced by the renderer** (body 15px, bullets 15px, title 22px) — don't fight it in directives.
- **Data tables are preserved** — tables with real headers render as tables, not extracted content.
- **Overlap-aware image placement** is automatic — the renderer scores 9 candidate positions.
- **WCAG contrast** is auto-enforced — the renderer adjusts text colors for AA compliance.

## Example session

```
> /build-deck content/week-3/week-3.md --brief "cold rationalist, slate and white"

Composing 42 slides with opus...
Rendering...
Evaluating baseline: 41.2/50 (82%)
  A=7.8 G=8.5 C=9.0 Co=10 I=6.0

Iteration 1: fixing images (6.0), accessibility (7.8)
  → 3 image zones added, 2 contrast fixes
  Score: 46.8/50 (94%) [+5.6]

Iteration 2: fixing accessibility (8.2)
  → 4 overflow clamps
  Score: 48.5/50 (97%) [+1.7]

Iteration 3: diminishing returns (+0.3). Stopping.

Build complete: week-3
  Score: 48.5/50 (97%) after 3 iterations
  Baseline → Final: 41.2 → 48.5
```
