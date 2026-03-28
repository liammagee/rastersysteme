/**
 * rubric-scores.js — shared scoring module (v9)
 *
 * Single source of truth for all rubric dimension formulas.
 * Used by both rubric-jsdom.js and rubric-headless.js.
 *
 * Design theory: see DESIGN-THEORY.md
 * Methodology: see METHODOLOGY.md (inner loop convergence standard)
 *
 * @param {object} metrics - collected metrics from either jsdom or Puppeteer
 * @param {object} opts - engine-specific options
 * @param {number} opts.accessibilityCap - max accessibility score (8 for jsdom, 10 for Puppeteer)
 * @returns {{ scores, computedTotal, maxComputed }}
 */
function computeScores(metrics, opts = {}) {
  const scores = {};
  const m = metrics;
  const accessibilityCap = opts.accessibilityCap || 10;

  // ── 1. Accessibility ──
  // Contrast, broken images, tiny text, overflows.
  // Tiny text threshold raised: presentation body text should be >= 14px.
  scores.accessibility = Math.max(1, Math.min(accessibilityCap,
    accessibilityCap
    - (m.contrastErrors || 0) * 2
    - (m.contrastWarnings || 0) * 0.5
    - (m.brokenImgs || 0) * 2
    - (m.tinyTextCount || 0) * 0.8       // was 0.5 — small fonts hurt readability more
    - Math.min((m.overflows || 0) * 0.5, 3)
  ));

  // ── 2-3. Visual-only stubs ──
  scores.communicability = null;
  scores.taste = null;

  // ── 4. Grid Utilization ──
  // Layout quality: designed ratio, non-default positions, archetype variety, collisions.
  const designedRatio = m.total > 0 ? m.designed / m.total : 0;
  const nonDefaultRatio = m.totalZones > 0 ? (m.nonDefaultZones || 0) / m.totalZones : 0;
  const archetypeRepeatPenalty = m.maxArchetypeRun >= 4 ? 2 : m.maxArchetypeRun >= 3 ? 1 : 0;
  const archetypeVariety = m.total > 0 ? Math.min((m.uniqueArchetypes || 0) / (m.total * 0.4), 1) : 0;
  const collisionPenalty = Math.min((m.zoneCollisionSlides || 0) * 1.5, 6);
  // Visual balance bonus (Arnheim): reward balanced center of gravity
  const balanceBonus = (m.avgBalance || 0.5) > 0.6 ? 0.5 : 0;
  // Reading flow bonus: reward top-to-bottom semantic order
  const flowBonus = (m.avgFlowScore || 1) > 0.8 ? 0.5 : 0;
  // Golden ratio bonus: reward zones with phi proportions
  const goldenBonus = (m.goldenRatioFraction || 0) > 0.15 ? 0.5 : 0;

  scores.grid = Math.max(1, Math.min(10,
    designedRatio * 2.5
    + nonDefaultRatio * 2.5
    + archetypeVariety * 2
    - archetypeRepeatPenalty
    + Math.min((m.zoneStarts || 0) / 6, 1) * 1.5
    - collisionPenalty
    + balanceBonus
    + flowBonus
    + goldenBonus
  ));

  // ── 5. Color Harmonics ──
  // Chromatic arc quality, transition smoothness, background variety.
  const arcScore = m.hasArc
    ? (m.avgTransition > 40 && m.avgTransition < 280 ? 2.5 : 1.5)
    : 0.5;
  const transitionSmoothnessBonus = m.transitionVariance > 0
    ? (Math.sqrt(m.transitionVariance) / (m.avgTransition || 1) < 1.5 ? 1 : 0)
    : 0;
  // Palette monotony: penalize when all light bgs are within a narrow warm-beige band
  const paletteMonotony = (m.bgHueRange || 999) < 30 && (m.uniqueBgs || 0) > 2 ? -1.5 : 0;
  // Color harmony bonus: bold harmonies (complementary, triadic) score higher than safe (monochromatic)
  const harmonyType = m.colorHarmonyType || "none";
  const harmonyBonus = ["complementary", "triadic"].includes(harmonyType) ? 1.5
    : ["analogous", "analogous-wide", "split-complementary"].includes(harmonyType) ? 1
    : harmonyType === "monochromatic" ? 0.5 : 0;

  scores.color = Math.max(1, Math.min(10,
    Math.min((m.uniqueBgs || 0) / 4, 1.5) * 2
    + arcScore
    + transitionSmoothnessBonus
    + (m.maxConsecBg <= 2 ? 2.5 : m.maxConsecBg <= 3 ? 1.5 : 0.5)
    + (m.contrastErrors === 0 ? 1 : 0)
    + paletteMonotony
    + harmonyBonus
  ));

  // ── 6. Balance (visual-only) ──
  scores.balance = null;

  // ── 7. Coherence & Variance ──
  // Typography hierarchy, font CONSISTENCY (not just count), layout variety,
  // visual rhythm, accent balance, splice placement variety.
  const titleSizes = Array.isArray(m.titleSizes) ? m.titleSizes : [...(m.titleSizes || [])];
  const titleSizeCount = titleSizes.length;
  const titleSizeScore = titleSizeCount >= 2 && titleSizeCount <= 5 ? 1.5
    : titleSizeCount === 1 ? 1
    : titleSizeCount <= 7 ? 1 : 0.5;

  // Font consistency: 1-3 fonts with clear roles is good. 4+ is chaotic.
  // Don't penalize 3 fonts — that's heading/body/code, a valid system.
  const fontSets = m.fontSets || 0;
  const fontConsistency = fontSets <= 3 ? 1.5 : fontSets === 4 ? 0.5 : 0;

  const layoutVarietyScore = (m.uniqueArchetypes || 0) >= 5 ? 1.5 : (m.uniqueArchetypes || 0) >= 3 ? 1 : 0.5;
  const densityRhythm = m.densityCV > 0.4 && m.densityCV < 2.0 ? 1 : 0.5;
  const accentBalance = m.accentRatio > 0.3 && m.accentRatio < 0.85 ? 1.5 : 0.5;
  const typoHierarchy = m.typographyRatio >= 1.8 && m.typographyRatio <= 3.0 ? 1.5
    : m.typographyRatio > 1.3 ? 0.5 : 0;

  // Splice placement variety: penalize if >60% of placements are the same mode (inset saturation)
  const splicePlacementTypes = m.splicePlacementTypes || 0;
  const spliceMonotony = (m.spliceCount || 0) > 4 && splicePlacementTypes <= 2 ? -1 : 0;

  // Modular scale bonus: title/body sizes follow a mathematical scale
  const modularScale = (m.modularScaleScore || 0) >= 2 ? 1 : 0;

  // Whitespace quality: reward 25-55% average whitespace (Warde's crystal goblet)
  const ws = m.avgWhitespace || 0.5;
  const whitespaceQuality = ws >= 0.25 && ws <= 0.55 ? 0.5 : 0;

  scores.coherence = Math.max(1, Math.min(10,
    titleSizeScore + fontConsistency + layoutVarietyScore
    + densityRhythm + accentBalance + typoHierarchy
    + spliceMonotony + modularScale + whitespaceQuality
  ));

  // ── 8. Image Integration ──
  // Overlaps, generic alt, placement variety, splice inclusion/visibility.
  // NEW: splice-over-dense-text penalty (background splice on >300 char slides).
  const overlapPenalty = Math.min(Math.max(m.textOnImageCount || 0, m.imgOverlaps || 0) * 1, 4);
  const genericAltPenalty = Math.min((m.genericAltTotal || 0) * 0.15, 2);
  const imgPlacements = Array.isArray(m.imgPlacements) ? m.imgPlacements : [...(m.imgPlacements || [])];
  const spliceCount = m.spliceCount || 0;
  const spliceVisibleCount = m.spliceVisibleCount || 0;
  const spliceAtmosphericCount = m.spliceAtmosphericCount || 0;
  const spliceMissing = spliceCount === 0 && m.totalImgs > 0 ? 0 : spliceCount === 0 ? 1 : 0;
  const spliceEffective = spliceVisibleCount + spliceAtmosphericCount;
  const spliceInvisible = spliceCount > 0 && spliceEffective < spliceCount * 0.5 ? 1.5 : 0;
  // Penalize background splices on text-heavy slides (>300 chars)
  const spliceBgOnDenseText = m.spliceBgOnDenseText || 0;
  const bgDenseTextPenalty = Math.min(spliceBgOnDenseText * 0.8, 3);

  scores.images = m.totalImgs === 0 ? 5 : Math.max(1, Math.min(10,
    10
    - overlapPenalty
    - genericAltPenalty
    - (imgPlacements.length < 3 ? 2 : imgPlacements.length < 4 ? 1 : 0)
    - (m.totalImgs < m.total * 0.15 ? 1 : 0)
    - spliceMissing
    - spliceInvisible
    - bgDenseTextPenalty
  ));

  // ── 9. Content Completeness ──
  scores.contentCompleteness = Math.max(1, Math.min(10,
    10
    - (m.emptyBodyZones || 0) * 1.5
    - (m.contentlessSlides || 0) * 2.5
    - (m.tableTruncations || 0) * 1.5
    - (m.clippedContentSlides || 0) * 2
    - (m.slidesWithNoVisibleText || 0) * 2
    - (m.inventedLabels || 0) * 0.3
    - (m.lowDensitySlides || 0) * 0.8
    - (m.sparseSlides || 0) * 0.5
    - (m.lowUtilizationSlides || 0) * 0.8
    - (m.linkOnlySlides || 0) * 1.5
    - (m.duplicateTextSlides || 0) * 1.5
  ));

  // Round all scores
  for (const k of Object.keys(scores)) {
    if (scores[k] !== null) scores[k] = Math.round(scores[k] * 10) / 10;
  }

  // Compute total
  const computedDims = Object.entries(scores).filter(([, v]) => v !== null);
  const computedTotal = Math.round(computedDims.reduce((a, [, v]) => a + v, 0) * 10) / 10;
  const maxComputed = computedDims.length * 10;

  return { scores, computedTotal, maxComputed };
}

module.exports = { computeScores };
