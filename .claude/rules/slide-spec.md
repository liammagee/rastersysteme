---
paths:
  - "**/*.composed.md"
  - "content/**/*.md"
  - "raster.js"
  - "compose.js"
---

# Slide Markdown Specification

Composed markdown uses these directives (HTML comments):

- `<!-- layout: name -->` — force a specific layout (title, section, bullets, split, rotated, stagger, frag, overlap, arc, image, video, table, code, blank)
- `<!-- bg: HEX -->` — override slide background color (6-char hex, no #)
- `<!-- font: Name -->` — override slide font family
- `<!-- transition: name -->` — slide transition (fade, slide-up, slide-down, slide-left, slide-right, zoom, zoom-out, cut, none)
- `<!-- style: key=value; ... -->` — inline style overrides (title-size, body-size, spacing, padding, opacity, align, color, invert)
- `<!-- design: {...} -->` — full JSON design directive for grid-based composition

Slides are separated by `---` on its own line. Speaker notes use `<!-- notes: ... -->`.
