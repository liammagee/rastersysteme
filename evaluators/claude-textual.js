/**
 * evaluators/claude-textual.js — wraps compare.js evaluateVariant()
 */

const fs = require("fs");
const { evaluateVariant } = require("../compare");
const { runQA } = require("../qa");

module.exports = {
  name: "claude-textual",
  dimensions: ["contentFidelity", "narrativeCoherence", "accessibility", "communicability", "taste"],
  requires: ["source-markdown"],
  confidences: {
    contentFidelity: 0.95,
    narrativeCoherence: 0.9,
    accessibility: 0.5,
    communicability: 0.4,
    taste: 0.3,
  },

  async evaluate(deckPath, options = {}) {
    const mdPath = deckPath.replace(/\.html$/, ".composed.md");
    // Try to find the source markdown
    const composedMd = fs.readFileSync(mdPath, "utf-8");

    // Extract source path from the composed markdown or infer from content dir
    let sourceMd = composedMd;
    const sourceMatch = composedMd.match(/<!-- source: (.+?) -->/);
    if (sourceMatch && fs.existsSync(sourceMatch[1])) {
      sourceMd = fs.readFileSync(sourceMatch[1], "utf-8");
    }

    const qaData = runQA(mdPath, { theme: options.theme || "light", quiet: true });
    const result = await evaluateVariant(sourceMd, composedMd, qaData, "moderate", {
      evalModel: options.model || "sonnet",
    });

    if (!result || !result.scores) {
      return { dimensions: {} };
    }

    const scores = result.scores;

    // Normalize compare.js rubric scales (0-20, 0-15, 0-10) to 0-10
    const norm = (val, max) => max > 0 ? Math.round((val / max) * 100) / 10 : 5;

    const dims = {};

    if (scores.contentCompleteness != null && scores.contentFidelity != null) {
      dims.contentFidelity = {
        score: norm((scores.contentCompleteness || 0) + (scores.contentFidelity || 0), 35),
        confidence: 0.95,
        source: "claude-textual",
        details: { contentCompleteness: scores.contentCompleteness, contentFidelity: scores.contentFidelity },
      };
    }

    if (scores.narrativeCoherence != null) {
      dims.narrativeCoherence = {
        score: norm(scores.narrativeCoherence || 0, 10),
        confidence: 0.9,
        source: "claude-textual",
        details: { raw: scores.narrativeCoherence },
      };
    }

    if (scores.accessibility != null) {
      dims.accessibility = {
        score: norm(scores.accessibility || 0, 10),
        confidence: 0.5,
        source: "claude-textual",
        details: { raw: scores.accessibility },
      };
    }

    if (scores.designQuality != null) {
      const dqNorm = norm(scores.designQuality || 0, 20);
      dims.communicability = {
        score: dqNorm,
        confidence: 0.4,
        source: "claude-textual",
        details: { proxy: "designQuality", raw: scores.designQuality },
      };
      dims.taste = {
        score: dqNorm,
        confidence: 0.3,
        source: "claude-textual",
        details: { proxy: "designQuality", raw: scores.designQuality },
      };
    }

    return { dimensions: dims };
  },
};
