<!-- design: {"zones":[{"role":"body","col":4,"span":26,"row":4,"rowSpan":14},{"role":"bullets","col":34,"span":22,"row":4,"rowSpan":16}],"accents":[{"type":"line","col":32,"span":1,"row":4,"rowSpan":32,"color":"E8E2D6"},{"type":"dot","col":4,"span":2,"row":34,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":54,"span":2,"row":34,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":14,"leading":1.65},"bullets":{"size":14,"weight":500,"leading":1.55}},"bg":"F0EBE0","font":"Palatino"} -->
### Implications for Education

If students are trained only on the inner loop — "use this AI tool, iterate until the score is high" — they learn to be operators of an optimization machine. They are inside the loop, not above it.

The concentric loops framework suggests a different pedagogy:

- **Inner loop literacy**: understand how automated evaluation works. What does the score mean? What can it see? What can't it see?
- **Outer loop practice**: look at the output. Does it match the score? Where doesn't it? Develop the perceptual skill to notice what metrics miss.
- **Outer-outer loop reflection**: is the evaluation process itself fair? Complete? Biased? Who benefits from a particular definition of quality?

Students as outer-loop calibrators, not inner-loop consumers. The educational value is in the gap between the score and their perception — that gap is where design judgment lives.

In the fractal design framing: students need to understand all three properties. The **recursive** property teaches them to think at multiple scales — not just "is this slide good?" but "is my way of judging slides good?" The **symbiotic** property teaches them where human and machine intelligence differ — what the machine can do faster and what the human can see better. The **generative** property teaches them that quality is not a fixed target but an emergent outcome of iterative refinement — "generative AI" generates artifacts, but generative *design* generates the criteria.

<!-- notes: The education implications follow from the cybernetics/AI divide in the week-2 content. McCarthy's AI vision — autonomous, self-improving machines — maps to the inner loop alone. Wiener's cybernetics vision — human-machine cooperation, feedback, governance — maps to the full concentric loops. Teaching only the inner loop produces students who trust AI output. Teaching all three loops produces students who can evaluate, calibrate, and improve AI output. The fractal design framing gives students a vocabulary for what they're learning: recursion (meta-cognition), symbiosis (collaboration), generativity (emergence). These are transferable concepts that apply far beyond slide design. -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":52,"row":3,"rowSpan":34}],"accents":[{"type":"dot","col":28,"span":2,"row":2,"rowSpan":2,"color":"B7311A"},{"type":"line","col":4,"span":52,"row":20,"rowSpan":1,"color":"E8E2D6"},{"type":"dot","col":28,"span":2,"row":36,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":13,"leading":1.7}},"bg":"FAF6EE","font":"Palatino"} -->
### The Inner Loop Converges on Any Aesthetic

Seven versions of the same 36-slide deck, each with a genuinely different design language, all refined to 80%+ computed score:

| Version | Aesthetic | Computed (/60) | Visual Taste (/10) | Combined (/90) |
|---------|-----------|---------------|-------------------|----------------|
| v10 | Literary/atmospheric | 48.8 (81%) | 7 | 69.3 (77%) |
| v12 | Botanical/Palatino | 50.1 (84%) | 8 | 72.6 (81%) |
| v13 | Weingart electric | 49.9 (83%) | 8 | 72.0 (80%) |
| v14 | Brutalist concrete | 51.0 (85%) | 9 | 72.5 (81%) |
| v15 | Pop chromatic | 51.3 (86%) | 6 | 70.8 (79%) |
| v16 | Terminal editorial | 50.5 (84%) | 8 | 73.5 (82%) |
| **v17** | **Post-Swiss deconstruction** | **36.6 (61%)** | **?** | **Rubric failure case** |

v17 breaks the cluster. Its 61% computed score is not a quality failure — it is a *rubric* failure. The metrics penalize intentional design choices (binary palette, monospace austerity) alongside genuine accessibility violations (low contrast on dark backgrounds). See Case Study below.

The computed scores for v10-v16 cluster tightly (81-86%), confirming the inner loop is aesthetic-agnostic: it optimizes structural quality regardless of design direction. The aesthetic itself is an outer-loop choice.

But the visual scores diverge dramatically. v15 Pop Chromatic scores highest on computed metrics (86%) yet lowest on visual taste (6/10) — its cheerful rotating hues satisfy every metric but lack design rigor. v14 Brutalist scores highest on taste (9/10) but lower computed. This divergence is the formalization frontier made visible: computed metrics capture absence-of-bad, visual assessment captures presence-of-good. The gap between them is precisely what the outer loop exists to address.

