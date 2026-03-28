---
name: compose
description: Run Claude-directed composition on source markdown — assigns design directives (grid zones, typography, colors, accents) to each slide.
user_invocable: true
model: opus
effort: high
context: fork
---

# Compose

Run Claude composition to assign design directives to source markdown slides.

## Arguments

`/compose content/week-2/week-2.md`
`/compose content/week-2/week-2.md --intensity maximal --theme dark`
`/compose decks/week-1k.composed.md --slides 5-10`

## How to work

### 1. Understand the source

Read the source markdown. Count slides (separated by `---`). Identify:
- How many slides
- What content types are present (titles, bullets, body, quotes, tables, code)
- Whether this is a fresh composition or a recompose of specific slides

### 2. Check for design systems

List available saved design systems:
```bash
ls design-systems/
```

If the user wants to reuse one, note it. Otherwise compose.js will generate a fresh design system.

### 3. Run composition

```bash
node compose.js <input.md> <output> [options]
```

Key options:
- `--theme light|dark|red|blue`
- `--intensity minimal|moderate|maximal`
- `--brief "creative direction"` — use this to convey the user's aesthetic preferences
- `--slides 5-10` — recompose only specific slides
- `--design-system <name>` — reuse a saved design system
- `--model sonnet|haiku|opus`

### 4. Review the result

After composition:
- Read the generated `.composed.md` to check the design plan
- Render to HTML and open in Chrome
- Screenshot a few slides (first, middle, last) to show the user

### 5. Quality check

Run a quick audit:
- Check title size consistency across slides
- Verify the chromatic arc has intentional rhythm (not random)
- Confirm fonts are used as specified in the design plan
- Flag any obvious contrast issues

Report a summary: "40 slides composed. Design: 'Papier Gris'. Palette: cream/umber/ink. 3 dark dividers at slides 15, 27, 38."

Offer to run `/rs:qa-visual` for a full accessibility audit.
