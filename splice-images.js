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

// Image presence levels: subtle (watermark), visible (clear but not dominant), bold (prominent)
const IMAGE_SCALES = {
  subtle:  { panel: 0.18, strip: 0.12, inset: 0.30, bg: 0.10, overlay: 0.20, insetCap: 20 },
  visible: { panel: 0.45, strip: 0.30, inset: 0.70, bg: 0.22, overlay: 0.40, insetCap: 25 },
  bold:    { panel: 0.75, strip: 0.55, inset: 0.90, bg: 0.40, overlay: 0.65, insetCap: 30 },
};
// Frame style for inset images — makes them visible regardless of background
const INSET_FRAME = "box-shadow:0 2px 12px rgba(0,0,0,0.15);border:1px solid rgba(128,128,128,0.2)";

function placementCSS(mode, imgPath, opts = {}) {
  const size = opts.size || 40;
  const scale = IMAGE_SCALES[opts.imageScale] || IMAGE_SCALES.visible;

  switch (mode) {
    case "right":
      return {
        wrapper: ``,
        before: ``,
        after: `<div style="position:absolute;top:0;right:0;width:${size}%;height:100%;overflow:hidden;z-index:0;opacity:${scale.panel}"><img class="splice-img" src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "left":
      return {
        wrapper: ``,
        before: ``,
        after: `<div style="position:absolute;top:0;left:0;width:${size}%;height:100%;overflow:hidden;z-index:0;opacity:${scale.panel}"><img class="splice-img" src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "top":
      return {
        wrapper: ``,
        before: ``,
        after: `<div style="position:absolute;top:0;left:0;width:100%;height:${size}%;overflow:hidden;z-index:0;opacity:${scale.strip}"><img class="splice-img" src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "bottom":
      return {
        wrapper: ``,
        before: ``,
        after: `<div style="position:absolute;bottom:0;left:0;width:100%;height:${size}%;overflow:hidden;z-index:0;opacity:${scale.strip}"><img class="splice-img" src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "inset-tr":
      return {
        wrapper: ``,
        before: ``,
        after: `<div style="position:absolute;top:3vmin;right:3vmin;width:${Math.min(size, scale.insetCap)}%;aspect-ratio:4/3;overflow:hidden;border-radius:4px;z-index:0;opacity:${scale.inset};${INSET_FRAME}"><img class="splice-img" src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "inset-bl":
      return {
        wrapper: ``,
        before: ``,
        after: `<div style="position:absolute;bottom:3vmin;left:3vmin;width:${Math.min(size, scale.insetCap)}%;aspect-ratio:4/3;overflow:hidden;border-radius:4px;z-index:0;opacity:${scale.inset};${INSET_FRAME}"><img class="splice-img" src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
      };
    case "background":
      return {
        wrapper: ``,
        before: `<div style="position:absolute;inset:0;z-index:0;opacity:${opts.bgOpacity || scale.bg};mix-blend-mode:luminosity;overflow:hidden"><img class="splice-img" src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
        after: ``,
      };
    case "overlay":
      return {
        wrapper: ``,
        before: `<div style="position:absolute;inset:0;z-index:0;overflow:hidden;opacity:${scale.overlay}"><img class="splice-img" src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`,
        after: ``,
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

// Content-aware placement: read zone positions from HTML, place image in empty space
function contentAwarePlan(html) {
  const slides = html.match(/<section[^>]*class="[^"]*slide[^"]*"[^>]*>[\s\S]*?<\/section>/g) || [];
  let lastMode = "";

  return slides.map((slideHtml, idx) => {
    // Extract zone bounding boxes (left%, top%, width%, height%)
    const zones = [];
    const zoneMatches = slideHtml.matchAll(/class="zone[^"]*"[^>]*style="([^"]+)"/g);
    for (const m of zoneMatches) {
      const s = m[1];
      const left = parseFloat((s.match(/left:\s*([\d.]+)%/) || [])[1]) || 0;
      const top = parseFloat((s.match(/top:\s*([\d.]+)%/) || [])[1]) || 0;
      const width = parseFloat((s.match(/width:\s*([\d.]+)%/) || [])[1]) || 0;
      const height = parseFloat((s.match(/height:\s*([\d.]+)%/) || [])[1]) || 0;
      if (width > 0 && height > 0) zones.push({ left, top, right: left + width, bottom: top + height });
    }

    // Also check for non-designed layouts (flex-based) — estimate from layout class
    const isDesigned = slideHtml.includes("designed");
    const isBlank = /layout-blank/.test(slideHtml) || zones.length === 0 && !isDesigned;
    if (isBlank) return { slide: idx + 1, mode: "none" };

    // For non-designed slides, estimate text position from layout type
    if (!isDesigned || zones.length === 0) {
      const isTitle = /layout-title/.test(slideHtml);
      const isSplit = /layout-split/.test(slideHtml);
      // Non-designed layouts use flexbox, text fills most of the slide
      // Use background at low opacity or inset in a corner
      const fallbacks = ["inset-tr", "inset-bl", "background"];
      const mode = fallbacks[idx % fallbacks.length];
      return { slide: idx + 1, mode, size: 30 };
    }

    // Pre-check: if slide already has a SPLICED image, skip (prevent re-splicing)
    if (/splice-img/.test(slideHtml)) {
      return { slide: idx + 1, mode: "none" };
    }

    // Slides with existing content images: skip entirely — they already have visuals
    const hasContentImages = /<img[^>]*src=/.test(slideHtml) && !/splice-img/.test(slideHtml);
    if (hasContentImages) {
      return { slide: idx + 1, mode: "none" };
    }

    // Text-only slides: full grid analysis — panels, strips, backgrounds, insets

    // Grid analysis: divide slide into 6 columns × 4 rows, mark cells with text
    const COLS = 6, ROWS = 4;
    const cellW = 100 / COLS, cellH = 100 / ROWS;
    const occupied = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

    for (const z of zones) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (z.left < (c + 1) * cellW && z.right > c * cellW &&
              z.top < (r + 1) * cellH && z.bottom > r * cellH) {
            occupied[r][c] = true;
          }
        }
      }
    }

    // For right/left panels (~35% width = rightmost/leftmost 2 columns of 6)
    const rightEdge = occupied.map(row => row.slice(-2)).flat().filter(Boolean).length; // 8 max
    const leftEdge = occupied.map(row => row.slice(0, 2)).flat().filter(Boolean).length;
    // For top/bottom strips (~35% height = top/bottom 1 row of 4)
    const topRow = occupied[0].filter(Boolean).length; // 6 max
    const bottomRow = occupied[ROWS - 1].filter(Boolean).length;
    // For insets: check actual zone proximity, not just grid cells.
    // A 25% inset at top-right occupies (75-100%, 0-25%); bottom-left occupies (0-25%, 75-100%).
    const trOverlap = zones.some(z => z.right > 75 && z.top < 25) ? 2 : 0;
    const blOverlap = zones.some(z => z.left < 25 && z.bottom > 75) ? 2 : 0;
    const trCorner = trOverlap; // 0 or 2
    const blCorner = blOverlap;

    // Calculate text density — how much of the slide is occupied by content
    const totalCells = ROWS * COLS;
    const occupiedCells = occupied.flat().filter(Boolean).length;
    const density = occupiedCells / totalCells;

    const candidates = [
      { mode: "bottom",   overlap: bottomRow, max: COLS,     size: 30 },
      { mode: "top",      overlap: topRow,    max: COLS,     size: 30 },
      { mode: "inset-tr", overlap: trCorner,  max: 2,        size: 22 },
      { mode: "inset-bl", overlap: blCorner,  max: 2,        size: 22 },
      // Background: atmospheric full-bleed behind text (z-index:0, low opacity).
      // Preferred over strips/insets that overlap >30% of text cells.
      { mode: "background", overlap: Math.max(1, Math.ceil(density * 5)), max: 10, size: 100 },
    ];
    // Side panels only when the edge is genuinely empty (zero occupied cells)
    if (rightEdge === 0) candidates.push({ mode: "right", overlap: 0, max: ROWS * 2, size: 35 });
    if (leftEdge === 0)  candidates.push({ mode: "left",  overlap: 0, max: ROWS * 2, size: 35 });

    // Sort by overlap ratio (least text in image region)
    candidates.sort((a, b) => (a.overlap / a.max) - (b.overlap / b.max));

    // Pick the best, varying from last
    let pick = candidates[0];
    if (pick.mode === lastMode && candidates.length > 1 &&
        (candidates[1].overlap / candidates[1].max) <= (pick.overlap / pick.max) + 0.15) {
      pick = candidates[1];
    }

    // If ALL placement options overlap >75% of text, use atmospheric background.
    // Denser slides get lower opacity to preserve readability.
    if (pick.overlap / pick.max > 0.75) {
      lastMode = "background";
      const bgOpacity = density > 0.5 ? 0.06 : density > 0.3 ? 0.08 : 0.12;
      return { slide: idx + 1, mode: "background", size: 100, bgOpacity };
    }

    // If the best placement still overlaps text, prefer zero-overlap alternatives
    if (pick.overlap > 0 && candidates.some(c => c.overlap === 0 && c.mode !== lastMode)) {
      pick = candidates.find(c => c.overlap === 0 && c.mode !== lastMode) || pick;
    }

    lastMode = pick.mode;
    return { slide: idx + 1, mode: pick.mode, size: pick.size };
  });
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
    const explicitCount = options.plan.filter(p => p.mode !== "none").length;
    const totalCount = options.plan.length;
    // If most slides have "none", fill gaps with content-aware placement
    if (explicitCount < totalCount * 0.5) {
      const caPlan = contentAwarePlan(html);
      plan = options.plan.map((p, i) => {
        if (p.mode === "none" && caPlan[i] && caPlan[i].mode !== "none") {
          return caPlan[i]; // Fill in from content-aware analysis
        }
        return p;
      });
      const filled = plan.filter(p => p.mode !== "none").length;
      process.stderr.write(`  ${sage("✓")} Placement: ${explicitCount} from directives + ${filled - explicitCount} content-aware (${filled} total)\n`);
    } else {
      plan = options.plan;
      process.stderr.write(`  ${sage("✓")} Using pre-computed placement plan (${explicitCount} placed)\n`);
    }
  } else if (options.smart) {
    plan = getPlacementPlan(html, imageCount, options);
  }
  if (!plan) {
    // Default: content-aware placement — reads zone positions, puts images in empty space
    plan = contentAwarePlan(html);
    const modes = {};
    plan.filter(p => p.mode !== "none").forEach(p => modes[p.mode] = (modes[p.mode] || 0) + 1);
    process.stderr.write(`  ${dim("Placement:")} content-aware (${Object.entries(modes).map(([m,c]) => `${m}:${c}`).join(", ")})\n`);
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

      // Skip slides that already contain a SPLICED image (from prior splice) — not content images
      if (/splice-img/.test(content)) {
        return match;
      }

      const css = placementCSS(placement.mode, imgPath, {
        size: placement.size || 40,
        imageScale: options.imageScale || "visible",
        bgOpacity: placement.bgOpacity,
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

  if (args.length < 1 || args.includes("--help")) {
    console.log(`
  splice-images — inject images into an existing HTML slideshow with varied placement

  Usage:
    node splice-images.js <slides.html> [images-dir] [options]

  If images-dir is omitted, auto-discovers from standard locations:
    decks/<deckname>-images/          (preferred)
    decks/<base>-images/              (e.g. week-2-images for week-2-v7)
    decks/<base>.composed-images/     (legacy)
    content/week-N/week-N-images/     (from imagine step)

  Claude analyzes each slide's content and picks the best placement:
    right/left    — image sidebar panel
    top/bottom    — image strip
    inset-tr/bl   — floating corner inset
    background    — full-bleed behind content
    overlay       — full image with gradient text overlay
    none          — skip this slide

  Options:
    --output <path>    Output path (default: .spliced.html)
    --varied           Use Claude to vary placement per slide (default: algorithmic)
    --model <model>    Claude model for varied placement (default: sonnet)
    --size <pct>       Image panel width percentage (default: 33)
    --image-scale <s>  Image presence: subtle, visible, bold (default: visible)
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
  let imagesDir = args.find(a => !a.startsWith("--") && a !== htmlPath);

  // Auto-discover images directory if not specified
  if (!imagesDir) {
    const deckName = path.basename(htmlPath, path.extname(htmlPath))
      .replace(/\.spliced$/, "").replace(/\.merged$/, "");
    // Search standard locations in priority order:
    // 1. decks/<deckname>-images/     (e.g. decks/week-2-v7-images/)
    // 2. decks/<base>-images/         (e.g. decks/week-2-images/ for week-2-v7)
    // 3. decks/<base>.composed-images/ (e.g. decks/week-2.composed-images/)
    // 4. content/week-N/week-N-images/
    const base = /-v\d+$/.test(deckName)
      ? deckName.replace(/-v\d+$/, "")
      : deckName.replace(/-\w+$/, "");
    const candidates = [
      path.join("decks", `${deckName}-images`),
      path.join("decks", `${base}-images`),
      path.join("decks", `${base}.composed-images`),
    ];
    // Also check content/week-N/ directories
    const weekMatch = base.match(/week-(\d+)/);
    if (weekMatch) {
      candidates.push(path.join("content", `week-${weekMatch[1]}`, `week-${weekMatch[1]}-images`));
      candidates.push(path.join("content", `week-${weekMatch[1]}`, "images"));
    }
    for (const dir of candidates) {
      if (fs.existsSync(dir)) {
        const pngs = fs.readdirSync(dir).filter(f => f.match(/^slide-\d+\.png$/));
        if (pngs.length > 0) {
          imagesDir = dir;
          process.stderr.write(`  ${dim("Auto-discovered:")} ${teal(dir)} (${pngs.length} images)\n`);
          break;
        }
      }
    }
    if (!imagesDir) {
      console.error("Error: no images directory found. Searched:");
      candidates.forEach(c => console.error("  " + c));
      console.error("\nSpecify explicitly: node splice-images.js <deck.html> <images-dir>");
      process.exit(1);
    }
  }

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const options = {
    model: getFlag("--model") || "sonnet",
    smart: args.includes("--varied"),
    defaultSize: parseInt(getFlag("--size") || "33"),
    imageScale: getFlag("--image-scale") || "visible",
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

module.exports = { spliceImages, placementCSS, algorithmicPlan, contentAwarePlan };
