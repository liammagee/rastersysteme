<!-- design: {"zones":[{"role":"body","col":2,"span":26,"row":2,"rowSpan":36}],"accents":[{"type":"line","col":30,"span":1,"row":2,"rowSpan":36,"color":"E8E2D6"},{"type":"dot","col":34,"span":2,"row":4,"rowSpan":2,"color":"B7311A"},{"type":"dot","col":34,"span":2,"row":34,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":13,"leading":1.7}},"bg":"FAF6EE","font":"Palatino"} -->
### The Three Loops

```
 OUTER-OUTER LOOP                                    cadence: days/weeks
 ┌─────────────────────────────────────────────────────────────────────┐
 │  "Is our process of evaluating design itself improving?"           │
 │                                                                     │
 │   OUTER LOOP                                      cadence: hours    │
 │   ┌───────────────────────────────────────────────────────────┐     │
 │   │  "Does the rubric match what the human sees?"             │     │
 │   │                                                           │     │
 │   │   INNER LOOP                              cadence: mins   │     │
 │   │   ┌─────────────────────────────────────────────────┐     │     │
 │   │   │  "Is this deck better than the last iteration?" │     │     │
 │   │   │                                                 │     │     │
 │   │   │  evaluate ──► fix ──► render ──► re-evaluate    │     │     │
 │   │   │       ▲                              │          │     │     │
 │   │   │       └──────── converge? ◄──────────┘          │     │     │
 │   │   └─────────────────────────────────────────────────┘     │     │
 │   │        ▲                                                  │     │
 │   │        │  score-perception gap detected                   │     │
 │   │        ▼                                                  │     │
 │   │   human observes ──► rubric updated ──► re-evaluate       │     │
 │   └───────────────────────────────────────────────────────────┘     │
 │        ▲                                                            │
 │        │  methodology gap detected                                  │
 │        ▼                                                            │
 │   sampling changed, new instruments built, feedback protocol revised│
 └─────────────────────────────────────────────────────────────────────┘
```

<!-- notes: This is the core diagram. ASCII is deliberate — it matches the wireframe tool's visual language. The nesting shows containment: the inner loop runs inside the outer loop's context, and the outer loop runs inside the outer-outer loop's methodology. The arrows show what triggers each loop: convergence triggers the inner loop exit, a score-perception gap triggers the outer loop, and a methodology gap triggers the outer-outer loop. Each trigger is a different kind of observation: computational (convergence), perceptual (gap between score and visual reality), and epistemological (gap in the observation process itself). -->

---

<!-- design: {"zones":[{"role":"body","col":18,"span":38,"row":4,"rowSpan":30}],"accents":[{"type":"bar","col":0,"span":14,"row":0,"rowSpan":40,"color":"F0EBE0"},{"type":"dot","col":6,"span":2,"row":18,"rowSpan":2,"color":"B7311A"},{"type":"line","col":18,"span":38,"row":3,"rowSpan":1,"color":"2C3E50"}],"typography":{"body":{"size":14,"leading":1.65}},"bg":"FAF6EE","font":"Palatino"} -->
### Intellectual Debts

This is not a new idea. It has appeared in different vocabularies:

| Framework | Inner Loop | Outer Loop | Outer-Outer |
|-----------|-----------|-----------|-------------|
| **Cybernetics** (Wiener, 1948) | First-order: goal-seeking control | Second-order: observer in the system | Conversation about the conversation |
| **Organizational learning** (Argyris, 1977) | Single-loop: correct actions | Double-loop: question governing variables | Deutero-learning: learn how to learn |
| **Reflective practice** (Schon, 1983) | Technical rationality: apply rules | Reflection-in-action: surprise and puzzlement | Reflection on reflection-in-action |
| **RLHF** (Christiano et al., 2017) | RL optimization against reward model | Human feedback recalibrates reward model | Reward model architecture evolves |
| **Generative systems** (Chomsky; Lindenmayer) | Generate artifacts from rules | Generate rules from observation | Generate the rule-generation process |
| **Man-computer symbiosis** (Licklider, 1960) | Machine: routinizable optimization | Human: goals, hypotheses, criteria | Both: evolving the collaboration itself |
| **Design formalization** (Muller-Brockmann; Itten; Arnheim) | Apply formalized rules (grids, color math, type ratios) | Perceive what rules can't capture (balance, taste, communicability) | Formalize previously-intuitive qualities |

What is new is the empirical account — and the synthesis. We call the pattern **fractal design**: recursive (self-similar loops at every scale), symbiotic (human and machine intelligence at different positions), and generative (producing criteria, not just artifacts). We ran these loops on a real design system over 8 iterations and recorded what happened. The framework applies specifically to domains where quality is partially but not fully formalizable — where metrics help but do not capture everything. Its boundary conditions, and the cases where it does not apply, are examined in Section 8.

<!-- notes: The table now includes the generative and symbiotic traditions alongside the cybernetic and learning theory traditions. This previews the "fractal design" concept that appears fully in Section 7. The generative row connects to Chomsky's generative grammars and Lindenmayer's L-systems — the idea that complex structure emerges from simple recursive rules. The Licklider row connects to the oldest articulation of human-machine symbiosis. Both are older than "generative AI" and provide deeper roots for the paper's argument. The term "fractal design" is introduced here in passing and developed later — the reader should notice it, not yet understand it fully. -->

---

<!-- design: {"zones":[{"role":"title","col":12,"span":36,"row":13,"rowSpan":10},{"role":"label","col":12,"span":16,"row":25,"rowSpan":2}],"accents":[{"type":"bar","col":0,"span":60,"row":0,"rowSpan":40,"color":"0A1628"},{"type":"dot","col":50,"span":2,"row":8,"rowSpan":2,"color":"B7311A"},{"type":"line","col":12,"span":36,"row":24,"rowSpan":1,"color":"2C3E50"}],"typography":{"title":{"size":52,"weight":700,"leading":1.05,"color":"FAF6EE"},"label":{"size":11,"weight":400,"transform":"uppercase","tracking":"0.14em","color":"E8E2D6"}},"bg":"FAF6EE","font":"Futura"} -->
### SECTION TWO
## 2. The Inner Loop

### Evaluate — Fix — Render

<!-- notes: Section divider. We now describe the machinery. This section is deliberately mechanical — the point is that the inner loop is a well-behaved optimization process, and that its well-behavedness is precisely its limitation. -->

---

<!-- design: {"zones":[{"role":"title","col":4,"span":28,"row":2,"rowSpan":5},{"role":"body","col":4,"span":36,"row":9,"rowSpan":28}],"accents":[{"type":"line","col":4,"span":36,"row":8,"rowSpan":1,"color":"E8E2D6"},{"type":"dot","col":44,"span":2,"row":3,"rowSpan":2,"color":"B7311A"}],"typography":{"title":{"size":36,"weight":600,"tracking":"-0.01em"},"body":{"size":14,"leading":1.65}},"bg":"F0EBE0","font":"Palatino"} -->
### How the Rubric Works

The automated evaluator scores each deck across **6 computed dimensions**, using 11 metrics:

| Dimension | What it measures | Example metrics |
|-----------|-----------------|-----------------|
| **Grid Utilization** | Are layouts varied and intentional? | Unique archetypes, non-default zone positions, consecutive layout runs |
| **Color Harmonics** | Is the palette coherent with controlled transitions? | Background variety, transition distances, chromatic smoothness |
| **Coherence & Variance** | Does the deck feel unified but not monotonous? | Typography hierarchy, content density rhythm, accent saturation |
| **Content Fidelity** | Is the source content preserved and visible? | Empty zones, table truncations, clipped content, invented labels |
| **Image Integration** | Are images placed without conflicts? | Text-on-image overlaps, placement variety, zone collisions |
| **Accessibility** | Does the deck meet WCAG standards? | Contrast ratios, font sizes, alt text quality |

Each dimension scores 0-10. Total: 60 points.

<!-- notes: The rubric is deliberately multidimensional — a single "quality score" would hide too much. But even 6 dimensions can mask problems: a deck can score 9/10 on Grid Utilization by using many layouts, even if those layouts collide with each other. The rubric evolved to catch this (zone collision detection was added at v6), but only after the outer loop identified it. -->

---

<!-- design: {"zones":[{"role":"title","col":30,"span":26,"row":2,"rowSpan":5},{"role":"body","col":30,"span":26,"row":9,"rowSpan":26}],"accents":[{"type":"bar","col":0,"span":26,"row":0,"rowSpan":40,"color":"E8E2D6"},{"type":"dot","col":12,"span":2,"row":18,"rowSpan":2,"color":"B7311A"},{"type":"line","col":30,"span":26,"row":8,"rowSpan":1,"color":"2C3E50"}],"typography":{"title":{"size":36,"weight":700,"align":"right"},"body":{"size":14,"leading":1.65}},"bg":"FAF6EE","font":"Palatino"} -->
### The Refine-Step Pattern

Each iteration follows a fixed protocol:

1. **Evaluate**: run the rubric, produce a per-dimension scorecard
2. **Identify**: sort dimensions by score, pick the bottom 2-3
3. **Fix**: edit the composed markdown targeting weak dimensions
4. **Render**: regenerate the HTML from the updated composition
5. **Re-evaluate**: check if scores improved
6. **Converge**: stop if all dimensions >= target or returns are diminishing

This cycle runs every 2 minutes via `/loop`. It is idempotent — the same input always produces the same diagnostic. It requires no human intervention.

<!-- notes: The refine-step pattern is deliberately simple. Each step is atomic and reversible. The cycle is stateless — it reads the current deck, evaluates it, and proposes changes. This makes it safe to run unattended. But "safe to run unattended" and "produces good results unattended" are different claims. The inner loop is safe. Whether it produces good results depends entirely on the rubric it's optimizing against. -->