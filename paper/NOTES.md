# Content Direction Notes

## Central Argument (A then B)

**Act I (Sections 1-6): The rubric that scored 100% was the most dangerous.**

A system that grades its own design output converges on what it can measure, not what matters. The story is the rubric's journey from rubber stamp to demanding critic, driven entirely by human feedback that contradicted the numbers. Each outer loop iteration is a small crisis: the machine says "perfect," the human says "broken," and the methodology evolves.

The dramatic arc:
- v1: 100% score, mediocre deck. The system is confident and wrong.
- v3: 91%, user says "still overlapping text." The score dropped but not enough.
- v4: 75%, first honest score. The rubric learned to see absence-of-craft, not just absence-of-error.
- v6: 98%, but this time the deck is actually better. The score went up because renderer bugs were fixed, not because the rubric softened.
- v7: 57/60 on a stricter rubric. The most demanding version, and the deck earns it.

The key tension: **the score going up at v6 needs careful framing.** The naive read is "the system got better." The honest read is "the renderer was fixed and the rubric was restructured." The paper must be precise about what improved — the artifact, the instrument, or the process.

**Act II (Section 7): The pattern generalizes.**

The concentric loops aren't specific to slide design. They describe any AI collaboration where:
- An inner loop optimizes a measurable proxy (fast, automated)
- An outer loop calibrates what "good" means (slow, human)
- An outer-outer loop evolves the calibration process itself (slowest, reflective)

This is a general framework for AI-mediated creative work where quality is subjective and metrics are necessary but insufficient.

## The Meta Angle

The paper is rendered as a rastersysteme deck. It is composed by the same AI that composed the decks it critiques. It is evaluated by the same rubric it describes. It targets >55/60 on that rubric.

