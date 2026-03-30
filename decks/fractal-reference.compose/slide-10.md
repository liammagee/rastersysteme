<!-- design: {"zones":[{"role":"title","col":4,"span":24,"row":2,"rowSpan":5,"typography":{"size":36,"weight":700,"color":"0A1628"}},{"role":"body","col":4,"span":52,"row":9,"rowSpan":30,"typography":{"size":13,"leading":1.65}}],"accents":[{"type":"line","col":4,"span":52,"row":8,"rowSpan":1,"color":"B8523A"},{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"0A1628"}],"bg":"FAF6EE","font":"Palatino"} -->
### SELF-REFERENCE
### The Postscript Pattern

This deck was composed, rendered, and evaluated using the system it describes.

| Dimension | Score |
|-----------|-------|
| Grid Utilization | _/10 |
| Color Harmonics | _/10 |
| Coherence & Variance | _/10 |
| Content Fidelity | _/10 |
| Image Integration | _/10 |
| Accessibility | _/10 |
| **Total** | **_/60** |

If this score is 100%, the rubric has learned nothing from evaluating this deck.

<!-- notes: The meta-moment. Leave scores blank — fill after evaluation. The final line is the thesis of the paper and the purpose of this reference deck: a perfect score is evidence of rubric failure, not deck success. -->

---

<!-- design: {"zones":[{"role":"label","col":4,"span":24,"row":11,"rowSpan":3,"typography":{"size":10,"weight":400,"tracking":8,"transform":"uppercase","color":"FAF6EE"}},{"role":"title","col":4,"span":52,"row":14,"rowSpan":14,"typography":{"size":44,"weight":700,"color":"B8523A","leading":1.2}}],"accents":[{"type":"bar","col":0,"span":60,"row":0,"rowSpan":2,"color":"B8523A"},{"type":"bar","col":0,"span":60,"row":38,"rowSpan":2,"color":"B8523A"},{"type":"line","col":4,"span":52,"row":30,"rowSpan":1,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Futura"} -->
### APPENDIX
## Appendix: Failure Mode Catalog

<!-- notes: Section divider. Slides deliberately designed to trigger known failure modes for rubric calibration testing. -->

---

<!-- design: {"zones":[{"role":"title","col":30,"span":26,"row":5,"rowSpan":8,"typography":{"size":44,"weight":400,"align":"right","color":"0A1628","leading":1.2}},{"role":"body","col":30,"span":26,"row":17,"rowSpan":10,"typography":{"size":15,"leading":2,"align":"right"}}],"accents":[{"type":"bar","col":0,"span":4,"row":0,"rowSpan":40,"color":"D6CCBA"},{"type":"dot","col":28,"span":1,"row":8,"rowSpan":1,"color":"B8523A"},{"type":"line","col":30,"span":26,"row":15,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Palatino"} -->
### FAILURE MODES
### Failure: All Zones at Col:0

This slide's content should demonstrate what happens when every zone starts at column 0 with no horizontal offset. No margins, no breathing room, no Swiss grid discipline.

The text runs from the left edge. There is no visual hierarchy created by position — only by size and weight.

<!-- notes: Tests whether composition creates zones at col:0 (bad) vs offset positions (good). The rubric measures nonDefaultRatio — this slide should receive a non-zero col offset during composition. If it doesn't, it exposes a composition blind spot. -->

---

<!-- design: {"zones":[{"role":"title","col":4,"span":28,"row":4,"rowSpan":6,"typography":{"size":36,"weight":700,"color":"FAF6EE"}},{"role":"body","col":4,"span":40,"row":12,"rowSpan":16,"typography":{"size":14,"leading":1.85,"color":"D6CCBA"}}],"accents":[{"type":"bar","col":56,"span":4,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"line","col":4,"span":40,"row":11,"rowSpan":1,"color":"D6CCBA"},{"type":"dot","col":2,"span":1,"row":7,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Palatino"} -->
### FAILURE MODES
### Failure: Accent Overload

This slide has body text that should coexist with accent elements without being obscured.

The accent elements should be subtle visual punctuation — not decoration that competes with content for attention.

If every slide in the deck has accents, the rubric penalizes accent saturation (ratio > 0.85).

<!-- notes: Tests accent restraint. This slide's content explicitly discusses accent overload — if the composer adds heavy accents to THIS slide, it's ironic and demonstrates the Goodhart problem. -->

---

<!-- design: {"zones":[{"role":"title","col":10,"span":40,"row":8,"rowSpan":10,"typography":{"size":48,"weight":400,"align":"center","color":"0A1628","leading":1.2}},{"role":"body","col":14,"span":32,"row":22,"rowSpan":8,"typography":{"size":15,"leading":2,"align":"center"}}],"accents":[{"type":"line","col":20,"span":20,"row":20,"rowSpan":1,"color":"B8523A"},{"type":"bar","col":0,"span":60,"row":0,"rowSpan":1,"color":"0A1628"},{"type":"bar","col":0,"span":60,"row":39,"rowSpan":1,"color":"0A1628"}],"bg":"D6CCBA","font":"Futura"} -->
### FAILURE MODES
### Failure: Generic Alt Text

![Image](images/placeholder.png)

This slide has a generic alt text ("Image") which the rubric should penalize. Every image should have descriptive alt text.

<!-- notes: Deliberately uses generic alt="Image" to trigger the genericAltTotal penalty. Tests whether the rubric catches this. -->