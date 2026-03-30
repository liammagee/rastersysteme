<!-- design: {"zones":[{"role":"label","col":4,"span":18,"row":15,"rowSpan":3,"typography":{"size":10,"weight":400,"tracking":8,"transform":"uppercase","color":"FAF6EE"}},{"role":"title","col":4,"span":48,"row":18,"rowSpan":10,"typography":{"size":42,"weight":400,"color":"FAF6EE","leading":1.25}}],"accents":[{"type":"bar","col":56,"span":4,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"bar","col":0,"span":60,"row":0,"rowSpan":2,"color":"D6CCBA"},{"type":"line","col":4,"span":48,"row":30,"rowSpan":1,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Futura"} -->
### SECTION 6
## Section 6: Stress Tests & Edge Cases

<!-- notes: Section divider. Deliberate edge cases that should challenge composition and evaluation. -->

---

<!-- design: {"zones":[{"role":"title","col":4,"span":28,"row":2,"rowSpan":4,"typography":{"size":36,"weight":700,"color":"0A1628"}},{"role":"body","col":4,"span":52,"row":8,"rowSpan":30,"typography":{"size":13,"leading":1.6}}],"accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"line","col":4,"span":52,"row":7,"rowSpan":1,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Palatino"} -->
### STRESS TESTS
### ASCII Art (Large Code Block)

```
 OUTER-OUTER LOOP                                    cadence: days/weeks
 +---------------------------------------------------------------------+
 |  "Is our process of evaluating design itself improving?"            |
 |                                                                      |
 |   OUTER LOOP                                      cadence: hours     |
 |   +-----------------------------------------------------------+     |
 |   |  "Does the rubric match what the human sees?"              |     |
 |   |                                                            |     |
 |   |   INNER LOOP                              cadence: mins    |     |
 |   |   +-------------------------------------------------+     |     |
 |   |   |  "Is this deck better than the last iteration?"  |     |     |
 |   |   |                                                  |     |     |
 |   |   |  evaluate --> fix --> render --> re-evaluate      |     |     |
 |   |   +-------------------------------------------------+     |     |
 |   +-----------------------------------------------------------+     |
 +---------------------------------------------------------------------+
```

<!-- notes: Large ASCII diagram (16 lines). Tests code block rendering at full width. Needs body span >= 50 and rowSpan >= 24. If the code is truncated horizontally or vertically, content completeness fails catastrophically. -->

---

<!-- design: {"zones":[{"role":"title","col":4,"span":24,"row":2,"rowSpan":4,"typography":{"size":36,"weight":700,"color":"0A1628"}},{"role":"body","col":4,"span":24,"row":8,"rowSpan":28,"typography":{"size":13,"leading":1.6}},{"role":"bullets","col":32,"span":24,"row":8,"rowSpan":28,"typography":{"size":13,"leading":1.7}}],"accents":[{"type":"bar","col":30,"span":1,"row":8,"rowSpan":26,"color":"D6CCBA"},{"type":"line","col":4,"span":52,"row":7,"rowSpan":1,"color":"B8523A"}],"bg":"D6CCBA","font":"Palatino"} -->
### STRESS TESTS
### Maximum Density Slide

The rubric evolution traces a philosophical arc from absence-of-bad to presence-of-good:

| Version | Measured | Missed |
|---------|----------|--------|
| v1 | Absence of errors | Everything |
| v2 | + Variety | Monotony |
| v3 | + Banality | Emptiness |
| v4 | + Craft | Eyes |
| v5-v6 | + Structure | Taste |
| v7 | + Thresholds | Frontier |

- v1: 100% score, mediocre deck. Confident and wrong.
- v4: 75%, first honest score. The rubric learned craft.
- v6: 98%, but earned. Renderer bugs fixed, not rubric softened.
- v7: 57/60 on the strictest rubric. The deck earns it.

Each row was prompted by a human saying: "The rubric scored this well, but I can see it's not right."

<!-- notes: Maximum density: prose + table + bullets + prose. Tests whether body zone can hold all content types simultaneously. Needs span >= 48 and rowSpan >= 30. If any element clips, the rubric catches it. -->

---

<!-- design: {"zones":[{"role":"title","col":8,"span":44,"row":10,"rowSpan":18,"typography":{"size":96,"weight":700,"align":"center","color":"B8523A","tracking":4}}],"accents":[{"type":"bar","col":0,"span":60,"row":0,"rowSpan":1,"color":"0A1628"},{"type":"bar","col":0,"span":60,"row":39,"rowSpan":1,"color":"0A1628"},{"type":"dot","col":20,"span":2,"row":30,"rowSpan":1,"color":"0A1628"},{"type":"dot","col":38,"span":2,"row":30,"rowSpan":1,"color":"0A1628"}],"bg":"FAF6EE","font":"Futura"} -->
### STRESS TESTS
### Empty-Ish Slide (Intentional)

## 3.

<!-- notes: Almost empty. Just a section number. Tests sparseSlides and lowDensitySlides penalties. Should be exempted if it gets a dark background (divider). If cream, it will be penalized. This is a rubric calibration test. -->

---

<!-- design: {"zones":[{"role":"quote","col":6,"span":48,"row":8,"rowSpan":18,"typography":{"size":30,"weight":400,"align":"center","color":"FAF6EE","leading":1.5}},{"role":"label","col":22,"span":16,"row":28,"rowSpan":2,"typography":{"size":10,"tracking":6,"transform":"uppercase","align":"center","color":"D6CCBA"}}],"accents":[{"type":"bar","col":0,"span":3,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"bar","col":57,"span":3,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"dot","col":29,"span":2,"row":5,"rowSpan":1,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Palatino"} -->
### STRESS TESTS
### Slide With Only a Blockquote

> "When a measure becomes a target, it ceases to be a good measure."
> — Charles Goodhart (1975), paraphrased by Marilyn Strathern (1997)

<!-- notes: Quote-only slide. Tests whether compose creates a quote zone. If it creates a body zone, the quote loses its emphasis styling. Also tests whether the rubric penalizes this as sparse (it shouldn't — quotes are intentionally brief). -->