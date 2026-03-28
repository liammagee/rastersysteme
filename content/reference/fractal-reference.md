# Fractal Design Reference Deck

### A Comprehensive Stress Test for rastersysteme

<!-- notes: Title slide. This deck is designed to exercise every dimension of the rubric, every content type the renderer handles, and every failure mode documented in design-lessons.md. It serves as a baseline reference for the system — compose it, evaluate it, and the scores reveal the rubric's strengths and blind spots. -->

---

## Section 1: Content Types

<!-- notes: Section divider. The following slides test every content type the renderer supports. -->

---

### Simple Bullets

- First-level bullet point with moderate length text
- Second bullet with different content
- Third bullet to test spacing rhythm
- Fourth bullet to push body zone density
- Fifth bullet — minimum for a "normal" density slide

<!-- notes: Basic bullet slide. Should score well on content completeness. Tests body zone sizing for 5 bullets. -->

---

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

---

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

### Small Table

| Property | Value |
|----------|-------|
| Slides | 49 |
| Score | 44.8/60 |
| Collisions | 0 |

<!-- notes: Compact table (3 rows). Should render in a body zone without needing a dedicated table zone. Tests the table-in-body fallback. -->

---

### Code Block (Short)

```javascript
const result = evaluate(deck);
if (result.score < target) {
  refine(deck, result.weakDimensions);
}
```

<!-- notes: Short code block (4 lines). Tests monospace rendering and code zone detection. Should get a dark background in composition. -->

---

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

### Blockquote

> "The practitioner allows himself to experience surprise, puzzlement, or confusion in a situation which he finds uncertain or unique. He reflects on the phenomenon before him, and on the prior understandings which have been implicit in his behaviour."
> — Donald Schon, *The Reflective Practitioner* (1983)

This is body text after the blockquote. It should render below the quote, not overlap with it.

<!-- notes: Tests blockquote rendering with attribution. The body text after the quote tests content routing — both should be visible. -->

---

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

### Image Slide

![Kandinsky Composition VIII — concentric circles and intersecting lines on a cream ground](images/composition-viii.png)

<!-- notes: Tests image rendering and alt text quality. The alt text is descriptive (not generic "image"). If the image file doesn't exist, tests broken image handling. -->

---

### Links

Relevant resources for the concentric loops framework:

