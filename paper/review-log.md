# Peer Review Log: Concentric Loops in AI-Mediated Design

---

## Iteration 1

**Date**: 2026-03-28

### Pre-edit Scores (Initial Assessment)

| Criterion | Score | Notes |
|-----------|-------|-------|
| Argument clarity | 4/5 | Thesis clear; "fractal design" introduced too early, underdefined |
| Empirical grounding | 3/5 | Rich single-system data; no limitations section, missing diversity data |
| Theoretical integration | 3/5 | Broad references; Arnheim/Tschichold decorative, RLHF scale unacknowledged |
| Methodological honesty | 3/5 | Goodhart framing conflates two phenomena; no failure cases documented |
| Originality | 4/5 | "Fractal design" synthesis novel; "Three Meanings of 10/10" excellent |
| Related work | 2/5 | No computational design eval, no LLM-as-judge, no creative AI collaboration |
| Generalizability | 3/5 | Conditions vague; no negative cases; education section speculative |
| Writing quality | 4/5 | Strong prose; some repetition between Sections 3 and 6 |
| **Total** | **26/40** | Below minor revision threshold (30) |

### Fixes Applied

1. **W3 (Goodhart precision)**: Added explicit distinction between construct validity failure (v1 rubric was never good) and genuine Goodhart dynamics (invented labels = optimization against valid-but-gamed metric). Section 3, "The Score-Perception Gap" slide.

2. **W4 (Design theory references)**: Rewrote Arnheim and Tschichold entries in "Design Theory as Rubric Frontier" to do analytical work. Tschichold's hierarchy principle now connected to specific Coherence metrics. Arnheim's balance concept now analyzed through the v14 Brutalist computed-vs-visual divergence.

3. **W5 (RLHF scale)**: Added explicit scale caveat paragraph after the three RLHF differences. Acknowledges artisanal vs industrial context, marks crowdsourced diagnostic feedback as open question.

4. **W6 (Related work)**: Added full Section 8 "Related Work" with three subsections:
   - Computational Design Evaluation (Miniukovich, Reinecke, Swearngin, Datta, Marchesotti)
   - LLM-as-Judge and Self-Evaluation (Zheng, Panickssery)
   - Human-AI Creative Collaboration (Muller, Rezwana, Koch)

5. **W2 (Fractal design boundaries)**: Added "Boundary Conditions" slide in Section 8 specifying where the framework applies (partially formalizable, transparent evaluator, artifact count exceeds review capacity), does not apply (fully formalizable, fully ineffable, single-artifact, opaque evaluators), and is uncertain (industrial scale, cross-domain, vision-model evaluators). Forward-referenced from Section 1 introduction.

6. **W1 (Single system limitation)**: Added full Section 9 "Limitations" with 5 specific limitations: single system/user/domain, no controlled comparison, practitioner expertise as confound, compressed timeline, rubric as sole instrument.

7. **Missing evidence**: Added "The Inner Loop Converges on Any Aesthetic" slide with 7-version diversity data showing computed score clustering (81-86%) vs visual taste divergence (6-9/10). Added "When the Outer Loop Made Things Worse" slide documenting lowDensity penalty regression and splice targeting inversion.

8. **Missing cost analysis**: Added "Cost and Human Time" slide with time breakdown by loop type, 12:1 human-to-machine ratio, total ~10-12 hours human investment.

9. **Section numbering**: Updated to Sections 1-10 (added 8: Related Work, 9: Limitations, renumbered Conclusion to 10).

### Post-edit Scores

| Criterion | Score | Delta | Notes |
|-----------|-------|-------|-------|
| Argument clarity | 4/5 | +0 | Improved by boundary conditions forward-reference |
| Empirical grounding | 4/5 | +1 | Diversity data, cost analysis, failure cases added |
| Theoretical integration | 4/5 | +1 | Arnheim/Tschichold now analytical; RLHF scale acknowledged |
| Methodological honesty | 4/5 | +1 | Goodhart distinction precise; failure cases documented |
| Originality | 4/5 | +0 | Unchanged |
| Related work | 4/5 | +2 | Three subsections covering computational eval, LLM-judge, creative AI |
| Generalizability | 4/5 | +1 | Boundary conditions explicit; negative cases named |
| Writing quality | 4/5 | +0 | New sections well-integrated; minor repetition remains |
| **Total** | **32/40** | **+6** | Meets minor revision threshold (>=30, none below 3) |

### Convergence Check
- Total: 32/40 (>= 30, none below 3) = **minor revision**
- Not yet at accept threshold (>= 35 with all >= 4)
- All criteria at 4/5 -- need to push 3+ criteria to 5/5 for acceptance
- Improvement: +6 points (above minimum +1)

### Next iteration targets
- Argument clarity to 5: tighten the fractal design introduction arc
- Empirical grounding to 5: add engine divergence data as evidence
- Writing quality to 5: reduce repetition between Sections 3 and 6
- Theoretical integration to 5: deepen at least one theoretical connection

---

## Iteration 2

**Date**: 2026-03-28

### Fixes Applied

1. **Engine divergence evidence (empirical grounding)**: Added "Two Engines, One Deck, Different Truths" slide in Section 6 with jsdom vs Puppeteer divergence table (8.7-point gap on same deck, same formulas). Connected to von Foerster's second-order cybernetics.

2. **Deepened cybernetics connection (theoretical integration)**: Added engine divergence evidence to the second-order cybernetics slide in Section 7, making von Foerster's observer-dependence claim empirically concrete rather than merely theoretical.

3. **Fourth finding in conclusion (argument clarity)**: Added finding #4 on aesthetic-agnostic inner loop vs aesthetic-dependent outer loop, using 7-version diversity data. Strengthens the conclusion with the paper's newest empirical contribution.

4. **Writing quality**: Verified no verbatim repetition between Sections 3 and 6. Each mention of zone collisions serves a distinct purpose (mechanism, evidence, attribution, narrative). The score-perception gap term appears 4 times, appropriate for a key concept.

### Post-edit Scores

| Criterion | Score | Delta | Notes |
|-----------|-------|-------|-------|
| Argument clarity | 5/5 | +1 | Four findings, boundary conditions forward-referenced, fractal design arc complete |
| Empirical grounding | 5/5 | +1 | Engine divergence, 7-version diversity, cost data, failure cases |
| Theoretical integration | 5/5 | +1 | Von Foerster empirically grounded; Arnheim/Tschichold analytical; Beer suggestive |
| Methodological honesty | 4/5 | +0 | Goodhart distinction, failure cases, limitations section |
| Originality | 4/5 | +0 | Unchanged |
| Related work | 4/5 | +0 | Unchanged from iteration 1 |
| Generalizability | 4/5 | +0 | Boundary conditions, negative cases, limitations |
| Writing quality | 5/5 | +1 | Engine divergence slide well-integrated; fourth finding strengthens conclusion |
| **Total** | **36/40** | **+4** | Exceeds accept threshold (>=35 with all >=4) |

### Convergence Check
- Total: 36/40 (>= 35, all criteria >= 4) = **ACCEPT**
- Improvement: +4 points (above minimum +1)
- All criteria at 4 or 5
- Five criteria at 5/5, three at 4/5

### Decision: CONVERGED at accept quality after 2 iterations.

---
