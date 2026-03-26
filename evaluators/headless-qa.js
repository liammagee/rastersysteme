/**
 * evaluators/headless-qa.js — wraps qa-html.js qaHTML()
 */

const { qaHTML } = require("../qa-html");

module.exports = {
  name: "headless-qa",
  dimensions: ["accessibility"],
  requires: ["puppeteer"],
  confidences: {
    accessibility: 0.9,
  },

  async evaluate(deckPath, options = {}) {
    const result = await qaHTML(deckPath);
    const { errors, warnings, fontIssues, results } = result;

    const a11yScore = Math.max(1, Math.min(10,
      10 - errors * 2 - warnings * 0.3 - (fontIssues || []).length * 0.5
    ));

    return {
      dimensions: {
        accessibility: {
          score: Math.round(a11yScore * 10) / 10,
          confidence: 0.9,
          source: "headless-qa",
          details: { errors, warnings, fontIssues: (fontIssues || []).length, slideIssues: results },
        },
      },
    };
  },
};
