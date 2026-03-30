<!-- design: {"zones":[{"role":"title","col":4,"span":30,"row":3,"rowSpan":6,"typography":{"size":36,"weight":700,"color":"0A1628"}},{"role":"body","col":4,"span":36,"row":11,"rowSpan":24,"typography":{"size":14,"leading":1.85}}],"accents":[{"type":"line","col":4,"span":28,"row":10,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Palatino"} -->
### CONTENT TYPES
### Large Table

| Rubric | Engine | A11y | Grid | Color | Coher. | Images | Content | Total |
|--------|--------|------|------|-------|--------|--------|---------|-------|
| v1 | headless | 10 | 10 | 10 | 10 | 10 | 10 | 60/60 |
| v2 | headless | 10 | 9.9 | 9 | 8.5 | 10 | 9.7 | 57.1/60 |
| v3 | headless | 10 | 10 | 9 | 10 | 8 | 7.5 | 54.5/60 |
| v4 | jsdom | 6.5 | 4 | 10 | 8.5 | 8 | 7 | 44/60 |
| v5 | headless | 10 | 10 | 10 | 10 | 10 | 8.5 | 58.5/60 |
| v6 | jsdom | 8 | 10 | 9.5 | 9 | 8 | 5.3 | 49.8/60 |
| v7 | both | 10 | 10 | 10 | 10 | 10 | 8.5 | 58.5/60 |

<!-- notes: 7-row, 9-column table. Tests dedicated table zone sizing (needs span >= 50, rowSpan >= 20). If rendered in a generic body zone, columns will truncate. -->

---

<!-- design: {"zones":[{"role":"title","col":28,"span":28,"row":4,"rowSpan":6,"typography":{"size":36,"weight":700,"align":"right","color":"0A1628"}},{"role":"body","col":28,"span":28,"row":12,"rowSpan":18,"typography":{"size":14,"leading":1.9,"align":"right"}}],"accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"0A1628"},{"type":"dot","col":26,"span":1,"row":7,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Palatino"} -->
### CONTENT TYPES
### Small Table

| Property | Value |
|----------|-------|
| Slides | 49 |
| Score | 44.8/60 |
| Collisions | 0 |

<!-- notes: Compact table (3 rows). Should render in a body zone without needing a dedicated table zone. Tests the table-in-body fallback. -->

---

<!-- design: {"zones":[{"role":"title","col":6,"span":48,"row":5,"rowSpan":8,"typography":{"size":44,"weight":400,"align":"center","color":"FAF6EE"}},{"role":"body","col":10,"span":40,"row":16,"rowSpan":16,"typography":{"size":14,"leading":1.9,"align":"center","color":"D6CCBA"}}],"accents":[{"type":"line","col":22,"span":16,"row":15,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Futura"} -->
### CONTENT TYPES
### Code Block (Short)

```javascript
const result = evaluate(deck);
if (result.score < target) {
  refine(deck, result.weakDimensions);
}
```

<!-- notes: Short code block (4 lines). Tests monospace rendering and code zone detection. Should get a dark background in composition. -->

---

<!-- design: {"zones":[{"role":"title","col":4,"span":24,"row":2,"rowSpan":5,"typography":{"size":36,"weight":700,"color":"0A1628"}},{"role":"body","col":4,"span":52,"row":9,"rowSpan":30,"typography":{"size":13,"leading":1.65}}],"accents":[{"type":"bar","col":58,"span":2,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"line","col":4,"span":52,"row":8,"rowSpan":1,"color":"D6CCBA"}],"bg":"D6CCBA","font":"Palatino"} -->
### CONTENT TYPES
### Code Block (Long)

```python
def concentric_loops(deck, rubric, methodology):
    """The three concentric feedback loops."""
    # Inner loop: automated optimization
    while not converged(deck, rubric):
        scores = evaluate(deck, rubric)
        weak = identify_weak_dimensions(scores)
        deck = fix(deck, weak)
        deck = render(deck)

    # Outer loop: human calibration
    human_feedback = present_to_user(deck, scores)
    if human_feedback.disagrees_with(scores):
        rubric = update_rubric(rubric, human_feedback)
        return concentric_loops(deck, rubric, methodology)

    # Outer-outer loop: methodology evolution
    if methodology.has_blind_spots(rubric, human_feedback):
        methodology = evolve(methodology)
        return concentric_loops(deck, rubric, methodology)

    return deck, rubric, methodology
```

<!-- notes: 20-line code block. Tests body zone capacity for long code. Needs rowSpan >= 28 and monospace font. If clipped, content completeness fails. -->

---

<!-- design: {"zones":[{"role":"quote","col":8,"span":44,"row":6,"rowSpan":16,"typography":{"size":28,"weight":400,"align":"center","color":"0A1628","leading":1.6}},{"role":"body","col":16,"span":28,"row":26,"rowSpan":6,"typography":{"size":12,"align":"center","color":"B8523A"}},{"role":"label","col":26,"span":8,"row":24,"rowSpan":2,"typography":{"size":10,"tracking":6,"transform":"uppercase","align":"center","color":"D6CCBA"}}],"accents":[{"type":"bar","col":0,"span":60,"row":0,"rowSpan":1,"color":"0A1628"},{"type":"bar","col":0,"span":60,"row":39,"rowSpan":1,"color":"0A1628"},{"type":"dot","col":29,"span":2,"row":4,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Palatino"} -->
### CONTENT TYPES
### Blockquote

> "The practitioner allows himself to experience surprise, puzzlement, or confusion in a situation which he finds uncertain or unique. He reflects on the phenomenon before him, and on the prior understandings which have been implicit in his behaviour."
> — Donald Schon, *The Reflective Practitioner* (1983)

This is body text after the blockquote. It should render below the quote, not overlap with it.

<!-- notes: Tests blockquote rendering with attribution. The body text after the quote tests content routing — both should be visible. -->