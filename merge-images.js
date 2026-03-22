#!/usr/bin/env node
/**
 * merge-images — integrate generated images into composed slide decks
 *
 * Takes a composed markdown deck and an images directory, produces a new
 * deck with images embedded as backgrounds or inline elements.
 *
 * Usage:
 *   node merge-images.js <composed.md> <images-dir> [options]
 *
 * Options:
 *   --mode <mode>      background | sidebar | inset | overlay (default: background)
 *   --opacity <n>      Background opacity 0.0-1.0 (default: 0.15)
 *   --position <pos>   For sidebar/inset: left | right | top | bottom (default: right)
 *   --size <pct>       For sidebar/inset: percentage of slide (default: 40)
 *   --output <path>    Output HTML path
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { parseMarkdown, generateHTML, THEMES } = require("./raster.js");

const dim = chalk.gray;
const accent = chalk.hex("#C44230");
const teal = chalk.hex("#2C7A92");
const sage = chalk.hex("#548C5A");

// ═══════════════════════════════════════════════════════
// IMAGE INTEGRATION MODES
// ═══════════════════════════════════════════════════════

const MODES = {
  background: {
    description: "Image as full-bleed background behind slide content, with opacity",
    css: (imgPath, opacity) => `
      background-image: url('${imgPath}');
      background-size: cover;
      background-position: center;
      position: relative;
    `,
    overlay: (opacity) => `
      content: "";
      position: absolute;
      inset: 0;
      background: var(--slide-bg, #F8F5F0);
      opacity: ${1 - (opacity || 0.15)};
      z-index: 0;
    `,
  },
  sidebar: {
    description: "Image in a side panel, content in the other panel",
  },
  inset: {
    description: "Image as a smaller inset within the slide",
  },
  overlay: {
    description: "Image at full opacity with text overlay on a dark gradient",
  },
};

// ═══════════════════════════════════════════════════════
// MERGE PIPELINE
// ═══════════════════════════════════════════════════════

function mergeImagesIntoHTML(composedPath, imagesDir, options = {}) {
  const mode = options.mode || "sidebar";
  const opacity = parseFloat(options.opacity || 0.15);
  const position = options.position || "right";
  const size = parseInt(options.size || 40);
  const theme = options.theme || "light";

  const md = fs.readFileSync(composedPath, "utf-8");
  const slides = parseMarkdown(md);
  const base = path.basename(composedPath, ".composed.md").replace(".md", "");

  // Find images — match slide-NN.png to slide index
  const imageFiles = {};
  if (fs.existsSync(imagesDir)) {
    fs.readdirSync(imagesDir)
      .filter(f => f.match(/^slide-\d+\.png$/) && !f.includes("-grid"))
      .forEach(f => {
        const num = parseInt(f.match(/slide-(\d+)/)[1]);
        imageFiles[num] = path.relative(path.dirname(composedPath), path.join(imagesDir, f));
      });
  }

  process.stderr.write(`  ${dim("Images found:")} ${Object.keys(imageFiles).length} of ${slides.length} slides\n`);
  process.stderr.write(`  ${dim("Mode:")} ${teal(mode)} ${dim("opacity:")} ${opacity}\n`);

  // Generate the merged HTML
  const themeObj = THEMES[theme] || THEMES.light;
  const cssVars = Object.entries({
    bg: themeObj.bg, "bg-alt": themeObj.bgAlt, "bg-dark": themeObj.bgDark,
    text: themeObj.text, "text-mid": themeObj.textMid, "text-light": themeObj.textLight,
    accent: themeObj.accent, accent2: themeObj.accent2, accent3: themeObj.accent3, accent4: themeObj.accent4,
    white: themeObj.white, black: themeObj.black, grey: themeObj.grey,
  }).map(([k, v]) => `--${k}:#${v}`).join(";");

  const slidesHTML = slides.map((slide, idx) => {
    const slideNum = idx + 1;
    const imgPath = imageFiles[slideNum];
    const layout = slide.layout || "split";
    const bgOverride = slide.bgOverride ? `background-color:#${slide.bgOverride};` : "";

    let slideContent = buildSlideContent(slide, layout);
    let slideStyle = bgOverride;
    let beforeStyle = "";

    if (imgPath) {
      if (mode === "background") {
        slideStyle += `background-image:url('${imgPath}');background-size:cover;background-position:center;`;
        beforeStyle = `position:absolute;inset:0;background:${slide.bgOverride ? "#" + slide.bgOverride : "var(--bg-alt)"};opacity:${1 - opacity};z-index:0;`;
        slideContent = `<div style="${beforeStyle}"></div><div style="position:relative;z-index:1;display:flex;flex-direction:column;gap:2vmin;width:100%;height:100%">${slideContent}</div>`;
      } else if (mode === "sidebar") {
        const imgSide = position === "left"
          ? `<div style="flex:0 0 ${size}%;overflow:hidden"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div><div style="flex:1;padding:5vmin;display:flex;flex-direction:column;gap:2vmin">${slideContent}</div>`
          : `<div style="flex:1;padding:5vmin;display:flex;flex-direction:column;gap:2vmin">${slideContent}</div><div style="flex:0 0 ${size}%;overflow:hidden"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`;
        slideContent = imgSide;
        slideStyle += "flex-direction:row;padding:0 !important;";
      } else if (mode === "inset") {
        const insetPos = position === "right" ? "right:3vmin;top:3vmin;" : position === "left" ? "left:3vmin;top:3vmin;" : position === "top" ? "top:3vmin;left:50%;transform:translateX(-50%);" : "bottom:3vmin;left:50%;transform:translateX(-50%);";
        const insetImg = `<div style="position:absolute;${insetPos}width:${size}%;aspect-ratio:16/9;overflow:hidden;border-radius:4px;box-shadow:0 4px 24px rgba(0,0,0,0.3);z-index:2"><img src="${imgPath}" style="width:100%;height:100%;object-fit:cover"></div>`;
        slideContent = `${slideContent}${insetImg}`;
        slideStyle += "position:relative;";
      } else if (mode === "overlay") {
        slideStyle += `background-image:url('${imgPath}');background-size:cover;background-position:center;`;
        slideContent = `<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.3) 50%,rgba(0,0,0,0.1) 100%);z-index:0"></div><div style="position:relative;z-index:1;display:flex;flex-direction:column;justify-content:flex-end;gap:2vmin;width:100%;height:100%;color:#fff">${slideContent}</div>`;
      }
    }

    return `<section class="slide" style="${slideStyle}">${slideContent}</section>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<title>${base} — merged</title>
<style>
:root{${cssVars};--font:'DM Sans','Helvetica Neue',sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden;font-family:var(--font);-webkit-font-smoothing:antialiased}
.deck{width:100vw;height:100vh;position:relative}
.slide{position:absolute;inset:0;padding:5vmin;display:none;flex-direction:column;gap:2vmin;
  color:var(--text);background:var(--bg-alt);overflow:hidden}
.slide.active{display:flex}
h1{font-family:'DM Serif Display',serif;font-size:clamp(1.8rem,5vmin,3.5rem);font-weight:700;line-height:1.1;letter-spacing:-0.03em}
h2{font-size:clamp(1rem,2.5vmin,1.6rem);color:var(--text-mid)}
p{font-size:clamp(0.85rem,1.8vmin,1.2rem);line-height:1.5;color:var(--text-mid)}
.label{font-family:'Space Mono',monospace;font-size:clamp(0.55rem,0.9vmin,0.75rem);letter-spacing:0.25em;text-transform:uppercase;color:var(--accent);font-weight:700}
ul{list-style:none;display:flex;flex-direction:column;gap:0.8vmin}
li{font-size:clamp(0.85rem,1.8vmin,1.2rem);color:var(--text);display:flex;gap:1vmin;align-items:baseline}
li::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:0.4em}
blockquote{border-left:2px solid var(--accent);padding:1.5vmin 2vmin;font-style:italic;color:var(--text-mid)}
.progress{position:fixed;bottom:0;left:0;right:0;height:2px;z-index:100}
.progress-bar{height:100%;background:var(--accent);transition:width 0.3s;box-shadow:0 0 8px var(--accent)}
.counter{position:fixed;bottom:8px;right:16px;font-family:'Space Mono',monospace;font-size:10px;color:rgba(128,128,128,0.4);z-index:100}
</style>
</head>
<body>
<div class="deck">${slidesHTML}</div>
<div class="progress"><div class="progress-bar"></div></div>
<div class="counter"></div>
<script>
(function(){
  const slides=document.querySelectorAll('.slide');
  const bar=document.querySelector('.progress-bar');
  const counter=document.querySelector('.counter');
  let cur=0;
  function go(n){if(n<0||n>=slides.length)return;slides[cur].classList.remove('active');cur=n;slides[cur].classList.add('active');bar.style.width=((cur+1)/slides.length*100)+'%';counter.textContent=(cur+1)+' / '+slides.length}
  document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key===' ')go(cur+1);else if(e.key==='ArrowLeft')go(cur-1);else if(e.key==='Home')go(0);else if(e.key==='End')go(slides.length-1);else if(e.key==='f'){if(!document.fullscreenElement)document.documentElement.requestFullscreen().catch(function(){});else document.exitFullscreen()}});
  document.addEventListener('click',function(e){if(e.clientX>window.innerWidth*0.65)go(cur+1);else if(e.clientX<window.innerWidth*0.35)go(cur-1)});
  go(0);
})();
</script>
</body>
</html>`;

  return html;
}

function buildSlideContent(slide, layout) {
  const parts = [];
  if (slide.sectionLabel) parts.push(`<span class="label">${slide.sectionLabel.toUpperCase()}</span>`);
  if (slide.title) parts.push(`<h1>${slide.title}</h1>`);
  if (slide.subtitle) parts.push(`<h2>${slide.subtitle}</h2>`);
  if (slide.body.length) parts.push(slide.body.map(l => `<p>${l}</p>`).join(""));
  if (slide.bullets.length) {
    const items = slide.bullets.map(b => `<li>${b.text || b}</li>`).join("");
    parts.push(`<ul>${items}</ul>`);
  }
  if (slide.blockquote) parts.push(`<blockquote>${slide.blockquote}</blockquote>`);
  return parts.join("\n");
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes("--help")) {
    console.log(`
  merge-images — integrate AI-generated images into slide decks

  Usage:
    node merge-images.js <composed.md> <images-dir> [options]

  Modes:
    background     Image as full-bleed bg with content overlay (default)
    sidebar        Image in a side panel, content in the other
    inset          Image as a floating inset within the slide
    overlay        Full image with dark gradient text overlay

  Options:
    --mode <mode>        background | sidebar | inset | overlay
    --opacity <n>        Image visibility 0.0-1.0 (default: 0.15 for bg, 1.0 for others)
    --position <pos>     For sidebar/inset: left | right (default: right)
    --size <pct>         For sidebar/inset: width percentage (default: 40)
    --theme <name>       Theme: light | dark | red | blue (default: light)
    --output <path>      Output HTML path (default: <base>.merged.html)

  Examples:
    node merge-images.js decks/week-1-fresh.composed.md decks/week-1-images
    node merge-images.js decks/week-1-fresh.composed.md decks/week-1-images --mode sidebar --position left
    node merge-images.js decks/week-1-fresh.composed.md decks/week-1-images --mode overlay
    node merge-images.js decks/week-1-fresh.composed.md decks/week-1-images --mode background --opacity 0.3
    `);
    process.exit(0);
  }

  const composedPath = args[0];
  const imagesDir = args[1];

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const options = {
    mode: getFlag("--mode") || "sidebar",
    opacity: getFlag("--opacity"),
    position: getFlag("--position") || "right",
    size: getFlag("--size") || "40",
    theme: getFlag("--theme") || "light",
  };

  // Default opacity per mode
  if (!options.opacity) {
    options.opacity = options.mode === "background" ? "0.15" : "1.0";
  }

  const outputPath = getFlag("--output") || composedPath.replace(/\.composed\.md$/, ".merged.html").replace(/\.md$/, ".merged.html");

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("merge-images")}\n`);
  process.stderr.write(`  ${dim("Deck:")} ${teal(path.basename(composedPath))}\n`);
  process.stderr.write(`  ${dim("Images:")} ${teal(imagesDir)}\n`);

  const html = mergeImagesIntoHTML(composedPath, imagesDir, options);
  fs.writeFileSync(outputPath, html);
  process.stderr.write(`  ${sage("✓")} Merged → ${teal(outputPath)}\n`);
}

module.exports = { mergeImagesIntoHTML };
