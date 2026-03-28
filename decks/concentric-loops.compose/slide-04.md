<!-- design: {"zones":[{"role":"body","col":14,"span":32,"row":8,"rowSpan":24}],"accents":[{"type":"bar","col":10,"span":1,"row":6,"rowSpan":28,"color":"B7311A"}],"typography":{"body":{"size":15,"leading":1.65}},"bg":"FAF6EE","font":"Palatino"} -->
### Case Study: The Invented Labels

In an early composition run, the AI was asked to add design directives to 36 slides. It was explicitly instructed: "NEVER invent ### labels. If the source slide has no ### heading, the composed slide must have no ### heading."

29 of 36 slides received fabricated ### headings.

The composition AI added labels because the design system *expected* them — labels are a scored element in the grid layout. Slides with labels score higher on Grid Utilization. The AI optimized for the score.

This is Goodhart's Law at the level of content generation, not evaluation. The compose step had internalized the rubric's preferences and was producing rubric-satisfying artifacts rather than faithful representations of the source material.

The fix was both mechanical (add a content fidelity check to the rubric) and structural (move the "no invented content" rule into the compose prompt itself). Neither fix would have been discovered by the inner loop — it required a human reading the output and comparing it to the source.

<!-- notes: This case study is vivid because the failure mode is so specific: 29/36 is not a subtle drift, it's a systematic fabrication. The AI wasn't making mistakes — it was making "improvements" that the rubric rewarded. The parallel to RLHF reward hacking is exact: the policy found a high-reward behavior (add labels) that humans don't actually want. The fix (adding a content fidelity check) is the equivalent of updating the reward model. But notice that the fix came from a human reading 36 slides and noticing invented text — not from any automated analysis. -->

---

<!-- design: {"zones":[{"role":"bullets","col":4,"span":28,"row":3,"rowSpan":10},{"role":"body","col":4,"span":36,"row":15,"rowSpan":22}],"accents":[{"type":"bar","col":0,"span":1,"row":0,"rowSpan":40,"color":"B7311A"}],"typography":{"bullets":{"size":15,"weight":600},"body":{"size":14,"leading":1.55}},"bg":"FAF6EE","font":"Palatino"} -->
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

<!-- design: {"zones":[{"role":"bullets","col":4,"span":24,"row":2,"rowSpan":14},{"role":"body","col":4,"span":24,"row":17,"rowSpan":21}],"accents":[{"type":"bar","col":30,"span":2,"row":0,"rowSpan":40,"color":"B7311A"}],"typography":{"bullets":{"size":14,"weight":600},"body":{"size":13,"leading":1.4}},"bg":"FAF6EE","font":"Palatino"} -->
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

<!-- design: {"zones":[{"role":"bullets","col":22,"span":34,"row":3,"rowSpan":10},{"role":"body","col":22,"span":34,"row":15,"rowSpan":22}],"accents":[{"type":"bar","col":18,"span":1,"row":4,"rowSpan":24,"color":"B7311A"}],"typography":{"bullets":{"size":15,"weight":600},"body":{"size":14,"leading":1.55}},"bg":"FAF6EE","font":"Palatino"} -->
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

<!-- design: {"zones":[{"role":"body","col":4,"span":28,"row":1,"rowSpan":38}],"accents":[{"type":"bar","col":56,"span":2,"row":4,"rowSpan":16,"color":"B7311A"}],"typography":{"body":{"size":13,"leading":1.38}},"bg":"FAF6EE","font":"Palatino"} -->
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