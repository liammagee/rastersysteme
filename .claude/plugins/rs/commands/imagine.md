---
name: imagine
description: Generate consistent image prompts for each slide in a deck, with a visual thread that connects the entire series. Optionally generate images.
user_invocable: true
---

# Imagine

Generate AI image prompts for every slide in a deck. Creates a visual thread (consistent palette, motif, atmosphere) that runs through the entire series.

## Arguments

`/imagine content/week-2/week-2.md`
`/imagine decks/week-1k.composed.md --style bauhaus`
`/imagine decks/week-1k.composed.md --generate`

## How to work

### 1. Understand the deck

Read the source markdown or composed markdown. Extract:
- Total slide count
- Each slide's title and key content
- The design plan (if composed) — palette, aesthetic, chromatic arc
- The deck's subject matter and tone

### 2. Choose a style

Available presets: `swiss-poster` (default), `bauhaus`, `editorial`, `data-viz`, `collage`, `architectural`, `generative`.

The user can also describe a custom style. The style should complement the deck's design system.

### 3. Generate prompts

```bash
node imagine.js <input.md> --style <style> [options]
```

Options:
- `--style <name>` — visual style preset
- `--abstraction abstract|suggestive|representational|literal` — how literal the images should be
- `--aspect 16:9|1:1|4:3` — aspect ratio
- `--slides 5-10` — only specific slides
- `--generate` — actually create images via API (requires API key)
- `--engine midjourney|imagen` — image generation engine

Output goes to `decks/<deck-name>-images/`:
- `prompts.json` — full prompt set with visual thread
- `slide-01.txt` through `slide-NN.txt` — individual prompts

### 4. Review the visual thread

Read `prompts.json` and present the visual thread to the user:
- **Palette** — the 4-5 colors that unify all images
- **Motif** — the recurring visual element
- **Atmosphere** — the overall feel
- **Arc** — how images evolve across the deck

Show a few sample prompts so the user can judge the quality.

### 5. Generate images (if requested)

If `--generate` was passed, the tool creates images via API. This is slow (30-60s per image). Report progress.

### 6. Next steps

After prompts are generated, offer:
- `/rs:splice-images` to merge generated images into the HTML deck
- Adjust style/abstraction and re-generate if prompts don't feel right
- Generate for specific slides only with `--slides`
