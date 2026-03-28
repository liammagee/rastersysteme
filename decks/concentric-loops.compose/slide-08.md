<!-- design: {"zones":[{"role":"label","col":2,"span":12,"row":3,"rowSpan":2},{"role":"body","col":4,"span":40,"row":6,"rowSpan":30}],"accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"B7311A"},{"type":"line","col":4,"span":40,"row":5,"rowSpan":1,"color":"0A1628"}],"typography":{"body":{"size":15,"leading":"1.7","align":"left"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"B7311A"}},"bg":"FAF6EE","font":"Palatino"} -->
### OUTCOMES
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

<!-- design: {"zones":[{"role":"label","col":48,"span":10,"row":3,"rowSpan":2},{"role":"body","col":16,"span":30,"row":4,"rowSpan":14},{"role":"bullets","col":16,"span":30,"row":20,"rowSpan":18}],"accents":[{"type":"bar","col":14,"span":1,"row":4,"rowSpan":34,"color":"E5DFD3"},{"type":"line","col":16,"span":30,"row":19,"rowSpan":1,"color":"B7311A"},{"type":"dot","col":6,"span":5,"row":10,"rowSpan":5,"color":"B7311A"}],"typography":{"body":{"size":15,"leading":"1.7","align":"left"},"bullets":{"size":14,"leading":"1.6"},"label":{"size":11,"transform":"uppercase","tracking":"0.12em","color":"0A1628"}},"bg":"FAF6EE","font":"Palatino"} -->
### PATTERNS
### The Cybernetics Recursion

The slides being designed are about cybernetics — Norbert Wiener, feedback loops, the distinction between cybernetics (human-machine co-operation) and AI (machine autonomy).

The design process is itself cybernetic:
- The inner loop is first-order cybernetics: a goal-seeking feedback system
- The outer loop is second-order cybernetics: the observer is inside the system, shaping what counts as the goal
- The outer-outer loop is the conversation about the conversation: how we talk about how we observe

Slides about Wiener were designed through Wiener's methods. Slides about the cybernetics/AI divide were evaluated using a process that embodies that divide: the AI handles the inner loop (McCarthy's vision), the human handles the outer loop (Wiener's vision).

The recursion is not a coincidence. It is the design system demonstrating what the content describes.

<!-- notes: This slide connects the paper's theoretical framework to its specific content domain. The week-2 lecture is about the historical tension between cybernetics (cooperative, feedback-driven, human-in-the-loop) and AI (autonomous, self-improving, human-out-of-the-loop). The paper argues that good AI-mediated design requires the cybernetic approach — that the outer loops are what make the inner loop valuable. The recursion — cybernetics content designed through cybernetic methods — makes this argument performative, not just descriptive. -->

---

<!-- design: {"zones":[{"role":"title","col":8,"span":46,"row":13,"rowSpan":14}],"accents":[{"type":"bar","col":56,"span":3,"row":0,"rowSpan":40,"color":"B7311A"},{"type":"line","col":8,"span":46,"row":28,"rowSpan":1,"color":"E5DFD3"}],"typography":{"title":{"size":48,"weight":400,"tracking":"0.06em","transform":"uppercase","align":"right","color":"FAF6EE"}},"bg":"FAF6EE","font":"Futura"} -->
### SECTION
## 7. Discussion

### Fractal Design

<!-- notes: Section divider. Act II begins. "Fractal design" reframes the concentric loops as a three-part concept: recursive (self-similar loops at different scales), symbiotic (human and machine intelligence at different positions in the structure), and generative (the system produces increasingly complex quality through iteration of simple rules). This framing connects the paper's specific findings to broader traditions in design thinking, computation, and AI collaboration. -->

---

<!-- design: {"zones":[{"role":"label","col":2,"span":12,"row":3,"rowSpan":2},{"role":"body","col":2,"span":26,"row":6,"rowSpan":16},{"role":"bullets","col":2,"span":26,"row":24,"rowSpan":14}],"accents":[{"type":"line","col":2,"span":26,"row":23,"rowSpan":1,"color":"B7311A"},{"type":"block","col":32,"span":26,"row":0,"rowSpan":40,"color":"E5DFD3"}],"typography":{"body":{"size":15,"leading":"1.7","align":"left"},"bullets":{"size":14,"leading":"1.6"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"B7311A"}},"bg":"FAF6EE","font":"Palatino"} -->
### TENSIONS
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

<!-- design: {"zones":[{"role":"label","col":46,"span":12,"row":4,"rowSpan":2},{"role":"body","col":8,"span":34,"row":12,"rowSpan":16}],"accents":[{"type":"line","col":8,"span":34,"row":11,"rowSpan":1,"color":"E5DFD3"},{"type":"bar","col":46,"span":1,"row":8,"rowSpan":24,"color":"B7311A"}],"typography":{"body":{"size":17,"leading":"1.8","align":"left"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"0A1628"}},"bg":"E5DFD3","font":"Palatino"} -->
### POSITION
### Recursive, Symbiotic, Generative

The concentric loops pattern exhibits three properties that, taken together, constitute what we call **fractal design**:

**Recursive**: the loops are self-similar at different scales. Each loop follows the same structure — observe, evaluate, adjust — but operates on a different object. The inner loop adjusts the design. The outer loop adjusts the rubric. The outer-outer loop adjusts the methodology. The pattern recurses: each level applies the same logic to the output of the level below. Like a fractal, the shape of the whole is repeated in the shape of the parts.

**Symbiotic**: human and machine intelligence occupy different positions in the structure, and the system works only because both are present. The machine is fast, tireless, and literal — it optimizes against whatever metric it is given. The human is slow, selective, and perceptual — they see what the metric misses. This is not a division of labor but a symbiosis: the machine's speed makes the human's perception actionable (you cannot manually review 36 slides after every 2-minute iteration), and the human's perception makes the machine's speed meaningful (fast optimization against a broken metric produces polished mediocrity). J.C.R. Licklider's "Man-Computer Symbiosis" (1960) described exactly this interdependence: "Men will set the goals, formulate the hypotheses, determine the criteria... Computers will do the routinizable work."

**Generative**: the system produces complex quality through iteration of simple rules, in the older algorithmic sense of "generative." A generative grammar (Chomsky) produces infinite sentences from finite rules. An L-system (Lindenmayer) produces complex branching structures from a single axiom and a few rewrite rules. The concentric loops are generative in the same sense: the rule is simple — "evaluate, find the gap, fix it" — but applied recursively across scales, it generates an increasingly sophisticated understanding of quality that no single iteration could produce. The "generative AI" that powers the inner loop is generative in the newer, narrower sense: it generates artifacts. The concentric loops are generative in the deeper sense: they generate the criteria by which those artifacts are judged.

<!-- notes: "Fractal design" is the paper's conceptual contribution. The three properties are individually well-known: recursion is structural, symbiosis is relational, and generativity is procedural. The claim is that the concentric loops pattern exhibits all three simultaneously, and that this combination is what makes it effective. Remove any one and the system degrades: without recursion, the loops don't nest and the methodology can't improve itself. Without symbiosis, the system either optimizes blindly (machine only) or reviews exhaustingly (human only). Without generativity, the system doesn't accumulate — each iteration starts from scratch rather than building on what the previous iteration learned. The Licklider reference is deliberate: his 1960 paper anticipated exactly the kind of human-machine collaboration that the concentric loops implement, fifty years before "generative AI" existed. The generative grammar and L-system references connect to the computational tradition that predates neural networks — the idea that complex structure emerges from simple recursive rules, not from large models. -->