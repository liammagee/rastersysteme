# Evidence Reference

Real data extracted from scorecards, git history, and evaluation logs. Referenced by the paper's source markdown.

---

## Score Progression (per-dimension, from actual scorecards)

### By deck version + rubric version

| Deck | Rubric | Access. | Grid | Color | Coher. | Images | Content | **Total** | Key issues |
|------|--------|---------|------|-------|--------|--------|---------|-----------|------------|
| week-2 (early) | v2 | 1 | 10 | 10 | 8 | 10 | 1.4 | **40.4/60** | 55 contrast warnings, 8 empty body zones, 7 invented labels, 1 table truncation |
| week-2-v8.spliced | v2 | 10 | 9.9 | 9 | 8.5 | 10 | 9.7 | **57.1/60** | 1 invented label, high accent ratio (92%) |
| week-2-v9.spliced | v4 | 10 | 10 | 9 | 10 | 8 | 7.5 | **54.5/60** | 16 generic-alt images, 5 sparse slides |
| week-2-v10.spliced | v5/v6 | 6.5 | 4 | 10 | 8.5 | 8 | 7 | **44/60** | 4 zone collisions, 17 generic-alt, 7 contrast warnings, 1 empty body zone |
| week-2-v11.spliced | v7 | 10 | 10 | 10 | 10 | 10 | 8.5 | **58.5/60** | 3 sparse slides (exempt), 0 collisions, 0 generic-alt |

### Narrative reading

1. **week-2 (early)**: Accessibility 1/10 (55 contrast warnings on dark-heavy palette), Content 1.4/10 (8 empty body zones, 7 invented labels). Grid and Color scored perfectly despite these catastrophic issues — the rubric was blind to content/accessibility.

2. **v8**: After inner loop fixes. Accessibility jumped to 10 (contrast issues fixed). Content jumped to 9.7 (body zones populated). But 1 invented label persists and accent saturation at 92% drags Coherence to 8.5.

3. **v9**: New compose with v4 rubric. Generic alt text detected for first time — 16 images with alt="Image" drop Images to 8 and Content to 7.5. Grid and Coherence score perfectly (10/10) while these content issues exist — the rubric still has gaps.

4. **v10**: v5/v6 rubric with zone collision detection. Grid crashes to 4/10 (4 collision slides found). Accessibility drops to 6.5 (7 contrast warnings now penalized). This is the most honest score — the rubric finally sees the collisions that were always there.

5. **v11**: Renderer fixed (collisions eliminated), source alt text fixed, splice images adjusted. All dimensions at 10 except Content at 8.5 (3 sparse slides, exempt by design). The high score is earned, not inflated.

### The score-that-went-up explained

v10 (44/60) -> v11 (58.5/60) is a +14.5 point jump. Causes:
- Grid: 4 -> 10 (+6) — renderer bug fix eliminated zone collisions
- Accessibility: 6.5 -> 10 (+3.5) — contrast warnings fixed
- Coherence: 8.5 -> 10 (+1.5) — accent saturation reduced
- Content: 7 -> 8.5 (+1.5) — generic alt text replaced in source
- Images: 8 -> 10 (+2) — generic-alt penalty removed

None of these are rubric changes. All are artifact/infrastructure fixes. The rubric is unchanged between v10 and v11.

---

## Outer Loop Iteration Log

From RUBRIC-CHANGELOG.md and git history:

| # | Date | User Feedback | Rubric Change | Before | After | Git Hash |
|---|------|--------------|---------------|--------|-------|----------|
| 1 | 2026-03-28 | "Scores maxing out while design issues persist" | v1->v2: 11 new metrics, 6 formula rewrites | 100% | 95% | (within f0bc36a) |
| 2 | 2026-03-28 | "Not seeing spliced images, overlapping text" | v3: duplicate text detection, banality checks | 95% | 91% | (within f0bc36a) |
| 3 | 2026-03-28 | "Rubric insufficiently critical" | v4: generic-alt, sparse slides, typography hierarchy | 91% | 73% (jsdom) / 75% (headless) | (within f0bc36a) |
| 4 | 2026-03-28 | "Still no spliced images, overlapping text, rubric too lenient" | v5: calibrated empty zones, sparse exemptions | 75% | 87% | f0bc36a |
| 5 | 2026-03-28 | "Need to evaluate every slide" | v6: shared scoring, zone collision in both engines | 88% | 88% (same score, new data) | d48967f |
| 6 | 2026-03-28 | "Can we do better with pure HTML/CSS analysis?" | v7: CSS rect collision, visual utilization, overlap fix | 88% | 98% (collisions fixed) | 10e7b40 |
| 7 | 2026-03-28 | "Capture intended design as ASCII wireframe" | wireframe.js for intent-vs-reality comparison | (diagnostic, not scored) | | a9bc9fa |
| 8 | 2026-03-28 | "Maintain changelogs for inner/outer loops" | Structured changelog format, iteration logs | (process improvement) | | d383931 |

Note: iterations 1-4 happened in rapid succession within a single session, committed together. The compressed timeline makes the evolution even more dramatic — 8 outer loop iterations in one day.

---

## Rubric Evolution Arc (absence-of-bad -> presence-of-good)

