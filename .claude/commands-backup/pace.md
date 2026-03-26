---
name: pace
description: Add timing cues to slide speaker notes based on presentation duration. Estimates time per slide from content weight.
---

# Pace

Add timing cues to a deck's speaker notes to help with presentation pacing.

## Arguments

`/pace decks/week-1k.composed.md --duration 170`
`/pace content/week-1/week-1.md --duration 60`

## How to work

### 1. Get duration

The user specifies total presentation time in minutes. If not provided, ask: "How long is the presentation?"

### 2. Run pacing

```bash
node pace.js <input.md> --duration <minutes> --output <output.md>
```

This analyzes each slide's content weight (text length, bullets, images, notes) and distributes the total time proportionally. Slides with more speaker notes get more time.

Output: a paced version of the markdown with `⏱ Xm → Ym (Z:SS)` timing annotations in each slide's notes block.

### 3. Review the pacing

Read the output and present a summary:
```
Pace: 170 minutes across 40 slides
──────────────────────────────────
  Avg: 4m 15s per slide
  Longest: S9 (8m 24s — Summative Assessment, dense content)
  Shortest: S21 (1m 37s — Break slide)
  Break at: S21 (1h 36m mark)
```

If the pacing looks off (e.g., a slide got too much or too little time), offer to adjust manually.

### 4. Re-render

If the paced markdown was a composed deck, re-render to update the notes in the HTML:
```bash
node raster.js <paced.composed.md> <output.html> --format html --theme light
```
