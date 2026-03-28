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

- [x] **Splice image visibility** — opacity bumped (visible mode), mix-blend-mode:luminosity for backgrounds, inset frame (box-shadow+border), low-opacity diagnostic in rubric. The rubric counts their presence but not their visual effectiveness. Need: (a) bump opacity further or use different blend mode, (b) add a rubric check for splice-image visibility (contrast against background).
- [x] **jsdom image overlap false positives** — replaced approximation with CSS rect intersection. 4→0 false positives.
- [x] **Visual utilization metric** — slides below 25% zone coverage penalized. lowUtilizationSlides in rubric-scores.js.
- [x] **Remaining zone collisions** — fixed in week-2-v11 (0 collisions) and week-4 (label→title zone role fix)

### Renderer / Composition

- [x] **Bullet structure preservation** — false alarm: 18 "lost" bullets are in commented-out case study section. All intended bullets render correctly.
- [x] **Compose.js table/title zone guidance** — prompt now instructs Claude to use "table" for table slides and "title" for headings (not "label"). Tested.

### Design Database (self-improvement loop)

- [x] **Wire deck-audit into outer loop** — deck-audit.js scans 69 decks, 9 scored. Runs after evaluation.
- [x] **Run corpus-synthesize.js** — extracted data-driven rules into design-insights.md from 9 scored decks.
- [x] **Corpus scores** — by design, scores reflect the rubric version at evaluation time. Re-evaluate decks with `node run-rubric-eval.js <deck> --json` to update scorecards with current rubric.

### Paper / Workshop

- [ ] **Design paper: Concentric Loops in AI-Mediated Design** — tracked in [paper/TODO.md](paper/TODO.md). Content drafted (8 sections + fractal design), composed with opus, refined to 42.8/60. Re-compose with updated source in progress. Rubric blind spot identified: deck-type bias (iteration 9).
- [x] **Week 4 workshop** — composed, rendered, refined to 48.7/60 (81%). Zone collisions and empty zones fixed.

### Changelogs (concentric loop tracking)

- [x] **Inner loop changelog** — logs/iterations/week-2-v11.md created. Per-deck iteration tracking. Each deck gets a `logs/<deck>-iterations.md` that records: iteration N, dimensions targeted, changes made, score before/after. Fed by /refine-step.
- [x] **Outer loop changelog** — RUBRIC-CHANGELOG.md structured with 8 entries + outer-outer observations. user feedback → rubric change → score impact. One entry per outer loop iteration, committed separately.
- [x] **Outer-outer loop changelog** — META-CHANGELOG.md created. Tracks methodology evolution with 7 iterations documented. Track changes to METHODOLOGY.md itself, changes to the changelog format, changes to the evaluation pipeline. The meta-log.

### User Acceptance Testing (outer loop automation)

- [x] **UAT protocol skill** — `/rs:uat` skill created + `run-uat.js` runner. Generates HTML checklist with screenshot+wireframe comparison per slide. that runs the outer loop programmatically: (1) screenshot all slides, (2) generate wireframes, (3) present comparison to user, (4) collect structured feedback (per-slide yes/no + comments), (5) auto-create rubric issues from "no" responses
- [x] **Per-slide acceptance checklist** — run-uat.js generates HTML with screenshot+wireframe, pass/fail checkboxes, auto-fail for critical issues.
- [x] **Acceptance threshold** — defined in METHODOLOGY.md: 7 criteria including automated >= 9/10, zero criticals, zero user failures, 3x stability. all automated dimensions >= 9/10 AND zero user-flagged issues AND zero visual-audit criticals AND wireframe matches screenshot for every slide
- [x] **UAT history logging** — run-uat.js now writes to logs/uat-history.json after each session.
- [x] **Regression testing** — regression.js: save baselines, check against them, generate visual-diff reports.
- [x] **Design intent verification** — intent-verify.js: compare composed directive zone positions against rendered HTML zones. Flags missing, shifted, and empty zones.
- [x] **Metric collection audit** — METRIC-AUDIT.md: 32 metrics assessed. Puppeteer authoritative for 14, jsdom for 1, equal for 17.
- [x] **User feedback → rubric automation** — rubric-blind-spot.js built. Not yet validated by real use.

### Creative Dynamism (anti-template convergence)

v10-v13 all converge to the same aesthetic: warm cream, serif, brown accents, conservative layouts. The inner loop optimizes to "safe." The system needs to explore.

