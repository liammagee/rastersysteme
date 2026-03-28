/**
 * evaluators/jsdom-rubric.js — wraps rubric-jsdom.js for eval-harness integration
 *
 * No external dependencies (no puppeteer needed).
 * Calls rubric-jsdom.js via execSync and parses JSON output.
 *
 * Maps rubric-jsdom dimensions to harness dimensions:
 *   - accessibility → accessibility
 *   - grid → gridUtilization
 *   - color → colorHarmonics
 *   - coherence → coherenceVariance
 *   - images → imageIntegration
 *   - contentCompleteness → contentCompleteness (bonus)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

module.exports = {
  name: "jsdom-rubric",
  dimensions: ["accessibility", "gridUtilization", "colorHarmonics", "coherenceVariance", "imageIntegration", "contentCompleteness"],
  requires: [],
  confidences: {
    accessibility: 0.90,
    gridUtilization: 0.95,
    colorHarmonics: 0.90,
    coherenceVariance: 0.85,
    imageIntegration: 0.85,
    contentCompleteness: 0.85,
  },

  async evaluate(deckPath, options = {}) {
    if (!fs.existsSync(deckPath)) {
      throw new Error(`Deck not found: ${deckPath}`);
    }

    try {
      // Run rubric-jsdom.js and get JSON output
      const projectRoot = path.join(__dirname, "..");
      const rubricScript = path.join(projectRoot, "rubric-jsdom.js");

      if (!fs.existsSync(rubricScript)) {
        throw new Error(`rubric-jsdom.js not found at ${rubricScript}`);
      }

      const jsonOutput = execSync(`node "${rubricScript}" "${deckPath}" --json`, {
        cwd: projectRoot,
        encoding: "utf-8",
      });

      const result = JSON.parse(jsonOutput);
      const { scores } = result;

      // Map jsdom scores to harness dimensions
      const dims = {};

      // Direct mappings
      const mappings = {
        accessibility: "accessibility",
        grid: "gridUtilization",
        color: "colorHarmonics",
        coherence: "coherenceVariance",
        images: "imageIntegration",
        contentCompleteness: "contentCompleteness",
      };

      for (const [jsdomKey, harnessKey] of Object.entries(mappings)) {
        if (scores[jsdomKey] !== null && scores[jsdomKey] !== undefined) {
          dims[harnessKey] = {
            score: scores[jsdomKey],
            confidence: this.confidences[harnessKey],
            source: "jsdom-rubric",
            details: {
              jsdomDimension: jsdomKey,
              metrics: result.metrics,
            },
          };
        }
      }

      // Also map contentCompleteness to contentFidelity for eval-harness compatibility
      if (scores.contentCompleteness !== null && scores.contentCompleteness !== undefined) {
        dims["contentFidelity"] = {
          score: scores.contentCompleteness,
          confidence: 0.7,  // lower confidence as proxy for true fidelity
          source: "jsdom-rubric",
          details: { jsdomDimension: "contentCompleteness", proxy: true },
        };
      }

      return { dimensions: dims };
    } catch (err) {
      throw new Error(`jsdom-rubric evaluation failed: ${err.message}`);
    }
  },
};
