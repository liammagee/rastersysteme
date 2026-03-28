---
name: refine-step
description: "Inner loop: Single refinement iteration -- evaluate, fix, re-render, re-evaluate. Idempotent. For /loop. Rubric must be outer-loop-validated first."
user-invocable: true
effort: medium
---

# Refine Step (Inner Loop)

ONE iteration of the inner design-refinement loop. Designed for `/loop` integration.

**Prerequisite**: The rubric must be validated by the outer loop (METHODOLOGY.md) before running. If the rubric is uncalibrated, this skill optimizes toward a misleading target.

```
/loop 2m /refine-step decks/week-2.html
```

Also works standalone: `/refine-step decks/week-2.html`

## Arguments

`/refine-step decks/week-2.html`
`/refine-step decks/week-2.html --target 9 --max 6`

Defaults: target=8 per dimension, max iterations=5.

## How to work

### 0. Resolve files

Given `<deck.html>` (may be `.spliced.html`):
- Strip `.spliced` if present to get the base name
- Composed markdown: `decks/<base>.composed.md`
- Scorecard: `logs/qa/<basename>-scorecard.json` (use the spliced name if that was evaluated)
- Image directory: `decks/<source>.composed-images/` — strip version suffix (e.g. `week-2-v8` -> `week-2`), look for `slide-*.png`

### 1. Check stopping conditions (BEFORE any work)

Read the scorecard JSON. It is an array of iteration objects.

**If no scorecard exists**: this is iteration 0. Run evaluation only (no design changes) to establish the baseline, then exit.

**If scorecard exists**, check these in order:

a) **Max iterations**: `scorecard.length - 1 >= max` (default 5) -> STOP
b) **Threshold met**: ALL computed scores in last entry >= target (default 8) -> STOP
c) **Diminishing returns**: if `scorecard.length >= 3` and last `computedTotal - previousTotal < 0.5` -> STOP
d) **Regression**: any dimension in last entry dropped > 1.0 from the entry before it -> STOP, flag which

If stopping, print status and exit:
```
CONVERGED: <deck> at <score>/<max> after N iterations. Reason: <reason>.
```

**This no-op behavior is by design for /loop** -- the loop keeps calling, but refine-step exits immediately after convergence.

### 2. Identify weak dimensions

From the last scorecard entry's `scores`, sort computed dimensions by score:
- `accessibility`, `grid`, `color`, `coherence`, `images`, `contentCompleteness`

Pick the bottom 2-3 that are below target.

Also check metrics for proxy signals:
- Low `zoneStarts` or `zoneWidths` -> grid needs work
- High `maxConsecBg` -> color needs work
- `emptyBodyZones > 0` -> content needs work
- `textOnImageCount > 0` or low `imgPlacements` variety -> images need work
- Too many `titleSizes` (>5) -> coherence needs work

### 3. Read the design plan

Read the composed markdown. Find the `<!-- DESIGN PLAN -->` block (or the first `notes` block with design context). All fixes must stay within this design language.

### 4. Apply design fixes (3-5 changes)

Edit the `.composed.md` design directives targeting the weak dimensions. Follow the `/design` skill patterns:

- **Low accessibility**: darken text colors in directives, expand cramped zones, fix overflows
- **Low grid**: rotate zone archetypes, vary `col` start positions (don't always start at 0 or 4)
- **Low color**: add/adjust dark divider slides at section breaks, increase bg variety (need 3+ unique)
- **Low coherence**: consolidate title sizes to 4-5 variants, ensure consistent font families, steady accent rhythm
- **Low images**: add `"role":"image"` zones, vary placement positions, fix text-on-image overlaps
- **Low contentCompleteness**: fix empty body zones (change role to "table"/"title" if content is a table/heading), expand body `rowSpan` for truncated tables, widen narrow zones

**After edits**: scan composed markdown for smart/curly quotes (`\u201c` `\u201d` `\u2018` `\u2019`) and replace with ASCII.

### 5. Re-render

Write a temp render script (NEVER use `node -e`):

```bash
# Write render script
cat > /tmp/refine-render.js << 'RENDEREOF'
const r = require('/absolute/path/to/raster.js');
r.generateHTML('decks/<name>.composed.md', 'decks/<name>.html');
console.log('Render OK');
RENDEREOF
node /tmp/refine-render.js
```

If `decks/<source>.composed-images/` has `slide-*.png` files, re-splice:
```bash
node splice-images.js decks/<name>.html decks/<source>.composed-images/
```

### 6. Re-evaluate

```bash
node evaluate.js decks/<name>.spliced.html --json
```

(Use the spliced version if images were spliced, otherwise the base HTML.)

This appends the new iteration to the scorecard automatically.

### 7. Report

Print a brief iteration summary (designed for unattended `/loop` operation):

```
Iteration N: decks/week-2.html
  Targets: grid (7.5 -> 9.0), images (8.0 -> 9.5)
  Total: 52/60 -> 57/60 (+5.0)
  Changes: 4 directives edited (2 zone rotations, 1 bg override, 1 title consolidation)
  Scorecard: logs/qa/week-2-scorecard.json
```

## Key rules

- **Idempotent after convergence** -- this is the most important property for `/loop` integration.
- NEVER use `node -e`. Write scripts to tmp files.
- NEVER use smart/curly quotes. Check after every edit.
- Always splice from `decks/<source>.composed-images/` (slide-NN.png format).
- Do not modify the design plan itself, only design directives.
- Make 3-5 changes per iteration. Small steps, measured impact.
- If the scorecard was modified since you last read it, skip this iteration (another instance may be running).
