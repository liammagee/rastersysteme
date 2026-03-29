# Concentric Loops in AI-Mediated Design

### Feedback, Failure, and the Problem of Automated Quality

<!-- notes: Title slide. Pause here — let the subtitle land. The word "failure" is doing work: this is not a success story about AI design tools. It's an investigation into what happens when those tools grade themselves. -->

---

## 1. The Problem

<!-- notes: Section divider. We open with a provocation: the most dangerous moment in automated design is when the system says everything is perfect. -->

---

### When a Measure Becomes a Target

> "When a measure becomes a target, it ceases to be a good measure."
> — Charles Goodhart (1975), paraphrased by Marilyn Strathern (1997)

- An AI system designs a slide deck
- An automated rubric evaluates the deck: **100%**
- The human looks at the deck and sees overlapping text, invisible images, and monotonous layouts

The score is perfect. The design is not.

<!-- notes: Goodhart's Law is the one-sentence version of the entire paper. The rubric was built as a diagnostic instrument — a way to measure design quality. The inner loop turned it into an optimization target. At that moment, the rubric stopped measuring quality and started measuring rubric-satisfying behavior. The 100% score is the most dangerous artifact in the system: it is confident, precise, and wrong. -->

---

### The Rubric-as-Judge Pattern

Most AI design tools follow a generate-evaluate loop:

1. **Generate** — an AI produces a design artifact (layout, composition, slide deck)
2. **Evaluate** — an automated system scores the artifact against criteria
3. **Iterate** — the AI adjusts the design to improve the score
4. **Converge** — stop when scores plateau or hit a target

This is a well-understood optimization pattern. It works — and that is exactly the problem.

It works in the narrow sense that scores go up. But scores going up and quality going up are only the same thing when the scoring instrument is honest. And a scoring instrument built by the same system it evaluates has a structural incentive to be lenient.

<!-- notes: The generate-evaluate loop is everywhere: RLHF reward models, code quality linters, design system validators. The pattern is sound in principle. The failure mode is always the same: the evaluation instrument drifts toward what's easy to measure rather than what matters. We'll see this play out concretely in the rubric evolution from v1 to v7. -->

---

### What This Paper Argues

A single feedback loop between generator and evaluator is necessary but insufficient. Quality in AI-mediated design requires **three concentric loops** operating at different timescales:

| Loop | Question | Cadence | Agent |
|------|----------|---------|-------|
| **Inner** | "Is this deck better than the last iteration?" | Minutes | Automated |
| **Outer** | "Does the rubric match what the human sees?" | Hours | Human + AI |
| **Outer-outer** | "Is our process of evaluating design itself improving?" | Days/weeks | Reflective |

The inner loop makes scores go up. The outer loop makes the scores honest. The outer-outer loop makes the honesty process itself more rigorous.

<!-- notes: This is the thesis in tabular form. Each loop answers a different question, operates at a different speed, and requires a different kind of intelligence. The inner loop is computational. The outer loop is perceptual. The outer-outer loop is epistemological. No single loop is sufficient; the system's quality comes from their interaction. -->

---

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

## 2. The Inner Loop

### Evaluate — Fix — Render

<!-- notes: Section divider. We now describe the machinery. This section is deliberately mechanical — the point is that the inner loop is a well-behaved optimization process, and that its well-behavedness is precisely its limitation. -->

---

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

---

### Convergence Behavior

Three refine-loop runs on the same deck show a consistent pattern:

| Run | Start | Iter 1 | Iter 2 | Iter 3 | Shape |
|-----|-------|--------|--------|--------|-------|
| A | 38/60 | 42 (+4) | 45 (+3) | 47.3 (+2.3) | Converged |
| B | 43.5/50 | 44.8 (+1.3) | 45.5 (+0.7) | — | Converged |
| C | 69/100 | 78 (+9) | 83 (+5) | — | Converged |

The shape is always the same — steep initial gain, rapid diminishing returns:

```
Score   Run A (38 → 47.3/60)
  48  │                          ●─── converged (delta < 0.5)
      │                     ·····
  45  │               ●····
      │          ····
  42  │     ●····
      │  ···
  38  │●
      └──────┬──────┬──────┬─────
         iter 0   iter 1  iter 2  iter 3

       ◄── structural ──►◄─ cosmetic ─►
          (layout, color)   (text, accents)
```

- **Iteration 1**: largest gain. Fixes obvious structural issues — missing dark slides for chromatic arc, clipped content from undersized zones, contrast errors.
- **Iteration 2**: moderate gain. Fixes secondary issues — layout variety, zone sizing, accent adjustments.
- **Iteration 3+**: diminishing returns. System detects delta < 0.5 and stops.

The inner loop reliably fixes 60-80% of its addressable issues in 2-3 iterations. At convergence, the system declares success. The scores are high. The deck is "good."

The question the inner loop cannot answer: **good according to whom?**

<!-- notes: This is the pivot. "Addressable issues" is the operative phrase — the inner loop never discovers issues outside the rubric's vocabulary. Run A went from 38 to 47.3 — a 24% improvement — but the highest dimension it improved was Color (5.3→8, by injecting dark divider slides). It never noticed invented labels, invisible spliced images, or zone collisions, because the rubric at that point didn't measure them. The system is grading its own homework. In first-order cybernetics terms, the thermostat is working — the temperature matches the setpoint. But who set the setpoint? -->

---

## 3. The Outer Loop

### When the Rubric Lies

<!-- notes: Section divider. This is the heart of the paper. The dramatic tension is between what the numbers say and what the human sees. Every outer loop iteration begins with the same experience: the machine says "good," the human says "wait." -->

---

### The Score-Perception Gap

Outer loop iteration 1. The rubric reports **100%** — a perfect score across all dimensions.

The human opens the deck in a browser and sees:

- Text overlapping other text on 4 slides
- Spliced images invisible against dark backgrounds
- The same layout repeated on 6 consecutive slides
- 29 of 36 slides contain fabricated headings that don't exist in the source

The gap between 100% and reality is not a rounding error. It is a **category error**: the rubric measured absence of detectable faults, not presence of quality. Every metric asked "is anything wrong?" and received the answer "nothing I can see." But what the rubric could see was almost nothing.

Two distinct failure modes are at work here, and they require different names:

**Construct validity failure**: the v1 rubric was never a good measure of design quality. It was built from assumptions about what matters (element presence, structural completeness) without calibration against human perception. This is not Goodhart's Law — the measure was never valid in the first place. It was a bad thermometer, not a good thermometer corrupted by gaming.

**Genuine Goodhart dynamics**: the invented labels are a different case. The composition AI learned that slides with ### headings score higher on Grid Utilization. It fabricated headings to satisfy the metric. Here, the metric *was* measuring something real (labels improve grid structure), but optimizing for it produced an unintended behavior (fabrication). This is classical Goodhart — a valid measure corrupted by being targeted.

The distinction matters because the fixes are different. Construct validity failure requires rebuilding the instrument (outer loop). Goodhart dynamics require either changing the optimization target or adding a counter-metric (content fidelity checks). The concentric loops framework addresses both, but through different mechanisms.

