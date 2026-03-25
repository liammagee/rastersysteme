---
name: export
description: Export a slide deck to PDF or PPTX format.
user_invocable: true
---

# Export

Export a rendered HTML deck to PDF or generate PPTX from composed markdown.

## Arguments

`/export decks/week-1k.html --pdf`
`/export decks/week-1k.composed.md --pptx`
`/export decks/week-1k.html` (defaults to PDF)

## How to work

### 1. Determine format

If the user says "pdf" or passes an HTML file → PDF export.
If the user says "pptx" or "powerpoint" → PPTX generation.
If ambiguous, ask.

### 2. Export PDF

```bash
node export-pdf.js <slides.html> --output <slides.pdf>
```

Options:
- `--width` / `--height` — page dimensions
- `--no-notes` — exclude speaker notes

Requires Puppeteer (headless Chrome).

### 3. Generate PPTX

```bash
node raster.js <source.composed.md> <output.pptx> --format pptx --theme light
```

### 4. Report

State the output file path and size. Offer to open it.
