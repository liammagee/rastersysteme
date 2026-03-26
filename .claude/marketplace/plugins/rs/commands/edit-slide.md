---
name: edit-slide
description: Edit a specific slide's content, design directive, or layout in a composed markdown deck. Reads context and verifies in Chrome.
---

# Edit Slide

Modify a slide in a composed markdown file. Claude reads the slide, understands the design context, applies changes, re-renders, and verifies visually.

## Arguments

`/rs:edit-slide decks/week-1k.composed.md slide 15`
`/rs:edit-slide decks/week-1k.composed.md slide 15 "change bg to dark"`
`/rs:edit-slide slide 15 bg=1C1A16`

## How to work

### 1. Locate the slide

Read the composed markdown. Slides are separated by `---` lines. Count to slide N and extract:
- The `<!-- design: {...} -->` directive JSON
- The markdown content (headings, body, bullets, notes)

Parse the design JSON to understand: zones, accents, typography, bg, font.

### 2. Show current state

Tell the user what slide N currently contains:
- Title and section label
- Body text (first ~50 chars)
- Bullet count
- Design: bg color, font, title size, zone layout

If Chrome is connected, navigate to the slide and screenshot it.

### 3. Understand the edit

The user might ask for:

**Content changes:**
- "change the title to X"
- "add a bullet: Y"
- "remove the third bullet"
- "update body text to Z"

**Design changes:**
- "make it dark" → change bg to `1C1A16`, adapt text colors
- "use Georgia" → change font
- "bigger title" → increase title size
- "move text to the left" → adjust zone col/span

**Aesthetic fixes:**
- "the text overlaps the accent" → adjust zone row/rowSpan
- "too much whitespace" → reposition zones
- "contrast is bad" → fix text color relative to bg

### 4. Apply the edit

Use the Edit tool to modify the slide's section in the composed markdown.

For design JSON changes, parse the existing JSON, modify the relevant fields, and write it back. Be careful to preserve the full JSON structure.

For content changes, edit the markdown text directly.

### 5. Re-render and verify

```bash
node raster.js <source.composed.md> <output.html> --format html --theme light
```

If images were previously spliced, re-splice:
```bash
node splice-images.js <output.html> <images-dir> --output <output.html>
```

Reload in Chrome, navigate to the edited slide, screenshot, and show the result.

### 6. Iterate

If the user says "looks good" → done.
If they want more changes → repeat from step 3.