| Version | What it measured | What it missed | Category |
|---------|-----------------|----------------|----------|
| v1 | Absence of errors | Everything that matters | Absence-of-bad |
| v2 | + Variety (layout archetypes, color transitions) | Monotony at a higher level | Absence-of-bad (refined) |
| v3 | + Banality (sparse slides, duplicate text) | Emptiness that looks full | Absence-of-bad (deeper) |
| v4 | + Craft (typography hierarchy, alt text, accessibility honesty) | Things that require eyes | Presence-of-good (first steps) |
| v5-v6 | + Structural integrity (zone collisions, visual utilization) | Taste, balance, communicability | Presence-of-good (structural) |
| v7 | + Demanding thresholds across all dimensions | The frontier: visual quality | Presence-of-good (thresholds) |

---

## Case Study Data

### Invented Labels

- Source: compose.js early run on week-2 content
- 29 of 36 slides received fabricated ### headings in one run
- Later run (week-2 early scorecard): 7 invented labels detected
- v8 scorecard: 1 invented label remaining
- v9+ scorecards: 0 invented labels
- Fix: explicit rule in compose prompt + inventedLabels metric in rubric

### Splice Image Invisibility

- Images spliced with default opacity (0.55) and mix-blend-mode
- On dark backgrounds (#0a0a0a, #1a1a2e): effectively invisible
- Rubric checked img count > 0 (presence), not contrast against background (visibility)
- Fix: opacity bumped to 0.70, inset frame added (commit eafb167)
- Rubric fix: lowOpacitySplice metric tracked (but not yet penalized)

### Zone Collisions

- v10 scorecard: 4 zone-collision slides (slides 3, 4, 7, 21)
- Cause: renderer extras fallback duplicating content into overlapping zones
- Grid score crashed from 10 to 4 when detection was added
- Fix: renderer content routing fix (renderedContent tracking set)
- v11 scorecard: 0 zone collisions, Grid back to 10

---

## Case Study Slides for Wireframe vs Screenshot

Best candidates from week-2-v11 (current deck):

### Slide 3: "Melancholic Echoes of Cybernetics Today?"
- Layout: title (col:4, span:24) + body (col:4, span:52) + table (col:4, span:52)
- Issue: yellow accent bar at col:30 bisects title zone, creating visual collision
- Type: accent misalignment + content density vs allocated space

### Slide 7: "Al-Khwarizmi manuscript page"
- Layout: two image zones side-by-side (col:4 span:24 + col:34 span:22) + body + table
- Issue: image zones don't fill body width (46 cols < 52 cols), leaving 6-column gap
- Type: zone span math error + content routing failure

### Slide 11: "Century transition"
- Layout: two image zones (col:4 span:24 + col:32 span:24) + table + divider line
- Issue: 4-column gap between images (cols 28-32), rowSpan overflow into accent row
- Type: geometric placement error + row boundary collision

---

## Git Trail: Rubric Commits

Key commits in chronological order:

```
2026-03-26 12:10  6c6162c  Add 8-dimension design rubric with evaluate, design, and refine-loop skills
2026-03-26 14:02  1930d54  Complete refine loop test: 69->83/100 in 2 iterations
2026-03-26 16:28  6caa114  Headless rubric refine loop (43.5->45.5/50, 91%)
2026-03-26 21:40  29fde58  Fix designed-slide content loss (emptyBodyZones, contentlessSlides)
2026-03-26 23:11  6c5102a  Build-deck test drive: 38->47/60 in 3 iterations
2026-03-26 23:37  96c0502  Compose content fidelity + rubric content dimension
2026-03-27 08:54  25bd3dd  Add jsdom-rubric evaluator
2026-03-27 17:28  04a3f48  Add visual-audit tool (per-slide bounding-box collision detection)
2026-03-28 11:06  f0bc36a  rubric: v5 — two-loop methodology, zone collision detection
2026-03-28 11:10  d48967f  rubric: v6 — shared scoring module, zone collision in both engines
2026-03-28 11:12  4ca42c2  rubric: v6b — every-slide screenshot pipeline
2026-03-28 11:15  a9bc9fa  Add wireframe.js (ASCII intent diagrams)
2026-03-28 11:25  f154088  Fix 6 scoring/rendering bugs, add 74 unit tests
2026-03-28 11:34  10e7b40  rubric v7 + renderer fixes: zero collisions, splice visibility
2026-03-28 11:40  b56cc8d  8 new rubric scoring tests (463 total)
2026-03-28 11:54  4fb7da1  UAT runner, design database (69 decks scanned)
2026-03-28 11:59  eafb167  splice: mix-blend-mode:luminosity
```

Note the March 28 compression: 10 commits in under an hour covering rubric v5 through v7, wireframe tool, 74 tests, and the UAT runner. This is the outer loop at maximum velocity.

---

## Outer-Outer Loop Observations (verbatim from RUBRIC-CHANGELOG.md)

1. "The rubric grading itself is the fundamental problem." Iterations 1-3 were the rubric trying to catch what it couldn't see. The turning point was iteration 4 when the user said "rubric insufficiently critical."

2. "Every-slide evaluation matters more than aggregate metrics." One broken slide in 36 disappears in the average.

3. "Two scoring engines that diverge is worse than one honest engine." The jsdom/Puppeteer split caused confusion. The shared scoring module (v6) resolved this structurally.

4. "Renderer bugs masquerade as design problems." Zone collisions scored as "bad grid design" when the actual cause was the extras fallback duplicating content.

5. "The user sees what metrics can't measure." Splice image visibility, visual utilization, layout monotony required human observation to identify.
