#!/usr/bin/env node
/**
 * batch.js — run raster, compose, or qa across all *.md in a folder
 *
 * Usage:
 *   node batch.js <command> <folder> [options]
 *
 * Commands:
 *   raster    Generate PPTX/HTML for each *.md
 *   compose   Run Claude art direction on each *.md
 *   qa        Run quality audit on each *.md
 *   review    Generate review page for each *.md
 *
 * Options are passed through to the underlying tool.
 *
 * Examples:
 *   node batch.js raster ./decks --theme dark --format html
 *   node batch.js qa ./decks --theme dark --format html
 *   node batch.js compose ./decks --intensity radical --theme dark
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const glob = require("path");

function findMdFiles(folder) {
  const abs = path.resolve(folder);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    console.error("Error: Not a directory: " + folder);
    process.exit(1);
  }
  return fs.readdirSync(abs)
    .filter(f => f.endsWith(".md") && !f.endsWith(".composed.md"))
    .sort()
    .map(f => path.join(abs, f));
}

const COMMANDS = {
  raster: "raster.js",
  compose: "compose.js",
  qa: "qa.js",
  review: "raster.js",
};

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes("--help")) {
    console.log(`
  batch — run rastersysteme tools on all *.md in a folder

  Usage:
    node batch.js <command> <folder> [options]

  Commands:
    raster    Generate PPTX/HTML for each *.md
    compose   Run Claude art direction on each *.md
    qa        Run quality audit on each *.md
    review    Generate review page for each *.md

  Options are passed through to the underlying tool.
  Files ending in .composed.md are skipped.

  Examples:
    node batch.js raster ./decks --theme dark --format html
    node batch.js qa . --theme dark
    node batch.js compose ./decks --intensity radical --theme dark
    node batch.js review . --theme dark
    `);
    process.exit(0);
  }

  const command = args[0];
  const folder = args[1];
  const passthrough = args.slice(2);

  if (!COMMANDS[command]) {
    console.error("Unknown command: " + command + ". Use raster, compose, qa, or review.");
    process.exit(1);
  }

  const script = path.join(__dirname, COMMANDS[command]);
  const files = findMdFiles(folder);

  if (files.length === 0) {
    console.error("No .md files found in " + folder);
    process.exit(1);
  }

  console.log(`\n  batch ${command}: ${files.length} files in ${path.resolve(folder)}\n`);

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const file of files) {
    const name = path.basename(file);
    const fileArgs = [script, file, ...passthrough];

    // For review command, inject --format review
    if (command === "review" && !passthrough.includes("--format")) {
      fileArgs.splice(2, 0, "--format", "review");
    }

    process.stdout.write("  " + name + " ... ");

    const start = Date.now();
    const result = spawnSync("node", fileArgs, {
      cwd: path.dirname(file),
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });
    const elapsed = Date.now() - start;

    const stdout = result.stdout ? result.stdout.toString() : "";
    const stderr = result.stderr ? result.stderr.toString() : "";
    const ok = result.status === 0;

    if (ok) {
      passed++;
      // Extract key info from output
      const genMatch = stdout.match(/Generated (\d+) slides/);
      const scoreMatch = stdout.match(/SCORE: (\d+\/\d+)/);
      const qaMatch = stderr.match(/SCORE: (\d+\/\d+)/);
      const info = genMatch ? genMatch[0] : scoreMatch ? scoreMatch[0] : qaMatch ? qaMatch[0] : "ok";
      console.log("\u2714 " + info + " (" + elapsed + "ms)");
    } else {
      failed++;
      // Extract error summary
      const errMatch = (stderr + stdout).match(/(\d+) errors/);
      const info = errMatch ? errMatch[0] : "exit " + result.status;
      console.log("\u2716 " + info + " (" + elapsed + "ms)");
    }

    results.push({ file: name, ok, elapsed, stdout, stderr });
  }

  console.log();
  console.log("  " + "\u2500".repeat(40));
  console.log("  " + passed + " passed, " + failed + " failed, " + files.length + " total");
  console.log();

  if (failed > 0) process.exit(1);
}