<!-- notes: This data from the 7-version comparison study is the strongest empirical evidence that the inner loop and outer loop measure different things. The tight computed cluster means the inner loop reliably achieves structural quality. The visual divergence means structural quality is necessary but not sufficient. The Pop Chromatic / Brutalist contrast is the paper's argument in miniature: the metrics say Pop is better, the eye says Brutalist is better, and neither is wrong — they are measuring different qualities. The 80% convergence threshold was a methodological decision ("back yourself, don't give up below 80%") that prevented premature stopping and forced fixing real issues. -->

---

<!-- design: {"zones":[{"role":"body","col":14,"span":32,"row":12,"rowSpan":16}],"accents":[{"type":"line","col":14,"span":32,"row":11,"rowSpan":1,"color":"2C3E50"},{"type":"line","col":14,"span":32,"row":30,"rowSpan":1,"color":"2C3E50"},{"type":"dot","col":8,"span":2,"row":18,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":16,"leading":1.65}},"bg":"FAF6EE","font":"Palatino"} -->
### When the Outer Loop Made Things Worse

Not every outer loop iteration improved the system. Two cases of regression:

**Rubric v5 lowDensity penalty**: the outer loop added a penalty for slides with sparse content (few text elements, large whitespace). This correctly caught slides where content had been lost. But it also penalized intentional section dividers — dark-background slides with a single title, designed as visual pauses. The paper's own deck scored Content 2.3/10 because 9 section dividers were penalized at -0.8 each. The fix required a second outer loop iteration: exempt dark-background slides from lowDensity.

**Splice targeting inversion**: after adding splice image metrics (outer loop iteration 9), the splice algorithm was fixed to place images on text-only slides. But the first fix inverted the targeting: it placed images only on slides that already had images, leaving the 14 text-only slides — the ones most needing visual enhancement — untouched. The outer loop correctly identified the metric gap, but the implementation fix introduced a new failure mode. Three more iterations were needed: fix targeting, tighten corner detection, add the atmospheric-opacity tier.

These failures demonstrate that the outer loop is not monotonically improving. Each intervention can introduce new problems. The concentric loops framework handles this through iteration, not infallibility: the outer-outer loop's value is in catching outer-loop regressions, not preventing them.

<!-- notes: Honest reporting of failure cases strengthens the paper's credibility. The lowDensity example is particularly instructive: it shows a rubric metric that was locally correct (sparse slides are usually bad) but globally wrong (some sparse slides are intentional). The splice targeting case shows that the outer loop's diagnosis can be correct while its fix is wrong. Both cases demonstrate that the concentric loops are not a guaranteed improvement mechanism — they are a structured way of detecting and correcting regressions, including regressions introduced by previous corrections. -->

---

<!-- design: {"zones":[{"role":"body","col":20,"span":36,"row":3,"rowSpan":34}],"accents":[{"type":"bar","col":0,"span":16,"row":0,"rowSpan":40,"color":"E8E2D6"},{"type":"dot","col":7,"span":2,"row":8,"rowSpan":2,"color":"B7311A"},{"type":"line","col":20,"span":36,"row":2,"rowSpan":1,"color":"2C3E50"},{"type":"dot","col":7,"span":2,"row":30,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":13,"leading":1.7}},"bg":"FAF6EE","font":"Palatino"} -->
### Case Study: Post-Swiss Deconstruction (v17)

The rubric's strongest test came from a design that deliberately confronted its assumptions. Version 17 was briefed as a "post-Swiss deconstruction" — Wolfgang Weingart meets David Carson. Near-black backgrounds (#0A0A0A) on 78% of slides. Courier New monospace throughout. Neon magenta (#FF3366) and electric green (#00FF88) as accent signals. The brief explicitly invited rule-breaking: "the 60-column grid is your material, not your master."

The rubric scored it **36.6/60 (61%)** — the lowest of any version that reached evaluation. The breakdown:

| Dimension | Score | What the rubric saw | What a designer sees |
|---|---|---|---|
| Accessibility | 1/10 | 10 contrast warnings (light on dark) | **Legitimate concern** — Courier at 14px on near-black is genuinely hard to read. Not all contrast failures are aesthetic choices. |
| Grid | 7.1/10 | Low archetype variety, 1 collision | Mixed — the collision is real, but "low variety" misreads deliberate monotony |
| Color | 6/10 | Only 2 backgrounds, palette monotony | **Wrong** — binary black/white with neon accents is an intentional palette, not poverty |
| Coherence | 8/10 | Single font, good scale | **Right** — correctly recognizes the monospace discipline |
| Images | 7/10 | Background splices on dense text | **Partially right** — some backgrounds genuinely hurt readability |
| Content | 7.5/10 | 1 empty zone, 2 sparse slides | **Right** — structural issues are real regardless of aesthetic |

The user's outer-loop assessment confirmed: "there are legitimate accessibility issues alongside the different design — a low score is not just aesthetic preference." The rubric was right about readability (Accessibility 1/10 reflects real problems) but wrong about palette (Color 6/10 mistakes intentional minimalism for incompetence).

This case reveals where the line between **craft failure** and **aesthetic choice** actually falls. Accessibility violations are never just aesthetic — they are functional failures that exclude audiences. But a two-color palette is a design decision that the rubric should recognize, not penalize. The outer loop's value is precisely in making this distinction: the human confirms the accessibility score ("yes, that Courier IS too small") while overriding the color score ("no, that binary palette IS the point").

The implication for the rubric: accessibility metrics should be aesthetic-agnostic (contrast failures are always failures), but palette and layout metrics should be calibratable by declared intent. A "post-Swiss" brief should adjust the color variety threshold downward, while leaving accessibility thresholds unchanged. This is the **deck-type parameter** — a future outer-outer loop iteration.

<!-- notes: v17 is the paper's most important case study because it tests the rubric at its limits. Previous versions explored within the rubric's comfort zone (warm editorial, Swiss discipline). v17 attacks the rubric's assumptions: dark backgrounds, monospace only, deliberate sparseness, neon accents. The rubric's response reveals its biases — it confuses aesthetic austerity with design poverty. But it also catches real problems: the accessibility score of 1/10 is not aesthetic bias, it's functional failure. The Courier New at 14px on #0A0A0A is genuinely illegible for many viewers. The outer loop's role is to separate the legitimate accessibility failures (raise the font size, increase contrast) from the illegitimate palette penalties (the binary palette is intentional). This distinction — between functional quality and aesthetic preference — is the most important boundary in automated design evaluation. -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":40,"row":6,"rowSpan":28}],"accents":[{"type":"bar","col":48,"span":12,"row":0,"rowSpan":40,"color":"0A1628"},{"type":"dot","col":52,"span":2,"row":14,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":52,"span":2,"row":24,"rowSpan":2,"color":"B7311A"},{"type":"line","col":4,"span":40,"row":5,"rowSpan":1,"color":"E8E2D6"}],"typography":{"body":{"size":14,"leading":1.65}},"bg":"FAF6EE","font":"Palatino"} -->
### Cost and Human Time

The system's efficiency depends on the loop:

| Activity | Human time | Machine time | Ratio |
|----------|-----------|-------------|-------|
| Inner loop (3 iterations) | 0 min (unattended) | ~6 min | Fully automated |
| Outer loop iteration | 10-30 min (review + diagnosis) | 2-5 min (re-eval) | Human-dominated |
| Outer-outer loop change | 1-4 hours (design + implement) | Variable | Human-dominated |
| Full convergence (8 outer iterations) | ~8 hours | ~40 min | 12:1 human:machine |

The inner loop's automation is real but bounded: it handles ~12 points of improvement (structural fixes) in 6 minutes. The outer loop's 8 points required ~8 hours of human attention — diagnosis, rubric revision, re-evaluation, regression checking. The outer-outer loop changes (exhaustive evaluation, wireframe tool, unified scoring) required several more hours of design and implementation.

Total human investment for one deck's full convergence: approximately 10-12 hours across sessions. This is not a time-saving tool in the conventional sense. The value is not efficiency but *quality that would not otherwise be achieved* — no amount of manual review would have systematically discovered and fixed all 11 rubric blind spots. The loops make quality tractable, not fast.

<!-- notes: Cost transparency is essential for reproducibility. The 12:1 human-to-machine ratio undercuts any narrative that AI design tools eliminate human labor. They redirect it: from producing artifacts (which the inner loop handles) to calibrating quality (which only humans can do). The "not a time-saving tool" framing is deliberately provocative — it positions the system against the marketing narrative of AI efficiency and toward a claim about quality ceilings. -->