/**
 * rubric-scores.js — shared scoring module
 *
 * Single source of truth for all rubric dimension formulas.
 * Used by both rubric-jsdom.js and rubric-headless.js.
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

  // 1. Accessibility — capped per engine (jsdom=8, Puppeteer=10)
  scores.accessibility = Math.max(1, Math.min(accessibilityCap,
    accessibilityCap
    - (m.contrastErrors || 0) * 2
    - (m.contrastWarnings || 0) * 0.5
    - (m.brokenImgs || 0) * 2
    - (m.tinyTextCount || 0) * 0.5
    - Math.min((m.overflows || 0) * 0.5, 3)
  ));

  // 2. Communicability (visual-only)
  scores.communicability = null;

  // 3. Taste (visual-only)
  scores.taste = null;

  // 4. Grid Utilization — layout quality + collision detection
  const designedRatio = m.total > 0 ? m.designed / m.total : 0;
  const nonDefaultRatio = m.totalZones > 0 ? m.nonDefaultZones / m.totalZones : 0;
  const archetypeRepeatPenalty = m.maxArchetypeRun >= 4 ? 2 : m.maxArchetypeRun >= 3 ? 1 : 0;
  const archetypeVariety = m.total > 0 ? Math.min(m.uniqueArchetypes / (m.total * 0.4), 1) : 0;
  const collisionPenalty = Math.min((m.zoneCollisionSlides || 0) * 1.5, 6);
  scores.grid = Math.max(1, Math.min(10,
    designedRatio * 3
    + nonDefaultRatio * 3
    + archetypeVariety * 2
    - archetypeRepeatPenalty
    + Math.min((m.zoneStarts || 0) / 6, 1) * 2
    - collisionPenalty
  ));

  // 5. Color Harmonics — transition quality
  const arcScore = m.hasArc
    ? (m.avgTransition > 40 && m.avgTransition < 280 ? 2.5 : 1.5)
    : 0.5;
  const transitionSmoothnessBonus = m.transitionVariance > 0
    ? (Math.sqrt(m.transitionVariance) / (m.avgTransition || 1) < 1.5 ? 1 : 0)
    : 0;
  scores.color = Math.max(1, Math.min(10,
    Math.min(m.uniqueBgs / 4, 1.5) * 2
    + arcScore
    + transitionSmoothnessBonus
    + (m.maxConsecBg <= 2 ? 2.5 : m.maxConsecBg <= 3 ? 1.5 : 0.5)
    + (m.contrastErrors === 0 ? 1 : 0)
  ));

  // 6. Balance (visual-only)
  scores.balance = null;

  // 7. Coherence & Variance — typography hierarchy, layout variety, visual rhythm
  const titleSizes = Array.isArray(m.titleSizes) ? m.titleSizes : [...(m.titleSizes || [])];
  const titleSizeCount = titleSizes.length;
  const titleSizeScore = titleSizeCount >= 2 && titleSizeCount <= 5 ? 2
    : titleSizeCount === 1 ? 1
    : titleSizeCount <= 7 ? 1.5 : 0.5;
  const fontScore = m.fontSets >= 2 && m.fontSets <= 4 ? 1.5 : 0.5;
  const layoutVarietyScore = m.uniqueArchetypes >= 5 ? 1.5 : m.uniqueArchetypes >= 3 ? 1 : 0.5;
  const densityRhythm = m.densityCV > 0.4 && m.densityCV < 2.0 ? 1.5 : 0.5;
  const accentBalance = m.accentRatio > 0.3 && m.accentRatio < 0.85 ? 1.5 : 0.5;
  const typoHierarchy = m.typographyRatio >= 1.8 && m.typographyRatio <= 3.0 ? 2
    : m.typographyRatio > 1.3 ? 1 : 0;
  scores.coherence = Math.max(1, Math.min(10,
    titleSizeScore + fontScore + layoutVarietyScore + densityRhythm + accentBalance + typoHierarchy
  ));

  // 8. Image Integration — overlap + generic alt + placement
  const overlapPenalty = Math.min(Math.max(m.textOnImageCount || 0, m.imgOverlaps || 0) * 1, 4);
  const genericAltPenalty = Math.min((m.genericAltTotal || 0) * 0.15, 2);
  const imgPlacements = Array.isArray(m.imgPlacements) ? m.imgPlacements : [...(m.imgPlacements || [])];
  scores.images = m.totalImgs === 0 ? 5 : Math.max(1, Math.min(10,
    10
    - overlapPenalty
    - genericAltPenalty
    - (imgPlacements.length < 3 ? 2 : imgPlacements.length < 4 ? 1 : 0)
    - (m.totalImgs < m.total * 0.15 ? 1 : 0)
  ));

  // 9. Content Completeness — penalizes absence AND banality
  scores.contentCompleteness = Math.max(1, Math.min(10,
    10
    - m.emptyBodyZones * 1.5
    - m.contentlessSlides * 2.5
    - m.tableTruncations * 1.5
    - m.clippedContentSlides * 2
    - m.slidesWithNoVisibleText * 2
    - (m.inventedLabels || 0) * 0.3
    - (m.lowDensitySlides || 0) * 0.8
    - (m.sparseSlides || 0) * 0.5
    - (m.lowUtilizationSlides || 0) * 0.8    // slides with <25% zone coverage
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
