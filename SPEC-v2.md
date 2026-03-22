# Rastersysteme v2: Dynamic Design System Specification

## Problem

The current compose pipeline selects from 13 fixed layout templates (title, section, bullets, stagger, split, rotated, fragment, overlap, arc, image, table, code, blank). Claude chooses which template per slide, but the templates themselves are rigid — every "split" looks identical regardless of intensity level. The result: shuffling a small set of predefined layouts creates a "same but reordered" feeling across minimal/moderate/maximal variants.

## Goal

Each intensity level should produce a **visually distinct design system** — not a different selection from the same 13 templates, but a fundamentally different visual language built on the 60-column horizontal grid.

"Minimal light" should produce a Swiss design aesthetic that emphasises light and minimalism. "Maximal light" should produce the same Swiss foundations but with much more "noise" — dramatic scale, vivid colour, typographic confrontation. The layouts themselves should be novel compositions each time, not selections from a fixed menu.

## Architecture: Parameterised Grid Design

Instead of selecting from fixed templates, Claude specifies **per-slide design parameters** that the renderer interprets directly on the 60-column grid.

### New Directive: `<!-- design: {...} -->`

```markdown
<!-- design: {
  "zones": [
    { "role": "title", "col": 0, "span": 24, "row": 0, "rowSpan": 20 },
    { "role": "body", "col": 30, "span": 28, "row": 0, "rowSpan": 40 }
  ],
  "accents": [
    { "type": "bar", "col": 26, "span": 2, "row": 0, "rowSpan": 40, "color": "E63946" }
  ],
  "typography": {
    "title": { "size": 48, "weight": 900, "transform": "uppercase", "tracking": "0.15em", "align": "left" },
    "body": { "size": 14, "weight": 400, "leading": 1.6 },
    "label": { "size": 8, "weight": 700, "tracking": "0.25em", "transform": "uppercase" }
  },
  "bg": "0A1628",
  "font": "Georgia",
  "gap": "tight"
} -->
```

### Zone System

Each slide is composed of **zones** placed on the 60-column × 40-row grid:

| Parameter | Description | Range |
|-----------|-------------|-------|
| `role` | Content type this zone displays | `title`, `body`, `bullets`, `label`, `quote`, `accent` |
| `col` | Starting column (0-indexed) | 0–59 |
| `span` | Column width | 1–60 |
| `row` | Starting row (0-indexed) | 0–39 |
| `rowSpan` | Row height | 1–40 |

Column positions map to percentages: `left: col/60 * 100%`, `width: span/60 * 100%`. Row positions map to: `top: row/40 * 100%`, `height: rowSpan/40 * 100%`.

### Accent System

Visual elements (bars, dots, lines, blocks) placed on the grid:

| Type | Rendering |
|------|-----------|
| `bar` | Solid colour rectangle at specified grid position |
| `line` | 1px line (horizontal or vertical based on proportions) |
| `dot` | Circle at grid position |
| `block` | Semi-transparent colour field |

### Typography System

Per-slide control over how each content role renders:

| Parameter | What it controls | Range |
|-----------|-----------------|-------|
| `size` | Font size in px | 9–96 |
| `weight` | Font weight | 100–900 |
| `transform` | Text transform | `uppercase`, `lowercase`, `capitalize`, `none` |
| `tracking` | Letter spacing | `0`–`0.5em` |
| `leading` | Line height multiplier | 1.0–2.5 |
| `align` | Text alignment | `left`, `center`, `right` |
| `color` | Text colour override | 6-char hex |

### Slide-Level Parameters

| Parameter | Description |
|-----------|-------------|
| `bg` | Background colour (6-char hex) |
| `font` | Font family name |
| `gap` | Element spacing: `tight` (0.5vmin), `normal` (2vmin), `loose` (4vmin) |

### What This Enables

**Minimal light** could produce:
- Title zone at cols 4–30 (50% whitespace right)
- Body zone at cols 4–40 (narrow measure, generous margins)
- No accent elements
- Size 14px body, 32px titles, weight 400
- Tracking 0.02em (tight Swiss)
- White/off-white backgrounds only
- Helvetica Neue throughout
- The grid felt through absence

**Maximal light** could produce:
- Title zone at cols 0–58 (full-bleed)
- Body zone at cols 15–45 (centred narrow)
- Thick accent bars at cols 0–4 in vivid colours
- Size 11px body, 72px titles, weight 900
- Tracking 0.2em on labels (Weingart-level spacing)
- Vivid saturated backgrounds alternating with near-white
- Georgia for quotes, Futura for statements, Courier for data
- Each slide a unique composition

