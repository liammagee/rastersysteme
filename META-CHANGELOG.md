# Outer-Outer Loop: Methodology Evolution Log

This tracks changes to the methodology itself — not what the rubric measures, but how we think about measuring.

## Session 2026-03-28: The Concentric Loops Discovery

### What changed in the methodology

1. **Recognized the need for an outer loop.** Started with rubric v1 scoring 100% on mediocre decks. Realized the rubric grading itself in a closed loop produces polished mediocrity.

2. **Discovered the three-loop structure.**
   - Inner loop: automated refinement (existed already)
   - Outer loop: human-rubric calibration (added this session)
   - Outer-outer loop: methodology evolution (this document)

3. **Shifted from sampling to exhaustive evaluation.** One broken slide in 36 gets averaged away. User said "need to evaluate every slide" — leading to --screenshots-all and wireframe comparison.

4. **Added wireframe comparison.** The design directive IS a layout spec. Rendering it as ASCII art and comparing against screenshots reveals content routing failures that no aggregate metric can catch.

5. **Built the UAT runner.** Structured human acceptance testing: HTML checklist with screenshot+wireframe per slide, auto-flagging critical issues, pass/fail checkboxes.

6. **Defined acceptance criteria.** 7 formal criteria including automated scores, visual audit, zone integrity, wireframe match, user acceptance, and stability.

7. **Unified the scoring engines.** Extracted computeScores() into rubric-scores.js. Stopped the jsdom/Puppeteer divergence that was producing conflicting scores.

### What we learned about the process

- **A confident wrong answer is worse than an uncertain right one.** The rubric scoring 100% was more damaging than a rubric scoring 60% with visible caveats.

- **The user's eyes are the ground truth.** Every rubric improvement came from "I see X but the rubric doesn't." The automated metrics are only as good as the human calibration driving them.

- **Renderer bugs masquerade as design problems.** Zone collisions looked like bad composition. Duplicate text looked like poor layout. The root cause was in raster.js content routing, not in the design directives.

- **The rubric should serve the human's eyes, not the other way around.** If the rubric says 98% and the human sees problems, the rubric is wrong.

### Evolution of the evolution

| Iteration | What changed about how we think |
|---|---|
| 1 | "Maybe we need more metrics" — added 11 new metrics |
| 2 | "Metrics aren't enough — need to detect absence of quality" — banality checks |
| 3 | "The two engines disagree — need single source of truth" — shared scoring module |
| 4 | "Need to see every slide, not just aggregates" — per-slide screenshots |
| 5 | "Need to compare intent vs reality" — wireframe tool |
| 6 | "Need structured human feedback, not ad-hoc comments" — UAT runner |
| 7 | "Need to track how the methodology itself changes" — this document |

### Open questions

- Can the outer-outer loop close? Will we reach a stable methodology that doesn't need to keep evolving?
- At what point does adding more metrics produce diminishing returns? Is there a metric ceiling?
- Should the visual-only dimensions (communicability, taste, balance) ever be automated, or are they permanently human-judgment territory?
- How do we prevent the methodology from becoming so complex that it's harder to maintain than the designs it evaluates?
