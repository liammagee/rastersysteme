# Design Evaluation Methodology

Two-loop system for slide deck quality. The outer loop requires human judgment; the inner loop is automated.

## Outer Loop: Rubric Calibration + Human Review

**Purpose**: Ensure the rubric itself is honest. A rubric that scores 98% while the user sees broken slides is a failed instrument.

**Cycle**:
1. **Generate artefact** — compose, render, splice images
2. **Present to user** — open in Chrome, screenshot key slides
3. **Collect qualitative feedback** — ask the user what they see:
   - What's broken? (overlapping text, missing images, layout issues)
   - What's banal? (generic layouts, visual monotony, wasted space)
   - What's good? (effective slides, strong visual moments)
4. **Compare feedback to rubric scores** — does the rubric agree with the user?
   - If rubric says 10/10 but user sees problems → rubric has a blind spot → add/fix checks
   - If rubric says 3/10 but user says it's fine → rubric has a false positive → calibrate
5. **Update rubric** — add metrics, adjust penalties, fix detection
6. **Re-evaluate** — verify the updated rubric now agrees with user perception
7. **Document** — record what was wrong, what was fixed, the before/after scores

**Key principle**: The rubric serves the user's eyes, not the other way around. A score means nothing if it contradicts visual reality.

**When to run**: After every major compose cycle. After any rubric change. Whenever the user says "this doesn't look right."

## Inner Loop: Automated Design Refinement

**Purpose**: Iterate a deck toward higher scores on the (outer-loop-validated) rubric.

**Cycle**:
1. **Evaluate** — `node run-rubric-eval.js <deck.html> --json`
2. **Identify weak dimensions** — sort by score, pick bottom 2-3
3. **Apply design fixes** — edit composed markdown targeting weak dimensions
4. **Re-render** — render HTML, splice images
5. **Re-evaluate** — check if scores improved
6. **Check convergence** — stop if all dimensions >= target or diminishing returns

**Automation**: Can run via `/loop 2m /refine-step <deck.html>` for unattended convergence.

**Key principle**: The inner loop only works if the outer loop has validated the rubric. Running the inner loop against a broken rubric produces polished mediocrity.

## Loop Interaction

```
OUTER LOOP (human-in-the-loop, qualitative)
  ├── Generate deck
  ├── Show to user
  ├── Collect feedback: "spliced images not visible, overlapping text"
  ├── Compare to rubric: "rubric says 98% — rubric is wrong"
  ├── Fix rubric: add checks for the issues user identified
  ├── Re-evaluate: verify rubric now catches those issues
  │
  └── INNER LOOP (automated, quantitative)
        ├── Evaluate with validated rubric
        ├── Fix weak dimensions
        ├── Re-render
        ├── Re-evaluate
        └── Converge
  │
  ├── Show refined deck to user
  ├── Collect feedback again
  └── Repeat until user is satisfied
```

## Wireframe Comparison

Each composed slide has a design directive that specifies intended zone layout. The `wireframe.js` tool renders this as ASCII art:

```bash
node wireframe.js <deck.composed.md>                # all slides
node wireframe.js <deck.composed.md> --slide 7      # single slide
```

The wireframe shows what the design *intended*. The screenshot shows what *actually rendered*. Comparing them reveals:
- **Zone misplacement** — content landed in the wrong zone
- **Content routing failures** — body zone empty because content went to extras
- **Overlap sources** — wireframe shows zones that share space
- **Whitespace gaps** — intended layout fills the slide but actual doesn't

Every outer loop review should compare wireframes against screenshots for problem slides.

## Feedback Protocol

When presenting a deck to the user, always:

1. **Screenshot ALL slides** (`node run-rubric-eval.js <deck> --screenshots-all`) and generate wireframes (`node wireframe.js <deck.composed.md>`)
2. **Ask specific questions**:
   - "Are the spliced images visible?"
   - "Any overlapping or duplicated text?"
   - "Which slides look weakest?"
   - "Does the overall design match your expectations?"