**Moderate light** — between these extremes:
- Title zone at cols 2–28 (asymmetric but not extreme)
- Body zone at cols 32–56 (generous right column)
- Thin accent line at col 30
- Mixed scale: 18px body, 40px titles
- One secondary font on editorial slides
- 3-colour chromatic arc

### Fallback Compatibility

If a slide uses the old `<!-- layout: split -->` format, it renders using the existing fixed template. Both `layout` and `design` directives can coexist:
- Slides with `<!-- design: {...} -->` use the new parameterised renderer
- Slides with `<!-- layout: name -->` use the existing 13 templates
- A deck can mix both (gradual migration)

### HTML Renderer

The `designed` renderer places zones absolutely on a 16:9 container:

```html
<section class="slide designed" style="background:#0A1628; font-family:'Georgia',serif;">
  <!-- Accent bar -->
  <div class="accent-bar" style="
    left: 43.33%;    /* 26/60 */
    width: 3.33%;    /* 2/60 */
    top: 0%;
    height: 100%;
    background: #E63946;
  "></div>
  <!-- Title zone -->
  <div class="zone zone-title" style="
    left: 0%;        /* 0/60 */
    width: 40%;      /* 24/60 */
    top: 0%;
    height: 50%;     /* 20/40 */
  ">
    <h1 style="font-size:48px; font-weight:900; text-transform:uppercase; letter-spacing:0.15em;">
      Title Here
    </h1>
  </div>
  <!-- Body zone -->
  <div class="zone zone-body" style="
    left: 50%;       /* 30/60 */
    width: 46.67%;   /* 28/60 */
    top: 0%;
    height: 100%;    /* 40/40 */
  ">
    <p style="font-size:14px; line-height:1.6;">Body text here</p>
  </div>
</section>
```

### PPTX Renderer

Maps zones to pptxgenjs positions using `createGrid()`:
```js
const g = createGrid(10, 5.625);
// Zone at col:0, span:24, row:0, rowSpan:20
s.addText(title, {
  x: g.cx(0), y: g.cy(0),
  w: g.cw(24), h: g.ch(20),
  fontSize: 48, fontFace: "Georgia",
  bold: true, // weight >= 700
});
```

### Compose Prompt Changes

The intensity levels tell Claude to USE the `design` directive instead of `layout`:

**Minimal**: "Design each slide with restrained grid zones. Wide margins (start at col 4+). Small type (titles ≤ 36px). Light backgrounds. No accent elements. The grid should be felt through whitespace and alignment."

**Moderate**: "Design each slide with confident grid zones. Asymmetric column splits. Mix of type scales (titles 28–48px). Accent bars or lines to guide the eye. 3–5 colour palette. One secondary font."

**Maximal**: "Design each slide as a unique composition. Extreme column positions (full-bleed and tight crops). Dramatic type scales (titles 48–96px next to 9px labels). Bold accent elements. Vivid colour contrasts. Multiple fonts. Each slide should surprise."

### Validation Rules

| Rule | Check |
|------|-------|
| Column bounds | `col` ∈ [0, 59], `col + span` ≤ 60 |
| Row bounds | `row` ∈ [0, 39], `row + rowSpan` ≤ 40 |
| Font size | `size` ∈ [9, 96] |
| Font weight | `weight` ∈ [100, 900] and divisible by 100 |
| Line height | `leading` ∈ [1.0, 2.5] |
| Background | Valid 6-char hex |
| Accent colour | Valid 6-char hex |
| At least one zone | Every slide needs at least one content zone |
| No overlapping zones | Zones should not occupy the same grid area |

### Implementation Plan

1. **Parser**: Add `design` directive extraction to `parseMarkdown()` in `raster.js`
2. **HTML renderer**: New `renderDesigned(slide, design)` function in `raster.js`
3. **PPTX renderer**: New `renderDesignedPPTX(slide, design, g, pres)` function
4. **Studio/Review/Compare**: All use the HTML renderer, so they get designed slides automatically
5. **Compose prompts**: Teach Claude the `design` directive format and philosophy per intensity
6. **QA**: Validate design parameters (column/row bounds, size ranges)
7. **Tests**: New test suite for design parsing, rendering, validation
