---
name: qa-fix-loop
description: Autonomous cycle that audits a deck for accessibility and design issues, fixes them while honoring the original design intent, re-renders, and verifies.
---

# QA Fix Loop

Autonomous cycle: **audit → analyze → fix → re-render → verify → repeat**.

Fixes must **honor the original design intent** — don't flatten everything to safe defaults.

## Arguments

`/qa-fix-loop decks/week-2.html`

## How to work

### 1. Read the design plan

Before fixing anything, read the composed markdown's `<!-- DESIGN PLAN -->` block. Understand:
- The **aesthetic** (e.g., "Codex Marginalia — illuminated manuscript page")
- The **palette** (which colors are ground, accent, signal)
- The **chromatic arc** (which slides are dark dividers, which are light)
- The **grid strategy** (zone archetypes, how they rotate)
- The **accent strategy** (lines, bars, dots — rhythm and restraint)

Every fix must stay within this design language. Don't introduce colors, fonts, or layouts that contradict the plan.

### 2. Audit (Chrome)

Run the a11y + design consistency audit scripts from `/qa-visual`.

### 3. Analyze with design context

For each issue, determine:

| Issue | Wrong fix (bland) | Right fix (design-aware) |
|-------|-------------------|--------------------------|
| Light text on light bg | Change all text to black | Darken within the palette (e.g., use the "signal" color) |
| Label contrast too low | Use generic dark grey | Darken the palette's accent color one notch |
| Image overlaps text | Shrink to tiny corner thumbnail | Add an `"image"` zone to the design directive that complements existing zones |
| Content overflow | Reduce font size uniformly | Redistribute zones — expand body rowSpan, compress title, or split across two slides |
| Broken chromatic arc | Remove dark bg slides | Fix text colors on dark slides rather than removing the contrast |

### 4. Image placement principles

When images lack a dedicated zone in the design directive:

- **Image-primary slides** (minimal text, image is the content): show image large, centred
- **Image-heavy slides** (2+ images, light text): grid images in a panel alongside text
- **Text-left layouts** (zones span cols 0-38): image panel on right, tall
- **Text-right layouts** (zones start at col 20+): image inset on left
- **Text-top layouts** (zones in top half): image strip at bottom
- **Text-bottom layouts** (zones in lower half): image strip at top
- **Dense text slides**: small inset, **rotate corner** by slide index (don't always use bottom-right)

Better yet: edit the design directive to add a proper `"role":"image"` zone:
```json
{"role":"image","col":38,"span":20,"row":5,"rowSpan":30}
```

### 5. Apply fixes

**Contrast fixes** — stay within the palette:
- If palette has "India Ink #2A1F14" as signal → use it for text, not generic black
- If palette has "Antique Gold #B89B72" as accent → darken to #6B5A3E, not replace with grey
- For dark-bg slides: use the palette's light colors (cream, parchment) for text

**Overflow fixes** — respect the grid:
- Expand `rowSpan` of the overflowing zone
- Compress adjacent zones rather than shrinking font
- If content genuinely doesn't fit: suggest splitting the slide (flag to user, don't auto-split)

**Image fixes** — edit design directives to add image zones:
- Read where text zones are positioned
- Place image zone in the complementary space
- Use the zone's col/span to control image size and position
- This is better than the renderer fallback because it gives the image a deliberate place in the grid

### 6. Re-render and verify

```bash
node raster.js <source.composed.md> <output.html> --format html --theme light
```

Reload in Chrome. Re-run audit. Compare before/after.

### 7. Report

Show what changed and why:
```
Fix cycle complete — Codex Marginalia preserved
─────────────────────────────────────────────────
Before: 6 errors, 54 warnings
After:  0 errors, 17 minor overflows

Changes (within palette):
  Labels: #B89B72 → #6B5A3E (darkened Antique Gold, not replaced)
  S5, S14: title/body text → #2A1F14 India Ink (was cream-on-cream)
  S1, S4, S6: added image zones to design directives
  Overflow: no font changes — expanded zone rowSpans
```
