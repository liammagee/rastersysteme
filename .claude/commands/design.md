---
name: design
description: Apply the design rubric to improve a composed deck — edit design directives to raise the lowest-scoring dimensions while honoring the design plan.
---

# Design

Read a rubric scorecard (from `/evaluate`) and apply targeted improvements to the composed markdown's design directives.

## Arguments

`/design decks/week-2.composed.md`

Or pass specific targets: `/design decks/week-2.composed.md --focus "grid,balance,images"`

## How to work

### 1. Read the design plan

Read the composed markdown's `<!-- DESIGN PLAN -->` block. Understand the aesthetic, palette, grid strategy, font strategy, accent strategy. All improvements must stay within this language.

### 2. Get or recall the scorecard

If `/evaluate` was just run, use those scores. Otherwise, run `/evaluate` first.

Identify the 2–3 lowest-scoring dimensions.

### 3. Apply dimension-specific improvements

For each low-scoring dimension, edit the design directives:

**Grid Utilization (low):**
- Read each slide's zone positions. Identify slides where all zones start at the same col.
- Rotate through archetypes: Wide Statement (title col:2 span:54), Sidebar Column (title col:2 span:16, body col:22), Offset Right (title col:30 span:28), Centred Editorial (title col:12 span:36).
- Ensure no two adjacent slides share the same zone archetype.
- Use margins: don't always start at col 0 — try col 4, col 6, col 8.

**Color Harmonics (low):**
- Read the chromatic arc description from the design plan.
- Check if dark divider slides are positioned at section boundaries.
- Ensure bg transitions aren't too abrupt (>300 distance) without being a deliberate section break.
- Reserve accent colors for emphasis — don't use them as bg.

**Layout Balance (low):**
- Identify slides where zones are symmetrically centred.
- Add asymmetric tension: offset title to the right third, body to the left.
- Use accents as visual counterweights — a bar on the left balances text on the right.
- Increase whitespace on sparse slides; don't fill every zone on every slide.

**Coherence & Variance (low):**
- Check for 3+ consecutive slides with the same bg, font, or zone archetype.
- Introduce font alternation: switch to the secondary font on every 4th–6th slide.
- Add or adjust accents to create rhythm: line → bar → dot → line.

**Image Integration (low):**
- Add `"role":"image"` zones to design directives for slides that have images.
- Position image zones to complement text zones, not overlap them.
- Vary image zone sizes: col-span 18–24, different row positions.

**Taste (low):**
- Reduce decoration: remove accents that don't serve a purpose.
- Increase type hierarchy: bigger title/body contrast.
- Use fewer colors with more intention.

**Communicability (low):**
- Ensure titles are the dominant visual element on each slide.
- Separate body from bullets with different zone positions.
- Use size and weight to create reading order: title → subtitle → body → detail.

### 4. Edit the composed markdown

Use the Edit tool to modify design directives in the `.composed.md` file. Work slide by slide, changing the JSON.

### 5. Re-render

```bash
node raster.js <source.composed.md> <output.html> --format html --theme light
```

### 6. Report

Show what changed:
```
Design improvements applied (targeting Grid + Balance + Images):
  S1: added image zone col:36 span:22 row:5 rowSpan:25
  S4: offset title from col:6 to col:30 (asymmetric)
  S8: added accent bar col:0 span:2 as counterweight
  S13: split body zone into two columns for readability
  12 slides modified, 9 unchanged.
```

Offer to run `/evaluate` to re-score.