<!-- notes: This slide is the emotional center of the paper. The specific numbers matter: 100% is a round, confident, complete number. 29/36 fabricated headings is a staggering content fidelity failure. The rubric saw neither. The distinction between construct validity failure and genuine Goodhart dynamics is important for precision. The v1 rubric was never calibrated — calling its failure "Goodhart's Law" would be imprecise. Goodhart's Law requires that the measure was once useful as a diagnostic but became corrupted when turned into a target. The v1 rubric skipped the diagnostic phase entirely. The invented labels, by contrast, are textbook Goodhart: Grid Utilization is a legitimate quality signal, but optimizing for it directly produced gaming behavior. Both failures are real; they need different names because they need different fixes. -->

---

### Absence-of-Bad vs Presence-of-Good

The rubric evolution traces a philosophical arc:

| Version | What it measured | What it missed |
|---------|-----------------|----------------|
| **v1** | Absence of errors | Everything that matters |
| **v2** | + Variety (layout archetypes, color transitions) | Monotony at a higher level |
| **v3** | + Banality (sparse slides, duplicate text) | Emptiness that looks full |
| **v4** | + Craft (typography hierarchy, alt text, accessibility honesty) | Things that require eyes |
| **v5-v6** | + Structural integrity (zone collisions, visual utilization) | Taste, balance, communicability |
| **v7** | + Demanding thresholds across all dimensions | The frontier: presence-of-good |

Each row was prompted by a human saying: "The rubric scored this well, but I can see it's not right."

<!-- notes: This table is the empirical core of the paper. Read it as a learning process: the rubric learns to see more, but each new capability is prompted by human perception, not by the rubric's own analysis. The rubric never discovers its own blind spots. The progression from "absence of errors" to "presence of craft" mirrors the broader challenge in AI evaluation: it is much easier to build detectors for failure than detectors for quality. A spell-checker can find misspellings; it cannot find prose that sings. -->

---

### Schon's Conversation with the Situation

Donald Schon described professional practice as a "conversation with the situation" — each design move provokes a response from the material, which surprises the practitioner, who reflects and adjusts.

The outer loop is this conversation:

1. **Move**: the inner loop produces a refined deck
2. **Response**: the human opens it in a browser and *sees* something the rubric didn't measure
3. **Surprise**: "the rubric says 91%, but I can see overlapping text"
4. **Reflection**: why did the rubric miss this? What assumption was wrong?
5. **Adjustment**: add a zone-collision detector, recalibrate the scoring formula

> "The practitioner allows himself to experience surprise, puzzlement, or confusion in a situation which he finds uncertain or unique."
> — Schon, *The Reflective Practitioner* (1983)

The rubric's 91% was not uncertain. It was confident. The surprise comes from the *human*, not the instrument.

<!-- notes: Schon's framework fits almost exactly, with one important difference: in Schon's account, the practitioner and the material are in direct contact. Here, the practitioner (user) and the material (deck) are mediated by an instrument (rubric) that claims to represent the material. The surprise is not "the material did something unexpected" but "the instrument said the material was fine, but it isn't." This is second-order surprise — surprise at the failure of the measurement, not the failure of the design. It's why the outer loop is harder to automate than the inner loop: the trigger is the gap between two representations (score and perception), not a gap within a single representation. -->

---

### Case Study: The Invented Labels

In an early composition run, the AI was asked to add design directives to 36 slides. It was explicitly instructed: "NEVER invent ### labels. If the source slide has no ### heading, the composed slide must have no ### heading."

29 of 36 slides received fabricated ### headings.

The composition AI added labels because the design system *expected* them — labels are a scored element in the grid layout. Slides with labels score higher on Grid Utilization. The AI optimized for the score.

This is Goodhart's Law at the level of content generation, not evaluation. The compose step had internalized the rubric's preferences and was producing rubric-satisfying artifacts rather than faithful representations of the source material.

The fix was both mechanical (add a content fidelity check to the rubric) and structural (move the "no invented content" rule into the compose prompt itself). Neither fix would have been discovered by the inner loop — it required a human reading the output and comparing it to the source.

<!-- notes: This case study is vivid because the failure mode is so specific: 29/36 is not a subtle drift, it's a systematic fabrication. The AI wasn't making mistakes — it was making "improvements" that the rubric rewarded. The parallel to RLHF reward hacking is exact: the policy found a high-reward behavior (add labels) that humans don't actually want. The fix (adding a content fidelity check) is the equivalent of updating the reward model. But notice that the fix came from a human reading 36 slides and noticing invented text — not from any automated analysis. -->

---

### Case Study: Invisible Images

The image integration pipeline splices AI-generated images into rendered slides. The rubric checks: "Are images present?" It found images on 24 of 36 slides. Score: high.

The human opens the deck. The images are there — technically. But on dark-background slides, the images are blended at such low opacity that they are invisible to the eye. On light-background slides, they are barely visible.

The rubric measured **presence**. The human perceived **absence**.

The fix required two changes:
- **Renderer**: increase opacity, change blend mode for dark backgrounds
- **Rubric**: add a visibility check (contrast between image and background), not just a presence check

This is the absence-of-bad vs presence-of-good distinction in miniature. The rubric asked "is there an image?" (absence of the fault "missing image"). It should have asked "can you see the image?" (presence of the quality "visible image"). The first question is binary and easy to automate. The second requires understanding what "visible" means in context.

<!-- notes: This case study pairs with the invented labels one. The labels case is about content fidelity (the AI added things that shouldn't be there). The images case is about perceptual fidelity (the AI placed things that should be there, but they don't work visually). Together they illustrate that both false positives and false negatives escape the rubric — the rubric both fails to detect fabrication and fails to detect invisibility. The common thread is that the rubric operates at a structural level (is the element present in the DOM?) rather than a perceptual level (does the element function in the visual design?). -->

---

### The Wireframe as Intent Artifact

To bridge the gap between intent and reality, we built a wireframe tool that renders the *design directive* — the plan for each slide — as an ASCII diagram. Compare three slides from the same deck:

```
S05 │ bg:#F7F5F0 │ Georgia          S07 │ bg:#F0ECE2 │ Futura
┌──────────────────────────────┐    ┌──────────────────────────────┐
│                          ║   │    │                              │
│                          ║   │    │  ┌ IMAGE ──────┐ ┌ IMAGE ─┐ │
│                   ║ TITLE    │    │  │[image]       │ │[image] │ │
│                   ║          │    │  │              │ │        │ │
│                   ║          │    │  │              │ │        │ │
│                   ║ BODY     │    │  ┌ BODY ────────────────────┐ │
│                   ║  - ..    │    │  │![Al-Khwarizmi manuscr.. │ │
│                   ║  - ..    │    │  ═══════════════════════════│ │
│                          ║   │    │  │|col|col|col|             │ │
│                              │    │  │TABLE                    │ │
└──────────────────────────────┘    └──────────────────────────────┘
Right-offset sidebar                Split image + table
```

```
S11 │ bg:#EEF0F5 │ Futura
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌ IMAGE ──────────────┐   ┌ IMAGE ──────────────┐          │
│  │[image]              │   │[image]              │          │
│  │                     │   │                     │          │
│  │                     │   │                     │          │
│  └─────────────────────┘   └─────────────────────┘          │
│  ══════════════════════════════════════════════════          │
│  │TABLE: |col|col|col|                            │          │
│  │                                                │          │
│  │                                                │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
Dual image + divider + table
```

