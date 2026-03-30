<!-- design: {"zones":[{"role":"title","col":8,"span":44,"row":13,"rowSpan":10,"typography":{"size":52,"weight":700,"tracking":2,"align":"center","color":"0A1628"}},{"role":"label","col":20,"span":20,"row":25,"rowSpan":3,"typography":{"size":10,"weight":400,"tracking":6,"transform":"uppercase","align":"center","color":"B8523A"}}],"accents":[{"type":"line","col":18,"span":24,"row":24,"rowSpan":1,"color":"B8523A"},{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"0A1628"}],"bg":"FAF6EE","font":"Futura"} -->
### TITLE
# Fractal Design Reference Deck

### A Comprehensive Stress Test for rastersysteme

<!-- notes: Title slide. This deck is designed to exercise every dimension of the rubric, every content type the renderer handles, and every failure mode documented in design-lessons.md. It serves as a baseline reference for the system — compose it, evaluate it, and the scores reveal the rubric's strengths and blind spots. -->

---

<!-- design: {"zones":[{"role":"label","col":6,"span":16,"row":12,"rowSpan":3,"typography":{"size":10,"weight":400,"tracking":8,"transform":"uppercase","color":"B8523A"}},{"role":"title","col":6,"span":40,"row":16,"rowSpan":10,"typography":{"size":44,"weight":400,"tracking":1,"color":"FAF6EE"}}],"accents":[{"type":"bar","col":4,"span":1,"row":12,"rowSpan":16,"color":"B8523A"},{"type":"line","col":6,"span":36,"row":28,"rowSpan":1,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Futura"} -->
### SECTION 1
## Section 1: Content Types

<!-- notes: Section divider. The following slides test every content type the renderer supports. -->

---

<!-- design: {"zones":[{"role":"title","col":4,"span":28,"row":3,"rowSpan":6,"typography":{"size":36,"weight":700,"color":"0A1628"}},{"role":"bullets","col":4,"span":40,"row":11,"rowSpan":26,"typography":{"size":14,"leading":2}}],"accents":[{"type":"line","col":4,"span":32,"row":10,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Palatino"} -->
### CONTENT TYPES
### Simple Bullets

- First-level bullet point with moderate length text
- Second bullet with different content
- Third bullet to test spacing rhythm
- Fourth bullet to push body zone density
- Fifth bullet — minimum for a "normal" density slide

<!-- notes: Basic bullet slide. Should score well on content completeness. Tests body zone sizing for 5 bullets. -->

---

<!-- design: {"zones":[{"role":"title","col":4,"span":52,"row":2,"rowSpan":4,"typography":{"size":36,"weight":700,"color":"0A1628"}},{"role":"body","col":4,"span":24,"row":8,"rowSpan":30,"typography":{"size":13,"leading":1.7}},{"role":"bullets","col":32,"span":24,"row":8,"rowSpan":30,"typography":{"size":13,"leading":1.6}}],"accents":[{"type":"bar","col":30,"span":1,"row":8,"rowSpan":28,"color":"D6CCBA"},{"type":"line","col":4,"span":52,"row":7,"rowSpan":1,"color":"B8523A"}],"bg":"D6CCBA","font":"Palatino"} -->
### CONTENT TYPES
### Nested Bullets

- Architecture layers
  - Presentation layer
    - React components
    - State management
  - Service layer
    - API routing
    - Business logic
  - Data layer
    - Database access
    - Caching
- Infrastructure
  - Container orchestration
  - CI/CD pipeline

<!-- notes: Deep nesting (3 levels). Tests renderer's indent handling and body zone rowSpan for dense nested content. -->

---

<!-- design: {"zones":[{"role":"title","col":30,"span":26,"row":3,"rowSpan":6,"typography":{"size":36,"weight":700,"align":"right","color":"0A1628"}},{"role":"bullets","col":2,"span":26,"row":3,"rowSpan":34,"typography":{"size":14,"leading":1.9}}],"accents":[{"type":"bar","col":58,"span":2,"row":0,"rowSpan":40,"color":"0A1628"},{"type":"dot","col":29,"span":1,"row":6,"rowSpan":1,"color":"B8523A"}],"bg":"FAF6EE","font":"Palatino"} -->
### CONTENT TYPES
### Dense Bullet Slide

- The inner loop optimizes against a formal quality model
- The outer loop calibrates the quality model against human perception
- The outer-outer loop evolves the calibration process itself
- Each loop operates at a different timescale: minutes, hours, days
- The loops are defined by their relationship to the quality model
- The inner loop trusts the quality model without question
- The outer loop questions whether the quality model is honest
- The outer-outer loop questions how the questioning is done
- Goodhart's Law applies: when the measure becomes the target, it ceases to be good
- The rubric that scored 100% was the most dangerous artifact in the system
- It was confident, precise, and wrong
- This slide has 12 bullets — it must not truncate

<!-- notes: 12 bullets. Tests body zone overflow handling. Requires rowSpan >= 28 and span >= 44. If any bullet is clipped, content completeness fails. -->