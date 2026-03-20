# rastersysteme

**Swiss 60-column grid slide generator.** Takes Markdown, outputs PPTX/HTML on a Müller-Brockmann / Gerstner-inspired modular grid with Musica Viva layout arrangements.

## Quick Start

```bash
npm install
npm run raster -- slides.md
```

Output: `slides.pptx`

## npm Scripts

```bash
# Interactive mode — asks for preferences, orchestrates full pipeline
npm start

# Generate PPTX (default)
npm run raster -- slides.md --theme dark

# Generate HTML slideshow
npm run raster -- slides.md --format html --theme dark

# Visual review (thumbnail grid with validation)
npm run raster -- slides.md --format review --theme dark

# Claude-directed art direction → slides
npm run compose -- slides.md --theme dark --intensity radical

# Multi-style comparison: runs faithful/moderate/radical, evaluates, generates report
npm run compare -- slides.md --theme light

# Run unit tests
npm test
```

## Pipeline

```
                ┌─────────────────────────────────────────┐
                │  rastersysteme.js (interactive entry)    │
                └──────────────┬──────────────────────────┘
                               │
            ┌──────────────────┼──────────────────────┐
            ▼                  ▼                      ▼
     compose.js          raster.js              compare.js
  Claude art-directs    renders to PPTX/HTML    multi-style A/B
            │                  │                      │
            ▼                  ▼                      ▼
     *.composed.md      *.pptx / *.html        *.compare.html
  (intermediate, editable)                    (evaluation report)
```

### compose.js — Claude-directed composition

Takes raw markdown, sends it to Claude with a design vocabulary prompt
rooted in Swiss International / New Wave typography. Claude selects layouts,
restructures content, builds chromatic arcs, and adds typographic texture.

```bash
node compose.js <input.md> [output.pptx] [options]

Options:
  --theme <name>         light (default), dark, red, blue
  --intensity <level>    faithful | moderate | radical
  --brief "<direction>"  Creative direction for Claude
  --dry-run              Output composed markdown only
  --model <model>        Claude model override
```

**Intensity levels:**

| Level | Philosophy | Behaviour |
|-------|-----------|-----------|
| `faithful` | Müller-Brockmann | Selects layouts, preserves structure |
| `moderate` | Gerstner | Restructures for impact, adds pacing |
| `radical` | Weingart | Fragments, reorders — radical design, not deletion |

All levels preserve content completeness and original speaker notes.

### compare.js — Multi-style evaluation

Runs all 3 intensities against the same source, evaluates each against
an a11y-inclusive rubric, and generates a comparison report.

```bash
node compare.js <source.md> [options]

Options:
  --theme <name>        Render theme (default: light)
  --brief "<direction>" Creative brief for all variants
  --model <model>       Claude model for evaluation (default: sonnet)
  --skip-eval           Generate variants only, skip Claude evaluation
  --no-pptx             HTML only, faster iteration
```

**Evaluation rubric (100 points):**

| Criterion | Weight | What it measures |
|-----------|--------|-----------------|
| Content completeness | 20 | All source info survives (URLs, dates, criteria) |
| Design quality | 20 | Layout variety, color arc, typographic contrast |
| Content fidelity | 15 | No hallucinated or invented content |
| Speaker notes | 15 | Original notes preserved + design rationale |
| Pacing | 10 | Layout rhythm, blank slide usage, density variation |
| Accessibility | 10 | WCAG contrast ratios, readability at scale |
| Narrative coherence | 10 | Story arc, chapter structure, opening/close |

## Usage

```bash
node raster.js <input.md> [output] [--theme light|dark|red|blue] [--ratio 16:9|4:3] [--font "Font Name"] [--format pptx|html|review]
```

## Markdown Format

Slides are separated by `---`. Standard markdown elements map to slide content:

```markdown
# Title Slide

Subtitle text here

- bullet one
- bullet two
- bullet three

---

## Second Slide

### SECTION LABEL

- Point A
  - Sub-point A1
  - Sub-point A2
- Point B

> This is a callout blockquote

```notes
Speaker notes go here — rendered in PPTX notes pane, not on slide.
```​

---

## Slide with Image

![Architecture diagram](diagrams/arch.png)

Caption text appears below

---

## Data Table

| Metric | Q1 | Q2 | Q3 |
|--------|:--:|:--:|:--:|
| Revenue | $1M | $1.5M | $2M |
| Users | 10k | 25k | 50k |

---

## Code Example

```javascript
const grid = createGrid(10, 5.625);
console.log(grid.cx(30));
```

---

<!-- font: Georgia -->

## Custom Font Slide

This slide renders in Georgia instead of the default.

---

<!-- layout: stagger -->

## Forced Layout

- These items
- Will appear
- As cascading
- Colour bars

---

<!-- layout: section -->
<!-- bg: 0F2A4A -->

Custom background section slide
```

