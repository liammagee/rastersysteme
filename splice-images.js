#!/usr/bin/env node
/**
 * splice-images — inject generated images into an existing HTML slideshow
 *
 * Takes a rendered HTML file and an images directory, splices images into
 * each slide with VARIED placement (sidebar, inset, background, overlay).
 * Uses Claude to pick the best placement per slide based on content.
 *
 * Usage:
 *   node splice-images.js <slides.html> <images-dir> [options]
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { callClaude } = require("./compose.js");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

// ═══════════════════════════════════════════════════════
// PLACEMENT STRATEGIES — CSS for each mode
// ═══════════════════════════════════════════════════════

function placementCSS(mode, imgPath, opts = {}) {
  const size = opts.size || 40;
  const opacity = opts.opacity || 1;

  // Semi-transparent backdrop for text legibility over images
  const backdrop = `background:rgba(255,255,255,0.85);padding:3vmin 4vmin;border-radius:4px;max-width:55%`;

  const contentArea = 100 - size;
  switch (mode) {
    case "right":
      return {
        wrapper: ``,
        before: `<div style="position:absolute;top:0;left:0;width:${contentArea}%;height:100%;z-index:2;overflow:hidden">`,
        after: `</div><div style="position:absolute;top:0;right:0;width:${size}%;height:100%;overflow:hidden;z-index:1"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "left":
      return {
        wrapper: ``,
        before: `<div style="position:absolute;top:0;right:0;width:${contentArea}%;height:100%;z-index:2;overflow:hidden">`,
        after: `</div><div style="position:absolute;top:0;left:0;width:${size}%;height:100%;overflow:hidden;z-index:1"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "top":
      return {
        wrapper: ``,
        before: ``,
        after: `<div style="position:absolute;top:0;left:0;width:100%;height:${size}%;overflow:hidden;z-index:1;opacity:0.12"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "bottom":
      return {
        wrapper: ``,
        before: ``,
        after: `<div style="position:absolute;bottom:0;left:0;width:100%;height:${size}%;overflow:hidden;z-index:1;opacity:0.12"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "inset-tr":
      return {
        wrapper: ``,
        before: ``,
        after: `<div style="position:absolute;top:3vmin;right:3vmin;width:${Math.min(size, 22)}%;aspect-ratio:4/3;overflow:hidden;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,0.2);z-index:10;opacity:0.9"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "inset-bl":
      return {
        wrapper: ``,
        before: ``,
        after: `<div style="position:absolute;bottom:3vmin;left:3vmin;width:${Math.min(size, 22)}%;aspect-ratio:4/3;overflow:hidden;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,0.2);z-index:10;opacity:0.9"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "background":
      return {
        wrapper: ``,
        before: `<div style="position:absolute;inset:0;z-index:0;opacity:0.18;overflow:hidden"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div><div style="position:absolute;top:5vmin;left:5vmin;z-index:2;${backdrop}">`,
        after: `</div>`,
      };
    case "overlay":
      return {
        wrapper: ``,
        before: `<div style="position:absolute;inset:0;z-index:0;overflow:hidden"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div><div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.15) 50%,transparent 100%);z-index:1"></div><div style="position:absolute;bottom:5vmin;left:5vmin;z-index:2;max-width:60%;color:#fff">`,
        after: `</div>`,
      };
    case "none":
    default:
      return { wrapper: "", before: "", after: "" };
  }
}

// ═══════════════════════════════════════════════════════
// CLAUDE PLACEMENT ADVISOR
// ═══════════════════════════════════════════════════════

function getPlacementPlan(html, imageCount, options = {}) {
  // Extract slide content summaries from the HTML
  const slideMatches = html.match(/<section[^>]*class="[^"]*slide[^"]*"[^>]*>([\s\S]*?)<\/section>/g) || [];
  const summaries = slideMatches.map((s, i) => {
    // Strip HTML tags to get text content
    const text = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
    const hasTitle = /class="[^"]*layout-title/.test(s) || /class="[^"]*layout-section/.test(s);
    const hasBullets = s.includes("bullet") || s.includes("<li");
    const isBlank = /class="[^"]*layout-blank/.test(s) || text.length < 20;
    const isDark = /background[^;]*#[01][0-9a-fA-F]/.test(s) || /bg-dark/.test(s);
    return `Slide ${i + 1}: ${isBlank ? "[BLANK]" : hasTitle ? "[TITLE/SECTION]" : hasBullets ? "[BULLETS]" : "[CONTENT]"} ${isDark ? "[DARK BG]" : "[LIGHT BG]"} "${text.slice(0, 80)}"`;
  }).join("\n");

  const prompt = `You are placing images into an existing slide presentation. For each slide,
choose the BEST image placement from these options:

  right     — image panel on the right side (good for content-heavy slides)
  left      — image panel on the left (good when image should lead)
  top       — image strip across the top (good for landscape/panoramic images)
  bottom    — image strip across the bottom (good for grounding)
  inset-tr  — small floating image, top-right corner (good for sparse slides)
  inset-bl  — small floating image, bottom-left corner (good for dense slides)
  background — full-bleed behind content at low opacity (good for atmosphere)
  overlay   — full image with dark gradient text overlay (good for dramatic moments)
  none      — no image on this slide (good for blank/minimal slides)

VARIETY IS ESSENTIAL. Do NOT use the same placement more than 3 times in a row.
Alternate between sidebar (left/right), inset, background, and overlay.
Use "none" for blank slides.

Also specify a size (20-50, percentage) for sidebar/inset modes.

SLIDES:
${summaries}

Images available: ${imageCount} (slide-01.png through slide-${String(imageCount).padStart(2, "0")}.png)

Output ONLY a JSON array, one object per slide:
[{"slide":1,"mode":"right","size":40},{"slide":2,"mode":"left","size":35},...]
No commentary.`;

  process.stderr.write(`  ${amber("⟐")} ${dim("Asking Claude for placement plan...")}\n`);
  try {
    const raw = callClaude(prompt, { model: options.model || "sonnet", raw: true });
    let text = raw.trim();
    if (/^```/.test(text)) text = text.replace(/^```\w*\n/, "").replace(/\n```$/, "");
    const first = text.indexOf("[");
    const last = text.lastIndexOf("]");
    if (first >= 0 && last > first) text = text.slice(first, last + 1);
    const plan = JSON.parse(text);
    process.stderr.write(`  ${sage("✓")} Placement plan: ${plan.length} slides\n`);

    // Log variety
    const modes = plan.map(p => p.mode);
    const counts = {};
    modes.forEach(m => counts[m] = (counts[m] || 0) + 1);
    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => {
      process.stderr.write(`    ${dim(m)}: ${c}\n`);
    });

    return plan;
  } catch (err) {
    process.stderr.write(`  ${accent("✗")} Claude placement failed: ${err.message}\n`);
    process.stderr.write(`  ${dim("Falling back to algorithmic placement")}\n`);
    return null;
  }
}

function algorithmicPlan(slideCount) {
  const modes = ["right", "left", "inset-tr", "bottom", "right", "overlay", "left", "background", "inset-bl", "top"];
  return Array.from({ length: slideCount }, (_, i) => ({
    slide: i + 1,
    mode: modes[i % modes.length],
    size: 30 + Math.floor(Math.random() * 15),
  }));
}

// ═══════════════════════════════════════════════════════
// SPLICER — modifies existing HTML in place
// ═══════════════════════════════════════════════════════

function spliceImages(htmlPath, imagesDir, options = {}) {
  let html = fs.readFileSync(htmlPath, "utf-8");

  // Find available images
  const imageFiles = {};
  fs.readdirSync(imagesDir)
    .filter(f => f.match(/^slide-\d+\.png$/) && !f.includes("-grid"))
    .forEach(f => {
      const num = parseInt(f.match(/slide-(\d+)/)[1]);
      const relPath = path.relative(path.dirname(htmlPath), path.join(imagesDir, f));
      imageFiles[num] = relPath;
    });

  const imageCount = Object.keys(imageFiles).length;
  process.stderr.write(`  ${dim("Images:")} ${imageCount}\n`);

  // Get placement plan — use pre-computed plan if provided, else ask Claude
  let plan;
  if (options.plan) {
    plan = options.plan;
    process.stderr.write(`  ${sage("✓")} Using pre-computed placement plan (${plan.filter(p => p.mode !== "none").length} placed)\n`);
  } else if (options.smart) {
    plan = getPlacementPlan(html, imageCount, options);
  }
  if (!plan) {
    // Default: varied placement using algorithmic rotation
    const totalSlides = (html.match(/<section[^>]*class="[^"]*slide[^"]*"/g) || []).length;
    plan = algorithmicPlan(Math.max(totalSlides, imageCount));
    const modes = {};
    plan.forEach(p => modes[p.mode] = (modes[p.mode] || 0) + 1);
    process.stderr.write(`  ${dim("Placement:")} algorithmic (${Object.entries(modes).map(([m,c]) => `${m}:${c}`).join(", ")})\n`);
  }

  // Find all <section> slides and splice images into them
  let slideIndex = 0;
  html = html.replace(/<section([^>]*class="[^"]*slide[^"]*"[^>]*)>([\s\S]*?)<\/section>/g,
    (match, attrs, content) => {
      slideIndex++;
      const placement = plan.find(p => p.slide === slideIndex);
      const imgPath = imageFiles[slideIndex];

      if (!placement || !imgPath || placement.mode === "none") {
        return match; // Leave unchanged
      }

      const css = placementCSS(placement.mode, imgPath, {
        size: placement.size || 40,
        opacity: placement.opacity || 1,
        bgOpacity: 0.2,
      });

      if (!css.wrapper && !css.before && !css.after) return match;

      // Merge wrapper styles into existing style attribute
      let newAttrs = attrs;
      if (css.wrapper) {
        if (/style="/.test(newAttrs)) {
          newAttrs = newAttrs.replace(/style="([^"]*)"/, `style="$1;${css.wrapper}"`);
        } else {
          newAttrs += ` style="${css.wrapper}"`;
        }
      }

      return `<section${newAttrs}>${css.before}${content}${css.after}</section>`;
    }
  );

  return html;
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes("--help")) {
    console.log(`
  splice-images — inject images into an existing HTML slideshow with varied placement

  Usage:
    node splice-images.js <slides.html> <images-dir> [options]

  Claude analyzes each slide's content and picks the best placement:
    right/left    — image sidebar panel
    top/bottom    — image strip
    inset-tr/bl   — floating corner inset
    background    — full-bleed behind content
    overlay       — full image with gradient text overlay
    none          — skip this slide

  Options:
    --output <path>    Output path (default: .spliced.html)
    --varied           Use Claude to vary placement per slide (default: uniform right)
    --model <model>    Claude model for varied placement (default: sonnet)
    --size <pct>       Image panel width percentage (default: 33)
    --help             Show this help

  Examples:
    node splice-images.js decks/week-1-fresh.html decks/week-1-images
    node splice-images.js decks/week-1-fresh.html decks/week-1-images --varied
    node splice-images.js decks/week-1-fresh.html decks/week-1-images --size 40
    node splice-images.js decks/week-1-fresh.html decks/week-1-images --varied --model haiku
    `);
    process.exit(0);
  }

  const htmlPath = args[0];
  const imagesDir = args[1];

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const options = {
    model: getFlag("--model") || "sonnet",
    smart: args.includes("--varied"),
    defaultSize: parseInt(getFlag("--size") || "33"),
  };

  const outputPath = getFlag("--output") || htmlPath.replace(/\.html$/, ".spliced.html");

  if (!fs.existsSync(htmlPath)) {
    console.error(`Error: file not found: ${htmlPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(imagesDir)) {
    console.error(`Error: directory not found: ${imagesDir}`);
    process.exit(1);
  }

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("splice-images")}\n`);
  process.stderr.write(`  ${dim("HTML:")} ${teal(path.basename(htmlPath))}\n`);
  process.stderr.write(`  ${dim("Images:")} ${teal(imagesDir)}\n`);

  const result = spliceImages(htmlPath, imagesDir, options);
  fs.writeFileSync(outputPath, result);
  process.stderr.write(`  ${sage("✓")} Spliced → ${teal(outputPath)}\n`);
}

module.exports = { spliceImages, placementCSS, algorithmicPlan };