3. **Record responses** as structured feedback:
   - `issue: <what the user reported>`
   - `slide: <which slide(s)>`
   - `rubric_score: <what the rubric said>`
   - `gap: <rubric missed it / rubric caught it / false positive>`
4. **Action each gap**: if the rubric missed it, add a check. If false positive, calibrate.

## Rubric Validation Criteria

The rubric is "calibrated" when:
- Every issue the user identifies is also flagged by the rubric
- Every rubric penalty corresponds to a real visual problem
- The overall score matches the user's qualitative assessment (e.g., "this looks about 70%" should score ~70%)
- No dimension scores 10/10 while the user sees problems in that area

## Version History

| Date | Outer Loop Feedback | Rubric Change | Effect |
|---|---|---|---|
| 2026-03-28 | "Scores maxing out while design issues persist" | v1→v2: 11 new metrics, 6 formula rewrites | 100%→95% |
| 2026-03-28 | "Not seeing spliced images, overlapping text" | v2→v3: duplicate text detection, banality checks | 95%→91% |
| 2026-03-28 | "Rubric insufficiently critical" | v3→v5: generic-alt, sparse slides, typography hierarchy, calibration | 91%→89% |
| 2026-03-28 | "Still no spliced images, still overlapping text, rubric still too lenient" | Investigated: visual-audit.js finds 9 critical zone collisions that rubric ignores | TBD |
| 2026-03-28 | "Need to evaluate every slide — one slide can have unique issues" | Architecture gap: visual-audit per-slide data not fed into rubric scoring | **Next: integrate visual-audit into rubric pipeline** |

## Key Architectural Finding

The rubric (`rubric-headless.js`) and the visual audit (`visual-audit.js`) are **disconnected systems**. The visual audit does per-slide bounding-box collision detection and finds 9 critical zone overlaps. The rubric has zero visibility into these — it only checks text-on-image overlap using a conservative approximation.

**Integration plan**: Run `visual-audit.js` as part of the rubric evaluation. Feed its per-slide issue counts into the `computeScores` function. Specifically:
- Zone-zone collisions (critical) → penalize Grid and Content dimensions
- Text-image collisions (warning) → penalize Images dimension
- Broken images (critical) → penalize Accessibility dimension
- The deck score should use a **floor rule**: if ANY slide has a critical issue, the relevant dimension is capped at 7/10

**Per-slide sampling**: Every slide must be evaluated. The current rubric collects metrics for every slide (`perSlideIssues`) but aggregates them loosely. The visual audit evaluates every slide with real bounding boxes. These should merge.

## Outer Loop Version Control

Every rubric revision is committed separately so the evolution is traceable in git history. Commit message format:

```
rubric: v<N> — <one-line summary of what changed>

Outer loop feedback: <what the user reported>
Before: <score before>
After: <score after>
```

This creates a git log that reads as a design methodology journal — each commit is a calibration step driven by human feedback.

## Design Database Integration

Each compose→render→evaluate cycle produces artefacts that feed the design database:

1. **`deck-audit.js`** — scans `decks/`, extracts design fingerprints (palette, typography, zone archetypes), pairs with rubric scores
2. **`corpus-synthesize.js`** — cross-deck analysis produces data-driven composition rules in `design-insights.md`
3. **`brief-extract.js`** — extracts zone archetypes, palette, and typography fingerprints from composed markdown

The database improves future compositions: each deck's fingerprint + score becomes training data for better design briefs. The outer loop should trigger a database update after each major evaluation:

```
After outer loop evaluation:
  1. node deck-audit.js — scan and fingerprint all decks
  2. node corpus-synthesize.js — extract patterns from high-scoring decks
  3. design-insights.md updated — composition rules refined
  4. Next compose uses updated insights
```

This closes the self-improvement loop: user feedback → rubric calibration → design fixes → evaluation → fingerprinting → better future compositions.
