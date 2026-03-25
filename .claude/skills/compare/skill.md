---
name: compare
description: Run multi-variant comparison of a deck across intensity levels and themes, with rubric evaluation and side-by-side review.
user_invocable: true
---

# Compare

Generate multiple variants of a deck (different intensities and/or themes), evaluate them against a rubric, and present a side-by-side comparison.

## Arguments

`/compare content/week-2/week-2.md`
`/compare content/week-2/week-2.md --explosive`
`/compare decks/week-1k.composed.md --theme dark`

## How to work

### 1. Understand the scope

**Standard mode** (default): 3 variants — minimal, moderate, maximal intensity on one theme.
**Explosive mode** (`--explosive`): 12 variants — 3 intensities × 4 themes.
**Focused mode** (`--theme dark`): 3 intensities on one specific theme.

### 2. Run comparison

```bash
node compare.js <source.md> [options]
```

Key options:
- `--theme light|dark|red|blue` — specific theme (default: light)
- `--explosive` — all 12 variants
- `--brief "creative direction"` — aesthetic guidance
- `--skip-eval` — render only, no rubric scoring (faster)
- `--model sonnet` — model for composition
- `--eval-model sonnet` — model for evaluation

This produces:
- Individual `.html` files for each variant in `decks/compare-<name>-<timestamp>/`
- A `<source>.compare.html` with side-by-side evaluation

### 3. Review results

Read the compare output to find the rubric scores. The 7 criteria are:
1. Content Fidelity — is all source content preserved?
2. Visual Hierarchy — does the layout guide the eye?
3. Grid Precision — are zones well-positioned on the 60-col grid?
4. Typographic Quality — is the type scale consistent and readable?
5. Chromatic Coherence — does the color arc make sense?
6. Accent Rhythm — are accents used with restraint and purpose?
7. Overall Design Quality — professional and distinctive?

### 4. Visual review in Chrome

Open the compare page and the winning variant in Chrome. Screenshot key slides from the best variant to show the user.

If the user wants to iterate:
- Pick the best variant as the new baseline
- Run `/compose` with a targeted `--brief` to refine
- Or run `/edit-slide` on specific slides that need adjustment

### 5. Report

```
Compare: week-2.md — 3 variants (light theme)
──────────────────────────────────────────────
  minimal:  72/100 (strong content fidelity, weak accent rhythm)
  moderate: 85/100 ★ winner (balanced across all criteria)
  maximal:  78/100 (bold design, some overflow issues)

Winner: moderate-light → decks/compare-week-2-.../moderate-light/week-2.moderate-light.html
```

Offer to:
- Open the winner in Chrome (`/preview`)
- Run `/qa-visual` on the winner
- Copy the winner's composed markdown as the canonical deck
