---
name: qa-fix-loop
description: Autonomous cycle that audits a deck for accessibility and design issues, fixes them, re-renders, and verifies. Loops until clean or the user stops.
---

# QA Fix Loop

Autonomous cycle: **audit → analyze → fix → re-render → verify → repeat**.

## Arguments

`/qa-fix-loop decks/week-1k.html`

## How to work

### 1. Audit (Chrome)

Run the `/qa-visual` audit scripts (both a11y and design consistency) on the deck.
Capture the results.

### 2. Analyze findings

Categorize each issue by fix location:

| Category | Where to fix | Example |
|----------|-------------|---------|
| **Theme-level** | `raster.js` THEMES or CSS | `textMid` contrast, bullet clamp sizes |
| **Slide-level** | `*.composed.md` design directives | Dark bg with light-theme text colors |
| **CSS-level** | `raster.js` generateHTMLCSS() | Hardcoded color instead of CSS variable |
| **Content-level** | `*.composed.md` content | Too many bullets causing overflow |
| **Image-level** | Re-run splice-images | Image-text collision at high opacity |

### 3. Apply fixes

**Theme fixes** — edit `raster.js` directly:
- Adjust THEMES object colors
- Fix CSS clamp values for bullet/body sizes
- Add `adaptThemeForBg` handling for new edge cases

**Slide fixes** — edit the composed markdown:
- Change `bg` in design directives
- Adjust typography colors and sizes
- Reposition zones to fix overflow
- Reduce content on overloaded slides

**Image fixes** — re-splice with lower opacity or different placement.

### 4. Re-render

```bash
node raster.js <source.composed.md> <output.html> --format html --theme light
```

If images need re-splicing:
```bash
node splice-images.js <output.html> <images-dir> --output <output.html>
```

### 5. Verify (Chrome)

Reload the tab. Re-run the audit scripts. Compare before/after.

### 6. Report or loop

If issues remain, loop back to step 2 (ask the user first if they want another cycle).

If clean:
```
Fix cycle complete
──────────────────
Before: 11 slides with issues (3 errors, 16 warnings)
After:  0 errors, 8 minor overflow warnings

Changes made:
  raster.js: added adaptThemeForBg for design-directive slides
  week-1k.composed.md: changed bg on slides 27, 38 to 1C1A16
  splice-images.js: density-scaled bg opacity (0.04-0.08)
```

Offer to commit the changes.