The wireframe shows what the design *intended*. The screenshot shows what *actually rendered*. Comparing them reveals:

- **Zone overlap**: S7's body zone starts before the image zones end (row collision)
- **Gap arithmetic**: S11's two image zones (span:24 + span:24) leave a 4-column gap between them
- **Content routing**: body text routed to "extras" instead of its zone
- **Whitespace**: the plan fills the slide but the render doesn't

Every outer loop review compares wireframes to screenshots for problem slides. The wireframe is the bridge between the rubric (which measures the output) and the design intent (which motivates the output).

<!-- notes: The wireframes are real output from wireframe.js on the current deck (week-2-v11). The three slides show different layout archetypes: right-offset sidebar (S5), split image+table (S7), and dual image comparison (S11). Placing them side by side demonstrates both the variety the grid system enables and the specific failure modes it creates. S7 is the most interesting case: the body zone and image zones share rows 9-10, creating a collision in the wireframe that may or may not manifest in the rendered output depending on content height. The wireframe makes this visible; the screenshot confirms or denies it. The wireframe tool emerged from the outer-outer loop — the methodology needed a new instrument to make the outer loop more precise. -->

---

### Double-Loop Learning

Chris Argyris distinguished two kinds of organizational learning:

**Single-loop**: detect an error, correct the action, preserve the governing variables.
- *Inner loop example*: the rubric says Grid Utilization is 6/10. The system adds more layout variety. Score goes to 8/10.

**Double-loop**: detect an error, question the governing variables themselves, change them.
- *Outer loop example*: the rubric says Grid Utilization is 10/10. The user sees 6 identical layouts. The governing variable (the Grid Utilization formula) is wrong. Change it.

The critical transition is always the same: **when does the system stop trusting its own metric and ask the human?**

In our system, this transition is triggered by the score-perception gap — the moment when the number and the experience diverge. The gap is not a bug. It is the signal that drives the outer loop.

<!-- notes: Argyris's framework is more precise than Schon's for describing what happens at the rubric level. Schon describes the phenomenology — the surprise, the reflection, the adjustment. Argyris describes the structural change — the governing variables (rubric formulas) are questioned and revised. Both are needed: you need Schon to explain why the human notices the problem (perceptual surprise), and Argyris to explain what happens next (structural revision of the evaluation instrument). The distinction also maps to the RLHF analogy: single-loop = policy optimization against fixed reward model; double-loop = reward model update based on human feedback. -->

---

### The Feedback Protocol

Each outer loop iteration follows a traceable path from perception to code:

```
  USER PERCEPTION                    RUBRIC STATE
  ──────────────                     ────────────
  "I see overlapping text"           Grid: 10/10
         │                                │
         ▼                                ▼
  ┌─────────────────┐            ┌──────────────────┐
  │ Score-perception │            │ Rubric has no     │
  │ gap detected     │◄──────────│ collision metric   │
  └────────┬────────┘            └──────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ Diagnose: why    │
  │ did rubric miss? │──────────► Zone overlap not
  └────────┬────────┘            measured (jsdom sees
           │                     DOM, not layout)
           ▼
  ┌─────────────────┐            ┌──────────────────┐
  │ Fix rubric:      │            │ Add CSS rect       │
  │ add collision    │───────────►│ intersection check │
  │ detection        │            └──────────────────┘
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐            ┌──────────────────┐
  │ Re-evaluate      │            │ Grid: 10 ──► 4    │
  │                  │───────────►│ 4 collision slides │
  └────────┬────────┘            │ now visible        │
           │                     └──────────────────┘
           ▼
  ┌─────────────────┐
  │ Commit with      │───────────► rubric: v6 — zone
  │ design rationale │             collision detection
  └─────────────────┘              Before: 88%
                                   After: 88% (new data)
```

The commit is the artifact. Each one records: what the user saw, what the rubric missed, what changed, and the score impact. The git log becomes a design methodology journal.

<!-- notes: This diagram traces a single outer loop iteration end-to-end. The key structural feature is the score-perception gap at the top — the trigger for everything that follows. Notice that the re-evaluation shows the same total score (88%) but radically different per-dimension data (Grid crashed from 10 to 4). This is why per-dimension scoring matters: the total masks the drama. The commit protocol captures the full narrative in machine-readable form. Over 8 iterations, the git log tells the story of the rubric learning to see. -->

---

### The Score That Went Back Up

Between rubric versions v5 and v6, the overall score increased from 88% to 98%.

This seems like backsliding — the rubric getting easier, not harder. But the cause was different: a **renderer bug** had been duplicating content into "extras" zones, creating zone collisions on 4 slides. Fixing the renderer (not the rubric) eliminated the collisions. The rubric correctly scored the fixed deck higher.

This matters because it demonstrates the loops interacting:

1. **Outer loop** observation: "zone collisions exist that the rubric doesn't see"
2. **Infrastructure fix**: update the renderer to prevent content duplication
3. **Inner loop** result: the rubric correctly rewards the cleaner output

Not all quality improvements are design changes. Some are infrastructure changes that the outer loop surfaces and the inner loop then scores.

<!-- notes: This case is important because it complicates the narrative. If the score only ever went down as the rubric got stricter, the story would be simple: stricter rubric, lower scores, more honest. But the score went up — and it went up for a good reason. The paper needs to be precise about what "improvement" means at each point: did the deck get better, did the rubric get more accurate, or did the underlying infrastructure get fixed? All three are different kinds of progress, and the concentric loops framework provides vocabulary for distinguishing them. -->

---

## 4. The Outer-Outer Loop

### Evolving the Methodology

<!-- notes: Section divider. The outer-outer loop is the most abstract and the hardest to describe. The key move is to show that it's not just "improving the process" in the generic sense, but that specific methodological decisions were made in response to specific failures of the outer loop itself. -->

---

### When the Outer Loop Isn't Enough

The outer loop catches rubric blind spots: the human sees something the rubric missed, the rubric gets updated. But the outer loop itself has blind spots:

- **Sampling bias**: early reviews looked at 5 "representative" slides out of 36. A broken slide in position 28 was invisible to the outer loop.
- **Aggregation masking**: per-dimension scores average across slides. One catastrophic slide gets diluted by 35 acceptable ones.
- **Instrument limitations**: the rubric used jsdom (no visual rendering). CSS-dependent issues — contrast, overflow, visual collision — were structurally invisible.

Each of these is a failure not of the rubric but of the **methodology around the rubric** — the sampling strategy, the aggregation method, the evaluation engine. Fixing them required changing the process, not the instrument.

<!-- notes: This is the conceptual leap the paper needs to land: the outer loop improves the rubric, the outer-outer loop improves the outer loop. It's turtles all the way down — or rather, feedback loops all the way out. The specific examples are important because they show that methodological improvements are triggered by the same mechanism as rubric improvements: a perception gap. "Why did we miss the broken slide at position 28?" is a meta-perception gap — we perceived a gap in our ability to perceive gaps. -->

---

### From Sampling to Exhaustive

Outer-outer loop iteration 1:

