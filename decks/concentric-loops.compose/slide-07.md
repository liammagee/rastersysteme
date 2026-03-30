<!-- design: {"zones":[{"role":"body","col":8,"span":44,"row":8,"rowSpan":24}],"accents":[{"type":"line","col":8,"span":44,"row":7,"rowSpan":1,"color":"E8E2D6"},{"type":"dot","col":4,"span":2,"row":10,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":4,"span":2,"row":28,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":15,"leading":1.65}},"bg":"F0EBE0","font":"Palatino"} -->
### The Evaluation Instruments

Three instruments, each with different capabilities:

| Instrument | What it sees | What it misses |
|------------|-------------|---------------|
| **rubric-jsdom.js** | DOM structure, text content, element sizing | CSS-computed styles, visual rendering, images |
| **rubric-headless.js** | Computed styles, actual layout, contrast | Slow; requires Puppeteer and Chrome |
| **visual-audit.js** | Bounding box collisions, overflow, broken images | Per-element; misses compositional quality |

The shared scoring module (`rubric-scores.js`) normalizes results from any engine into the same 6-dimension scorecard. This was itself an outer-outer loop decision: two engines producing different scores for the same deck was confusing and undermined trust in the evaluation.

<!-- notes: The instrument table is important because it shows that every evaluation tool has blind spots. No single instrument sees everything. This is by design — jsdom is fast but shallow, Puppeteer is thorough but slow, visual-audit is precise but narrow. The outer loop works by having the human see things that none of these instruments catch. The shared scoring module was an architectural response to a methodology problem: when two engines disagree, which one is right? The answer was to unify the scoring formula so disagreements are about data, not formulas. -->

---

<!-- design: {"zones":[{"role":"bullets","col":34,"span":22,"row":4,"rowSpan":14},{"role":"body","col":4,"span":26,"row":4,"rowSpan":24}],"accents":[{"type":"line","col":32,"span":1,"row":4,"rowSpan":32,"color":"2C3E50"},{"type":"dot","col":56,"span":2,"row":4,"rowSpan":2,"color":"B7311A"},{"type":"line","col":4,"span":26,"row":30,"rowSpan":1,"color":"E8E2D6"}],"typography":{"bullets":{"size":14,"weight":500,"leading":1.55},"body":{"size":14,"leading":1.65}},"bg":"FAF6EE","font":"Palatino"} -->
### The Commit Protocol as Design Rationale

Every rubric revision is committed separately with a structured message:

```
rubric: v6 — shared scoring, zone collision in both engines

Outer loop feedback: "Need to evaluate every slide"
Before: 88%
After: 88% (same score, new data)
```

