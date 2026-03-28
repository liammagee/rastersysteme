# Metric Collection Audit: jsdom vs Puppeteer

Each metric in `rubric-scores.js` is collected by both `rubric-jsdom.js` and `rubric-headless.js`.
This audit documents which engine is more reliable for each metric and why.

## Metric-by-Metric Assessment

| Metric | jsdom | Puppeteer | Authoritative | Notes |
|---|---|---|---|---|
| `contrastErrors` | Inline styles only | `getComputedStyle` | **Puppeteer** | jsdom can't resolve CSS class colors |
| `contrastWarnings` | Inline styles only | `getComputedStyle` | **Puppeteer** | Same limitation |
| `brokenImgs` | Checks `src` attribute exists | Checks `naturalWidth > 0` | **Puppeteer** | jsdom can't load images; Puppeteer checks actual loading |
| `tinyTextCount` | Falls back to 14px when no inline | `getComputedStyle` | **Puppeteer** | jsdom always reads fallback, underreports |
| `overflows` | Checks `scrollHeight > clientHeight` | Same but with real layout | **Puppeteer** | jsdom has no layout engine, values are 0 |
| `uniqueBgs` | `getComputedStyle` (limited cascade) | `getComputedStyle` (full cascade) | **Puppeteer** | jsdom misses CSS-class backgrounds |
| `maxConsecBg` | Derived from `uniqueBgs` | Derived from `uniqueBgs` | **Puppeteer** | Follows from bg detection |
| `hasArc` | Light/dark luminance split | Light/dark luminance split | **Equal** | Same algorithm, different bg inputs |
| `zoneStarts` | Parses inline `left` % | Parses inline `left` % | **Equal** | Both read same inline styles |
| `zoneWidths` | Parses inline `width` % | Parses inline `width` % | **Equal** | Both read same inline styles |
| `titleSizes` | Inline `font-size` only | `getComputedStyle` fontSize | **Puppeteer** | jsdom misses CSS-class font sizes |
| `fontSets` | Inline `font-family` only | `getComputedStyle` fontFamily | **Puppeteer** | Same limitation |
| `slidesWithAccents` | Class selector | Class selector | **Equal** | Both check CSS classes |
| `totalImgs` | Counts `<img>` tags | Counts `<img>` tags | **Equal** | Both count DOM elements |
| `imgOverlaps` | CSS rect intersection (approximation) | Real bounding box intersection | **Puppeteer** | jsdom now uses zone-level CSS rects; Puppeteer uses element-level bounding boxes |
| `imgPlacements` | Inline position parsing | Bounding box position | **Puppeteer** | jsdom approximates from inline styles |
| `textOnImageCount` | Zone-level CSS rect intersection | Element-level bounding box | **Puppeteer** | jsdom checks zone-image vs zone-text; Puppeteer checks individual elements |
| `emptyBodyZones` | `textContent.trim()` | `textContent.trim()` | **Equal** | Same check |
| `contentlessSlides` | DOM element check | DOM element check | **Equal** | Same selectors |
| `tableTruncations` | Row count heuristic | Row visibility check | **Puppeteer** | jsdom counts rows; Puppeteer checks actual visibility |
| `clippedContentSlides` | **Disabled** (80% false positive) | `getBoundingClientRect` overflow | **Puppeteer** | jsdom can't detect real overflow |
| `perSlideTextLen` | `textContent.length` | `textContent.length` | **Equal** | Same measurement |
| `maxArchetypeRun` | Inline style zone signatures | Inline style zone signatures | **Equal** | Both parse same inline styles |
| `uniqueArchetypes` | Inline style signatures | Inline style signatures | **Equal** | Both parse same inline styles |
| `nonDefaultZones` | Inline `left` > 2 && `width` < 95 | Same check | **Equal** | Both read inline styles |
| `typographyRatio` | Inline sizes only | `getComputedStyle` | **Puppeteer** | jsdom misses CSS-class sizes |
| `densityCV` | Derived from `perSlideTextLen` | Derived from `perSlideTextLen` | **Equal** | Same source data |
| `accentRatio` | Derived from `slidesWithAccents` | Same | **Equal** | Same source |
| `avgTransition` | bg color distances | bg color distances | **Puppeteer** | Follows from bg detection quality |
| `zoneCollisionSlides` | CSS rect intersection | Real bounding box intersection | **Puppeteer** | jsdom parses inline styles; Puppeteer has real positions |
| `genericAltTotal` | `alt` attribute check | `alt` attribute check | **Equal** | Both read DOM attribute |
| `sparseSlides` | `perSlideTextLen` threshold | Same | **Equal** | Same data |
| `lowUtilizationSlides` | CSS rect zone coverage | Not yet implemented | **jsdom** | Only jsdom has this check currently |

## Summary

| Category | jsdom Authoritative | Puppeteer Authoritative | Equal |
|---|---|---|---|
| Count | 1 | 14 | 17 |

**Puppeteer is authoritative for 14/32 metrics**, mainly those requiring:
- CSS cascade resolution (`getComputedStyle`)
- Image loading verification (`naturalWidth`)
- Real layout computation (overflow, bounding boxes)

**jsdom is authoritative for 1 metric** (`lowUtilizationSlides`) — only implemented there.

**Equal for 17 metrics** — those using inline styles, DOM attributes, or text content which both engines read identically.

## Recommendations

1. **For the inner loop (speed)**: jsdom is sufficient for 18/32 metrics. Missing metrics are mostly contrast, typography, and overflow — which change infrequently between iterations. Use `evaluate.js --fast`.

2. **For the outer loop (accuracy)**: Puppeteer is essential for honest scoring. The 14 Puppeteer-authoritative metrics include accessibility (contrast), image integration (overlaps), and content (clipped/overflow) — all critical for quality assessment.

3. **To eliminate divergence**: Port `lowUtilizationSlides` to Puppeteer path. Then the Puppeteer result is strictly a superset of jsdom.

4. **The merge strategy in evaluate.js is correct**: use Puppeteer as primary, jsdom as supplementary/fast-check.