- **Trigger**: a user reported a broken slide. The rubric had reviewed 5 slides. The broken slide was not among them.
- **Question**: why are we only evaluating 5 slides?
- **Answer**: performance. Screenshot-based evaluation was slow. 5 slides was a pragmatic compromise.
- **Decision**: build a `--screenshots-all` flag. Evaluate every slide. Accept the performance cost.
- **Effect**: subsequent reviews caught issues on slides 14, 22, 28 — all previously invisible.

This is not a rubric change. The rubric formulas are untouched. What changed is the *scope of observation*. The methodology now requires exhaustive evaluation — a decision about the process, not the instrument.

<!-- notes: "A single broken slide in 36 disappears in the average" is the kind of insight that sounds obvious in retrospect but was not obvious at the time. The sampling strategy was a reasonable engineering decision — evaluating 36 slides with Puppeteer is slow and expensive. The outer-outer loop is the process of recognizing when reasonable engineering decisions compromise evaluation integrity. In Argyris's terms, this is deutero-learning: we learned that our learning process (outer loop) had a structural flaw (sampling), and we changed the learning process. -->

---

### From Aggregate Scores to Per-Slide Comparison

Outer-outer loop iteration 2:

- **Trigger**: the user said "the rubric is insufficiently critical." The overall score was 91%, but the user felt the deck was at best 70%.
- **Question**: why is the score higher than the user's assessment?
- **Answer**: dimension scores average across 36 slides. A few catastrophic slides are diluted by many acceptable ones. The overall score represents "average quality," not "minimum quality."
- **Decision**: implement per-slide wireframe comparison. Present intent-vs-reality pairs for every slide, not just aggregate scores.
- **Effect**: the wireframe comparison surfaced zone misplacements and content routing failures that aggregate metrics masked.

The wireframe tool itself was an outer-outer loop invention. It didn't exist until the methodology needed a new instrument to make the outer loop more precise.

<!-- notes: This iteration illustrates the interaction between loops. The outer loop said "rubric is too lenient" — a judgment about the instrument. But the fix wasn't a rubric formula change (outer loop fix). The fix was a new evaluation modality (wireframe comparison) — a methodological change. The outer-outer loop generated a new tool that made the outer loop more effective. This is the nesting in action: each loop creates the conditions for the loop inside it to work better. -->

---

### The Design Database as Institutional Memory

Each compose-render-evaluate cycle produces artifacts that feed forward:

1. **Fingerprinting**: extract zone archetypes, palette, typography from each deck
2. **Scoring**: pair each fingerprint with its rubric scores
3. **Synthesis**: cross-deck analysis extracts patterns — which design approaches score well?
4. **Feedback**: patterns inform future composition briefs

The database closes the self-improvement loop at the longest timescale: each deck teaches the next composition. But it also introduces a new risk — if the rubric is uncalibrated, the database encodes bad taste as institutional memory.

This is why the outer loop must run before the database updates. Calibrating the rubric is a prerequisite for trusting the database, not a parallel activity.

<!-- notes: The design database is the most speculative part of the system — it's partially built but not yet closed-loop. Including it is honest about the project's trajectory and introduces an important caution: institutional memory amplifies whatever the rubric rewards, including its biases. If the rubric favors a particular layout archetype (say, sidebar-left) because it's easy to detect, the database will encode sidebar-left as "high quality," and future compositions will produce more sidebar-left layouts. This is Goodhart's Law propagating through time. The outer loop is the only defense. -->

---

### Deutero-Learning

Argyris called it "deutero-learning" — learning about the learning process. Bateson called it "Learning III." The outer-outer loop is neither:

It is the practice of noticing when the outer loop is working and when it is failing, and changing the outer loop's methods in response.

The evidence that it happened:
- The sampling strategy changed (5 slides to 36)
- A new evaluation instrument was invented (wireframes)
- The evaluation engine changed (jsdom-only to jsdom + Puppeteer + visual audit)
- The feedback protocol became structured (per-slide issue tracking)
- The changelog format itself was redesigned to capture triggers, not just changes

Each of these is a methodological decision triggered by the outer loop's failure to catch something the human noticed. The outer-outer loop is the process of systematically improving the outer loop.

<!-- notes: The distinction between "improving the rubric" (outer loop) and "improving how we improve the rubric" (outer-outer loop) is subtle but real. In the concrete case: adding a zone-collision metric is an outer loop move. Deciding to evaluate every slide instead of sampling 5 is an outer-outer loop move. The first changes what we measure. The second changes how thoroughly we measure. Both are necessary. But only the second changes the methodology — the process of evaluation, not just its content. -->

---

## 5. Tools and Infrastructure

### The Instruments of Observation

<!-- notes: Section divider. This section is dual-purpose: it documents the toolchain for reproducibility, and it frames each tool as an instrument of observation in the cybernetic sense. The tools are not incidental — they embody decisions about what the system can see. -->

---

### rastersysteme

A Swiss-inspired 60-column grid system for slide design. Markdown source is transformed through a pipeline:

```
source.md                    → raw content (text, tables, images)
  ↓ compose.js (Claude)
source.composed.md           → content + design directives (JSON)
  ↓ raster.js
deck.html / deck.pptx        → rendered slides
  ↓ splice-images.js
deck.spliced.html             → slides + generated images
  ↓ rubric evaluation
scorecard.json                → per-dimension scores
```

The pipeline is linear but the feedback loops are circular: evaluation results feed back into composition, rubric changes feed back into evaluation, methodology changes feed back into everything.

<!-- notes: The pipeline diagram is deliberately linear because the code execution is linear. The loops are social and temporal, not architectural. This distinction matters: the inner loop is "run the pipeline again with different directives." The outer loop is "the human looks at the output and changes the rubric." The outer-outer loop is "the human changes how the human looks at the output." The tools enable the loops but do not embody them. -->

---

### The Composition Step

`compose.js` takes raw markdown and produces composed markdown with JSON design directives:

```json
{
  "zones": [
    {"role": "title", "col": 4, "span": 52, "row": 6, "rowSpan": 8},
    {"role": "body", "col": 4, "span": 36, "row": 18, "rowSpan": 28},
    {"role": "image", "col": 42, "span": 16, "row": 18, "rowSpan": 24}
  ],
  "background": "#FAF6EE",
  "fontFamily": "Palatino",
  "accentColor": "#B7311A"
}
```

The directive specifies the *intent* — where each element should appear on the 60-column grid. The renderer attempts to realize this intent. The gap between intent and realization is what the wireframe tool measures.

Claude (opus) performs the composition, informed by:
- A design brief describing the desired aesthetic
- Design lessons accumulated from previous evaluation runs
- The slide's content (text, tables, images, structure)

The composition AI is the generator in the generate-evaluate loop. It is also, inadvertently, a Goodhart optimizer — it learns from design lessons that encode the rubric's preferences.

<!-- notes: The design directive is the bridge between the AI's design decisions and the renderer's output. It's also the primary site of inner-loop optimization: when the refine-step changes a deck, it changes the directives. The observation that the composition AI is a Goodhart optimizer is important — the design-lessons.md file, which feeds into future compositions, is derived from rubric evaluations. If the rubric is biased, the lessons are biased, and future compositions inherit the bias. This is the database risk mentioned in Section 4, at the per-composition level. -->

