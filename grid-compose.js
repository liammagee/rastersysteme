#!/usr/bin/env node
/**
 * grid-compose — direct 60-column grid composition
 *
 * Instead of picking from 13 fixed layouts, Claude (or a generative algorithm)
 * places each element on the 60×40 grid with specific coordinates.
 *
 * Each slide gets a JSON specification:
 * {
 *   bg: "0F2A4A",
 *   elements: [
 *     { type: "title", text: "...", col: 2, row: 3, colSpan: 30, rowSpan: 8, fontSize: 36, color: "FFFFFF", font: "DM Serif Display" },
 *     { type: "label", text: "...", col: 2, row: 1, colSpan: 20, rowSpan: 2, fontSize: 8, color: "B7311A", letterSpacing: "0.3em" },
 *     { type: "body", text: "...", col: 35, row: 5, colSpan: 22, rowSpan: 20, fontSize: 14, color: "8C8478", lineHeight: 1.6 },
 *     { type: "rect", col: 0, row: 0, colSpan: 24, rowSpan: 40, color: "B7311A", opacity: 0.15 },
 *     { type: "line", col: 25, row: 3, colSpan: 0, rowSpan: 34, color: "333333", width: 1 },
 *     { type: "circle", col: 45, row: 20, radius: 80, color: "1B5E80", opacity: 0.1, stroke: true },
 *   ]
 * }
 *
 * This is then rendered directly to HTML/PPTX using actual grid coordinates.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { parseMarkdown } = require("./raster.js");
const { callClaudeAsync } = require("./compose.js");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

// ═══════════════════════════════════════════════════════
// GRID SPEC — what Claude outputs per slide
// ═══════════════════════════════════════════════════════

const GRID_SPEC = `You are a Swiss graphic designer placing elements on a 60-column × 40-row grid.
The canvas is 960px × 540px (16:9). Margins: 48px (≈5%). Each cell is ~14.4px wide, ~11.5px tall.

For each slide you receive, output a JSON object specifying EXACTLY where every
element goes on the grid. You have complete freedom — no fixed layouts, no templates.
Design each slide from scratch using the grid.

ELEMENT TYPES:
  "title"   — main heading text. Properties: col, row, colSpan, rowSpan, fontSize (pt), color (hex), font, bold, align, valign, rotate
  "subtitle"— secondary text. Same properties as title.
  "label"   — small-caps label. Same properties + letterSpacing.
  "body"    — paragraph text. Same properties + lineHeight.
  "bullet"  — single bullet item. Same properties + indent.
  "quote"   — blockquote text. Same properties + borderColor, italic.
  "rect"    — colored rectangle. Properties: col, row, colSpan, rowSpan, color, opacity.
  "line"    — rule line. Properties: col, row, colSpan OR rowSpan (one must be 0), color, width.
  "circle"  — circle/ellipse. Properties: col, row, radius, color, opacity, stroke (bool), strokeWidth.
  "dot"     — small circle. Properties: col, row, radius, color.
  "number"  — large display number. Properties: col, row, text, fontSize, color, opacity.

GRID COORDINATES:
  col: 0–59 (left edge of element)
  row: 0–39 (top edge of element)
  colSpan: 1–60 (width in columns)
  rowSpan: 1–40 (height in rows)

DESIGN PRINCIPLES:
  - Use the FULL grid. Don't cluster everything in the center.
  - Asymmetry > symmetry. Off-center placements create tension.
  - Layer elements: a large pale rect behind text, a dot accent, a thin rule line.
  - Vary density: some slides should be sparse (3 elements), some dense (12+).
  - Use rotation (rotate: -90, 90, 180) on labels or titles for spatial disruption.
  - Use opacity (0.05–0.3) on rects for depth without heaviness.
  - Place geometric shapes (circles, rects) as compositional anchors, not decoration.
  - Text doesn't have to start at col 0. Try col 15, or col 40.
  - A title at fontSize 48 spanning cols 0–40 at row 2 is very different from
    the same title at fontSize 24 spanning cols 30–58 at row 30.

FONTS AVAILABLE:
  "DM Serif Display" — editorial serif (titles, statements)
  "Space Mono" — monospace (labels, data, technical)
  "DM Sans" — clean sans (body, bullets)
  "Helvetica Neue" — Swiss baseline
  "Georgia" — warm serif (quotes)
  "Futura" — geometric sans (bold statements)

COLOR: Use <!-- bg: HEX --> from the source for background. Choose element colors
that work against that background. The theme provides accent colors but you may
use ANY hex color that serves the composition.`;

// ═══════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════

function buildGridPrompt(slides, options = {}) {
  const slideDescriptions = slides.map((slide, i) => {
    const parts = [];
    if (slide.title) parts.push(`title: "${slide.title}"`);
    if (slide.subtitle) parts.push(`subtitle: "${slide.subtitle}"`);
    if (slide.sectionLabel) parts.push(`label: "${slide.sectionLabel}"`);
    if (slide.bullets.length) parts.push(`bullets: ${JSON.stringify(slide.bullets.map(b => b.text || b))}`);
    if (slide.body.length) parts.push(`body: ${JSON.stringify(slide.body)}`);
    if (slide.blockquote) parts.push(`quote: "${slide.blockquote}"`);
    if (slide.bgOverride) parts.push(`bg: "${slide.bgOverride}"`);
    if (slide.notes) parts.push(`notes: "${slide.notes.slice(0, 100)}..."`);
    return `SLIDE ${i + 1}:\n  ${parts.join("\n  ")}`;
  }).join("\n\n");

  return `${GRID_SPEC}

${options.brief ? `CREATIVE DIRECTION: ${options.brief}\n` : ""}

SOURCE SLIDES (${slides.length} total):

${slideDescriptions}

OUTPUT: Return a JSON array with one object per slide. Each object has:
  { "bg": "HEX", "elements": [ ...element objects... ] }

Return ONLY the JSON array. No commentary, no code fences.
The array must have exactly ${slides.length} objects, one per slide.`;
}

// ═══════════════════════════════════════════════════════
// HTML RENDERER — renders grid specs to HTML slides
// ═══════════════════════════════════════════════════════

function renderGridSlideHTML(spec, slideNum) {
  const bg = spec.bg ? `background:#${spec.bg};` : "";
  const elements = (spec.elements || []).map((el) => {
    const x = (el.col || 0) / 60 * 100;
    const y = (el.row || 0) / 40 * 100;
    const w = (el.colSpan || 10) / 60 * 100;
    const h = (el.rowSpan || 5) / 40 * 100;
    const color = el.color ? `color:#${el.color};` : "";
    const bgColor = el.type === "rect" ? `background:#${el.color || "000"};opacity:${el.opacity || 0.1};` : "";
    const fontSize = el.fontSize ? `font-size:${el.fontSize}px;` : "";
    const font = el.font ? `font-family:'${el.font}',sans-serif;` : "";
    const bold = el.bold ? "font-weight:700;" : "";
    const italic = el.italic ? "font-style:italic;" : "";
    const letterSpacing = el.letterSpacing ? `letter-spacing:${el.letterSpacing};` : "";
    const lineHeight = el.lineHeight ? `line-height:${el.lineHeight};` : "";
    const rotate = el.rotate ? `transform:rotate(${el.rotate}deg);` : "";
    const align = el.align ? `text-align:${el.align};` : "";
    const valign = el.valign === "middle" ? "display:flex;align-items:center;" :
                   el.valign === "bottom" ? "display:flex;align-items:flex-end;" : "";
    const textTransform = el.type === "label" ? "text-transform:uppercase;" : "";

    const style = `position:absolute;left:${x}%;top:${y}%;width:${w}%;height:${h}%;${color}${bgColor}${fontSize}${font}${bold}${italic}${letterSpacing}${lineHeight}${rotate}${align}${valign}${textTransform}overflow:hidden;`;

    if (el.type === "rect") {
      return `<div style="${style}" class="grid-el grid-rect"></div>`;
    }
    if (el.type === "line") {
      const isH = (el.rowSpan || 0) === 0 || el.colSpan > (el.rowSpan || 0);
      const lineStyle = isH
        ? `position:absolute;left:${x}%;top:${y}%;width:${w}%;height:0;border-top:${el.width || 1}px solid #${el.color || "333"};`
        : `position:absolute;left:${x}%;top:${y}%;width:0;height:${h}%;border-left:${el.width || 1}px solid #${el.color || "333"};`;
      return `<div style="${lineStyle}" class="grid-el grid-line"></div>`;
    }
    if (el.type === "circle" || el.type === "dot") {
      const r = el.radius || 20;
      const cx = (el.col || 0) / 60 * 100;
      const cy = (el.row || 0) / 40 * 100;
      const circleStyle = `position:absolute;left:${cx}%;top:${cy}%;width:${r * 2}px;height:${r * 2}px;border-radius:50%;transform:translate(-50%,-50%);${el.stroke ? `border:${el.strokeWidth || 2}px solid #${el.color || "333"};background:transparent;` : `background:#${el.color || "333"};`}opacity:${el.opacity || 1};`;
      return `<div style="${circleStyle}" class="grid-el grid-circle"></div>`;
    }

    const text = el.text || "";
    return `<div style="${style}" class="grid-el grid-${el.type}">${text.replace(/\n/g, "<br>")}</div>`;
  }).join("\n  ");

  return `<section class="grid-slide" style="${bg}position:relative;width:100%;height:100%;overflow:hidden;">
  <div class="grid-counter">${String(slideNum).padStart(2, "0")}</div>
  ${elements}
</section>`;
}

function renderGridDeckHTML(specs, title) {
  const slides = specs.map((spec, i) => renderGridSlideHTML(spec, i + 1)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden;font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
.deck{width:100vw;height:100vh;position:relative}
.grid-slide{position:absolute;inset:0;display:none}
.grid-slide.active{display:block}
.grid-el{transition:opacity 0.4s ease}
.grid-counter{position:absolute;bottom:12px;right:16px;font-family:'Space Mono',monospace;font-size:10px;color:rgba(128,128,128,0.4);z-index:10;letter-spacing:0.15em}
.progress{position:fixed;bottom:0;left:0;right:0;height:2px;z-index:100}
.progress-bar{height:100%;background:#B7311A;transition:width 0.3s ease;box-shadow:0 0 8px #B7311A}
.counter{position:fixed;bottom:8px;left:16px;font-family:'Space Mono',monospace;font-size:10px;color:rgba(128,128,128,0.4);z-index:100;letter-spacing:0.15em}
body::after{content:"";position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:0.025;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
</style>
</head>
<body>
<div class="deck">
${slides}
</div>
<div class="progress"><div class="progress-bar"></div></div>
<div class="counter"></div>
<script>
(function(){
  const slides=document.querySelectorAll('.grid-slide');
  const bar=document.querySelector('.progress-bar');
  const counter=document.querySelector('.counter');
  let cur=0;
  function go(n){
    if(n<0||n>=slides.length)return;
    slides[cur].classList.remove('active');
    cur=n;
    slides[cur].classList.add('active');
    bar.style.width=((cur+1)/slides.length*100)+'%';
    counter.textContent=(cur+1)+' / '+slides.length;
  }
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' ')go(cur+1);
    else if(e.key==='ArrowLeft')go(cur-1);
    else if(e.key==='Home')go(0);
    else if(e.key==='End')go(slides.length-1);
    else if(e.key==='f'||e.key==='F'){
      if(!document.fullscreenElement)document.documentElement.requestFullscreen().catch(function(){});
      else document.exitFullscreen();
    }
  });
  let tx=0;
  document.addEventListener('touchstart',function(e){tx=e.touches[0].clientX},{passive:true});
  document.addEventListener('touchend',function(e){
    const dx=e.changedTouches[0].clientX-tx;
    if(Math.abs(dx)>50){dx<0?go(cur+1):go(cur-1)}
  },{passive:true});
  document.addEventListener('click',function(e){
    if(e.clientX>window.innerWidth*0.65)go(cur+1);
    else if(e.clientX<window.innerWidth*0.35)go(cur-1);
  });
  go(0);
})();
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════

async function gridCompose(inputPath, options = {}) {
  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);
  const base = path.basename(inputPath, ".md");

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("grid-compose")}\n`);
  process.stderr.write(`  ${dim("Source:")} ${teal(path.basename(inputPath))} ${dim(`(${slides.length} slides)`)}\n`);
  process.stderr.write(`  ${dim("Mode:")} ${teal("direct 60×40 grid placement")}\n`);

  // Filter slides if range specified
  const slideRange = options.slides;
  let targetSlides = slides;
  if (slideRange) {
    const indices = new Set();
    for (const part of slideRange.split(",")) {
      const t = part.trim();
      if (t.includes("-")) {
        const [s, e] = t.split("-").map(Number);
        for (let i = s; i <= e; i++) indices.add(i);
      } else indices.add(Number(t));
    }
    targetSlides = slides.filter((_, i) => indices.has(i + 1));
    process.stderr.write(`  ${dim("Slides:")} ${targetSlides.length} of ${slides.length}\n`);
  }

  const prompt = buildGridPrompt(targetSlides, options);
  const raw = await callClaudeAsync(prompt, {
    model: options.model || "sonnet",
    label: "grid",
    raw: true,
  });

  // Parse JSON
  let specs;
  try {
    let text = raw.trim();
    if (/^```/.test(text)) text = text.replace(/^```\w*\n/, "").replace(/\n```$/, "");
    const first = text.indexOf("[");
    const last = text.lastIndexOf("]");
    if (first >= 0 && last > first) text = text.slice(first, last + 1);
    specs = JSON.parse(text);
  } catch (e) {
    process.stderr.write(`  ${accent("✗")} Failed to parse grid specs: ${e.message}\n`);
    const rawPath = path.join(path.dirname(path.resolve(inputPath)), `${base}-grid-raw.txt`);
    fs.writeFileSync(rawPath, raw);
    process.stderr.write(`  ${dim("Raw saved:")} ${teal(rawPath)}\n`);
    return null;
  }

  // Save specs
  const specsPath = path.join(path.dirname(path.resolve(inputPath)), `${base}.grid.json`);
  fs.writeFileSync(specsPath, JSON.stringify(specs, null, 2));
  process.stderr.write(`  ${sage("✓")} ${chalk.white.bold(specs.length)} grid specs → ${teal(specsPath)}\n`);

  // Render HTML
  const htmlPath = path.join(path.dirname(path.resolve(inputPath)), `${base}.grid.html`);
  const html = renderGridDeckHTML(specs, base);
  fs.writeFileSync(htmlPath, html);
  process.stderr.write(`  ${sage("✓")} HTML → ${teal(htmlPath)}\n`);

  return { specs, specsPath, htmlPath };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  grid-compose — direct 60×40 grid composition (no fixed layouts)

  Instead of 13 fixed layouts, Claude places every element on the grid
  with specific coordinates, fonts, colors, and geometric shapes.

  Usage:
    node grid-compose.js <input.md> [options]

  Options:
    --model <model>       Claude model (default: sonnet)
    --brief "<direction>" Creative direction
    --slides <range>      Only compose specific slides (e.g. "1-3")
    --help                Show this help

  Examples:
    node grid-compose.js decks/week-1.md
    node grid-compose.js decks/week-1.md --slides 1-5 --model haiku
    node grid-compose.js decks/week-1.md --brief "brutalist, maximum asymmetry"
    `);
    process.exit(0);
  }

  const input = args[0];
  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const options = {
    model: getFlag("--model") || "sonnet",
    brief: getFlag("--brief"),
    slides: getFlag("--slides"),
  };

  if (!fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  gridCompose(input, options).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { gridCompose, buildGridPrompt, renderGridDeckHTML, renderGridSlideHTML, GRID_SPEC };
