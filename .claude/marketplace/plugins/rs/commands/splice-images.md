---
name: splice-images
description: Merge generated images into an HTML slide deck with intelligent, collision-aware placement.
---

# Splice Images

Integrate AI-generated images into an HTML slide deck. Claude reads the deck structure, analyzes each slide's content zones, and makes placement decisions that avoid text collisions.

## Arguments

`/rs:splice-images decks/week-1k.html`
`/rs:splice-images decks/week-1k.html decks/week-1-images/`

If no images directory specified, infer from the deck filename.

## How to work

### 1. Find images

Glob for the images directory:
- `decks/<deck-basename>-images/`
- `decks/week-N-images/` (extract week number)

Count available `.png` files. Report how many were found.

### 2. Analyze the deck

Open the HTML in Chrome (or read it directly). For each slide, understand:
- **Zone positions** — where is the title, body, bullets, label text?
- **Text density** — how much of the slide is occupied by content?
- **Background color** — is it dark or light?
- **Existing images** — skip slides that already have images

### 3. Make placement decisions

For each slide, choose the best image placement by reading the HTML structure:

| Placement | When to use |
|-----------|-------------|
| `right` / `left` | Slide has empty space on one side (zones don't extend to edge) |
| `inset-tr` / `inset-bl` | Slide has a free corner with no text |
| `bottom` / `top` | Slide has empty strip at top or bottom |
| `background` | All areas have text — use very low opacity (0.04-0.08 based on density) |
| `none` | Blank/minimal slides, or slides that already have images |

**Collision rules:**
- Never place an image panel over a text zone
- For background mode, scale opacity inversely with text density:
  - Dense (>60% occupied): opacity 0.04
  - Medium (40-60%): opacity 0.06
  - Sparse (<40%): opacity 0.08
- Prefer zero-overlap placements over low-overlap ones
- Vary placement — don't use the same mode 3+ times in a row

### 4. Apply

Use the splice-images.js module:
```bash
node splice-images.js <deck.html> <images-dir> --output <deck.html>
```

Or for more control, edit the HTML directly — insert `<div>` elements with appropriate positioning and opacity into each `<section>` slide.

### 5. Verify in Chrome

Reload the deck. Screenshot 3-4 slides with different placement types to confirm:
- Text is fully readable (no collision)
- Images are visible but not dominant
- Variety in placement across the deck

### 6. Report

Show placement distribution and offer to adjust specific slides if any look off.
