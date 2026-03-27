---
name: evaluate
description: Score a rendered slide deck against the 10-dimension design rubric using the multiway evaluation harness. Combines headless, vision, and textual evaluators.
---

# Evaluate

Score a rendered HTML deck against the design rubric (see RUBRIC.md) using all available evaluators.

## Arguments

`/evaluate decks/week-2.html`
`/evaluate decks/week-2.html --evaluators headless,vision`

## How to work

### 0. Pre-eval: Splice images if available

Before running any evaluation, **always** check if an image set exists for the deck and splice it in. Images affect visual scoring and image integration scores.

```bash
# Check for images directory matching the deck name
ls content/week-*/images/ content/week-*/*-images/ decks/images/ 2>/dev/null
```

If images exist and the deck doesn't already have `.spliced` in its name:

```bash
node splice-images.js <deck.html> <images-dir>
```

Then evaluate the `.spliced.html` output instead.

### 0b. Visual audit (always run)

Run the Puppeteer visual flaw detector to catch rendering bugs the rubric misses:

```bash
node visual-audit.js <deck.html>
```

This checks every slide for: broken images, zone-zone collisions, text-image overlaps, content overflow, tiny text. Issues are classified as critical/warning/info.

**Any critical issues must be fixed before proceeding.** Common fixes:
- **broken-image**: source asset missing from `decks/images/`
- **zone-collision**: zones overlap in the composed markdown — adjust `col`/`row`/`span`/`rowSpan`
- **overflow (visible)**: content exceeds zone — increase `rowSpan` or reduce font size
- **text-image-collision**: text overlaps image — separate into distinct zones or use a table zone

### 1. Run the evaluation harness

```bash
node eval-harness.js <deck.html> --json
```

This runs all available evaluators in parallel:
- **headless-rubric**: Puppeteer rubric audit (5 computed dimensions)
- **headless-qa**: Puppeteer accessibility audit
- **markdown-qa**: Markdown-level QA analysis
- **screenshot-vision**: Puppeteer screenshots + Anthropic API vision (3 visual dimensions)
- **claude-textual**: Claude textual evaluation (content fidelity, narrative coherence)

Results are confidence-weighted and merged into an 11-dimension scorecard:

| Dimension | Type | Primary evaluator |
|-----------|------|-------------------|
| Accessibility | computed | headless-rubric (0.95) |
| Communicability | visual | screenshot-vision (0.85) |
| Taste | visual | screenshot-vision (0.80) |
| Grid Utilization | computed | headless-rubric (0.95) |
| Color Harmonics | computed | headless-rubric (0.95) |
| Layout Balance | visual | screenshot-vision (0.85) |
| Coherence & Variance | computed | headless-rubric (0.90) |
| Image Integration | computed | headless-rubric (0.95) |
| Content Completeness | computed | source-vs-rendered diff (0.95) |
| Content Fidelity | textual | claude-textual (0.95) |
| Narrative Coherence | textual | claude-textual (0.90) |

The scorecard is automatically persisted to `logs/qa/<deckname>-scorecard.json`.

### 1b. Content completeness audit (always run)

This audit compares the **source markdown** against the **rendered HTML** to detect dropped content. It runs independently of the harness and produces hard numbers:

1. **Image survival**: Count `![Image](...)` references in source markdown. Count corresponding `<img src="images/...">` tags in rendered HTML. Report: `N/M source images rendered (X% survival)`.
2. **Text completeness**: Extract key text fragments from source (titles, citations, URLs, author names, dates). Grep for each in the rendered HTML. Report missing items.
3. **Slide count**: Compare source slide count (number of `---` separators + 1) vs rendered slide count (`<section>` tags). Flag any mismatch.
4. **Link/URL survival**: Extract all URLs from source. Check each appears in HTML.

Score mapping:
- 100% image + text + slide survival = 10/10
- >90% survival with no dropped slides = 8-9/10
- 80-90% = 6-7/10
- <80% = 4-5/10
- Dropped slides = max 5/10

### 2. Chrome visual enhancement (optional, best-effort)

If Chrome is connected, you can supplement the harness scores with direct visual review. Use the **atomic single-slide pattern** — one slide at a time, persist after each:

1. Ping `mcp__claude-in-chrome__tabs_context_mcp`
2. Navigate to slide, screenshot, assess communicability/taste/balance
3. Persist immediately — if Chrome drops, partial scores are saved

Chrome visual scores have higher confidence (0.9) than screenshot-vision (0.85), so they will shift the weighted average when available.

### 3. Display the scorecard

```
Design Rubric Scorecard: decks/week-2.html
──────────────────────────────────────────────────────────────────
Dimension              Score   Conf   Source
─────────────────────  ─────   ────   ──────────────────────
Accessibility          8.2/10  0.95   headless-rubric + headless-qa + markdown-qa
Communicability        7.0/10  0.85   screenshot-vision
Taste                  7.5/10  0.80   screenshot-vision
Grid Utilization       10.0/10 0.95   headless-rubric
Color Harmonics        10.0/10 0.95   headless-rubric
Layout Balance         6.5/10  0.85   screenshot-vision
Coherence & Variance   8.0/10  0.90   headless-rubric + markdown-qa
Image Integration      9.0/10  0.95   headless-rubric
Content Completeness   9.5/10  0.95   source-vs-rendered (11/11 images, 36/36 slides)
Content Fidelity       8.5/10  0.95   claude-textual
Narrative Coherence    7.0/10  0.90   claude-textual
──────────────────────────────────────────────────────────────────
TOTAL                  83.2/100 (83% — Professional)
```

### 4. Identify improvement priorities

Rank dimensions lowest-to-highest. The bottom 2–3 are improvement targets. For each, give specific actionable recommendations tied to rubric criteria and slide numbers.

### 5. Offer next steps

- `/design` to apply improvements to the composed markdown
- `/refine-loop` to iterate automatically until scores plateau
- `node eval-harness.js <deck.html> --evaluators headless` for fast computed-only evaluation
