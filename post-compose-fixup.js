#!/usr/bin/env node
/**
 * post-compose-fixup.js — automated fixes for known compose patterns
 *
 * Runs AFTER compose.js and BEFORE render. Fixes recurring issues that
 * every v1-v15 needed manually:
 *   1. Slides with image+table but no title → add title zone
 *   2. Body zones on heading-only slides → change to title
 *   3. Title size consolidation → reduce to 3 sizes
 *   4. Accent saturation → strip from body-heavy slides if >85%
 *   5. Break/divider slides with body zone → change to title
 *
 * Usage:
 *   node post-compose-fixup.js <deck.composed.md>
 *   node post-compose-fixup.js <deck.composed.md> --dry-run
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");

if (!input) {
  console.log("Usage: node post-compose-fixup.js <deck.composed.md> [--dry-run]");
  process.exit(0);
}

let md = fs.readFileSync(input, "utf-8");
let fixes = 0;

console.log(chalk.cyan(`\n  ■ post-compose-fixup`));
console.log(chalk.dim(`  Deck: ${input}\n`));

// ── 1. Title size consolidation ──
// Find all title sizes, pick 3 targets, replace
const titleSizeMatches = [...md.matchAll(/"title":\{[^}]*"size":(\d+)/g)];
const sizes = titleSizeMatches.map(m => parseInt(m[1]));
const uniqueSizes = [...new Set(sizes)].sort((a, b) => b - a);

if (uniqueSizes.length > 4) {
  // Target: hero (largest), section (middle), standard (smallest of >24)
  const hero = uniqueSizes[0]; // keep the biggest
  const standard = uniqueSizes.find(s => s >= 28 && s <= 34) || 32;
  const section = uniqueSizes.find(s => s > standard && s < hero) || 36;

  const sizeMap = {};
  for (const s of uniqueSizes) {
    if (s >= hero - 2) sizeMap[s] = hero;
    else if (s >= section - 2) sizeMap[s] = section;
    else sizeMap[s] = standard;
  }

  for (const [from, to] of Object.entries(sizeMap)) {
    if (parseInt(from) !== to) {
      const regex = new RegExp(`"size":${from}(,"weight")`, "g");
      const count = (md.match(regex) || []).length;
      if (count > 0) {
        md = md.replace(regex, `"size":${to}$1`);
        fixes++;
        console.log(chalk.dim(`  Title size ${from} → ${to} (${count} slides)`));
      }
    }
  }
}

// ── 2. Accent saturation ──
const accentSlides = (md.match(/"accents":\[\{/g) || []).length;
const totalSlides = (md.match(/^---$/gm) || []).length + 1;
const accentRatio = accentSlides / totalSlides;

if (accentRatio > 0.85) {
  const target = Math.floor(totalSlides * 0.75);
  const toStrip = accentSlides - target;
  console.log(chalk.dim(`  Accent ratio ${(accentRatio * 100).toFixed(0)}% → stripping ${toStrip} slides`));

  // Find body-heavy slides (long content between ---) and strip their accents
  const slideBlocks = md.split(/^---$/m);
  let stripped = 0;
  for (let i = slideBlocks.length - 1; i >= 0 && stripped < toStrip; i--) {
    const block = slideBlocks[i];
    if (!block.includes('"accents":[{')) continue;
    // Prefer stripping from body-heavy middle slides, not hero/divider
    const textLen = block.replace(/<!--[\s\S]*?-->/g, "").replace(/```[\s\S]*?```/g, "").trim().length;
    if (textLen > 200) { // body-heavy
      slideBlocks[i] = block.replace(/"accents":\[\{[^\]]*\]/, '"accents":[]');
      stripped++;
      fixes++;
    }
  }
  md = slideBlocks.join("---");
}

// ── 3. Break/divider slides: body → title ──
const slideBlocks2 = md.split(/^---$/m);
for (let i = 0; i < slideBlocks2.length; i++) {
  const block = slideBlocks2[i];
  const trimmed = block.replace(/<!--[\s\S]*?-->/g, "").replace(/```[\s\S]*?```/g, "").trim();
  // Short text (< 50 chars), has body zone, no title zone
  if (trimmed.length < 50 && trimmed.length > 0 &&
      block.includes('"role":"body"') && !block.includes('"role":"title"')) {
    slideBlocks2[i] = block
      .replace('"role":"body"', '"role":"title"')
      .replace(/^(Discussion|Break|Practice)/m, '## $1');
    fixes++;
    console.log(chalk.dim(`  S${i + 1}: body → title (short divider slide)`));
  }
}
md = slideBlocks2.join("---");

// ── 4. Heading slides without title zone ──
const slideBlocks3 = md.split(/^---$/m);
for (let i = 0; i < slideBlocks3.length; i++) {
  const block = slideBlocks3[i];
  // Has a ### heading but no title zone
  if (/^###?\s/m.test(block) && block.includes('"zones"') &&
      !block.includes('"role":"title"') && block.includes('"role":"body"')) {
    // Extract the design directive and add a title zone
    const designMatch = block.match(/<!--\s*design:\s*(\{[\s\S]*?\})\s*-->/);
    if (designMatch) {
      try {
        const design = JSON.parse(designMatch[1]);
        const bodyZone = design.zones.find(z => z.role === "body");
        if (bodyZone) {
          // Shrink body zone and add title zone above it
          const titleZone = {
            role: "title",
            col: bodyZone.col,
            span: bodyZone.span,
            row: Math.max(1, bodyZone.row - 5),
            rowSpan: 4,
          };
          bodyZone.row = titleZone.row + titleZone.rowSpan + 1;
          bodyZone.rowSpan = Math.max(8, bodyZone.rowSpan - 5);
          design.zones.unshift(titleZone);
          if (!design.typography) design.typography = {};
          design.typography.title = { size: 32, weight: 700 };
          const newDirective = `<!-- design: ${JSON.stringify(design)} -->`;
          slideBlocks3[i] = block.replace(/<!--\s*design:\s*\{[\s\S]*?\}\s*-->/, newDirective);
          fixes++;
          console.log(chalk.dim(`  S${i + 1}: added title zone for heading`));
        }
      } catch (e) { /* skip malformed JSON */ }
    }
  }
}
md = slideBlocks3.join("---");

console.log(chalk.green(`\n  ✓ ${fixes} fixes applied${dryRun ? " (dry run — not saved)" : ""}\n`));

if (!dryRun && fixes > 0) {
  fs.writeFileSync(input, md);
  console.log(chalk.dim(`  Written: ${input}\n`));
}
