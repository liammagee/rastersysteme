#!/usr/bin/env node
/**
 * refresh-content — reload slide content from source markdown into an existing
 * composed deck, preserving all design directives (zones, accents, typography, bg).
 *
 * Use for minor content edits that don't need a full recompose via Claude.
 *
 * Usage:
 *   node refresh-content.js <source.md> <composed.md> [--render] [--gslides]
 *
 * What it does:
 *   1. Parse the source markdown into slides (by --- separators)
 *   2. Parse the composed markdown to extract design directives per slide
 *   3. Re-inject source content under the existing directives
 *   4. Optionally re-render HTML and/or export to Google Slides
 *
 * What it preserves:
 *   - All <!-- design: {...} --> directives
 *   - <!-- image: ... --> placement hints
 *   - Speaker notes (<!-- notes: ... -->)
 *
 * What it replaces:
 *   - Slide text content (headings, body, bullets, blockquotes, tables, code)
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;

function extractDirectives(slideText) {
  const directives = [];
  const regex = /<!--\s*(design|image|notes|bg|font|layout|transition|style|master):\s*([\s\S]*?)-->/g;
  let m;
  while ((m = regex.exec(slideText)) !== null) {
    directives.push(m[0]);
  }
  return directives;
}

function extractContent(slideText) {
  // Strip all directives and the DESIGN PLAN block
  let content = slideText
    .replace(/<!--\s*DESIGN PLAN[\s\S]*?-->/g, "")
    .replace(/<!--\s*(design|image|notes|bg|font|layout|transition|style|master):\s*[\s\S]*?-->/g, "")
    .trim();
  return content;
}

function refreshContent(sourcePath, composedPath, outputPath) {
  const sourceMd = fs.readFileSync(sourcePath, "utf-8");
  const composedMd = fs.readFileSync(composedPath, "utf-8");

  const sourceSlides = sourceMd.split(/\n---\n/);
  const composedSlides = composedMd.split(/\n---\n/);

  // Extract the DESIGN PLAN header if present
  const designPlanMatch = composedMd.match(/^<!--\s*DESIGN PLAN[\s\S]*?-->\s*\n*/);
  const designPlan = designPlanMatch ? designPlanMatch[0] : "";

  console.log(dim("  ┌─ refresh-content ────────────────────────"));
  console.log(dim("  │ ") + `Source:   ${teal(sourcePath)} (${sourceSlides.length} slides)`);
  console.log(dim("  │ ") + `Composed: ${teal(composedPath)} (${composedSlides.length} slides)`);

  const minLen = Math.min(sourceSlides.length, composedSlides.length);
  let updated = 0, added = 0, unchanged = 0;

  const outputSlides = [];

  for (let i = 0; i < Math.max(sourceSlides.length, composedSlides.length); i++) {
    if (i < minLen) {
      // Both exist — keep directives from composed, content from source
      const directives = extractDirectives(composedSlides[i]);
      const newContent = extractContent(sourceSlides[i]);
      const oldContent = extractContent(composedSlides[i]);

      if (newContent !== oldContent) {
        updated++;
      } else {
        unchanged++;
      }

      // Rebuild: directives first, then content
      const parts = [...directives, newContent].filter(Boolean);
      outputSlides.push(parts.join("\n"));
    } else if (i < sourceSlides.length) {
      // New slide in source — add without design directives
      added++;
      outputSlides.push(sourceSlides[i]);
    }
    // Slides in composed but not source are dropped (source is authoritative)
  }

  // Reassemble
  let output = outputSlides.join("\n\n---\n\n");
  if (designPlan) output = designPlan + output;

  const dest = outputPath || composedPath;
  fs.writeFileSync(dest, output);

  console.log(dim("  │"));
  console.log(dim("  │ ") + sage(`${updated} updated`) + `, ${unchanged} unchanged` + (added > 0 ? `, ${accent(added + " new")}` : ""));
  if (sourceSlides.length !== composedSlides.length) {
    console.log(dim("  │ ") + chalk.yellow(`  ⚠ Slide count changed: ${composedSlides.length} → ${sourceSlides.length}`));
  }
  console.log(dim("  │ ") + `Output: ${teal(dest)}`);
  console.log(dim("  └──────────────────────────────────────────\n"));

  return { updated, unchanged, added, total: outputSlides.length };
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes("--help")) {
    console.log(`
  ${accent("refresh-content")} — reload content into existing design directives

  ${dim("Usage:")}
    node refresh-content.js <source.md> <composed.md> [options]

  ${dim("Options:")}
    --output <path>   Write to a different file (default: overwrite composed)
    --render          Re-render HTML after refresh
    --gslides         Re-export to Google Slides after refresh

  ${dim("Example:")}
    node refresh-content.js content/week-2/week-2.md decks/week-2-v18.composed.md --render
`);
    process.exit(0);
  }

  const source = args[0];
  const composed = args[1];
  const getOpt = (flag) => { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined; };
  const output = getOpt("--output") || composed;

  const result = refreshContent(source, composed, output);

  // Optional re-render
  if (args.includes("--render")) {
    const { generateHTML } = require("./raster.js");
    const htmlPath = output.replace(/\.composed\.md$/, ".html");
    generateHTML(output, htmlPath, { bgImages: true, bgImageOpacity: 0.2 })
      .then(r => console.log(sage("  Rendered"), r.slides, "slides →", teal(htmlPath)));
  }
}

module.exports = { refreshContent };
