---
name: delete-slide
description: Remove one or more slides from a composed markdown deck, with confirmation and re-render.
user_invocable: true
---

# Delete Slide

Remove slides from a composed markdown file.

## Arguments

`/delete-slide decks/week-1k.composed.md slide 13`
`/delete-slide decks/week-1k.composed.md slides 13-15`

## How to work

### 1. Read the slide(s)

Read the composed markdown. Locate slide N (or range N-M). Show what will be deleted:
- Slide number, title, first line of body
- Whether it's a section divider or dark slide (may affect chromatic arc)

### 2. Confirm

Ask: "Delete slide 13 ('AI Ethics Overview')? Deck: 40 → 39 slides."

If it's a section-opening slide or dark divider, warn that this may affect the deck's visual rhythm.

### 3. Delete

Edit the composed markdown using the Edit tool:
- Remove the slide's content (everything between its `---` separators)
- Remove one `---` separator to avoid doubles
- Preserve the DESIGN PLAN comment and all other slides

### 4. Re-render

```bash
node raster.js <source.composed.md> <output.html> --format html --theme light
```

### 5. Report

"Deleted slide 13. Deck: 40 → 39 slides. Re-rendered."
