# Design Paper TODO

**Paper**: Concentric Loops in AI-Mediated Design
**Format**: ~40-slide rastersysteme HTML deck (academic editorial)
**Target**: >55/60 on its own rubric
**Spec**: [SPEC.md](SPEC.md) | **Content direction**: [NOTES.md](NOTES.md)

---

## Phase 1: Content Authoring

Write the source markdown. No composition or rendering yet — just the intellectual content.
Structure: Act I (critique, sections 1-6) then Act II (generalization, section 7).

- [x] Create `content/papers/concentric-loops.md`
- [x] **S1 — Introduction: Goodhart's Law in Design Automation**
  - The problem: AI systems that grade themselves converge on measurability, not quality
  - Hook: "The rubric that scored 100% was the most dangerous"
  - Thesis: human-in-the-loop at the methodological level, not just the design level
  - Frame via Goodhart's Law: when the rubric became a target, it ceased to be a good measure
- [x] **S2 — The Inner Loop: Evaluate-Fix-Render**
  - How the rubric works: 11 metrics across 6 computed dimensions
  - The refine-step pattern: idempotent, scoreboard-driven, /loop-compatible
  - Convergence behavior: diminishing returns detection
  - Connection: first-order cybernetics (Wiener) — a goal-seeking system with sensor, comparator, effector
  - Limitation: single-loop learning (Argyris) — corrects actions but never questions the goal
- [x] **S3 — The Outer Loop: When the Rubric Lies**
  - Case study: v1 scores 100% while user sees overlapping text and missing images
  - The score-perception gap: absence-of-bad vs presence-of-good
  - Connection: Schon's reflective practitioner — "conversation with the situation"
  - Connection: second-order cybernetics — the observer is part of the system
  - The wireframe as intent artifact: ASCII plan vs rendered reality
  - Rubric evolution: v1 (rubber stamp) -> v7 (demanding critic) through 8 iterations
  - Connection: double-loop learning (Argyris) — questioning the governing variables
- [x] **S4 — The Outer-Outer Loop: Evolving the Methodology**
  - How the evaluation criteria themselves evolve
  - From sampling (5 slides) to exhaustive (36 slides)
  - From aggregate scores to per-slide wireframe comparison
  - The design database as institutional memory
  - Connection: deutero-learning (Argyris) — learning about the learning process
  - Meta-question: when does the process stop improving?
- [x] **S5 — Tools and Infrastructure**
  - rastersysteme: 60-column grid, markdown -> HTML/PPTX
  - The pipeline: compose -> render -> evaluate -> refine
  - Key instruments: wireframe.js (intent), rubric-jsdom.js (measurement), visual-audit.js (perception)
  - The commit protocol as design rationale capture (MacLean et al.)
  - Architectural diagram + table (can compress later if too dry)
- [x] **S6 — Results: week-2 Through the Loops**
  - Score progression table: v1 (100%) -> v7 (57/60) with per-dimension breakdown
  - Case study: invented labels (29/36 slides — Goodhart in action)
  - Case study: splice image invisibility (presence vs visibility)
  - Case study: the score that went up (v5->v6, renderer fix, not rubric softening)
  - Wireframe vs screenshot comparisons: 2-3 slides showing intent-vs-reality divergence
  - What improved in the deck vs what improved in the rubric — be precise
- [x] **S7 — Discussion: Circles Within Circles**
  - The concentric loops as general AI collaboration framework
  - Inner = fast automated optimization (minutes) — RL against reward model
  - Outer = human calibration of what "good" means (hours) — RLHF
  - Outer-outer = evolution of calibration itself (days/weeks) — meta-learning
  - How our approach differs from RLHF: diagnostic feedback vs preference pairs
  - Connection to education: students as outer-loop calibrators, not inner-loop consumers
  - Connection to cybernetics: the week-2 content is about feedback loops; the slides about feedback loops were designed through feedback loops
  - Beer's VSM folded into cybernetics slide as brief reference
- [x] **S8 — Conclusion + Postscript**
  - Killer line: "The rubric that scored 100% was the most dangerous — it was confident and wrong"
  - The remaining frontier: presence-of-good metrics (taste, balance, communicability)
  - **Postscript slide**: this paper's own rubric scorecard — closing the loop

## Phase 2: Evidence Gathering

Collect the real data and artifacts referenced in the paper.

