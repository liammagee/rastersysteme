#!/usr/bin/env node
/**
 * insert-slide — insert a new markdown slide into a composed deck
 *
 * Inserts raw markdown at a given position, then re-renders HTML (and
 * optionally PPTX). The new slide will use auto-layout detection unless
 * you include a <!-- design: --> or <!-- layout: --> directive.
 *
 * Usage:
 *   node insert-slide.js <deck.composed.md> --after <n> [options]
 *
 * Options:
 *   --after <n>        Insert after slide n (0 = before first slide)
 *   --content <text>   Slide markdown as a string
 *   --file <path>      Read slide markdown from a file
 *   --render           Re-render HTML after inserting (default: true)
 *   --no-render        Skip re-rendering
 *   --theme <name>     Theme for re-render (default: light)
 *   --help             Show this help
 *
 * Examples:
 *   node insert-slide.js decks/week-1.composed.md --after 5 --content "# New Slide\nSome body text"
 *   node insert-slide.js decks/week-1.composed.md --after 0 --file new-intro.md
 *   node insert-slide.js decks/week-1.composed.md --after 10 --content "## Break\n> Take 10 minutes" --theme dark
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

function insertSlide(mdPath, afterSlide, newContent) {
  const md = fs.readFileSync(mdPath, "utf-8");

  // Split on slide separators, preserving the design plan header
  const parts = md.split(/\n---\n/);
  const position = Math.max(0, Math.min(afterSlide, parts.length));

  parts.splice(position, 0, "\n" + newContent.trim() + "\n");

  const result = parts.join("\n---\n");
  fs.writeFileSync(mdPath, result);

  return { totalSlides: parts.length, insertedAt: position + 1 };
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
  insert-slide — insert a new markdown slide into a composed deck

  Usage:
    node insert-slide.js <deck.composed.md> --after <n> [options]

  Options:
    --after <n>        Insert after slide n (0 = before first)
    --content <text>   Slide markdown (use \\n for newlines)
    --file <path>      Read slide markdown from a file
    --no-render        Skip HTML re-rendering
    --theme <name>     Theme for re-render (default: light)
    --help             Show this help

  Examples:
    node insert-slide.js decks/week-1.composed.md --after 5 --content "# New Slide"
    node insert-slide.js decks/week-1.composed.md --after 0 --file intro.md
    `);
    process.exit(0);
  }

  const mdPath = args[0];

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const afterSlide = parseInt(getFlag("--after") || "0");
  const contentStr = getFlag("--content");
  const contentFile = getFlag("--file");
  const noRender = args.includes("--no-render");
  const theme = getFlag("--theme") || "light";

  if (!fs.existsSync(mdPath)) {
    console.error(`Error: file not found: ${mdPath}`);
    process.exit(1);
  }

  let content;
  if (contentFile) {
    if (!fs.existsSync(contentFile)) {
      console.error(`Error: content file not found: ${contentFile}`);
      process.exit(1);
    }
    content = fs.readFileSync(contentFile, "utf-8");
  } else if (contentStr) {
    content = contentStr.replace(/\\n/g, "\n");
  } else {
    console.error("Error: provide --content or --file");
    process.exit(1);
  }

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("insert-slide")}\n`);
  process.stderr.write(`  ${dim("Deck:")}  ${teal(path.basename(mdPath))}\n`);
  process.stderr.write(`  ${dim("After:")} slide ${afterSlide}\n`);

  const { totalSlides, insertedAt } = insertSlide(mdPath, afterSlide, content);
  process.stderr.write(`  ${sage("✓")} Inserted as slide ${insertedAt} (${totalSlides} total)\n`);

  if (!noRender) {
    const htmlPath = mdPath.replace(/\.composed\.md$/, ".html").replace(/\.md$/, ".html");
    process.stderr.write(`  ${dim("Re-rendering HTML...")}\n`);

    const { spawnSync } = require("child_process");
    const result = spawnSync("node", [
      path.join(__dirname, "raster.js"), mdPath, htmlPath,
      "--format", "html", "--theme", theme,
    ], { stdio: ["pipe", "pipe", "pipe"] });

    if (result.status === 0) {
      const match = (result.stdout || "").toString().match(/Generated (\d+) slides/);
      process.stderr.write(`  ${sage("✓")} ${match ? match[0] : "Rendered"} → ${teal(path.basename(htmlPath))}\n`);
    } else {
      process.stderr.write(`  ${amber("⚠")} Render failed: ${(result.stderr || "").toString().slice(0, 80)}\n`);
    }
  }

  process.stderr.write("\n");
}

module.exports = { insertSlide };
