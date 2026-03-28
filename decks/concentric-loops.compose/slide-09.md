<!-- design: {"zones":[{"role":"label","col":2,"span":12,"row":3,"rowSpan":2},{"role":"body","col":16,"span":40,"row":4,"rowSpan":16},{"role":"bullets","col":16,"span":40,"row":22,"rowSpan":14}],"accents":[{"type":"bar","col":14,"span":1,"row":4,"rowSpan":32,"color":"B7311A"},{"type":"line","col":16,"span":40,"row":21,"rowSpan":1,"color":"E5DFD3"}],"typography":{"body":{"size":15,"leading":"1.7","align":"left"},"bullets":{"size":14,"leading":"1.6"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"B7311A"}},"bg":"FAF6EE","font":"Palatino"} -->
### IMPLICATIONS
### How This Differs from RLHF

Reinforcement Learning from Human Feedback shares the two-loop structure:
- **Inner**: RL policy optimizes against a learned reward model
- **Outer**: humans provide preference data that recalibrates the reward model

But the concentric loops framework differs in three ways:

**Richer feedback**: RLHF uses preference pairs ("A is better than B"). Our outer loop uses diagnostic feedback ("this text overlaps on slide 14, the rubric scored Grid Utilization 9/10, the zone collision detector is missing"). Diagnostic feedback identifies *what* is wrong and *why* the instrument missed it.

**Instrument transparency**: the RLHF reward model is a neural network — a black box. Our rubric is a set of explicit formulas. When the human says "the rubric is wrong," we can read the formula, find the gap, and fix it. The rubric is debuggable.

**Third loop**: RLHF has no explicit outer-outer loop. The reward model architecture may evolve between research iterations, but this is not a structured part of the RLHF process. The concentric loops framework makes methodology evolution explicit and systematic.

<!-- notes: The RLHF comparison is important because it's the framework the ML audience knows best. The three differences are not criticisms of RLHF — they reflect different contexts. RLHF operates at a scale where diagnostic feedback is impractical and transparent instruments are infeasible. Our system operates at a scale where both are possible. The point is not "concentric loops is better than RLHF" but "the concentric loops pattern makes explicit the structures that RLHF leaves implicit." In particular, the outer-outer loop — evolving the evaluation methodology — happens in RLHF research but is not formalized as part of the system. -->

---

<!-- design: {"zones":[{"role":"label","col":46,"span":12,"row":2,"rowSpan":2},{"role":"body","col":4,"span":38,"row":4,"rowSpan":14},{"role":"bullets","col":4,"span":38,"row":20,"rowSpan":18}],"accents":[{"type":"line","col":4,"span":38,"row":19,"rowSpan":1,"color":"B7311A"},{"type":"dot","col":50,"span":4,"row":8,"rowSpan":4,"color":"E5DFD3"}],"typography":{"body":{"size":14,"leading":"1.6","align":"left"},"bullets":{"size":14,"leading":"1.55"},"label":{"size":11,"transform":"uppercase","tracking":"0.12em","color":"0A1628"}},"bg":"E5DFD3","font":"Palatino"} -->
### LIMITS
### Second-Order Cybernetics

Heinz von Foerster's second-order cybernetics insists that the observer cannot be separated from the observed system. The act of measuring changes what is measured.

This is literal in our system:
- The rubric's existence shapes the composition (the AI optimizes for rubric-satisfying designs)
- The user's feedback shapes the rubric (the rubric evolves to match human perception)
- The methodology shapes the feedback (exhaustive evaluation surfaces different issues than sampling)

There is no "objective" design quality independent of the observation system. The concentric loops acknowledge this: instead of seeking an objective measure, they seek an *improving* measure — one that is systematically made more honest through human interaction.

Von Foerster's ethics of observation apply: "Act always so as to increase the number of choices." Each outer loop iteration adds capability to the rubric — more things it can see, more dimensions it can score. The rubric's field of vision expands through use.

Stafford Beer's Viable System Model (VSM) offers a complementary lens: our inner loop maps to Beer's System 1 (operations), the outer loop to System 3-4 (regulation and adaptation), and the question the loops never fully answer — what does "good design" mean? — is Beer's System 5: identity. The definition of quality is always provisional, always being revised. There is no final rubric.

<!-- notes: Second-order cybernetics is the deepest theoretical connection. The inner loop treats the rubric as objective (first-order). The outer loop reveals it as constructed and observer-dependent (second-order). The outer-outer loop is the practice of making the construction visible and improvable. Von Foerster's ethical maxim — increase choices — maps to the rubric evolution: each version can discriminate more finely, which gives the composition AI more guidance about what "good" means. The rubric's vocabulary for quality expands over time. Beer's VSM is a suggestive rather than rigorous mapping, but his System 5 (identity/values) captures the key open question: the system's understanding of its own purpose evolves through the interaction of all three loops. -->

---

<!-- design: {"zones":[{"role":"label","col":2,"span":12,"row":3,"rowSpan":2},{"role":"body","col":2,"span":30,"row":6,"rowSpan":12},{"role":"bullets","col":2,"span":30,"row":20,"rowSpan":16}],"accents":[{"type":"line","col":2,"span":30,"row":19,"rowSpan":1,"color":"0A1628"},{"type":"block","col":36,"span":22,"row":0,"rowSpan":40,"color":"FAF6EE"}],"typography":{"body":{"size":15,"leading":"1.7","align":"left"},"bullets":{"size":14,"leading":"1.6"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"B7311A"}},"bg":"E5DFD3","font":"Palatino"} -->
### FUTURE
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

<!-- design: {"zones":[{"role":"title","col":4,"span":52,"row":12,"rowSpan":16}],"accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"B7311A"},{"type":"bar","col":58,"span":2,"row":0,"rowSpan":40,"color":"B7311A"}],"typography":{"title":{"size":52,"weight":700,"tracking":"0.02em","align":"center","color":"FAF6EE"}},"bg":"FAF6EE","font":"Futura"} -->
### SECTION
## 8. Conclusion

<!-- notes: Section divider. Keep it short. The argument has been made. The conclusion lands the killer line and points forward. -->

---

<!-- design: {"zones":[{"role":"label","col":46,"span":12,"row":4,"rowSpan":2},{"role":"body","col":8,"span":36,"row":10,"rowSpan":18}],"accents":[{"type":"line","col":8,"span":36,"row":9,"rowSpan":1,"color":"B7311A"},{"type":"bar","col":6,"span":1,"row":10,"rowSpan":18,"color":"E5DFD3"}],"typography":{"body":{"size":17,"leading":"1.8","align":"left"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"B7311A"}},"bg":"FAF6EE","font":"Palatino"} -->
### CODA
### What We Found

Three findings, from the specific to the general:

**1. A single feedback loop is dangerous.** The rubric that scored 100% was the most dangerous artifact in the system — it was confident, precise, and wrong. The inner loop alone converges on rubric-satisfying behavior, not quality.

**2. The outer loop is where quality happens.** Every improvement in the rubric was triggered by a human noticing something the metrics missed. No automated analysis discovered a rubric blind spot. The score-perception gap is not a bug — it is the signal that drives genuine improvement.

**3. The methodology must evolve.** Exhaustive evaluation, wireframe comparison, structured feedback protocols, unified scoring engines — each of these was a methodological decision prompted by the outer loop's own failures. The system that evaluates the evaluator must itself be evaluated.

<!-- notes: Three findings at three levels: inner (dangerous alone), outer (necessary for quality), outer-outer (necessary for the outer loop). The structure mirrors the concentric loops themselves. -->