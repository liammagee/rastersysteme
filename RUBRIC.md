# Design Rubric — rastersysteme

A multi-dimensional evaluation framework for slide deck design quality.
Each dimension is scored 1–10. Total possible: 80 points.

---

## 1. Accessibility (A11Y)

Can every viewer read and perceive the content?

| Score | Criteria |
|-------|----------|
| 1–3 | Multiple WCAG AA failures: contrast errors (<3:1 large, <4.5:1 body), text <11px, broken images, unreadable content |
| 4–5 | Passes AA for most text but has warnings: some labels below 4.5:1, minor overflow on 2–3 slides, font loading issues |
| 6–7 | Full AA compliance: all text passes contrast minimums, no broken images, no overflow, fonts loaded, readable at projection distance |
| 8–9 | Exceeds AA: generous contrast margins (>5:1 body, >4:1 large), consistent font sizing, dark/light adaptation works perfectly |
| 10 | AAA-level: >7:1 body contrast, scalable at all viewport sizes, fully navigable, semantic slide structure, alt text on all images |

**Computed metrics:**
- `contrastErrors`: WCAG AA failures (<3:1 large, <4.5:1 body) — 2pt penalty each
- `contrastWarnings`: near-miss contrast (2:1–4.5:1) — 0.3pt penalty each
- `tinyTextCount`: text elements below 12px font-size floor — 0.3pt penalty each
- `overflows`: text-bearing elements extending beyond slide bounds (ignoring decorative accents) — 0.2pt penalty each, capped at 2
- `brokenImgs`: images that failed to load — 2pt penalty each

---

## 2. Communicability

Does the design serve the content's meaning?

| Score | Criteria |
|-------|----------|
| 1–3 | Design obscures content: key text hidden, hierarchy unclear, information density either overwhelming or wasteful, reader can't find the point |
| 4–5 | Content is present but hierarchy is flat: titles don't stand out from body, bullets run together, quotes not distinguished, no visual entry point |
| 6–7 | Clear hierarchy: title → body → detail reads naturally, emphasis (bold, size, color) guides attention, information density matches content weight |
| 8–9 | Design amplifies meaning: section transitions signal topic shifts, visual rhythm matches argument pace, dense slides feel structured not chaotic |
| 10 | Design IS communication: layout choices encode meaning (e.g., a split layout for a comparison, a fragment grid for a taxonomy, whitespace for a pause) |

**Assessed by:** Claude visual review — does the design help you understand the content faster?

---

## 3. Taste & Aesthetic Quality

Does the design exhibit visual sophistication and restraint?

| Score | Criteria |
|-------|----------|
| 1–3 | Generic or chaotic: default template feel, clashing elements, inconsistent spacing, decoration without purpose, "PowerPoint default" energy |
| 4–5 | Competent but unremarkable: consistent but bland, safe color choices, no visual tension or surprise, could be any corporate deck |
| 6–7 | Distinctive: a recognizable aesthetic system, deliberate font pairing, considered color palette, accents used with restraint, feels authored |
| 8–9 | Swiss/modernist quality: Müller-Brockmann-level grid discipline, type as primary design element, color as signal not decoration, every element earns its place |
| 10 | Exhibition-grade: could be printed as a poster series, shows awareness of design history, balances rigor with warmth, the system itself is beautiful |

**Assessed by:** Claude visual review against Swiss design principles — Neue Grafik, Armin Hofmann, Karl Gerstner.

---

## 4. Grid Utilization

How well does the design exploit the 60-column × 40-row grid?

| Score | Criteria |
|-------|----------|
| 1–3 | Grid ignored: zones centered by default, no col/span variety, all zones start at col 0 or col 10, no asymmetry, content floats |
| 4–5 | Basic grid use: zones align to grid but repetitive positions, same archetype every slide, no use of offset or margin columns |
| 6–7 | Deliberate grid use: 3–4 zone archetypes rotating, titles use varied col positions (6, 10, 30), body spans vary (24–48), margins breathe |
| 8–9 | Sophisticated grid: asymmetric layouts that feel balanced, narrow-measure body text for readability, zones reference each other (e.g., body starts where title accent ends), gutters as design element |
| 10 | Virtuosic grid: each slide a unique composition that still belongs to the system, mathematical proportions visible (golden section, ÷12 divisions), the grid itself is part of the visual language |

**Measurable:** col/span distribution, archetype rotation frequency, margin utilization, alignment consistency.

---

## 5. Color Harmonics

Does the color system work as a unified composition across the deck?

| Score | Criteria |
|-------|----------|
| 1–3 | Colors clash or are arbitrary: no coherent palette, accent colors fight each other, dark/light transitions feel random, no tonal logic |
| 4–5 | Palette exists but mechanical: colors repeat predictably, no chromatic arc, dark slides feel disconnected from light ones, accents unused or overused |
| 6–7 | Coherent palette: 4–5 colors with clear roles (ground, dominant, accent, signal), chromatic arc creates rhythm (light → dark → light), accents punctuate not saturate |
| 8–9 | Harmonic system: color transitions feel musical, dark divider slides create breathing points, accent colors reserved for emphasis (not decoration), palette evokes a specific mood |
| 10 | Color as narrative: the chromatic arc traces the content's emotional shape, palette could be exhibited as a color study, each slide's bg choice is motivated by meaning |

**Measurable:** palette extraction, contrast ratios between all pairs, chromatic arc distance between adjacent slides, accent frequency.

---

## 6. Layout Balance

Does each slide feel visually balanced?

