---
name: studio
description: Open the studio viewer — a precision presentation tool with grid view, QA panel, and speaker notes.
---

# Studio

Open the studio viewer for a deck — combines full-screen presentation, grid thumbnails, and QA validation.

## Arguments

`/studio decks/week-1k.html`
`/studio decks/week-1k.composed.md`

## How to work

### 1. Generate studio HTML

```bash
node studio.js <input.md> <output.studio.html> --theme light
```

Or if the user passed an HTML file, find its composed markdown source and generate the studio version.

### 2. Open in Chrome

Navigate to `http://localhost:8701/<deck>.studio.html`.

The studio has three modes (keyboard shortcuts):
- **P** — Present mode (full-screen slides)
- **G** — Grid mode (all slide thumbnails with validation icons)
- **Q** — QA mode (slide + side panel with issues)

### 3. Screenshot and report

Take a screenshot of the grid view to show the user the full deck overview. This is useful for spotting visual inconsistencies at a glance.
