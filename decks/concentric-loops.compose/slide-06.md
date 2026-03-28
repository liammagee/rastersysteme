<!-- design: {"zones":[{"role":"label","col":46,"span":12,"row":4,"rowSpan":2},{"role":"body","col":6,"span":36,"row":8,"rowSpan":24}],"accents":[{"type":"line","col":6,"span":36,"row":7,"rowSpan":1,"color":"B7311A"},{"type":"block","col":44,"span":14,"row":0,"rowSpan":40,"color":"E5DFD3"}],"typography":{"body":{"size":16,"leading":"1.75","align":"left"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"0A1628"}},"bg":"FAF6EE","font":"Palatino"} -->
### TRANSFER
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

<!-- design: {"zones":[{"role":"label","col":2,"span":12,"row":2,"rowSpan":2},{"role":"body","col":2,"span":28,"row":5,"rowSpan":12},{"role":"bullets","col":2,"span":28,"row":19,"rowSpan":20}],"accents":[{"type":"line","col":2,"span":28,"row":18,"rowSpan":1,"color":"0A1628"},{"type":"bar","col":34,"span":1,"row":2,"rowSpan":36,"color":"B7311A"},{"type":"dot","col":42,"span":5,"row":18,"rowSpan":5,"color":"E5DFD3"}],"typography":{"body":{"size":14,"leading":"1.6","align":"left"},"bullets":{"size":14,"leading":"1.55"},"label":{"size":11,"transform":"uppercase","tracking":"0.12em","color":"B7311A"}},"bg":"FAF6EE","font":"Palatino"} -->
### CRITERIA
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

<!-- design: {"zones":[{"role":"title","col":10,"span":44,"row":14,"rowSpan":12}],"accents":[{"type":"bar","col":56,"span":3,"row":0,"rowSpan":40,"color":"B7311A"},{"type":"line","col":10,"span":44,"row":13,"rowSpan":1,"color":"E5DFD3"}],"typography":{"title":{"size":40,"weight":700,"tracking":"0.04em","align":"right","color":"FAF6EE"}},"bg":"FAF6EE","font":"Futura"} -->
### SECTION
## 5. Tools and Infrastructure

### The Instruments of Observation

<!-- notes: Section divider. This section is dual-purpose: it documents the toolchain for reproducibility, and it frames each tool as an instrument of observation in the cybernetic sense. The tools are not incidental — they embody decisions about what the system can see. -->

---

<!-- design: {"zones":[{"role":"label","col":2,"span":12,"row":3,"rowSpan":2},{"role":"body","col":16,"span":42,"row":3,"rowSpan":34}],"accents":[{"type":"line","col":16,"span":42,"row":2,"rowSpan":1,"color":"B7311A"},{"type":"bar","col":14,"span":1,"row":3,"rowSpan":34,"color":"E5DFD3"}],"typography":{"body":{"size":14,"leading":"1.65","align":"left"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"B7311A"}},"bg":"E5DFD3","font":"Palatino"} -->
### TOOLING
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

<!-- design: {"zones":[{"role":"label","col":48,"span":10,"row":2,"rowSpan":2},{"role":"bullets","col":4,"span":22,"row":4,"rowSpan":14},{"role":"body","col":28,"span":28,"row":4,"rowSpan":34}],"accents":[{"type":"bar","col":26,"span":1,"row":4,"rowSpan":34,"color":"B7311A"},{"type":"line","col":4,"span":22,"row":3,"rowSpan":1,"color":"0A1628"}],"typography":{"body":{"size":13,"leading":"1.5","align":"left"},"bullets":{"size":14,"leading":"1.6"},"label":{"size":11,"transform":"uppercase","tracking":"0.12em","color":"0A1628"}},"bg":"FAF6EE","font":"Palatino"} -->
### PIPELINE
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