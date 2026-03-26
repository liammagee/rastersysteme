---
name: design-system
description: Manage design systems — list, preview, generate new ones, or apply a saved system to a deck.
---

# Design System

Create, browse, preview, and apply saved design systems.

## Arguments

`/rs:design-system list`
`/rs:design-system show papier-gris`
`/rs:design-system generate "warm minimal editorial"`
`/rs:design-system preview papier-gris`

## How to work

### 1. List available systems

```bash
node design-system.js list
```

Or read `design-systems/*.json` directly. Show each system's name and one-line description.

### 2. Show a system

Read the JSON file and present:
- **Aesthetic** — the overall description
- **Palette** — colors with names and roles
- **Grid strategy** — zone archetypes
- **Font strategy** — primary, secondary, when to use each
- **Accent strategy** — lines, bars, dots, and their rhythm
- **Type scale** — title range, body size, label size

### 3. Generate a new system

```bash
node design-system.js generate <name> --brief "<direction>" --model sonnet
```

Or craft one directly: read the design plan format from an existing composed deck, write a new design system JSON that captures the aesthetic, and save it.

### 4. Preview a system

Render a sample deck using the system:
```bash
node design-system.js preview <name> --theme light
```

Open the preview in Chrome and screenshot a few slides to show the user.

### 5. Apply to a deck

Use the system with `/rs:compose`:
```bash
/compose content/week-2/week-2.md --design-system <name>
```

### 6. Save from an existing deck

If the user likes a deck's aesthetic, extract its design plan and save as a reusable system:
- Read the `<!-- DESIGN PLAN {...} -->` from the composed markdown
- Save to `design-systems/<name>.json`
