<!-- design: {"zones":[{"role":"title","col":4,"span":36,"row":13,"rowSpan":10},{"role":"label","col":4,"span":16,"row":25,"rowSpan":2}],"accents":[{"type":"bar","col":44,"span":16,"row":0,"rowSpan":40,"color":"B7311A"},{"type":"line","col":4,"span":36,"row":24,"rowSpan":1,"color":"2C3E50"}],"typography":{"title":{"size":52,"weight":700,"leading":1.05,"color":"FAF6EE"},"label":{"size":11,"weight":400,"transform":"uppercase","tracking":"0.14em","color":"E8E2D6"}},"bg":"FAF6EE","font":"Futura"} -->
### SECTION SEVEN
## 7. Discussion

### Fractal Design

<!-- notes: Section divider. Act II begins. "Fractal design" reframes the concentric loops as a three-part concept: recursive (self-similar loops at different scales), symbiotic (human and machine intelligence at different positions in the structure), and generative (the system produces increasingly complex quality through iteration of simple rules). This framing connects the paper's specific findings to broader traditions in design thinking, computation, and AI collaboration. -->

---

<!-- design: {"zones":[{"role":"bullets","col":34,"span":22,"row":4,"rowSpan":14},{"role":"body","col":4,"span":26,"row":4,"rowSpan":32}],"accents":[{"type":"line","col":32,"span":1,"row":4,"rowSpan":32,"color":"E8E2D6"},{"type":"dot","col":56,"span":2,"row":4,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":56,"span":2,"row":16,"rowSpan":2,"color":"B7311A"}],"typography":{"bullets":{"size":15,"weight":600,"leading":1.55},"body":{"size":14,"leading":1.65}},"bg":"F0EBE0","font":"Palatino"} -->
### A General Framework

The concentric loops pattern applies wherever:

1. An AI system produces creative artifacts
2. Quality is partially but not fully formalizable
3. Automated evaluation is necessary (too many artifacts for human review) but insufficient (metrics miss things that matter)

The pattern:

- **Inner loop**: optimize against a formal quality model. Fast, automated, narrow.
- **Outer loop**: calibrate the quality model against human perception. Slower, human-in-the-loop, broadening.
- **Outer-outer loop**: evolve the calibration process itself. Slowest, reflective, structural.

The loops are defined by their relationship to the quality model: the inner loop trusts it, the outer loop questions it, the outer-outer loop questions how it's questioned.

<!-- notes: The generalization needs to be careful — not every AI system needs three concentric loops. The claim is specific: when quality is partially formalizable (meaning metrics help but don't capture everything), the concentric loops pattern outperforms either pure automation (inner loop only) or pure human review (no inner loop). The key condition is "partially but not fully formalizable" — if quality is fully formalizable, the inner loop is sufficient; if quality is fully ineffable, metrics aren't worth building. The interesting case is the middle, where metrics are useful guides but unreliable judges. -->

---

<!-- design: {"zones":[{"role":"body","col":12,"span":36,"row":10,"rowSpan":18}],"accents":[{"type":"dot","col":6,"span":2,"row":16,"rowSpan":2,"color":"B7311A"},{"type":"line","col":12,"span":36,"row":9,"rowSpan":1,"color":"2C3E50"},{"type":"line","col":12,"span":36,"row":30,"rowSpan":1,"color":"2C3E50"}],"typography":{"body":{"size":16,"leading":1.65}},"bg":"FAF6EE","font":"Palatino"} -->
### Recursive, Symbiotic, Generative

The concentric loops pattern exhibits three properties that, taken together, constitute what we call **fractal design**:

**Recursive**: the loops are self-similar at different scales. Each loop follows the same structure — observe, evaluate, adjust — but operates on a different object. The inner loop adjusts the design. The outer loop adjusts the rubric. The outer-outer loop adjusts the methodology. The pattern recurses: each level applies the same logic to the output of the level below. Like a fractal, the shape of the whole is repeated in the shape of the parts.

**Symbiotic**: human and machine intelligence occupy different positions in the structure, and the system works only because both are present. The machine is fast, tireless, and literal — it optimizes against whatever metric it is given. The human is slow, selective, and perceptual — they see what the metric misses. This is not a division of labor but a symbiosis: the machine's speed makes the human's perception actionable (you cannot manually review 36 slides after every 2-minute iteration), and the human's perception makes the machine's speed meaningful (fast optimization against a broken metric produces polished mediocrity). J.C.R. Licklider's "Man-Computer Symbiosis" (1960) described exactly this interdependence: "Men will set the goals, formulate the hypotheses, determine the criteria... Computers will do the routinizable work."

**Generative**: the system produces complex quality through iteration of simple rules, in the older algorithmic sense of "generative." A generative grammar (Chomsky) produces infinite sentences from finite rules. An L-system (Lindenmayer) produces complex branching structures from a single axiom and a few rewrite rules. The concentric loops are generative in the same sense: the rule is simple — "evaluate, find the gap, fix it" — but applied recursively across scales, it generates an increasingly sophisticated understanding of quality that no single iteration could produce. The "generative AI" that powers the inner loop is generative in the newer, narrower sense: it generates artifacts. The concentric loops are generative in the deeper sense: they generate the criteria by which those artifacts are judged.

<!-- notes: "Fractal design" is the paper's conceptual contribution. The three properties are individually well-known: recursion is structural, symbiosis is relational, and generativity is procedural. The claim is that the concentric loops pattern exhibits all three simultaneously, and that this combination is what makes it effective. Remove any one and the system degrades: without recursion, the loops don't nest and the methodology can't improve itself. Without symbiosis, the system either optimizes blindly (machine only) or reviews exhaustingly (human only). Without generativity, the system doesn't accumulate — each iteration starts from scratch rather than building on what the previous iteration learned. The Licklider reference is deliberate: his 1960 paper anticipated exactly the kind of human-machine collaboration that the concentric loops implement, fifty years before "generative AI" existed. The generative grammar and L-system references connect to the computational tradition that predates neural networks — the idea that complex structure emerges from simple recursive rules, not from large models. -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":30,"row":4,"rowSpan":18},{"role":"bullets","col":4,"span":50,"row":26,"rowSpan":12}],"accents":[{"type":"line","col":4,"span":50,"row":24,"rowSpan":1,"color":"E8E2D6"},{"type":"dot","col":38,"span":2,"row":8,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":54,"span":2,"row":28,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":14,"leading":1.65},"bullets":{"size":14,"weight":500,"leading":1.55}},"bg":"FAF6EE","font":"Palatino"} -->
### How This Differs from RLHF

Reinforcement Learning from Human Feedback shares the two-loop structure:
- **Inner**: RL policy optimizes against a learned reward model
- **Outer**: humans provide preference data that recalibrates the reward model

But the concentric loops framework differs in three ways:

**Richer feedback**: RLHF uses preference pairs ("A is better than B"). Our outer loop uses diagnostic feedback ("this text overlaps on slide 14, the rubric scored Grid Utilization 9/10, the zone collision detector is missing"). Diagnostic feedback identifies *what* is wrong and *why* the instrument missed it.

**Instrument transparency**: the RLHF reward model is a neural network — a black box. Our rubric is a set of explicit formulas. When the human says "the rubric is wrong," we can read the formula, find the gap, and fix it. The rubric is debuggable.

**Third loop**: RLHF has no explicit outer-outer loop. The reward model architecture may evolve between research iterations, but this is not a structured part of the RLHF process. The concentric loops framework makes methodology evolution explicit and systematic.

**A scale caveat**: these differences reflect an artisanal context. Our system has one user, one domain, and 36 slides per deck. RLHF operates at industrial scale — millions of preference pairs, thousands of annotators, models serving billions of queries. Diagnostic feedback and transparent instruments are possible in our context precisely because the scale is small enough for one person to review every slide. The concentric loops framework does not claim to replace RLHF at scale. It claims that the structures RLHF leaves implicit — the outer-outer loop in particular — are worth making explicit, even if the mechanisms for doing so must differ at industrial scale. Whether diagnostic feedback can be crowdsourced, or whether transparent rubrics can be maintained for complex domains, are open questions.

<!-- notes: The RLHF comparison is important because it's the framework the ML audience knows best. The three differences are not criticisms of RLHF — they reflect different contexts. RLHF operates at a scale where diagnostic feedback is impractical and transparent instruments are infeasible. Our system operates at a scale where both are possible. The scale caveat is necessary honesty: claiming that our artisanal findings generalize directly to industrial RLHF would be overreach. The claim is structural, not operational: the three-loop pattern is visible at our scale and may be present but harder to see at RLHF scale. -->

---

<!-- design: {"zones":[{"role":"body","col":20,"span":36,"row":4,"rowSpan":16},{"role":"bullets","col":20,"span":36,"row":22,"rowSpan":16}],"accents":[{"type":"bar","col":0,"span":16,"row":0,"rowSpan":40,"color":"0A1628"},{"type":"dot","col":7,"span":2,"row":12,"rowSpan":2,"color":"B7311A"},{"type":"line","col":20,"span":36,"row":21,"rowSpan":1,"color":"2C3E50"},{"type":"dot","col":7,"span":2,"row":28,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":14,"leading":1.6},"bullets":{"size":14,"weight":500,"leading":1.55}},"bg":"FAF6EE","font":"Palatino"} -->
### Second-Order Cybernetics

Heinz von Foerster's second-order cybernetics insists that the observer cannot be separated from the observed system. The act of measuring changes what is measured.

This is literal in our system:
- The rubric's existence shapes the composition (the AI optimizes for rubric-satisfying designs)
- The user's feedback shapes the rubric (the rubric evolves to match human perception)
- The methodology shapes the feedback (exhaustive evaluation surfaces different issues than sampling)

The engine divergence data makes this concrete: the same deck scored 58.5/60 (Puppeteer) and 49.8/60 (jsdom) with identical formulas. The 8.7-point gap is not an error — it is a measurement of how much the observation instrument contributes to the observation. The "score" does not exist independent of the engine that produces it. Change the engine, change the score. This is von Foerster's point, empirically demonstrated.

There is no "objective" design quality independent of the observation system. The concentric loops acknowledge this: instead of seeking an objective measure, they seek an *improving* measure — one that is systematically made more honest through human interaction.

Von Foerster's ethics of observation apply: "Act always so as to increase the number of choices." Each outer loop iteration adds capability to the rubric — more things it can see, more dimensions it can score. The rubric's field of vision expands through use.

Stafford Beer's Viable System Model (VSM) offers a complementary lens: our inner loop maps to Beer's System 1 (operations), the outer loop to System 3-4 (regulation and adaptation), and the question the loops never fully answer — what does "good design" mean? — is Beer's System 5: identity. The definition of quality is always provisional, always being revised. There is no final rubric.

<!-- notes: Second-order cybernetics is the deepest theoretical connection. The inner loop treats the rubric as objective (first-order). The outer loop reveals it as constructed and observer-dependent (second-order). The outer-outer loop is the practice of making the construction visible and improvable. Von Foerster's ethical maxim — increase choices — maps to the rubric evolution: each version can discriminate more finely, which gives the composition AI more guidance about what "good" means. The rubric's vocabulary for quality expands over time. Beer's VSM is a suggestive rather than rigorous mapping, but his System 5 (identity/values) captures the key open question: the system's understanding of its own purpose evolves through the interaction of all three loops. -->