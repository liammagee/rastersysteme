#!/usr/bin/env node
/**
 * upgrade-directives.js — convert <!-- layout: X --> + <!-- bg: Y -->
 * into <!-- design: {...} --> JSON directives with content-aware zones.
 *
 * Analyzes each slide's actual content (bullets, body, tables, images, quotes)
 * to pick the right zone roles and grid archetype.
 *
 * Usage: node upgrade-directives.js <input.composed.md> [output.composed.md]
 */

const fs = require("fs");

const input = process.argv[2];
if (!input) { console.error("Usage: node upgrade-directives.js <input.composed.md>"); process.exit(1); }
const output = process.argv[3] || input;

const md = fs.readFileSync(input, "utf8");
const slides = md.split(/\n---\n/);

// Analyze a slide's content to determine what types are present
function analyzeContent(text) {
  const clean = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```notes\n[\s\S]*?```/g, "")
    .trim();

  const lines = clean.split("\n").filter(l => l.trim());
  const result = {
    hasTitle: false, hasSubtitle: false, hasLabel: false,
    hasBullets: false, hasBody: false, hasTable: false,
    hasImages: false, hasLinks: false, hasBlockquote: false,
    bulletCount: 0, bodyCount: 0, isImageOnly: false,
  };

  let inTable = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("# ") && !t.startsWith("## ")) result.hasTitle = true;
    else if (t.startsWith("## ") && !t.startsWith("### ")) result.hasSubtitle = true;
    else if (t.startsWith("### ")) result.hasLabel = true;
    else if (/^\s*[-*]\s+/.test(line)) { result.hasBullets = true; result.bulletCount++; }
    else if (t.startsWith("|") && t.endsWith("|")) { inTable = true; result.hasTable = true; }
    else if (/^!\[/.test(t)) result.hasImages = true;
    else if (t.startsWith("> ")) result.hasBlockquote = true;
    else if (/^\[.*\]\(.*\)$/.test(t)) result.hasLinks = true;
    else if (t && !t.startsWith("```")) { result.hasBody = true; result.bodyCount++; }
  }

  result.isImageOnly = result.hasImages && !result.hasBullets && !result.hasBody && !result.hasTable && !result.hasBlockquote;
  return result;
}

// Grid archetypes
const ARCHETYPES = {
  monument:  { title: { col: 4, span: 52, row: 8, rowSpan: 12 }, body: { col: 4, span: 52, row: 22, rowSpan: 16 } },
  sidebarL:  { title: { col: 4, span: 22, row: 4, rowSpan: 10 }, body: { col: 30, span: 26, row: 4, rowSpan: 34 } },
  offsetR:   { title: { col: 30, span: 26, row: 3, rowSpan: 8 }, body: { col: 4, span: 24, row: 4, rowSpan: 34 } },
  editorial: { title: { col: 10, span: 40, row: 4, rowSpan: 10 }, body: { col: 10, span: 40, row: 16, rowSpan: 22 } },
  split:     { title: { col: 4, span: 26, row: 4, rowSpan: 10 }, body: { col: 34, span: 22, row: 4, rowSpan: 32 } },
  narrow:    { title: { col: 6, span: 20, row: 4, rowSpan: 10 }, body: { col: 6, span: 48, row: 16, rowSpan: 22 } },
};
const ARCH_ORDER = ["monument", "sidebarL", "offsetR", "editorial", "split", "narrow"];

const ACCENT_POOL = [
  { type: "bar", col: 0, span: 2, row: 0, rowSpan: 40 },
  { type: "line", col: 28, span: 1, row: 2, rowSpan: 36 },
  { type: "dot", col: 28, span: 2, row: 16, rowSpan: 2 },
  { type: "bar", col: 0, span: 60, row: 0, rowSpan: 1 },
  { type: "bar", col: 58, span: 2, row: 0, rowSpan: 40 },
  { type: "line", col: 4, span: 52, row: 14, rowSpan: 1 },
];
const ACCENT_COLORS = ["B7311A", "1B5E80", "2B7038", "876512", "D4CEC4"];
const TITLE_SIZES = [52, 36, 32, 34, 44, 38, 28, 30, 40, 42];

let archIdx = 0, accentIdx = 0, colorIdx = 0, sizeIdx = 0;

const LIGHT_BGS = ["F8F5F0", "FAFAF7", "EDE8E0", "F0EDE6", "E8E3DA"];