| Score | Criteria |
|-------|----------|
| 1–3 | Unbalanced: content piled in one corner, vast empty areas with no purpose, elements collide, visual weight concentrated unevenly |
| 4–5 | Functional but static: content evenly distributed but without tension, centred layouts that feel safe, no asymmetric energy |
| 6–7 | Balanced with intention: asymmetric layouts that feel stable, whitespace is functional (gives content room), visual weight distributed across zones |
| 8–9 | Dynamic balance: visual tension between zones (a heavy title balanced by a light body), accents act as visual counterweights, the eye moves through a deliberate path |
| 10 | Compositional mastery: each slide has a centre of gravity that shifts meaningfully, negative space is as designed as positive space, could be analyzed as a composition study |

**Assessed by:** Claude visual review — does the slide feel "right" or does something pull your eye uncomfortably?

---

## 7. Coherence & Variance

Does the deck feel unified yet avoid monotony?

| Score | Criteria |
|-------|----------|
| 1–3 | Either repetitive (every slide looks the same) or chaotic (no two slides relate), no system, no rhythm |
| 4–5 | Consistent but monotonous: same layout, same colors, same accent position — the system is there but it doesn't breathe |
| 6–7 | Unified with variation: 3–4 archetypes rotate, font alternation follows a rule (e.g., Georgia on reflective slides), bg colors follow a chromatic arc, no 3× consecutive repeats |
| 8–9 | Systematic variety: each slide is recognizably part of the family yet individually composed, the variation follows the content (dense slides get different treatment from sparse ones), transitions between sections are marked by design shifts |
| 10 | Theme and variations: the deck reads like a musical composition — an overture, development, recapitulation. Every slide is both unique and inevitable. The system generates variety rather than constraining it |

**Measurable:** layout type distribution, consecutive repeat count, bg color variety, font alternation pattern, accent placement variety.

---

## 8. Image Integration

How well do images work within the design system?

| Score | Criteria |
|-------|----------|
| 1–3 | Images fight the design: overlapping text, inconsistent sizing, no relationship to the grid, broken or missing images |
| 4–5 | Images present but disconnected: always in the same corner, generic placement, no relationship to slide content or zone layout |
| 6–7 | Images complement the design: placement varies by slide layout, images sized to fit available space, no text collisions, opacity appropriate for readability |
| 8–9 | Images as design elements: placement follows the grid, images have a visual thread (consistent palette/motif), the deck reads differently with and without images — both work |
| 10 | Images and design are inseparable: each image's position is as deliberate as the text zones, the visual thread adds a narrative layer, image-text relationships create meaning beyond either alone |

**Computed metrics:**
- `textOnImageCount`: text elements whose bounding box overlaps an image by >30% area, where image opacity >0.2 (>0.5 opacity requires only 30% overlap; 0.2–0.5 opacity requires >70%) — 0.5pt penalty each, capped at 6
- `imgPlacements`: set of placement positions used (right, left, top, bottom, centre) — 2pt penalty if fewer than 3 positions
- `imgOverlaps`: total bounding-box text-image intersections (same as textOnImageCount)
- `totalImgs`: total images across deck — 1pt penalty if fewer than 20% of slides have images

---

## 9. Content Completeness

Does the rendered output preserve all source text and images?

| Score | Criteria |
|-------|----------|
| 1–3 | Major content loss: >20% of source text or >50% of source images missing from rendered output, entire slides dropped or empty |
| 4–5 | Moderate loss: 10–20% text missing, some images dropped by layout (arc, stagger, etc.), body text truncated on dense slides |
| 6–7 | Minor loss: <10% text missing, all images present but some may overflow or be clipped, no dropped slides |
| 8–9 | Near-complete: all source text and images render visibly, URLs/citations/references preserved, tables intact, only cosmetic trimming |
| 10 | Perfect fidelity: every source image appears in HTML, every text block renders visibly, all URLs/links/citations preserved, slide count matches source |

**Computed metrics:**
- `emptyBodyZones`: body/bullets/quote zones that render with no text content — 0.5pt penalty each
- `contentlessSlides`: slides with neither text nor images — 2pt penalty each
- `tableTruncations`: tables wider than container, or rows hidden by overflow clipping — 1pt penalty each
- `clippedContentSlides`: slides where overflow:hidden clips visible text inside a zone — 1.5pt penalty each
- `slidesWithNoVisibleText`: slides whose total visible text is under 5 characters — 2pt penalty each
- `perSlideTextLen`: array of visible character counts per slide (for diagnostics)

---

## Scoring Summary

| Dimension | Weight | Method | Headless |
|-----------|--------|--------|----------|
| Accessibility | 1× | Computed (Puppeteer audit) | Yes |
| Communicability | 1× | Visual (Claude assessment) | No (stub) |
| Taste | 1× | Visual (Claude assessment) | No (stub) |
| Grid Utilization | 1× | Computed (zone analysis) | Yes |
| Color Harmonics | 1× | Computed (palette analysis) | Yes |
| Layout Balance | 1× | Visual (Claude assessment) | No (stub) |
| Coherence & Variance | 1× | Computed (variety metrics) | Yes |
| Image Integration | 1× | Computed (overlap detection) | Yes |
| Content Completeness | 1× | Computed (rendered audit) | Yes |

**Total: /90** → headless evaluator computes 6/9 dimensions (/60). Visual-only dimensions (Communicability, Taste, Balance) require Claude vision assessment and are reported as "—" in headless mode.

### Quality tiers

| Score | Tier |
|-------|------|
| 85–100 | Exhibition — publishable design quality |
| 70–84 | Professional — strong, distinctive, few issues |
| 55–69 | Competent — functional with room for improvement |
| 40–54 | Draft — needs significant design work |
| <40 | Broken — accessibility failures, missing content |
