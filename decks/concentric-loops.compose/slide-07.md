<!-- design: {"zones":[{"role":"label","col":2,"span":12,"row":4,"rowSpan":2},{"role":"body","col":4,"span":36,"row":8,"rowSpan":24}],"accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"B7311A"},{"type":"line","col":4,"span":36,"row":7,"rowSpan":1,"color":"E5DFD3"}],"typography":{"body":{"size":16,"leading":"1.75","align":"left"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"B7311A"}},"bg":"E5DFD3","font":"Palatino"} -->
### INFRA
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

<!-- design: {"zones":[{"role":"label","col":48,"span":10,"row":2,"rowSpan":2},{"role":"body","col":18,"span":38,"row":4,"rowSpan":16},{"role":"bullets","col":18,"span":38,"row":22,"rowSpan":16}],"accents":[{"type":"bar","col":16,"span":1,"row":4,"rowSpan":34,"color":"B7311A"},{"type":"line","col":18,"span":38,"row":21,"rowSpan":1,"color":"0A1628"}],"typography":{"body":{"size":14,"leading":"1.6","align":"left"},"bullets":{"size":14,"leading":"1.55"},"label":{"size":11,"transform":"uppercase","tracking":"0.12em","color":"0A1628"}},"bg":"FAF6EE","font":"Palatino"} -->
### AUTOMATION
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

<!-- design: {"zones":[{"role":"title","col":4,"span":52,"row":15,"rowSpan":10}],"accents":[{"type":"bar","col":2,"span":1,"row":10,"rowSpan":20,"color":"B7311A"},{"type":"line","col":4,"span":52,"row":26,"rowSpan":1,"color":"FAF6EE"}],"typography":{"title":{"size":48,"weight":700,"tracking":"0.02em","align":"left","color":"FAF6EE"}},"bg":"FAF6EE","font":"Futura"} -->
### SECTION
## 6. Results

### week-2 Through the Loops

<!-- notes: Section divider. This section presents the empirical data. The key message is not "scores went up" but "what kind of improvement happened at each stage, and who or what caused it." -->

---

<!-- design: {"zones":[{"role":"label","col":2,"span":12,"row":3,"rowSpan":2},{"role":"body","col":2,"span":30,"row":6,"rowSpan":18},{"role":"bullets","col":2,"span":30,"row":26,"rowSpan":12}],"accents":[{"type":"line","col":2,"span":30,"row":25,"rowSpan":1,"color":"B7311A"},{"type":"block","col":36,"span":22,"row":0,"rowSpan":40,"color":"E5DFD3"}],"typography":{"body":{"size":14,"leading":"1.6","align":"left"},"bullets":{"size":14,"leading":"1.55"},"label":{"size":12,"transform":"uppercase","tracking":"0.1em","color":"B7311A"}},"bg":"FAF6EE","font":"Palatino"} -->
### FINDINGS
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

<!-- design: {"zones":[{"role":"label","col":46,"span":12,"row":1,"rowSpan":2},{"role":"body","col":2,"span":56,"row":3,"rowSpan":36}],"accents":[{"type":"line","col":2,"span":56,"row":2,"rowSpan":1,"color":"B7311A"},{"type":"dot","col":52,"span":4,"row":1,"rowSpan":2,"color":"B7311A"}],"typography":{"body":{"size":13,"leading":"1.5","align":"left","columns":2},"label":{"size":11,"transform":"uppercase","tracking":"0.12em","color":"0A1628"}},"bg":"E5DFD3","font":"Palatino"} -->
### DATA
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