This isn't just a nice touch — it's a structural feature. The paper should:
- Include a postscript slide showing its own rubric scorecard
- Discuss whether the act of writing the paper constituted an outer-outer loop iteration (it did: we're reflecting on the methodology and will likely discover rubric blind spots in the process)
- Acknowledge the irony: if the paper scores 100%, we should be suspicious

The meta framing turns the paper from a report into a demonstration. The audience doesn't just read about concentric loops — they see one in action.

## Intellectual Genealogy

### Donald Schon — The Reflective Practitioner (1983)

Schon's core idea: professionals don't just apply theory, they reflect-in-action. The practitioner has a "conversation with the situation" — each design move provokes a response from the material, which informs the next move.

**Connection**: The outer loop is exactly this conversation. The user looks at the rendered deck, sees something the rubric missed, and that observation becomes a rubric change. The "material" is the rendered HTML; the "response" is the visual reality that contradicts the metrics. The inner loop is technical rationality (apply rules, optimize scores). The outer loop is reflection-in-action (what does this actually look like?).

**Key quote**: "The practitioner allows himself to experience surprise, puzzlement, or confusion in a situation which he finds uncertain or unique. He reflects on the phenomenon before him, and on the prior understandings which have been implicit in his behaviour."

This is exactly what happens at outer loop iteration 3: the user is puzzled that the rubric says 91% while the deck looks broken. The prior understanding (the rubric) was implicit; the surprise (overlapping text) forces explicit reflection.

### Chris Argyris — Double-Loop Learning (1977)

Single-loop learning: detect error, correct action, maintain governing variables.
Double-loop learning: detect error, question governing variables, change them.

**Connection**: The inner loop is single-loop learning — the rubric is fixed, the design iterates toward it. The outer loop is double-loop learning — the rubric itself is questioned and changed. The outer-outer loop might be what Argyris calls "deutero-learning" — learning about the learning process.

The critical moment is always the transition from inner to outer: when does the system stop trusting its own metric and ask the human? In our case, this transition is triggered by perception gaps — the user sees something the rubric doesn't.

### Cybernetics — Norbert Wiener, Stafford Beer, Gregory Bateson

The paper is literally about feedback loops, so the cybernetics connection is direct:

- **First-order cybernetics** (Wiener): the inner loop. A goal-seeking system with a sensor (rubric), comparator (target score), and effector (design changes). Classical control theory.
- **Second-order cybernetics** (von Foerster, Bateson): the outer loop. The observer is part of the system. The rubric is not a neutral instrument — it shapes what the system considers "good," which shapes the designs, which shape the rubric. The user intervenes precisely because they see the circularity.
- **Viable System Model** (Beer): the three loops map roughly to Beer's System 1 (operations/inner loop), System 3 (internal regulation/outer loop), and System 4 (adaptation/outer-outer loop). The paper could reference this without going deep.

**Key insight**: The week-2 course content is about cybernetics. The paper about the slide design process is itself a cybernetic analysis. The slides about feedback loops were designed through feedback loops. This recursion is worth naming explicitly.

### RLHF (Reinforcement Learning from Human Feedback)

The inner/outer loop structure mirrors RLHF:
- **Inner loop** = RL optimization against a reward model (the rubric)
- **Outer loop** = Human feedback that recalibrates the reward model
- **The core RLHF problem** = reward hacking — the agent finds high-reward behaviors that don't correspond to what humans actually want

Our v1 rubric scoring 100% IS reward hacking. The "agent" (compose + render pipeline) produced output that scored perfectly on a shallow reward model while producing mediocre designs. The outer loop is literally RLHF: human looks at output, says "this isn't what I meant by good," and the reward model (rubric) gets updated.

**Difference from RLHF**: In RLHF, the reward model is retrained on preference data. In our system, the rubric is manually revised based on qualitative feedback. The human doesn't just say "A > B" (preference ranking); they say "this overlaps, this is invisible, this is banal" (diagnostic feedback). This is richer than preference pairs.

### Design Rationale & QOC (Questions, Options, Criteria)

MacLean et al.'s design rationale work captures why design decisions were made. Our commit-message protocol for rubric changes (outer loop feedback, before score, after score) is a form of design rationale capture. The rubric changelog is a structured design rationale document.

The paper could frame the changelog as a contribution: a lightweight method for capturing design rationale in AI-mediated workflows, where each rubric change is a recorded design decision with its trigger (user feedback), options considered, and measured outcome.

### Goodhart's Law

"When a measure becomes a target, it ceases to be a good measure."

This is the single-sentence version of the paper's thesis. The v1 rubric score was a measure; the inner loop turned it into a target; it immediately became a poor measure. The outer loop exists to counteract Goodhart's Law by continuously recalibrating the measure against ground truth (human perception).

The paper should name this law explicitly — it's well-known enough that the audience will recognize it, and it positions our work as a practical response to a well-studied problem.

## Key Evidence to Feature

### Case Study 1: The Invented Labels Incident

29 of 36 slides in an early compose run had fabricated ### headings that didn't exist in the source markdown. The composition AI invented "labels" because the design system expected them. This is:
- A content fidelity failure (the compose step added words)
- A Goodhart effect (the system optimized for "has labels" because labels are a scored element)
- Fixed by adding an explicit rule: "NEVER invent ### labels"

This is a vivid, specific example that's more memorable than score tables.

### Case Study 2: Splice Image Invisibility

Spliced images were present (rubric checked: yes) but visually invisible — too low opacity on dark backgrounds. The rubric counted presence but not visibility. The fix required both:
- A renderer change (bump opacity, change blend mode)
- A rubric change (add a visibility check, not just a presence check)

This illustrates the absence-of-bad vs presence-of-good distinction.

### Case Study 3: The Score That Went Up

v5→v6: score went from 88% to 98%. But this wasn't because the rubric got easier. The renderer had a zone-collision bug where content was duplicated into "extras" zones. Fixing the renderer (not the rubric, not the composition) eliminated 4 collisions. The score increase was legitimate — the deck was actually better.

This is important because it shows the loops interacting: an outer-loop observation ("zone collisions exist") led to a renderer fix (infrastructure), which the inner-loop rubric then correctly scored higher. Not all improvements come from design changes.

### Case Study 4: Wireframe vs Screenshot

Need to identify 2-3 slides where the wireframe shows one thing and the screenshot shows another. Best candidates:
- A slide where the wireframe shows a sidebar-left layout but the content renders as full-width (zone misplacement)
- A slide where the wireframe shows a clean grid but the screenshot shows overlapping zones (collision)
- A slide where the wireframe shows an image zone but the screenshot shows nothing (missing splice)

These comparisons are the heart of the outer loop — comparing intent against reality.

## The Absence-of-Bad vs Presence-of-Good

From RUBRIC-CHANGELOG.md:
- v1: Measured absence of errors. Perfect scores for mediocre decks.
- v2: Added variety metrics. Caught monotony.
- v3: Added banality metrics. Caught emptiness.
- v4: Added quality metrics. Caught lack of craft.
- Frontier: Visual quality — communicability, taste, balance.

This is the deepest observation in the project. The rubric evolution traces a clear philosophical arc from "nothing is wrong" (necessary but insufficient) toward "something is right" (harder to measure, closer to what matters).

The paper should frame this as a general principle for AI evaluation: metrics that penalize errors are easy to build but create a quality ceiling. Metrics that reward quality are hard to build but raise the ceiling. The outer loop exists to push the rubric from the first category toward the second.

## Fractal Design (added during Phase 4)

The paper's conceptual contribution, introduced in the intellectual debts table (Section 1) and developed in Section 7. Three properties:

**Recursive**: self-similar loops at different scales. Each loop follows the same observe→evaluate→adjust pattern but operates on a different object (design, rubric, methodology). Like a fractal, the shape of the whole is repeated in the parts. This connects to the cybernetics tradition (first/second-order) and Argyris (single/double/deutero-learning).

**Symbiotic**: human and machine intelligence at different positions. The machine is fast and literal (inner loop), the human is slow and perceptual (outer loop). Neither is sufficient alone. This connects to Licklider's "Man-Computer Symbiosis" (1960) and the Wiener/McCarthy divide in the week-2 content. The concentric loops are the cybernetic (Wiener) alternative to the autonomous (McCarthy) model.

**Generative**: the system produces complex quality through iteration of simple rules. "Generative" in the older algorithmic sense (Chomsky's grammars, Lindenmayer's L-systems, Alexander's generative sequences) — not just the narrow sense of "generative AI." The inner loop generates artifacts. The outer loops generate the criteria by which artifacts are judged. The distinction matters: "generative AI" is the inner loop; "fractal design" is the full stack.

The term "fractal design" does triple duty:
1. It names the pattern (recursive + symbiotic + generative)
2. It connects to the computational tradition that predates neural networks
3. It reframes "generative AI" as one layer of a deeper generative process

## Open Questions

- **Live demo**: Should the paper include a section where the audience could theoretically run /refine-step during the presentation? This would be dramatic but risky. Maybe frame it as "the inner loop runs in 2-minute cycles; in the time it takes to present these 3 slides, the deck has already been re-evaluated." Time-awareness, not live execution.
- **Concentric loops diagram**: ASCII art is on-brand (the wireframe tool uses ASCII). A generated image risks looking too polished. Recommend ASCII with careful spacing, rendered as a code slide.
- **Week-4 workshop relationship**: Keep separate. The workshop is pedagogical (teaching students about loops); the paper is analytical (examining the loops). Reference the workshop as evidence that the framework is teachable.
- **Long-form scroll render**: Yes, as an alternate output. The deck is the primary artifact; the scroll version is for reading, not presenting.
