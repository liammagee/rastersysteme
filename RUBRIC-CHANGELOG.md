# Rubric Scoring Methodology Changelog

## v4 — Demanding Critic (2026-03-28)

### Changes
- **Accessibility capped at 8 in jsdom** — honest about inability to check CSS-class contrast
- **Typography hierarchy** added to Coherence scoring — title/body ratio 1.8-3.0x rewarded
- **Generic alt text detection** — images with `alt="Image"` penalized (-0.15 each, max -2)
- **Sparse slide penalty** — slides under 150 chars with no content images penalized (-0.5 each)
- **Clipped content disabled in jsdom** — overflow:hidden detection produced 80% false positive rate
- **Image overlap scoring** — no longer double-counts textOnImage + imgOverlaps
- **Duplicate text** — fixed false positives from nested parent/child zones

### Calibration: week-2-v9

| Evaluator | Score | Notes |
|---|---|---|
| Puppeteer (rubric-headless) | 59/60 (98%) | Missing new checks |
| **jsdom (rubric-jsdom)** | **43.6/60 (73%)** | All new checks active |

The 15-point gap exposes that the Puppeteer path needs the same generic-alt, sparse-slide, and typography checks. The jsdom score is the more honest assessment.

## v5 — Source-Level Fixes (2026-03-28)

### Problem
Generic `alt="Image"` on all 17 content images in source markdown. The rubric correctly penalizes this but the fix must happen upstream.

### Changes
- Fixed all 17 `![Image](...)` references in `content/week-2/week-2.md` with descriptive alt text
- Synced generic-alt detection, sparse slides, and typography hierarchy to Puppeteer path
- Both scoring engines now produce comparable results

### Score progression across rubric versions

| Rubric | Engine | week-2-v9 | week-2-v10 | Notes |
|---|---|---|---|---|
| v1 | headless | 59.7/60 (100%) | N/A | Everything looks perfect |
| v2 | headless | 59/60 (98%) | N/A | Accent saturation |
| v3 | headless | 59/60 (98%) | N/A | Banality checks (false positive fixed) |
| v4 | jsdom | 43.6/60 (73%) | N/A | Generic alt + sparse slides |
| v4 | headless | 54.5/60 (91%) | 45/60 (75%) | Synced checks |
| v5 | headless | TBD | TBD | Source alt text fixed |

---

### Key insight: absence-of-bad vs presence-of-good

The rubric evolution traces a clear arc:
- **v1**: Measured absence of errors. Perfect scores for mediocre decks.
- **v2**: Added variety metrics (archetypes, transitions). Caught monotony.
- **v3**: Added banality metrics (sparse slides, duplicate text). Caught emptiness.
- **v4**: Added quality metrics (typography hierarchy, generic alt, accessibility honesty). Catches lack of craft.

The remaining frontier is **visual quality** — communicability, taste, balance — which requires screenshot+vision evaluation.

---

## v2 — Tightened Scoring (2026-03-28)

### Problem Statement

The v1 rubric maxed out at 60/60 (100%) for decks with clear remaining design issues:
- Accent elements on 92% of slides (over-saturated) went unpenalized
- Identical layout archetypes on consecutive slides went undetected
- Chromatic transitions (jarring hue jumps between slides) unmeasured
- Typography hierarchy (title/body size ratio) unchecked
- Content density rhythm (pacing of sparse vs dense slides) ignored
- Color and coherence dimensions double-counted the same metrics

### Methodology

1. **Audit**: Deep code trace of `rubric-jsdom.js` and `rubric-headless.js` scoring formulas
2. **Gap analysis**: Mapped each dimension's formula to identify what design flaws escape detection
3. **Metric expansion**: Added 8 new metrics to both jsdom and Puppeteer paths
4. **Formula rewrite**: Rewrote all 6 computed scoring formulas with tighter criteria
5. **Bug fixes**: Fixed key mismatch (`contentCompleteness` vs `contentFidelity`), normalization bug in `rubric-persist.js`
6. **Validation**: Re-evaluated existing decks; verified scores dropped meaningfully (59.7 -> 57.1 for v8)

