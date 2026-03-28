#!/usr/bin/env node
/**
 * regression.js — screenshot baseline management for regression testing
 *
 * Usage:
 *   node regression.js save <deck.html>         Save current screenshots as baseline
 *   node regression.js check <deck.html>        Compare current screenshots against baseline
 *   node regression.js list                     List all saved baselines
 *
 * Baselines stored in logs/baselines/<deck-name>/
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");

const args = process.argv.slice(2);
const command = args[0];
const deckPath = args[1];
const projectRoot = path.resolve(__dirname);
const baselinesDir = path.join(projectRoot, "logs/baselines");

if (!command || command === "--help") {
  console.log(`
  regression.js — screenshot baseline management

  Usage:
    node regression.js save <deck.html>    Save screenshots as baseline
    node regression.js check <deck.html>   Compare against baseline
    node regression.js list                List saved baselines
  `);
  process.exit(0);
}

if (command === "list") {
  if (!fs.existsSync(baselinesDir)) {
    console.log("No baselines saved yet.");
    process.exit(0);
  }
  const dirs = fs.readdirSync(baselinesDir).filter(d =>
    fs.statSync(path.join(baselinesDir, d)).isDirectory()
  );
  console.log(chalk.cyan(`\n  Saved baselines (${dirs.length}):\n`));
  dirs.forEach(d => {
    const files = fs.readdirSync(path.join(baselinesDir, d)).filter(f => f.endsWith(".png"));
    const meta = path.join(baselinesDir, d, "meta.json");
    const info = fs.existsSync(meta) ? JSON.parse(fs.readFileSync(meta, "utf-8")) : {};
    console.log(`  ${d}: ${files.length} slides, saved ${info.date || "unknown"}`);
  });
  console.log("");
  process.exit(0);
}

if (!deckPath) {
  console.error("Error: deck path required");
  process.exit(1);
}

const deckName = path.basename(deckPath, ".html").replace(/\.spliced$/, "");
const baselineDir = path.join(baselinesDir, deckName);
const screenshotDir = "/tmp/rubric-screenshots";

function takeScreenshots() {
  console.log(chalk.yellow("  Taking screenshots..."));
  try {
    execSync(`node run-rubric-eval.js "${deckPath}" --screenshots-all`, {
      cwd: projectRoot, stdio: "pipe", timeout: 180000
    });
  } catch (e) {
    // eval may exit non-zero but screenshots are still saved
  }
  const files = fs.existsSync(screenshotDir)
    ? fs.readdirSync(screenshotDir).filter(f => f.endsWith(".png")).sort()
    : [];
  console.log(chalk.green(`  ✓ ${files.length} screenshots`));
  return files;
}

if (command === "save") {
  console.log(chalk.cyan(`\n  ■ regression — save baseline for ${deckName}\n`));

  const files = takeScreenshots();
  if (!files.length) {
    console.error("No screenshots to save.");
    process.exit(1);
  }

  fs.mkdirSync(baselineDir, { recursive: true });
  // Copy screenshots to baseline dir
  files.forEach(f => {
    fs.copyFileSync(path.join(screenshotDir, f), path.join(baselineDir, f));
  });
  // Save metadata
  fs.writeFileSync(path.join(baselineDir, "meta.json"), JSON.stringify({
    date: new Date().toISOString(),
    deck: deckPath,
    slideCount: files.length,
  }, null, 2));

  console.log(chalk.green(`\n  ✓ Baseline saved: ${baselineDir} (${files.length} slides)\n`));
}

if (command === "check") {
  console.log(chalk.cyan(`\n  ■ regression — check ${deckName} against baseline\n`));

  if (!fs.existsSync(baselineDir)) {
    console.log(chalk.red(`  No baseline found for ${deckName}. Run 'node regression.js save ${deckPath}' first.\n`));
    process.exit(1);
  }

  const files = takeScreenshots();
  const baselineFiles = fs.readdirSync(baselineDir).filter(f => f.endsWith(".png")).sort();

  console.log(chalk.yellow("\n  Comparing against baseline..."));

  let changed = 0, unchanged = 0, added = 0, removed = 0;
  const regressions = [];

  const allFiles = new Set([...files, ...baselineFiles]);
  for (const f of [...allFiles].sort()) {
    const currentPath = path.join(screenshotDir, f);
    const baselinePath = path.join(baselineDir, f);
    const hasCurrent = files.includes(f);
    const hasBaseline = baselineFiles.includes(f);

    if (hasCurrent && !hasBaseline) {
      added++;
      continue;
    }
    if (!hasCurrent && hasBaseline) {
      removed++;
      regressions.push({ slide: f, reason: "slide removed" });
      continue;
    }

    // Compare file sizes as quick diff
    const currentSize = fs.statSync(currentPath).size;
    const baselineSize = fs.statSync(baselinePath).size;
    const sizeDiff = Math.abs(currentSize - baselineSize) / Math.max(currentSize, baselineSize);

    if (sizeDiff > 0.03) { // >3% = changed
      changed++;
      regressions.push({ slide: f, reason: `${(sizeDiff * 100).toFixed(1)}% size change` });
    } else {
      unchanged++;
    }
  }

  console.log(chalk.green(`\n  Results:`));
  console.log(`  ${unchanged} unchanged, ${changed} changed, ${added} added, ${removed} removed\n`);

  if (regressions.length > 0) {
    console.log(chalk.red(`  ⚠ ${regressions.length} potential regressions:\n`));
    regressions.forEach(r => {
      console.log(chalk.red(`    ${r.slide}: ${r.reason}`));
    });

    // Generate visual diff
    console.log(chalk.yellow(`\n  Generating visual diff...`));
    const diffOutput = deckPath.replace(/\.html$/, ".regression-diff.html");
    try {
      execSync(`node visual-diff.js "${baselineDir}" "${screenshotDir}" --output "${diffOutput}"`, {
        cwd: projectRoot, encoding: "utf-8"
      });
      console.log(chalk.green(`  ✓ Diff report: ${diffOutput}\n`));
    } catch (e) {
      console.log(chalk.dim("  (diff generation failed)\n"));
    }
  } else {
    console.log(chalk.green(`  ✓ No regressions detected.\n`));
  }
}
