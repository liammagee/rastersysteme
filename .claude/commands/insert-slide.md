---
name: insert-slide
description: Insert a new slide into a composed markdown deck at a specific position, with a design directive that fits the surrounding context.
---

# Insert Slide

Add a new slide to a composed markdown deck. Claude reads the design plan and surrounding slides to craft a design directive that fits the deck's aesthetic.

## Arguments

`/insert-slide decks/week-1k.composed.md after 5`
`/insert-slide decks/week-1k.composed.md after 5 "# New Title\nBody text"`

## How to work

### 1. Read context

Read the composed markdown. Extract:
- The **DESIGN PLAN** comment at the top (palette, chromatic arc, grid strategy, font strategy, accent strategy)
- The design directives of **slides N-1, N, N+1** (the neighbourhood)
- Their bg colors, fonts, zone archetypes, typography

### 2. Get content

If the user provided content, use it. Otherwise ask: "What should this slide contain?"

Parse the content to determine:
- Does it have a section label? (`### LABEL`)
- Title? (`## Title`)
- Bullets? (` - item`)
- Body text?
- A blockquote?

### 3. Craft the design directive

Based on the design plan and surrounding context, create a `<!-- design: {...} -->` directive:

**Grid zones** — pick from the grid strategy's archetypes (Wide Statement, Sidebar Column, Offset Right, Centred Editorial, etc.). Don't repeat the same archetype as the adjacent slide.

**Background** — follow the chromatic arc. Check what colors the surrounding slides use:
- If between two light slides → use light bg or the alternate (bgAlt/Warm Sand)
- If at a dark divider position → use dark bg (`1C1A16`)

**Typography** — match the established sizes:
- Title: typically 44px (the deck median), range 36-52
- Body: 14px
- Label: 11px, uppercase, tracked
- Bullets: 14px

**Font** — check the font strategy. Most slides use Helvetica Neue; Georgia appears on ~6 editorial/reflective slides.

**Accents** — add a horizontal line or bar accent consistent with the accent strategy.

### 4. Assemble and insert

Build the full slide markdown:
```markdown
<!-- design: {"zones":[...],"accents":[...],"typography":{...},"bg":"...","font":"..."} -->
### SECTION LABEL
## Slide Title

Body text here

 - Bullet one
 - Bullet two
```

Edit the composed markdown file directly using the Edit tool:
- Find the `---` separator after slide N
- Insert the new slide content followed by `---`

### 5. Re-render and verify

```bash
node raster.js <source.composed.md> <output.html> --format html --theme light
```

If Chrome is connected, reload and navigate to the new slide. Screenshot it to confirm it looks right.

Report: "Inserted slide N+1: 'Title'. Deck now has M slides."