### New Metrics Added

| Metric | What it measures | Used in |
|---|---|---|
| `maxArchetypeRun` | Consecutive slides with identical zone layout | Grid, Coherence |
| `uniqueArchetypes` | Count of distinct layout compositions | Grid, Coherence |
| `nonDefaultZones` / `totalZones` | Zones using non-trivial grid positions | Grid |
| `typographyRatio` | Title size / body size ratio | (available, not yet scored) |
| `densityCV` | Coefficient of variation of per-slide text length | Coherence |
| `accentRatio` | Fraction of slides with accent elements | Coherence |
| `avgTransition` | Mean Euclidean color distance between adjacent slides | Color |
| `transitionVariance` | Variance of transition distances | Color |

### Scoring Formula Changes

#### Grid Utilization (was easy 10/10, now discriminates)
- **Old**: Variety count caps (4 zone starts = max). Any designed slide gets +2 free points.
- **New**: Rewards non-default zone positioning ratio, penalizes consecutive identical layouts, requires 6+ unique starts. Free points removed.
- **Effect**: v8 deck: 10 -> 9.9 (was already good); decks with lazy layouts will drop significantly

#### Color Harmonics (was binary, now graduated)
- **Old**: Binary `hasArc` flag (+3/+1). 3 backgrounds = max variety credit.
- **New**: `arcScore` graduated by transition distance range (40-280 = smooth). Transition smoothness bonus for consistent distances. Needs 4+ backgrounds. Stricter run limit (<=2 not <=3).
- **Effect**: v8: 10 -> 9.0 (high transition variance penalized)

#### Coherence & Variance (was double-counting color, now independent)
- **Old**: Checked `uniqueBgs` and `maxConsecBg` (already scored in Color).
- **New**: Checks layout archetype variety, content density rhythm (CV), accent saturation ratio. Font count now penalizes >4 (chaos). Title sizes reward 2-5 range.
- **Effect**: v8: 10 -> 8.5 (accent over-saturation at 92% penalized)

#### Content Completeness (penalties too weak)
- **Old**: -0.5 per empty body zone, -1.0 per table truncation
- **New**: -1.5 per empty body zone, -1.5 per table truncation, -2.0 per clipped slide. Invented labels penalized.
- **Effect**: Decks with content routing issues will drop faster

#### Image Integration (overlap detection conservative)
- **Old**: -0.5 per text-on-image, needed 3 placement types
- **New**: -1.0 per text-on-image, -1.5 per overlap, needs 4 placement types
- **Effect**: Overlap penalties doubled

### Bugs Fixed

1. **Key mismatch**: `evaluators/jsdom-rubric.js` sent `contentCompleteness` but `eval-harness.js` expected `contentFidelity`. Content scores silently dropped in harness mode. Fixed by mapping to both keys.
2. **Normalization bug**: `rubric-persist.js` divided by hardcoded 100 instead of actual `max`. Headless-only runs stored as 60% when they scored 100% of assessed dimensions. Fixed.
3. **Score double-counting**: Color and Coherence both used `uniqueBgs` and `maxConsecBg`. Coherence now uses layout/density/accent metrics instead.

### Calibration Results

| Deck | v1 Score | v2 Score | Delta |
|---|---|---|---|
| week-2-v8.spliced | 59.7/60 (100%) | 57.1/60 (95%) | -2.6 |
| week-2-v9.spliced | N/A | 58.0/60 (97%) | baseline |

### Remaining Gaps (known limitations)

- **Accessibility contrast detection**: jsdom cannot read CSS-class colors; only inline styles detected. Puppeteer path uses `getComputedStyle` which is better but still imperfect.
- **Visual-only dimensions**: Communicability, Taste, Balance still require screenshot+vision evaluation (30% of full rubric).
- **Typography ratio**: Collected but not yet scored. Will add in v3 once calibration data available.
- **Source content fidelity**: No comparison of source markdown content against rendered HTML (requires source file path).