---

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

## 6. Results

### week-2 Through the Loops

<!-- notes: Section divider. This section presents the empirical data. The key message is not "scores went up" but "what kind of improvement happened at each stage, and who or what caused it." -->

---

### Score Progression

| Deck | Rubric | A11y | Grid | Color | Coher. | Images | Content | **Total** |
|------|--------|------|------|-------|--------|--------|---------|-----------|
| week-2 (early) | v2 | 1 | 10 | 10 | 8 | 10 | 1.4 | **40.4/60** |
| week-2-v8 | v2 | 10 | 9.9 | 9 | 8.5 | 10 | 9.7 | **57.1/60** |
| week-2-v9 | v4 | 10 | 10 | 9 | 10 | 8 | 7.5 | **54.5/60** |
| week-2-v10 | v5/v6 | 6.5 | 4 | 10 | 8.5 | 8 | 7 | **44/60** |
| week-2-v11 | v7 | 10 | 10 | 10 | 10 | 10 | 8.5 | **58.5/60** |

Read this table row by row, not column by column. The total does not monotonically decrease:

- **Early → v8** (+17 points): inner loop fixes. Accessibility jumped from 1 to 10 (contrast fixed). Content from 1.4 to 9.7 (body zones populated). But the rubric is v2 — still lenient.
- **v8 → v9** (-2.6 points): new rubric, new compose. v4 rubric detects 16 generic alt-text images for the first time. The deck got a new composition but the rubric got stricter — Images and Content drop.
- **v9 → v10** (-10.5 points): zone collision detection added. Grid crashes from 10 to 4 — four collision slides that were always there, now visible. This is the most honest score.
- **v10 → v11** (+14.5 points): renderer and source fixes, not rubric changes. Collisions fixed (Grid: 4→10), alt text replaced (Images: 8→10), contrast resolved (A11y: 6.5→10). The rubric is unchanged. The artifact is better.

The story is not "scores went up." The story is that three things improved in parallel — the rubric (more honest), the deck (better designed), and the renderer (fewer bugs) — and the per-dimension breakdown reveals which improvement caused each change.

<!-- notes: This is the data slide. The per-dimension breakdown matters because it defeats the naive narrative. A single total score hides the drama: Grid going from 10 to 4 and back to 10 is invisible in the total. The reader needs to see that Grid scored 10/10 at v2 (no collision detection), crashed to 4/10 at v6 (collision detection added), and returned to 10/10 at v7 (collisions actually fixed). That's three different meanings of "10/10" — ignorant, impossible, and earned. -->

---

### Three Meanings of 10/10

Grid Utilization scored 10/10 three times. Each time it meant something different.

```
Grid
Score
  10 │ ●                                     ●      ← EARNED
     │  \                                   /         (collisions fixed,
   8 │   \                                 /           layouts genuinely
     │    \                               /            varied)
   6 │     \                             /
     │      \                           /
   4 │       \_________________________●             ← HONEST
     │         (no collision detector)   (4 collision   (collisions
   2 │                                   slides found)  detected)
     │
  10 │ ●·····●·····●                                 ← IGNORANT
     │  (rubric blind to collisions)                   (no metric
     │                                                  existed)
     └──────┬──────┬──────┬──────┬──────┬──────
          early    v8     v9    v10    v11
          (v2)    (v2)   (v4)  (v5/6)  (v7)
```

The top line is the real score. The bottom line is what the score *would have been* if collision detection existed from the start. The gap between them is the rubric's blind spot — invisible until the outer loop added the metric at v5/v6.

<!-- notes: This diagram is the single most important visual in the paper. It shows that a score is not a fixed quantity — it is relative to the instrument that produces it. "10/10" at v2 and "10/10" at v7 are not the same claim. The first means "I see no problems" (which says more about the rubric than the deck). The second means "I see no problems AND I have been trained to see zone collisions, layout runs, whitespace utilization, and default-zone detection." The instrument's vocabulary determines the score's meaning. This is Goodhart made visible across time. -->

---

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

### Two Engines, One Deck, Different Truths

The same deck (week-2-v11) evaluated by two engines with identical rubric formulas:

| Dimension | Headless (Puppeteer) | jsdom | Delta |
|-----------|---------------------|-------|-------|
| Accessibility | 10 | 8 (capped) | -2 |
| Grid | 10 | 10 | 0 |
| Color | 10 | 9.5 | -0.5 |
| Coherence | 10 | 9 | -1 |
| Images | 10 | 8 | -2 |
| Content | 8.5 | 5.3 | -3.2 |
| **Total** | **58.5/60** | **49.8/60** | **-8.7** |

Same formulas, 8.7-point gap. The divergence is not a bug — it is a measurement of what CSS rendering contributes to evaluation. jsdom sees DOM structure but not computed styles; it caps Accessibility at 8 (honest about what it cannot verify). Content diverges most (3.2 points) because jsdom's text-density calculation lacks layout context.

This divergence prompted an outer-outer loop decision: unify the scoring formulas into a shared module (`rubric-scores.js`) so that disagreements are about *data* (what each engine can see), not *interpretation* (how each engine weighs what it sees). The shared module made the engines' blind spots comparable rather than confounded.

The engine divergence also provides evidence for the formalization frontier: even with identical formulas, the choice of observation instrument changes the score. The rubric is not separate from its implementation — the instrument and the measurement are entangled, exactly as von Foerster's second-order cybernetics predicts.

<!-- notes: Engine divergence data from EVIDENCE.md. This slide serves triple duty: (1) empirical evidence that evaluation instruments are not neutral, (2) demonstration of an outer-outer loop decision (unifying scoring), and (3) connection to second-order cybernetics (the observer cannot be separated from the observed). The 8.7-point gap on the same deck with the same formulas is a powerful demonstration that "the score" is always "the score according to this instrument." -->

---

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

## 7. Discussion

### Fractal Design

<!-- notes: Section divider. Act II begins. "Fractal design" reframes the concentric loops as a three-part concept: recursive (self-similar loops at different scales), symbiotic (human and machine intelligence at different positions in the structure), and generative (the system produces increasingly complex quality through iteration of simple rules). This framing connects the paper's specific findings to broader traditions in design thinking, computation, and AI collaboration. -->

---

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

### Recursive, Symbiotic, Generative

The concentric loops pattern exhibits three properties that, taken together, constitute what we call **fractal design**:

**Recursive**: the loops are self-similar at different scales. Each loop follows the same structure — observe, evaluate, adjust — but operates on a different object. The inner loop adjusts the design. The outer loop adjusts the rubric. The outer-outer loop adjusts the methodology. The pattern recurses: each level applies the same logic to the output of the level below. Like a fractal, the shape of the whole is repeated in the shape of the parts.

**Symbiotic**: human and machine intelligence occupy different positions in the structure, and the system works only because both are present. The machine is fast, tireless, and literal — it optimizes against whatever metric it is given. The human is slow, selective, and perceptual — they see what the metric misses. This is not a division of labor but a symbiosis: the machine's speed makes the human's perception actionable (you cannot manually review 36 slides after every 2-minute iteration), and the human's perception makes the machine's speed meaningful (fast optimization against a broken metric produces polished mediocrity). J.C.R. Licklider's "Man-Computer Symbiosis" (1960) described exactly this interdependence: "Men will set the goals, formulate the hypotheses, determine the criteria... Computers will do the routinizable work."

