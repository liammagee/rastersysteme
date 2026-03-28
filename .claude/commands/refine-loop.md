---
name: refine-loop
description: "Inner loop: Recursive design/evaluation cycle — evaluate, improve, re-render, re-evaluate until rubric scores plateau. Automated. For rubric calibration, use the outer loop (METHODOLOGY.md)."
effort: high
---

# Refine Loop (Inner Loop)

Autonomous cycle: **evaluate → design → re-render → re-evaluate → repeat**.

Continues until scores plateau (diminishing returns) or all dimensions exceed threshold.

**This is the inner loop** — it trusts the rubric and optimizes against it. The rubric itself must be validated by the **outer loop** (human review, see METHODOLOGY.md) before the inner loop produces meaningful results. Running the inner loop against an uncalibrated rubric produces polished mediocrity.

The inner loop runs entirely on headless evaluation (Puppeteer + jsdom). Chrome is not required. Optional Chrome visual verification is available as a final step.

## Arguments

`/refine-loop decks/week-2.html`
`/refine-loop decks/week-2.html --target 75`
`/refine-loop decks/week-2.html --max-iterations 5`

## How to work

### 0. Pre-eval: Splice images if available

Before any evaluation, **always** splice in available images. Check for an image directory matching the source content (e.g., `content/week-N/images/`). If found and deck is not already `.spliced.html`, run `node splice-images.js <deck.html> <images-dir>` and use the spliced output for all subsequent steps.

### 1. Initial headless evaluation

Run the headless rubric to establish baseline scores:

```bash
node evaluate.js <deck.html> --json
```

Record baseline in the persistent scorecard (`logs/qa/<deckname>-scorecard.json`).

### 1b. Autonomous mode via /loop (recommended)

After establishing the baseline, delegate iteration to `/loop`:

```
/loop 2m /refine-step <deck.html> --target <T> --max <N>
```

This runs `/refine-step` every 2 minutes. Each step:
1. Reads the scorecard to check stopping conditions
2. If not converged: identifies weak dims, fixes, re-renders, re-evaluates
3. If converged: prints "CONVERGED" and exits (no-op)

The loop auto-converges in 3-5 iterations (6-10 minutes typically).

To monitor progress: `cat logs/qa/<deckname>-scorecard.json | jq '.[-1].computedTotal'`

If you prefer manual iteration, proceed to Step 2 below.

### 2. Manual design improvement cycle (headless-only)

For each iteration:

**a) Identify targets**
Sort the 5 computed dimensions by score. Pick the bottom 2–3 that are below threshold (default: 7/10 per dimension, or 70/100 total).

For the 3 visual dimensions (not available headlessly), use qa.js design scores as proxies:
- Low `layoutVariety` or `visualRhythm` → likely low Communicability
- Low `typography` score → likely low Taste
- Low `contentDensity` variance → likely low Layout Balance

**b) Apply improvements**
Follow the `/design` skill — edit design directives targeting the lowest dimensions. Make 3–5 changes per iteration (not too many — evaluate the impact).

**c) Re-render**
```bash
node raster.js <source.composed.md> <output.html> --format html --theme light
```

If images need re-splicing:
```bash
node splice-images.js <output.html> <images-dir> --output <output.html>
```

**d) Re-evaluate (headless)**
```bash
node rubric-headless.js <deck.html> --json
```

The new scores are automatically persisted to the scorecard with trajectory tracking.

**e) Check stopping conditions**

Stop if ANY of these are true:
1. **Threshold met:** All computed dimensions >= 7/10 (or custom `--target`)
2. **Diminishing returns:** Computed total improved by < 1 point vs previous iteration
3. **Max iterations:** Reached limit (default: 5, or custom `--max-iterations`)
4. **Regression:** Any dimension dropped by > 1 point (a fix made something worse — roll back)

### 3. Track score trajectory

The persistent scorecard automatically accumulates scores from each iteration. Read the trajectory to build the comparison table:

```
Refine Loop: decks/week-2.html
──────────────────────────────────────────────────────────────────────
                    Iter 0    Iter 1    Iter 2    Iter 3    Δ total
Accessibility       8.5       8.5       9.0       9.0       +0.5
Grid Utilization    6.0       7.5       8.0       8.0       +2.0
Color Harmonics     7.0       7.0       7.5       7.5       +0.5
Coherence/Variance  7.5       8.0       8.0       8.0       +0.5
Image Integration   5.0       6.5       7.0       7.5       +2.5
──────────────────────────────────────────────────────────────────────
Computed (/50)      34.0      37.5      39.5      40.0      +6.0

Stopped: threshold met (all computed dims >= 7/10)
Iterations: 3
Scorecard: logs/qa/week-2-scorecard.json
```

### 4. Rollback protection

Before each iteration, note the current state. If a change causes regression (a dimension drops by >1 point), revert that specific edit and try an alternative approach.

### 5. Optional Chrome visual verification

After the loop completes, offer to run Chrome visual verification:

```
Computed scores have plateaued at 40.0/50 (80%).
Run Chrome visual verification for communicability, taste, and balance? (y/n)
```

If yes: run the single-slide-at-a-time visual review from the `/evaluate` skill (step 3). This is a one-time operation at the end, not in the hot loop.

If Chrome is unavailable: the loop still completed successfully with computed scores. Visual dimensions can be assessed later.

### 6. Final report

```
Refine Loop Complete
────────────────────
Deck: decks/week-2.html (21 slides)
Iterations: 3 (stopped: threshold met)
Score: 34.0 → 40.0/50 computed (+6.0 points)
Tier estimate: Competent → Professional

Key improvements:
  Grid: added 4 new zone archetypes, offset titles on 6 slides
  Color: smoothed 3 abrupt chromatic transitions
  Images: added image zones to 5 design directives
  Coherence: reduced consecutive same-bg runs

Files modified:
  decks/week-2.composed.md (15 design directives edited)
  decks/week-2.html (re-rendered)

Scorecard: logs/qa/week-2-scorecard.json
```

Offer to commit, or to continue refining specific dimensions.

### 7. Design integrity check

After the loop, re-read the design plan. Verify the improvements haven't drifted from the stated aesthetic. If the plan says "Codex Marginalia — illuminated manuscript page" but the fixes introduced modernist asymmetry that contradicts the medieval manuscript feel, flag it:

"Note: Grid improvements added strong asymmetric layouts. The Codex Marginalia plan emphasizes 'ruled left-margins' — you may want to keep a consistent left margin as a design signature. Adjust?"
