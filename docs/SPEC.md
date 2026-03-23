# rastersysteme — Markdown Slide Specification

Version 1.0 — defines the input format, composition rules, and validation criteria.

## 1. Source Markdown Format

### 1.1 Slide Separation

Slides are separated by `---` on its own line with newlines before and after:

```markdown
# Slide One

Content here

---

## Slide Two

More content
```

### 1.2 Content Elements

| Markdown | Element | Rendering |
| --- | --- | --- |
| `# Heading` | Title | 28-40pt, bold |
| `## Heading` | Subtitle | 18-24pt |
| `### Heading` | Section label | 8pt, small-caps, letterspaced |
| `- item` | Bullet | List item |
| `  - sub` | Nested bullet | Indented sub-item |
| `> quote` | Blockquote | Callout text |
| `![alt](src)` | Image | Embedded image |
| `\| col \| col \|` | Table | Styled data table |
| `` ```lang ``` `` | Code block | Monospace display |
| `[text](url)` | Link | Clickable link |

### 1.3 Directives (HTML Comments)

| Directive | Effect |
| --- | --- |
| `<!-- layout: name -->` | Force a specific layout |
| `<!-- bg: HEX -->` | Override background color (6-char hex, no #) |
| `<!-- font: Name -->` | Per-slide font override |

### 1.4 Speaker Notes

```markdown
```notes
Speaker notes here — rendered in PPTX notes pane, not on slide.
```​
```

### 1.5 Layouts

13 layout types, auto-detected or forced via directive:

| Layout | Auto-detection | Visual |
| --- | --- | --- |
| `title` | First slide | Red accent block + topic pills |
| `section` | Title-only | Dark bg, large centered text |
| `bullets` | 1-3 bullets | Numbered list with accent dots |
| `stagger` | 4+ bullets | Musica Viva cascading bars |
| `split` | Title + body | Left title, right content |
| `rotated` | Has blockquote | Vertical rotated title bar |
| `fragment` | Links / many items | Colored block mosaic |
| `overlap` | Forced only | Two overlapping color fields |
| `arc` | Forced only | Concentric circles + text |
| `image` | Has image(s) | Image with caption |
| `table` | Has table | Styled data table |
| `code` | Has code block | Dark monospace display |
| `blank` | Forced only | Empty slide |

## 2. Composition Rules

### 2.1 Content Preservation (MANDATORY)

The composer (compose.js) MUST preserve all source content:

- **Slide count**: output slide count >= source slide count (blank insertions allowed)
- **Slide order**: source slide N must appear as output slide N (or later if blanks inserted)
- **Text fidelity**: all text content (titles, subtitles, bullets, body, blockquotes, links, URLs, dates, names, percentages) must appear VERBATIM in the output
- **Speaker notes**: preserved exactly, with optional design rationale appended
- **No invention**: no text content may be added that does not exist in the source

### 2.2 Design Elements (what the composer MAY add)

- `<!-- layout: name -->` directive on every slide (REQUIRED)
- `<!-- bg: HEX -->` background color overrides
- `<!-- font: Name -->` font overrides
- `### SECTION LABEL` for typographic texture
- `<!-- layout: blank -->` slides inserted between existing slides

### 2.3 Intensity Levels

| Level | Layout variety | Bg overrides | Font overrides | Blank slides | Labels |
| --- | --- | --- | --- | --- | --- |
| `minimal` | Best-fit per slide | <= 30%, greyscale only | None | None | Sparse |
| `moderate` | 5+ types, no > 30% | 30-60%, 2-3 color arc | 2-3 slides | 1-2 | Most slides |
| `maximal` | 8+ types, no > 20% | 50-80%, full arc | 15-25% | 2-4 | 60%+ |

### 2.4 Theme Compliance

Composed output must work with the selected theme. Background overrides should complement, not conflict with, the theme's text colors. The renderer (`raster.js`) automatically adapts text colors when bg darkness contradicts the theme via `adaptThemeForBg()`.

## 3. Rendering Rules

### 3.1 Grid System

- 60 columns x 40 rows on 10" x 5.625" (16:9) canvas
- 0.5" margins, 0.02" micro-gutters
- Column width: ~0.130", Row height: ~0.096"

### 3.2 Theme Colors

Four built-in themes. Each provides: `bg`, `bgAlt`, `bgDark`, `text`, `textMid`, `textLight`, `accent`, `accent2`, `accent3`, `accent4`, `white`, `black`, `grey`.

When a `<!-- bg: HEX -->` override's luminance contradicts the theme (dark bg on light theme or vice versa), `adaptThemeForBg()` swaps text and accent colors to maintain readability.

### 3.3 HTML/PPTX Parity

Both renderers must produce visually equivalent output:
- Same layout structure per slide
- Same background colors (overrides applied after layout renderer)
- Same text color adaptation for bg overrides
- Same font application

## 4. Validation Criteria

### 4.1 Content Validation (post-composition)

| Check | Pass condition |
| --- | --- |
| Slide count | output >= source (no slides dropped) |
| URL preservation | all URLs from source appear in output |
| Date preservation | all dates from source appear in output |
| Email preservation | all emails from source appear in output |
| Number preservation | all percentages/weights from source appear in output |
| Notes preservation | all speaker notes from source appear in output |
| No invention | no URLs, dates, emails in output that aren't in source |

### 4.2 Design Validation (post-composition)

| Check | Pass condition |
| --- | --- |
| Layout directives | every slide has `<!-- layout: name -->` |
| Layout validity | all layout names are from the 13 valid types |
| Layout variety | meets intensity minimum (minimal: any, moderate: 5+, maximal: 8+) |
| No 3x repeat | no layout appears 3+ times consecutively |
| Bg format | all `<!-- bg: -->` values are valid 6-char hex |

### 4.3 Accessibility Validation (post-rendering)

| Check | Pass condition |
| --- | --- |
| Text contrast | text/bg contrast ratio >= 4.5:1 (AA) for body, >= 3:1 for large text |
| Accent contrast | white text on accent colors >= 3:1 (AA large) |
| Font size | minimum 8pt (section labels) |

## 5. File Conventions

| File | Purpose |
| --- | --- |
| `*.md` | Source markdown |
| `*.composed.md` | Composed markdown (directives added) |
| `*.pptx` | Rendered PowerPoint |
| `*.html` | Rendered HTML slideshow |
| `*.review.html` | Visual QA review page |
| `*.compare.html` | Multi-variant comparison report |
