<!-- design: {"zones":[{"role":"bullets","col":4,"span":24,"row":3,"rowSpan":16},{"role":"body","col":32,"span":24,"row":3,"rowSpan":34}],"accents":[{"type":"line","col":30,"span":1,"row":3,"rowSpan":34,"color":"E8E2D6"},{"type":"dot","col":4,"span":2,"row":36,"rowSpan":2,"color":"B7311A"}],"typography":{"bullets":{"size":15,"weight":600,"leading":1.55},"body":{"size":13,"leading":1.7}},"bg":"FAF6EE","font":"Palatino"} -->
### Score Progression

| Deck | Rubric | A11y | Grid | Color | Coher. | Images | Content | **Total** |
|------|--------|------|------|-------|--------|--------|---------|-----------|
| week-2 (early) | v2 | 1 | 10 | 10 | 8 | 10 | 1.4 | **40.4/60** |
| week-2-v8 | v2 | 10 | 9.9 | 9 | 8.5 | 10 | 9.7 | **57.1/60** |
| week-2-v9 | v4 | 10 | 10 | 9 | 10 | 8 | 7.5 | **54.5/60** |
| week-2-v10 | v5/v6 | 6.5 | 4 | 10 | 8.5 | 8 | 7 | **44/60** |
| week-2-v11 | v7 | 10 | 10 | 10 | 10 | 10 | 8.5 | **58.5/60** |

Read this table row by row, not column by column. The total does not monotonically decrease:

- **Early → v8** (+17 points): inner loop fixes. Accessibility jumped from 1 to 10 (contrast fixed). Content from 1.4 to 9.7 (body zones populated). But the rubric is v2 — still lenient.
- **v8 → v9** (-2.6 points): new rubric, new compose. v4 rubric detects 16 generic alt-text images for the first time. The deck got a new composition but the rubric got stricter — Images and Content drop.
- **v9 → v10** (-10.5 points): zone collision detection added. Grid crashes from 10 to 4 — four collision slides that were always there, now visible. This is the most honest score.
- **v10 → v11** (+14.5 points): renderer and source fixes, not rubric changes. Collisions fixed (Grid: 4→10), alt text replaced (Images: 8→10), contrast resolved (A11y: 6.5→10). The rubric is unchanged. The artifact is better.

The story is not "scores went up." The story is that three things improved in parallel — the rubric (more honest), the deck (better designed), and the renderer (fewer bugs) — and the per-dimension breakdown reveals which improvement caused each change.

<!-- notes: This is the data slide. The per-dimension breakdown matters because it defeats the naive narrative. A single total score hides the drama: Grid going from 10 to 4 and back to 10 is invisible in the total. The reader needs to see that Grid scored 10/10 at v2 (no collision detection), crashed to 4/10 at v6 (collision detection added), and returned to 10/10 at v7 (collisions actually fixed). That's three different meanings of "10/10" — ignorant, impossible, and earned. -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":52,"row":2,"rowSpan":36}],"accents":[{"type":"dot","col":4,"span":2,"row":2,"rowSpan":2,"color":"B7311A"},{"type":"line","col":4,"span":52,"row":19,"rowSpan":1,"color":"E8E2D6"},{"type":"dot","col":54,"span":2,"row":36,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":13,"leading":1.65}},"bg":"F0EBE0","font":"Palatino"} -->
### Three Meanings of 10/10

Grid Utilization scored 10/10 three times. Each time it meant something different.

```
Grid
Score
  10 │ ●                                     ●      ← EARNED
     │  \                                   /         (collisions fixed,
   8 │   \                                 /           layouts genuinely
     │    \                               /            varied)
   6 │     \                             /
     │      \                           /
   4 │       \_________________________●             ← HONEST
     │         (no collision detector)   (4 collision   (collisions
   2 │                                   slides found)  detected)
     │
  10 │ ●·····●·····●                                 ← IGNORANT
     │  (rubric blind to collisions)                   (no metric
     │                                                  existed)
     └──────┬──────┬──────┬──────┬──────┬──────
          early    v8     v9    v10    v11
          (v2)    (v2)   (v4)  (v5/6)  (v7)
```

The top line is the real score. The bottom line is what the score *would have been* if collision detection existed from the start. The gap between them is the rubric's blind spot — invisible until the outer loop added the metric at v5/v6.

<!-- notes: This diagram is the single most important visual in the paper. It shows that a score is not a fixed quantity — it is relative to the instrument that produces it. "10/10" at v2 and "10/10" at v7 are not the same claim. The first means "I see no problems" (which says more about the rubric than the deck). The second means "I see no problems AND I have been trained to see zone collisions, layout runs, whitespace utilization, and default-zone detection." The instrument's vocabulary determines the score's meaning. This is Goodhart made visible across time. -->

---