## Elements

| Markdown | Slide Element |
|----------|--------------|
| `# Heading` | Title text |
| `## Heading` | Subtitle |
| `### Heading` | Small-caps section label |
| `- item` | Bullet point |
| `  - sub-item` | Nested bullet (2-space indent) |
| `> quote` | Callout / blockquote |
| `![alt](path)` | Embedded image |
| `\| col \| col \|` | Data table |
| `` ```lang ``` `` | Code block (monospace) |
| `[text](url)` | Clickable link |
| `` ```notes ``` `` | Speaker notes (hidden) |
| `<!-- layout: name -->` | Force layout |
| `<!-- bg: HEX -->` | Override background |
| `<!-- font: Name -->` | Per-slide font override |

## Layouts

Auto-detected based on content, or forced with `<!-- layout: name -->`:

| Layout | When Used | Style |
|--------|-----------|-------|
| `title` | First slide | Red accent block + topic pills |
| `section` | Title-only or forced | Dark bg, large centred text |
| `bullets` | 1–3 bullets | Numbered list with accent dots |
| `stagger` | 4+ bullets | Musica Viva cascading bars |
| `split` | Title + body text | Left title zone, right content |
| `rotated` | Has blockquote | Vertical rotated title bar |
| `fragment` | Links / many items | Fragmented colour grid |
| `overlap` | Forced | Two overlapping colour fields |
| `arc` | Forced | Concentric circles + text |
| `image` | Has image(s) | Image with title and caption |
| `table` | Has table | Styled data table with header |
| `code` | Has code block | Dark monospace code display |
| `blank` | Forced | Empty slide |

## Themes

Four built-in themes:

- **light** — warm white background, dark text (default)
- **dark** — near-black background, light text
- **red** — light bg with red accent emphasis
- **blue** — cool blue-grey palette

## Grid System

- **60 columns × 40 rows** on a 10" × 5.625" (16:9) canvas
- **0.5" margins** on all sides
- **0.02" micro-gutters** between cells
- Column width: ~0.130"
- Row height: ~0.096"

60 is divisible by 2, 3, 4, 5, 6, 10, 12, 15, 20, and 30 — one grid for any subdivision.

Guides are hierarchical:
- **÷12** (every 12th col) — strong divisions (5 zones)
- **÷5** (every 5th col) — medium divisions
- **÷1** (every col) — fine adjustments

## Programmatic Use

```javascript
const { generate, generateHTML, generateReview, parseMarkdown, createGrid, THEMES, LAYOUTS } = require("./raster.js");

// Generate PPTX
await generate("slides.md", "output.pptx", { theme: "dark", ratio: "16:9", font: "Georgia" });

// Generate HTML slideshow
await generateHTML("slides.md", "output.html", { theme: "dark" });

// Generate visual review page
await generateReview("slides.md", "review.html", { theme: "dark" });

// Parse markdown only
const slides = parseMarkdown(fs.readFileSync("slides.md", "utf-8"));

// Access the grid
const g = createGrid(10, 5.625);
console.log(g.cx(30)); // x position of column 30
console.log(g.cw(12)); // width spanning 12 columns
```

## HTML Slideshow Controls

| Key | Action |
|-----|--------|
| Arrow keys / Space | Navigate slides |
| **N** | Toggle speaker notes |
| **F** | Fullscreen |
| Home / End | First / last slide |
| Swipe (touch) | Navigate on mobile |

## Review Mode

`--format review` generates a thumbnail grid of all slides with:

- Colour-coded borders (green = ok, yellow = warning, red = issue)
- Content tags (title, bullets, table, code, notes, etc.)
- Speaker notes preview
- Arrow key grid navigation, Enter to zoom
- Lightbox with arrow key slide-by-slide inspection
- Console validation output for CI pipelines

## Google Slides Workflow

1. Generate `.pptx` with this tool
2. Upload to Google Drive
3. Open with Google Slides (imports cleanly)
4. Enable View → Snap to → Guides for smart snapping
5. Existing shapes act as snap targets for new elements

## PowerPoint Workflow

1. Open the generated `.pptx`
2. View → Show group → dialog launcher → Grid and Guides
3. Set spacing to **1/16"** for fine snapping
4. Check **Snap objects to grid**
5. Keep **Smart guides** enabled — they snap to template shape edges

Hold **Alt** while dragging to temporarily bypass all snapping.

## Credits

Grid system principles after Josef Müller-Brockmann (*Grid Systems in Graphic Design*), Karl Gerstner (*Designing Programmes*), and Wolfgang Weingart.
