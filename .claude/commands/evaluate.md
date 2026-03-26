---
name: evaluate
description: Score a rendered slide deck against the 8-dimension design rubric. Returns a structured scorecard with computed metrics and visual assessments.
---

# Evaluate

Score a rendered HTML deck against the design rubric (see RUBRIC.md).

## Arguments

`/evaluate decks/week-2.html`

## How to work

### 0. Fallback mode

If Chrome is disconnected, the evaluate skill can still compute 5 of 8 dimensions directly from files on disk using `parseMarkdown()` from `raster.js` on the `.composed.md` file. Visual dimensions (communicability, taste, balance) default to estimates based on the design plan analysis. When Chrome IS available, visual assessment from screenshots overrides the estimates.

### 1. Connect to Chrome

Open the deck in Chrome. If not already open, navigate to `http://localhost:8701/<deck-path>`.

### 2. Run the computed audit

Execute the rubric audit script (`rubric-audit.js`) via `mcp__claude-in-chrome__javascript_tool`.

Read the file first:
```bash
cat rubric-audit.js
```

Then execute it in the browser. Parse the returned JSON scorecard.

### 3. Visual assessment — screenshot 5 slides

Screenshot slides at positions: 1 (opening), N/4 (early), N/2 (middle), 3N/4 (late), N (closing).

For each screenshot, assess the three visual dimensions:

**Communicability (1–10):** Does the design help you understand the content? Is the hierarchy clear? Can you find the point?

**Taste (1–10):** Does this exhibit Swiss/modernist quality? Is it distinctive or generic? Does every element earn its place?

**Layout Balance (1–10):** Does the slide feel visually balanced? Is whitespace intentional? Is there dynamic asymmetric tension or static centering?

Average across the 5 slides for each dimension.

### 4. Compile the scorecard

Combine computed scores (5 dimensions from JS) + visual scores (3 dimensions from screenshots):

```
Design Rubric Scorecard: decks/week-2.html
──────────────────────────────────────────
Dimension              Score   Notes
─────────────────────  ─────   ─────
Accessibility          8.5     0 errors, 3 warnings
Communicability        7.0     Clear hierarchy, some dense slides
Taste                  7.5     Codex Marginalia system is distinctive
Grid Utilization       8.0     21 designed slides, 5 archetypes
Color Harmonics        7.0     4 palette colors, chromatic arc present
Layout Balance         6.5     Some slides feel static/centred
Coherence & Variance   7.5     Good rotation, no long repeats
Image Integration      6.0     Images present but placement repetitive
─────────────────────  ─────
TOTAL                  58/80   (72/100 — Professional tier)
```

### 5. Identify improvement priorities

Rank the dimensions lowest-to-highest. The bottom 2–3 are the improvement targets. For each, give specific actionable recommendations tied to the rubric criteria:

- "Layout Balance (6.5): Slides 4, 8, 13 feel statically centred. Try offset archetypes — move title to col 30+, body to col 4. Add asymmetric accent bars."
- "Image Integration (6.0): All images bottom-right. Add image zones to design directives on slides 1, 6, 9. Vary placement."

### 6. Offer next steps

- `/rs-design` to apply improvements to the composed markdown
- `/rs-refine-loop` to iterate automatically until scores plateau
