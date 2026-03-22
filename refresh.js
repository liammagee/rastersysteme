#!/usr/bin/env node
/**
 * refresh.js — regenerate all static/generated content
 *
 * Rebuilds explorer, studio, review, and other generated HTML outputs
 * from their source files. Run after code changes to update all outputs.
 *
 * Usage:
 *   node refresh.js [--decks-dir decks] [--theme dark] [--all]
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const dim = (s) => `\x1b[90m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

const args = process.argv.slice(2);
const decksDir = args.includes("--decks-dir") ? args[args.indexOf("--decks-dir") + 1] : "decks";
const theme = args.includes("--theme") ? args[args.indexOf("--theme") + 1] : "light";
const all = args.includes("--all");

const ROOT = __dirname;
let passed = 0;
let failed = 0;

function run(label, cmd) {
  process.stdout.write(`  ${dim("○")} ${label}...`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: "pipe", timeout: 30000 });
    process.stdout.write(` ${green("✓")}\n`);
    passed++;
    return true;
  } catch (err) {
    process.stdout.write(` ${red("✗")} ${dim(err.message.split("\n")[0].slice(0, 60))}\n`);
    failed++;
    return false;
  }
}

console.log(`\n  ${cyan("━━━ REFRESH STATIC CONTENT ━━━━━━━━━━━━━━")}`);
console.log(`  ${dim("Decks:")} ${cyan(decksDir)} ${dim("| Theme:")} ${theme}\n`);

// 1. Explorer
if (fs.existsSync(decksDir)) {
  run("Explorer", `node explorer.js ${decksDir} --output ${path.join(decksDir, "explorer.html")}`);
}

// 2. Showcase outputs
if (fs.existsSync("showcase.md")) {
  run("Showcase HTML", `node raster.js showcase.md ${path.join(decksDir, "showcase-test.html")} --format html --theme ${theme}`);
  run("Showcase Studio", `node studio.js showcase.md ${path.join(decksDir, "showcase-studio.html")} --theme ${theme}`);
  run("Showcase Review", `node raster.js showcase.md ${path.join(decksDir, "showcase-review.html")} --format review --theme ${theme}`);
}

// 3. Re-render any .composed.md files found in decks
if (all && fs.existsSync(decksDir)) {
  const composedFiles = fs.readdirSync(decksDir).filter(f => f.endsWith(".composed.md"));
  for (const f of composedFiles) {
    const name = f.replace(".composed.md", "");
    const srcPath = path.join(decksDir, f);
    const htmlPath = path.join(decksDir, `${name}.html`);
    run(`Re-render ${name}`, `node raster.js ${srcPath} ${htmlPath} --format html --theme ${theme}`);

    // Also regenerate studio if it existed
    const studioPath = path.join(decksDir, `${name}.studio.html`);
    if (fs.existsSync(studioPath) || all) {
      run(`Studio ${name}`, `node studio.js ${srcPath} ${studioPath} --theme ${theme}`);
    }
  }
}

// 4. Run tests
run("Tests", "node --test raster.test.js");

// 5. Re-generate explorer (picks up any new files)
if (fs.existsSync(decksDir)) {
  run("Explorer (final)", `node explorer.js ${decksDir} --output ${path.join(decksDir, "explorer.html")}`);
}

console.log(`\n  ${passed + failed === passed ? green("━━━") : red("━━━")} ${passed} passed, ${failed} failed ${cyan("━━━━━━━━━━━━━━━━━━")}\n`);
if (failed > 0) process.exit(1);