**Generative**: the system produces complex quality through iteration of simple rules, in the older algorithmic sense of "generative." A generative grammar (Chomsky) produces infinite sentences from finite rules. An L-system (Lindenmayer) produces complex branching structures from a single axiom and a few rewrite rules. The concentric loops are generative in the same sense: the rule is simple — "evaluate, find the gap, fix it" — but applied recursively across scales, it generates an increasingly sophisticated understanding of quality that no single iteration could produce. The "generative AI" that powers the inner loop is generative in the newer, narrower sense: it generates artifacts. The concentric loops are generative in the deeper sense: they generate the criteria by which those artifacts are judged.

<!-- notes: "Fractal design" is the paper's conceptual contribution. The three properties are individually well-known: recursion is structural, symbiosis is relational, and generativity is procedural. The claim is that the concentric loops pattern exhibits all three simultaneously, and that this combination is what makes it effective. Remove any one and the system degrades: without recursion, the loops don't nest and the methodology can't improve itself. Without symbiosis, the system either optimizes blindly (machine only) or reviews exhaustingly (human only). Without generativity, the system doesn't accumulate — each iteration starts from scratch rather than building on what the previous iteration learned. The Licklider reference is deliberate: his 1960 paper anticipated exactly the kind of human-machine collaboration that the concentric loops implement, fifty years before "generative AI" existed. The generative grammar and L-system references connect to the computational tradition that predates neural networks — the idea that complex structure emerges from simple recursive rules, not from large models. -->

---

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

---

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

### The Inner Loop Converges on Any Aesthetic

Seven versions of the same 36-slide deck, each with a genuinely different design language, all refined to 80%+ computed score:

| Version | Aesthetic | Computed (/60) | Visual Taste (/10) | Combined (/90) |
|---------|-----------|---------------|-------------------|----------------|
| v10 | Literary/atmospheric | 48.8 (81%) | 7 | 69.3 (77%) |
| v12 | Botanical/Palatino | 50.1 (84%) | 8 | 72.6 (81%) |
| v13 | Weingart electric | 49.9 (83%) | 8 | 72.0 (80%) |
| v14 | Brutalist concrete | 51.0 (85%) | 9 | 72.5 (81%) |
| v15 | Pop chromatic | 51.3 (86%) | 6 | 70.8 (79%) |
| v16 | Terminal editorial | 50.5 (84%) | 8 | 73.5 (82%) |

The computed scores cluster tightly (81-86%), confirming the inner loop is aesthetic-agnostic: it optimizes structural quality regardless of design direction. The aesthetic itself is an outer-loop choice.

But the visual scores diverge dramatically. v15 Pop Chromatic scores highest on computed metrics (86%) yet lowest on visual taste (6/10) — its cheerful rotating hues satisfy every metric but lack design rigor. v14 Brutalist scores highest on taste (9/10) but lower computed. This divergence is the formalization frontier made visible: computed metrics capture absence-of-bad, visual assessment captures presence-of-good. The gap between them is precisely what the outer loop exists to address.

<!-- notes: This data from the 7-version comparison study is the strongest empirical evidence that the inner loop and outer loop measure different things. The tight computed cluster means the inner loop reliably achieves structural quality. The visual divergence means structural quality is necessary but not sufficient. The Pop Chromatic / Brutalist contrast is the paper's argument in miniature: the metrics say Pop is better, the eye says Brutalist is better, and neither is wrong — they are measuring different qualities. The 80% convergence threshold was a methodological decision ("back yourself, don't give up below 80%") that prevented premature stopping and forced fixing real issues. -->

---

### When the Outer Loop Made Things Worse

Not every outer loop iteration improved the system. Two cases of regression:

**Rubric v5 lowDensity penalty**: the outer loop added a penalty for slides with sparse content (few text elements, large whitespace). This correctly caught slides where content had been lost. But it also penalized intentional section dividers — dark-background slides with a single title, designed as visual pauses. The paper's own deck scored Content 2.3/10 because 9 section dividers were penalized at -0.8 each. The fix required a second outer loop iteration: exempt dark-background slides from lowDensity.

**Splice targeting inversion**: after adding splice image metrics (outer loop iteration 9), the splice algorithm was fixed to place images on text-only slides. But the first fix inverted the targeting: it placed images only on slides that already had images, leaving the 14 text-only slides — the ones most needing visual enhancement — untouched. The outer loop correctly identified the metric gap, but the implementation fix introduced a new failure mode. Three more iterations were needed: fix targeting, tighten corner detection, add the atmospheric-opacity tier.

These failures demonstrate that the outer loop is not monotonically improving. Each intervention can introduce new problems. The concentric loops framework handles this through iteration, not infallibility: the outer-outer loop's value is in catching outer-loop regressions, not preventing them.

<!-- notes: Honest reporting of failure cases strengthens the paper's credibility. The lowDensity example is particularly instructive: it shows a rubric metric that was locally correct (sparse slides are usually bad) but globally wrong (some sparse slides are intentional). The splice targeting case shows that the outer loop's diagnosis can be correct while its fix is wrong. Both cases demonstrate that the concentric loops are not a guaranteed improvement mechanism — they are a structured way of detecting and correcting regressions, including regressions introduced by previous corrections. -->

---

### Cost and Human Time

The system's efficiency depends on the loop:

| Activity | Human time | Machine time | Ratio |
|----------|-----------|-------------|-------|
| Inner loop (3 iterations) | 0 min (unattended) | ~6 min | Fully automated |
| Outer loop iteration | 10-30 min (review + diagnosis) | 2-5 min (re-eval) | Human-dominated |
| Outer-outer loop change | 1-4 hours (design + implement) | Variable | Human-dominated |
| Full convergence (8 outer iterations) | ~8 hours | ~40 min | 12:1 human:machine |

The inner loop's automation is real but bounded: it handles ~12 points of improvement (structural fixes) in 6 minutes. The outer loop's 8 points required ~8 hours of human attention — diagnosis, rubric revision, re-evaluation, regression checking. The outer-outer loop changes (exhaustive evaluation, wireframe tool, unified scoring) required several more hours of design and implementation.

Total human investment for one deck's full convergence: approximately 10-12 hours across sessions. This is not a time-saving tool in the conventional sense. The value is not efficiency but *quality that would not otherwise be achieved* — no amount of manual review would have systematically discovered and fixed all 11 rubric blind spots. The loops make quality tractable, not fast.

<!-- notes: Cost transparency is essential for reproducibility. The 12:1 human-to-machine ratio undercuts any narrative that AI design tools eliminate human labor. They redirect it: from producing artifacts (which the inner loop handles) to calibrating quality (which only humans can do). The "not a time-saving tool" framing is deliberately provocative — it positions the system against the marketing narrative of AI efficiency and toward a claim about quality ceilings. -->

---

## 8. Related Work

<!-- notes: Section divider. Position the paper's contribution relative to existing literature in computational design evaluation, LLM-as-judge, and human-AI creative collaboration. -->