- [x] Extract score progression table — 5 deck versions with per-dimension breakdown (see EVIDENCE.md)
- [x] Identify wireframe vs screenshot case studies — slides 3, 7, 11 from week-2-v11
- [x] Document rubric evolution timeline — 8 outer loop iterations with git hashes
- [x] Collect invented labels data — 29/36 in early run, 7 in scorecard, 0 by v9
- [x] Document splice image invisibility — opacity 0.55, bumped to 0.70 (commit eafb167)
- [x] Document v10->v11 score increase — +14.5 points, all artifact/renderer fixes, zero rubric changes
- [x] Gather convergence curves — 3 historical runs (69→83, 43.5→45.5, 38→47.3), plus engine divergence (58.5 vs 49.8)
- [ ] Paper's own convergence data (Phase 5 — inner loop on concentric-loops.html)
- [x] Collect git log for rubric commits — 17 key commits, March 26-28
- [x] Updated paper source (Section 6) with real per-dimension scorecard data
- [x] Created EVIDENCE.md with all compiled reference data

## Phase 3: Diagrams

Design the key visual artifacts. These become slide content.

- [x] Concentric loops diagram — 3-level nested ASCII with arrows and triggers (Section 1)
- [x] Convergence curve — ASCII chart of Run A (38→47.3) with structural/cosmetic annotation (Section 2)
- [x] Wireframe comparisons — real wireframe.js output for S5, S7, S11 showing layout archetypes (Section 3)
- [x] Feedback protocol flow — full trace from user perception to commit artifact (Section 3)
- [x] "Three meanings of 10/10" — Grid score over time with ignorant/honest/earned annotation (Section 6)
- [ ] Rubric dimension radar chart (before/after calibration) — defer to Phase 5 with real paper scores
- [x] Rubric evolution timeline — covered by absence-of-bad table (Section 3) + outer loop log table (Section 1)

## Phase 4: Composition & Rendering

Run the paper through the rastersysteme pipeline.

- [x] Compose with opus: academic editorial brief (dark navy titles, warm cream body, Palatino/Futura)
  - Attempt 1: timed out (600s, single API call too large for 47 slides)
  - Attempt 2: path collision (work dir = output filename), 8 batch failures
  - Attempt 3: cached from attempt 2, no improvement
  - **Attempt 4 (current)**: clean slate, --incremental --batch-size 5, 0 failures
  - Baseline score: **31/60** (28 collisions, 9 sparse, Content 1/10)
  - Note: uses pre-fractal-design source; re-compose needed after refine
- [x] Review composed markdown — verified, fixed zone issues
- [x] Render to HTML
- [x] Generate wireframes for self-comparison (120 lines, decks/concentric-loops.wireframes.txt)
- [ ] Splice images if generated
- [ ] Also render long-form scroll version as alternate output
- [ ] Re-compose with fractal design content (current compose is pre-fractal source)

## Phase 5: Evaluation & Refinement

The paper evaluates itself with the rubric it describes.

- [x] Run rubric evaluation — baseline 31/60
- [x] Run refine loop — 6 iterations, 31→42.8/60
  - Iter 1-3: zone collisions fixed (Grid 4→10, 28→0 collisions)
  - Iter 4-5: chromatic arc + dark dividers (Color 5→8.5)
  - Iter 6: accent ratio reduced (Coherence 8→9)
  - Structural limits: Content 2.3 (divider penalty), Images 5 (no images)
- [x] Visual QA in Chrome — collisions resolved, title slide on navy, clean body slides
- [x] Capture scorecard for postscript — 42.8/60 with per-dimension notes
- [ ] Final human review (outer loop on the paper itself)
- [x] Identify rubric blind spots — deck-type bias (Content penalizes dividers, Images penalizes text-only decks). Recorded as outer loop iteration 9 in RUBRIC-CHANGELOG.md

## Phase 6: Meta-Documentation

The paper is itself a data point in the concentric loop.

- [ ] Add paper deck to corpus via deck-audit.js
- [x] Record rubric blind spots in RUBRIC-CHANGELOG.md (see below)
- [x] Note: writing the paper constituted an outer-outer loop iteration (deck-type bias discovered)
- [ ] Update TODO.md (project-level) to mark paper item complete

---

## Resolved Questions

- **Structure**: Act I (critique/failure story, S1-S6) then Act II (framework generalization, S7). A then B.
- **Meta angle**: Yes, go full meta. Postscript slide with own scorecard. Acknowledge the irony if it scores 100%.
- **Tools section**: Full section for now, compress later if needed.
- **Related work**: Draw all connections — Schon, Argyris, cybernetics, RLHF, Goodhart, Beer, MacLean.
- **Concentric loops diagram**: ASCII art (on-brand, not overproduced).
- **Week-4 workshop**: Separate artifact. Reference as evidence the framework is teachable.
- **Long-form scroll**: Yes, as alternate render alongside the deck.
- **Live demo**: Frame as time-awareness ("in the time it takes to present these 3 slides, the deck has been re-evaluated"), not live execution.
