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

- [ ] **Port CSS zone-collision detection to rubric-headless.js** — jsdom finds 4 collision slides, headless finds 0. The headless Puppeteer path has real bounding boxes but doesn't run the collision check. Integrate visual-audit.js findings into rubric scoring.
- [ ] **Every-slide evaluation** — screenshot and assess ALL 36 slides, not a sample of 5. One broken slide in 36 gets averaged away. The visual-audit.js already does per-slide analysis; wire its output into the rubric pipeline.
- [ ] **Splice image visibility testing** — spliced images are invisible on dark backgrounds and barely visible on light ones. The rubric counts their presence but not their visual effectiveness. Need: (a) bump opacity further or use different blend mode, (b) add a rubric check for splice-image visibility (contrast against background).
- [ ] **jsdom image overlap false positives** — jsdom approximation flags 3 text-on-image overlaps that Puppeteer's bounding boxes don't confirm. The approximation formula (`textEls.length * 0.1`) is too aggressive. Replace with CSS rect intersection (same approach as zone collision detection).
- [ ] **Visual utilization metric** — many slides are 80%+ whitespace. The rubric doesn't penalize wasted space. Add a metric: ratio of zone-covered area to total slide area. Slides below 30% utilization with no intentional design purpose should be penalized.

### Renderer / Composition

- [ ] **Zone-extras collision with design zones** — raster.js creates zone-extras (fallback wrapper) that overlaps with design zones on many slides. The extras block should not render content that was already placed by a design zone. Current `renderedContent` tracking covers links and titles but not body/bullets fallback in extras.
- [ ] **Bullet structure preservation** — 115 source bullets → 101 rendered (88% survival). 14 bullets lost during composition. Investigate which slides lose bullets and whether the compose step is converting them to paragraphs.
- [ ] **Compose.js table-content zone assignment** — every new compose assigns "body" zones to table-content slides, which then render empty (content goes to table element, not body text). Compose should emit "table" role for slides whose primary content is a table.

### Design Database (self-improvement loop)

- [ ] **Wire deck-audit into outer loop** — after each major evaluation, run `node deck-audit.js` to update the corpus with fingerprints + scores. Currently runs ad-hoc.
- [ ] **Corpus scores use inflated headless rubric** — deck-audit.js records headless scores (which lack collision detection). Need to use the jsdom or combined score instead.
- [ ] **Run corpus-synthesize.js to extract patterns** — cross-deck analysis should identify which design patterns score highest and feed into future compose briefs.

### Infrastructure

- [ ] **Unify rubric-jsdom.js and rubric-headless.js scoring** — two parallel scoring engines that keep diverging. Extract `computeScores()` into a shared module imported by both. Metric collection stays engine-specific (jsdom vs Puppeteer) but scoring logic should be single-source.
- [ ] **Add zone-collision detection to splice-images.js** — the splicer places images without checking if they overlap with content zones. Use the same CSS rect intersection approach.
- [ ] **Design-lessons.md accumulation** — the rubric appends lessons after each eval but they accumulate indefinitely. Add a rotation/summary mechanism.
