---
name: gslides-imagine
description: Extract content from a Google Slides presentation, generate image prompts via Claude, create images via Midjourney/Imagen, then upload as atmospheric backgrounds.
argument-hint: "<presentation-url> [--generate] [--upload] [--style <name>]"
allowed-tools:
  - Bash
  - Read
  - Write
---

# Google Slides Imagine

Generate and upload atmospheric background images to an existing Google Slides presentation.

## Pipeline

1. **Read** — Extract slide-by-slide content (titles, body, bg colors) via Google Slides API
2. **Prompt** — Generate per-slide image prompts via Claude (same engine as `/rs:imagine`)
3. **Generate** — Create images via Midjourney or Google Imagen
4. **Pre-process** — Bake background color opacity into images (atmospheric effect)
5. **Upload** — Insert as full-bleed background images, sent to back

## Usage

```bash
# Step 1: Generate prompts only (review before generating)
node gslides-imagine.js https://docs.google.com/presentation/d/1abc.../edit

# Step 2: Generate images + upload
node gslides-imagine.js 1abc... --generate --upload --style editorial

# Target specific slides
node gslides-imagine.js 1abc... --generate --upload --slides 1-10 --style swiss-poster
```

## Options

- `--style <name>` — Image aesthetic: swiss-poster (default), bauhaus, editorial, data-viz, collage, architectural, generative
- `--abstraction <level>` — abstract, suggestive (default), representational, literal
- `--engine <name>` — midjourney (default) or imagen
- `--generate` — Actually create images (default: prompts only)
- `--upload` — Upload images to the presentation as backgrounds
- `--opacity <n>` — Background opacity bake level (default: 0.75, higher = more faded)
- `--slides <range>` — Target specific slides: "1-10" or "3,5,8"

## Requirements

- Google OAuth token (`.gslides-token.json` — created by first run of `export-gslides.js`)
- For Midjourney: `MIDJOURNEY_DISCORD_TOKEN`, `MIDJOURNEY_SERVER_ID`, `MIDJOURNEY_CHANNEL_ID` in `.env`
- For Imagen: `GOOGLE_API_KEY` in `.env`
