<!-- design: {"zones":[{"role":"body","col":6,"span":36,"row":6,"rowSpan":28}],"accents":[{"type":"bar","col":46,"span":1,"row":8,"rowSpan":20,"color":"B7311A"}],"typography":{"body":{"size":15,"leading":1.6}},"bg":"FAF6EE","font":"Palatino"} -->
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

<!-- design: {"zones":[{"role":"title","col":14,"span":36,"row":12,"rowSpan":14}],"accents":[{"type":"bar","col":10,"span":2,"row":6,"rowSpan":28,"color":"B7311A"}],"typography":{"title":{"size":44,"weight":700,"color":"FAF6EE","align":"center"}},"bg":"FAF6EE","font":"Futura"} -->
### SECTION FOUR
## 4. The Outer-Outer Loop

### Evolving the Methodology

<!-- notes: Section divider. The outer-outer loop is the most abstract and the hardest to describe. The key move is to show that it's not just "improving the process" in the generic sense, but that specific methodological decisions were made in response to specific failures of the outer loop itself. -->

---

<!-- design: {"zones":[{"role":"body","col":4,"span":38,"row":2,"rowSpan":12},{"role":"bullets","col":4,"span":34,"row":16,"rowSpan":22}],"accents":[{"type":"bar","col":0,"span":1,"row":0,"rowSpan":40,"color":"B7311A"}],"typography":{"body":{"size":14,"leading":1.55},"bullets":{"size":14}},"bg":"FAF6EE","font":"Palatino"} -->
### When the Outer Loop Isn't Enough

The outer loop catches rubric blind spots: the human sees something the rubric missed, the rubric gets updated. But the outer loop itself has blind spots:

- **Sampling bias**: early reviews looked at 5 "representative" slides out of 36. A broken slide in position 28 was invisible to the outer loop.
- **Aggregation masking**: per-dimension scores average across slides. One catastrophic slide gets diluted by 35 acceptable ones.
- **Instrument limitations**: the rubric used jsdom (no visual rendering). CSS-dependent issues — contrast, overflow, visual collision — were structurally invisible.

Each of these is a failure not of the rubric but of the **methodology around the rubric** — the sampling strategy, the aggregation method, the evaluation engine. Fixing them required changing the process, not the instrument.

<!-- notes: This is the conceptual leap the paper needs to land: the outer loop improves the rubric, the outer-outer loop improves the outer loop. It's turtles all the way down — or rather, feedback loops all the way out. The specific examples are important because they show that methodological improvements are triggered by the same mechanism as rubric improvements: a perception gap. "Why did we miss the broken slide at position 28?" is a meta-perception gap — we perceived a gap in our ability to perceive gaps. -->

---

<!-- design: {"zones":[{"role":"body","col":20,"span":36,"row":2,"rowSpan":10},{"role":"bullets","col":20,"span":36,"row":14,"rowSpan":24}],"accents":[{"type":"bar","col":16,"span":1,"row":2,"rowSpan":32,"color":"B7311A"}],"typography":{"body":{"size":14,"leading":1.55},"bullets":{"size":14}},"bg":"FAF6EE","font":"Palatino"} -->
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

<!-- design: {"zones":[{"role":"body","col":4,"span":40,"row":2,"rowSpan":10},{"role":"bullets","col":4,"span":40,"row":14,"rowSpan":24}],"accents":[],"typography":{"body":{"size":14,"leading":1.55},"bullets":{"size":14}},"bg":"FAF6EE","font":"Palatino"} -->
### From Aggregate Scores to Per-Slide Comparison

Outer-outer loop iteration 2:

- **Trigger**: the user said "the rubric is insufficiently critical." The overall score was 91%, but the user felt the deck was at best 70%.
- **Question**: why is the score higher than the user's assessment?
- **Answer**: dimension scores average across 36 slides. A few catastrophic slides are diluted by many acceptable ones. The overall score represents "average quality," not "minimum quality."
- **Decision**: implement per-slide wireframe comparison. Present intent-vs-reality pairs for every slide, not just aggregate scores.
- **Effect**: the wireframe comparison surfaced zone misplacements and content routing failures that aggregate metrics masked.

The wireframe tool itself was an outer-outer loop invention. It didn't exist until the methodology needed a new instrument to make the outer loop more precise.

<!-- notes: This iteration illustrates the interaction between loops. The outer loop said "rubric is too lenient" — a judgment about the instrument. But the fix wasn't a rubric formula change (outer loop fix). The fix was a new evaluation modality (wireframe comparison) — a methodological change. The outer-outer loop generated a new tool that made the outer loop more effective. This is the nesting in action: each loop creates the conditions for the loop inside it to work better. -->