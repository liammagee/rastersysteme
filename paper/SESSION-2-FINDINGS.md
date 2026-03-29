# Session 2 Findings: What We've Learned About Slide Deck Design

## Summary

This session extended the concentric loop system across three axes: (1) the rubric now measures splice image quality, (2) the inner loop was tested across 7 aesthetically diverse versions proving it is aesthetic-agnostic, and (3) visual scoring revealed the formalization frontier — where computed metrics diverge from human perception.

---

## 1. What changed in the PROMPT/BRIEF

**Before**: The compose prompt generated design directives with a fixed creative direction. The brief was a single aesthetic statement.

**After**: The brief is now one of 7+ distinct aesthetic systems (Literary, Bauhaus, Botanical, Weingart, Brutalist, Pop, Terminal). Each brief is a complete design language: palette, typography, grid philosophy, accent strategy. The inner loop converges on ANY brief — proving the prompt defines the *direction*, the rubric defines the *floor*.

**Key insight**: The brief should specify what makes a design DISTINCTIVE, not what makes it CORRECT. Correctness (accessibility, zone integrity, content completeness) comes from the rubric. The brief is the taste layer.

---

## 2. What changed in the RUBRIC

### New metrics added (rubric-scores.js, rubric-jsdom.js, rubric-headless.js)

| Metric | What it measures | Penalty | Tier |
|--------|-----------------|---------|------|
| `spliceCount` | Are images spliced at all? | -2 if zero | Inclusion |
| `spliceVisibleCount` | Images with opacity >= 0.4 | | Visibility |
| `spliceAtmosphericCount` | Images with opacity 0.15-0.40 | | Atmospheric (new tier) |
| `lowOpacitySpliceTotal` | Images with opacity < 0.15 | -1.5 if >50% of splices | Invisible |
| `splicePlacementTypes` | Variety of placement modes | -1 if <=2 types with >4 splices | Monotony |

### Three-tier visibility model

The original binary (visible/invisible at 0.4) was wrong. Background-mode images at 0.22 opacity serve a real design purpose (atmospheric texture) even though they're not "visible" in the traditional sense. The three tiers:

- **Invisible** (< 0.15): Penalized. These are `subtle`-scale watermarks — technically present but perceptually absent.
- **Atmospheric** (0.15-0.40): Accepted. Background textures, luminosity blends, tonal washes.
- **Visible** (>= 0.40): Fully counted. Inset images, panels, strips.

This is a rubric calibration that came DIRECTLY from outer-loop observation ("background images are valid design, not invisible"). The user saw what the metric couldn't: atmospheric texture is a design CHOICE, not a failure.

### What the rubric still can't measure

The visual-only dimensions (communicability, taste, layout balance) require vision assessment. This session scored them manually across 7 versions. The scores revealed:

- **Taste diverges from computed metrics.** v15 Pop scores highest computed (86%) but lowest taste (6/10). v14 Brutalist scores highest taste (9/10) but lower computed.
- **This divergence IS the paper's central argument.** Computed metrics capture "absence-of-bad" (no collisions, no contrast errors). Taste captures "presence-of-good" (is the grid discipline visible? is there restraint?).

---

## 3. What changed in the EVALUATION pipeline

### Screenshot-vision integration

The `evaluate.js` pipeline now has 4.5 phases:

1. **jsdom fast-check** (< 1s, computed)
2. **Puppeteer headless** (screenshots + computed)
3. **Phase 2.5: screenshot-vision** (NEW — sends sampled screenshots to Anthropic API for communicability/taste/balance scoring)
4. **Visual audit** (collision detection)
5. **Merged assessment** (confidence-weighted)

The screenshot-vision evaluator was already implemented but never wired in. The buffer/path bug (images from file paths lacked `.buffer` property) and the missing phase in evaluate.js meant visual dimensions were always null.

### Agent architecture

Three agents operationalize the three loops:

| Agent | Loop | Model | What it does |
|-------|------|-------|-------------|
| `splice-evaluator` | Quality gate | Sonnet | Splice → eval → audit → report |
| `inner-loop` | Inner | Opus | Evaluate → fix directives → re-render → re-splice → converge |
| `outer-loop` | Outer | Opus | Compare scores to visual reality → fix rubric code |

---

## 4. What changed in the ITERATIVE DESIGN PROCESS

### The 80% minimum rule

Established by user: "back yourself, don't give up below 80%." This prevents premature stopping and forces fixing real issues. v13 Weingart started at 63% and reached 83% in 3 iterations — the radical aesthetic survived intact because the fixes were structural (zone collisions, consecutive backgrounds), not aesthetic.

### Aesthetic-agnostic convergence

The inner loop produces the same convergence shape regardless of aesthetic direction:
- **Iteration 1**: Largest gain (+4-6 pts). Structural fixes.
- **Iteration 2**: Moderate gain (+2-4 pts). Secondary fixes.
- **Iteration 3**: Diminishing returns (<2 pts). Convergence.

This shape appeared identically across Literary (v10: 58→81%), Weingart (v13: 63→83%), Brutalist (v14: initial→85%), and Pop (v15: initial→86%). The aesthetic doesn't affect convergence rate — only the starting point varies.

### Fractal iteration

The concentric loop pattern appeared at the TOOL level, not just the design level. The splice algorithm went through its own outer loop:

```
User: "images only where existing images exist"
  → Fix: skip content-image slides
User: "still getting conflicts on slide 27"
  → Fix: tighter corner collision detection
User: "background images are valid"
  → Fix: three-tier visibility model
```

Each fix was triggered by human perception, not rubric scores. The methodology is fractal — it appears at every scale.

---

## 5. Where this fits in the paper

### Section 3 (The Outer Loop) — NEW case study

**"Case Study: Invisible Splices"** — extends the existing splice invisibility case study with the full three-tier resolution. The dead-code discovery (`lowOpacitySplice` calculated but never exported) is a perfect example of metrics-as-theater: the code LOOKED like it measured splice visibility, but it didn't.

### Section 6 (Results) — NEW data

**"Cross-Version Convergence"** — the 7-version comparison table is the strongest empirical evidence that the inner loop is aesthetic-agnostic. The computed-visual divergence table (v15 highest computed, lowest taste) is the strongest evidence for the formalization frontier.

### Section 7 (Discussion) — NEW argument

**"The Formalization Frontier"** — rename/extend "The Remaining Frontier" conclusion. The taste divergence data proves there IS a boundary between what automated metrics can capture and what requires human perception. But the boundary is NOT fixed — each outer-loop iteration pushes it forward (the three-tier model formalized something that was previously purely perceptual).

### Section 5 (Tools) — NEW architecture

**"Agent Architecture"** — the three agents as concentric loop operationalization. The agents encode the methodology as reusable automation, but the outer-loop agent still requires human judgment as INPUT. You can automate the PROCESS of calibration, but not the PERCEPTION that triggers it.

### Section 4 (Outer-Outer Loop) — NEW example

**"Fractal Iteration"** — the splice algorithm's own outer loop demonstrates the pattern is scale-invariant. The methodology doesn't just apply to deck design — it applies to every tool in the pipeline.