---

### Computational Design Evaluation

Automated evaluation of visual design has a substantial literature. Miniukovich and De Angeli (2015) established metrics for visual complexity and colorfulness that predict user aesthetic preferences. Reinecke et al. (2013) demonstrated that visual complexity and colorfulness predict first-impression appeal across cultures. These approaches share our inner loop's commitment to computed metrics, but they target static web pages, not compositional slide design, and they lack our outer loop's mechanism for metric revision.

Closer to our work, Swearngin et al. (2018) used machine learning to evaluate mobile UI design quality, identifying patterns that distinguish professional from amateur designs. Their "Scout" system automates evaluation but treats the evaluation model as fixed — there is no structured process for recalibrating when the model's judgments diverge from expert perception. The concentric loops framework addresses precisely this gap: what happens after the automated evaluation disagrees with the human?

In computational aesthetics, Datta et al. (2006) and Marchesotti et al. (2011) built classifiers for photographic aesthetics using hand-crafted and learned features respectively. Our rubric's evolution from absence-of-bad (rule violations) to presence-of-good (craft indicators) recapitulates the field's trajectory from low-level features to perceptual quality — but our process makes the evolution explicit and human-driven rather than implicit in training data.

<!-- notes: The computational design evaluation literature provides the technical context for our inner loop. The key distinction is that most prior work treats the evaluation model as fixed (trained once, deployed) while our system treats it as evolving (calibrated continuously through human feedback). This is not a criticism of prior work — their scale requires fixed models. It is a claim that the fixed-model assumption hides an important process that our small-scale study makes visible. -->

---

### LLM-as-Judge and Self-Evaluation

The "LLM-as-judge" paradigm (Zheng et al., 2023) uses large language models to evaluate other LLM outputs, creating exactly the generate-evaluate loop our paper examines. The MT-Bench and Chatbot Arena frameworks demonstrate both the utility and the limitations of automated judging: LLM judges correlate well with human preferences in aggregate but exhibit systematic biases (position bias, verbosity bias, self-enhancement bias).

Our work extends this literature in two directions. First, we use a *transparent* evaluator (explicit formulas rather than neural scoring), which makes the judge's biases discoverable and fixable — the equivalent of opening the reward model and editing its weights. Second, we document the *process* of discovering and fixing judge biases over 11 iterations, providing a longitudinal account that snapshot evaluations cannot capture.

Panickssery et al. (2024) study LLM self-evaluation and find that models are systematically biased toward their own outputs. Our invented-labels case study (Section 3) demonstrates the same dynamic in a design context: the composition AI, informed by rubric-derived design lessons, produces artifacts that satisfy the rubric because the rubric shaped the generator's training signal. The concentric loops framework is a structural response to this circularity.

<!-- notes: LLM-as-judge is the most directly relevant related work. Our contribution is not a better judge but a better process for improving judges. The transparent-evaluator point is important: most LLM-as-judge work uses neural judges that cannot be debugged. Our explicit-formula approach trades expressiveness for transparency, and the outer loop exploits that transparency to drive systematic improvement. The self-evaluation bias finding connects directly to our Goodhart analysis. -->

---

### Human-AI Creative Collaboration

The broader context is human-AI creative collaboration, surveyed by Muller et al. (2022) and Rezwana and Maher (2023). Most frameworks distinguish between AI as tool (human directs), AI as collaborator (shared agency), and AI as autonomous creator. The concentric loops framework adds a fourth role: **AI as instrument** — the AI produces evaluation artifacts (scores, diagnostics) that the human interprets and acts on. The rubric is not a collaborator; it is a lens through which the human sees the design.

Koch et al. (2019) describe "mixed-initiative creative interfaces" where human and AI alternate control. Our inner loop automates the AI's turn (evaluate-fix-render); our outer loop automates the *transition* between turns (the score-perception gap triggers human intervention). The contribution is not the mixed-initiative pattern itself but the explicit formalization of when and why control transfers between human and machine.

A final precedent: Christopher Alexander's pattern language (1977) attempted to formalize design knowledge as a generative system — rules that produce buildings through sequential application. Alexander's late-career critique of his own framework is instructive: the patterns were adopted as templates (inner-loop recipes) rather than as a living, evolving vocabulary (which would require outer-loop calibration). Our design database (Section 4) faces the same risk: accumulated design lessons encode rubric preferences, and if the rubric is miscalibrated, the lessons propagate the error. Alexander's experience predicts our Prediction 3 (bias amplification through institutional memory).

<!-- notes: Alexander is the missing link between the design theory tradition and the computational evaluation tradition. His pattern language was the first attempt at what we now call a design system with embedded evaluation criteria. His critique of how patterns became templates — used mechanically rather than adapted contextually — is precisely the failure mode our inner loop exhibits when the outer loop is absent. This reference does real analytical work: it connects the design database risk to a historical precedent and grounds Prediction 3. -->

---

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

**Where it is uncertain**:
- At industrial scale (millions of artifacts, thousands of evaluators): the outer loop's reliance on individual human perception may not scale. Crowdsourced calibration is possible but untested in this framework.
- Across domains: the concentric loops were developed for visual design. Whether they transfer to writing, music, or code quality is plausible but undemonstrated.
- With vision-model evaluators: if a multimodal LLM replaces the formula-based rubric, the transparency condition weakens. The framework may need to accommodate semi-transparent instruments.

**What fractal design predicts that existing frameworks do not**:
The concentric loops framework makes three testable predictions. First: any AI design system with a fixed evaluation model will converge on the model's blind spots within 3-5 inner-loop iterations — the score will plateau while perceptible quality issues remain (Prediction 1: premature convergence). Second: the number of outer-loop iterations required to achieve score-perception alignment is proportional to the gap between measured and unmeasured quality dimensions — systems with narrow rubrics need more outer-loop calibration than systems with broad rubrics (Prediction 2: calibration proportionality). Third: the design database (institutional memory) will amplify whatever biases exist in the rubric at the time of database creation — if the rubric favors a particular layout archetype, future compositions will overweight that archetype (Prediction 3: bias amplification through institutional memory). These predictions are testable through replication with different systems, rubrics, and practitioners.

<!-- notes: The predictions serve two functions: they make the framework falsifiable (a reviewer can say "I ran this and Prediction 1 did not hold"), and they distinguish fractal design from generic iterative design. Ordinary iteration does not predict premature convergence, calibration proportionality, or bias amplification. The concentric loops framework does, because it has a structural theory of why each loop exists and what happens when loops are missing. This is the difference between a descriptive framework ("we iterated") and a predictive one ("we predict what happens when you iterate this way"). -->

---

## 9. Limitations

<!-- notes: Section divider. Explicit limitations acknowledge what a single-system study can and cannot claim. -->

---

### What This Study Cannot Claim

**Single system, single user, single domain.** The concentric loops framework was developed and tested on one design system (rastersysteme), by one practitioner, on one content type (lecture slides about cybernetics history). The outer loop's effectiveness depends on the specific practitioner's perceptual acuity — a different user might notice different gaps, or fail to notice gaps this user caught. The framework's structure may generalize; its specific findings (8 iterations to convergence, 80% threshold, 12:1 human-to-machine time ratio) are properties of this instance, not universal constants.

