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
    colors: ["#C62828", "#1565C0", "#F9A825", "#0A1628", "#2E7D32", "#6A1B9A"],
    accent: "#C62828",
  },
  bauhaus: {
    name: "Bauhaus Primary",
    bg: "#F5F0E4",
    colors: ["#D50000", "#0043CE", "#FFD600", "#1A1A1A", "#00695C"],
    accent: "#D50000",
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
    const opacity = 0.4 + rand() * 0.4;
    const strokeWidth = 2 + rand() * 5;
    const fill = rand() > 0.5 ? "none" : color;
    const fillOpacity = fill === "none" ? 0 : 0.1 + rand() * 0.2;
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
    const opacity = 0.4 + rand() * 0.45;
    const strokeWidth = 2 + rand() * 6;
    const largeArc = sweep > Math.PI ? 1 : 0;
    svg += `  <path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${arcR.toFixed(1)} ${arcR.toFixed(1)} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${strokeWidth.toFixed(1)}" opacity="${opacity.toFixed(2)}" stroke-linecap="round" />\n`;
  }
  return svg;
}

function gridLines(x, y, w, h, divisions, rand, colors) {
  let svg = "";
  for (let i = 0; i <= divisions; i++) {
    const offset = rand() * 12 - 6; // stochastic jitter
    const color = colors[Math.floor(rand() * colors.length)];
    const opacity = 0.2 + rand() * 0.35;
    const strokeWidth = 1 + rand() * 3;
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
  const opacity = 0.3 + rand() * 0.4;
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
    const r = 4 + rand() * 20;
    const color = colors[Math.floor(rand() * colors.length)];
    const opacity = 0.25 + rand() * 0.45;
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
  const opacity = 0.35 + rand() * 0.35;
  svg += `  <polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" opacity="${opacity.toFixed(2)}" />\n`;
  return svg;
}

// ═══════════════════════════════════════════════
// COMPOSITION STRATEGIES — how elements combine
// Each call uses rand() extensively so identical
// strategies with different seeds look different.
// ═══════════════════════════════════════════════

const STRATEGIES = {
  concentric(w, h, rand, colors, density) {
    let svg = "";
    // Randomize: position, scale, ring count, whether filled or stroked, rotation
    const cx = w * (0.1 + rand() * 0.8);
    const cy = h * (0.1 + rand() * 0.8);
    const maxR = Math.min(w, h) * (0.15 + rand() * 0.45);
    const rings = 3 + Math.floor(rand() * 10);
    const globalRotation = rand() * 360;

    svg += `  <g transform="rotate(${globalRotation.toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})">\n`;
    svg += concentricCircles(cx, cy, maxR, rings, rand, colors);

    // Vary: sometimes arcs, sometimes full circles only, sometimes with cross-lines
    const variant = rand();
    if (variant < 0.4) {
      svg += intersectingArcs(cx, cy, maxR * (0.8 + rand() * 0.8), 3 + Math.floor(rand() * 8), rand, colors);
    } else if (variant < 0.7) {
      // Cross-hair lines through center
      const lc = colors[Math.floor(rand() * colors.length)];
      const lo = (0.3 + rand() * 0.4).toFixed(2);
      svg += `  <line x1="${(cx - maxR * 1.3).toFixed(0)}" y1="${cy.toFixed(0)}" x2="${(cx + maxR * 1.3).toFixed(0)}" y2="${cy.toFixed(0)}" stroke="${lc}" stroke-width="${(1 + rand() * 4).toFixed(1)}" opacity="${lo}" />\n`;
      svg += `  <line x1="${cx.toFixed(0)}" y1="${(cy - maxR * 1.3).toFixed(0)}" x2="${cx.toFixed(0)}" y2="${(cy + maxR * 1.3).toFixed(0)}" stroke="${lc}" stroke-width="${(1 + rand() * 4).toFixed(1)}" opacity="${lo}" />\n`;
    } else {
      // Eccentric offset circles
      for (let i = 0; i < 3; i++) {
        const ox = cx + (rand() - 0.5) * maxR;
        const oy = cy + (rand() - 0.5) * maxR;
        svg += concentricCircles(ox, oy, maxR * (0.2 + rand() * 0.3), 2 + Math.floor(rand() * 3), rand, colors);
      }
    }
    svg += `  </g>\n`;

    // Optional second cluster at a different position
    if (rand() > 0.5) {
      const cx2 = w * rand();
      const cy2 = h * rand();
      svg += concentricCircles(cx2, cy2, maxR * (0.2 + rand() * 0.4), 2 + Math.floor(rand() * 4), rand, colors);
    }
    svg += floatingDots(w, h, 5 + Math.floor(rand() * 20), rand, colors);
    return svg;
  },

  fractal(w, h, rand, colors, density) {
    let svg = "";
    // Vary: number of clusters, depth, polygon sides (not just triangles), rotation
    const clusters = 1 + Math.floor(rand() * 4);
    const globalRotation = rand() * 360;
    const baseDepth = 2 + Math.floor(rand() * 5);

    svg += `  <g transform="rotate(${globalRotation.toFixed(0)} ${(w / 2).toFixed(0)} ${(h / 2).toFixed(0)})">\n`;
    for (let c = 0; c < clusters; c++) {
      const cx = w * (0.1 + rand() * 0.8);
      const cy = h * (0.1 + rand() * 0.8);
      const size = Math.min(w, h) * (0.1 + rand() * 0.3);
      svg += fractalTriangles(cx, cy, size, baseDepth, rand, colors);
    }
    svg += `  </g>\n`;

    // Vary: sometimes add grid underlay, sometimes diagonal lines, sometimes nothing
    const underlay = rand();
    if (underlay < 0.33) {
      const angle = rand() * 45;
      svg += `  <g transform="rotate(${angle.toFixed(0)} ${(w / 2).toFixed(0)} ${(h / 2).toFixed(0)})">\n`;
      svg += gridLines(w * 0.05, h * 0.05, w * 0.9, h * 0.9, 4 + Math.floor(rand() * 8), rand, colors);
      svg += `  </g>\n`;
    } else if (underlay < 0.66) {
      // Diagonal slash lines
      const count = 3 + Math.floor(rand() * 6);
      for (let i = 0; i < count; i++) {
        const color = colors[Math.floor(rand() * colors.length)];
        const x1 = rand() * w;
        const y1 = rand() * h;
        const angle = rand() * Math.PI;
        const len = 200 + rand() * 600;
        svg += `  <line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${(x1 + len * Math.cos(angle)).toFixed(0)}" y2="${(y1 + len * Math.sin(angle)).toFixed(0)}" stroke="${color}" stroke-width="${(1 + rand() * 4).toFixed(1)}" opacity="${(0.2 + rand() * 0.4).toFixed(2)}" />\n`;
      }
    }
    svg += floatingDots(w, h, 3 + Math.floor(rand() * 10), rand, colors);
    return svg;
  },

  spiral(w, h, rand, colors, density) {
    let svg = "";
    // Vary: number of spirals, direction, tightness, thickness, position
    const spiralCount = 1 + Math.floor(rand() * 4);
    const globalRotation = rand() * 360;

    svg += `  <g transform="rotate(${globalRotation.toFixed(0)} ${(w / 2).toFixed(0)} ${(h / 2).toFixed(0)})">\n`;
    for (let s = 0; s < spiralCount; s++) {
      const cx = w * (0.15 + rand() * 0.7);
      const cy = h * (0.15 + rand() * 0.7);
      const maxR = Math.min(w, h) * (0.1 + rand() * 0.35);
      const turns = 1.5 + rand() * 5;
      const colorIdx = Math.floor(rand() * colors.length);
      svg += spiralPath(cx, cy, maxR, turns, rand, colors[colorIdx]);
    }
    svg += `  </g>\n`;

    // Vary accent: concentric rings, dots, arcs, or rectangular blocks
    const accent = rand();
    if (accent < 0.3) {
      const cx = w * (0.2 + rand() * 0.6);
      const cy = h * (0.2 + rand() * 0.6);
      svg += concentricCircles(cx, cy, Math.min(w, h) * (0.1 + rand() * 0.15), 2 + Math.floor(rand() * 3), rand, colors);
    } else if (accent < 0.6) {
      // Rectangular blocks (Mondrian-ish)
      for (let i = 0; i < 2 + Math.floor(rand() * 4); i++) {
        const color = colors[Math.floor(rand() * colors.length)];
        const bw = 30 + rand() * 200;
        const bh = 20 + rand() * 150;
        const bx = rand() * (w - bw);
        const by = rand() * (h - bh);
        const rotation = rand() > 0.7 ? rand() * 15 : 0;
        svg += `  <rect x="${bx.toFixed(0)}" y="${by.toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" fill="${color}" opacity="${(0.15 + rand() * 0.3).toFixed(2)}" transform="rotate(${rotation.toFixed(0)} ${(bx + bw / 2).toFixed(0)} ${(by + bh / 2).toFixed(0)})" />\n`;
      }
    }
    svg += floatingDots(w, h, 5 + Math.floor(rand() * 15), rand, colors);
    return svg;
  },

  grid(w, h, rand, colors, density) {
    let svg = "";
    // Vary: rotation angle, divisions, regularity, accent density
    const gridAngle = rand() * 60 - 30; // -30 to +30 degree tilt
    const divisions = 4 + Math.floor(rand() * 12);
    const marginX = w * (0.02 + rand() * 0.1);
    const marginY = h * (0.02 + rand() * 0.1);

    svg += `  <g transform="rotate(${gridAngle.toFixed(1)} ${(w / 2).toFixed(0)} ${(h / 2).toFixed(0)})">\n`;
    svg += gridLines(marginX, marginY, w - marginX * 2, h - marginY * 2, divisions, rand, colors);

    // Accent elements at intersections — vary shapes heavily
    for (let i = 0; i <= divisions; i++) {
      for (let j = 0; j <= divisions; j++) {
        if (rand() > 0.45) {
          const x = marginX + ((w - marginX * 2) * i) / divisions;
          const y = marginY + ((h - marginY * 2) * j) / divisions;
          const color = colors[Math.floor(rand() * colors.length)];
          const size = 4 + rand() * 30;
          const opacity = (0.25 + rand() * 0.5).toFixed(2);
          const shape = rand();
          const rot = rand() * 90;
          if (shape < 0.3) {
            svg += `  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="${color}" opacity="${opacity}" />\n`;
          } else if (shape < 0.55) {
            svg += `  <rect x="${(x - size / 2).toFixed(1)}" y="${(y - size / 2).toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="${color}" opacity="${opacity}" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" />\n`;
          } else if (shape < 0.75) {
            // Diamond
            const d = size * 0.7;
            svg += `  <polygon points="${x.toFixed(1)},${(y - d).toFixed(1)} ${(x + d).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y + d).toFixed(1)} ${(x - d).toFixed(1)},${y.toFixed(1)}" fill="${color}" opacity="${opacity}" />\n`;
          } else {
            // Small cross
            const s = size * 0.4;
            svg += `  <line x1="${(x - s).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + s).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="${(2 + rand() * 3).toFixed(1)}" opacity="${opacity}" />\n`;
            svg += `  <line x1="${x.toFixed(1)}" y1="${(y - s).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + s).toFixed(1)}" stroke="${color}" stroke-width="${(2 + rand() * 3).toFixed(1)}" opacity="${opacity}" />\n`;
          }
        }
      }
    }
    svg += `  </g>\n`;
    return svg;
  },

  mixed(w, h, rand, colors, density) {
    let svg = "";
    // Pick 2-3 random sub-strategies and layer them with different transforms
    const layers = 2 + Math.floor(rand() * 2);
    const subStrategies = ["circles", "arcs", "triangles", "grid", "spiral", "dots", "blocks"];

    for (let l = 0; l < layers; l++) {
      const sub = subStrategies[Math.floor(rand() * subStrategies.length)];
      const rotation = rand() * 40 - 20;
      const tx = (rand() - 0.5) * w * 0.3;
      const ty = (rand() - 0.5) * h * 0.3;
      const cx = w * (0.2 + rand() * 0.6);
      const cy = h * (0.2 + rand() * 0.6);
      const scale = 0.6 + rand() * 0.8;

      svg += `  <g transform="translate(${tx.toFixed(0)} ${ty.toFixed(0)}) rotate(${rotation.toFixed(0)} ${(w / 2).toFixed(0)} ${(h / 2).toFixed(0)}) scale(${scale.toFixed(2)})">\n`;

      switch (sub) {
        case "circles":
          svg += concentricCircles(cx, cy, Math.min(w, h) * (0.15 + rand() * 0.25), 3 + Math.floor(rand() * 6), rand, colors);
          break;
        case "arcs":
          svg += intersectingArcs(cx, cy, Math.min(w, h) * (0.2 + rand() * 0.3), 4 + Math.floor(rand() * 8), rand, colors);
          break;
        case "triangles":
          svg += fractalTriangles(cx, cy, 60 + rand() * 180, 2 + Math.floor(rand() * 4), rand, colors);
          break;
        case "grid":
          svg += gridLines(w * 0.1, h * 0.1, w * 0.8, h * 0.8, 4 + Math.floor(rand() * 6), rand, colors);
          break;
        case "spiral":
          svg += spiralPath(cx, cy, Math.min(w, h) * (0.1 + rand() * 0.2), 2 + rand() * 3, rand, colors[Math.floor(rand() * colors.length)]);
          break;
        case "dots":
          svg += floatingDots(w, h, 10 + Math.floor(rand() * 25), rand, colors);
          break;
        case "blocks": {
          const count = 2 + Math.floor(rand() * 5);
          for (let b = 0; b < count; b++) {
            const color = colors[Math.floor(rand() * colors.length)];
            const bw = 40 + rand() * 250;
            const bh = 30 + rand() * 180;
            svg += `  <rect x="${(rand() * w).toFixed(0)}" y="${(rand() * h).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" fill="${color}" opacity="${(0.12 + rand() * 0.3).toFixed(2)}" transform="rotate(${(rand() * 30).toFixed(0)} ${(w / 2).toFixed(0)} ${(h / 2).toFixed(0)})" />\n`;
          }
          break;
        }
      }
      svg += `  </g>\n`;
    }
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
    const slideSeed = globalSeed + i * 7919; // prime offset for variation
    const rand = seededRandom(slideSeed);
    const strategy = analyzeSlide(slideContent, i, rand);

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

  // Auto-convert and splice if htmlPath available
  if (generated > 0 && options.htmlPath) {
    convertAndSplice(outputDir, options.htmlPath);
  }

  return { outputDir, generated, total: slideIndices.length };
}

// ═══════════════════════════════════════════════
// IMAGE DIVERSITY EVALUATOR
// ═══════════════════════════════════════════════

function extractFeatures(svgContent) {
  const circles = (svgContent.match(/<circle/g) || []).length;
  const lines = (svgContent.match(/<line/g) || []).length;
  const paths = (svgContent.match(/<path/g) || []).length;
  const polys = (svgContent.match(/<polygon/g) || []).length;
  const rects = (svgContent.match(/<rect/g) || []).length - 1; // minus bg
  const polylines = (svgContent.match(/<polyline/g) || []).length;
  const total = circles + lines + paths + polys + Math.max(rects, 0) + polylines;

  // Extract spatial center of mass from coordinates
  const coords = [];
  for (const m of svgContent.matchAll(/(?:cx|x1|x)="([\d.]+)"/g)) coords.push(parseFloat(m[1]));
  const meanX = coords.length ? coords.reduce((a, b) => a + b, 0) / coords.length : 960;

  const ycoords = [];
  for (const m of svgContent.matchAll(/(?:cy|y1|y)="([\d.]+)"/g)) ycoords.push(parseFloat(m[1]));
  const meanY = ycoords.length ? ycoords.reduce((a, b) => a + b, 0) / ycoords.length : 540;

  // Extract opacity distribution
  const opacities = [];
  for (const m of svgContent.matchAll(/opacity="([\d.]+)"/g)) opacities.push(parseFloat(m[1]));
  const meanOpacity = opacities.length ? opacities.reduce((a, b) => a + b, 0) / opacities.length : 0.2;

  // Extract radii for scale sense
  const radii = [];
  for (const m of svgContent.matchAll(/r="([\d.]+)"/g)) radii.push(parseFloat(m[1]));
  const maxRadius = radii.length ? Math.max(...radii) : 100;

  // Color palette used
  const colors = new Set(svgContent.match(/#[0-9A-Fa-f]{6}/g) || []);

  return {
    // Element type vector (normalized)
    typeVec: [circles, lines, paths, polys, Math.max(rects, 0), polylines].map(
      (v) => v / (total || 1)
    ),
    // Spatial signature
    centerX: meanX / 1920,
    centerY: meanY / 1080,
    // Scale and density
    totalElements: total,
    maxRadius: maxRadius / 1080,
    meanOpacity,
    // Color count
    colorCount: colors.size,
  };
}

function computeSimilarity(a, b) {
  // Multi-dimensional similarity combining type, spatial, and density features

  // 1. Element type cosine similarity (0-1, higher = more similar)
  const dot = a.typeVec.reduce((sum, v, i) => sum + v * b.typeVec[i], 0);
  const normA = Math.sqrt(a.typeVec.reduce((sum, v) => sum + v * v, 0)) || 1;
  const normB = Math.sqrt(b.typeVec.reduce((sum, v) => sum + v * v, 0)) || 1;
  const typeSim = dot / (normA * normB);

  // 2. Spatial distance (0-1, lower = more similar)
  const spatialDist = Math.sqrt(
    (a.centerX - b.centerX) ** 2 + (a.centerY - b.centerY) ** 2
  );
  const spatialSim = 1 - Math.min(spatialDist / 0.5, 1);

  // 3. Scale similarity
  const scaleDiff = Math.abs(a.maxRadius - b.maxRadius);
  const scaleSim = 1 - Math.min(scaleDiff / 0.3, 1);

  // 4. Density similarity
  const densityDiff = Math.abs(a.totalElements - b.totalElements) / Math.max(a.totalElements, b.totalElements, 1);
  const densitySim = 1 - densityDiff;

  // 5. Opacity similarity
  const opacitySim = 1 - Math.abs(a.meanOpacity - b.meanOpacity);

  // Weighted combination — type matters most, then spatial, then others
  return typeSim * 0.35 + spatialSim * 0.25 + scaleSim * 0.15 + densitySim * 0.15 + opacitySim * 0.1;
}

function evaluateImageSet(outputDir) {
  const files = fs.readdirSync(outputDir)
    .filter((f) => f.match(/^slide-\d+\.svg$/))
    .sort();

  if (files.length < 2) return { score: 10, pairs: [], stats: {} };

  const features = files.map((f) => ({
    file: f,
    ...extractFeatures(fs.readFileSync(path.join(outputDir, f), "utf-8")),
  }));

  // Pairwise adjacent similarity
  const pairs = [];
  for (let i = 0; i < features.length - 1; i++) {
    const sim = computeSimilarity(features[i], features[i + 1]);
    pairs.push({
      a: features[i].file,
      b: features[i + 1].file,
      similarity: sim,
      tooSimilar: sim > 0.85,
    });
  }

  // Global diversity metrics
  const strategies = features.map((f) => {
    const maxIdx = f.typeVec.indexOf(Math.max(...f.typeVec));
    return ["circles", "lines", "paths", "polys", "rects", "polylines"][maxIdx];
  });
  const uniqueStrategies = new Set(strategies).size;
  const dominantCount = Math.max(
    ...Object.values(
      strategies.reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {})
    )
  );
  const dominantRatio = dominantCount / features.length;

  // Spatial spread
  const xs = features.map((f) => f.centerX);
  const ys = features.map((f) => f.centerY);
  const spatialVariance =
    (variance(xs) + variance(ys)) / 2;

  const similarPairs = pairs.filter((p) => p.tooSimilar).length;

  // Score: 10 = perfect diversity, 1 = everything looks the same
  const score = Math.max(1, Math.min(10,
    10
    - similarPairs * 0.4               // penalty per similar adjacent pair
    - (dominantRatio > 0.5 ? (dominantRatio - 0.5) * 8 : 0)  // penalty for dominant element type
    + (uniqueStrategies >= 4 ? 1 : 0)  // bonus for strategy variety
    + (spatialVariance > 0.01 ? 1 : 0) // bonus for spatial spread
  ));

  return {
    score: Math.round(score * 10) / 10,
    similarPairs,
    totalPairs: pairs.length,
    dominantType: strategies.sort((a, b) =>
      strategies.filter((s) => s === b).length - strategies.filter((s) => s === a).length
    )[0],
    dominantRatio: Math.round(dominantRatio * 100),
    uniqueTypes: uniqueStrategies,
    spatialVariance: Math.round(spatialVariance * 1000) / 1000,
    pairs,
  };
}

function variance(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
}

// ═══════════════════════════════════════════════
// DIVERSITY LOOP — regenerate similar images
// ═══════════════════════════════════════════════

function diversityLoop(inputPath, options = {}) {
  const maxIters = options.maxIters || 5;
  const targetScore = options.targetScore || 7;

  console.error(chalk.dim(`\n  ━━━ DIVERSITY LOOP ━━━━━━━━━━━━━━━━━━━━━━`));
  console.error(chalk.dim(`  Target: ${targetScore}/10  |  Max iterations: ${maxIters}\n`));

  // Initial generation (no auto-splice yet — we'll splice at the end)
  const result = generateArt(inputPath, { ...options, force: true, htmlPath: undefined });

  for (let iter = 0; iter < maxIters; iter++) {
    const eval_ = evaluateImageSet(result.outputDir);
    console.error(`  ${chalk.cyan("eval")} iter ${iter}: diversity ${eval_.score}/10  |  similar pairs: ${eval_.similarPairs}/${eval_.totalPairs}  |  dominant: ${eval_.dominantType} (${eval_.dominantRatio}%)`);

    if (eval_.score >= targetScore) {
      console.error(chalk.green(`  ✓ Diversity target met (${eval_.score} >= ${targetScore})`));
      if (options.htmlPath) convertAndSplice(result.outputDir, options.htmlPath);
      console.error("");
      return { ...result, eval: eval_, iterations: iter + 1 };
    }

    // Find slides to regenerate: the second slide in each too-similar pair
    const toRegenerate = new Set();
    for (const pair of eval_.pairs) {
      if (pair.tooSimilar) {
        // Regenerate the second slide with a shifted seed
        const slideNum = parseInt(pair.b.match(/\d+/)[0]);
        toRegenerate.add(slideNum);
      }
    }

    if (toRegenerate.size === 0) {
      console.error(chalk.yellow(`  ⚠ No similar pairs to fix, but score below target\n`));
      return { ...result, eval: eval_, iterations: iter + 1 };
    }

    console.error(chalk.dim(`  Regenerating ${toRegenerate.size} slides: ${[...toRegenerate].join(", ")}`));

    // Regenerate with shifted seeds — each iteration shifts further
    const md = fs.readFileSync(inputPath, "utf-8");
    const slides = md.split(/\n---\n/).filter((s) => s.trim());
    const paletteName = options.palette || "kandinsky";
    const palette = PALETTES[paletteName] || PALETTES.kandinsky;
    const density = options.density || "moderate";
    const globalSeed = options.seed || hashString(inputPath);
    const width = options.width || 1920;
    const height = options.height || 1080;
    const strategies = Object.keys(STRATEGIES);

    for (const slideNum of toRegenerate) {
      const i = slideNum - 1;
      if (i >= slides.length) continue;

      // Shift the seed significantly per iteration to get different output
      const slideSeed = globalSeed + i * 7919 + (iter + 1) * 104729;
      const rand = seededRandom(slideSeed);

      // Force a different strategy than what the neighbor uses
      const prevFile = path.join(result.outputDir, `slide-${String(slideNum - 1).padStart(2, "0")}.svg`);
      let prevStrategy = null;
      if (fs.existsSync(prevFile)) {
        const prevFeatures = extractFeatures(fs.readFileSync(prevFile, "utf-8"));
        const maxIdx = prevFeatures.typeVec.indexOf(Math.max(...prevFeatures.typeVec));
        prevStrategy = ["concentric", "fractal", "spiral", "grid", "mixed"][maxIdx] || null;
      }

      // Pick a strategy that differs from the neighbor
      let strategy;
      let attempts = 0;
      do {
        strategy = analyzeSlide(slides[i], i + iter * 5, rand);
        attempts++;
      } while (strategy === prevStrategy && attempts < 10);

      const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
        `  <rect width="${width}" height="${height}" fill="${palette.bg}" />`,
        STRATEGIES[strategy](width, height, rand, palette.colors, density),
        `</svg>`,
      ].join("\n");

      const outPath = path.join(result.outputDir, `slide-${String(slideNum).padStart(2, "0")}.svg`);
      fs.writeFileSync(outPath, svg);
      console.error(`  ${chalk.yellow("~")} S${String(slideNum).padStart(2, "0")}: ${strategy} (was too similar to S${String(slideNum - 1).padStart(2, "0")})`);
    }
  }

  const finalEval = evaluateImageSet(result.outputDir);
  console.error(`  ${chalk.cyan("final")} diversity ${finalEval.score}/10  |  similar: ${finalEval.similarPairs}/${finalEval.totalPairs}`);
  if (options.htmlPath) convertAndSplice(result.outputDir, options.htmlPath);
  console.error("");
  return { ...result, eval: finalEval, iterations: maxIters };
}

// ═══════════════════════════════════════════════
// SVG → PNG CONVERSION + AUTO-SPLICE
// Rule: every generation or regeneration must end
// with PNGs converted and HTML spliced. The pipeline
// is atomic — SVGs alone are not a deliverable.
// ═══════════════════════════════════════════════

function convertAndSplice(outputDir, htmlPath) {
  const { execSync } = require("child_process");

  // 1. Convert all SVGs to PNGs
  const svgs = fs.readdirSync(outputDir).filter((f) => f.endsWith(".svg"));
  let converted = 0;
  for (const svg of svgs) {
    const svgPath = path.join(outputDir, svg);
    const pngPath = svgPath.replace(/\.svg$/, ".png");
    const svgMtime = fs.statSync(svgPath).mtimeMs;
    const pngMtime = fs.existsSync(pngPath) ? fs.statSync(pngPath).mtimeMs : 0;

    if (svgMtime > pngMtime) {
      try {
        execSync(`convert "${svgPath}" -resize 1920x1080 "${pngPath}"`, { stdio: "pipe" });
        converted++;
      } catch (e) {
        console.error(chalk.red(`  ✗ Failed to convert ${svg}: ${e.message}`));
      }
    }
  }
  if (converted > 0) {
    console.error(chalk.dim(`  Converted ${converted} SVGs → PNGs`));
  }

  // 2. Splice into HTML if htmlPath provided
  if (htmlPath && fs.existsSync(htmlPath)) {
    try {
      const spliceResult = execSync(
        `node splice-images.js "${htmlPath}" "${outputDir}" --image-scale visible`,
        { stdio: "pipe", cwd: __dirname }
      ).toString();
      const splicedPath = htmlPath.replace(/\.html$/, ".spliced.html");
      console.error(chalk.dim(`  Spliced → ${path.basename(splicedPath)}`));
      return splicedPath;
    } catch (e) {
      console.error(chalk.yellow(`  ⚠ Splice failed: ${e.message}`));
    }
  }
  return null;
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

  const opts = {
    palette: getFlag("--palette") || "kandinsky",
    density: getFlag("--density") || "moderate",
    seed: getFlag("--seed") ? parseInt(getFlag("--seed")) : undefined,
    slides: getFlag("--slides"),
    output: getFlag("--output"),
    width: getFlag("--width") ? parseInt(getFlag("--width")) : 1920,
    height: getFlag("--height") ? parseInt(getFlag("--height")) : 1080,
    force: args.includes("--force"),
    maxIters: getFlag("--max-iters") ? parseInt(getFlag("--max-iters")) : 5,
    targetScore: getFlag("--target") ? parseFloat(getFlag("--target")) : 7,
    htmlPath: getFlag("--html"),
  };

  if (args.includes("--eval")) {
    // Evaluate existing images only
    const result = generateArt(input, { ...opts });
    const eval_ = evaluateImageSet(result.outputDir);
    console.error(`  Diversity: ${eval_.score}/10  |  Similar pairs: ${eval_.similarPairs}/${eval_.totalPairs}`);
    console.error(`  Dominant type: ${eval_.dominantType} (${eval_.dominantRatio}%)  |  Unique types: ${eval_.uniqueTypes}`);
    if (eval_.similarPairs > 0) {
      console.error(chalk.dim(`  Similar pairs:`));
      for (const p of eval_.pairs.filter((p) => p.tooSimilar)) {
        console.error(chalk.dim(`    ${p.a} <-> ${p.b} (${(p.similarity * 100).toFixed(0)}%)`));
      }
    }
  } else if (args.includes("--diverse")) {
    // Generate with diversity loop
    diversityLoop(input, opts);
  } else {
    generateArt(input, opts);
  }
}

module.exports = { generateArt, evaluateImageSet, diversityLoop, convertAndSplice, extractFeatures, computeSimilarity, PALETTES, STRATEGIES };