- [x] **Brief generator** — `generate-brief.js` built: color theory palettes, 10 font pairings, 12 moods, 7 accent systems. Each run genuinely different.
- [x] **Compose brief injection** — compose.js calls `generate-brief.js` when no `--brief`. Default is WILD. v15 proved it works (indigo/acid-yellow/Futura).
- [ ] **Palette diversity in corpus** — `/rs:audit` should flag when >50% of scored decks share the same dominant hue family.
- [x] **Layout archetype expansion** — beyond sidebar-left/editorial/monument. Add: overlap-composition, bleed-image, typographic-poster, data-wall, filmstrip, stagger-cascade, pull-quote-dominant, diagram-first.
- [x] **Anti-repetition** — before composing, scan last 3 decks in corpus. Tell Claude: "DO NOT use these colors/fonts/patterns."
- [x] **Rubric anti-template audit** — review every metric for template bias. Does staying within a narrow "safe" band score higher? If so, the rubric is rewarding conformity.
- [ ] **Generative typography** — support Google Fonts / system fonts beyond the 5 current options. Constraint is readability, not familiarity.

## Critical Gaps (honest assessment, 2026-03-28)

### The outer loop has never actually looped
We built 7 tools for human-in-the-loop review but never completed one cycle.
**Next**: Open the UAT checklist in Chrome, have the user mark pass/fail, feed results into rubric-blind-spot.js, fix what comes out, re-evaluate.

### Spliced images are net negative on 12/36 slides
Background placement behind dense text hurts readability. The splicer's fallback to background mode on high-overlap slides is the root cause. **Another agent is working on this.**

### evaluate.js should be the only evaluation command
run-rubric-eval.js gives inflated scores (no visual-audit merge). Skills, refine-step, and build-deck still reference the old command. **Next**: update all skills to use `node evaluate.js` instead of `node run-rubric-eval.js`.

### The rubric measures absence-of-bad, not presence-of-good
A minimalist slide with title + 3 bullets scores 10/10 on everything. There's no metric for: visual impact, information density appropriateness, narrative flow, or whether the slide would hold an audience's attention. **This may be a fundamental limitation of automated evaluation** — the outer loop (human judgment) is where "good" gets assessed.

### Design theory gaps in rubric (from paper research)

The rubric implicitly encodes Muller-Brockmann (grid), Itten (color), and Weingart (typography) but doesn't measure several formalizable design principles. Ordered by implementation feasibility:

**High priority (formalizable now):**
- [x] **Whitespace-to-content ratio** — `whitespaceRatio = empty grid cells / total cells`. Reward 25-45% range. Measures Beatrice Warde's "crystal goblet" principle: negative space as active design element. Currently whitespace is invisible to the rubric.
- [x] **Gestalt proximity scoring** — measure distances between zone centers. Penalize unrelated zones that are closer than related zones. E.g. a label and its body zone should be closer than two unrelated body zones.
- [x] **Typographic modular scale** — check if title/body/label sizes follow a mathematical scale (perfect fourth 1.333x, major third 1.25x, golden ratio 1.618x). Currently checks ratio range (1.8-3.0x) but not scale consistency.
- [x] **Visual weight distribution** — approximate Arnheim's balance: `weight = luminance_inverse × area × distance_from_center`. Score for balanced distribution (not necessarily symmetric). Requires per-zone bounding box data.
- [x] **Color harmony classification** — detect whether palette follows a named harmony system (complementary, analogous, triadic, split-complementary). Currently measures variety and transitions but not harmonic relationships.

**Medium priority (partially formalizable):**
- [x] **Reading path / visual flow** — analyze zone sequence (title row → label → body → image). Penalize layouts where the eye must jump backwards. Could use simple top-to-bottom, left-to-right heuristic.
- [x] **Focal point hierarchy** — measure which zone has the highest visual weight (largest area × highest contrast). Should be the title zone on most slides. Currently not distinguished from accent elements.
- [x] **Content density appropriateness** — different slide types need different densities. A section divider should be sparse (title only). A data slide should be dense (table + annotation). The rubric penalizes both equally via `lowDensitySlides`.
- [x] **Golden ratio detection** — check if key zone proportions approximate 1:1.618 (zone width / zone height, or body width / margin width). Aspirational but mathematically tractable.

**Low priority (requires vision model):**
- [ ] **Communicability** — does the layout encode meaning? (split = comparison, stagger = sequence, overlap = layering). Requires understanding content semantics + layout choice. RUBRIC.md dimension 2, currently null.
- [ ] **Taste / design-historical awareness** — does the deck show Swiss modernist discipline, Bauhaus geometry, or intentional rule-breaking? Requires vision + art-historical knowledge. RUBRIC.md dimension 3, currently null.
- [ ] **Perceived balance** — does the slide "feel right"? Arnheim's visual weight can approximate this but calibration requires human feedback. RUBRIC.md dimension 6, currently null.

**Missing from TODOs (identified during review):**
- [ ] **Post-compose fixup integration test** — run fixup on a fresh compose and verify it catches S7/S21/S24 patterns automatically
- [ ] **Cross-version palette comparison** — a tool that compares v10-v15 bg palettes side-by-side to detect convergence. Could integrate into `/rs:audit`
- [ ] **Complete outer loop cycle** — still haven't done one: UAT checklist reviewed by user → feedback into rubric-blind-spot → rubric change → re-evaluate. The tools exist but the cycle hasn't run
- [ ] **Deck-type parameter** — paper deck and lecture deck have different expectations. rubric should calibrate for type (lecture=dense, paper=editorial, workshop=code-heavy)
- [x] **Source markdown cleanup** — S7 garbled bold formatting (`****8****th`) persists in the source. Every compose inherits it. Fix the source once.
- [x] **Deprecate run-rubric-eval.js** — all skills should use evaluate.js. The old command gives inflated scores without visual-audit merge.

