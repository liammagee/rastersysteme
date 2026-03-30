<!-- design: {"zones":[{"role":"title","col":12,"span":36,"row":14,"rowSpan":8},{"role":"label","col":12,"span":16,"row":24,"rowSpan":2}],"accents":[{"type":"dot","col":6,"span":2,"row":16,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":6,"span":2,"row":20,"rowSpan":2,"color":"B7311A"},{"type":"line","col":12,"span":36,"row":23,"rowSpan":1,"color":"2C3E50"}],"typography":{"title":{"size":48,"weight":700,"leading":1.08,"color":"FAF6EE"},"label":{"size":11,"weight":400,"transform":"uppercase","tracking":"0.14em","color":"E8E2D6"}},"bg":"FAF6EE","font":"Futura"} -->
### SECTION EIGHT
## 8. Related Work

<!-- notes: Section divider. Position the paper's contribution relative to existing literature in computational design evaluation, LLM-as-judge, and human-AI creative collaboration. -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":30,"row":12,"rowSpan":16}],"accents":[{"type":"bar","col":38,"span":22,"row":0,"rowSpan":40,"color":"E8E2D6"},{"type":"dot","col":48,"span":2,"row":18,"rowSpan":2,"color":"B7311A"},{"type":"line","col":4,"span":30,"row":11,"rowSpan":1,"color":"2C3E50"}],"typography":{"body":{"size":16,"leading":1.65}},"bg":"FAF6EE","font":"Palatino"} -->
### Computational Design Evaluation

Automated evaluation of visual design has a substantial literature. Miniukovich and De Angeli (2015) established metrics for visual complexity and colorfulness that predict user aesthetic preferences. Reinecke et al. (2013) demonstrated that visual complexity and colorfulness predict first-impression appeal across cultures. These approaches share our inner loop's commitment to computed metrics, but they target static web pages, not compositional slide design, and they lack our outer loop's mechanism for metric revision.

Closer to our work, Swearngin et al. (2018) used machine learning to evaluate mobile UI design quality, identifying patterns that distinguish professional from amateur designs. Their "Scout" system automates evaluation but treats the evaluation model as fixed — there is no structured process for recalibrating when the model's judgments diverge from expert perception. The concentric loops framework addresses precisely this gap: what happens after the automated evaluation disagrees with the human?

In computational aesthetics, Datta et al. (2006) and Marchesotti et al. (2011) built classifiers for photographic aesthetics using hand-crafted and learned features respectively. Our rubric's evolution from absence-of-bad (rule violations) to presence-of-good (craft indicators) recapitulates the field's trajectory from low-level features to perceptual quality — but our process makes the evolution explicit and human-driven rather than implicit in training data.

<!-- notes: The computational design evaluation literature provides the technical context for our inner loop. The key distinction is that most prior work treats the evaluation model as fixed (trained once, deployed) while our system treats it as evolving (calibrated continuously through human feedback). This is not a criticism of prior work — their scale requires fixed models. It is a claim that the fixed-model assumption hides an important process that our small-scale study makes visible. -->

---

<!-- design: {"zones":[{"role":"body","col":24,"span":32,"row":12,"rowSpan":16}],"accents":[{"type":"bar","col":0,"span":20,"row":0,"rowSpan":40,"color":"F0EBE0"},{"type":"dot","col":9,"span":2,"row":18,"rowSpan":2,"color":"B7311A"},{"type":"line","col":24,"span":32,"row":11,"rowSpan":1,"color":"2C3E50"}],"typography":{"body":{"size":16,"leading":1.65}},"bg":"FAF6EE","font":"Palatino"} -->
### LLM-as-Judge and Self-Evaluation

The "LLM-as-judge" paradigm (Zheng et al., 2023) uses large language models to evaluate other LLM outputs, creating exactly the generate-evaluate loop our paper examines. The MT-Bench and Chatbot Arena frameworks demonstrate both the utility and the limitations of automated judging: LLM judges correlate well with human preferences in aggregate but exhibit systematic biases (position bias, verbosity bias, self-enhancement bias).

Our work extends this literature in two directions. First, we use a *transparent* evaluator (explicit formulas rather than neural scoring), which makes the judge's biases discoverable and fixable — the equivalent of opening the reward model and editing its weights. Second, we document the *process* of discovering and fixing judge biases over 11 iterations, providing a longitudinal account that snapshot evaluations cannot capture.

Panickssery et al. (2024) study LLM self-evaluation and find that models are systematically biased toward their own outputs. Our invented-labels case study (Section 3) demonstrates the same dynamic in a design context: the composition AI, informed by rubric-derived design lessons, produces artifacts that satisfy the rubric because the rubric shaped the generator's training signal. The concentric loops framework is a structural response to this circularity.

<!-- notes: LLM-as-judge is the most directly relevant related work. Our contribution is not a better judge but a better process for improving judges. The transparent-evaluator point is important: most LLM-as-judge work uses neural judges that cannot be debugged. Our explicit-formula approach trades expressiveness for transparency, and the outer loop exploits that transparency to drive systematic improvement. The self-evaluation bias finding connects directly to our Goodhart analysis. -->

---

<!-- design: {"zones":[{"role":"body","col":14,"span":32,"row":10,"rowSpan":16}],"accents":[{"type":"line","col":14,"span":32,"row":9,"rowSpan":1,"color":"E8E2D6"},{"type":"line","col":14,"span":32,"row":28,"rowSpan":1,"color":"E8E2D6"},{"type":"dot","col":50,"span":2,"row":16,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":16,"leading":1.65}},"bg":"F0EBE0","font":"Palatino"} -->
### Human-AI Creative Collaboration

The broader context is human-AI creative collaboration, surveyed by Muller et al. (2022) and Rezwana and Maher (2023). Most frameworks distinguish between AI as tool (human directs), AI as collaborator (shared agency), and AI as autonomous creator. The concentric loops framework adds a fourth role: **AI as instrument** — the AI produces evaluation artifacts (scores, diagnostics) that the human interprets and acts on. The rubric is not a collaborator; it is a lens through which the human sees the design.

Koch et al. (2019) describe "mixed-initiative creative interfaces" where human and AI alternate control. Our inner loop automates the AI's turn (evaluate-fix-render); our outer loop automates the *transition* between turns (the score-perception gap triggers human intervention). The contribution is not the mixed-initiative pattern itself but the explicit formalization of when and why control transfers between human and machine.

A final precedent: Christopher Alexander's pattern language (1977) attempted to formalize design knowledge as a generative system — rules that produce buildings through sequential application. Alexander's late-career critique of his own framework is instructive: the patterns were adopted as templates (inner-loop recipes) rather than as a living, evolving vocabulary (which would require outer-loop calibration). Our design database (Section 4) faces the same risk: accumulated design lessons encode rubric preferences, and if the rubric is miscalibrated, the lessons propagate the error. Alexander's experience predicts our Prediction 3 (bias amplification through institutional memory).

<!-- notes: Alexander is the missing link between the design theory tradition and the computational evaluation tradition. His pattern language was the first attempt at what we now call a design system with embedded evaluation criteria. His critique of how patterns became templates — used mechanically rather than adapted contextually — is precisely the failure mode our inner loop exhibits when the outer loop is absent. This reference does real analytical work: it connects the design database risk to a historical precedent and grounds Prediction 3. -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":52,"row":3,"rowSpan":14},{"role":"bullets","col":4,"span":52,"row":19,"rowSpan":20}],"accents":[{"type":"line","col":4,"span":52,"row":18,"rowSpan":1,"color":"2C3E50"},{"type":"dot","col":4,"span":2,"row":37,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":54,"span":2,"row":3,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":14,"leading":1.6},"bullets":{"size":13,"weight":500,"leading":1.5}},"bg":"FAF6EE","font":"Palatino"} -->
### Boundary Conditions

The fractal design framework applies under specific conditions. It does not apply universally, and naming the boundaries clarifies the contribution:

**Where it applies**:
- Quality is *partially formalizable*: metrics help but do not capture everything. Slide design, UI layout, data visualization, typographic composition.
- The artifact count exceeds human review capacity: 36 slides every 2 minutes requires automated screening.
- The evaluation instrument is *transparent*: explicit formulas that can be read, debugged, and revised. Black-box evaluators (neural aesthetic classifiers) cannot support the outer loop's diagnostic process.

**Where it does not apply**:
- Fully formalizable domains: if a linter can completely verify code style, no outer loop is needed. The inner loop suffices.
- Fully ineffable domains: if quality cannot be decomposed into any measurable dimensions (abstract art, emotional resonance), metrics are not worth building. The inner loop has nothing to optimize against.
- Single-artifact contexts: if you are designing one poster, not 36 slides, human review is feasible without automated screening. The inner loop adds overhead without value.
- Opaque evaluators: if the scoring model is a neural network, the outer loop cannot diagnose *why* a score diverges from perception. The framework requires transparency.

**Where the rubric conflates craft and taste**:
- The v17 case study demonstrates that automated metrics cannot distinguish between functional failures (low contrast = hard to read) and aesthetic choices (binary palette = intentional minimalism). The rubric penalizes both equally. A future direction is a *deck-type parameter* that adjusts metric thresholds based on the declared design intent — a post-Swiss brief should relax palette variety requirements while maintaining accessibility standards. The principle: accessibility is universal, aesthetics are contextual.

**Where it is uncertain**:
- At industrial scale (millions of artifacts, thousands of evaluators): the outer loop's reliance on individual human perception may not scale. Crowdsourced calibration is possible but untested in this framework.
- Across domains: the concentric loops were developed for visual design. Whether they transfer to writing, music, or code quality is plausible but undemonstrated.
- With vision-model evaluators: if a multimodal LLM replaces the formula-based rubric, the transparency condition weakens. The framework may need to accommodate semi-transparent instruments.

**What fractal design predicts that existing frameworks do not**:
The concentric loops framework makes three testable predictions. First: any AI design system with a fixed evaluation model will converge on the model's blind spots within 3-5 inner-loop iterations — the score will plateau while perceptible quality issues remain (Prediction 1: premature convergence). Second: the number of outer-loop iterations required to achieve score-perception alignment is proportional to the gap between measured and unmeasured quality dimensions — systems with narrow rubrics need more outer-loop calibration than systems with broad rubrics (Prediction 2: calibration proportionality). Third: the design database (institutional memory) will amplify whatever biases exist in the rubric at the time of database creation — if the rubric favors a particular layout archetype, future compositions will overweight that archetype (Prediction 3: bias amplification through institutional memory). These predictions are testable through replication with different systems, rubrics, and practitioners.

<!-- notes: The predictions serve two functions: they make the framework falsifiable (a reviewer can say "I ran this and Prediction 1 did not hold"), and they distinguish fractal design from generic iterative design. Ordinary iteration does not predict premature convergence, calibration proportionality, or bias amplification. The concentric loops framework does, because it has a structural theory of why each loop exists and what happens when loops are missing. This is the difference between a descriptive framework ("we iterated") and a predictive one ("we predict what happens when you iterate this way"). -->