<!-- design: {"zones":[{"role":"title","col":4,"span":40,"row":3,"rowSpan":8,"typography":{"size":40,"weight":700,"color":"0A1628","leading":1.2}},{"role":"body","col":4,"span":36,"row":13,"rowSpan":24,"typography":{"size":14,"leading":1.75}}],"accents":[{"type":"line","col":4,"span":32,"row":12,"rowSpan":1,"color":"B8523A"},{"type":"bar","col":54,"span":6,"row":0,"rowSpan":40,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Palatino"} -->
### IMPROVEMENT
### Multiple Content Zones Slide

### EVIDENCE

## What Improved, and Who Improved It

| Improvement | Loop | Agent |
|-------------|------|-------|
| Layout variety metrics | Outer | Human |
| Zone collision fix | Outer + Infra | Human + Code |
| Body zone rowSpan | Inner | Automated |
| Sampling 5 to 36 | Outer-outer | Human |
| Wireframe tool | Outer-outer | Human |

No row says "the AI fixed the rubric." Only humans make structural changes.

<!-- notes: Tests maximum zone complexity: label (###) + title (##) + table + body prose. The composer must create 3-4 separate zones that don't collide. Tests the label→title→content hierarchy. -->

---

<!-- design: {"zones":[{"role":"label","col":4,"span":20,"row":13,"rowSpan":3,"typography":{"size":10,"weight":400,"tracking":8,"transform":"uppercase","color":"B8523A"}},{"role":"title","col":4,"span":52,"row":16,"rowSpan":12,"typography":{"size":44,"weight":400,"color":"FAF6EE","tracking":1,"leading":1.2}}],"accents":[{"type":"bar","col":0,"span":60,"row":0,"rowSpan":2,"color":"D6CCBA"},{"type":"bar","col":0,"span":60,"row":38,"rowSpan":2,"color":"D6CCBA"},{"type":"line","col":4,"span":52,"row":30,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Futura"} -->
### SECTION 7
## Section 7: Design Theory Tests

<!-- notes: Section divider. Slides that test whether the design system embodies classic design principles. -->

---

<!-- design: {"zones":[{"role":"title","col":28,"span":28,"row":3,"rowSpan":6,"typography":{"size":36,"weight":700,"align":"right","color":"0A1628"}},{"role":"body","col":28,"span":28,"row":10,"rowSpan":8,"typography":{"size":14,"leading":1.8,"align":"right"}},{"role":"bullets","col":28,"span":28,"row":20,"rowSpan":18,"typography":{"size":14,"leading":1.85,"align":"right"}}],"accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"0A1628"},{"type":"block","col":2,"span":24,"row":4,"rowSpan":32,"color":"D6CCBA"},{"type":"line","col":28,"span":28,"row":19,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Palatino"} -->
### DESIGN THEORY
### Muller-Brockmann Grid Test

This slide should demonstrate intentional grid positioning:

- Title NOT at col:0 (offset for breathing room)
- Body zone with generous margins (not full-bleed)
- Vertical rhythm from consistent row spacing
- Horizontal alignment with neighboring slides

The 60-column grid is Muller-Brockmann's system made digital.

<!-- notes: Tests whether composition applies Swiss grid principles: offset positioning, margins, rhythm. The rubric measures nonDefaultRatio and zoneStarts variety. -->

---

<!-- design: {"zones":[{"role":"title","col":4,"span":30,"row":2,"rowSpan":5,"typography":{"size":36,"weight":700,"color":"FAF6EE"}},{"role":"body","col":4,"span":52,"row":9,"rowSpan":28,"typography":{"size":13,"leading":1.65,"color":"D6CCBA"}}],"accents":[{"type":"bar","col":58,"span":2,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"line","col":4,"span":52,"row":8,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Palatino"} -->
### DESIGN THEORY
### Itten Color Contrast Test

The seven color contrasts Itten identified:

1. Contrast of hue (different hues)
2. Light-dark contrast (value difference)
3. Cold-warm contrast (temperature)
4. Complementary contrast (opposite hues)
5. Simultaneous contrast (afterimage effect)
6. Contrast of saturation (pure vs muted)
7. Contrast of extension (area ratios)

The rubric measures transition distance (contrast 1-2) and palette variety (contrast 4) but not temperature (contrast 3) or saturation (contrast 6).

<!-- notes: Tests color theory awareness. The numbered list maps to Itten's framework. Tests whether the composed palette demonstrates any named harmony. -->

---

<!-- design: {"zones":[{"role":"title","col":4,"span":24,"row":2,"rowSpan":4,"typography":{"size":36,"weight":700,"color":"0A1628"}},{"role":"body","col":4,"span":24,"row":8,"rowSpan":14,"typography":{"size":13,"leading":1.65}},{"role":"bullets","col":32,"span":24,"row":8,"rowSpan":30,"typography":{"size":13,"leading":1.6}}],"accents":[{"type":"bar","col":30,"span":1,"row":8,"rowSpan":28,"color":"B8523A"},{"type":"line","col":4,"span":24,"row":7,"rowSpan":1,"color":"D6CCBA"},{"type":"dot","col":2,"span":1,"row":4,"rowSpan":1,"color":"B8523A"}],"bg":"D6CCBA","font":"Palatino"} -->
### DESIGN THEORY
### Gestalt Proximity Test

Related items should be visually close:

**Inner loop tools:**
- rubric-jsdom.js (fast evaluation)
- rubric-headless.js (full evaluation)
- rubric-scores.js (shared formulas)

**Outer loop tools:**
- wireframe.js (intent comparison)
- visual-audit.js (bounding box analysis)
- run-uat.js (acceptance testing)

**Outer-outer loop artifacts:**
- RUBRIC-CHANGELOG.md (evolution log)
- METHODOLOGY.md (process document)
- design-lessons.md (accumulated rules)

<!-- notes: Tests whether the composer groups related content visually. The three groups should be proximate within their category and separated between categories. Currently, the rubric doesn't measure Gestalt proximity — this slide reveals the gap. -->