#!/usr/bin/env node
/**
 * evaluate.js — unified deck evaluation
 *
 * Runs jsdom fast-check first (< 1s), then Puppeteer full evaluation
 * with visual-audit merged. Produces a single merged scorecard.
 *
 * Usage:
 *   node evaluate.js <deck.html>
 *   node evaluate.js <deck.html> --fast          jsdom only (inner loop)
 *   node evaluate.js <deck.html> --full          jsdom + Puppeteer + visual-audit
 *   node evaluate.js <deck.html> --screenshots-all  full + every slide screenshotted
 *   node evaluate.js <deck.html> --json
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");

const args = process.argv.slice(2);
const deckPath = args.find(a => !a.startsWith("--"));
const fastOnly = args.includes("--fast");
const fullMode = args.includes("--full") || args.includes("--screenshots-all") || !fastOnly;
const jsonMode = args.includes("--json");
const screenshotsAll = args.includes("--screenshots-all");

if (!deckPath) {
  console.log(`
  evaluate.js — unified deck evaluation

  Usage:
    node evaluate.js <deck.html>                    Auto (jsdom + Puppeteer)
    node evaluate.js <deck.html> --fast             jsdom only (< 1s, inner loop)
    node evaluate.js <deck.html> --full             jsdom + Puppeteer + visual-audit
    node evaluate.js <deck.html> --screenshots-all  full + every slide screenshotted
    node evaluate.js <deck.html> --json             JSON output
  `);
  process.exit(0);
}

const projectRoot = path.resolve(__dirname);
const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const green = chalk.green;
const amber = chalk.yellow;

console.log(teal("\n  ■ evaluate") + dim(" — unified deck evaluation"));
console.log(dim(`  Deck: ${deckPath}`));
console.log(dim(`  Mode: ${fastOnly ? "fast (jsdom)" : "full (jsdom + Puppeteer + visual-audit)"}\n`));

// ── Phase 1: jsdom fast-check ──
console.log(amber("  Phase 1: jsdom fast-check..."));
let jsdomResult = null;
try {
  const jsdomOut = execSync(`node rubric-jsdom.js "${deckPath}" --json`, {
    cwd: projectRoot, encoding: "utf-8", timeout: 15000
  });
  const jsonStart = jsdomOut.indexOf("{");
  if (jsonStart >= 0) {
    jsdomResult = JSON.parse(jsdomOut.slice(jsonStart));
  }
} catch (e) {
  console.log(dim("  (jsdom evaluation failed)"));
}

if (jsdomResult) {
  const s = jsdomResult.scores || {};
  const dims = Object.entries(s).filter(([,v]) => v !== null);
  console.log(green(`  ✓ jsdom: ${jsdomResult.computedTotal}/${jsdomResult.maxComputed}`));
  dims.forEach(([k, v]) => {
    const icon = v >= 9 ? "●" : v >= 7 ? "◐" : "○";
    console.log(dim(`    ${icon} ${k}: ${v}`));
  });

  // Flag critical issues from jsdom
  const m = jsdomResult.metrics || {};
  if (m.zoneCollisionSlides > 0) console.log(accent(`    ✖ ${m.zoneCollisionSlides} zone collisions`));
  if (m.sparseSlides > 0) console.log(amber(`    ⚠ ${m.sparseSlides} sparse slides`));
  if (m.genericAltTotal > 0) console.log(amber(`    ⚠ ${m.genericAltTotal} generic alt-text images`));
  if (m.lowUtilizationSlides > 0) console.log(amber(`    ⚠ ${m.lowUtilizationSlides} low-utilization slides`));
}

if (fastOnly) {
  if (jsonMode && jsdomResult) console.log(JSON.stringify({ jsdom: jsdomResult }, null, 2));
  process.exit(0);
}

// ── Phase 2: Puppeteer full evaluation ──
console.log(amber("\n  Phase 2: Puppeteer full evaluation..."));
let headlessResult = null;
try {
  const ssFlag = screenshotsAll ? " --screenshots-all" : "";
  const headlessOut = execSync(`node run-rubric-eval.js "${deckPath}" --json${ssFlag}`, {
    cwd: projectRoot, encoding: "utf-8", timeout: 180000
  });
  // Extract JSON array from output
  const jsonStart = headlessOut.indexOf("[");
  if (jsonStart >= 0) {
    const jsonEnd = headlessOut.lastIndexOf("]");
    const arr = JSON.parse(headlessOut.slice(jsonStart, jsonEnd + 1));
    headlessResult = arr[arr.length - 1]; // latest iteration
  }
} catch (e) {
  console.log(dim("  (Puppeteer evaluation failed, using jsdom results only)"));
}

if (headlessResult) {
  const s = headlessResult.scores || {};
  console.log(green(`  ✓ Puppeteer: ${headlessResult.computedTotal}/${headlessResult.maxComputed}`));
}

// ── Phase 3: Visual audit ──
console.log(amber("\n  Phase 3: Visual audit..."));
let auditResult = null;
try {
  const auditOut = execSync(`node visual-audit.js "${deckPath}" --json`, {
    cwd: projectRoot, encoding: "utf-8", timeout: 120000
  });
  const jsonStart = auditOut.indexOf("{");
  if (jsonStart >= 0) {
    auditResult = JSON.parse(auditOut.slice(jsonStart));
  }
} catch (e) {
  console.log(dim("  (visual audit failed)"));
}

if (auditResult) {
  const c = auditResult.counts || {};
  console.log(green(`  ✓ Visual audit: ${c.critical} critical, ${c.warning} warning, ${c.info} info`));
}

// ── Phase 4: Merge results (visual-audit criticals penalize rubric scores) ──
console.log(amber("\n  Phase 4: Merged assessment"));

// Adjust rubric scores based on visual-audit findings
if (headlessResult && auditResult) {
  const issues = auditResult.issues || [];
  let brokenImageSlides = 0, zoneCollisionSlides = 0, textImageSlides = 0;
  issues.forEach(si => {
    const crits = si.issues.filter(i => i.severity === "critical");
    const warns = si.issues.filter(i => i.severity === "warning");
    if (crits.some(i => i.type === "broken-image")) brokenImageSlides++;
    if (crits.some(i => i.type === "zone-collision")) zoneCollisionSlides++;
    if (warns.some(i => i.type === "text-image-collision")) textImageSlides++;
  });

  // Override rubric metrics with visual-audit findings (more reliable per-slide data)
  if (brokenImageSlides > (headlessResult.metrics.brokenImgs || 0)) {
    headlessResult.metrics.brokenImgs = brokenImageSlides;
  }
  if (zoneCollisionSlides > (headlessResult.metrics.zoneCollisionSlides || 0)) {
    headlessResult.metrics.zoneCollisionSlides = zoneCollisionSlides;
  }

  // Re-score with merged metrics
  const { computeScores } = require("./rubric-scores.js");
  const merged = computeScores(headlessResult.metrics, { accessibilityCap: 10 });
  headlessResult.scores = merged.scores;
  headlessResult.computedTotal = merged.computedTotal;
  headlessResult.maxComputed = merged.maxComputed;
}

// Use Puppeteer scores as primary (better metric collection), jsdom as supplementary
const primary = headlessResult || jsdomResult;
const secondary = headlessResult ? jsdomResult : null;

if (primary) {
  const s = primary.scores || {};
  const total = primary.computedTotal;
  const max = primary.maxComputed;
  const pct = max > 0 ? Math.round(total / max * 100) : 0;

  console.log("");
  console.log(`  ${chalk.bold("Score:")} ${total}/${max} (${pct}%)`);
  console.log("");

  Object.entries(s).filter(([,v]) => v !== null).forEach(([k, v]) => {
    const icon = v >= 9 ? green("●") : v >= 7 ? amber("◐") : accent("○");
    const secScore = secondary && secondary.scores[k] !== null ? dim(` [jsdom: ${secondary.scores[k]}]`) : "";
    console.log(`  ${icon} ${k.padEnd(25)} ${v}/10${secScore}`);
  });

  // Visual audit summary
  if (auditResult) {
    const c = auditResult.counts;
    console.log("");
    if (c.critical > 0) console.log(accent(`  ✖ ${c.critical} critical visual issues`));
    if (c.warning > 0) console.log(amber(`  ⚠ ${c.warning} visual warnings`));
    // List critical slides
    (auditResult.issues || []).forEach(si => {
      const crits = si.issues.filter(i => i.severity === "critical");
      if (crits.length) {
        console.log(accent(`    S${si.slide}: ${crits.map(c => c.type).join(", ")}`));
      }
    });
  }

  // Acceptance check
  console.log("");
  const allAbove9 = Object.entries(s).filter(([,v]) => v !== null).every(([,v]) => v >= 9);
  const zeroCriticals = !auditResult || auditResult.counts.critical === 0;
  const zeroCollisions = (primary.metrics || {}).zoneCollisionSlides === 0;
  const accepted = allAbove9 && zeroCriticals && zeroCollisions;

  if (accepted) {
    console.log(green("  ✓ PASSES automated acceptance (all dims >= 9, zero criticals, zero collisions)"));
  } else {
    const reasons = [];
    if (!allAbove9) reasons.push("dimensions below 9");
    if (!zeroCriticals) reasons.push("critical visual issues");
    if (!zeroCollisions) reasons.push("zone collisions");
    console.log(accent(`  ✖ FAILS automated acceptance: ${reasons.join(", ")}`));
  }
  console.log(dim("  (User acceptance via /rs:uat still required)\n"));

  // ── Log results for paper/corpus mining ──
  const resultsDir = path.join(projectRoot, "logs/results", path.basename(deckPath, ".html").replace(/\.spliced$/, ""));
  fs.mkdirSync(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const resultFile = path.join(resultsDir, `${timestamp}.json`);
  fs.writeFileSync(resultFile, JSON.stringify({
    date: new Date().toISOString(),
    deck: deckPath,
    mode: fullMode ? "full" : "fast",
    jsdom: jsdomResult ? { total: jsdomResult.computedTotal, max: jsdomResult.maxComputed, scores: jsdomResult.scores } : null,
    headless: primary ? { total: primary.computedTotal, max: primary.maxComputed, scores: primary.scores } : null,
    visualAudit: auditResult ? auditResult.counts : null,
    accepted,
  }, null, 2));
  console.log(dim(`  Results logged: ${resultFile}\n`));
}

if (jsonMode) {
  console.log(JSON.stringify({
    jsdom: jsdomResult,
    headless: headlessResult,
    visualAudit: auditResult,
  }, null, 2));
}