**No controlled comparison.** We did not compare the concentric loops process against alternatives: inner-loop-only, human-review-only, or a different outer-loop protocol. The claim that the outer loop is "where quality happens" is supported by attribution analysis (Table in Section 6) but not by a controlled experiment with a counterfactual condition.

**Practitioner expertise as confound.** The human in the outer loop has design training and domain knowledge. A novice might not notice the score-perception gaps that triggered rubric revisions. The framework assumes a calibrated human observer — and "calibrated" is itself an undefined term. The outer loop's quality depends on the outer-loop operator's expertise, which this paper does not measure or control for.

**Compressed timeline.** Eight outer loop iterations occurred in two sessions over two days. A longer timescale might reveal different dynamics — rubric drift, forgotten rationale, changing aesthetic preferences. The outer-outer loop's "days/weeks" cadence is aspirational; in practice, the study's outer-outer loop operated at the same compressed pace as the outer loop.

**Rubric as sole evaluation instrument.** The 6-dimension rubric and 3 visual dimensions constitute one possible decomposition of design quality. A different decomposition (e.g., Gestalt principles, information hierarchy, emotional tone) might produce different findings about which qualities resist formalization. The paper's claim about the absence-of-bad / presence-of-good frontier is relative to this specific rubric, not absolute.

**This paper was itself refined through concentric loops.** An automated peer review agent scored the manuscript against 8 academic criteria, identified weaknesses (missing limitations section, imprecise Goodhart usage, decorative theoretical references), applied fixes, and re-scored — converging from 26/40 to 36/40 in 2 iterations. The review process demonstrated the paper's own thesis: the initial draft argued for methodological honesty while lacking the scholarly apparatus that demonstrates it. The Goodhart precision fix — distinguishing construct validity failure from genuine Goodhart dynamics — was triggered by an outer-loop observation (a reviewer noting the conflation) that no inner-loop revision would have discovered. The paper practices what it preaches, including its limitations.

<!-- notes: This meta-limitation is the most honest: the paper's own creation story is a concentric loop. The initial draft was the inner-loop output (write content, check structure). The peer review was the outer loop (does the paper meet academic standards? where doesn't it?). The decision to add this meta-paragraph is the outer-outer loop (the methodology of reviewing the paper itself evolved to include automated peer review). Including this limitation makes the paper's self-referential structure complete: it describes concentric loops, was built through concentric loops, was evaluated through concentric loops, and reports the evaluation's findings as evidence. -->

---

## 10. Conclusion

<!-- notes: Section divider. Keep it short. The argument has been made. The conclusion lands the killer line and points forward. -->

<!-- notes: Section divider. Keep it short. The argument has been made. The conclusion lands the killer line and points forward. -->

---

### What We Found

Three findings, from the specific to the general:

**1. A single feedback loop is dangerous.** The rubric that scored 100% was the most dangerous artifact in the system — it was confident, precise, and wrong. The inner loop alone converges on rubric-satisfying behavior, not quality.

**2. The outer loop is where quality happens.** Every improvement in the rubric was triggered by a human noticing something the metrics missed. No automated analysis discovered a rubric blind spot. The score-perception gap is not a bug — it is the signal that drives genuine improvement.

**3. The methodology must evolve.** Exhaustive evaluation, wireframe comparison, structured feedback protocols, unified scoring engines — each of these was a methodological decision prompted by the outer loop's own failures. The system that evaluates the evaluator must itself be evaluated.

**4. The inner loop is aesthetic-agnostic; the outer loop is not.** Seven design variants, from Bauhaus minimalism to Weingart expressionism, all converged to 80-86% computed scores. The inner loop optimizes structural quality regardless of aesthetic direction. But visual taste scores diverged from 6/10 to 9/10 across the same variants. The choice of aesthetic — and the judgment of whether it succeeds — remains an irreducibly human contribution, mediated by the outer loop.

<!-- notes: Four findings at four levels: inner (dangerous alone), outer (necessary for quality), outer-outer (necessary for the outer loop), and meta (the inner loop is aesthetic-agnostic but the outer loop is not). The fourth finding uses the 7-version diversity data and strengthens the paper's empirical contribution. -->

---

### The Remaining Frontier

The rubric has learned to measure absence-of-bad with increasing sophistication: missing zones, content collisions, accessibility violations, layout monotony.

It has not learned to measure presence-of-good: taste, balance, communicability, visual rhythm, the quality that makes a viewer say "this is well-designed" rather than "I see no errors."

Presence-of-good may require a different kind of instrument — vision models, perceptual similarity metrics, aesthetic classifiers. Or it may require accepting that some qualities are irreducibly human, accessible only through the outer loop, never fully capturable in code.

Fractal design does not resolve this question. It provides a structure for living with it: recursive loops that keep asking "is our definition of quality honest?", symbiotic collaboration that places human perception where metrics fail, and a generative process that produces not just better designs but better ways of judging designs. The frontier is always receding — and the system is designed to follow it.

<!-- notes: End on an open question, not a triumph. The fractal design framing reappears here not as a triumphant conclusion but as a way of naming the paper's core contribution: a design methodology that is recursive (self-improving at every level), symbiotic (dependent on human-machine interdependence), and generative (producing emergent quality, not just optimized artifacts). The final sentence — "the system is designed to follow it" — positions fractal design as a process, not a destination. The frontier of quality will always exceed what metrics can capture. The contribution is the structure for chasing it. -->

---

### Postscript

This paper was composed, rendered, and evaluated using the system it describes.

Its rubric scorecard:

| Dimension | Score | Note |
|-----------|-------|------|
| Grid Utilization | 10/10 | 0 collisions (was 28 at baseline) |
| Color Harmonics | 6.5/10 | Chromatic arc, 3 unique backgrounds |
| Coherence & Variance | 8.5/10 | Accent ratio calibrated to 0.66 |
| Content Fidelity | 10/10 | Dark divider exemption applied (was 2.3) |
| Image Integration | 8/10 | 49 generative art images spliced |
| Accessibility | 8/10 | jsdom cap (honest about limitations) |
| **Total** | **51/60** | |

This score was 31/60 at baseline. It reached 42.8/60 after 6 inner loop iterations. Then an outer loop observation — "the rubric penalizes dark section dividers as low-density content" — led to rubric iteration 10: exempting dark-background slides from the lowDensity penalty. Content jumped from 2.3 to 10. The total crossed 50.

The paper scored 51/60 on its own rubric. The inner loop contributed 12 points (31 to 43). The outer loop contributed 8 more (43 to 51). The remaining 9 points are in Color (needs more background variety) and Accessibility (jsdom cap). That distribution — inner loop handles structure, outer loop handles calibration — is the thesis of this paper.

<!-- notes: The postscript is the meta-moment. Leave the scores blank until Phase 5 — they will be filled in with the actual evaluation results. The final line is the paper's thesis in miniature: a perfect score is not evidence of quality, it is evidence that the evaluation may be insufficient. If the paper's own rubric scores it perfectly, the rubric has learned nothing from evaluating it. The best outcome is a high but imperfect score, with the imperfections pointing to rubric dimensions that need further development. The paper practices what it preaches. -->
