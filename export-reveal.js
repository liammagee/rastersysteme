#!/usr/bin/env node
/**
 * export-reveal — export to Reveal.js HTML presentation
 *
 * Takes a composed markdown file and generates a self-contained Reveal.js
 * HTML file with the rastersysteme design directives mapped to Reveal features.
 *
 * Usage:
 *   node export-reveal.js <input.md> [options]
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { parseMarkdown, THEMES, detectLayout, adaptThemeForBg } = require("./raster.js");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;

// ═══════════════════════════════════════════════════════
// REVEAL.JS CDN
// ═══════════════════════════════════════════════════════

const REVEAL_CDN = "https://cdn.jsdelivr.net/npm/reveal.js@5.1.0";

// ═══════════════════════════════════════════════════════
// SLIDE RENDERER — maps rastersysteme slides to Reveal.js sections
// ═══════════════════════════════════════════════════════

function esc(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\\n/g, "<br>").replace(/\n/g, "<br>");
}

function renderSlideReveal(slide, layout, theme, index) {
  const bg = slide.bgOverride || null;
  const effectiveTheme = bg ? adaptThemeForBg(theme, bg) : theme;
  const bgAttr = bg ? ` data-background-color="#${bg}"` : "";
  const transAttr = slide.transition ? ` data-transition="${slide.transition}"` : "";

  const parts = [];

  // Section label
  if (slide.sectionLabel) {
    parts.push(`<p class="label">${esc(slide.sectionLabel.toUpperCase())}</p>`);
  }

  // Title
  if (slide.title) {
    const tag = layout === "section" ? "h1" : "h2";
    parts.push(`<${tag}>${esc(slide.title)}</${tag}>`);
  }

  // Subtitle
  if (slide.subtitle) {
    parts.push(`<h3>${esc(slide.subtitle)}</h3>`);
  }

  // Body
  if (slide.body.length > 0) {
    parts.push(slide.body.map(l => `<p>${esc(l)}</p>`).join("\n"));
  }

  // Bullets
  if (slide.bullets.length > 0) {
    const items = slide.bullets.map(b => {
      const indent = (b.level || 0) > 0 ? ' class="fragment"' : "";
      return `<li${indent}>${esc(b.text || b)}</li>`;
    }).join("\n");
    parts.push(`<ul>${items}</ul>`);
  }

  // Blockquote
  if (slide.blockquote) {
    parts.push(`<blockquote>${esc(slide.blockquote)}</blockquote>`);
  }

  // Videos (YouTube embeds)
  if (slide.videos && slide.videos.length > 0) {
    slide.videos.forEach(v => {
      parts.push(`<div style="position:relative;width:80%;margin:0 auto;padding-bottom:45%;height:0"><iframe src="https://www.youtube-nocookie.com/embed/${v.id}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`);
    });
  }

  // Images
  if (slide.images && slide.images.length > 0) {
    slide.images.forEach(img => {
      parts.push(`<img src="${img.src}" alt="${esc(img.alt || "")}" style="max-height:50vh">`);
    });
  }

  // Tables
  if (slide.tables && slide.tables.length > 0) {
    slide.tables.forEach(table => {
      const headerRow = table.headers.map(h => `<th>${esc(h)}</th>`).join("");
      const bodyRows = table.rows.map(row =>
        `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`
      ).join("\n");
      parts.push(`<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`);
    });
  }

  // Code blocks
  if (slide.codeBlocks && slide.codeBlocks.length > 0) {
    slide.codeBlocks.forEach(cb => {
      parts.push(`<pre><code class="language-${cb.lang || "text"}">${esc(cb.code)}</code></pre>`);
    });
  }

  // Links
  if (slide.links && slide.links.length > 0) {
    const links = slide.links.map(l => `<a href="${l.url}">${esc(l.text)}</a>`).join("<br>");
    parts.push(`<p>${links}</p>`);
  }

  // Speaker notes
  const notes = slide.notes ? `<aside class="notes">${esc(slide.notes)}</aside>` : "";

  // Layout class
  const layoutClass = layout === "blank" ? ' class="blank"' : "";

  return `<section${bgAttr}${transAttr}${layoutClass}>
${parts.join("\n")}
${notes}
</section>`;
}

// ═══════════════════════════════════════════════════════
// FULL DOCUMENT GENERATOR
// ═══════════════════════════════════════════════════════

function generateReveal(inputPath, outputPath, options = {}) {
  const themeName = options.theme || "light";
  const theme = THEMES[themeName] || THEMES.light;
  const transition = options.transition || "fade";

  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);
  const title = path.basename(inputPath, ".md").replace(".composed", "");

  const slidesHTML = slides.map((slide, idx) => {
    const layout = detectLayout(slide, idx, slides.length);
    return renderSlideReveal(slide, layout, theme, idx);
  }).join("\n\n");

  // Map rastersysteme theme to Reveal.js CSS
  const isDark = theme.bg === "1A1A1A" || parseInt(theme.bg.slice(0, 2), 16) < 80;
  const revealTheme = isDark ? "black" : "white";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${REVEAL_CDN}/dist/reset.css">
<link rel="stylesheet" href="${REVEAL_CDN}/dist/reveal.css">
<link rel="stylesheet" href="${REVEAL_CDN}/dist/theme/${revealTheme}.css">
<link rel="stylesheet" href="${REVEAL_CDN}/plugin/highlight/monokai.css">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root {
  --r-background-color: #${theme.bg};
  --r-main-color: #${theme.text};
  --r-heading-color: #${theme.text};
  --r-link-color: #${theme.accent2 || theme.accent};
  --r-selection-background-color: #${theme.accent};
  --r-main-font: 'DM Sans', 'Helvetica Neue', sans-serif;
  --r-heading-font: 'DM Serif Display', Georgia, serif;
  --r-code-font: 'Space Mono', monospace;
  --r-heading-letter-spacing: -0.02em;
  --r-heading-text-transform: none;
}
.reveal { font-size: 32px; }
.reveal h1 { font-size: 2.2em; font-weight: 700; line-height: 1.1; }
.reveal h2 { font-size: 1.6em; font-weight: 700; line-height: 1.2; }
.reveal h3 { font-size: 1.1em; font-weight: 400; color: #${theme.textMid}; }
.reveal p { line-height: 1.6; }
.reveal .label {
  font-family: 'Space Mono', monospace;
  font-size: 0.45em;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #${theme.accent};
  font-weight: 700;
  margin-bottom: 0.5em;
}
.reveal blockquote {
  border-left: 3px solid #${theme.accent};
  padding: 0.5em 1em;
  font-style: italic;
  color: #${theme.textMid};
  background: rgba(${parseInt(theme.accent.slice(0,2),16)},${parseInt(theme.accent.slice(2,4),16)},${parseInt(theme.accent.slice(4,6),16)},0.06);
  width: 85%;
}
.reveal table { font-size: 0.7em; }
.reveal thead th {
  background: #${theme.accent};
  color: #${theme.white};
  padding: 0.4em 0.8em;
  font-family: 'Space Mono', monospace;
  font-size: 0.85em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.reveal tbody td { padding: 0.3em 0.8em; border-bottom: 1px solid #${theme.grey}; }
.reveal ul { text-align: left; }
.reveal li { margin-bottom: 0.4em; line-height: 1.5; }
.reveal pre { font-size: 0.65em; }
.reveal section.blank { }
.reveal .progress { color: #${theme.accent}; height: 3px; }
</style>
</head>
<body>
<div class="reveal">
<div class="slides">
${slidesHTML}
</div>
</div>
<script src="${REVEAL_CDN}/dist/reveal.js"></script>
<script src="${REVEAL_CDN}/plugin/notes/notes.js"></script>
<script src="${REVEAL_CDN}/plugin/highlight/highlight.js"></script>
<script>
Reveal.initialize({
  hash: true,
  transition: '${transition}',
  backgroundTransition: 'fade',
  plugins: [RevealNotes, RevealHighlight],
  width: 1920,
  height: 1080,
  margin: 0.08,
});
</script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
  return { slides: slides.length, output: outputPath, theme: themeName };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  export-reveal — export to Reveal.js presentation

  Usage:
    node export-reveal.js <input.md> [options]

  Options:
    --output <path>       Output path (default: input.reveal.html)
    --theme <name>        Theme: light (default), dark, red, blue
    --transition <name>   Reveal transition: fade (default), slide, convex, concave, zoom, none
    --help                Show this help

  Features:
    - Speaker notes (press S in Reveal.js to open)
    - Code highlighting via highlight.js
    - Background color overrides from <!-- bg: HEX -->
    - Per-slide transitions from <!-- transition: name -->
    - DM Serif Display / DM Sans / Space Mono typography
    - Theme colors mapped to Reveal.js CSS variables

  Examples:
    node export-reveal.js decks/week-1.md
    node export-reveal.js decks/week-1.composed.md --theme dark --transition slide
    `);
    process.exit(0);
  }

  const input = args[0];
  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const outputPath = getFlag("--output") || input.replace(/\.md$/, ".reveal.html");
  const theme = getFlag("--theme") || "light";
  const transition = getFlag("--transition") || "fade";

  if (!fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("export-reveal")}\n`);
  process.stderr.write(`  ${dim("Source:")} ${teal(path.basename(input))}\n`);

  const result = generateReveal(input, outputPath, { theme, transition });
  process.stderr.write(`  ${sage("✓")} ${result.slides} slides → ${teal(outputPath)}\n`);
}

module.exports = { generateReveal };
