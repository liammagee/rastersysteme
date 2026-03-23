#!/usr/bin/env node
/**
 * batch.js — run raster, compose, or qa across all *.md in a folder
 *
 * Runs files in parallel (default: up to 4 concurrent).
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
 *   node batch.js raster ./decks --concurrency 8 --format html
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

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

function runOne(script, file, passthrough, command) {
  return new Promise((resolve) => {
    const fileArgs = [script, file, ...passthrough];
    if (command === "review" && !passthrough.includes("--format")) {
      fileArgs.splice(1, 0, "--format", "review");
    }

    const start = Date.now();
    let stdout = "";
    let stderr = "";

    const child = spawn("node", fileArgs, {
      cwd: path.dirname(file),
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });

    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });

    child.on("close", (code) => {
      const elapsed = Date.now() - start;
      const ok = code === 0;
      const name = path.basename(file);

      let info;
      if (ok) {
        const genMatch = stdout.match(/Generated (\d+) slides/);
        const scoreMatch = stdout.match(/SCORE: (\d+\/\d+)/);
        const qaMatch = stderr.match(/SCORE: (\d+\/\d+)/);
        info = genMatch ? genMatch[0] : scoreMatch ? scoreMatch[0] : qaMatch ? qaMatch[0] : "ok";
      } else {
        const errMatch = (stderr + stdout).match(/(\d+) errors/);
        info = errMatch ? errMatch[0] : "exit " + code;
      }

      resolve({ name, ok, elapsed, info, stdout, stderr });
    });

    child.on("error", (err) => {
      const elapsed = Date.now() - start;
      resolve({ name: path.basename(file), ok: false, elapsed, info: err.message, stdout, stderr });
    });
  });
}

async function runPool(tasks, concurrency) {
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      const result = await tasks[i]();
      results[i] = result;

      const icon = result.ok ? "\u2714" : "\u2716";
      console.log(`  ${icon} ${result.name} — ${result.info} (${result.elapsed}ms)`);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes("--help")) {
    console.log(`
  batch — run rastersysteme tools on all *.md in a folder (parallel)

  Usage:
    node batch.js <command> <folder> [options]

  Commands:
    raster    Generate PPTX/HTML for each *.md
    compose   Run Claude art direction on each *.md
    qa        Run quality audit on each *.md
    review    Generate review page for each *.md

  Options:
    --concurrency <n>  Max parallel jobs (default: 4)
    All other options are passed through to the underlying tool.
    Files ending in .composed.md are skipped.

  Examples:
    node batch.js raster ./decks --theme dark --format html
    node batch.js qa . --theme dark
    node batch.js compose ./decks --intensity radical --theme dark
    node batch.js review . --theme dark
    node batch.js raster ./decks --concurrency 8 --format html
    `);
    process.exit(0);
  }

  const command = args[0];
  const folder = args[1];

  if (!COMMANDS[command]) {
    console.error("Unknown command: " + command + ". Use raster, compose, qa, or review.");
    process.exit(1);
  }

  // Extract --concurrency before passing remaining args through
  let passthrough = args.slice(2);
  let concurrency = 4;
  const concIdx = passthrough.indexOf("--concurrency");
  if (concIdx >= 0 && concIdx + 1 < passthrough.length) {
    concurrency = Math.max(1, parseInt(passthrough[concIdx + 1]) || 4);
    passthrough = [...passthrough.slice(0, concIdx), ...passthrough.slice(concIdx + 2)];
  }

  const script = path.join(__dirname, COMMANDS[command]);
  const files = findMdFiles(folder);

  if (files.length === 0) {
    console.error("No .md files found in " + folder);
    process.exit(1);
  }

  const effective = Math.min(concurrency, files.length);
  console.log(`\n  batch ${command}: ${files.length} files in ${path.resolve(folder)} (${effective} concurrent)\n`);

  const tasks = files.map(file => () => runOne(script, file, passthrough, command));

  runPool(tasks, concurrency).then(results => {
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    const totalTime = results.reduce((s, r) => s + r.elapsed, 0);
    const wallTime = Math.max(...results.map(r => r.elapsed));

    console.log();
    console.log("  " + "\u2500".repeat(40));
    console.log(`  ${passed} passed, ${failed} failed, ${files.length} total`);
    console.log(`  Wall time: ~${Math.round(wallTime / 1000)}s (saved ~${Math.round((totalTime - wallTime) / 1000)}s vs serial)`);
    console.log();

    if (failed > 0) process.exit(1);
  });
}
