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

const dim = chalk.gray;
const accent = chalk.hex("#C44230");
const teal = chalk.hex("#2C7A92");
const sage = chalk.hex("#548C5A");
const amber = chalk.hex("#C79B38");

// ═══════════════════════════════════════════════════════
// PLACEMENT STRATEGIES — CSS for each mode
// ═══════════════════════════════════════════════════════

function placementCSS(mode, imgPath, opts = {}) {
  const size = opts.size || 40;
  const opacity = opts.opacity || 1;

  switch (mode) {
    case "right":
      return {
        wrapper: `display:flex;flex-direction:row;padding:0;`,
        before: `<div style="flex:1;padding:5vmin;display:flex;flex-direction:column;gap:2vmin;overflow:auto">`,
        after: `</div><div style="flex:0 0 ${size}%;overflow:hidden"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover;opacity:${opacity}"></div>`,
      };
    case "left":
      return {
        wrapper: `display:flex;flex-direction:row;padding:0;`,
        before: `<div style="flex:0 0 ${size}%;overflow:hidden"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover;opacity:${opacity}"></div><div style="flex:1;padding:5vmin;display:flex;flex-direction:column;gap:2vmin;overflow:auto">`,
        after: `</div>`,
      };
    case "top":
      return {
        wrapper: `display:flex;flex-direction:column;padding:0;`,
        before: `<div style="flex:0 0 ${size}%;overflow:hidden"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover;opacity:${opacity}"></div><div style="flex:1;padding:4vmin;display:flex;flex-direction:column;gap:2vmin;overflow:auto">`,
        after: `</div>`,
      };
    case "bottom":
      return {
        wrapper: `display:flex;flex-direction:column;padding:0;`,
        before: `<div style="flex:1;padding:4vmin;display:flex;flex-direction:column;gap:2vmin;overflow:auto">`,
        after: `</div><div style="flex:0 0 ${size}%;overflow:hidden"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover;opacity:${opacity}"></div>`,
      };
    case "inset-tr":
      return {
        wrapper: `position:relative;`,
        before: ``,
        after: `<div style="position:absolute;top:3vmin;right:3vmin;width:${size}%;aspect-ratio:1;overflow:hidden;border-radius:4px;box-shadow:0 4px 24px rgba(0,0,0,0.4);z-index:2"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover;opacity:${opacity}"></div>`,
      };
    case "inset-bl":
      return {
        wrapper: `position:relative;`,
        before: ``,
        after: `<div style="position:absolute;bottom:3vmin;left:3vmin;width:${size}%;aspect-ratio:1;overflow:hidden;border-radius:4px;box-shadow:0 4px 24px rgba(0,0,0,0.4);z-index:2"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover;opacity:${opacity}"></div>`,
      };
    case "background":
      return {
        wrapper: `background-image:url('${imgPath}');background-size:cover;background-position:center;position:relative;`,
        before: `<div style="position:absolute;inset:0;background:inherit;opacity:${1 - (opts.bgOpacity || 0.2)};z-index:0"></div><div style="position:relative;z-index:1;display:flex;flex-direction:column;gap:2vmin;width:100%;height:100%;padding:5vmin">`,
        after: `</div>`,
      };
    case "overlay":
      return {
        wrapper: `background-image:url('${imgPath}');background-size:cover;background-position:center;`,
        before: `<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.2) 60%,transparent 100%);z-index:0"></div><div style="position:relative;z-index:1;display:flex;flex-direction:column;justify-content:flex-end;gap:2vmin;width:100%;height:100%;padding:5vmin;color:#fff">`,
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
    // Default: uniform right sidebar at specified size
    const size = options.defaultSize || 33;
    plan = Array.from({ length: 100 }, (_, i) => ({
      slide: i + 1, mode: "right", size,
    }));
    process.stderr.write(`  ${dim("Placement:")} right sidebar ${size}%\n`);
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
