---
name: refine-loop
description: Recursive design/evaluation cycle — evaluate, improve, re-render, re-evaluate until rubric scores plateau or exceed threshold.
---

# Refine Loop

Autonomous cycle: **evaluate → design → re-render → re-evaluate → repeat**.

Continues until scores plateau (diminishing returns) or all dimensions exceed threshold.

## Arguments

`/refine-loop decks/week-2.html`
`/refine-loop decks/week-2.html --target 75`
`/refine-loop decks/week-2.html --max-iterations 5`

## How to work

### 1. Initial evaluation

Run `/evaluate` on the deck. Record the baseline scorecard.

### 2. Design improvement cycle

For each iteration:

**a) Identify targets**
Sort dimensions by score. Pick the bottom 2–3 that are below the threshold (default: 7/10 per dimension, or 70/100 total).

**b) Apply improvements**
Follow the `/design` skill — edit design directives targeting the lowest dimensions. Make 3–5 changes per iteration (not too many — evaluate the impact).

**c) Re-render**
```bash
node raster.js <source.composed.md> <output.html> --format html --theme light
```

**d) Re-evaluate**
Run `/evaluate` again. Record the new scorecard.

**e) Check stopping conditions**

Stop if ANY of these are true:
1. **Threshold met:** All dimensions ≥ 7/10 (or custom `--target`)
2. **Diminishing returns:** Total score improved by < 2 points (out of 100) vs previous iteration
3. **Max iterations:** Reached limit (default: 5, or custom `--max-iterations`)
4. **Regression:** Any dimension dropped by > 1 point (a fix made something worse — roll back)

### 3. Track score trajectory

Maintain a table across iterations:

```
Refine Loop: decks/week-2.html
──────────────────────────────────────────────────────────────────────
                    Iter 0    Iter 1    Iter 2    Iter 3    Δ total
Accessibility       8.5       8.5       9.0       9.0       +0.5
Communicability     7.0       7.0       7.5       7.5       +0.5
Taste               7.5       7.5       8.0       8.0       +0.5
Grid Utilization    6.0       7.5       8.0       8.0       +2.0
Color Harmonics     7.0       7.0       7.5       7.5       +0.5
Layout Balance      5.5       7.0       7.5       8.0       +2.5
Coherence/Variance  7.5       8.0       8.0       8.0       +0.5
Image Integration   5.0       6.5       7.0       7.5       +2.5
──────────────────────────────────────────────────────────────────────
TOTAL (/100)        66        72        78        80        +14

Stopped: threshold met (all dimensions ≥ 7/10)
Iterations: 3
```

### 4. Rollback protection

Before each iteration, note the current state. If a change causes regression (a dimension drops by >1 point), revert that specific edit and try an alternative approach.

### 5. Final report

```
Refine Loop Complete
────────────────────
Deck: decks/week-2.html (21 slides)
Iterations: 3 (stopped: threshold met)
Score: 66 → 80/100 (+14 points)
Tier: Competent → Professional

Key improvements:
  Grid: added 4 new zone archetypes, offset titles on 6 slides
  Balance: introduced asymmetric layouts on slides 4, 8, 13
  Images: added image zones to 5 design directives
  Color: smoothed 3 abrupt chromatic transitions

Files modified:
  decks/week-2.composed.md (15 design directives edited)
  decks/week-2.html (re-rendered)
```

Offer to commit, or to continue refining specific dimensions.

### 6. Design integrity check

After the loop, re-read the design plan. Verify the improvements haven't drifted from the stated aesthetic. If the plan says "Codex Marginalia — illuminated manuscript page" but the fixes introduced modernist asymmetry that contradicts the medieval manuscript feel, flag it:

"Note: Grid improvements added strong asymmetric layouts. The Codex Marginalia plan emphasizes 'ruled left-margins' — you may want to keep a consistent left margin as a design signature. Adjust?"
