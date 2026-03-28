#!/usr/bin/env node
/**
 * generate-brief.js — produce genuinely varied design briefs
 *
 * Each invocation generates a unique aesthetic direction by randomly
 * combining: color theory palette, font pairing, accent system,
 * mood/atmosphere, and layout bias. The 60-column Swiss grid is the
 * only constant — everything else is exploratory.
 *
 * Usage:
 *   node generate-brief.js                     → print brief string
 *   node generate-brief.js --json              → JSON output
 *   node generate-brief.js --avoid <corpus>     → avoid recent palettes
 */

// ── Color Theory Palettes ──
// Each palette has a theory basis and a mood. Generated from HSL color space.

function hslToHex(h, s, l) {
  h = h % 360;
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
  return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

function generatePalette() {
  const baseHue = Math.floor(Math.random() * 360);
  const schemes = [
    { name: "complementary", hues: [baseHue, (baseHue + 180) % 360] },
    { name: "split-complementary", hues: [baseHue, (baseHue + 150) % 360, (baseHue + 210) % 360] },
    { name: "triadic", hues: [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360] },
    { name: "analogous", hues: [baseHue, (baseHue + 30) % 360, (baseHue + 330) % 360] },
    { name: "monochromatic", hues: [baseHue] },
    { name: "tetradic", hues: [baseHue, (baseHue + 90) % 360, (baseHue + 180) % 360, (baseHue + 270) % 360] },
  ];
  const scheme = schemes[Math.floor(Math.random() * schemes.length)];

  // Generate dark bg, light bg, accent, text from the scheme hues
  const darkBg = hslToHex(scheme.hues[0], 30 + Math.random() * 30, 8 + Math.random() * 10);
  const lightBg = hslToHex(scheme.hues[0], 10 + Math.random() * 20, 92 + Math.random() * 6);
  const accent = hslToHex(scheme.hues[1] || scheme.hues[0], 60 + Math.random() * 30, 40 + Math.random() * 20);
  const secondAccent = scheme.hues.length > 2
    ? hslToHex(scheme.hues[2], 50 + Math.random() * 30, 35 + Math.random() * 25)
    : null;

  return { scheme: scheme.name, baseHue, darkBg, lightBg, accent, secondAccent, hues: scheme.hues };
}

// ── Font Pairings ──
// Each pairing has a character. Some are conventional, some are surprising.

const FONT_PAIRINGS = [
  { heading: "Futura", body: "Futura", character: "Pure geometric modernism — Bauhaus lineage" },
  { heading: "Georgia", body: "Georgia", character: "Classical scholarship — warm, authoritative" },
  { heading: "Palatino", body: "Palatino", character: "Renaissance humanism — Zapf's masterwork" },
  { heading: "Futura", body: "Georgia", character: "Geometric meets classical — tension between modern and traditional" },
  { heading: "Futura", body: "Palatino", character: "Swiss precision meets Italian warmth" },
  { heading: "Helvetica Neue", body: "Georgia", character: "International style meets editorial tradition" },
  { heading: "Helvetica Neue", body: "Helvetica Neue", character: "Neutral Swiss — the text speaks, not the type" },
  { heading: "Georgia", body: "Helvetica Neue", character: "Serif headings ground sans-serif body — academic with clarity" },
  { heading: "Courier New", body: "Helvetica Neue", character: "Terminal meets Swiss — technical, raw, computational" },
  { heading: "Futura", body: "Courier New", character: "Geometric meets monospace — design meets code" },
];

// ── Moods / Atmospheres ──

const MOODS = [
  { name: "Brutalist", desc: "Raw concrete, exposed structure, deliberate roughness. Heavy bars, tight spacing, confrontational type." },
  { name: "Editorial", desc: "Magazine-spread luxury. Generous whitespace, careful leading, pull-quotes as visual anchors." },
  { name: "Archival", desc: "Museum catalog aesthetic. Muted palette, systematic labeling, specimen-like precision." },
  { name: "Provocative", desc: "Design that challenges. Asymmetric tension, unexpected color, type as weapon." },
  { name: "Cinematic", desc: "Widescreen drama. Dark backgrounds, spotlight compositions, text as subtitle." },
  { name: "Technical", desc: "Blueprint precision. Grid visible as design element, data-forward, diagram-thinking." },
  { name: "Botanical", desc: "Natural observation. Earth tones, organic spacing, specimen-plate compositions." },
  { name: "Constructivist", desc: "Revolutionary geometry. Diagonal energy, red-black-white, type as architecture." },
  { name: "Minimalist", desc: "Radical reduction. Maximum whitespace, single element per slide, type does all the work." },
  { name: "Collage", desc: "Layered fragments. Multiple zones overlapping intentionally, found-material aesthetic." },
  { name: "Neon-noir", desc: "Dark ground with electric highlights. Cyan, magenta, yellow on near-black. Data-punk." },
  { name: "Parchment", desc: "Historical manuscript. Warm ivory, ink-black text, illuminated capitals, marginalia accents." },
];

// ── Accent Systems ──

const ACCENT_SYSTEMS = [
  { name: "vertical-bars", desc: "Full-height vertical bars as column markers — Müller-Brockmann reference" },
  { name: "horizontal-rules", desc: "Thin horizontal lines dividing content zones — Tschichold" },
  { name: "dot-system", desc: "Circular dots as punctuation marks in the grid — Max Bill" },
  { name: "corner-blocks", desc: "Solid rectangles anchoring corners — constructivist framing" },
  { name: "diagonal-slash", desc: "Single diagonal accent cutting across the grid — dynamic tension" },
  { name: "margin-stripe", desc: "Narrow stripe along one edge — subtle but consistent" },
  { name: "none", desc: "No accents — the grid and typography do all the work" },
];

// ── Generate ──

function generateBrief(opts = {}) {
  const palette = generatePalette();
  const fonts = FONT_PAIRINGS[Math.floor(Math.random() * FONT_PAIRINGS.length)];
  const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
  const accents = ACCENT_SYSTEMS[Math.floor(Math.random() * ACCENT_SYSTEMS.length)];

  // Construct the brief string
  const parts = [
    `${mood.name} mood. ${mood.desc}`,
    `Palette: ${palette.scheme} from hue ${palette.baseHue}. Dark bg: ${palette.darkBg}, light bg: ${palette.lightBg}, accent: ${palette.accent}${palette.secondAccent ? ", second accent: " + palette.secondAccent : ""}.`,
    `Font: ${fonts.heading}${fonts.heading !== fonts.body ? " headings + " + fonts.body + " body" : " throughout"}. ${fonts.character}.`,
    `Accent system: ${accents.name} — ${accents.desc}`,
    `Body text minimum 15px. Titles 28-48px.`,
    `Accents on 60-80% of slides, not every slide.`,
    `Swiss 60-column grid discipline — but push the layouts. Try offset compositions, dramatic whitespace, typographic posters, data walls.`,
  ];

  return {
    brief: parts.join(" "),
    palette,
    fonts,
    mood: mood.name,
    accentSystem: accents.name,
  };
}

// ── CLI ──
const args = process.argv.slice(2);
const result = generateBrief();

if (args.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(result.brief);
}
