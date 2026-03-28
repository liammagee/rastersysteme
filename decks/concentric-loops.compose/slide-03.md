<!-- design: {"zones":[{"role":"label","col":2,"span":12,"row":2,"rowSpan":2},{"role":"bullets","col":2,"span":18,"row":5,"rowSpan":14},{"role":"body","col":22,"span":34,"row":2,"rowSpan":36}],"accents":[{"type":"bar","col":20,"span":1,"row":2,"rowSpan":36,"color":"E5DFD3"},{"type":"line","col":2,"span":18,"row":4,"rowSpan":1,"color":"B7311A"}],"typography":{"body":{"size":13,"leading":"1.5","align":"left"},"bullets":{"size":14,"leading":"1.6"},"label":{"size":11,"transform":"uppercase","tracking":"0.12em","color":"B7311A"}},"bg":"FAF6EE","font":"Palatino"} -->
### WORKFLOW
### Convergence Behavior

Three refine-loop runs on the same deck show a consistent pattern:

| Run | Start | Iter 1 | Iter 2 | Iter 3 | Shape |
|-----|-------|--------|--------|--------|-------|
| A | 38/60 | 42 (+4) | 45 (+3) | 47.3 (+2.3) | Converged |
| B | 43.5/50 | 44.8 (+1.3) | 45.5 (+0.7) | — | Converged |
| C | 69/100 | 78 (+9) | 83 (+5) | — | Converged |

The shape is always the same — steep initial gain, rapid diminishing returns:

```
Score   Run A (38 → 47.3/60)
  48  │                          ●─── converged (delta < 0.5)
      │                     ·····
  45  │               ●····
      │          ····
  42  │     ●····
      │  ···
  38  │●
      └──────┬──────┬──────┬─────
         iter 0   iter 1  iter 2  iter 3

       ◄── structural ──►◄─ cosmetic ─►
          (layout, color)   (text, accents)
```

- **Iteration 1**: largest gain. Fixes obvious structural issues — missing dark slides for chromatic arc, clipped content from undersized zones, contrast errors.
- **Iteration 2**: moderate gain. Fixes secondary issues — layout variety, zone sizing, accent adjustments.
- **Iteration 3+**: diminishing returns. System detects delta < 0.5 and stops.

The inner loop reliably fixes 60-80% of its addressable issues in 2-3 iterations. At convergence, the system declares success. The scores are high. The deck is "good."

The question the inner loop cannot answer: **good according to whom?**

<!-- notes: This is the pivot. "Addressable issues" is the operative phrase — the inner loop never discovers issues outside the rubric's vocabulary. Run A went from 38 to 47.3 — a 24% improvement — but the highest dimension it improved was Color (5.3→8, by injecting dark divider slides). It never noticed invented labels, invisible spliced images, or zone collisions, because the rubric at that point didn't measure them. The system is grading its own homework. In first-order cybernetics terms, the thermostat is working — the temperature matches the setpoint. But who set the setpoint? -->

---

<!-- design: {"zones":[{"role":"title","col":14,"span":40,"row":14,"rowSpan":12}],"accents":[{"type":"bar","col":58,"span":2,"row":0,"rowSpan":40,"color":"B7311A"},{"type":"line","col":14,"span":40,"row":27,"rowSpan":1,"color":"B7311A"}],"typography":{"title":{"size":44,"weight":400,"tracking":"0.08em","transform":"uppercase","align":"right","color":"0A1628"}},"bg":"E5DFD3","font":"Futura"} -->
### SECTION
## 3. The Outer Loop

### When the Rubric Lies

<!-- notes: Section divider. This is the heart of the paper. The dramatic tension is between what the numbers say and what the human sees. Every outer loop iteration begins with the same experience: the machine says "good," the human says "wait." -->

---

<!-- design: {"zones":[{"role":"label","col":46,"span":12,"row":3,"rowSpan":2},{"role":"body","col":4,"span":36,"row":4,"rowSpan":10},{"role":"bullets","col":4,"span":36,"row":16,"rowSpan":20}],"accents":[{"type":"line","col":4,"span":36,"row":15,"rowSpan":1,"color":"B7311A"},{"type":"block","col":44,"span":14,"row":2,"rowSpan":36,"color":"FAF6EE"}],"typography":{"body":{"size":15,"leading":"1.7","align":"left"},"bullets":{"size":14,"leading":"1.65"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"0A1628"}},"bg":"E5DFD3","font":"Palatino"} -->
### ITERATION
### The Score-Perception Gap

Outer loop iteration 1. The rubric reports **100%** — a perfect score across all dimensions.

The human opens the deck in a browser and sees:

