---
name: design-polish
description: Polish a rendered deck's visual design — enlarge foreground images, bump text sizes, fix contrast, and verify no overlap. Works on both renderer defaults and per-slide design directives.
user_invocable: false
---

# Design Polish

Reference for improving slide visual quality without breaking layout. Used by `/design`, `/refine-loop`, and manual editing.

## Image Sizing Rules

### Table images (`richCell()` in raster.js)
- Inline images in table cells: `max-height:22vmin` (was 8vmin)
- CSS: `td img { max-width:100%; max-height:22vmin; object-fit:contain }`
- Center with `margin:0.5vmin auto`

### Overlay images (unzoned, positioned absolutely)
- Use `width:100%;height:100%;object-fit:cover` — fill the container
- Container sized by overlap-aware candidate system (see image placement below)
- Minimum container: 22% wide, 30% tall

### Standalone images (`.images img` CSS)
- `max-height:55vmin;object-fit:contain` — generous sizing
- Single images get `.images.single` with no max-width constraint

### Image zone in design directives
- When a design directive has `"role":"image"`, images render via `imagesHTML()` in that zone
- Zone should span at least 20 columns and 15 rows for visibility

## Overlap-Aware Image Placement

When images are NOT zoned in the design (no `"role":"image"` zone), the renderer places them automatically:

1. **9 candidate positions** are scored against text zone bounding rects
2. Candidates: right-panel, left-panel, top-strip, bottom-strip, 4 corners, centre
3. Each candidate gets an overlap score (lower = less text collision)
4. Best zero-overlap candidate wins; slide index rotates tie-breaks for variety
5. **Image-heavy slides** (2+ images, light text) try half-slide first; fall through to candidates if overlap > 500

### Key thresholds
- `overlapScore < 500`: acceptable for half-slide layout
- `score === 0`: ideal, stop searching
- Candidate corner sizing adapts to available gap between text zones and slide edge

## Font-Size Floors

Enforced in `typographyToCSS()` regardless of what composition assigns:

| Role | Floor |
|------|-------|
| title | 22px |
| body | 15px |
| bullets | 15px |
| quote | 14px |
| label | 10px |

## WCAG Contrast Enforcement

Applied in `typographyToCSS()` when `bgHex` is provided:
- Checks foreground color against slide background
- Normal text: 4.5:1 ratio minimum
- Large text (>=18px or >=14px bold): 3:1 minimum
- **Darkens** on light backgrounds, **lightens** on dark backgrounds
- Iterates up to 10 steps at 18% per step

## Text Bump Checklist

When reviewing a deck for text readability:

1. Check CSS base sizes:
   - `p`: `clamp(0.95rem, 2vmin, 1.3rem)`
   - `.bullet.level-0`: `clamp(1rem, 2.2vmin, 1.4rem)`
   - `table`: `clamp(0.8rem, 1.6vmin, 1.05rem)`
2. Check zone width vs content weight:
   - Zones < 25 columns with > 300 chars content get auto-expanded
   - Narrow zones should have their design directive widened manually
3. Typography in design directives:
   - Body text below 14px → bump to 15+
   - Bullet text below 14px → bump to 15+
   - Leading (line-height) should be >= 1.4 for body, >= 1.5 for bullets

## Table Handling

### Data tables (real headers)
- Preserved intact, rendered with `tableToHTML()` + `richCell()`
- Images render inline with `max-height:22vmin`
- Auto-appended below title when no `"role":"table"` zone exists
- Headers use accent color background

### Layout tables (empty headers)
- Content extracted into `slide.images` and `slide.body`
- Table itself still in `slide.tables` but classified as `isLayoutTable`
- Header row skipped in rendering

## Quick Fixes by Symptom

| Problem | Fix |
|---------|-----|
| Tiny table images | Increase `max-height` in `richCell()` and `td img` CSS |
| Text too small | Raise `FONT_FLOOR` values; bump CSS `clamp()` minimums |
| Image overlaps text | Check `overlapScore`; ensure overlay z-index=0 and text z-index=2 |
| Contrast fail | `enforceContrast()` handles automatically; check `slideBg` is passed |
| Dense 3-column slide | Widen zones in design directive; consider splitting into 2 slides |
| Smart quotes in JSON | Replace `\u201c\u201d` with `"`, `\u2018\u2019` with `'` |
