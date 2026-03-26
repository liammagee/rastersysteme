---
name: render
description: Re-render an HTML slide deck from its composed markdown source. Rebuilds after edits, optionally splices images and reloads in Chrome.
---

# Render

Re-render HTML from a composed markdown file after edits.

## Arguments

`/rs:render decks/week-1k.composed.md`
`/rs:render decks/week-1k.html`
`/rs:render` (uses most recently modified composed.md in decks/)

Options via natural language: "with dark theme", "also splice images", "and pptx"

## How to work

### 1. Resolve files

Given either `.composed.md` or `.html`, find the other. If no argument, glob for `decks/*.composed.md` and pick the most recently modified.

### 2. Render

Run via Bash:
```bash
node raster.js <source.composed.md> <output.html> --format html --theme <theme>
```

For PPTX (if requested):
```bash
node raster.js <source.composed.md> <output.pptx> --format pptx --theme <theme>
```

### 3. Splice images (if requested or if images exist)

Check if an images directory exists for this deck (e.g., `decks/week-1-images/`).
If it does and the user asked to splice (or the HTML was previously spliced):
```bash
node splice-images.js <output.html> <images-dir> --output <output.html>
```

### 4. Reload in Chrome

If Chrome is connected and the deck is open in a tab, reload it:
```javascript
location.reload()
```

Screenshot slide 1 to confirm the render worked.

### 5. Report

State the slide count, theme, and any splice info. Keep it to one line.
