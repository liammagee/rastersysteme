#!/usr/bin/env node
/**
 * run-uat.js — User Acceptance Test runner for slide decks
 *
 * Orchestrates the outer loop:
 *   1. Screenshot every slide (via rubric-headless --screenshots-all)
 *   2. Generate wireframes (via wireframe.js)
 *   3. Run visual audit (via visual-audit.js)
 *   4. Run rubric evaluation (via run-rubric-eval.js)
 *   5. Generate an HTML checklist page for human review
 *
 * The checklist shows each slide's screenshot + wireframe side-by-side
 * with pass/fail checkboxes and issue categories.
 *
 * Usage:
 *   node run-uat.js <deck.html>
 *   node run-uat.js <deck.html> --composed <deck.composed.md>
 *   node run-uat.js <deck.html> --output uat-report.html
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");

const args = process.argv.slice(2);
const deckPath = args.find(a => !a.startsWith("--"));
if (!deckPath) {
  console.log("Usage: node run-uat.js <deck.html> [--composed <file>] [--output <file>]");
  process.exit(1);
}

const composedFlag = args.indexOf("--composed");
const composedPath = composedFlag >= 0 ? args[composedFlag + 1] : deckPath.replace(/\.spliced\.html$/, ".composed.md").replace(/\.html$/, ".composed.md");
const outputFlag = args.indexOf("--output");
const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : deckPath.replace(/\.html$/, ".uat.html");

const screenshotDir = "/tmp/uat-screenshots";
const projectRoot = path.resolve(__dirname);

console.log(chalk.cyan("\n  ■ UAT Runner"));
console.log(chalk.dim(`  Deck: ${deckPath}`));
console.log(chalk.dim(`  Composed: ${composedPath}`));

// Step 1: Screenshots
console.log(chalk.yellow("\n  Step 1: Screenshotting every slide..."));
try {
  execSync(`node run-rubric-eval.js "${deckPath}" --screenshots-all`, {
    cwd: projectRoot,
    stdio: "pipe",
    env: { ...process.env, RUBRIC_SCREENSHOT_DIR: screenshotDir }
  });
} catch (e) {
  // run-rubric-eval exits with the rubric exit code; screenshots are still saved
}
// Screenshots land in /tmp/rubric-screenshots/ by default
const actualScreenshotDir = "/tmp/rubric-screenshots";
const screenshots = fs.existsSync(actualScreenshotDir)
  ? fs.readdirSync(actualScreenshotDir).filter(f => f.endsWith(".png")).sort()
  : [];
console.log(chalk.green(`  ✓ ${screenshots.length} screenshots`));

// Step 2: Wireframes
console.log(chalk.yellow("  Step 2: Generating wireframes..."));
let wireframes = [];
if (fs.existsSync(composedPath)) {
  try {
    const wfJSON = execSync(`node wireframe.js "${composedPath}" --json`, {
      cwd: projectRoot, encoding: "utf-8"
    });
    wireframes = JSON.parse(wfJSON);
  } catch (e) {
    console.log(chalk.dim("  (wireframe generation failed, continuing without)"));
  }
}
console.log(chalk.green(`  ✓ ${wireframes.length} wireframes`));

// Step 3: Visual audit
console.log(chalk.yellow("  Step 3: Running visual audit..."));
let auditResults = { counts: { critical: 0, warning: 0, info: 0 }, issues: [] };
try {
  const auditJSON = execSync(`node visual-audit.js "${deckPath}" --json`, {
    cwd: projectRoot, encoding: "utf-8", timeout: 60000
  });
  // Extract JSON from output (may have stderr mixed in)
  const jsonStart = auditJSON.indexOf("{");
  if (jsonStart >= 0) {
    auditResults = JSON.parse(auditJSON.slice(jsonStart));
  }
} catch (e) {
  console.log(chalk.dim("  (visual audit failed, continuing without)"));
}
console.log(chalk.green(`  ✓ ${auditResults.counts.critical} critical, ${auditResults.counts.warning} warning`));

// Step 4: Rubric scores
console.log(chalk.yellow("  Step 4: Reading rubric scores..."));
const scoreCardPath = path.join("logs/qa", path.basename(deckPath, ".html") + "-scorecard.json");
let scores = null;
if (fs.existsSync(scoreCardPath)) {
  const sc = JSON.parse(fs.readFileSync(scoreCardPath, "utf-8"));
  scores = Array.isArray(sc) ? sc[sc.length - 1] : sc;
}

// Step 5: Generate HTML checklist
console.log(chalk.yellow("  Step 5: Generating UAT checklist..."));

const slideCount = screenshots.length || wireframes.length || (scores ? scores.metrics.total : 0);
const issuesBySlide = {};
(auditResults.issues || []).forEach(s => {
  issuesBySlide[s.slide] = s.issues.filter(i => i.severity !== "info");
});

let slideCards = "";
for (let i = 0; i < slideCount; i++) {
  const slideNum = i + 1;
  const ssFile = screenshots.find(f => f.includes(`slide-${String(slideNum).padStart(2, "0")}`));
  const ssPath = ssFile ? path.join(actualScreenshotDir, ssFile) : null;
  const wf = wireframes[i] || null;
  const issues = issuesBySlide[slideNum] || [];
  const textLen = scores ? (scores.metrics.perSlideTextLen || [])[i] || 0 : 0;
  const slideIssues = scores ? (scores.metrics.perSlideIssues || [])[i] || [] : [];

  const issueHTML = issues.length
    ? `<div class="issues">${issues.map(is => `<span class="issue ${is.severity}">${is.type}: ${(is.detail || "").substring(0, 60)}</span>`).join("")}</div>`
    : '<div class="issues clean">No issues detected</div>';

  const wfHTML = wf
    ? `<pre class="wireframe">${wf.wireframe.replace(/</g, "&lt;")}</pre>`
    : '<div class="wireframe-missing">No wireframe available</div>';

  slideCards += `
    <div class="slide-card" id="slide-${slideNum}">
      <div class="slide-header">
        <h3>Slide ${slideNum}</h3>
        <span class="text-len">${textLen} chars</span>
        <label class="verdict">
          <input type="checkbox" name="pass-${slideNum}" checked> Pass
        </label>
      </div>
      <div class="comparison">
        <div class="screenshot">
          ${ssPath ? `<img src="file://${path.resolve(ssPath)}" alt="Slide ${slideNum} screenshot">` : '<div class="no-screenshot">No screenshot</div>'}
        </div>
        <div class="wireframe-col">
          ${wfHTML}
        </div>
      </div>
      ${issueHTML}
      <div class="rubric-issues">${slideIssues.length ? slideIssues.join(", ") : ""}</div>
      <textarea class="notes" placeholder="Notes on this slide..."></textarea>
    </div>`;
}

const scoresHTML = scores ? `
  <div class="scores-summary">
    <h2>Rubric Scores</h2>
    <table>
      <tr><th>Dimension</th><th>Score</th></tr>
      ${Object.entries(scores.scores).filter(([,v]) => v !== null).map(([k,v]) =>
        `<tr><td>${k}</td><td class="${v >= 9 ? 'good' : v >= 7 ? 'ok' : 'bad'}">${v}/10</td></tr>`
      ).join("")}
      <tr class="total"><td>Total</td><td>${scores.computedTotal}/${scores.maxComputed} (${Math.round(scores.computedTotal/scores.maxComputed*100)}%)</td></tr>
    </table>
  </div>` : "";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>UAT: ${path.basename(deckPath)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .meta { color: #888; font-size: 0.85rem; margin-bottom: 2rem; }
  .scores-summary { background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .scores-summary table { width: 100%; border-collapse: collapse; }
  .scores-summary th, .scores-summary td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #eee; }
  .scores-summary .good { color: #2d7d46; font-weight: 600; }
  .scores-summary .ok { color: #b8860b; }
  .scores-summary .bad { color: #c0392b; font-weight: 600; }
  .scores-summary .total { font-weight: 700; border-top: 2px solid #333; }
  .slide-card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .slide-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
  .slide-header h3 { font-size: 1.1rem; }
  .text-len { color: #888; font-size: 0.8rem; }
  .verdict { margin-left: auto; font-weight: 600; }
  .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
  .screenshot img { width: 100%; border: 1px solid #ddd; border-radius: 4px; }
  .wireframe { font-size: 0.55rem; line-height: 1.15; background: #1a1a2e; color: #a8e6cf; padding: 0.75rem; border-radius: 4px; overflow-x: auto; white-space: pre; }
  .wireframe-missing { background: #f0f0f0; padding: 2rem; text-align: center; color: #999; border-radius: 4px; }
  .no-screenshot { background: #f0f0f0; padding: 4rem 2rem; text-align: center; color: #999; border-radius: 4px; }
  .issues { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; }
  .issue { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 3px; }
  .issue.critical { background: #fde2e2; color: #c0392b; }
  .issue.warning { background: #fff3cd; color: #856404; }
  .clean { color: #2d7d46; font-size: 0.85rem; }
  .rubric-issues { font-size: 0.75rem; color: #888; margin-bottom: 0.5rem; }
  textarea.notes { width: 100%; height: 3rem; border: 1px solid #ddd; border-radius: 4px; padding: 0.5rem; font-size: 0.85rem; resize: vertical; }
  .summary-bar { position: sticky; top: 0; background: white; padding: 1rem 1.5rem; border-bottom: 2px solid #333; z-index: 10; display: flex; gap: 2rem; align-items: center; margin: -2rem -2rem 2rem -2rem; }
  .summary-bar .count { font-weight: 700; }
  .summary-bar .critical-count { color: #c0392b; }
</style>
</head>
<body>
  <div class="summary-bar">
    <h1>UAT: ${path.basename(deckPath)}</h1>
    <span class="count">${slideCount} slides</span>
    <span class="count critical-count">${auditResults.counts.critical} critical</span>
    <span class="count">${auditResults.counts.warning} warning</span>
    ${scores ? `<span class="count">${scores.computedTotal}/${scores.maxComputed} (${Math.round(scores.computedTotal/scores.maxComputed*100)}%)</span>` : ""}
  </div>
  <div class="meta">Generated ${new Date().toISOString().split("T")[0]} | Composed: ${path.basename(composedPath)}</div>
  ${scoresHTML}
  ${slideCards}
  <script>
    // Auto-uncheck slides with critical issues
    document.querySelectorAll('.slide-card').forEach(card => {
      const hasCritical = card.querySelector('.issue.critical');
      if (hasCritical) {
        const cb = card.querySelector('input[type=checkbox]');
        if (cb) cb.checked = false;
      }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(outputPath, html);

// ── UAT History Log ──
const historyPath = path.join(projectRoot, "logs/uat-history.json");
const historyDir = path.dirname(historyPath);
if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

const history = fs.existsSync(historyPath)
  ? JSON.parse(fs.readFileSync(historyPath, "utf-8"))
  : [];

const criticalSlides = (auditResults.issues || [])
  .filter(s => s.issues.some(i => i.severity === "critical"))
  .map(s => s.slide);
const warningSlides = (auditResults.issues || [])
  .filter(s => s.issues.some(i => i.severity === "warning"))
  .map(s => s.slide);

history.push({
  date: new Date().toISOString(),
  deck: path.basename(deckPath),
  composed: path.basename(composedPath),
  slideCount,
  scores: scores ? {
    total: scores.computedTotal,
    max: scores.maxComputed,
    pct: scores.maxComputed > 0 ? Math.round(scores.computedTotal / scores.maxComputed * 100) : 0,
    dimensions: Object.fromEntries(
      Object.entries(scores.scores).filter(([, v]) => v !== null)
    ),
  } : null,
  visualAudit: {
    critical: auditResults.counts.critical,
    warning: auditResults.counts.warning,
    criticalSlides,
    warningSlides,
  },
  autoFailSlides: criticalSlides,
  wireframeCount: wireframes.length,
  screenshotCount: screenshots.length,
});

fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
console.log(chalk.green(`\n  ✓ UAT checklist → ${outputPath}`));
console.log(chalk.green(`  ✓ UAT history → ${historyPath} (${history.length} sessions)`));
console.log(chalk.dim(`  Open in browser to review: file://${path.resolve(outputPath)}`));
console.log(chalk.dim(`  Slides with critical issues auto-marked as 'fail'\n`));
