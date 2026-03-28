#!/usr/bin/env node
/**
 * generative-art.js — Algorithmic generative art for slide decks
 *
 * Produces SVG images inspired by Kandinsky's constructivist geometry:
 * concentric circles, intersecting arcs, stochastic grids, fractal recursion.
 *
 * Each image is seeded by slide content for thematic coherence,
 * with stochastic variation for visual interest.
 *
 * Usage:
 *   node generative-art.js <input.md> [options]
 *   node generative-art.js --slides 1-5 --palette warm --seed 42
 *
 * Options:
 *   --slides <range>      Specific slides (e.g. "1-5", "3,7,12")
 *   --palette <name>      Color palette: kandinsky (default), bauhaus, navy, warm, mono
 *   --density <level>     Element density: sparse, moderate (default), dense
 *   --seed <number>       Random seed for reproducibility
 *   --output <dir>        Output directory (default: decks/<deck>.composed-images/)
 *   --format svg|png      Output format (default: svg)
 *   --width <px>          Image width (default: 1920)
 *   --height <px>         Image height (default: 1080)
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

// ═══════════════════════════════════════════════
// PALETTES — Kandinsky-inspired color systems
// ═══════════════════════════════════════════════

const PALETTES = {
  kandinsky: {
    name: "Kandinsky Composition",
    bg: "#FAF6EE",
    colors: ["#B7311A", "#0A1628", "#1B5E80", "#D4A843", "#2B7038", "#8B4513"],
    accent: "#B7311A",
  },
  bauhaus: {
    name: "Bauhaus Primary",
    bg: "#F5F0E4",
    colors: ["#CC0000", "#0044AA", "#FFCC00", "#000000", "#2B7038"],
    accent: "#CC0000",
  },
  navy: {
    name: "Midnight Navy",
    bg: "#0A1628",
    colors: ["#FAF6EE", "#B7311A", "#D4A843", "#4A7B9D", "#8B7355"],
    accent: "#B7311A",
  },
  warm: {
    name: "Warm Parchment",
    bg: "#FAF6EE",
    colors: ["#B7311A", "#6B5B4E", "#D4A843", "#8B4513", "#2B5F4E"],
    accent: "#B7311A",
  },
  mono: {
    name: "Monochrome",
    bg: "#FAFAFA",
    colors: ["#1A1A1A", "#4A4A4A", "#7A7A7A", "#AAAAAA", "#D0D0D0"],
    accent: "#1A1A1A",
  },
};

// ═══════════════════════════════════════════════
// SEEDED RANDOM — reproducible stochastic variation
// ═══════════════════════════════════════════════

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ═══════════════════════════════════════════════
// GENERATIVE ELEMENTS — the visual vocabulary
// ═══════════════════════════════════════════════

function concentricCircles(cx, cy, maxR, rings, rand, colors) {
  let svg = "";
  for (let i = rings; i > 0; i--) {
    const r = (maxR * i) / rings;
    const color = colors[i % colors.length];
    const opacity = 0.15 + rand() * 0.35;
    const strokeWidth = 1 + rand() * 3;
    const fill = rand() > 0.6 ? "none" : color;
    const fillOpacity = fill === "none" ? 0 : 0.05 + rand() * 0.1;
    svg += `  <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="${fill}" fill-opacity="${fillOpacity.toFixed(2)}" stroke="${color}" stroke-width="${strokeWidth.toFixed(1)}" opacity="${opacity.toFixed(2)}" />\n`;
  }
  return svg;
}

function intersectingArcs(cx, cy, r, count, rand, colors) {
  let svg = "";
  for (let i = 0; i < count; i++) {
    const startAngle = rand() * Math.PI * 2;
    const sweep = (Math.PI / 4) + rand() * Math.PI;
    const arcR = r * (0.3 + rand() * 0.7);
    const x1 = cx + arcR * Math.cos(startAngle);
    const y1 = cy + arcR * Math.sin(startAngle);
    const x2 = cx + arcR * Math.cos(startAngle + sweep);
    const y2 = cy + arcR * Math.sin(startAngle + sweep);
    const color = colors[Math.floor(rand() * colors.length)];
    const opacity = 0.2 + rand() * 0.4;
    const strokeWidth = 1 + rand() * 4;
    const largeArc = sweep > Math.PI ? 1 : 0;
    svg += `  <path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${arcR.toFixed(1)} ${arcR.toFixed(1)} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${strokeWidth.toFixed(1)}" opacity="${opacity.toFixed(2)}" stroke-linecap="round" />\n`;
  }
  return svg;
}

function gridLines(x, y, w, h, divisions, rand, colors) {
  let svg = "";
  for (let i = 0; i <= divisions; i++) {
    const offset = rand() * 8 - 4; // stochastic jitter
    const color = colors[Math.floor(rand() * colors.length)];
    const opacity = 0.08 + rand() * 0.15;
    const strokeWidth = 0.5 + rand() * 2;
    // Horizontal
    if (rand() > 0.3) {
      const ly = y + (h * i) / divisions + offset;
      svg += `  <line x1="${x}" y1="${ly.toFixed(1)}" x2="${(x + w)}" y2="${(ly + rand() * 4 - 2).toFixed(1)}" stroke="${color}" stroke-width="${strokeWidth.toFixed(1)}" opacity="${opacity.toFixed(2)}" />\n`;
    }
    // Vertical
    if (rand() > 0.3) {
      const lx = x + (w * i) / divisions + offset;
      svg += `  <line x1="${lx.toFixed(1)}" y1="${y}" x2="${(lx + rand() * 4 - 2).toFixed(1)}" y2="${(y + h)}" stroke="${color}" stroke-width="${strokeWidth.toFixed(1)}" opacity="${opacity.toFixed(2)}" />\n`;
    }
  }
  return svg;
}

function fractalTriangles(cx, cy, size, depth, rand, colors) {
  if (depth <= 0 || size < 5) return "";
  let svg = "";
  const color = colors[Math.floor(rand() * colors.length)];
  const opacity = 0.1 + rand() * 0.2;
  const rotation = rand() * 360;

  // Triangle points
  const points = [];
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 * i) / 3 - Math.PI / 2;
    points.push(`${(cx + size * Math.cos(angle)).toFixed(1)},${(cy + size * Math.sin(angle)).toFixed(1)}`);
  }

  svg += `  <polygon points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="1" opacity="${opacity.toFixed(2)}" transform="rotate(${rotation.toFixed(0)} ${cx} ${cy})" />\n`;

  // Recurse into smaller triangles
  if (rand() > 0.3) {
    const newSize = size * (0.4 + rand() * 0.2);
    const offsetX = (rand() - 0.5) * size * 0.8;
    const offsetY = (rand() - 0.5) * size * 0.8;
    svg += fractalTriangles(cx + offsetX, cy + offsetY, newSize, depth - 1, rand, colors);
  }
  if (rand() > 0.5) {
    const newSize = size * (0.3 + rand() * 0.2);
    const offsetX = (rand() - 0.5) * size;
    const offsetY = (rand() - 0.5) * size;
    svg += fractalTriangles(cx + offsetX, cy + offsetY, newSize, depth - 1, rand, colors);
  }
  return svg;
}

function floatingDots(w, h, count, rand, colors) {
  let svg = "";
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 2 + rand() * 12;
    const color = colors[Math.floor(rand() * colors.length)];
    const opacity = 0.1 + rand() * 0.3;
    svg += `  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(2)}" />\n`;
  }
  return svg;
}

function spiralPath(cx, cy, maxR, turns, rand, color) {
  let svg = "";
  const points = [];
  const steps = turns * 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    const r = maxR * t;
    const jitter = rand() * 3 - 1.5;
    points.push(`${(cx + (r + jitter) * Math.cos(angle)).toFixed(1)},${(cy + (r + jitter) * Math.sin(angle)).toFixed(1)}`);
  }
  const opacity = 0.15 + rand() * 0.25;
  svg += `  <polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="1.5" opacity="${opacity.toFixed(2)}" />\n`;
  return svg;
}

// ═══════════════════════════════════════════════
// COMPOSITION STRATEGIES — how elements combine
// ═══════════════════════════════════════════════

const STRATEGIES = {
  concentric(w, h, rand, colors, density) {
    let svg = "";
    const cx = w * (0.3 + rand() * 0.4);
    const cy = h * (0.3 + rand() * 0.4);
    const maxR = Math.min(w, h) * (0.3 + rand() * 0.3);
    const rings = density === "sparse" ? 4 : density === "dense" ? 12 : 7;
    svg += concentricCircles(cx, cy, maxR, rings, rand, colors);
    svg += intersectingArcs(cx, cy, maxR * 1.2, density === "sparse" ? 3 : 6, rand, colors);
    if (rand() > 0.5) svg += floatingDots(w, h, density === "sparse" ? 5 : 15, rand, colors);
    return svg;
  },

  fractal(w, h, rand, colors, density) {
    let svg = "";
    const cx = w * (0.3 + rand() * 0.4);
    const cy = h * (0.3 + rand() * 0.4);
    const size = Math.min(w, h) * (0.2 + rand() * 0.2);
    const depth = density === "sparse" ? 3 : density === "dense" ? 6 : 4;
    svg += fractalTriangles(cx, cy, size, depth, rand, colors);
    if (rand() > 0.4) {
      const cx2 = w * (0.2 + rand() * 0.6);
      const cy2 = h * (0.2 + rand() * 0.6);
      svg += fractalTriangles(cx2, cy2, size * 0.7, depth - 1, rand, colors);
    }
    svg += gridLines(w * 0.1, h * 0.1, w * 0.8, h * 0.8, 8, rand, colors);
    return svg;
  },

  spiral(w, h, rand, colors, density) {
    let svg = "";
    const cx = w * (0.4 + rand() * 0.2);
    const cy = h * (0.4 + rand() * 0.2);
    const maxR = Math.min(w, h) * (0.25 + rand() * 0.15);
    const turns = density === "sparse" ? 2 : density === "dense" ? 5 : 3;
    svg += spiralPath(cx, cy, maxR, turns, rand, colors[0]);
    if (rand() > 0.3) svg += spiralPath(cx + rand() * 100 - 50, cy + rand() * 80 - 40, maxR * 0.6, turns, rand, colors[1]);
    svg += concentricCircles(cx, cy, maxR * 0.3, 3, rand, colors);
    svg += floatingDots(w, h, density === "sparse" ? 8 : 20, rand, colors);
    return svg;
  },

  grid(w, h, rand, colors, density) {
    let svg = "";
    const divisions = density === "sparse" ? 6 : density === "dense" ? 16 : 10;
    svg += gridLines(w * 0.05, h * 0.05, w * 0.9, h * 0.9, divisions, rand, colors);
    // Add geometric accents at intersections
    const step = Math.min(w, h) / divisions;
    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < divisions; j++) {
        if (rand() > 0.85) {
          const x = w * 0.05 + (w * 0.9 * i) / divisions;
          const y = h * 0.05 + (h * 0.9 * j) / divisions;
          const color = colors[Math.floor(rand() * colors.length)];
          const size = 3 + rand() * 15;
          const opacity = 0.15 + rand() * 0.3;
          if (rand() > 0.5) {
            svg += `  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(2)}" />\n`;
          } else {
            svg += `  <rect x="${(x - size / 2).toFixed(1)}" y="${(y - size / 2).toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(2)}" transform="rotate(${(rand() * 45).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" />\n`;
          }
        }
      }
    }
    return svg;
  },

  mixed(w, h, rand, colors, density) {
    let svg = "";
    // Combine elements from multiple strategies
    const cx = w * (0.3 + rand() * 0.4);
    const cy = h * (0.3 + rand() * 0.4);
    svg += concentricCircles(cx, cy, Math.min(w, h) * 0.2, 4, rand, colors);
    svg += gridLines(w * 0.1, h * 0.1, w * 0.8, h * 0.8, 6, rand, colors);
    svg += intersectingArcs(w * 0.6, h * 0.4, Math.min(w, h) * 0.25, 4, rand, colors);
    svg += floatingDots(w, h, 10, rand, colors);
    if (rand() > 0.5) svg += fractalTriangles(w * 0.7, h * 0.6, 80, 3, rand, colors);
    return svg;
  },
};

// ═══════════════════════════════════════════════
// SLIDE ANALYSIS — map content to visual strategy
// ═══════════════════════════════════════════════

function analyzeSlide(slideContent, slideIndex, rand) {
  const lower = slideContent.toLowerCase();
  const strategies = Object.keys(STRATEGIES);

  // Content-weighted probability, not deterministic match
  // Every slide gets variation; content just biases the choice
  const weights = {
    concentric: 1,
    fractal: 1,
    spiral: 1,
    grid: 1,
    mixed: 1,
  };

  // Boost weights based on content themes
  if (/concentric|loop|circle|nested/i.test(lower)) weights.concentric += 2;
  if (/fractal|recursive|self-similar|generative/i.test(lower)) weights.fractal += 2;
  if (/spiral|convergence|converge|diminishing|iteration/i.test(lower)) weights.spiral += 2;
  if (/grid|zone|layout|column|table|wireframe/i.test(lower)) weights.grid += 2;
  if (/rubric|score|evaluat|feedback|measure/i.test(lower)) weights.mixed += 2;

  // Ensure no two adjacent slides use the same strategy: offset by index
  const rotated = strategies[(slideIndex % strategies.length)];
  weights[rotated] += 1.5;

  // Weighted random selection
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (const [strategy, weight] of Object.entries(weights)) {
    r -= weight;
    if (r <= 0) return strategy;
  }
  return strategies[0];
}

// ═══════════════════════════════════════════════
// MAIN — generate images for a deck
// ═══════════════════════════════════════════════

function generateArt(inputPath, options = {}) {
  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = md.split(/\n---\n/).filter((s) => s.trim());

  const paletteName = options.palette || "kandinsky";
  const palette = PALETTES[paletteName] || PALETTES.kandinsky;
  const density = options.density || "moderate";
  const globalSeed = options.seed || hashString(inputPath);
  const width = options.width || 1920;
  const height = options.height || 1080;

  // Determine output directory
  const baseName = path.basename(inputPath, path.extname(inputPath)).replace(/\.composed$/, "");
  const outputDir = options.output || path.join("decks", `${baseName}.composed-images`);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Parse slide range
  let slideIndices = slides.map((_, i) => i);
  if (options.slides) {
    slideIndices = [];
    for (const part of String(options.slides).split(",")) {
      const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (match) {
        const start = parseInt(match[1]) - 1;
        const end = match[2] ? parseInt(match[2]) - 1 : start;
        for (let i = start; i <= end; i++) slideIndices.push(i);
      }
    }
  }

  console.error(chalk.dim(`\n  Generative art: ${paletteName} palette, ${density} density`));
  console.error(chalk.dim(`  Slides: ${slideIndices.length}/${slides.length}  |  Seed: ${globalSeed}`));
  console.error(chalk.dim(`  Output: ${outputDir}\n`));

  let generated = 0;

  for (const i of slideIndices) {
    if (i >= slides.length) continue;
    const slideNum = String(i + 1).padStart(2, "0");
    const outPath = path.join(outputDir, `slide-${slideNum}.svg`);

    // Skip if exists and not forced
    if (fs.existsSync(outPath) && !options.force) {
      console.error(chalk.dim(`  S${slideNum}: cached`));
      continue;
    }

    const slideContent = slides[i];
    const strategy = analyzeSlide(slideContent, i, rand);
    const slideSeed = globalSeed + i * 7919; // prime offset for variation
    const rand = seededRandom(slideSeed);

    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
      `  <rect width="${width}" height="${height}" fill="${palette.bg}" />`,
      STRATEGIES[strategy](width, height, rand, palette.colors, density),
      `</svg>`,
    ].join("\n");

    fs.writeFileSync(outPath, svg);
    generated++;
    console.error(`  ${chalk.green("+")} S${slideNum}: ${strategy} (${path.basename(outPath)})`);
  }

  console.error(chalk.dim(`\n  Generated ${generated} images → ${outputDir}\n`));
  return { outputDir, generated, total: slideIndices.length };
}

// ═══════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.length === 0) {
    console.log(fs.readFileSync(__filename, "utf-8").match(/\/\*\*([\s\S]*?)\*\//)[1]);
    process.exit(0);
  }

  const input = args.find((a) => !a.startsWith("-"));
  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  generateArt(input, {
    palette: getFlag("--palette") || "kandinsky",
    density: getFlag("--density") || "moderate",
    seed: getFlag("--seed") ? parseInt(getFlag("--seed")) : undefined,
    slides: getFlag("--slides"),
    output: getFlag("--output"),
    width: getFlag("--width") ? parseInt(getFlag("--width")) : 1920,
    height: getFlag("--height") ? parseInt(getFlag("--height")) : 1080,
    force: args.includes("--force"),
  });
}

module.exports = { generateArt, PALETTES, STRATEGIES };
