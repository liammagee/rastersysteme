/**
 * evaluators/markdown-qa.js — wraps qa.js runQA()
 */

const { runQA } = require("../qa");

module.exports = {
  name: "markdown-qa",
  dimensions: ["accessibility", "coherenceVariance", "communicability", "taste", "layoutBalance"],
  requires: ["source-markdown"],
  confidences: {
    accessibility: 0.6,
    coherenceVariance: 0.5,
    communicability: 0.3,
    taste: 0.2,
    layoutBalance: 0.2,
  },

  async evaluate(deckPath, options = {}) {
    const mdPath = deckPath.replace(/\.html$/, ".composed.md");
    const result = runQA(mdPath, { theme: options.theme || "light" });

    const design = result.design || {};
    // qa.js scores are { score: N, max: M, detail: "..." } objects
    const scores = design.scores || {};
    const a11y = result.accessibility || {};

    // Extract score/max from qa.js objects, normalize to 0-10
    const getScore = (obj) => (obj && typeof obj === "object") ? (obj.score || 0) : (obj || 0);
    const getMax = (obj) => (obj && typeof obj === "object") ? (obj.max || 1) : 1;
    const norm = (obj) => {
      const s = getScore(obj);
      const m = getMax(obj);
      return m > 0 ? Math.min(10, Math.round((s / m) * 100) / 10) : 5;
    };

    // Accessibility: based on error/warning counts
    const a11yErrors = (a11y.errors || []).length;
    const a11yWarnings = (a11y.warnings || []).length;
    const a11yScore = Math.max(1, Math.min(10, 10 - a11yErrors * 2 - a11yWarnings * 0.3));

    const lvScore = getScore(scores.layoutVariety);
    const lvMax = getMax(scores.layoutVariety);
    const tyScore = getScore(scores.typography);
    const tyMax = getMax(scores.typography);
    const cdScore = getScore(scores.contentDensity);
    const cdMax = getMax(scores.contentDensity);

    return {
      dimensions: {
        accessibility: {
          score: Math.round(a11yScore * 10) / 10,
          confidence: 0.6,
          source: "markdown-qa",
          details: { errors: a11yErrors, warnings: a11yWarnings },
        },
        coherenceVariance: {
          score: norm(scores.layoutVariety),
          confidence: 0.5,
          source: "markdown-qa",
          details: { layoutVariety: scores.layoutVariety },
        },
        communicability: {
          score: (lvMax + tyMax) > 0 ? Math.min(10, Math.round(((lvScore + tyScore) / (lvMax + tyMax)) * 100) / 10) : 5,
          confidence: 0.3,
          source: "markdown-qa",
          details: { proxy: "layoutVariety + typography" },
        },
        taste: {
          score: norm(scores.typography),
          confidence: 0.2,
          source: "markdown-qa",
          details: { proxy: "typography" },
        },
        layoutBalance: {
          score: norm(scores.contentDensity),
          confidence: 0.2,
          source: "markdown-qa",
          details: { proxy: "contentDensity" },
        },
      },
    };
  },
};