- [Schon, The Reflective Practitioner (1983)](https://example.com/schon)
- [Argyris, Double-Loop Learning (1977)](https://example.com/argyris)
- [Wiener, Cybernetics (1948)](https://example.com/wiener)
- [Licklider, Man-Computer Symbiosis (1960)](https://example.com/licklider)

<!-- notes: Tests link rendering. Links should be clickable in HTML output. Tests whether links get a body zone or fall to extras. -->

---

### Two Headings (Label + Title Pattern)

### METHODOLOGY

## The Outer Loop Protocol

Present the deck to the user. Collect qualitative feedback. Compare feedback to rubric scores. If they disagree, update the rubric. Re-evaluate.

<!-- notes: Tests the ### + ## pattern: first ### becomes sectionLabel, ## becomes title. Tests whether compose correctly maps two headings to two zone roles. -->

---

## Section 2: Layout Archetypes

<!-- notes: Section divider. The following slides should receive different layout archetypes during composition. Content is designed to be archetype-appropriate. -->

---

### Monument Layout

## The Rubric That Scored 100%

<!-- notes: Title-dominant slide. Should receive a monument/centered archetype: title spanning full width (span >= 48), vertically centered. Minimal content = sparse by design. -->

---

### Sidebar Layout Content

The distinction between single-loop and double-loop learning is structural, not just procedural. Single-loop learning corrects actions within existing governing variables. Double-loop learning questions the governing variables themselves.

In the context of AI-mediated design, the inner loop is single-loop: it corrects design decisions within the rubric's framework. The outer loop is double-loop: it questions whether the rubric's framework is correct.

The critical transition is always the same: when does the system stop trusting its own metric and ask the human?

<!-- notes: Prose-heavy slide. Should receive a sidebar or editorial archetype with a narrow body zone (span 30-40) for comfortable reading measure. Tests line-length optimization. -->

---

### Split Layout Content

| Cybernetics | AI |
|---|---|
| Norbert Wiener | John McCarthy |
| Co-operative | Competitive |
| Human-machine teams | Machine autonomy |
| Feedback governance | Self-improvement |
| "Cybernetics" — academic | "AI" — appeals to funders |

<!-- notes: Two-column comparison table. Should receive a split or wide layout. Tests table rendering with semantic column structure. -->

---

### Data-Dense Slide

Score progression across 8 outer loop iterations:

| # | Feedback | Change | Before | After |
|---|----------|--------|--------|-------|
| 1 | Scores maxing out | 11 new metrics | 100% | 95% |
| 2 | Missing spliced images | Duplicate detection | 95% | 91% |
| 3 | Rubric too lenient | Generic alt, sparse | 91% | 75% |
| 4 | Still too lenient | Calibrated exemptions | 75% | 87% |
| 5 | Need every slide | Shared scoring | 88% | 88% |
| 6 | CSS analysis | Rect collision | 88% | 98% |
| 7 | Wireframe intent | wireframe.js | — | — |
| 8 | Changelogs | Structured format | — | — |

<!-- notes: Dense data slide. Tests table zone sizing for 8 rows + header. Needs dedicated table zone with rowSpan >= 24. -->

---

### Minimal Slide

## Absence-of-Bad vs Presence-of-Good

<!-- notes: Intentionally sparse. Tests whether the rubric correctly handles section dividers (should be exempt from lowDensitySlides penalty if dark background). -->

---

### Image-Heavy Slide

![Wireframe diagram showing sidebar-left layout with title and body zones](images/wireframe-sidebar.png)

![Wireframe diagram showing editorial layout with centered narrow body](images/wireframe-editorial.png)

<!-- notes: Two images on one slide. Tests multi-image zone placement and whether the renderer creates separate image zones or stacks them. No body text — should NOT have a body zone. -->

---

## Section 3: Typography Stress Tests

<!-- notes: Section divider. The following slides test typographic edge cases. -->

---

### Long Title That Wraps Across Multiple Lines at Large Font Size

This slide tests whether the title zone has enough rowSpan to accommodate a title that wraps. If the title zone is rowSpan 4, this title will overflow and clip.

<!-- notes: Tests title zone overflow. The title is 70+ characters and at 44px will wrap to 2-3 lines. Needs title rowSpan >= 8. -->

---

### Short Title

Compensating with extended body text to test the visual balance between a minimal title and a substantial body. The typography hierarchy should be clear even when the title is only two words: size, weight, and spacing must do the work.

The body text continues for a second paragraph to add density. This tests whether the body zone can handle multiple paragraphs without clipping.

A third paragraph. The rubric should see this as a well-filled slide, not sparse.

<!-- notes: Tests small title with large body. The typography ratio should be clear (title >= 2x body size). Tests multi-paragraph body zone capacity. -->

---

## Section 4: Color & Contrast Edge Cases

<!-- notes: Section divider. The following slides are designed to test color handling during composition. The composer should assign appropriate palettes. -->

---

### Dark Background Candidate

## Fractal Design

### Recursive, Symbiotic, Generative

<!-- notes: This slide should receive a dark navy background during composition. Tests whether dark-bg typography auto-adapts (title color FAF6EE, not dark). The ### subtitle needs contrast too. -->

---

### Content for Mid-Tone Testing

When the background luminance falls between 0.2 and 0.5, both dark and light text can fail WCAG contrast requirements. This is the danger zone.

The safest approach: avoid mid-tones entirely. Use either light backgrounds (luminance > 0.7) or dark backgrounds (luminance < 0.15). The rubric catches mid-tone contrast failures, but the best fix is prevention.

<!-- notes: Tests whether composition avoids mid-tone backgrounds. If it assigns one, the rubric should flag contrast issues. -->

---

## Section 5: Accent & Whitespace

<!-- notes: Section divider. Tests accent placement and whitespace utilization. -->

---

### Accent-Worthy Slide

The concentric loops pattern applies wherever:

1. An AI system produces creative artifacts
2. Quality is partially but not fully formalizable
3. Automated evaluation is necessary but insufficient

The inner loop trusts the quality model. The outer loop questions it. The outer-outer loop questions how it's questioned.

<!-- notes: Good candidate for accent elements: numbered list with a closing statement. Tests accent placement (bar or line dividing list from conclusion). -->

---

### Whitespace-Heavy Slide

## The Gap

The distance between the score and the perception is not a bug.

It is the signal.

<!-- notes: Intentionally sparse prose on a content slide (not a divider). Tests whitespace-to-content ratio. The rubric should recognize this as a rhetorical choice, not a content failure — but currently may penalize it. -->

---

## Section 6: Stress Tests & Edge Cases

<!-- notes: Section divider. Deliberate edge cases that should challenge composition and evaluation. -->

---

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

### Empty-Ish Slide (Intentional)

## 3.

<!-- notes: Almost empty. Just a section number. Tests sparseSlides and lowDensitySlides penalties. Should be exempted if it gets a dark background (divider). If cream, it will be penalized. This is a rubric calibration test. -->

---

### Slide With Only a Blockquote

> "When a measure becomes a target, it ceases to be a good measure."
> — Charles Goodhart (1975), paraphrased by Marilyn Strathern (1997)

<!-- notes: Quote-only slide. Tests whether compose creates a quote zone. If it creates a body zone, the quote loses its emphasis styling. Also tests whether the rubric penalizes this as sparse (it shouldn't — quotes are intentionally brief). -->

---

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

## Section 7: Design Theory Tests

<!-- notes: Section divider. Slides that test whether the design system embodies classic design principles. -->

---

### Muller-Brockmann Grid Test

This slide should demonstrate intentional grid positioning:

- Title NOT at col:0 (offset for breathing room)
- Body zone with generous margins (not full-bleed)
- Vertical rhythm from consistent row spacing
- Horizontal alignment with neighboring slides

The 60-column grid is Muller-Brockmann's system made digital.

<!-- notes: Tests whether composition applies Swiss grid principles: offset positioning, margins, rhythm. The rubric measures nonDefaultRatio and zoneStarts variety. -->

---

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

---

### Arnheim Balance Test

This slide has intentionally asymmetric content:

A large block of text on the left side that creates visual weight through area and density. This paragraph is substantial enough to pull the visual center of gravity leftward.

The right side should have a small, dark accent element — a bar, dot, or image — that creates counterbalancing visual weight through contrast rather than area.

Does the composed slide feel balanced?

<!-- notes: Tests visual balance. Arnheim's principle: weight = luminance_inverse x area x distance_from_center. A large light zone can be balanced by a small dark accent. The rubric's balance dimension is null (visual-only). This slide tests whether composition intuitively creates balance even without measurement. -->

---

## Section 8: Fractal Design Self-Reference

<!-- notes: Section divider. The final section — the deck about fractal design, itself designed fractally. -->

---

### Recursive

The same observe-evaluate-adjust pattern repeats at every scale:

- **Slide level**: does this zone fit? Does the text clip? (inner loop, seconds)
- **Deck level**: does the rubric match perception? (outer loop, hours)
- **System level**: is the methodology itself improving? (outer-outer loop, days)

Like a fractal, the shape of the whole is repeated in the parts.

<!-- notes: Tests the recursive property of fractal design. The content describes the concept; the deck demonstrates it by being composed, evaluated, and refined through the same concentric loops. -->

---

### Symbiotic

The machine is fast, tireless, and literal — it optimizes against whatever metric it is given. The human is slow, selective, and perceptual — they see what the metric misses.

Neither is sufficient alone:
- Machine without human: polished mediocrity (Goodhart)
- Human without machine: bottlenecked review (can't check 36 slides every 2 minutes)

J.C.R. Licklider called this "man-computer symbiosis" in 1960 — the machine handles the routinizable, the human handles goals and criteria.

<!-- notes: Tests the symbiotic property. The slide itself is a collaboration: the human wrote the content, the machine composed the layout, the rubric evaluated the result, and the human judged whether the rubric was honest. -->

---

### Generative

The system produces complex quality through iteration of simple rules:

```
rule: evaluate → find the gap → fix it
apply at: slide level (inner loop)
apply at: rubric level (outer loop)
apply at: methodology level (outer-outer loop)
result: emergent quality that no single iteration could produce
```

"Generative AI" generates artifacts. Fractal design generates the criteria by which artifacts are judged.

<!-- notes: Tests the generative property. The code block contains the simple rule; the surrounding prose explains why iteration of that rule produces complexity. Tests code + prose mixed content. -->

---

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

## Appendix: Failure Mode Catalog

<!-- notes: Section divider. Slides deliberately designed to trigger known failure modes for rubric calibration testing. -->

---

### Failure: All Zones at Col:0

This slide's content should demonstrate what happens when every zone starts at column 0 with no horizontal offset. No margins, no breathing room, no Swiss grid discipline.

The text runs from the left edge. There is no visual hierarchy created by position — only by size and weight.

<!-- notes: Tests whether composition creates zones at col:0 (bad) vs offset positions (good). The rubric measures nonDefaultRatio — this slide should receive a non-zero col offset during composition. If it doesn't, it exposes a composition blind spot. -->

---

### Failure: Accent Overload

This slide has body text that should coexist with accent elements without being obscured.

The accent elements should be subtle visual punctuation — not decoration that competes with content for attention.

If every slide in the deck has accents, the rubric penalizes accent saturation (ratio > 0.85).

<!-- notes: Tests accent restraint. This slide's content explicitly discusses accent overload — if the composer adds heavy accents to THIS slide, it's ironic and demonstrates the Goodhart problem. -->

---

### Failure: Generic Alt Text

![Image](images/placeholder.png)

This slide has a generic alt text ("Image") which the rubric should penalize. Every image should have descriptive alt text.

<!-- notes: Deliberately uses generic alt="Image" to trigger the genericAltTotal penalty. Tests whether the rubric catches this. -->

---

### This Is the Last Slide

The reference deck is complete. It tested:

- 7 content types (bullets, tables, code, quotes, images, links, mixed)
- 7 layout archetypes (monument, sidebar, split, editorial, data-dense, minimal, image-heavy)
- 4 typography edge cases (long titles, short titles, hierarchy, font variety)
- 3 color scenarios (dark bg, mid-tone danger, palette variety)
- 4 design theory principles (Muller-Brockmann, Itten, Gestalt, Arnheim)
- 3 fractal design properties (recursive, symbiotic, generative)
- 5 deliberate failure modes (col:0, accent overload, generic alt, sparse, ASCII overflow)

Compose it. Evaluate it. The scores are the system's self-portrait.