<!-- design: {"zones":[{"role":"body","col":18,"span":38,"row":6,"rowSpan":28}],"accents":[{"type":"bar","col":0,"span":14,"row":0,"rowSpan":40,"color":"0A1628"},{"type":"dot","col":6,"span":2,"row":12,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":6,"span":2,"row":26,"rowSpan":2,"color":"B7311A"},{"type":"line","col":18,"span":38,"row":5,"rowSpan":1,"color":"2C3E50"}],"typography":{"body":{"size":14,"leading":1.65}},"bg":"FAF6EE","font":"Palatino"} -->
### What Improved, and Who Improved It

| Improvement | Loop | Agent | Timescale |
|-------------|------|-------|-----------|
| Added layout variety metrics | Outer | Human (calibration) | Hours |
| Fixed zone collision in renderer | Outer (detected) → Infrastructure | Human (diagnosis) + code fix | Hours |
| Increased body zone rowSpan for dense slides | Inner | Automated (refine-step) | Minutes |
| Changed sampling from 5 to 36 slides | Outer-outer | Human (methodology) | Days |
| Built wireframe comparison tool | Outer-outer | Human (new instrument) | Days |
| Removed invented labels from composition | Outer | Human (rule change) | Hours |
| Unified two scoring engines | Outer-outer | Human (architecture) | Days |

No row says "the AI fixed the rubric." The inner loop makes design changes. The outer and outer-outer loops make structural changes. Only humans make structural changes.

<!-- notes: This attribution table is the most important evidence in the paper. It shows that the system's quality came primarily from human interventions at the outer and outer-outer levels, not from automated optimization at the inner level. The inner loop contribution was real (body zone sizing, layout variety) but narrow — it could only improve within the constraints the rubric defined. Every expansion of what "good" means came from a human perception. This is the paper's central empirical finding. -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":36,"row":4,"rowSpan":34}],"accents":[{"type":"bar","col":44,"span":16,"row":0,"rowSpan":40,"color":"E8E2D6"},{"type":"dot","col":50,"span":2,"row":10,"rowSpan":2,"color":"B7311A"},{"type":"line","col":4,"span":36,"row":3,"rowSpan":1,"color":"2C3E50"},{"type":"dot","col":50,"span":2,"row":28,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":13,"leading":1.7}},"bg":"FAF6EE","font":"Palatino"} -->
### Two Engines, One Deck, Different Truths

The same deck (week-2-v11) evaluated by two engines with identical rubric formulas:

| Dimension | Headless (Puppeteer) | jsdom | Delta |
|-----------|---------------------|-------|-------|
| Accessibility | 10 | 8 (capped) | -2 |
| Grid | 10 | 10 | 0 |
| Color | 10 | 9.5 | -0.5 |
| Coherence | 10 | 9 | -1 |
| Images | 10 | 8 | -2 |
| Content | 8.5 | 5.3 | -3.2 |
| **Total** | **58.5/60** | **49.8/60** | **-8.7** |

Same formulas, 8.7-point gap. The divergence is not a bug — it is a measurement of what CSS rendering contributes to evaluation. jsdom sees DOM structure but not computed styles; it caps Accessibility at 8 (honest about what it cannot verify). Content diverges most (3.2 points) because jsdom's text-density calculation lacks layout context.

This divergence prompted an outer-outer loop decision: unify the scoring formulas into a shared module (`rubric-scores.js`) so that disagreements are about *data* (what each engine can see), not *interpretation* (how each engine weighs what it sees). The shared module made the engines' blind spots comparable rather than confounded.

The engine divergence also provides evidence for the formalization frontier: even with identical formulas, the choice of observation instrument changes the score. The rubric is not separate from its implementation — the instrument and the measurement are entangled, exactly as von Foerster's second-order cybernetics predicts.

<!-- notes: Engine divergence data from EVIDENCE.md. This slide serves triple duty: (1) empirical evidence that evaluation instruments are not neutral, (2) demonstration of an outer-outer loop decision (unifying scoring), and (3) connection to second-order cybernetics (the observer cannot be separated from the observed). The 8.7-point gap on the same deck with the same formulas is a powerful demonstration that "the score" is always "the score according to this instrument." -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":26,"row":4,"rowSpan":14},{"role":"bullets","col":4,"span":50,"row":22,"rowSpan":16}],"accents":[{"type":"line","col":4,"span":50,"row":20,"rowSpan":1,"color":"2C3E50"},{"type":"dot","col":34,"span":2,"row":6,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":54,"span":2,"row":36,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":14,"leading":1.6},"bullets":{"size":14,"weight":500,"leading":1.55}},"bg":"FAF6EE","font":"Palatino"} -->
### The Cybernetics Recursion

The slides being designed are about cybernetics — Norbert Wiener, feedback loops, the distinction between cybernetics (human-machine co-operation) and AI (machine autonomy).

The design process is itself cybernetic:
- The inner loop is first-order cybernetics: a goal-seeking feedback system
- The outer loop is second-order cybernetics: the observer is inside the system, shaping what counts as the goal
- The outer-outer loop is the conversation about the conversation: how we talk about how we observe

Slides about Wiener were designed through Wiener's methods. Slides about the cybernetics/AI divide were evaluated using a process that embodies that divide: the AI handles the inner loop (McCarthy's vision), the human handles the outer loop (Wiener's vision).

The recursion is not a coincidence. It is the design system demonstrating what the content describes.

<!-- notes: This slide connects the paper's theoretical framework to its specific content domain. The week-2 lecture is about the historical tension between cybernetics (cooperative, feedback-driven, human-in-the-loop) and AI (autonomous, self-improving, human-out-of-the-loop). The paper argues that good AI-mediated design requires the cybernetic approach — that the outer loops are what make the inner loop valuable. The recursion — cybernetics content designed through cybernetic methods — makes this argument performative, not just descriptive. -->