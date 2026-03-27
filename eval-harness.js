#!/usr/bin/env node
/**
 * eval-harness.js — multiway evaluation harness
 *
 * Runs all available evaluation methods in parallel and merges
 * results into a unified 10-dimension scorecard.
 *
 * Usage:
 *   node eval-harness.js <deck.html>
 *   node eval-harness.js <deck.html> --evaluators headless,vision
 *   node eval-harness.js <deck.html> --json --samples 5
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { getAvailableEvaluators, GROUPS } = require("./evaluators/index");
const { loadScorecard, appendRun, saveScorecard, getTier } = require("./rubric-persist");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

// ═══════════════════════════════════════════════════════
// DIMENSION DEFINITIONS
// ═══════════════════════════════════════════════════════

const DIMENSIONS = [
  "accessibility", "communicability", "taste", "gridUtilization",
  "colorHarmonics", "layoutBalance", "coherenceVariance",
  "imageIntegration", "contentFidelity", "narrativeCoherence",
];

const DIM_LABELS = {
  accessibility: "Accessibility",
  communicability: "Communicability",
  taste: "Taste",
  gridUtilization: "Grid Utilization",
  colorHarmonics: "Color Harmonics",
  layoutBalance: "Layout Balance",
  coherenceVariance: "Coherence/Variance",
  imageIntegration: "Image Integration",
  contentFidelity: "Content Fidelity",
  narrativeCoherence: "Narrative Coherence",
};

// ═══════════════════════════════════════════════════════
// SCORE MERGING
// ═══════════════════════════════════════════════════════

function mergeScores(evaluatorResults) {
  const merged = {};

  for (const dimName of DIMENSIONS) {
    const contributions = [];
    for (const result of evaluatorResults) {
      if (result.dimensions && result.dimensions[dimName]) {
        contributions.push({
          ...result.dimensions[dimName],
          evaluator: result.evaluatorName,
        });
      }
    }

    if (contributions.length === 0) {
      merged[dimName] = { score: null, confidence: 0, sources: [], note: "no evaluator available" };
      continue;
    }

    if (contributions.length === 1) {
      const c = contributions[0];
      merged[dimName] = {
        score: c.score,
        confidence: c.confidence,
        sources: [{ name: c.evaluator, score: c.score, confidence: c.confidence }],
      };
      continue;
    }

    // Weighted average by confidence
    const totalWeight = contributions.reduce((sum, c) => sum + c.confidence, 0);
    const weightedScore = contributions.reduce((sum, c) => sum + c.score * c.confidence, 0) / totalWeight;

    merged[dimName] = {
      score: Math.round(weightedScore * 10) / 10,
      confidence: Math.max(...contributions.map(c => c.confidence)),
      sources: contributions.map(c => ({ name: c.evaluator, score: c.score, confidence: c.confidence })),
    };
  }

  return merged;
}

// ═══════════════════════════════════════════════════════
// PUPPETEER LIFECYCLE
// ═══════════════════════════════════════════════════════

async function launchBrowser() {
  let puppeteer;
  try { puppeteer = require("puppeteer"); } catch {
    try { puppeteer = require("puppeteer-core"); } catch {
      return null;
    }
  }
  return puppeteer.launch({ headless: "new", args: ["--window-size=1920,1080"] });
}

async function openDeckPage(browser, deckPath) {
  const url = deckPath.startsWith("http") ? deckPath : `file://${path.resolve(deckPath)}`;
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
  return page;
}

// ═══════════════════════════════════════════════════════
// MAIN HARNESS
// ═══════════════════════════════════════════════════════

async function evalHarness(deckPath, options = {}) {
  const requested = options.evaluators || ["all"];
  const samples = options.samples || 5;
  const deckName = path.basename(deckPath, path.extname(deckPath));

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("eval-harness")}\n`);
  process.stderr.write(`  ${dim("Deck:")} ${teal(path.basename(deckPath))}\n\n`);

  // Check availability
  const checks = getAvailableEvaluators(requested, deckPath);
  for (const { name, available, reason } of checks) {
    const icon = available ? sage("●") : dim("○");
    const status = available ? sage("available") : dim(`unavailable (${reason})`);
    process.stderr.write(`  ${icon} ${name.padEnd(20)} ${status}\n`);
  }
  process.stderr.write("\n");

  const available = checks.filter(c => c.available);
  if (available.length === 0) {
    process.stderr.write(`  ${accent("✗")} No evaluators available\n`);
    return null;
  }

  const results = [];
  const needsPuppeteer = available.some(c => ["headless-rubric", "headless-qa", "screenshot-vision"].includes(c.name));

  // Phase 1: Puppeteer evaluators (sequential on shared browser)
  let screenshots = null;
  let slideCount = 0;

  if (needsPuppeteer) {
    const browser = await launchBrowser();
    if (browser) {
      const page = await openDeckPage(browser, deckPath);

      // Get slide count
      slideCount = await page.evaluate(() =>
        document.querySelectorAll(".slide, .grid-slide").length
      );
      process.stderr.write(`  ${dim("Slides:")} ${slideCount}\n`);

      // headless-rubric
      const hrCheck = available.find(c => c.name === "headless-rubric");
      if (hrCheck) {
        process.stderr.write(`  ${dim("Running")} headless-rubric${dim("...")}\n`);
        try {
          const result = await hrCheck.evaluator.evaluate(deckPath, { page });
          result.evaluatorName = "headless-rubric";
          results.push(result);
        } catch (err) {
          process.stderr.write(`  ${accent("✗")} headless-rubric: ${err.message}\n`);
        }
      }

      // screenshot capture (before closing page)
      const svCheck = available.find(c => c.name === "screenshot-vision");
      if (svCheck) {
        process.stderr.write(`  ${dim("Capturing")} ${samples} screenshots${dim("...")}\n`);
        try {
          screenshots = await svCheck.evaluator.captureScreenshots(page, slideCount, deckName, { samples });
          process.stderr.write(`  ${sage("✓")} ${screenshots.length} screenshots captured\n`);
        } catch (err) {
          process.stderr.write(`  ${accent("✗")} screenshot capture: ${err.message}\n`);
        }
      }

      await page.close();

      // headless-qa (needs its own page/browser — qaHTML manages its own)
      const hqCheck = available.find(c => c.name === "headless-qa");
      if (hqCheck) {
        process.stderr.write(`  ${dim("Running")} headless-qa${dim("...")}\n`);
        try {
          const result = await hqCheck.evaluator.evaluate(deckPath);
          result.evaluatorName = "headless-qa";
          results.push(result);
        } catch (err) {
          process.stderr.write(`  ${accent("✗")} headless-qa: ${err.message}\n`);
        }
      }

      await browser.close();
    }
  }

  // Phase 2: Parallel (no Puppeteer needed)
  const phase2 = [];

  const mqCheck = available.find(c => c.name === "markdown-qa");
  if (mqCheck) {
    phase2.push(
      mqCheck.evaluator.evaluate(deckPath, options)
        .then(r => { r.evaluatorName = "markdown-qa"; return r; })
        .catch(err => { process.stderr.write(`  ${accent("✗")} markdown-qa: ${err.message}\n`); return null; })
    );
  }

  const ctCheck = available.find(c => c.name === "claude-textual");
  if (ctCheck) {
    process.stderr.write(`  ${dim("Running")} claude-textual${dim("...")}\n`);
    phase2.push(
      ctCheck.evaluator.evaluate(deckPath, options)
        .then(r => { r.evaluatorName = "claude-textual"; return r; })
        .catch(err => { process.stderr.write(`  ${accent("✗")} claude-textual: ${err.message}\n`); return null; })
    );
  }

  const jrCheck = available.find(c => c.name === "jsdom-rubric");
  if (jrCheck) {
    process.stderr.write(`  ${dim("Running")} jsdom-rubric${dim("...")}\n`);
    phase2.push(
      jrCheck.evaluator.evaluate(deckPath, options)
        .then(r => { r.evaluatorName = "jsdom-rubric"; return r; })
        .catch(err => { process.stderr.write(`  ${accent("✗")} jsdom-rubric: ${err.message}\n`); return null; })
    );
  }

  const svCheck2 = available.find(c => c.name === "screenshot-vision");
  if (svCheck2 && screenshots && screenshots.length > 0) {
    process.stderr.write(`  ${dim("Running")} screenshot-vision API${dim("...")}\n`);
    phase2.push(
      svCheck2.evaluator.evaluate(deckPath, { screenshots, slideCount })
        .then(r => { r.evaluatorName = "screenshot-vision"; return r; })
        .catch(err => { process.stderr.write(`  ${accent("✗")} screenshot-vision: ${err.message}\n`); return null; })
    );
  }

  const phase2Results = await Promise.all(phase2);
  for (const r of phase2Results) {
    if (r) results.push(r);
  }

  // Phase 3: Merge + persist
  const merged = mergeScores(results);

  const assessed = DIMENSIONS.filter(d => merged[d].score !== null);
  const total = assessed.reduce((sum, d) => sum + merged[d].score, 0);
  const max = assessed.length * 10;
  const normalized = max > 0 ? Math.round((total / max) * 100) : 0;
  const tier = getTier(normalized);

  // Display results
  process.stderr.write(`\n  ${dim("─".repeat(70))}\n`);
  process.stderr.write(`  ${"Dimension".padEnd(24)} ${"Score".padEnd(8)} ${"Conf".padEnd(6)} Source\n`);
  process.stderr.write(`  ${dim("─".repeat(70))}\n`);

  for (const dimName of DIMENSIONS) {
    const d = merged[dimName];
    const label = (DIM_LABELS[dimName] || dimName).padEnd(24);
    if (d.score === null) {
      process.stderr.write(`  ${dim(label)} ${dim("—".padEnd(8))} ${dim("—".padEnd(6))} ${dim(d.note || "")}\n`);
    } else {
      const icon = d.score >= 7 ? sage("●") : d.score >= 5 ? amber("●") : accent("●");
      const scoreStr = `${d.score.toFixed(1)}/10`.padEnd(8);
      const confStr = d.confidence.toFixed(2).padEnd(6);
      const sources = d.sources.map(s => `${s.name} (${s.confidence})`).join(" + ");
      process.stderr.write(`  ${icon} ${label} ${chalk.white.bold(scoreStr)} ${dim(confStr)} ${dim(sources)}\n`);
    }
  }

  process.stderr.write(`  ${dim("─".repeat(70))}\n`);
  process.stderr.write(`  TOTAL: ${chalk.white.bold(`${total.toFixed(1)}/${max}`)}  `);
  process.stderr.write(`(${normalized}% — ${tier})\n`);

  const evaluatorsRun = results.map(r => r.evaluatorName);
  const evaluatorsSkipped = checks.filter(c => !c.available).map(c => ({ name: c.name, reason: c.reason }));

  // Persist
  if (!options.noPersist) {
    const sc = loadScorecard(deckPath);
    if (slideCount) sc.slideCount = slideCount;

    const computed = {};
    const visual = {};
    const textual = {};
    for (const dimName of DIMENSIONS) {
      const d = merged[dimName];
      if (d.score === null) continue;
      if (["communicability", "taste", "layoutBalance"].includes(dimName)) {
        visual[dimName] = { score: d.score };
      } else if (["contentFidelity", "narrativeCoherence"].includes(dimName)) {
        textual[dimName] = { score: d.score };
      } else {
        computed[dimName] = { score: d.score };
      }
    }

    appendRun(sc, {
      engine: "eval-harness",
      status: "complete",
      evaluators: evaluatorsRun,
      computed: Object.keys(computed).length ? computed : null,
      visual: Object.keys(visual).length ? visual : null,
      textual: Object.keys(textual).length ? textual : null,
      computedTotal: Object.values(computed).reduce((s, d) => s + d.score, 0),
      computedMax: Object.keys(computed).length * 10,
      visualTotal: Object.values(visual).reduce((s, d) => s + d.score, 0),
      visualMax: Object.keys(visual).length * 10,
    });
    const savedPath = saveScorecard(sc);
    process.stderr.write(`  ${dim("Scorecard:")} ${teal(path.relative(process.cwd(), savedPath))}\n`);
  }

  return {
    $schema: "eval-harness-v1",
    deck: deckPath,
    timestamp: new Date().toISOString(),
    slideCount,
    evaluatorsRun,
    evaluatorsSkipped,
    dimensions: merged,
    total,
    max,
    normalized,
    tier,
    screenshotPaths: screenshots ? screenshots.map(s => s.path) : [],
  };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  eval-harness — multiway evaluation harness

  Runs all available evaluation methods and merges results into
  a unified 10-dimension scorecard with confidence-weighted scoring.

  Evaluators:
    markdown-qa       Markdown-level QA (qa.js)
    headless-rubric   Puppeteer rubric audit (rubric-audit.js)
    headless-qa       Puppeteer accessibility audit (qa-html.js)
    claude-textual    Claude API textual evaluation (compare.js)
    screenshot-vision Puppeteer screenshots + Claude API vision
    chrome-visual     Chrome MCP (skill-only, not CLI-available)

  Groups: all, static, headless, vision, textual

  Usage:
    node eval-harness.js <deck.html>
    node eval-harness.js <deck.html> --evaluators headless,vision
    node eval-harness.js <deck.html> --json --samples 3

  Options:
    --evaluators <list>  Comma-separated evaluators or groups (default: all)
    --samples N          Slides to sample for screenshots (default: 5)
    --json               Output JSON to stdout
    --no-persist         Skip scorecard persistence
    `);
    process.exit(0);
  }

  const input = args.filter(a => !a.startsWith("--"))[0];
  const jsonMode = args.includes("--json");
  const noPersist = args.includes("--no-persist");

  const evalFlag = args.find(a => a.startsWith("--evaluators"));
  let evaluators = ["all"];
  if (evalFlag) {
    const idx = args.indexOf(evalFlag);
    if (evalFlag.includes("=")) evaluators = evalFlag.split("=")[1].split(",");
    else if (args[idx + 1]) evaluators = args[idx + 1].split(",");
  }

  const samplesFlag = args.find(a => a.startsWith("--samples"));
  let samples = 5;
  if (samplesFlag) {
    if (samplesFlag.includes("=")) samples = parseInt(samplesFlag.split("=")[1]);
    else {
      const idx = args.indexOf(samplesFlag);
      if (args[idx + 1]) samples = parseInt(args[idx + 1]);
    }
  }

  if (!input) {
    console.error("Error: no input file specified");
    process.exit(1);
  }

  if (!input.startsWith("http") && !fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  evalHarness(input, { evaluators, samples, noPersist }).then(result => {
    if (jsonMode && result) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  }).catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { evalHarness };