This is a lightweight form of design rationale capture (MacLean et al., 1991). Each commit records:
- **What** changed (the rubric formula)
- **Why** it changed (the user's feedback)
- **What effect** it had (before/after scores)

The git log becomes a design methodology journal. Each entry is a calibration step driven by human feedback. The sequence is readable as a narrative of the system learning to see.

<!-- notes: MacLean's QOC (Questions, Options, Criteria) framework was designed for capturing design rationale in HCI. Our commit protocol is a simpler but compatible format. The key innovation is that the "question" is always the same — "does the rubric match human perception?" — and the commit captures the specific instance of mismatch and its resolution. Over 8 iterations, the git log tells the story of the rubric learning to see what the human sees. This is reproducible: anyone can read the log and understand why each rubric change was made. -->

---

<!-- design: {"zones":[{"role":"body","col":16,"span":40,"row":3,"rowSpan":34}],"accents":[{"type":"bar","col":0,"span":12,"row":0,"rowSpan":40,"color":"0A1628"},{"type":"dot","col":5,"span":2,"row":18,"rowSpan":2,"color":"B7311A"},{"type":"line","col":16,"span":40,"row":2,"rowSpan":1,"color":"2C3E50"}],"typography":{"body":{"size":13,"leading":1.7,"color":"2C3E50"}},"bg":"FAF6EE","font":"Palatino"} -->
### What the Rubric Sees and What It Doesn't

The rubric's six dimensions encode specific design theories — mostly implicitly:

| Dimension | Design theory embedded | Design theory missing |
|-----------|----------------------|----------------------|
| **Grid Utilization** | Muller-Brockmann's grid systems: zone variety, asymmetric balance, non-default positioning | Golden ratio proportions, rule of thirds, Gestalt grouping of related zones |
| **Color Harmonics** | Itten's chromatic arc, Albers' interaction of color (transitions between adjacent slides) | Color harmony systems (complementary, triadic), semantic color (does red mean warning?), mood alignment |
| **Coherence** | Typographic hierarchy (Weingart's tension between scale extremes), content density rhythm | Bringhurst's modular scale (mathematical ratio between sizes), visual rhythm as distinct from content rhythm |
| **Content Fidelity** | Tufte's data-ink ratio (every element carries information), Lupton's content preservation | Semantic loss (is the *meaning* preserved, not just the text?), information hierarchy |
| **Image Integration** | Figure-ground relationship (Gestalt), layered composition | Focal point hierarchy, visual weight distribution, image-content semantic relevance |
| **Accessibility** | WCAG as formalized color theory (contrast as mathematical relationship) | Readability at projection distance, cognitive load, attention management |

Three dimensions are defined in the rubric but permanently null: **Communicability** (does the design help you understand faster?), **Taste** (does it show design-historical awareness?), and **Balance** (does it feel right?). These are the dimensions that require human perception — the outer loop.

The gap between what the rubric measures and what design theory considers important is not accidental. It is a map of the boundary between what can be automated and what cannot. The measured dimensions correspond to design theories that can be formalized (grids, color math, typographic ratios). The unmeasured dimensions correspond to theories that resist formalization (Gestalt perception, aesthetic judgment, communicative intent).

This boundary is itself an object of study for the outer-outer loop: as the rubric evolves, does the boundary shift? Can Gestalt proximity be formalized (distance between zone centers)? Can visual balance be approximated (luminance-weighted center of gravity)? Each attempt to formalize a previously-intuitive quality is an outer-outer loop iteration.

<!-- notes: This slide does two things: it grounds the rubric in named design theories (giving the audience specific references), and it makes explicit what the rubric can't see. The table format lets the audience scan quickly. The key insight is the final paragraph: the boundary between measurable and unmeasurable design quality is itself moving, and the concentric loops are the mechanism that moves it. Muller-Brockmann's grid systems are fully formalized in the 60-column grid. Itten's color theory is partially formalized in the chromatic arc metric. Gestalt principles are not yet formalized at all. The progression from "fully formal" to "not formal" maps to the progression from inner-loop-solvable to outer-loop-required. -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":52,"row":3,"rowSpan":8},{"role":"bullets","col":4,"span":52,"row":14,"rowSpan":24}],"accents":[{"type":"line","col":4,"span":52,"row":12,"rowSpan":1,"color":"E8E2D6"},{"type":"dot","col":54,"span":2,"row":14,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":54,"span":2,"row":34,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":14,"leading":1.6},"bullets":{"size":14,"weight":500,"leading":1.55}},"bg":"F0EBE0","font":"Palatino"} -->
### Design Theory as Rubric Frontier

The history of design theory can be read as a progressive formalization of intuition:

- **Muller-Brockmann** (1961): formalized layout into grid systems — now fully automatable
- **Itten** (1961): formalized color relationships into contrasts and harmonies — partially automatable (the rubric measures transition distances but not semantic color)
- **Tschichold** (1928): formalized typography into hierarchical rules. The rubric's Coherence dimension directly implements Tschichold's principle that a page should contain no more than two type families in a clear size hierarchy. When the rubric penalizes decks where title and body sizes are within 4px of each other, it is enforcing Tschichold's rule that typographic differentiation must be unambiguous. What Tschichold could not formalize — whether the hierarchy *communicates* effectively at projection distance — remains an outer-loop judgment.
- **Gestalt psychologists** (1920s-): described perception principles (proximity, closure, figure-ground) — formalizable in principle (zone proximity = distance between centers) but not yet implemented
- **Arnheim** (1954): described visual balance as perceptual weight distribution — the sense that a composition "holds together" or "tips" to one side. This is the clearest example of a design quality that resists formalization. The rubric's visual-utilization metric (percentage of slide area occupied by content zones) is a crude proxy for Arnheim's balance: a slide where all content clusters in the top-left quadrant scores low on utilization but the metric cannot distinguish "unbalanced" from "deliberately asymmetric." When the rubric scored v14 Brutalist at 85% computed but 9/10 visual taste, the gap was precisely Arnheim's point: balance is perceptual, not geometric.
- **Tufte** (1983): formalized information design into data-ink ratio — partially automatable (content fidelity checks empty zones but not information density)

Each formalization made a previously-intuitive quality measurable. Each moved a design judgment from the outer loop (human perception) to the inner loop (automated metric). The rubric's evolution recapitulates this history in miniature: the move from absence-of-bad to presence-of-good is the move from checking rules (Muller-Brockmann's grid) to assessing perception (Arnheim's balance).

The remaining frontier — communicability, taste, balance — may require vision models that can approximate human perception. Or it may require accepting that some design qualities are irreducibly perceptual, accessible only through the outer loop. The concentric loops framework accommodates both possibilities: formalize what you can, perceive what you must, and continuously renegotiate the boundary.

<!-- notes: This slide connects design history to the paper's thesis. The key move is reading the history of design theory as a progressive formalization — each theorist made something measurable that was previously intuitive. The rubric's evolution follows the same trajectory, just faster. The audience should come away with the sense that the rubric's limitations are not failures of implementation but reflections of where design theory itself hits the limits of formalization. The specific references (Muller-Brockmann, Itten, Tschichold, Gestalt, Arnheim, Tufte) are chosen because they're canonical and map cleanly to rubric dimensions. -->

---

<!-- design: {"zones":[{"role":"title","col":0,"span":58,"row":14,"rowSpan":10},{"role":"label","col":4,"span":14,"row":26,"rowSpan":2}],"accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"B7311A"},{"type":"bar","col":58,"span":2,"row":0,"rowSpan":40,"color":"B7311A"},{"type":"line","col":4,"span":52,"row":25,"rowSpan":1,"color":"2C3E50"}],"typography":{"title":{"size":52,"weight":700,"leading":1.05,"align":"center","color":"FAF6EE"},"label":{"size":11,"weight":400,"transform":"uppercase","tracking":"0.14em","color":"E8E2D6"}},"bg":"FAF6EE","font":"Futura"} -->
### SECTION SIX
## 6. Results

### week-2 Through the Loops

<!-- notes: Section divider. This section presents the empirical data. The key message is not "scores went up" but "what kind of improvement happened at each stage, and who or what caused it." -->