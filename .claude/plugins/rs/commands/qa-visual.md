---
name: qa-visual
description: Accessibility and design consistency audit on an HTML slideshow. Headless-first — full audit always available without Chrome. Chrome used only for screenshots of problem slides.
user_invocable: true
allowed-tools:
  - mcp__claude-in-chrome__*
---

# Visual QA Audit

Run an accessibility + design consistency audit on an HTML slide deck.

## Arguments

`/qa-visual decks/week-1.html`
If no argument, ask which HTML file to audit. Check `decks/*.html` for options.

## How to work

### 1. Run headless audit (always succeeds)

```bash
node qa-html.js <deck.html>
```

Captures per-slide results: contrast errors/warnings, overflow, broken images, empty slides, font loading. This is the primary audit data — it runs in Puppeteer headless with no Chrome dependency.

### 2. Run headless rubric (always succeeds)

```bash
node rubric-headless.js <deck.html> --json
```

Captures the 5 computed rubric dimensions (accessibility, grid, color, coherence, images). Both results are automatically persisted to `logs/qa/<deckname>-scorecard.json`.

### 3. Identify problem slides

From the qa-html results, identify slides with errors or warnings. Collect up to 5 problem slides for potential Chrome screenshots.

### 4. Chrome screenshots (best-effort, optional)

Attempt `mcp__claude-in-chrome__tabs_context_mcp` to check Chrome connection.

**If Chrome is unavailable:** Skip to step 5. The headless audit data is complete.

**If Chrome is available:**

Prereq: The deck must be servable via `npm run serve` (port 8701) or `node server.js` (port 8800). Navigate to `http://localhost:8701/<deck-path>`.

For each problem slide (up to 5), use this **atomic single-slide pattern**:

1. Ping `mcp__claude-in-chrome__tabs_context_mcp` — verify connection
2. If ping fails: break, report what we have
3. Navigate to the slide:
```javascript
const slides = document.querySelectorAll('.slide, .grid-slide');
slides.forEach((s, i) => {
  s.classList.toggle('active', i === N);
  s.style.display = i === N ? 'flex' : 'none';
});
```
4. Screenshot via `mcp__claude-in-chrome__computer`
5. Show the screenshot to the user with the slide's issues annotated

Each Chrome interaction is atomic — if Chrome drops after screenshotting slide 3 of 5, we still have those 3 screenshots plus the complete headless audit.

### 5. Report findings

Present combined results regardless of Chrome availability:

```
Visual QA Audit: decks/week-1.html
────────────────────────────────────
Engine: headless (Puppeteer) + Chrome (3/5 problem slides screenshotted)
   OR: headless only (Chrome unavailable — all metrics computed)

A11Y:  40 slides — 35 pass | 0 errors | 8 warnings
RUBRIC: 36.5/50 computed | visual: deferred

Accessibility issues:
  S8: overflow (4 elements — content too dense)
  S15: contrast 2.1:1 on "Section Title" (need 4.5:1)

Design issues:
  S7: bullet text too small (11.2px)
  S21: body text too large (28px)
  S14: image-text collision (opacity=0.35)

Scorecard: logs/qa/week-1-scorecard.json
```

### 6. Root cause analysis

Group issues by cause:
- **Theme-level** (CSS/raster.js) — affects all slides
- **Slide-level** (composed markdown) — affects specific slides
- **Image-level** (splice-images) — image placement collisions

### 7. Recommend fixes

Suggest concrete fixes for each issue. Offer to:
- Run `/qa-fix-loop` to apply fixes automatically
- Run `/edit-slide` for specific slide fixes
- Re-splice images with adjusted collision settings
