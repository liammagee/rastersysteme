#!/usr/bin/env node
/**
 * html2pptx — convert an HTML presentation to PPTX
 *
 * Finds the .composed.md file that corresponds to the HTML and re-renders
 * it as PPTX through the raster pipeline. This preserves all layout,
 * design directives, and theme settings.
 *
 * Usage:
 *   node html2pptx.js <slides.html> [output.pptx] [options]
 *
 * Options:
 *   --theme <name>   light | dark | red | blue (default: light)
 *   --help           Show this help
 *
 * Examples:
 *   node html2pptx.js decks/week-1.html
 *   node html2pptx.js decks/week-1.html decks/week-1.pptx --theme dark
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

function findComposedMd(htmlPath) {
  const dir = path.dirname(htmlPath);
  const base = path.basename(htmlPath, ".html");

  // Try common naming patterns
  const candidates = [
    path.join(dir, `${base}.composed.md`),
    path.join(dir, `${base}.md`),
  ];

  // Also check for spliced/merged variants
  const stripped = base.replace(/\.spliced$/, "").replace(/\.merged$/, "");
  if (stripped !== base) {
    candidates.unshift(path.join(dir, `${stripped}.composed.md`));
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return null;
}

function extractThemeFromHtml(htmlPath) {
  try {
    const html = fs.readFileSync(htmlPath, "utf-8");
    // Theme is often encoded in CSS variables or data attributes
    const themeMatch = html.match(/--bg:#([A-Fa-f0-9]{6})/);
    if (themeMatch) {
      const bg = themeMatch[1].toLowerCase();
      // Heuristic: dark backgrounds → dark theme
      const r = parseInt(bg.slice(0, 2), 16);
      const g = parseInt(bg.slice(2, 4), 16);
      const b = parseInt(bg.slice(4, 6), 16);
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      if (lum < 80) return "dark";
    }
  } catch { /* ignore */ }
  return "light";
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
  html2pptx — convert an HTML presentation to PPTX

  Finds the .composed.md source for the HTML and re-renders to PPTX.

  Usage:
    node html2pptx.js <slides.html> [output.pptx] [options]

  Options:
    --theme <name>   light | dark | red | blue (default: auto-detect)
    --help           Show this help

  Examples:
    node html2pptx.js decks/week-1.html
    node html2pptx.js decks/week-1.html decks/week-1.pptx --theme dark
    `);
    process.exit(0);
  }

  const htmlPath = args[0];

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  // Output defaults to same name with .pptx extension
  let outputPath = args[1] && !args[1].startsWith("--")
    ? args[1]
    : htmlPath.replace(/\.html$/, ".pptx");

  if (!fs.existsSync(htmlPath)) {
    console.error(`Error: file not found: ${htmlPath}`);
    process.exit(1);
  }

  // Find composed markdown source
  const composedPath = findComposedMd(htmlPath);
  if (!composedPath) {
    console.error(`Error: no .composed.md found for ${htmlPath}`);
    console.error(`  Looked for: ${path.basename(htmlPath, ".html")}.composed.md`);
    console.error(`  The HTML must have been generated via compose to have a markdown source.`);
    process.exit(1);
  }

  const theme = getFlag("--theme") || extractThemeFromHtml(htmlPath);

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("html2pptx")}\n`);
  process.stderr.write(`  ${dim("Source:")} ${teal(path.basename(composedPath))}\n`);
  process.stderr.write(`  ${dim("Theme:")}  ${theme}\n`);

  const { generate } = require("./raster.js");
  generate(composedPath, outputPath, { theme }).then(result => {
    process.stderr.write(`  ${sage("✓")} ${result.slides} slides → ${teal(outputPath)}\n`);
  }).catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { findComposedMd };
