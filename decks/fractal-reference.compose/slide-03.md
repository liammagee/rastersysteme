<!-- design: {"zones":[{"role":"title","col":4,"span":24,"row":3,"rowSpan":5,"typography":{"size":36,"weight":700,"color":"0A1628"}},{"role":"body","col":4,"span":24,"row":10,"rowSpan":18,"typography":{"size":14,"leading":1.8}},{"role":"bullets","col":32,"span":24,"row":10,"rowSpan":18,"typography":{"size":14,"leading":1.9}}],"accents":[{"type":"line","col":4,"span":52,"row":9,"rowSpan":1,"color":"B8523A"},{"type":"bar","col":30,"span":1,"row":10,"rowSpan":16,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Palatino"} -->
### CONTENT TYPES
### Mixed Content: Bullets + Table

Key findings from the rubric evolution:

- Score progression was non-monotonic
- Grid scored 10/10 three times with three different meanings
- The rubric got stricter while the deck got better

| Phase | What improved | Who |
|-------|-------------|-----|
| v1-v4 | Rubric (more honest) | Human |
| v4-v6 | Artifact (bugs fixed) | Code |
| v6-v7 | Thresholds (demanding) | Human |

The inner loop contributed execution; the outer loop contributed judgment.

<!-- notes: Tests mixed content types on a single slide: bullets above table above prose. All three must render without overlap. Needs a body zone large enough for all content. -->

---

<!-- design: {"zones":[{"role":"title","col":12,"span":36,"row":10,"rowSpan":10,"typography":{"size":52,"weight":400,"align":"center","color":"0A1628","leading":1.3}},{"role":"body","col":16,"span":28,"row":24,"rowSpan":5,"typography":{"size":14,"align":"center","color":"B8523A"}}],"accents":[{"type":"dot","col":29,"span":2,"row":8,"rowSpan":1,"color":"B8523A"},{"type":"line","col":20,"span":20,"row":22,"rowSpan":1,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Futura"} -->
### CONTENT TYPES
### Image Slide

![Kandinsky Composition VIII — concentric circles and intersecting lines on a cream ground](images/composition-viii.png)

<!-- notes: Tests image rendering and alt text quality. The alt text is descriptive (not generic "image"). If the image file doesn't exist, tests broken image handling. -->

---

<!-- design: {"zones":[{"role":"title","col":30,"span":26,"row":2,"rowSpan":5,"typography":{"size":36,"weight":700,"align":"right","color":"FAF6EE"}},{"role":"body","col":30,"span":26,"row":8,"rowSpan":4,"typography":{"size":12,"align":"right","color":"D6CCBA"}},{"role":"bullets","col":30,"span":26,"row":14,"rowSpan":22,"typography":{"size":14,"leading":1.9,"align":"right","color":"FAF6EE"}}],"accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"line","col":30,"span":26,"row":13,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Palatino"} -->
### CONTENT TYPES
### Links

Relevant resources for the concentric loops framework:

- [Schon, The Reflective Practitioner (1983)](https://example.com/schon)
- [Argyris, Double-Loop Learning (1977)](https://example.com/argyris)
- [Wiener, Cybernetics (1948)](https://example.com/wiener)
- [Licklider, Man-Computer Symbiosis (1960)](https://example.com/licklider)

<!-- notes: Tests link rendering. Links should be clickable in HTML output. Tests whether links get a body zone or fall to extras. -->

---

<!-- design: {"zones":[{"role":"title","col":6,"span":48,"row":8,"rowSpan":12,"typography":{"size":44,"weight":700,"align":"center","color":"0A1628","tracking":1}},{"role":"body","col":14,"span":32,"row":24,"rowSpan":5,"typography":{"size":13,"align":"center","color":"B8523A"}}],"accents":[{"type":"line","col":18,"span":24,"row":22,"rowSpan":1,"color":"D6CCBA"},{"type":"bar","col":58,"span":2,"row":0,"rowSpan":40,"color":"0A1628"},{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"0A1628"}],"bg":"D6CCBA","font":"Futura"} -->
### OUTER LOOP
### Two Headings (Label + Title Pattern)

### METHODOLOGY

## The Outer Loop Protocol

Present the deck to the user. Collect qualitative feedback. Compare feedback to rubric scores. If they disagree, update the rubric. Re-evaluate.

<!-- notes: Tests the ### + ## pattern: first ### becomes sectionLabel, ## becomes title. Tests whether compose correctly maps two headings to two zone roles. -->

---

<!-- design: {"zones":[{"role":"label","col":4,"span":20,"row":14,"rowSpan":3,"typography":{"size":10,"weight":400,"tracking":8,"transform":"uppercase","color":"B8523A"}},{"role":"title","col":4,"span":44,"row":17,"rowSpan":10,"typography":{"size":44,"weight":400,"color":"FAF6EE","tracking":1}}],"accents":[{"type":"bar","col":56,"span":4,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"line","col":4,"span":40,"row":29,"rowSpan":1,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Futura"} -->
### SECTION 2
## Section 2: Layout Archetypes

<!-- notes: Section divider. The following slides should receive different layout archetypes during composition. Content is designed to be archetype-appropriate. -->