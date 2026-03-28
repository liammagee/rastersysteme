# Design Paper: Concentric Loops in AI-Mediated Design

## Paper TODO

This spec is written for another agent to execute. Be explicit about structure, content, and rendering.

### Overview

A design research paper documenting the methodology of iterative AI-mediated slide design using three concentric feedback loops. The paper itself should be a demonstration of the process it describes — a rastersysteme HTML slide deck rendered from this spec.

### Three Concentric Loops

```
OUTER-OUTER LOOP: Methodological Evolution
  │  "How do we think about thinking about design?"
  │  Captures: evolution of the rubric, the methodology itself, the feedback protocols
  │  Cadence: across sessions/weeks
  │  Artefact: RUBRIC-CHANGELOG.md, METHODOLOGY.md, git commit history
  │  Question: "Is our process of evaluating design itself improving?"
  │
  └── OUTER LOOP: Rubric Calibration + Human Review
        │  "Does the rubric match what the human sees?"
        │  Captures: user feedback, rubric blind spots, score-vs-perception gaps
        │  Cadence: per design generation
        │  Artefact: wireframe vs screenshot comparisons, qualitative feedback
        │  Question: "Is the rubric honest?"
        │
        └── INNER LOOP: Automated Design Refinement
              "Make the scores go up."
              Captures: per-dimension scores, design directive edits, convergence
              Cadence: every 2 minutes (via /loop)
              Artefact: scorecard JSON, composed markdown, rendered HTML
              Question: "Is this slide deck better than the last iteration?"
```

### Paper Structure

1. **Introduction: The Problem of Automated Design Quality**
   - AI can generate slide designs but can't judge their quality
   - The rubric-as-judge pattern: automated evaluation that grades its own output
   - The fundamental flaw: a system grading itself converges on what it can measure, not what matters
   - Thesis: human-in-the-loop at the methodological level, not just the design level

2. **The Inner Loop: Evaluate-Fix-Render**
   - How the rubric works: 11 metrics across 6 computed dimensions
   - The refine-step pattern: idempotent, scoreboard-driven, /loop-compatible
   - Convergence behavior: diminishing returns detection
   - **The Karpathy principle**: automate/auto-research to a reasonable approximation of quality before the human enters. The inner loop MUST converge to a 10-point structural checklist (zero collisions, zero criticals, all dims >= 7) before inviting human review. Human attention is the scarcest resource — don't waste it on problems the machine can fix itself.
   - The inner loop convergence standard as a quality gate: the deck is not a "candidate" until it passes automated checks
   - Limitation: optimizes toward the rubric, not toward visual quality — but that's the point. The rubric handles the automatable; the human handles the aesthetic.

3. **The Outer Loop: When the Rubric Lies**
   - Case study: rubric scores 100% while user sees overlapping text and missing images
   - The score-perception gap: absence-of-bad vs presence-of-good
   - Wireframe comparison: ASCII intent vs rendered reality
   - Qualitative feedback protocol: what the user sees that metrics miss
   - Rubric evolution: v1 (rubber stamp) → v7 (demanding critic) through 8 outer loop iterations

4. **The Outer-Outer Loop: Evolving the Methodology**
   - How the evaluation criteria themselves evolve
   - From sampling (5 slides) to exhaustive (36 slides) — prompted by a single broken slide
   - From aggregate scores to per-slide wireframe comparison — prompted by "the rubric is insufficiently critical"
   - The design database as institutional memory: each deck teaches the next compose
   - Meta-question: when does the process stop improving?

5. **Tools and Infrastructure**
   - rastersysteme: 60-column grid, markdown → HTML/PPTX
   - compose.js: Claude-directed design directive assignment
   - rubric-jsdom.js / rubric-headless.js → rubric-scores.js (shared scoring)
   - wireframe.js: ASCII intent diagrams
   - visual-audit.js: per-slide Puppeteer bounding-box analysis
   - splice-images.js: generated image integration
   - /refine-step + /loop: autonomous convergence
   - METHODOLOGY.md: the meta-document that governs the process

6. **Results: week-2 Through the Loops**
   - Score progression table: v8 (100%) → v11 (57/60 on v7 rubric)
   - What improved in the deck vs what improved in the rubric
   - The "honest" score is lower but the deck is better
   - Side-by-side: wireframe intent vs screenshot reality for 5 key slides

7. **Discussion: Circles Within Circles**
   - The concentric loop pattern as a general AI collaboration framework
   - Inner loop = fast automated optimization (minutes)
   - Outer loop = human calibration of what "good" means (hours)
   - Outer-outer loop = evolution of the calibration process itself (days/weeks)
   - Relevance to education: students as outer-loop calibrators, not just inner-loop consumers
   - Connection to cybernetics (week 2 content): the system observing itself

8. **Conclusion**
   - AI design tools are only as good as the feedback loops that govern them
   - The rubric that scored 100% was the most dangerous — it was confident and wrong
   - The process of making the rubric honest was more valuable than making the deck pretty

### HTML Rendering Spec

The paper should be rendered as a rastersysteme HTML slide deck using the project's own tools:

```bash
# 1. Write the paper as source markdown
#    content/papers/concentric-loops.md

# 2. Compose with opus (the paper about the design system, designed by the design system)
node compose.js content/papers/concentric-loops.md decks/concentric-loops.composed.md --model opus --brief "Academic editorial. Dark navy title slides, warm cream body. Palatino for body, Futura for headings. Generous whitespace. The paper should feel like a carefully typeset journal article, not a corporate presentation."

# 3. Render + evaluate with the very rubric it describes
node raster.js decks/concentric-loops.composed.md decks/concentric-loops.html
node run-rubric-eval.js decks/concentric-loops.html --screenshots-all
node wireframe.js decks/concentric-loops.composed.md > decks/concentric-loops.wireframes.txt
```

### Visual Design Requirements

- **Title slide**: Full dark navy, Futura 44px uppercase, single red accent bar
- **Section dividers**: Dark navy with section number, minimal
- **Body slides**: Warm cream (#FAF6EE), Palatino body text, generous margins
- **Code slides**: Monospace on dark, syntax highlighted
- **Diagram slides**: The concentric loops diagram rendered as ASCII art within the deck
- **Comparison slides**: Side-by-side wireframe (left) and screenshot (right)
- **Data slides**: Score progression tables with the red/amber/green traffic light pattern
- **The deck should score >55/60 on its own rubric** — eating its own dogfood

### Key Diagrams to Include

1. **The three concentric loops** — ASCII or SVG, showing the nesting
2. **Score progression chart** — v1→v7, showing the rubric getting stricter as the deck gets better
3. **Wireframe vs screenshot comparison** — S7 and S20 as case studies
4. **Rubric dimension radar chart** — before/after calibration
5. **The feedback protocol flow** — how user comments become rubric changes

### Audience

Academic design research, HCI, AI-mediated creativity. Assumes familiarity with design systems and evaluation methodology but not with this specific toolchain. The tone should be reflective and critical — this is a paper about the limitations of AI self-assessment, not a product demo.

### Length

~40 slides (20-25 minutes presentation). Can also render as a single long-form HTML page with scroll navigation.
