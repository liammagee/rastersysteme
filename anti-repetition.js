#!/usr/bin/env node
/**
 * anti-repetition.js — scan recent decks and generate avoidance directives
 *
 * Extracts palette, font, and accent fingerprints from recent scored decks.
 * Returns a string that can be appended to a compose brief:
 * "DO NOT use these colors/fonts/patterns — they've been used recently."
 *
 * Usage:
 *   node anti-repetition.js                      → print avoidance string
 *   node anti-repetition.js --json               → JSON output
 *   node anti-repetition.js --last 5             → scan last 5 decks (default 3)
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const lastN = parseInt(args.find((a, i) => args[i - 1] === "--last") || "3");
const jsonMode = args.includes("--json");
const corpusDir = path.join(__dirname, "design-corpus");

if (!fs.existsSync(corpusDir)) {
  console.log("No corpus directory found.");
  process.exit(0);
}

// Load recent corpus entries sorted by modification time
const entries = fs.readdirSync(corpusDir)
  .filter(f => f.endsWith(".json") && f !== "index.json" && f !== "audit-report.md")
  .map(f => {
    const fullPath = path.join(corpusDir, f);
    const stat = fs.statSync(fullPath);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      return { file: f, mtime: stat.mtime, data };
    } catch (e) { return null; }
  })
  .filter(Boolean)
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, lastN);

if (entries.length === 0) {
  console.log("No recent corpus entries found.");
  process.exit(0);
}

// Extract fingerprints
const recentPalettes = new Set();
const recentFonts = new Set();
const recentAccentColors = new Set();
const recentMoods = new Set();

for (const entry of entries) {
  const d = entry.data;
  const fp = d.fingerprint || d.brief || {};
  // Palette — handle both array and object formats
  const palette = Array.isArray(fp.palette) ? fp.palette : [];
  palette.forEach(c => {
    const hex = typeof c === "string" ? c : (c && c.hex) ? c.hex : null;
    if (hex) recentPalettes.add(hex.toUpperCase().replace(/^#/, ""));
  });
  if (Array.isArray(fp.bgPalette)) {
    fp.bgPalette.forEach(c => recentPalettes.add(String(c).toUpperCase().replace(/^#/, "")));
  }
  // Fonts
  if (Array.isArray(fp.fonts)) {
    fp.fonts.forEach(f => { if (typeof f === "string") recentFonts.add(f); });
  } else if (fp.font) {
    recentFonts.add(fp.font);
  }
  // Accents
  if (Array.isArray(fp.accentColors)) {
    fp.accentColors.forEach(c => recentAccentColors.add(String(c).toUpperCase()));
  }
  // Mood/aesthetic
  if (fp.aesthetic) recentMoods.add(fp.aesthetic);
  if (fp.mood) recentMoods.add(fp.mood);
}

const avoidance = {
  palettes: [...recentPalettes].slice(0, 10),
  fonts: [...recentFonts],
  accentColors: [...recentAccentColors].slice(0, 5),
  moods: [...recentMoods].slice(0, 3),
  deckCount: entries.length,
};

// Generate avoidance string
const parts = [];
if (avoidance.palettes.length > 0) {
  parts.push(`AVOID these background colors (used in recent ${avoidance.deckCount} decks): ${avoidance.palettes.join(", ")}`);
}
if (avoidance.fonts.length > 0) {
  parts.push(`AVOID these fonts (used recently): ${avoidance.fonts.join(", ")}`);
}
if (avoidance.accentColors.length > 0) {
  parts.push(`AVOID these accent colors: ${avoidance.accentColors.join(", ")}`);
}
if (avoidance.moods.length > 0) {
  parts.push(`AVOID these aesthetics: ${avoidance.moods.join(", ")}`);
}
parts.push("Find something DIFFERENT — the system needs variety.");

if (jsonMode) {
  console.log(JSON.stringify(avoidance, null, 2));
} else {
  console.log(parts.join(". "));
}
