/**
 * evaluators/chrome-visual.js — Chrome MCP visual assessment
 *
 * This evaluator is only available within a Claude Code session where
 * Chrome MCP tools are accessible. From the CLI, it is always unavailable.
 * The /evaluate skill can invoke Chrome MCP directly when connected.
 */

module.exports = {
  name: "chrome-visual",
  dimensions: ["communicability", "taste", "layoutBalance"],
  requires: ["chrome-mcp"],
  confidences: {
    communicability: 0.9,
    taste: 0.85,
    layoutBalance: 0.9,
  },

  async evaluate(deckPath, options = {}) {
    // Chrome MCP tools are not available from Node.js CLI.
    // This evaluator exists as a registry entry so the harness
    // can report it as "unavailable (Chrome MCP not connected)"
    // and so the /evaluate skill knows its confidence weights.
    throw new Error("chrome-visual is only available within a Claude Code session");
  },
};
