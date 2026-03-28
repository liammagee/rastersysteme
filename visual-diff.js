#!/usr/bin/env node
/**
 * visual-diff.js — compare screenshots between two deck iterations
 *
 * Takes two screenshot directories and generates an HTML report showing
 * which slides changed, with side-by-side comparison.
 *
 * Usage:
 *   node visual-diff.js <before-dir> <after-dir>
 *   node visual-diff.js <before-dir> <after-dir> --output diff-report.html
 *
 * Typically used after refine-step to see what changed:
 *   node run-rubric-eval.js deck-v1.html --screenshots-all  # before
 *   mv /tmp/rubric-screenshots /tmp/before
 *   # ... apply fixes ...
 *   node run-rubric-eval.js deck-v2.html --screenshots-all  # after
 *   node visual-diff.js /tmp/before /tmp/rubric-screenshots
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const beforeDir = args[0];
const afterDir = args[1];
const outputFlag = args.indexOf("--output");
const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : "visual-diff.html";

if (!beforeDir || !afterDir) {
  console.log("Usage: node visual-diff.js <before-dir> <after-dir> [--output <file>]");
  process.exit(1);
}

const beforeFiles = fs.readdirSync(beforeDir).filter(f => f.endsWith(".png")).sort();
const afterFiles = fs.readdirSync(afterDir).filter(f => f.endsWith(".png")).sort();

// Match slides by filename
const allSlides = new Set([...beforeFiles, ...afterFiles]);
const slides = [...allSlides].sort().map(name => ({
  name,
  before: beforeFiles.includes(name) ? path.resolve(beforeDir, name) : null,
  after: afterFiles.includes(name) ? path.resolve(afterDir, name) : null,
}));

// Compare file sizes as a quick diff heuristic (different size = changed)
const changed = [];
const unchanged = [];
for (const slide of slides) {
  if (!slide.before || !slide.after) {
    changed.push({ ...slide, reason: slide.before ? "removed" : "added" });
    continue;
  }
  const beforeSize = fs.statSync(slide.before).size;
  const afterSize = fs.statSync(slide.after).size;
  const sizeDiff = Math.abs(beforeSize - afterSize) / Math.max(beforeSize, afterSize);
  if (sizeDiff > 0.02) { // >2% size difference = probably changed
    changed.push({ ...slide, reason: `${(sizeDiff * 100).toFixed(1)}% size diff` });
  } else {
    unchanged.push(slide);
  }
}

const slideCards = changed.map(s => `
  <div class="diff-card changed">
    <h3>${s.name} <span class="reason">(${s.reason})</span></h3>
    <div class="comparison">
      <div>
        <div class="label">Before</div>
        ${s.before ? `<img src="file://${s.before}" alt="Before">` : '<div class="missing">N/A</div>'}
      </div>
      <div>
        <div class="label">After</div>
        ${s.after ? `<img src="file://${s.after}" alt="After">` : '<div class="missing">N/A</div>'}
      </div>
    </div>
  </div>
`).join("");

const unchangedList = unchanged.map(s => `<span class="unchanged-slide">${s.name}</span>`).join(" ");

const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Visual Diff</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 2rem; }
  h1 { margin-bottom: 0.5rem; }
  .meta { color: #888; margin-bottom: 2rem; }
  .diff-card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .diff-card.changed { border-left: 4px solid #e74c3c; }
  .reason { color: #e74c3c; font-size: 0.85rem; font-weight: normal; }
  .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .comparison img { width: 100%; border: 1px solid #ddd; border-radius: 4px; }
  .label { font-size: 0.8rem; color: #888; margin-bottom: 0.5rem; text-transform: uppercase; }
  .missing { background: #f0f0f0; padding: 3rem; text-align: center; color: #999; border-radius: 4px; }
  .unchanged { background: white; border-radius: 8px; padding: 1rem; margin-top: 2rem; }
  .unchanged-slide { display: inline-block; padding: 0.2rem 0.5rem; background: #e8f5e9; border-radius: 3px; margin: 0.2rem; font-size: 0.8rem; }
</style></head>
<body>
  <h1>Visual Diff</h1>
  <div class="meta">${changed.length} changed, ${unchanged.length} unchanged</div>
  ${changed.length ? slideCards : '<p>No changes detected.</p>'}
  ${unchanged.length ? `<div class="unchanged"><h3>Unchanged (${unchanged.length})</h3><p>${unchangedList}</p></div>` : ''}
</body></html>`;

fs.writeFileSync(outputPath, html);
console.log(`Visual diff: ${changed.length} changed, ${unchanged.length} unchanged → ${outputPath}`);
