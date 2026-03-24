#!/usr/bin/env node
/**
 * bump-font — adjust font sizes in an HTML presentation
 *
 * Finds the smallest inline font-size values and bumps them up.
 * Operates on the rendered HTML directly (no re-compose needed).
 *
 * Usage:
 *   node bump-font.js <slides.html> [options]
 *
 * Options:
 *   --by <pts>       Points to add (default: 2)
 *   --below <pts>    Only bump sizes below this threshold (default: auto — targets the smallest tier)
 *   --dry-run        Show what would change without modifying the file
 *   --help           Show this help
 *
 * Examples:
 *   node bump-font.js decks/week-1.html                   # auto-detect smallest, bump +2
 *   node bump-font.js decks/week-1.html --by 3            # bump smallest by 3pts
 *   node bump-font.js decks/week-1.html --below 14        # bump everything under 14px by 2
 *   node bump-font.js decks/week-1.html --below 14 --by 1 # bump everything under 14px by 1
 *   node bump-font.js decks/week-1.html --dry-run         # preview only
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

function analyzeFontSizes(html) {
  const sizes = {};
  const matches = html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)\s*px/g);
  for (const m of matches) {
    const s = parseFloat(m[1]);
    sizes[s] = (sizes[s] || 0) + 1;
  }
  return Object.entries(sizes)
    .map(([s, count]) => ({ size: parseFloat(s), count }))
    .sort((a, b) => a.size - b.size);
}

function detectSmallestTier(sizeEntries) {
  if (sizeEntries.length === 0) return 0;
  // Find the natural gap: smallest cluster is sizes before the first big jump
  // A "big jump" is when the next size is ≥ 3px larger than the current
  let threshold = sizeEntries[0].size;
  for (let i = 0; i < sizeEntries.length - 1; i++) {
    const gap = sizeEntries[i + 1].size - sizeEntries[i].size;
    threshold = sizeEntries[i].size;
    if (gap >= 3) break;
  }
  // Threshold is the upper bound of the smallest tier (inclusive)
  return threshold + 0.5;
}

function bumpFonts(html, { by = 2, below = null } = {}) {
  const entries = analyzeFontSizes(html);
  const threshold = below != null ? below : detectSmallestTier(entries);
  const changes = [];

  const result = html.replace(/font-size:\s*(\d+(?:\.\d+)?)\s*px/g, (match, sizeStr) => {
    const size = parseFloat(sizeStr);
    if (size < threshold) {
      const newSize = size + by;
      const key = `${size}px → ${newSize}px`;
      const existing = changes.find(c => c.key === key);
      if (existing) existing.count++;
      else changes.push({ key, from: size, to: newSize, count: 1 });
      return `font-size:${newSize}px`;
    }
    return match;
  });

  return { html: result, changes, threshold };
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
  bump-font — adjust font sizes in an HTML presentation

  Finds the smallest inline font-size values and bumps them up.

  Usage:
    node bump-font.js <slides.html> [options]

  Options:
    --by <pts>       Points to add (default: 2)
    --below <pts>    Only bump sizes below this threshold
                     (default: auto-detect smallest tier)
    --dry-run        Show what would change without modifying
    --help           Show this help

  Examples:
    node bump-font.js decks/week-1.html
    node bump-font.js decks/week-1.html --by 3
    node bump-font.js decks/week-1.html --below 14
    node bump-font.js decks/week-1.html --dry-run
    `);
    process.exit(0);
  }

  const htmlPath = args[0];

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const by = parseFloat(getFlag("--by") || "2");
  const below = getFlag("--below") ? parseFloat(getFlag("--below")) : null;
  const dryRun = args.includes("--dry-run");

  if (!fs.existsSync(htmlPath)) {
    console.error(`Error: file not found: ${htmlPath}`);
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, "utf-8");

  // Show current distribution
  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("bump-font")}\n`);
  process.stderr.write(`  ${dim("File:")} ${teal(path.basename(htmlPath))}\n\n`);

  const entries = analyzeFontSizes(html);
  process.stderr.write(`  ${dim("Current font sizes:")}\n`);
  entries.forEach(e => {
    process.stderr.write(`    ${String(e.size).padStart(4)}px  ${dim("×")} ${e.count}\n`);
  });

  const { html: result, changes, threshold } = bumpFonts(html, { by, below });

  process.stderr.write(`\n  ${dim("Threshold:")} < ${threshold}px ${dim("| Bump:")} +${by}px\n`);

  if (changes.length === 0) {
    process.stderr.write(`  ${dim("No fonts below threshold — nothing to change.")}\n\n`);
    process.exit(0);
  }

  process.stderr.write(`  ${dim("Changes:")}\n`);
  changes.forEach(c => {
    process.stderr.write(`    ${c.from}px → ${amber(c.to + "px")}  ${dim("×")} ${c.count}\n`);
  });

  if (dryRun) {
    process.stderr.write(`\n  ${dim("(dry run — no changes written)")}\n\n`);
  } else {
    fs.writeFileSync(htmlPath, result);
    process.stderr.write(`\n  ${sage("✓")} Updated ${teal(path.basename(htmlPath))}\n\n`);
  }
}

module.exports = { bumpFonts, analyzeFontSizes };
