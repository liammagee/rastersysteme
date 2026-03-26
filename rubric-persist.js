#!/usr/bin/env node
/**
 * rubric-persist.js — scoring persistence for the design rubric
 *
 * Stores per-deck evaluation scorecards in logs/qa/<deckname>-scorecard.json.
 * Supports append-only runs, latest-score merging, trajectory tracking,
 * and resume from partial visual reviews.
 *
 * Usage:
 *   const { loadScorecard, appendRun, saveScorecard, getTier, getResumePoint } = require('./rubric-persist');
 */

const fs = require("fs");
const path = require("path");

const QA_DIR = path.join(__dirname, "logs", "qa");

// ═══════════════════════════════════════════════════════
// TIER THRESHOLDS (from RUBRIC.md)
// ═══════════════════════════════════════════════════════

function getTier(normalizedScore) {
  if (normalizedScore >= 85) return "Exhibition";
  if (normalizedScore >= 70) return "Professional";
  if (normalizedScore >= 55) return "Competent";
  if (normalizedScore >= 40) return "Draft";
  return "Broken";
}

// ═══════════════════════════════════════════════════════
// SCORECARD I/O
// ═══════════════════════════════════════════════════════

function deckKey(deckPath) {
  return path.basename(deckPath, path.extname(deckPath));
}

function scorecardPath(deckPath) {
  return path.join(QA_DIR, `${deckKey(deckPath)}-scorecard.json`);
}

function loadScorecard(deckPath) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const fp = scorecardPath(deckPath);
  if (fs.existsSync(fp)) {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  }
  return {
    $schema: "rubric-scorecard-v1",
    deck: deckPath,
    source: deckPath.replace(/\.html$/, ".composed.md"),
    slideCount: null,
    runs: [],
    latest: null,
    trajectory: [],
  };
}

function saveScorecard(scorecard) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const fp = scorecardPath(scorecard.deck);
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(scorecard, null, 2));
  fs.renameSync(tmp, fp);
  return fp;
}

// ═══════════════════════════════════════════════════════
// RUN MANAGEMENT
// ═══════════════════════════════════════════════════════

function appendRun(scorecard, run) {
  if (!run.id) run.id = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  if (!run.timestamp) run.timestamp = new Date().toISOString();
  scorecard.runs.push(run);
  updateLatest(scorecard);
  return scorecard;
}

function updateLatest(scorecard) {
  // Merge best available: most recent computed + most recent visual + most recent textual
  let bestComputed = null;
  let bestVisual = null;
  let bestTextual = null;

  for (const run of scorecard.runs) {
    if (run.computed) bestComputed = run.computed;
    if (run.visual) bestVisual = run.visual;
    if (run.textual) bestTextual = run.textual;
  }

  if (!bestComputed && !bestVisual && !bestTextual) return;

  const sumScores = (obj) => obj ? Object.values(obj).reduce((sum, dim) => sum + (dim.score || 0), 0) : 0;
  const countDims = (obj) => obj ? Object.keys(obj).length * 10 : 0;

  const computedTotal = sumScores(bestComputed);
  const computedMax = countDims(bestComputed);
  const visualTotal = sumScores(bestVisual);
  const visualMax = countDims(bestVisual);
  const textualTotal = sumScores(bestTextual);
  const textualMax = countDims(bestTextual);

  const total = computedTotal + visualTotal + textualTotal;
  const max = computedMax + visualMax + textualMax;
  // Normalize against full 100-point scale (10 dims x 10 pts)
  const normalized = max > 0 ? Math.round((total / 100) * 100) : 0;

  const computed = {};
  if (bestComputed) {
    for (const [k, v] of Object.entries(bestComputed)) computed[k] = v.score;
  }
  const visual = {};
  if (bestVisual) {
    for (const [k, v] of Object.entries(bestVisual)) visual[k] = v.score;
  }
  const textual = {};
  if (bestTextual) {
    for (const [k, v] of Object.entries(bestTextual)) textual[k] = v.score;
  }

  scorecard.latest = {
    timestamp: new Date().toISOString(),
    computed: Object.keys(computed).length ? computed : null,
    visual: Object.keys(visual).length ? visual : null,
    textual: Object.keys(textual).length ? textual : null,
    total,
    max,
    normalized,
    tier: getTier(normalized),
  };

  // Append to trajectory
  const parts = [];
  if (bestComputed) parts.push("computed");
  if (bestVisual) parts.push("visual");
  if (bestTextual) parts.push("textual");
  scorecard.trajectory.push({
    timestamp: scorecard.latest.timestamp,
    total,
    max,
    normalized,
    note: parts.join("+") || "empty",
  });
}

// ═══════════════════════════════════════════════════════
// RESUME SUPPORT
// ═══════════════════════════════════════════════════════

function getResumePoint(scorecard) {
  // Find the last partial visual run and return which slides still need review
  for (let i = scorecard.runs.length - 1; i >= 0; i--) {
    const run = scorecard.runs[i];
    if (run.engine === "chrome-mcp" && run.status === "partial") {
      return {
        runIndex: i,
        resumeFrom: run.resumeFrom || 0,
        slidesReviewed: run.slidesVisuallyReviewed || [],
      };
    }
  }
  return null;
}

module.exports = { loadScorecard, appendRun, saveScorecard, getTier, getResumePoint, scorecardPath, deckKey, QA_DIR };