**Compose.js improvements (teach, not measure):**
- [x] **Explicit Gestalt prompting** — add to DESIGN_BRIEF: "Related content must be visually proximate. Use zone proximity to encode information relationships."
- [x] **Modular scale enforcement** — add to DESIGN_BRIEF: "Use a consistent typographic scale. If title is 44px and ratio is major third, body should be 44/1.25^2 ≈ 28px, label ≈ 22px."
- [x] **Arnheim balance teaching** — add to DESIGN_BRIEF: "Visual weight = size × darkness × distance from center. Balance the slide: a large light zone can be balanced by a small dark accent."

### TODO completion rate is overstated
59/60 "closed" includes many "tool built but not validated" items. **Honest count**: ~40 genuinely validated, ~19 tools-exist-but-unproven, 1 other agent.
- [x] **Regression testing** — regression.js built: save/check baselines, generate visual-diff on regressions.
- [x] **UAT history** — run-uat.js logs to logs/uat-history.json with full session data.
- [x] **Convergence criteria** — defined in METHODOLOGY.md: 7 formal criteria for acceptance.

### Automated-to-Human Handoff

- [x] **Visual diff between iterations** — `visual-diff.js` generates HTML side-by-side comparison of changed slides. Uses file size heuristic for quick change detection.
- [x] **Issue-to-fix traceability** — rubric-blind-spot.js logs feedback to logs/feedback-trace.json with date, deck, feedback text, affected dimensions, and status. Each entry can be marked resolved when the rubric check is added.

### Evaluation Redundancy
- [x] **Metric collection divergence audited** — METRIC-AUDIT.md documents all 32 metrics. Puppeteer authoritative for 14 (contrast, overflow, bounding boxes). jsdom for 1 (lowUtilizationSlides). Equal for 17. evaluate.js merge strategy confirmed correct.
- [x] **visual-audit.js → rubric score merging** — evaluate.js now feeds visual-audit criticals back into rubric metrics before re-scoring. Broken images and zone collisions from visual-audit override rubric counts when visual-audit finds more. Two Puppeteer sessions remain but their data is merged into one score.
- [x] **jsdom as fast pre-check, Puppeteer as authoritative** — evaluate.js --fast (jsdom <2s) vs --full (Puppeteer+visual-audit ~60s). Inner loop uses --fast; outer loop uses --full.
- [x] **Single evaluation command** — evaluate.js runs jsdom → Puppeteer → visual-audit in sequence. Shows both scores side-by-side. Checks acceptance criteria.

### Generative Art Engine

- [x] **generative-art.js v1** — Kandinsky-inspired algorithmic SVG art (concentric circles, fractal triangles, spiral paths, stochastic grids, intersecting arcs). 5 strategies, 5 palettes, seeded random for reproducibility. Content-weighted strategy selection with stochastic variation.
- [ ] **Canvas/PNG native output** — currently requires ImageMagick SVG→PNG conversion. Add node-canvas for direct PNG rendering.
- [ ] **More strategies** — L-systems (Lindenmayer), Voronoi tessellation, Perlin noise fields, reaction-diffusion patterns. Lean into the generative/fractal/concentric concepts.
- [ ] **Slide-aware density** — reduce element density on text-heavy slides, increase on dividers. Read the design directive to adapt.
- [ ] **Dark-bg variant** — invert palette for navy/dark background slides (currently generates light-bg art for all).
- [ ] **Animation** — CSS keyframe animations for spiral/concentric elements. Subtle rotation on presentation load.
- [ ] **Skill integration** — `/rs:generative-art <deck>` skill wrapping generative-art.js with automatic splice.
- [ ] **Inter-slide visual thread** — carry geometric motifs across adjacent slides (e.g. a circle on slide N reappears offset on slide N+1).

### Infrastructure

- [x] **Splice zone-collision avoidance** — contentAwarePlan already does grid-based collision analysis. Test confirmed working.
- [x] **Design-lessons.md rotation** — policy added: keep 50 most recent, older summarized via corpus-synthesize.js.
- [x] **Acceptance test runner** — `run-uat.js` built. Generates HTML checklist with per-slide screenshot+wireframe.

## Recently Closed

- [x] Port CSS zone-collision detection to rubric-headless.js (both engines now find 4→1 collisions)
- [x] Every-slide evaluation (--screenshots-all captures all 36 slides)
- [x] Unify scoring (rubric-scores.js shared module)
- [x] Zone-extras collision fix (tables now render in body zones, renderedContent tracking)
- [x] wireframe.js ASCII layout diagrams for visual comparison