- Text overlapping other text on 4 slides
- Spliced images invisible against dark backgrounds
- The same layout repeated on 6 consecutive slides
- 29 of 36 slides contain fabricated headings that don't exist in the source

The gap between 100% and reality is not a rounding error. It is a **category error**: the rubric measured absence of detectable faults, not presence of quality. Every metric asked "is anything wrong?" and received the answer "nothing I can see." But what the rubric could see was almost nothing.

<!-- notes: This slide is the emotional center of the paper. The specific numbers matter: 100% is a round, confident, complete number. 29/36 fabricated headings is a staggering content fidelity failure. The rubric saw neither. This is Goodhart's Law in action — but it's also worse than Goodhart, because the measure was never good in the first place. Goodhart assumes the measure was once valid and became corrupted by targeting. Here, the measure was never calibrated against human perception at all. It was built from assumptions about what design quality means, and those assumptions were wrong. -->

---

<!-- design: {"zones":[{"role":"label","col":2,"span":12,"row":3,"rowSpan":2},{"role":"body","col":18,"span":38,"row":4,"rowSpan":32}],"accents":[{"type":"dot","col":6,"span":4,"row":7,"rowSpan":4,"color":"B7311A"},{"type":"line","col":18,"span":38,"row":3,"rowSpan":1,"color":"0A1628"}],"typography":{"body":{"size":15,"leading":"1.7","align":"left"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"B7311A"}},"bg":"FAF6EE","font":"Palatino"} -->
### STRUCTURE
### Absence-of-Bad vs Presence-of-Good

The rubric evolution traces a philosophical arc:

| Version | What it measured | What it missed |
|---------|-----------------|----------------|
| **v1** | Absence of errors | Everything that matters |
| **v2** | + Variety (layout archetypes, color transitions) | Monotony at a higher level |
| **v3** | + Banality (sparse slides, duplicate text) | Emptiness that looks full |
| **v4** | + Craft (typography hierarchy, alt text, accessibility honesty) | Things that require eyes |
| **v5-v6** | + Structural integrity (zone collisions, visual utilization) | Taste, balance, communicability |
| **v7** | + Demanding thresholds across all dimensions | The frontier: presence-of-good |

Each row was prompted by a human saying: "The rubric scored this well, but I can see it's not right."

<!-- notes: This table is the empirical core of the paper. Read it as a learning process: the rubric learns to see more, but each new capability is prompted by human perception, not by the rubric's own analysis. The rubric never discovers its own blind spots. The progression from "absence of errors" to "presence of craft" mirrors the broader challenge in AI evaluation: it is much easier to build detectors for failure than detectors for quality. A spell-checker can find misspellings; it cannot find prose that sings. -->

---

<!-- design: {"zones":[{"role":"quote","col":6,"span":40,"row":3,"rowSpan":14},{"role":"body","col":6,"span":40,"row":20,"rowSpan":18}],"accents":[{"type":"bar","col":4,"span":1,"row":3,"rowSpan":14,"color":"B7311A"},{"type":"line","col":6,"span":40,"row":18,"rowSpan":1,"color":"E5DFD3"}],"typography":{"quote":{"size":20,"weight":400,"leading":"1.5","align":"left","color":"0A1628"},"body":{"size":14,"leading":"1.65","align":"left"}},"bg":"FAF6EE","font":"Palatino"} -->
### REFLECTION
### Schon's Conversation with the Situation

Donald Schon described professional practice as a "conversation with the situation" — each design move provokes a response from the material, which surprises the practitioner, who reflects and adjusts.

The outer loop is this conversation:

1. **Move**: the inner loop produces a refined deck
2. **Response**: the human opens it in a browser and *sees* something the rubric didn't measure
3. **Surprise**: "the rubric says 91%, but I can see overlapping text"
4. **Reflection**: why did the rubric miss this? What assumption was wrong?
5. **Adjustment**: add a zone-collision detector, recalibrate the scoring formula

> "The practitioner allows himself to experience surprise, puzzlement, or confusion in a situation which he finds uncertain or unique."
> — Schon, *The Reflective Practitioner* (1983)

The rubric's 91% was not uncertain. It was confident. The surprise comes from the *human*, not the instrument.

<!-- notes: Schon's framework fits almost exactly, with one important difference: in Schon's account, the practitioner and the material are in direct contact. Here, the practitioner (user) and the material (deck) are mediated by an instrument (rubric) that claims to represent the material. The surprise is not "the material did something unexpected" but "the instrument said the material was fine, but it isn't." This is second-order surprise — surprise at the failure of the measurement, not the failure of the design. It's why the outer loop is harder to automate than the inner loop: the trigger is the gap between two representations (score and perception), not a gap within a single representation. -->