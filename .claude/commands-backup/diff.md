---
name: diff
description: Visual diff between two versions of a composed deck — shows which slides changed, what directives were modified, and side-by-side rendering.
---

# Diff

Compare two versions of a composed deck to see what changed.

## Arguments

`/diff decks/week-1k.composed.md decks/week-1j.composed.md`
`/diff decks/week-1k.html decks/week-1j.html`

## How to work

### 1. Resolve files

Accept either `.composed.md` or `.html` files. If HTML, find the corresponding composed markdown.

### 2. Run diff

```bash
node diff-slides.js <before.md> <after.md> --output decks/diff-output.html
```

This produces a side-by-side HTML diff showing:
- Slides that were added, removed, or modified
- Changes to design directives (bg, font, layout, zones)
- Content changes (title, body, bullets)

### 3. Analyze changes

Read the diff output. Summarize:
- How many slides changed?
- What categories of changes? (design vs content vs both)
- Any slides deleted or added?

### 4. Visual comparison in Chrome

If Chrome is connected, open both decks in separate tabs. For slides that changed, screenshot the same slide from both versions side-by-side.

### 5. Report

```
Diff: week-1k vs week-1j
────────────────────────
Slides: 40 → 40 (no additions/deletions)
Changed: 8 slides

Design changes:
  S15: bg F8F5F0 → 1C1A16 (light → dark)
  S27: font Helvetica Neue → Georgia
  S38: title-size 44 → 36

Content changes:
  S8: body text shortened (overflow fix)
  S21: body size 28 → 18px
```
