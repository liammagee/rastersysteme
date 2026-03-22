#!/usr/bin/env node
/**
 * diff-slides — visual diff between two composed slide decks
 *
 * Compares two .composed.md files side-by-side, highlighting slides where
 * design directives differ. Generates an HTML report.
 *
 * Usage:
 *   node diff-slides.js <before.md> <after.md> [options]
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { parseMarkdown, THEMES, HTML_LAYOUTS, detectLayout, adaptThemeForBg, generateHTMLCSS } = require("./raster.js");

const dim = chalk.gray;
const accent = chalk.hex("#C44230");
const teal = chalk.hex("#2C7A92");
const sage = chalk.hex("#548C5A");
const amber = chalk.hex("#C79B38");

// ═══════════════════════════════════════════════════════
// SLIDE DIFFER
// ═══════════════════════════════════════════════════════

function extractDirectives(slideRaw) {
  const layout = (slideRaw.match(/<!-- layout: (\w+) -->/) || [])[1] || null;
  const bg = (slideRaw.match(/<!-- bg: ([A-Fa-f0-9]+) -->/) || [])[1] || null;
  const font = (slideRaw.match(/<!-- font: ([^->]+?) -->/) || [])[1]?.trim() || null;
  const label = (slideRaw.match(/^### (.+)$/m) || [])[1] || null;
  const transition = (slideRaw.match(/<!-- transition: ([\w-]+) -->/) || [])[1] || null;
  return { layout, bg, font, label, transition };
}

function diffSlides(beforeMd, afterMd) {
  const beforeRaw = beforeMd.split(/\n---\n/).filter(s => s.trim());
  const afterRaw = afterMd.split(/\n---\n/).filter(s => s.trim());

  const maxLen = Math.max(beforeRaw.length, afterRaw.length);
  const diffs = [];

  for (let i = 0; i < maxLen; i++) {
    const bRaw = beforeRaw[i] || "";
    const aRaw = afterRaw[i] || "";
    const bDir = extractDirectives(bRaw);
    const aDir = extractDirectives(aRaw);

    const changes = [];
    if (bDir.layout !== aDir.layout) changes.push({ field: "layout", before: bDir.layout, after: aDir.layout });
    if (bDir.bg !== aDir.bg) changes.push({ field: "bg", before: bDir.bg, after: aDir.bg });
    if (bDir.font !== aDir.font) changes.push({ field: "font", before: bDir.font, after: aDir.font });
    if (bDir.label !== aDir.label) changes.push({ field: "label", before: bDir.label, after: aDir.label });
    if (bDir.transition !== aDir.transition) changes.push({ field: "transition", before: bDir.transition, after: aDir.transition });

    // Content diff — strip directives and compare
    const stripDirectives = (s) => s.replace(/<!-- [\w]+: [^>]+ -->\n?/g, "").replace(/^### .+\n?/m, "").trim();
    const bContent = stripDirectives(bRaw);
    const aContent = stripDirectives(aRaw);
    const contentChanged = bContent !== aContent;

    diffs.push({
      slide: i + 1,
      before: bDir,
      after: aDir,
      changes,
      contentChanged,
      added: !bRaw && !!aRaw,
      removed: !!bRaw && !aRaw,
    });
  }

  return diffs;
}

// ═══════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════

function generateDiffReport(diffs, beforeName, afterName, outputPath, options = {}) {
  const theme = THEMES[options.theme || "light"] || THEMES.light;

  const totalSlides = diffs.length;
  const changedSlides = diffs.filter(d => d.changes.length > 0 || d.contentChanged || d.added || d.removed);
  const unchangedSlides = totalSlides - changedSlides.length;

  // Summary stats
  const layoutChanges = diffs.filter(d => d.changes.some(c => c.field === "layout")).length;
  const bgChanges = diffs.filter(d => d.changes.some(c => c.field === "bg")).length;
  const fontChanges = diffs.filter(d => d.changes.some(c => c.field === "font")).length;
  const labelChanges = diffs.filter(d => d.changes.some(c => c.field === "label")).length;

  // Before/after layout distributions
  const beforeLayouts = {};
  const afterLayouts = {};
  diffs.forEach(d => {
    if (d.before.layout) beforeLayouts[d.before.layout] = (beforeLayouts[d.before.layout] || 0) + 1;
    if (d.after.layout) afterLayouts[d.after.layout] = (afterLayouts[d.after.layout] || 0) + 1;
  });

  // Before/after palette
  const beforeBgs = [...new Set(diffs.map(d => d.before.bg).filter(Boolean))];
  const afterBgs = [...new Set(diffs.map(d => d.after.bg).filter(Boolean))];

  const slideRows = diffs.map(d => {
    const status = d.added ? "added" : d.removed ? "removed" : d.changes.length > 0 ? "changed" : "same";
    const changeDetails = d.changes.map(c => {
      const bVal = c.before || "—";
      const aVal = c.after || "—";
      const fieldColor = c.field === "layout" ? "#B7311A" : c.field === "bg" ? "#876512" : c.field === "font" ? "#1B5E80" : "#2B7038";
      return `<span class="change-badge" style="border-color:${fieldColor}"><span class="field">${c.field}</span> ${bVal} → ${aVal}</span>`;
    }).join(" ");

    const bgSwatch = (hex) => hex ? `<span class="swatch" style="background:#${hex}" title="#${hex}"></span>` : "";

    return `<tr class="slide-row ${status}">
      <td class="num">${d.slide}</td>
      <td>${d.before.layout || "—"}</td>
      <td>${d.after.layout || "—"}</td>
      <td>${bgSwatch(d.before.bg)}${bgSwatch(d.after.bg)}</td>
      <td class="changes">${changeDetails || (d.contentChanged ? '<span class="content-flag">content</span>' : dim ? "—" : "—")}</td>
    </tr>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<title>Diff: ${beforeName} → ${afterName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#0a0a0a;color:#e0d8cc;padding:3rem}
h1{font-size:1.8rem;font-weight:700;margin-bottom:0.5rem}
h2{font-size:1rem;font-weight:400;color:#8C8478;margin-bottom:2rem}
.meta{display:flex;gap:3rem;margin-bottom:2rem;font-family:'Space Mono',monospace;font-size:0.75rem;color:#8C8478}
.meta .stat{display:flex;flex-direction:column;gap:0.2rem}
.meta .stat-value{font-size:1.5rem;font-weight:700;color:#e0d8cc}
.meta .stat-value.changed{color:#B7311A}
.meta .stat-value.same{color:#2B7038}

/* Palette comparison */
.palettes{display:flex;gap:3rem;margin-bottom:2rem}
.palette-group{display:flex;flex-direction:column;gap:0.5rem}
.palette-label{font-family:'Space Mono',monospace;font-size:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.15em}
.palette-row{display:flex;gap:4px}
.swatch{width:24px;height:24px;border-radius:3px;border:1px solid #333;display:inline-block;vertical-align:middle}

/* Table */
table{width:100%;border-collapse:collapse;margin-top:1rem}
th{font-family:'Space Mono',monospace;font-size:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.1em;
  text-align:left;padding:0.8rem 1rem;border-bottom:1px solid #222}
td{padding:0.6rem 1rem;border-bottom:1px solid #1a1a1a;font-size:0.85rem}
.num{font-family:'Space Mono',monospace;color:#555;width:3rem}
.slide-row.changed{background:#1a1510}
.slide-row.added{background:#0a1a0a}
.slide-row.removed{background:#1a0a0a}
.slide-row.same{opacity:0.4}
.slide-row.same:hover{opacity:1}

/* Change badges */
.change-badge{display:inline-flex;align-items:center;gap:0.3rem;padding:0.2rem 0.5rem;
  border:1px solid;border-radius:3px;font-size:0.7rem;font-family:'Space Mono',monospace;margin:0 0.2rem}
.change-badge .field{font-weight:700}
.content-flag{color:#876512;font-family:'Space Mono',monospace;font-size:0.7rem}

/* Layout distribution */
.distributions{display:flex;gap:3rem;margin-bottom:2rem}
.dist-group{flex:1}
.dist-label{font-family:'Space Mono',monospace;font-size:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:0.5rem}
.dist-bar{display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem}
.dist-bar-name{font-family:'Space Mono',monospace;font-size:0.7rem;width:80px;color:#8C8478}
.dist-bar-fill{height:14px;background:#B7311A;border-radius:2px;min-width:2px}
.dist-bar-count{font-family:'Space Mono',monospace;font-size:0.65rem;color:#555}
</style></head><body>
<h1>${beforeName} → ${afterName}</h1>
<h2>Design directive diff</h2>

<div class="meta">
  <div class="stat"><span>Total</span><span class="stat-value">${totalSlides}</span></div>
  <div class="stat"><span>Changed</span><span class="stat-value changed">${changedSlides.length}</span></div>
  <div class="stat"><span>Unchanged</span><span class="stat-value same">${unchangedSlides}</span></div>
  <div class="stat"><span>Layouts</span><span class="stat-value">${layoutChanges}</span></div>
  <div class="stat"><span>Backgrounds</span><span class="stat-value">${bgChanges}</span></div>
  <div class="stat"><span>Fonts</span><span class="stat-value">${fontChanges}</span></div>
  <div class="stat"><span>Labels</span><span class="stat-value">${labelChanges}</span></div>
</div>

<div class="palettes">
  <div class="palette-group">
    <div class="palette-label">Before palette</div>
    <div class="palette-row">${beforeBgs.map(b => `<span class="swatch" style="background:#${b}" title="#${b}"></span>`).join("")}</div>
  </div>
  <div class="palette-group">
    <div class="palette-label">After palette</div>
    <div class="palette-row">${afterBgs.map(b => `<span class="swatch" style="background:#${b}" title="#${b}"></span>`).join("")}</div>
  </div>
</div>

<div class="distributions">
  <div class="dist-group">
    <div class="dist-label">Before layouts</div>
    ${Object.entries(beforeLayouts).sort((a, b) => b[1] - a[1]).map(([name, count]) =>
      `<div class="dist-bar"><span class="dist-bar-name">${name}</span><div class="dist-bar-fill" style="width:${count * 20}px"></div><span class="dist-bar-count">${count}</span></div>`
    ).join("")}
  </div>
  <div class="dist-group">
    <div class="dist-label">After layouts</div>
    ${Object.entries(afterLayouts).sort((a, b) => b[1] - a[1]).map(([name, count]) =>
      `<div class="dist-bar"><span class="dist-bar-name">${name}</span><div class="dist-bar-fill" style="width:${count * 20}px;background:#1B5E80"></div><span class="dist-bar-count">${count}</span></div>`
    ).join("")}
  </div>
</div>

<table>
  <thead><tr>
    <th>#</th><th>Before layout</th><th>After layout</th><th>Bg</th><th>Changes</th>
  </tr></thead>
  <tbody>${slideRows}</tbody>
</table>

</body></html>`;

  fs.writeFileSync(outputPath, html);
  return { totalSlides, changedSlides: changedSlides.length, unchangedSlides, outputPath };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes("--help")) {
    console.log(`
  diff-slides — visual diff between two composed slide decks

  Usage:
    node diff-slides.js <before.md> <after.md> [options]

  Options:
    --output <path>    Output HTML path (default: diff.html)
    --theme <name>     Theme for rendering (default: light)
    --help             Show this help

  Examples:
    node diff-slides.js decks/week-1-v1.composed.md decks/week-1-v2.composed.md
    node diff-slides.js deck-old.md deck-new.md --output comparison.html
    `);
    process.exit(0);
  }

  const before = args[0];
  const after = args[1];

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const outputPath = getFlag("--output") || "diff.html";
  const theme = getFlag("--theme") || "light";

  if (!fs.existsSync(before)) { console.error(`Error: ${before} not found`); process.exit(1); }
  if (!fs.existsSync(after)) { console.error(`Error: ${after} not found`); process.exit(1); }

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("diff-slides")}\n`);
  process.stderr.write(`  ${dim("Before:")} ${teal(path.basename(before))}\n`);
  process.stderr.write(`  ${dim("After:")}  ${teal(path.basename(after))}\n`);

  const beforeMd = fs.readFileSync(before, "utf-8");
  const afterMd = fs.readFileSync(after, "utf-8");
  const diffs = diffSlides(beforeMd, afterMd);

  const result = generateDiffReport(
    diffs,
    path.basename(before),
    path.basename(after),
    outputPath,
    { theme }
  );

  process.stderr.write(`\n  ${sage("✓")} ${result.changedSlides}/${result.totalSlides} slides changed → ${teal(outputPath)}\n`);
}

module.exports = { diffSlides, generateDiffReport, extractDirectives };
