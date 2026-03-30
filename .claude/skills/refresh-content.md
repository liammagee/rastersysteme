---
name: refresh-content
description: Reload source markdown content into an existing composed deck, preserving all design directives. Use for minor content edits that don't need a full recompose.
argument-hint: "<source.md> <composed.md> [--render] [--output <path>]"
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
---

# Refresh Content

Reload slide content from source markdown into an existing composed deck, preserving all design directives (zones, accents, typography, backgrounds).

## When to use

- Minor text edits to slides (typos, rewording, adding a bullet)
- Source markdown was updated but design is fine
- You want to skip the full Claude compose step (saves 3-5 minutes)

## How to invoke

```bash
node refresh-content.js <source.md> <composed.md> [--render] [--output <path>]
```

## Arguments

The user provides:
- `<source.md>` — the updated source markdown (e.g., `content/week-2/week-2.md`)
- `<composed.md>` — the existing composed deck to refresh (e.g., `decks/week-2-v18.composed.md`)

Options:
- `--render` — re-render HTML after refresh (with background images)
- `--output <path>` — write to a new file instead of overwriting
- `--gslides` — re-export to Google Slides after refresh

## What it does

1. Parses source markdown into slides (split by `---`)
2. Extracts design directives from the composed deck (`<!-- design: -->`, `<!-- image: -->`, `<!-- notes: -->`, etc.)
3. Replaces slide content while preserving directives
4. Reports: N updated, N unchanged, N new slides
5. Optionally re-renders HTML and/or exports to Google Slides

## What it preserves

- All `<!-- design: {...} -->` JSON directives
- `<!-- image: ... -->` placement hints
- `<!-- notes: ... -->` speaker notes
- `<!-- bg: -->`, `<!-- font: -->`, `<!-- layout: -->` overrides

## What it replaces

- Headings (# ## ###)
- Body text paragraphs
- Bullet lists
- Blockquotes
- Tables
- Code blocks
- Inline images

## Example workflow

```
# 1. Edit your source markdown
vim content/week-2/week-2.md

# 2. Refresh into existing design
/refresh-content content/week-2/week-2.md decks/week-2-v18.composed.md --render

# 3. Check the result
open decks/week-2-v18.html
```
