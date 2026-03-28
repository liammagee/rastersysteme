#!/usr/bin/env node
/**
 * palette-compare.js — compare bg palettes across deck versions
 *
 * Detects convergence: are multiple versions using the same colors?
 *
 * Usage:
 *   node palette-compare.js decks/week-2-v*.spliced.html
 *   node palette-compare.js --source week-2    → auto-find all versions
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const args = process.argv.slice(2);
const sourceFlag = args.indexOf("--source");

let deckPaths;
if (sourceFlag >= 0) {
  const source = args[sourceFlag + 1];
  const decksDir = path.join(__dirname, "decks");
  deckPaths = fs.readdirSync(decksDir)
    .filter(f => f.startsWith(source) && f.endsWith(".spliced.html") && !f.includes("uat"))
    .sort()
    .map(f => path.join(decksDir, f));
} else {
  deckPaths = args.filter(a => !a.startsWith("--"));
}

if (deckPaths.length === 0) {
  console.log("Usage: node palette-compare.js --source week-2");
  process.exit(0);
}

console.log(chalk.cyan(`\n  ■ palette-compare (${deckPaths.length} decks)\n`));

// Extract bg colors from each deck
const projDir = __dirname;
const { JSDOM } = require(path.join(projDir, "node_modules", "jsdom"));

const deckPalettes = [];
for (const dp of deckPaths) {
  try {
    const html = fs.readFileSync(dp, "utf-8");
    const dom = new JSDOM(html);
    const slides = dom.window.document.querySelectorAll(".slide");
    const bgs = new Set();
    slides.forEach(s => {
      const style = s.getAttribute("style") || "";
      const bgMatch = style.match(/background:\s*([^;]+)/);
      if (bgMatch) bgs.add(bgMatch[1].trim().toLowerCase());
    });
    const name = path.basename(dp, ".spliced.html");
    deckPalettes.push({ name, bgs: [...bgs] });
    console.log(`  ${name}: ${[...bgs].join(", ") || "(no inline bg)"}`);
  } catch (e) {
    console.log(chalk.dim(`  ${path.basename(dp)}: error reading`));
  }
}

// Compare: how many colors are shared between consecutive versions?
console.log(chalk.yellow(`\n  Overlap analysis:\n`));
for (let i = 1; i < deckPalettes.length; i++) {
  const prev = new Set(deckPalettes[i - 1].bgs);
  const curr = new Set(deckPalettes[i].bgs);
  const shared = [...curr].filter(c => prev.has(c));
  const pct = curr.size > 0 ? Math.round(shared.length / curr.size * 100) : 0;
  const icon = pct > 50 ? chalk.red("✖") : pct > 25 ? chalk.yellow("◐") : chalk.green("✓");
  console.log(`  ${icon} ${deckPalettes[i - 1].name} → ${deckPalettes[i].name}: ${shared.length}/${curr.size} shared (${pct}%)`);
}

// Overall: how many colors appear in 3+ decks?
const colorCount = {};
for (const dp of deckPalettes) {
  for (const c of dp.bgs) {
    colorCount[c] = (colorCount[c] || 0) + 1;
  }
}
const overused = Object.entries(colorCount).filter(([, n]) => n >= 3);
if (overused.length > 0) {
  console.log(chalk.red(`\n  ⚠ Colors appearing in 3+ decks:`));
  overused.forEach(([c, n]) => console.log(chalk.red(`    ${c}: ${n} decks`)));
} else {
  console.log(chalk.green(`\n  ✓ Good diversity — no color appears in 3+ decks.`));
}
console.log("");