const upgraded = slides.map((slide, i) => {
  // If already has design directive, fix bg for light orientation
  if (/<!--\s*design:/.test(slide)) {
    const existingMatch = slide.match(/<!-- design: (\{[\s\S]*?\}) -->/);
    if (existingMatch) {
      try {
        const design = JSON.parse(existingMatch[1]);
        const eBg = (design.bg || "F8F5F0").replace(/^#/, "");
        const eR = parseInt(eBg.substring(0, 2), 16);
        const eG = parseInt(eBg.substring(2, 4), 16);
        const eB = parseInt(eBg.substring(4, 6), 16);
        const eLum = (0.299 * eR + 0.587 * eG + 0.114 * eB) / 255;
        const isDivider = i === 0 || i === 4 || i === 17 || i === slides.length - 1;
        if (eLum < 0.5 && !isDivider) {
          design.bg = LIGHT_BGS[i % LIGHT_BGS.length];
          if (design.typography) {
            if (design.typography.title) design.typography.title.color = "1A1A1A";
            if (design.typography.body) design.typography.body.color = "3A3530";
            if (design.typography.label) design.typography.label.color = "8A7F72";
          }
          return slide.replace(/<!-- design: \{[\s\S]*?\} -->/, `<!-- design: ${JSON.stringify(design)} -->`);
        }
      } catch (e) { /* skip */ }
    }
    return slide;
  }

  const bgMatch = slide.match(/<!--\s*bg:\s*([A-Fa-f0-9]{6})\s*-->/);
  const fontMatch = slide.match(/<!--\s*font:\s*([^-]+?)\s*-->/);
  if (!bgMatch && !slide.match(/<!--\s*layout:/)) return slide;

  let bg = bgMatch ? bgMatch[1] : "F8F5F0";
  const font = fontMatch ? fontMatch[1].trim() : (i % 5 === 0 ? "Georgia" : "Helvetica Neue");
  const content = analyzeContent(slide);

  // Light orientation: force most slides to light backgrounds, keep max 4 dark dividers
  const DARK_DIVIDER_BG = "1A1A1A";
  const bgR = parseInt(bg.substring(0, 2), 16);
  const bgG = parseInt(bg.substring(2, 4), 16);
  const bgB = parseInt(bg.substring(4, 6), 16);
  const originalLum = (0.299 * bgR + 0.587 * bgG + 0.114 * bgB) / 255;
  // Section dividers: slide 0 (title), ~8 (section break), ~17 (practice), ~35 (close)
  const isDivider = i === 0 || i === 4 || i === 17 || i === slides.length - 1;
  if (originalLum < 0.5 && !isDivider) {
    bg = LIGHT_BGS[i % LIGHT_BGS.length];
  } else if (originalLum < 0.5 && isDivider) {
    bg = DARK_DIVIDER_BG;
  }

  // WCAG contrast check for text colors (using final bg after light override)
  const fBgR = parseInt(bg.substring(0, 2), 16);
  const fBgG = parseInt(bg.substring(2, 4), 16);
  const fBgB = parseInt(bg.substring(4, 6), 16);
  function srgb(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function relLum(r, g, b) { return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b); }
  function contrastRatio(fg, bgLum) { return (Math.max(fg, bgLum) + 0.05) / (Math.min(fg, bgLum) + 0.05); }
  const bgLum = relLum(fBgR, fBgG, fBgB);
  const whiteLum = relLum(255, 255, 255);
  const blackLum = relLum(0, 0, 0);
  // Use white text if it has better contrast than black text
  const isDark = contrastRatio(whiteLum, bgLum) > contrastRatio(blackLum, bgLum);

  const titleColor = isDark ? "FFFFFF" : "1A1A1A";
  const bodyColor = isDark ? "F0EBE3" : "2A2520";
  const labelColor = isDark ? "D0C8B8" : "6A6052";

  const archName = ARCH_ORDER[archIdx++ % ARCH_ORDER.length];
  const arch = ARCHETYPES[archName];
  const titleSize = TITLE_SIZES[sizeIdx++ % TITLE_SIZES.length];

  // Build zones based on actual content
  const zones = [];
  if (content.hasLabel) {
    zones.push({ role: "label", col: arch.title.col, span: 16, row: 2, rowSpan: 4 });
  }
  if (content.hasTitle || content.hasSubtitle || content.hasLabel) {
    zones.push({ role: "title", ...arch.title });
  }

  // Choose the right content zone
  if (content.hasTable) {
    zones.push({ role: "table", col: arch.body.col, span: arch.body.span, row: arch.body.row, rowSpan: arch.body.rowSpan });
  } else if (content.hasBlockquote && !content.hasBullets && !content.hasBody) {
    zones.push({ role: "quote", ...arch.body });
  } else if (content.isImageOnly) {
    zones.push({ role: "image", col: 4, span: 52, row: 4, rowSpan: 32 });
  } else if (content.hasBullets || content.hasBody || content.hasBlockquote || content.hasLinks) {
    zones.push({ role: "body", ...arch.body });
  }

  // Accent (skip every 3rd slide)
  const hasAccent = i % 3 !== 2;
  const accent = hasAccent
    ? { ...ACCENT_POOL[accentIdx++ % ACCENT_POOL.length], color: ACCENT_COLORS[colorIdx++ % ACCENT_COLORS.length] }
    : null;

  const design = {
    zones,
    accents: accent ? [accent] : [],
    typography: {
      title: { size: titleSize, weight: 700, color: titleColor },
      body: { size: 14, leading: 1.6, color: bodyColor },
      label: { size: 9, weight: 700, tracking: "0.2em", transform: "uppercase", color: labelColor },
    },
    bg,
    font,
  };

  let cleaned = slide
    .replace(/<!--\s*layout:\s*\w+\s*-->\n?/g, "")
    .replace(/<!--\s*bg:\s*[A-Fa-f0-9]{6}\s*-->\n?/g, "")
    .replace(/<!--\s*font:\s*[^-]+?\s*-->\n?/g, "");

  return `<!-- design: ${JSON.stringify(design)} -->\n${cleaned.trimStart()}`;
});

fs.writeFileSync(output, upgraded.join("\n---\n"));

// Summary
const designCount = upgraded.filter(s => /<!-- design:/.test(s)).length;
console.log(`Upgraded ${designCount} slides with content-aware design directives -> ${output}`);
