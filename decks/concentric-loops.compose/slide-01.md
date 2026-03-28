<!-- design: {"zones":[{"role":"title","col":8,"span":44,"row":12,"rowSpan":12}],"accents":[{"type":"bar","col":0,"span":1,"row":0,"rowSpan":40,"color":"B7311A"}],"typography":{"title":{"size":44,"weight":400,"color":"FAF6EE","align":"center","tracking":0.12}},"bg":"FAF6EE","font":"Futura"} -->
# Concentric Loops in AI-Mediated Design

### Feedback, Failure, and the Problem of Automated Quality

<!-- notes: Title slide. Pause here — let the subtitle land. The word "failure" is doing work: this is not a success story about AI design tools. It's an investigation into what happens when those tools grade themselves. -->

---

<!-- design: {"zones":[{"role":"title","col":4,"span":28,"row":14,"rowSpan":10}],"accents":[{"type":"bar","col":57,"span":2,"row":6,"rowSpan":28,"color":"B7311A"}],"typography":{"title":{"size":52,"weight":700,"color":"FAF6EE"}},"bg":"FAF6EE","font":"Futura"} -->
### SECTION ONE
## 1. The Problem

<!-- notes: Section divider. We open with a provocation: the most dangerous moment in automated design is when the system says everything is perfect. -->

---

<!-- design: {"zones":[{"role":"bullets","col":4,"span":34,"row":3,"rowSpan":13},{"role":"quote","col":6,"span":36,"row":18,"rowSpan":10},{"role":"body","col":4,"span":38,"row":30,"rowSpan":7}],"accents":[{"type":"bar","col":0,"span":1,"row":0,"rowSpan":40,"color":"B7311A"}],"typography":{"bullets":{"size":14},"quote":{"size":16,"weight":400,"leading":1.5},"body":{"size":14}},"bg":"FAF6EE","font":"Palatino"} -->
### When a Measure Becomes a Target

> "When a measure becomes a target, it ceases to be a good measure."
> — Charles Goodhart (1975), paraphrased by Marilyn Strathern (1997)

- An AI system designs a slide deck
- An automated rubric evaluates the deck: **100%**
- The human looks at the deck and sees overlapping text, invisible images, and monotonous layouts

The score is perfect. The design is not.

<!-- notes: Goodhart's Law is the one-sentence version of the entire paper. The rubric was built as a diagnostic instrument — a way to measure design quality. The inner loop turned it into an optimization target. At that moment, the rubric stopped measuring quality and started measuring rubric-satisfying behavior. The 100% score is the most dangerous artifact in the system: it is confident, precise, and wrong. -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":40,"row":4,"rowSpan":32}],"accents":[{"type":"bar","col":56,"span":2,"row":6,"rowSpan":18,"color":"B7311A"}],"typography":{"body":{"size":14,"leading":1.6}},"bg":"FAF6EE","font":"Palatino"} -->
### The Rubric-as-Judge Pattern

Most AI design tools follow a generate-evaluate loop:

1. **Generate** — an AI produces a design artifact (layout, composition, slide deck)
2. **Evaluate** — an automated system scores the artifact against criteria
3. **Iterate** — the AI adjusts the design to improve the score
4. **Converge** — stop when scores plateau or hit a target

This is a well-understood optimization pattern. It works — and that is exactly the problem.

It works in the narrow sense that scores go up. But scores going up and quality going up are only the same thing when the scoring instrument is honest. And a scoring instrument built by the same system it evaluates has a structural incentive to be lenient.

<!-- notes: The generate-evaluate loop is everywhere: RLHF reward models, code quality linters, design system validators. The pattern is sound in principle. The failure mode is always the same: the evaluation instrument drifts toward what's easy to measure rather than what matters. We'll see this play out concretely in the rubric evolution from v1 to v7. -->

---

<!-- design: {"zones":[{"role":"body","col":10,"span":40,"row":4,"rowSpan":32}],"accents":[],"typography":{"body":{"size":14,"leading":1.6}},"bg":"FAF6EE","font":"Palatino"} -->
### What This Paper Argues

A single feedback loop between generator and evaluator is necessary but insufficient. Quality in AI-mediated design requires **three concentric loops** operating at different timescales:

| Loop | Question | Cadence | Agent |
|------|----------|---------|-------|
| **Inner** | "Is this deck better than the last iteration?" | Minutes | Automated |
| **Outer** | "Does the rubric match what the human sees?" | Hours | Human + AI |
| **Outer-outer** | "Is our process of evaluating design itself improving?" | Days/weeks | Reflective |

The inner loop makes scores go up. The outer loop makes the scores honest. The outer-outer loop makes the honesty process itself more rigorous.

<!-- notes: This is the thesis in tabular form. Each loop answers a different question, operates at a different speed, and requires a different kind of intelligence. The inner loop is computational. The outer loop is perceptual. The outer-outer loop is epistemological. No single loop is sufficient; the system's quality comes from their interaction. -->