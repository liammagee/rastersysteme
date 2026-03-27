/**
 * evaluators/index.js — evaluator registry and availability checking
 */

const fs = require("fs");
const path = require("path");

const EVALUATORS = {
  "markdown-qa": require("./markdown-qa"),
  "headless-rubric": require("./headless-rubric"),
  "jsdom-rubric": require("./jsdom-rubric"),
  "headless-qa": require("./headless-qa"),
  "claude-textual": require("./claude-textual"),
  "screenshot-vision": require("./screenshot-vision"),
  "chrome-visual": require("./chrome-visual"),
};

// Evaluator group aliases
const GROUPS = {
  static: ["markdown-qa"],
  headless: ["headless-rubric", "headless-qa", "screenshot-vision"],
  jsdom: ["jsdom-rubric"],
  vision: ["screenshot-vision"],
  textual: ["claude-textual"],
  chrome: ["chrome-visual"],
  all: Object.keys(EVALUATORS),
};

function loadEnvKeys() {
  try {
    const envPath = path.join(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return {};
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    const keys = {};
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) keys[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
    return keys;
  } catch { return {}; }
}

function checkRequirement(req, deckPath) {
  switch (req) {
    case "puppeteer":
      try { require("puppeteer"); return true; } catch {
        try { require("puppeteer-core"); return true; } catch { return false; }
      }
    case "anthropic-api":
      return !!loadEnvKeys().ANTHROPIC_API_KEY;
    case "source-markdown": {
      const mdPath = deckPath.replace(/\.html$/, ".composed.md");
      return fs.existsSync(mdPath);
    }
    case "chrome-mcp":
      return false; // Only available within a Claude Code session
    default:
      return false;
  }
}

function getAvailableEvaluators(requestedNames, deckPath) {
  // Expand group aliases
  let names = [];
  for (const name of requestedNames) {
    if (GROUPS[name]) names.push(...GROUPS[name]);
    else names.push(name);
  }
  names = [...new Set(names)];

  return names.map(name => {
    const evaluator = EVALUATORS[name];
    if (!evaluator) return { name, evaluator: null, available: false, reason: "unknown evaluator" };

    for (const req of evaluator.requires) {
      if (!checkRequirement(req, deckPath)) {
        return { name, evaluator, available: false, reason: `${req} not available` };
      }
    }
    return { name, evaluator, available: true, reason: null };
  });
}

module.exports = { EVALUATORS, GROUPS, getAvailableEvaluators, loadEnvKeys };
