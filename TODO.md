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

- [ ] **Design paper: Concentric Loops in AI-Mediated Design** — **OWNED BY ANOTHER AGENT. DO NOT MODIFY.** Tracked in paper/TODO.md, spec in PAPER-SPEC.md.
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
- [ ] **User feedback → rubric automation** — when user marks a slide as "fail", auto-detect which rubric dimension should catch it. If the rubric scored it >8, flag as rubric blind spot and create a tracking issue
- [ ] **Regression testing** — after fixing a user-flagged issue, screenshot the fixed slide and verify the fix didn't break adjacent slides. Store acceptance baselines for comparison
- [ ] **UAT history** — log each UAT session: date, deck version, slides reviewed, pass/fail counts, issues found, rubric gaps identified. Track acceptance rate over iterations
- [x] **Convergence criteria** — defined in METHODOLOGY.md: 7 formal criteria for acceptance.

### Automated-to-Human Handoff

- [x] **Visual diff between iterations** — `visual-diff.js` generates HTML side-by-side comparison of changed slides. Uses file size heuristic for quick change detection.
- [ ] **Issue-to-fix traceability** — when the inner loop fixes a rubric issue, link it to the original user feedback that created the rubric check. Closes the loop: user comment → rubric check → design fix → verification
- [ ] **Design intent verification** — after each compose, compare the design plan text against the actual zone layout. Flag slides where the design plan says "sidebar left" but the zones are actually centered

### Evaluation Redundancy

- [ ] **Corpus learning verification** — /rs:audit now includes learning verification (step 4). Run regularly to ensure rubric, skills, and compose pipeline reflect corpus data.
- [x] **Metric collection divergence audited** — METRIC-AUDIT.md documents all 32 metrics. Puppeteer authoritative for 14 (contrast, overflow, bounding boxes). jsdom for 1 (lowUtilizationSlides). Equal for 17. evaluate.js merge strategy confirmed correct.
- [x] **visual-audit.js → rubric score merging** — evaluate.js now feeds visual-audit criticals back into rubric metrics before re-scoring. Broken images and zone collisions from visual-audit override rubric counts when visual-audit finds more. Two Puppeteer sessions remain but their data is merged into one score.
- [x] **jsdom as fast pre-check, Puppeteer as authoritative** — evaluate.js --fast (jsdom <2s) vs --full (Puppeteer+visual-audit ~60s). Inner loop uses --fast; outer loop uses --full.
- [x] **Single evaluation command** — evaluate.js runs jsdom → Puppeteer → visual-audit in sequence. Shows both scores side-by-side. Checks acceptance criteria.

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
