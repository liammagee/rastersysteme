/**
 * evaluators/headless-rubric.js — runs rubric-audit.js in a Puppeteer page
 *
 * Self-contained: reads rubric-audit.js and evals it in the provided page.
 * Does not depend on rubric-headless.js exports (which may change).
 */

const fs = require("fs");
const path = require("path");

const AUDIT_SCRIPT = fs.readFileSync(path.join(__dirname, "..", "rubric-audit.js"), "utf-8");

module.exports = {
  name: "headless-rubric",
  dimensions: ["accessibility", "gridUtilization", "colorHarmonics", "coherenceVariance", "imageIntegration"],
  requires: ["puppeteer"],
  confidences: {
    accessibility: 0.95,
    gridUtilization: 0.95,
    colorHarmonics: 0.95,
    coherenceVariance: 0.9,
    imageIntegration: 0.95,
  },

  async evaluate(deckPath, options = {}) {
    const page = options.page;
    if (!page) throw new Error("headless-rubric requires a Puppeteer page via options.page");

    const rawResult = await page.evaluate((script) => eval(script), AUDIT_SCRIPT);
    const scorecard = JSON.parse(rawResult);
    const { computed } = scorecard;

    const dims = {};
    for (const [key, data] of Object.entries(computed)) {
      dims[key] = {
        score: data.score,
        confidence: this.confidences[key],
        source: "headless-rubric",
        details: data,
      };
    }

    return { dimensions: dims, slideData: scorecard.slideData };
  },
};
