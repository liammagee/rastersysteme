# rastersysteme

Swiss 60-column grid slide generator -- takes Markdown, outputs HTML and PPTX on a Muller-Brockmann / Gerstner-inspired modular grid.

## Quick Start

```bash
npm install
npm start                    # interactive wizard
npm run raster -- slides.md  # direct render
```

## Architecture

```
source.md --> compose.js --> *.composed.md --> raster.js --> HTML/PPTX
                  |                              |
            design-system.js              splice-images.js
            compare.js                    export-pdf.js
            imagine.js                    watch.js
            pace.js                       diff-slides.js
```

## npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `node rastersysteme.js` | Interactive wizard -- guides you through compose, render, and review |
| `raster` | `node raster.js` | Render Markdown to PPTX or HTML on the 60-column grid |
| `compose` | `node compose.js` | Claude art-directs slides: selects layouts, builds colour arcs, adds texture |
| `test` | `node --test raster.test.js` | Run unit test suite |
| `review` | `node raster.js --format review` | Generate thumbnail grid with validation badges |
| `studio` | `node studio.js` | Precision viewer with Present, Grid, and QA modes |
| `compare` | `node compare.js` | 3-way A/B comparison across intensity levels with rubric evaluation |
| `imagine` | `node imagine.js` | Generate image prompts and call Midjourney/Imagen APIs |
| `pace` | `node pace.js` | Annotate slides with timing cues and pacing metadata |
| `watch` | `node watch.js` | Hot-reload server -- re-renders on file change |
| `diff` | `node diff-slides.js` | Visual diff between two versions of a deck |
| `design` | `node design-system.js` | Save, load, generate, or preview design system tokens |
| `pdf` | `node export-pdf.js` | Export HTML slides to PDF via Puppeteer |
| `serve` | `python3 -m http.server 8701` | Static file server on port 8701 |
| `explorer` | `node explorer.js` | Browse design systems and slide decks in a specimen-catalogue UI |
| `refresh` | `node refresh.js` | Regenerate all static/generated HTML outputs from source |
| `qa` | `node qa.js` | WCAG accessibility audit, design scoring, content validation |
| `batch` | `node batch.js` | Run raster, compose, or qa across all Markdown files in a folder |

## Markdown Format

Slides are separated by `---`. Standard Markdown maps to slide content:

```markdown
# Title Slide
Subtitle text

---

## Content Slide

### SECTION LABEL

- Bullet point
  - Sub-point (2-space indent)

> Callout blockquote

```notes
Speaker notes -- rendered in PPTX notes pane, not on slide.
```

---

## Slide with Image

![Alt text](path/to/image.png)

Caption text below
```

| Markdown | Slide Element |
|----------|---------------|
| `# Heading` | Title text |
| `## Heading` | Subtitle |
| `### Heading` | Small-caps section label |
| `- item` | Bullet point |
| `  - sub-item` | Nested bullet |
| `> quote` | Callout / blockquote |
| `![alt](path)` | Embedded image |
| `\| col \| col \|` | Data table |
| `` ```lang ``` `` | Code block (monospace) |
| `[text](url)` | Clickable link |
| `` ```notes ``` `` | Speaker notes (hidden) |

## Directives

HTML comments control per-slide rendering. Place them before the slide heading.

| Directive | Example | Effect |
|-----------|---------|--------|
| `layout` | `<!-- layout: stagger -->` | Force a specific layout |
| `bg` | `<!-- bg: 0F2A4A -->` | Override background colour (hex) |
| `font` | `<!-- font: Georgia -->` | Per-slide font override |
| `transition` | `<!-- transition: fade -->` | Slide transition style |
| `style` | `<!-- style: letter-spacing:0.3em -->` | Inline CSS overrides |
| `design` | `<!-- design: minimal -->` | Apply a named design system |

## Layouts

Auto-detected from content, or forced with `<!-- layout: name -->`:

| Layout | Auto-detection Rule | Style |
|--------|---------------------|-------|
| `title` | First slide | Red accent block + topic pills |
| `section` | Title-only or forced | Dark bg, large centred text |
| `bullets` | 1--3 bullets | Numbered list with accent dots |
| `stagger` | 4+ bullets | Musica Viva cascading colour bars |
| `split` | Title + body text | Left title zone, right content |
| `rotated` | Has blockquote | Vertical rotated title bar |
| `fragment` | Links / many items | Fragmented colour grid |
| `overlap` | Forced only | Two overlapping colour fields |
| `arc` | Forced only | Concentric circles + text |
| `image` | Has image(s) | Image with title and caption |
| `table` | Has table | Styled data table with header |
| `code` | Has code block | Dark monospace code display |
| `blank` | Forced only | Empty slide (pacing / breath) |

## Themes

| Theme | Background | Accent |
|-------|------------|--------|
| `light` | Warm white | Dark text, red accent (default) |
| `dark` | Near-black | Light text, warm highlights |
| `red` | Light | Red emphasis throughout |
| `blue` | Cool blue-grey | Blue accent palette |

Set with `--theme <name>` on any command.

## Tools Reference

**compose.js** -- Claude art-directs a Markdown deck via JSON directives. Supports three intensity levels (faithful, moderate, radical), design system tokens, mood briefs, and optional image generation. Produces a `*.composed.md` intermediate file that can be hand-edited before rendering. Incremental mode allows batched, resumable composition with live HTML preview.

**compare.js** -- Runs all three intensity levels against the same source, generating a 3-way A/B comparison. Includes an "explosive" mode for maximum divergence. Each variant is scored against a 100-point rubric covering content completeness, design quality, fidelity, speaker notes, pacing, accessibility, and narrative coherence.

**imagine.js** -- Generates image prompts from slide content and dispatches them to Midjourney or Imagen APIs. Supports multiple abstraction levels (literal, conceptual, abstract) and visual styles. Output images are sized and named for direct use by splice-images.

**splice-images.js** -- Injects generated or existing images into rendered HTML slides. Matches images to slides by filename convention and handles sizing, cropping, and placement on the 60-column grid.

**pace.js** -- Adds timing cues and pacing metadata to a composed deck. Analyses content density per slide and suggests durations, marks breath/pause slides, and generates a timing summary for rehearsal.

**watch.js** -- Hot-reload development server. Watches source Markdown and composed files for changes, re-renders HTML on save, and pushes updates to the browser via live reload.

**diff-slides.js** -- Visual diff between two versions of a deck. Highlights added, removed, and changed slides side-by-side with layout and content change indicators.

**design-system.js** -- Save, load, generate, and preview design system tokens (colours, fonts, spacing, accent palette). Tokens can be extracted from a composed deck or created from scratch and applied to future compositions.

**export-pdf.js** -- Renders HTML slides to PDF using headless Puppeteer. Produces one page per slide at presentation aspect ratio.

**grid-compose.js** -- Direct 60x40 grid placement mode. Instead of choosing from 13 fixed layouts, Claude (or a generative algorithm) places each element at specific grid coordinates with explicit font sizes, colours, and spans.

**qa.js** -- Runs a quality audit: WCAG contrast ratio checks, design scoring (layout variety, colour arc, typographic contrast), and content validation (missing titles, orphaned notes, empty slides).

## Presenter Mode

Press **P** during an HTML slideshow to enter presenter mode. Opens a dual-window setup: the audience window shows slides full-screen while the presenter window shows the current slide, next slide preview, speaker notes, and a countdown timer.

| Key | Action |
|-----|--------|
| Arrow keys / Space | Navigate slides |
| **P** | Toggle presenter mode |
| **N** | Toggle speaker notes |
| **G** | Grid overview (studio) |
| **Q** | QA panel (studio) |
| **F** | Fullscreen |
| Home / End | First / last slide |

## Grid System

60 columns x 40 rows on a 10" x 5.625" (16:9) canvas. 60 is divisible by 2, 3, 4, 5, 6, 10, 12, 15, 20, and 30 -- one grid serves any subdivision.

## Credits

Grid system principles after Josef Muller-Brockmann (*Grid Systems in Graphic Design*), Karl Gerstner (*Designing Programmes*), and Wolfgang Weingart.
