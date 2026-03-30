<!-- design: {"zones":[{"role":"title","col":4,"span":24,"row":6,"rowSpan":8,"typography":{"size":44,"weight":700,"color":"0A1628","leading":1.2}},{"role":"body","col":4,"span":30,"row":18,"rowSpan":10,"typography":{"size":15,"leading":2}}],"accents":[{"type":"line","col":4,"span":20,"row":16,"rowSpan":1,"color":"B8523A"},{"type":"bar","col":54,"span":6,"row":0,"rowSpan":40,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Palatino"} -->
### EVALUATION
### Image-Heavy Slide

![Wireframe diagram showing sidebar-left layout with title and body zones](images/wireframe-sidebar.png)

![Wireframe diagram showing editorial layout with centered narrow body](images/wireframe-editorial.png)

<!-- notes: Two images on one slide. Tests multi-image zone placement and whether the renderer creates separate image zones or stacks them. No body text — should NOT have a body zone. -->

---

<!-- design: {"zones":[{"role":"label","col":36,"span":20,"row":13,"rowSpan":3,"typography":{"size":10,"weight":400,"tracking":8,"transform":"uppercase","align":"right","color":"D6CCBA"}},{"role":"title","col":8,"span":48,"row":16,"rowSpan":12,"typography":{"size":42,"weight":400,"align":"right","color":"FAF6EE","tracking":1}}],"accents":[{"type":"bar","col":0,"span":4,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"line","col":8,"span":48,"row":30,"rowSpan":1,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Futura"} -->
### SECTION 3
## Section 3: Typography Stress Tests

<!-- notes: Section divider. The following slides test typographic edge cases. -->

---

<!-- design: {"zones":[{"role":"title","col":12,"span":36,"row":8,"rowSpan":12,"typography":{"size":52,"weight":400,"align":"center","color":"0A1628","leading":1.2}},{"role":"body","col":16,"span":28,"row":24,"rowSpan":6,"typography":{"size":14,"align":"center","color":"B8523A"}}],"accents":[{"type":"dot","col":10,"span":2,"row":12,"rowSpan":1,"color":"B8523A"},{"type":"dot","col":48,"span":2,"row":12,"rowSpan":1,"color":"B8523A"},{"type":"line","col":20,"span":20,"row":22,"rowSpan":1,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Futura"} -->
### TYPOGRAPHY
### Long Title That Wraps Across Multiple Lines at Large Font Size

This slide tests whether the title zone has enough rowSpan to accommodate a title that wraps. If the title zone is rowSpan 4, this title will overflow and clip.

<!-- notes: Tests title zone overflow. The title is 70+ characters and at 44px will wrap to 2-3 lines. Needs title rowSpan >= 8. -->

---

<!-- design: {"zones":[{"role":"title","col":30,"span":26,"row":4,"rowSpan":6,"typography":{"size":36,"weight":700,"align":"right","color":"0A1628"}},{"role":"body","col":30,"span":26,"row":12,"rowSpan":16,"typography":{"size":14,"leading":1.85,"align":"right"}}],"accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"0A1628"},{"type":"line","col":30,"span":26,"row":11,"rowSpan":1,"color":"B8523A"},{"type":"block","col":2,"span":24,"row":6,"rowSpan":28,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Palatino"} -->
### TYPOGRAPHY
### Short Title

Compensating with extended body text to test the visual balance between a minimal title and a substantial body. The typography hierarchy should be clear even when the title is only two words: size, weight, and spacing must do the work.

The body text continues for a second paragraph to add density. This tests whether the body zone can handle multiple paragraphs without clipping.

A third paragraph. The rubric should see this as a well-filled slide, not sparse.

<!-- notes: Tests small title with large body. The typography ratio should be clear (title >= 2x body size). Tests multi-paragraph body zone capacity. -->

---

<!-- design: {"zones":[{"role":"label","col":4,"span":24,"row":12,"rowSpan":3,"typography":{"size":10,"weight":400,"tracking":8,"transform":"uppercase","color":"B8523A"}},{"role":"title","col":4,"span":52,"row":15,"rowSpan":14,"typography":{"size":40,"weight":400,"color":"FAF6EE","leading":1.25}}],"accents":[{"type":"bar","col":56,"span":4,"row":0,"rowSpan":40,"color":"B8523A"},{"type":"bar","col":0,"span":60,"row":38,"rowSpan":2,"color":"D6CCBA"}],"bg":"FAF6EE","font":"Futura"} -->
### SECTION 4
## Section 4: Color & Contrast Edge Cases

<!-- notes: Section divider. The following slides are designed to test color handling during composition. The composer should assign appropriate palettes. -->