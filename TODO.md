# TODO

## Closed (2026-03-28)

- [x] Rubric v1→v6: 11 new metrics, shared scoring module, zone collision detection
- [x] Shared rubric-scores.js: single computeScores() imported by both engines
- [x] Zone collision detection in BOTH jsdom and Puppeteer paths (4 collisions found)
- [x] Every-slide screenshot pipeline: --screenshots-all captures all 36 slides
- [x] wireframe.js: ASCII wireframe diagrams from composed markdown for visual comparison
- [x] Zone collision detection: pure CSS rect intersection in rubric-jsdom.js
- [x] Duplicate text renderer bug: `renderedContent` tracking set in raster.js
- [x] Splice-images.js: default opacity subtle→visible, no longer blocks on content images
- [x] Source markdown: all 17 generic `alt="Image"` rewritten with descriptive text
- [x] evaluators/jsdom-rubric.js: fixed contentCompleteness→contentFidelity key mismatch
- [x] rubric-persist.js: fixed normalization bug (total/100 → total/max)
- [x] METHODOLOGY.md: outer (human) + inner (automated) loop documented
- [x] Skills revised: evaluate, refine-loop, refine-step, design, build-deck updated with inner/outer loop distinction
- [x] New /refine-step skill for /loop integration
- [x] Skill frontmatter: model, effort, context, allowed-tools added to 8 skills
- [x] 3 new splice integration tests (370 total, all passing)
- [x] RUBRIC-CHANGELOG.md documenting methodology evolution
- [x] Title size consolidation (8→4 in v11)
- [x] Table zone fixes (body→table role for table-content slides)
- [x] Empty-zone false positives: exempt slides with tables/images
- [x] Sparse-slide false positives: exempt title slide and dark dividers

## Open

### Rubric / Evaluation (outer loop)

- [ ] **Splice image visibility testing** — spliced images are invisible on dark backgrounds and barely visible on light ones. The rubric counts their presence but not their visual effectiveness. Need: (a) bump opacity further or use different blend mode, (b) add a rubric check for splice-image visibility (contrast against background).
- [ ] **jsdom image overlap false positives** — jsdom approximation flags 3 text-on-image overlaps that Puppeteer's bounding boxes don't confirm. Replace with CSS rect intersection (same approach as zone collision detection).
- [ ] **Visual utilization metric** — many slides are 80%+ whitespace. Add a metric: ratio of zone-covered area to total slide area. Slides below 30% utilization should be penalized.
- [ ] **Remaining 1 zone collision** — identify which slide still has a collision after the renderer fix and address it.

### Renderer / Composition

- [ ] **Bullet structure preservation** — 115 source bullets → 101 rendered (88% survival). 14 bullets lost during composition. Investigate and fix.
- [ ] **Compose.js table-content zone assignment** — every new compose assigns "body" zones to table-content slides. Compose should emit "table" role for slides whose primary content is a table.

### Design Database (self-improvement loop)

- [ ] **Wire deck-audit into outer loop** — run `node deck-audit.js` after each major evaluation to update corpus.
- [ ] **Corpus scores use inflated headless rubric** — deck-audit.js should use the unified rubric-scores.js.
- [ ] **Run corpus-synthesize.js to extract patterns** — cross-deck analysis to feed into future compose briefs.

### Infrastructure

- [ ] **Add zone-collision detection to splice-images.js** — splicer should check if images overlap content zones.
- [ ] **Design-lessons.md accumulation** — add rotation/summary mechanism.

## Recently Closed

- [x] Port CSS zone-collision detection to rubric-headless.js (both engines now find 4→1 collisions)
- [x] Every-slide evaluation (--screenshots-all captures all 36 slides)
- [x] Unify scoring (rubric-scores.js shared module)
- [x] Zone-extras collision fix (tables now render in body zones, renderedContent tracking)
- [x] wireframe.js ASCII layout diagrams for visual comparison
