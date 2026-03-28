#!/usr/bin/env node
/**
 * rubric-blind-spot.js — detect rubric blind spots from UAT feedback
 *
 * Compares user UAT pass/fail results against rubric dimension scores.
 * When a slide FAILS user acceptance but scored >= 8 on relevant dimensions,
 * that's a rubric blind spot — the rubric can't see what the human sees.
 *
 * Usage:
 *   node rubric-blind-spot.js <uat-history.json>
 *   node rubric-blind-spot.js <uat-history.json> --deck week-2-v11.spliced.html
 *
 * Reads UAT history (from run-uat.js) and rubric scorecards.
 * Outputs blind spot analysis with recommended rubric checks.
 *
 * Also supports manual feedback input:
 *   node rubric-blind-spot.js --feedback "slide 7 has overlapping text" --deck week-2-v11.spliced.html
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const args = process.argv.slice(2);
const projectRoot = path.resolve(__dirname);

// Issue type → rubric dimension mapping
const ISSUE_DIMENSION_MAP = {
  "overlapping text": ["grid", "contentCompleteness"],
  "overlapping": ["grid"],
  "missing image": ["images", "accessibility"],
  "invisible image": ["images"],
  "empty slide": ["contentCompleteness"],
  "too much whitespace": ["contentCompleteness"],
  "text too small": ["accessibility"],
  "contrast": ["accessibility"],
  "broken image": ["accessibility", "images"],
  "wrong layout": ["grid", "coherence"],
  "duplicate": ["contentCompleteness"],
  "clipped": ["contentCompleteness"],
  "truncated": ["contentCompleteness"],
  "monotonous": ["coherence"],
  "generic": ["images"],
  "no accent": ["coherence"],
  "collision": ["grid"],
};

function classifyFeedback(feedback) {
  const lower = feedback.toLowerCase();
  const dimensions = new Set();
  for (const [keyword, dims] of Object.entries(ISSUE_DIMENSION_MAP)) {
    if (lower.includes(keyword)) dims.forEach(d => dimensions.add(d));
  }
  if (dimensions.size === 0) dimensions.add("unknown");
  return [...dimensions];
}

// Manual feedback mode
const feedbackFlag = args.indexOf("--feedback");
const deckFlag = args.indexOf("--deck");
if (feedbackFlag >= 0) {
  const feedback = args[feedbackFlag + 1];
  const deckName = deckFlag >= 0 ? args[deckFlag + 1] : null;

  console.log(chalk.cyan("\n  ■ rubric-blind-spot — manual feedback analysis\n"));
  console.log(chalk.dim(`  Feedback: "${feedback}"`));

  const dimensions = classifyFeedback(feedback);
  console.log(chalk.dim(`  Likely dimensions: ${dimensions.join(", ")}\n`));

  // Load scorecard if available
  if (deckName) {
    const baseName = path.basename(deckName, ".html");
    const scorecardPath = path.join("logs/qa", `${baseName}-scorecard.json`);
    if (fs.existsSync(scorecardPath)) {
      const data = JSON.parse(fs.readFileSync(scorecardPath, "utf-8"));
      const scores = Array.isArray(data) ? data[data.length - 1].scores : {};
      console.log(chalk.yellow("  Rubric scores for affected dimensions:"));
      for (const dim of dimensions) {
        const score = scores[dim];
        if (score !== null && score !== undefined) {
          const isBlind = score >= 8;
          const icon = isBlind ? chalk.red("✖ BLIND SPOT") : chalk.green("✓ caught");
          console.log(`    ${dim}: ${score}/10 — ${icon}`);
          if (isBlind) {
            console.log(chalk.red(`      → Rubric scored ${score} but user sees a problem.`));
            console.log(chalk.red(`      → Add a check to ${dim} scoring for: "${feedback}"`));
          }
        }
      }
    } else {
      console.log(chalk.dim(`  No scorecard found at ${scorecardPath}`));
    }
  }

  // Log the feedback for traceability
  const traceLog = path.join(projectRoot, "logs/feedback-trace.json");
  const trace = fs.existsSync(traceLog) ? JSON.parse(fs.readFileSync(traceLog, "utf-8")) : [];
  trace.push({
    date: new Date().toISOString(),
    deck: deckName || "unknown",
    feedback,
    dimensions,
    status: "open",
  });
  fs.mkdirSync(path.dirname(traceLog), { recursive: true });
  fs.writeFileSync(traceLog, JSON.stringify(trace, null, 2));
  console.log(chalk.green(`\n  ✓ Feedback logged: ${traceLog} (${trace.length} entries)\n`));
  process.exit(0);
}

// UAT history analysis mode
const historyPath = args.find(a => !a.startsWith("--")) || path.join(projectRoot, "logs/uat-history.json");
if (!fs.existsSync(historyPath)) {
  console.log("No UAT history found. Run run-uat.js first, or use --feedback for manual input.");
  process.exit(1);
}

const history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
console.log(chalk.cyan(`\n  ■ rubric-blind-spot — UAT history analysis`));
console.log(chalk.dim(`  Sessions: ${history.length}\n`));

// Analyze each session for blind spots
let blindSpots = 0;
for (const session of history) {
  const failSlides = session.autoFailSlides || [];
  if (failSlides.length === 0) continue;

  console.log(chalk.yellow(`  ${session.deck} (${session.date.split("T")[0]}):`));
  console.log(chalk.dim(`    Score: ${session.scores?.pct || "?"}%`));
  console.log(chalk.dim(`    Auto-fail slides: ${failSlides.join(", ")}`));

  // Check if high-scoring dimensions correlate with failures
  if (session.scores) {
    const highDims = Object.entries(session.scores.dimensions)
      .filter(([, v]) => v >= 8)
      .map(([k]) => k);
    if (highDims.length > 0 && failSlides.length > 0) {
      console.log(chalk.red(`    ⚠ ${failSlides.length} slides fail UAT while ${highDims.length} dimensions score >= 8`));
      console.log(chalk.red(`    → Potential blind spots in: ${highDims.join(", ")}`));
      blindSpots += failSlides.length;
    }
  }
}

console.log(chalk.cyan(`\n  Summary: ${blindSpots} potential blind spot instances across ${history.length} sessions\n`));
