#!/usr/bin/env node
/**
 * qa.js — quality assurance for rastersysteme
 *
 * Runs accessibility (WCAG 2.1 AA), design quality, and layout
 * validation checks against a markdown deck and theme.
 *
 * Usage:
 *   node qa.js <input.md> [--theme dark|light|red|blue] [--format console|html|json]
 */

const fs = require("fs");
const path = require("path");
const { parseMarkdown, createGrid, THEMES } = require("./raster.js");

// ═══════════════════════════════════════════════════════
// WCAG COLOUR UTILITIES
// ═══════════════════════════════════════════════════════

function hexToRGB(hex) {
  hex = hex.replace(/^#/, "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function sRGBtoLinear(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRGB(hex);
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG 2.1 AA thresholds
const AA_NORMAL = 4.5;  // < 18pt or < 14pt bold
const AA_LARGE = 3.0;   // >= 18pt or >= 14pt bold
const AAA_NORMAL = 7.0;
const AAA_LARGE = 4.5;

function contrastLevel(ratio) {
  if (ratio >= AAA_NORMAL) return "AAA";
  if (ratio >= AA_NORMAL) return "AA";
  if (ratio >= AA_LARGE) return "AA-large";
  return "FAIL";
}

// ═══════════════════════════════════════════════════════
// LAYOUT DETECTION (duplicated to avoid circular deps)
// ═══════════════════════════════════════════════════════

function detectLayout(slide, index, total) {
  if (slide.layout) return slide.layout;
  if (index === 0) return "title";
  if (index === total - 1 && !slide.title && slide.body.length <= 1) return "section";
  if (slide.title && slide.subtitle && slide.bullets.length === 0 &&
      slide.body.length <= 1 && slide.images.length === 0 &&
      slide.tables.length === 0 && slide.codeBlocks.length === 0) return "section";
  if (slide.images.length > 0) return "image";
  if (slide.tables.length > 0) return "table";
  if (slide.codeBlocks.length > 0) return "code";
  const topLevel = slide.bullets.filter(b => (b.level || 0) === 0).length;
  if (topLevel >= 4 && topLevel === slide.bullets.length) return "stagger";
  if (slide.bullets.length > 0) return "bullets";
  if (slide.blockquote) return "rotated";
  if (slide.title && slide.body.length > 0) return "split";
  if (slide.title) return "section";
  if (slide.links.length > 0) return "fragment";
  return "split";
}

// ═══════════════════════════════════════════════════════
// DETERMINE TEXT/BG COLOURS PER SLIDE + LAYOUT
// ═══════════════════════════════════════════════════════

function isDarkColor(hex) {
  const { r, g, b } = hexToRGB(hex);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

function getSlideColourPairs(slide, layout, theme) {
  const pairs = [];
  const bg = slide.bgOverride || (
    ["title", "section"].includes(layout) ? theme.bgDark : theme.bgAlt
  );

  // Adapt colours: section/title have dark bg by default; bgOverride may change darkness
  const bgIsDark = isDarkColor(bg);
  let textColor, textMid, textLight, labelColor;
  if (bgIsDark) {
    textColor = "F0EBE3"; textMid = "B8B0A2"; textLight = "A09890";
    labelColor = theme.accentLight || "F09080";
  } else {
    textColor = theme.text; textMid = theme.textMid; textLight = theme.textLight;
    labelColor = theme.accent;
  }

  // Title text
  if (slide.title || slide.subtitle) {
    const titleBg = ["title", "section"].includes(layout) ? bg : bg;
    const titleColor = ["title", "section"].includes(layout) ? theme.white : textColor;
    pairs.push({ element: "title", fg: titleColor, bg: titleBg, size: 28, bold: true });
  }

  // Title layout: title text on accent block
  if (layout === "title" && slide.title) {
    pairs.push({ element: "title-on-accent", fg: theme.white, bg: theme.accent, size: 34, bold: true });
  }

  // Section label
  if (slide.sectionLabel) {
    pairs.push({ element: "section-label", fg: labelColor, bg, size: 8, bold: true });
  }

  // Body text
  if (slide.body.length > 0) {
    const bodyColor = ["title"].includes(layout) ? textMid : textColor;
    pairs.push({ element: "body", fg: bodyColor, bg, size: 13, bold: false });
  }

  // Bullets
  if (slide.bullets.length > 0) {
    if (layout === "stagger") {
      // White text on accent bars
      [theme.accent, theme.accent2, theme.accent3, theme.accent4].forEach((c, i) => {
        pairs.push({ element: `stagger-bar-${i + 1}`, fg: theme.white, bg: c, size: 15, bold: true });
      });
    } else if (layout === "title") {
      // White text on accent pills
      [theme.accent2, theme.accent3, theme.accent4].forEach((c, i) => {
        pairs.push({ element: `pill-${i + 1}`, fg: theme.white, bg: c, size: 11, bold: true });
      });
    } else {
      pairs.push({ element: "bullet-text", fg: textColor, bg, size: 14, bold: false });
      if (slide.bullets.some(b => b.level > 0)) {
        pairs.push({ element: "nested-bullet", fg: textMid, bg, size: 12, bold: false });
      }
    }
  }

  // Blockquote
  if (slide.blockquote) {
    pairs.push({ element: "blockquote", fg: textMid, bg, size: 11, bold: false });
  }

  // Table header
  if (slide.tables.length > 0) {
    pairs.push({ element: "table-header", fg: theme.white, bg: theme.accent, size: 10, bold: true });
    pairs.push({ element: "table-cell", fg: textColor, bg: theme.bgAlt, size: 9, bold: false });
  }

  // Code block
  if (slide.codeBlocks.length > 0) {
    const codeBg = isDarkColor(theme.bg) ? "111111" : "2D2D2D";
    pairs.push({ element: "code", fg: "F8F8F2", bg: codeBg, size: 9, bold: false });
  }

  // Fragment cells
  if (layout === "fragment") {
    [theme.accent, theme.accent2, theme.accent3, theme.accent4, theme.black].forEach((c, i) => {
      pairs.push({ element: `fragment-cell-${i + 1}`, fg: theme.white, bg: c, size: 11, bold: true });
    });
  }

  // Overlap
  if (layout === "overlap") {
    pairs.push({ element: "overlap-text-a", fg: theme.white, bg: theme.accent, size: 13, bold: false });
    pairs.push({ element: "overlap-text-b", fg: theme.white, bg: theme.accent2, size: 13, bold: false });
  }

  // Slide number
  // Slide number uses textMid on dark layouts, textLight on light
  const slideNumColor = bgIsDark ? textMid : textLight;
  pairs.push({ element: "slide-number", fg: slideNumColor, bg, size: 8, bold: false });

  return pairs;
}

// ═══════════════════════════════════════════════════════
// ACCESSIBILITY AUDIT
// ═══════════════════════════════════════════════════════

function auditA11y(slides, theme) {
  const results = [];

  slides.forEach((slide, idx) => {
    const layout = detectLayout(slide, idx, slides.length);
    const slideNum = idx + 1;
    const pairs = getSlideColourPairs(slide, layout, theme);

    // Contrast checks
    pairs.forEach(p => {
      const ratio = contrastRatio(p.fg, p.bg);
      const isLarge = p.size >= 18 || (p.size >= 14 && p.bold);
      const threshold = isLarge ? AA_LARGE : AA_NORMAL;
      const level = contrastLevel(ratio);

      if (ratio < threshold) {
        results.push({
          slide: slideNum, layout, type: "a11y", severity: "error",
          rule: "WCAG 2.1 AA contrast",
          message: `${p.element}: #${p.fg} on #${p.bg} = ${ratio.toFixed(1)}:1 (need ${threshold}:1)`,
          ratio, threshold,
        });
      } else if (isLarge && ratio < AAA_LARGE) {
        results.push({
          slide: slideNum, layout, type: "a11y", severity: "warning",
          rule: "WCAG 2.1 AAA contrast (large)",
          message: `${p.element}: #${p.fg} on #${p.bg} = ${ratio.toFixed(1)}:1 (AAA needs ${AAA_LARGE}:1)`,
          ratio, threshold: AAA_LARGE,
        });
      }
    });

    // Image alt text
    slide.images.forEach((img, i) => {
      if (!img.alt || img.alt.trim() === "") {
        results.push({
          slide: slideNum, layout, type: "a11y", severity: "error",
          rule: "Image alt text",
          message: `Image ${i + 1} (${img.src}) has no alt text`,
        });
      }
    });

    // Heading hierarchy
    if (!slide.title && !slide.subtitle && slide.body.length === 0 &&
        slide.bullets.length > 0 && layout !== "title") {
      results.push({
        slide: slideNum, layout, type: "a11y", severity: "warning",
        rule: "Heading hierarchy",
        message: "Slide has bullets but no heading — screen readers need a heading anchor",
      });
    }

    // Minimum font size
    pairs.forEach(p => {
      if (p.size < 8) {
        results.push({
          slide: slideNum, layout, type: "a11y", severity: "error",
          rule: "Minimum text size",
          message: `${p.element} at ${p.size}pt is below 8pt minimum`,
        });
      }
    });

    // Colour-only information
    if (layout === "fragment" && slide.bullets.length > 5) {
      results.push({
        slide: slideNum, layout, type: "a11y", severity: "warning",
        rule: "Colour-only information",
        message: "Fragment layout uses colour to distinguish cells — consider adding numbering or icons",
      });
    }
  });

  // Deck-level checks
  const hasNotes = slides.filter(s => s.notes).length;
  if (hasNotes > 0 && hasNotes < slides.length) {
    results.push({
      slide: 0, layout: "deck", type: "a11y", severity: "warning",
      rule: "Inconsistent notes",
      message: `${hasNotes}/${slides.length} slides have speaker notes — consider adding notes to all slides`,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════
// DESIGN QUALITY SCORING
// ═══════════════════════════════════════════════════════

function scoreDesign(slides) {
  const total = slides.length;
  const scores = {};

  // 1. Layout variety (0–20)
  const layouts = slides.map((s, i) => detectLayout(s, i, total));
  const uniqueLayouts = new Set(layouts).size;
  const layoutEntropy = Math.min(uniqueLayouts / Math.min(total, 13), 1);
  scores.layoutVariety = { score: Math.round(layoutEntropy * 20), max: 20,
    detail: `${uniqueLayouts} unique layouts across ${total} slides` };

  // Penalise if same layout used more than 40% of time (excluding section)
  const layoutCounts = {};
  layouts.forEach(l => { layoutCounts[l] = (layoutCounts[l] || 0) + 1; });
  const nonSectionMax = Math.max(...Object.entries(layoutCounts)
    .filter(([l]) => l !== "section").map(([, c]) => c), 0);
  if (nonSectionMax / total > 0.4) {
    scores.layoutVariety.score = Math.max(0, scores.layoutVariety.score - 5);
    scores.layoutVariety.detail += ` (repetitive: one layout used ${nonSectionMax}x)`;
  }

  // 2. Section rhythm (0–15)
  const sectionSlides = layouts.filter(l => l === "section").length;
  const idealSections = Math.max(2, Math.floor(total / 6));
  const sectionRatio = Math.min(sectionSlides / idealSections, 1.5);
  const sectionScore = sectionRatio <= 1 ? Math.round(sectionRatio * 15) :
    Math.round(15 - (sectionRatio - 1) * 10);
  scores.sectionRhythm = { score: Math.max(0, sectionScore), max: 15,
    detail: `${sectionSlides} section dividers (ideal ~${idealSections})` };

  // 3. Content density (0–15)
  const densities = slides.map(s => {
    let d = 0;
    if (s.title) d++;
    if (s.subtitle) d++;
    if (s.sectionLabel) d++;
    d += Math.min(s.bullets.length, 8);
    d += s.body.length;
    if (s.blockquote) d++;
    d += s.tables.length * 3;
    d += s.codeBlocks.length * 2;
    d += s.images.length;
    return d;
  });
  const avgDensity = densities.reduce((a, b) => a + b, 0) / total;
  const densityVariance = densities.reduce((a, d) => a + Math.pow(d - avgDensity, 2), 0) / total;
  const goodDensity = avgDensity >= 2 && avgDensity <= 8;
  const goodVariance = densityVariance > 2; // some variation is good
  scores.contentDensity = { score: (goodDensity ? 10 : 5) + (goodVariance ? 5 : 0), max: 15,
    detail: `avg ${avgDensity.toFixed(1)} elements/slide, variance ${densityVariance.toFixed(1)}` };

  // 4. Typography hierarchy (0–15)
  const hasHeading = slides.filter(s => s.title || s.subtitle).length;
  const headingRatio = hasHeading / total;
  scores.typography = { score: Math.round(headingRatio * 15), max: 15,
    detail: `${hasHeading}/${total} slides have a heading` };

  // 5. Speaker notes (0–10)
  const hasNotes = slides.filter(s => s.notes).length;
  scores.speakerNotes = { score: Math.round((hasNotes / total) * 10), max: 10,
    detail: `${hasNotes}/${total} slides have notes` };

  // 6. Content type diversity (0–10)
  const hasTable = slides.some(s => s.tables.length > 0);
  const hasCode = slides.some(s => s.codeBlocks.length > 0);
  const hasImage = slides.some(s => s.images.length > 0);
  const hasQuote = slides.some(s => s.blockquote);
  const hasNested = slides.some(s => s.bullets.some(b => b.level > 0));
  const typeCount = [hasTable, hasCode, hasImage, hasQuote, hasNested].filter(Boolean).length;
  scores.contentTypes = { score: Math.round((typeCount / 5) * 10), max: 10,
    detail: `${typeCount}/5 content types used (table, code, image, quote, nesting)` };

  // 7. Visual rhythm (0–15) — alternation of light/dark/coloured slides
  let transitions = 0;
  for (let i = 1; i < layouts.length; i++) {
    const prev = layouts[i - 1];
    const curr = layouts[i];
    if (prev !== curr) transitions++;
  }
  const transitionRatio = transitions / Math.max(total - 1, 1);
  scores.visualRhythm = { score: Math.round(transitionRatio * 15), max: 15,
    detail: `${transitions}/${total - 1} layout transitions (${(transitionRatio * 100).toFixed(0)}% variety)` };

  // Total
  const totalScore = Object.values(scores).reduce((a, s) => a + s.score, 0);
  const maxScore = Object.values(scores).reduce((a, s) => a + s.max, 0);

  return { scores, totalScore, maxScore };
}

// ═══════════════════════════════════════════════════════
// LAYOUT VALIDATION
// ═══════════════════════════════════════════════════════

function validateLayouts(slides) {
  const results = [];
  const total = slides.length;

  slides.forEach((slide, idx) => {
    const layout = detectLayout(slide, idx, total);
    const slideNum = idx + 1;

    // Empty slide
    const hasContent = slide.title || slide.subtitle || slide.body.length > 0 ||
      slide.bullets.length > 0 || slide.blockquote || slide.tables.length > 0 ||
      slide.codeBlocks.length > 0 || slide.images.length > 0;
    if (!hasContent && layout !== "blank") {
      results.push({ slide: slideNum, layout, severity: "error",
        message: "Empty slide — no content detected" });
    }

    // Background-accent colour clash (e.g. red bg on title layout with red accent block)
    if (slide.bgOverride && (layout === "title" || layout === "stagger" || layout === "fragment")) {
      const bg = slide.bgOverride.replace(/^#/, "").toUpperCase();
      const acc = theme.accent.toUpperCase();
      const bgR = parseInt(bg.slice(0, 2), 16), bgG = parseInt(bg.slice(2, 4), 16), bgB = parseInt(bg.slice(4, 6), 16);
      const accR = parseInt(acc.slice(0, 2), 16), accG = parseInt(acc.slice(2, 4), 16), accB = parseInt(acc.slice(4, 6), 16);
      const dist = Math.sqrt(Math.pow(bgR - accR, 2) + Math.pow(bgG - accG, 2) + Math.pow(bgB - accB, 2));
      if (dist < 80) {
        results.push({ slide: slideNum, layout, severity: "warning",
          message: `bg #${bg} too close to accent #${acc} — accent elements invisible` });
      }
    }

    // Overflow risks
    if (slide.bullets.length > 8 && layout === "stagger") {
      results.push({ slide: slideNum, layout, severity: "warning",
        message: `Stagger with ${slide.bullets.length} items may overflow` });
    }
    if (slide.bullets.length > 6 && layout === "bullets") {
      results.push({ slide: slideNum, layout, severity: "warning",
        message: `Dense bullets (${slide.bullets.length}) — consider stagger or split` });
    }
    if (slide.tables.length > 0 && slide.tables[0].rows.length > 10) {
      results.push({ slide: slideNum, layout, severity: "warning",
        message: `Table has ${slide.tables[0].rows.length} rows — may overflow` });
    }
    if (slide.codeBlocks.length > 0 && slide.codeBlocks[0].code.split("\n").length > 20) {
      results.push({ slide: slideNum, layout, severity: "warning",
        message: `Code block has ${slide.codeBlocks[0].code.split("\n").length} lines — may clip` });
    }
    if (slide.title && slide.title.length > 50) {
      results.push({ slide: slideNum, layout, severity: "warning",
        message: `Long title (${slide.title.length} chars) — may overflow` });
    }

    // Fragment limit
    if (layout === "fragment") {
      const items = slide.bullets.length + slide.links.length;
      if (items > 9) {
        results.push({ slide: slideNum, layout, severity: "error",
          message: `Fragment max 9 cells — ${items} items will be clipped` });
      }
    }

    // Missing image files
    slide.images.forEach(img => {
      if (!img.src) {
        results.push({ slide: slideNum, layout, severity: "error",
          message: "Image with empty src" });
      }
    });

    // Directive conflicts
    if (slide.layout && slide.layout === "blank" && hasContent) {
      results.push({ slide: slideNum, layout, severity: "warning",
        message: "Forced blank layout but slide has content — content will be hidden" });
    }
  });

  return results;
}

// ═══════════════════════════════════════════════════════
// CONSOLE REPORT
// ═══════════════════════════════════════════════════════

function printConsoleReport(inputPath, themeName, a11yResults, layoutResults, design) {
  const hr = "\u2550".repeat(56);
  const slides = design.totalScore; // not really, just for header
  console.log();
  console.log(hr);
  console.log("  QA Report: " + path.basename(inputPath));
  console.log("  Theme: " + themeName);
  console.log(hr);

  // A11y
  const a11yErrors = a11yResults.filter(r => r.severity === "error");
  const a11yWarnings = a11yResults.filter(r => r.severity === "warning");
  console.log();
  console.log("  ACCESSIBILITY (WCAG 2.1)");
  console.log("  " + "\u2500".repeat(40));
  if (a11yErrors.length === 0 && a11yWarnings.length === 0) {
    console.log("  \u2714 All checks pass");
  }
  a11yErrors.forEach(r => {
    const loc = r.slide > 0 ? `Slide ${String(r.slide).padStart(2, "0")} [${r.layout}]` : "Deck";
    console.log(`  \u2716 ${loc}: ${r.message}`);
  });
  a11yWarnings.forEach(r => {
    const loc = r.slide > 0 ? `Slide ${String(r.slide).padStart(2, "0")} [${r.layout}]` : "Deck";
    console.log(`  \u26A0 ${loc}: ${r.message}`);
  });
  console.log(`  ${a11yErrors.length} errors, ${a11yWarnings.length} warnings`);

  // Layout
  const layoutErrors = layoutResults.filter(r => r.severity === "error");
  const layoutWarnings = layoutResults.filter(r => r.severity === "warning");
  console.log();
  console.log("  LAYOUT VALIDATION");
  console.log("  " + "\u2500".repeat(40));
  if (layoutErrors.length === 0 && layoutWarnings.length === 0) {
    console.log("  \u2714 All checks pass");
  }
  layoutErrors.forEach(r => {
    console.log(`  \u2716 Slide ${String(r.slide).padStart(2, "0")} [${r.layout}]: ${r.message}`);
  });
  layoutWarnings.forEach(r => {
    console.log(`  \u26A0 Slide ${String(r.slide).padStart(2, "0")} [${r.layout}]: ${r.message}`);
  });

  // Design quality
  console.log();
  console.log("  DESIGN QUALITY");
  console.log("  " + "\u2500".repeat(40));
  const { scores, totalScore, maxScore } = design;
  for (const [key, s] of Object.entries(scores)) {
    const name = key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).padEnd(20);
    const bar = "\u2588".repeat(Math.round(s.score / s.max * 10)) +
                "\u2591".repeat(10 - Math.round(s.score / s.max * 10));
    console.log(`  ${bar} ${String(s.score).padStart(2)}/${s.max}  ${name} ${s.detail}`);
  }
  console.log();
  const pct = Math.round(totalScore / maxScore * 100);
  const grade = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
  console.log(`  SCORE: ${totalScore}/${maxScore} (${pct}%) — Grade ${grade}`);
  console.log();
}

// ═══════════════════════════════════════════════════════
// JSON REPORT
// ═══════════════════════════════════════════════════════

function generateJSONReport(inputPath, themeName, a11yResults, layoutResults, design, slides) {
  return JSON.stringify({
    file: path.basename(inputPath),
    theme: themeName,
    slides: slides.length,
    timestamp: new Date().toISOString(),
    accessibility: {
      errors: a11yResults.filter(r => r.severity === "error").length,
      warnings: a11yResults.filter(r => r.severity === "warning").length,
      results: a11yResults,
    },
    layout: {
      errors: layoutResults.filter(r => r.severity === "error").length,
      warnings: layoutResults.filter(r => r.severity === "warning").length,
      results: layoutResults,
    },
    design: design,
  }, null, 2);
}

// ═══════════════════════════════════════════════════════
// HTML REPORT
// ═══════════════════════════════════════════════════════

function generateHTMLReport(inputPath, themeName, a11yResults, layoutResults, design, slides) {
  const { scores, totalScore, maxScore } = design;
  const pct = Math.round(totalScore / maxScore * 100);
  const grade = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
  const gradeColor = grade === "A" ? "#2A7A4B" : grade === "B" ? "#4A90D9" :
    grade === "C" ? "#F2C12E" : "#E63222";

  const a11yErrors = a11yResults.filter(r => r.severity === "error");
  const a11yWarnings = a11yResults.filter(r => r.severity === "warning");
  const layoutErrors = layoutResults.filter(r => r.severity === "error");
  const layoutWarnings = layoutResults.filter(r => r.severity === "warning");

  function issueRow(r) {
    const icon = r.severity === "error" ? "\u2716" : "\u26A0";
    const cls = r.severity === "error" ? "err" : "warn";
    const loc = r.slide > 0 ? `Slide ${String(r.slide).padStart(2, "0")} <span class="layout">${r.layout}</span>` : "Deck";
    const rule = r.rule ? `<span class="rule">${r.rule}</span>` : "";
    return `<tr class="${cls}"><td>${icon}</td><td>${loc}</td><td>${rule}</td><td>${r.message}</td></tr>`;
  }

  function scoreBar(s) {
    const pct = Math.round(s.score / s.max * 100);
    const color = pct >= 80 ? "#2A7A4B" : pct >= 60 ? "#F2C12E" : "#E63222";
    return `<div class="score-row">
      <div class="score-bar-bg"><div class="score-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="score-val">${s.score}/${s.max}</span>
      <span class="score-detail">${s.detail}</span>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QA: ${path.basename(inputPath)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#ccc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;padding:24px 32px;max-width:1100px;margin:0 auto}
h1{font-size:20px;color:#fff;margin-bottom:4px}
h2{font-size:14px;color:#888;margin-bottom:16px;font-weight:400}
h3{font-size:13px;color:#fff;text-transform:uppercase;letter-spacing:0.15em;margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid #333}
.grade{display:inline-block;font-size:48px;font-weight:700;color:${gradeColor};margin:16px 0}
.summary{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0 24px}
.stat{background:#1a1a1a;padding:6px 14px;border-radius:4px;font-size:12px}
.stat.err{color:#E63222}.stat.warn{color:#F2C12E}.stat.ok{color:#2A7A4B}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
td{padding:5px 10px;border-bottom:1px solid #222;vertical-align:top}
tr.err td:first-child{color:#E63222}
tr.warn td:first-child{color:#F2C12E}
.layout{background:#222;padding:1px 6px;border-radius:2px;font-size:10px;color:var(--accent,#E63222);font-family:monospace}
.rule{background:#1a1a1a;padding:1px 6px;border-radius:2px;font-size:10px;color:#888}
.score-row{display:flex;align-items:center;gap:12px;margin:6px 0}
.score-bar-bg{width:200px;height:8px;background:#222;border-radius:4px;overflow:hidden;flex-shrink:0}
.score-bar-fill{height:100%;border-radius:4px;transition:width 0.3s}
.score-val{font-size:12px;font-weight:700;color:#fff;width:40px;text-align:right;flex-shrink:0}
.score-detail{font-size:11px;color:#888}
.pass{color:#2A7A4B}
</style></head>
<body>
<h1>QA Report: ${path.basename(inputPath)}</h1>
<h2>Theme: ${themeName} &middot; ${slides.length} slides &middot; ${new Date().toLocaleDateString()}</h2>
<div class="grade">${grade}</div> <span style="font-size:20px;color:#888">${totalScore}/${maxScore} (${pct}%)</span>

<div class="summary">
  <span class="stat">${slides.length} slides</span>
  <span class="stat ${a11yErrors.length ? 'err' : 'ok'}">${a11yErrors.length} a11y errors</span>
  <span class="stat ${a11yWarnings.length ? 'warn' : 'ok'}">${a11yWarnings.length} a11y warnings</span>
  <span class="stat ${layoutErrors.length ? 'err' : 'ok'}">${layoutErrors.length} layout errors</span>
  <span class="stat ${layoutWarnings.length ? 'warn' : 'ok'}">${layoutWarnings.length} layout warnings</span>
</div>

<h3>Accessibility (WCAG 2.1)</h3>
${(a11yErrors.length + a11yWarnings.length) === 0 ? '<p class="pass">\u2714 All checks pass</p>' :
  `<table>${[...a11yErrors, ...a11yWarnings].map(issueRow).join("")}</table>`}

<h3>Layout Validation</h3>
${(layoutErrors.length + layoutWarnings.length) === 0 ? '<p class="pass">\u2714 All checks pass</p>' :
  `<table>${[...layoutErrors, ...layoutWarnings].map(issueRow).join("")}</table>`}

<h3>Design Quality</h3>
${Object.entries(scores).map(([key, s]) => {
  const name = key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
  return `<div style="margin-bottom:2px"><span style="color:#fff;font-size:12px;display:inline-block;width:150px">${name}</span>${scoreBar(s)}</div>`;
}).join("")}

</body></html>`;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

function runQA(inputPath, options = {}) {
  const themeName = options.theme || "light";
  const theme = THEMES[themeName] || THEMES.light;
  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);

  const a11yResults = auditA11y(slides, theme);
  const layoutResults = validateLayouts(slides);
  const design = scoreDesign(slides);

  return { slides, a11yResults, layoutResults, design, themeName };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  qa — quality assurance for rastersysteme

  Usage:
    node qa.js <input.md> [options]

  Options:
    --theme <name>    Theme to audit: light (default), dark, red, blue
    --format <f>      Output: console (default), html, json
    --out <path>      Write report to file (html/json formats)
    --help            Show this help

  Checks:
    Accessibility     WCAG 2.1 AA colour contrast, alt text, heading
                      hierarchy, minimum font size, colour-only info
    Layout            Overflow risk, empty slides, fragment limits,
                      directive conflicts, content density
    Design quality    Layout variety, section rhythm, content density,
                      typography hierarchy, speaker notes, content
                      types, visual rhythm
    `);
    process.exit(0);
  }

  const input = args[0];
  const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const themeName = getFlag("--theme") || "light";
  const format = getFlag("--format") || "console";
  const outPath = getFlag("--out");

  if (!fs.existsSync(input)) {
    console.error("Error: File not found: " + input);
    process.exit(1);
  }

  const { slides, a11yResults, layoutResults, design } = runQA(input, { theme: themeName });

  if (format === "json") {
    const json = generateJSONReport(input, themeName, a11yResults, layoutResults, design, slides);
    if (outPath) { fs.writeFileSync(outPath, json); console.log("Written to " + outPath); }
    else console.log(json);
  } else if (format === "html") {
    const html = generateHTMLReport(input, themeName, a11yResults, layoutResults, design, slides);
    const dest = outPath || input.replace(/\.md$/, ".qa.html");
    fs.writeFileSync(dest, html);
    console.log("QA report: " + dest);
  } else {
    printConsoleReport(input, themeName, a11yResults, layoutResults, design);
  }

  // Exit code: 1 if any errors
  const totalErrors = a11yResults.filter(r => r.severity === "error").length +
    layoutResults.filter(r => r.severity === "error").length;
  if (totalErrors > 0) process.exit(1);
}

// ═══════════════════════════════════════════════════════
// INTENSITY COMPLIANCE CHECKER
// ═══════════════════════════════════════════════════════

const INTENSITY_RULES = {
  minimal: {
    maxBgPct: 30,
    maxFonts: 0,
    blankSlides: [0, 0],
    maxSingleLayoutPct: 25,
    minLayoutTypes: 0,
    splitMaxPct: 25,
    requiredLayouts: {},
    slideCountMatch: true, // must equal source slide count
  },
  moderate: {
    minBgPct: 30, maxBgPct: 60,
    maxFonts: Infinity, minFonts: 1,
    blankSlides: [0, 0],
    maxSingleLayoutPct: 30,
    minLayoutTypes: 5,
    splitMaxPct: 30,
    requiredLayouts: {},
    slideCountMatch: true,
  },
  maximal: {
    minBgPct: 50, maxBgPct: 80,
    maxFonts: Infinity, minFonts: 3,
    blankSlides: [0, 0],
    maxSingleLayoutPct: 20,
    minLayoutTypes: 8,
    splitMaxPct: 15,
    requiredLayouts: { stagger: 2, rotated: 2, fragment: 1, overlap: 1 },
    slideCountMatch: true,
  },
};

function validateIntensity(slides, intensity, sourceSlideCount) {
  const rules = INTENSITY_RULES[intensity];
  if (!rules) return [];
  const results = [];
  const total = slides.length;
  const warn = (msg) => results.push({ severity: "warning", rule: "intensity", message: msg });
  const fail = (msg) => results.push({ severity: "error", rule: "intensity", message: msg });

  // Slide count must match source
  if (rules.slideCountMatch && sourceSlideCount && total !== sourceSlideCount) {
    fail(`${intensity}: output has ${total} slides, source has ${sourceSlideCount} — must be equal`);
  }

  // Layout distribution
  const layoutCounts = {};
  slides.forEach((slide, idx) => {
    const layout = detectLayout(slide, idx, total);
    layoutCounts[layout] = (layoutCounts[layout] || 0) + 1;
  });

  // Unique layout types
  const uniqueLayouts = Object.keys(layoutCounts).length;
  if (rules.minLayoutTypes && uniqueLayouts < rules.minLayoutTypes) {
    fail(`${intensity}: ${uniqueLayouts} layout types used, need ≥${rules.minLayoutTypes}`);
  }

  // Max single layout %
  for (const [layout, count] of Object.entries(layoutCounts)) {
    const pct = (count / total) * 100;
    if (layout === "blank") continue; // blank is structural, not content
    if (pct > rules.maxSingleLayoutPct) {
      fail(`${intensity}: "${layout}" used ${count}× (${pct.toFixed(0)}%), max ${rules.maxSingleLayoutPct}%`);
    }
  }

  // Split cap
  if (rules.splitMaxPct) {
    const splitPct = ((layoutCounts.split || 0) / total) * 100;
    if (splitPct > rules.splitMaxPct) {
      warn(`${intensity}: "split" at ${splitPct.toFixed(0)}%, max ${rules.splitMaxPct}%`);
    }
  }

  // Required layouts
  for (const [layout, minCount] of Object.entries(rules.requiredLayouts || {})) {
    const actual = layoutCounts[layout] || 0;
    if (actual < minCount) {
      fail(`${intensity}: "${layout}" used ${actual}×, need ≥${minCount}`);
    }
  }

  // Blank slides
  const blanks = layoutCounts.blank || 0;
  const [minBlanks, maxBlanks] = rules.blankSlides;
  if (blanks < minBlanks) {
    warn(`${intensity}: ${blanks} blank slides, need ≥${minBlanks}`);
  }
  if (blanks > maxBlanks) {
    warn(`${intensity}: ${blanks} blank slides, max ${maxBlanks}`);
  }

  // Bg overrides
  const bgCount = slides.filter(s => s.bgOverride).length;
  const bgPct = (bgCount / total) * 100;
  if (rules.maxBgPct !== undefined && bgPct > rules.maxBgPct) {
    warn(`${intensity}: bg overrides on ${bgPct.toFixed(0)}% of slides, max ${rules.maxBgPct}%`);
  }
  if (rules.minBgPct !== undefined && bgPct < rules.minBgPct) {
    warn(`${intensity}: bg overrides on ${bgPct.toFixed(0)}% of slides, need ≥${rules.minBgPct}%`);
  }

  // Font overrides
  const fontCount = slides.filter(s => s.fontOverride).length;
  if (rules.maxFonts !== undefined && fontCount > rules.maxFonts) {
    fail(`${intensity}: ${fontCount} font overrides, max ${rules.maxFonts}`);
  }
  if (rules.minFonts !== undefined && fontCount < rules.minFonts) {
    warn(`${intensity}: ${fontCount} font overrides, need ≥${rules.minFonts}`);
  }

  // No 3× consecutive same layout
  let streak = 1;
  for (let i = 1; i < total; i++) {
    const prev = detectLayout(slides[i - 1], i - 1, total);
    const curr = detectLayout(slides[i], i, total);
    if (curr === prev) {
      streak++;
      if (streak >= 3) {
        fail(`${intensity}: "${curr}" used 3× in a row at slides ${i - 1}–${i + 1}`);
        break;
      }
    } else {
      streak = 1;
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════
// CONTENT PRESERVATION VALIDATION
// ═══════════════════════════════════════════════════════

function extractTokens(md) {
  const urls = [...new Set((md.match(/https?:\/\/[^\s)>\]]+/g) || []))];
  const emails = [...new Set((md.match(/[\w.+-]+@[\w.-]+\.\w+/g) || []))];
  const percentages = [...new Set((md.match(/\b\d+%/g) || []))];
  return { urls, emails, percentages };
}

function validateContentPreservation(sourceMd, composedMd) {
  const results = [];
  // Strip HTML comments (DESIGN PLAN etc) before counting slides
  const stripComments = (md) => md.replace(/<!--[\s\S]*?-->/g, "");
  const sourceSlides = stripComments(sourceMd).split(/\n---\n/).filter(s => s.trim());
  const composedSlides = stripComments(composedMd).split(/\n---\n/).filter(s => s.trim());

  // Slide count must match exactly
  const sourceCount = sourceSlides.length;
  const composedCount = composedSlides.length;
  if (composedCount !== sourceCount) {
    results.push({
      severity: "error",
      check: "slideCount",
      message: `Slide count mismatch: source has ${sourceCount}, composed has ${composedCount}`,
    });
  }

  // Token preservation
  const srcTokens = extractTokens(sourceMd);
  const compTokens = extractTokens(composedMd);

  for (const url of srcTokens.urls) {
    if (!composedMd.includes(url)) {
      results.push({
        severity: "error",
        check: "urlPreservation",
        message: `URL missing from output: ${url.slice(0, 60)}`,
      });
    }
  }

  for (const email of srcTokens.emails) {
    if (!composedMd.includes(email)) {
      results.push({
        severity: "error",
        check: "emailPreservation",
        message: `Email missing from output: ${email}`,
      });
    }
  }

  for (const pct of srcTokens.percentages) {
    if (!composedMd.includes(pct)) {
      results.push({
        severity: "warning",
        check: "percentagePreservation",
        message: `Percentage missing from output: ${pct}`,
      });
    }
  }

  // Speaker notes preservation
  const sourceNotes = (sourceMd.match(/```notes\n([\s\S]*?)```/g) || []);
  const composedNotes = (composedMd.match(/```notes\n([\s\S]*?)```/g) || []);
  if (sourceNotes.length > composedNotes.length) {
    results.push({
      severity: "warning",
      check: "notesPreservation",
      message: `Speaker notes blocks: source has ${sourceNotes.length}, composed has ${composedNotes.length}`,
    });
  }

  // No invention check — URLs in composed that aren't in source
  for (const url of compTokens.urls) {
    if (!srcTokens.urls.includes(url)) {
      results.push({
        severity: "warning",
        check: "noInvention",
        message: `URL in output not found in source: ${url.slice(0, 60)}`,
      });
    }
  }

  // Slide directive check — each slide needs either <!-- design: or <!-- layout:
  const layoutDirectives = composedMd.match(/<!-- layout: \w+ -->/g) || [];
  const designDirectives = composedMd.match(/<!-- design:/g) || [];
  const totalDirectives = layoutDirectives.length + designDirectives.length;
  if (totalDirectives < composedCount) {
    results.push({
      severity: "error",
      check: "layoutDirectives",
      message: `Only ${totalDirectives} slide directives (layout+design) for ${composedCount} slides`,
    });
  }

  // Valid layout names (only for layout directives, design directives are freeform)
  const validLayouts = new Set(["title", "section", "bullets", "stagger", "split", "rotated", "fragment", "overlap", "arc", "image", "table", "code", "blank"]);
  for (const d of layoutDirectives) {
    const name = d.match(/<!-- layout: (\w+) -->/)[1];
    if (!validLayouts.has(name)) {
      results.push({
        severity: "error",
        check: "layoutValidity",
        message: `Invalid layout name: ${name}`,
      });
    }
  }

  // No 3x consecutive same layout (only applies to layout directives, not design)
  const layouts = layoutDirectives.map(d => d.match(/<!-- layout: (\w+) -->/)[1]);
  for (let i = 2; i < layouts.length; i++) {
    if (layouts[i] === layouts[i-1] && layouts[i] === layouts[i-2]) {
      results.push({
        severity: "warning",
        check: "layoutRepetition",
        message: `Layout "${layouts[i]}" appears 3+ times consecutively at slides ${i-1}-${i+1}`,
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════
// DESIGN DIRECTIVE ADOPTION VALIDATION
// ═══════════════════════════════════════════════════════

function validateDirectiveAdoption(composedMd, intensity) {
  const results = [];
  const slides = composedMd.split(/\n---\n/).filter(s => s.trim());
  const total = slides.length;
  if (total === 0) return results;

  const warn = (msg) => results.push({ severity: "warning", check: "directive", message: msg });
  const fail = (msg) => results.push({ severity: "error", check: "directive", message: msg });

  // Count directive types per slide
  let withLayout = 0;
  let withBg = 0;
  let withFont = 0;
  let withLabel = 0;
  let withDesign = 0;
  let withNone = 0;

  const layouts = [];
  const bgs = [];
  const fonts = new Set();

  slides.forEach((slide, i) => {
    const hasLayout = /<!-- layout: \w+ -->/.test(slide);
    const hasDesign = /<!-- design:/.test(slide);
    const hasBg = /<!-- bg: [A-Fa-f0-9]+ -->/.test(slide);
    const hasFont = /<!-- font: .+ -->/.test(slide);
    const hasLabel = /^### .+/m.test(slide);

    if (hasLayout) withLayout++;
    if (hasDesign) withDesign++;
    if (hasBg) withBg++;
    if (hasFont) withFont++;
    if (hasLabel) withLabel++;
    if (!hasLayout && !hasDesign) withNone++;

    const layoutMatch = slide.match(/<!-- layout: (\w+) -->/);
    if (layoutMatch) layouts.push(layoutMatch[1]);

    const bgMatch = slide.match(/<!-- bg: ([A-Fa-f0-9]+) -->/);
    if (bgMatch) bgs.push(bgMatch[1]);

    const fontMatch = slide.match(/<!-- font: ([^->]+?) -->/);
    if (fontMatch) fonts.add(fontMatch[1].trim());
  });

  // 1. Every slide must have a layout or design directive
  if (withNone > 0) {
    fail(`${withNone}/${total} slides have NO layout or design directive`);
  }

  // 2. Layout variety
  const uniqueLayouts = new Set(layouts);
  const layoutCounts = {};
  layouts.forEach(l => layoutCounts[l] = (layoutCounts[l] || 0) + 1);

  const rules = {
    minimal: { minTypes: 3, maxPct: 35, minBgPct: 0, maxBgPct: 30 },
    moderate: { minTypes: 5, maxPct: 30, minBgPct: 25, maxBgPct: 70 },
    maximal: { minTypes: 7, maxPct: 25, minBgPct: 40, maxBgPct: 85 },
  };
  const rule = rules[intensity] || rules.moderate;

  if (uniqueLayouts.size < rule.minTypes) {
    warn(`Layout variety: ${uniqueLayouts.size} types used (${intensity} needs ${rule.minTypes}+). Used: ${[...uniqueLayouts].join(", ")}`);
  }

  // 3. No layout dominates
  for (const [layout, count] of Object.entries(layoutCounts)) {
    const pct = (count / total * 100).toFixed(0);
    if (count / total > rule.maxPct / 100) {
      warn(`Layout "${layout}" used ${count}× (${pct}%) — ${intensity} caps at ${rule.maxPct}%`);
    }
  }

  // 4. No 3× consecutive same layout
  for (let i = 2; i < layouts.length; i++) {
    if (layouts[i] === layouts[i-1] && layouts[i] === layouts[i-2]) {
      warn(`Layout "${layouts[i]}" appears 3× consecutively at slides ${i-1}–${i+1}`);
    }
  }

  // 5. Background override usage
  const bgPct = (withBg / total * 100).toFixed(0);
  if (withBg / total < rule.minBgPct / 100 && rule.minBgPct > 0) {
    warn(`Bg overrides: ${bgPct}% (${intensity} wants ${rule.minBgPct}–${rule.maxBgPct}%)`);
  }
  if (withBg / total > rule.maxBgPct / 100) {
    warn(`Bg overrides: ${bgPct}% exceeds ${intensity} max of ${rule.maxBgPct}%`);
  }

  // 6. Palette diversity
  const uniqueBgs = new Set(bgs);
  if (uniqueBgs.size > 0 && uniqueBgs.size < 3 && intensity !== "minimal") {
    warn(`Palette: only ${uniqueBgs.size} unique bg colors. Consider more variety.`);
  }

  // 7. Chromatic arc — check for monotony (same bg repeated)
  let maxConsecutiveBg = 1;
  let currentStreak = 1;
  for (let i = 1; i < bgs.length; i++) {
    if (bgs[i] === bgs[i-1]) {
      currentStreak++;
      maxConsecutiveBg = Math.max(maxConsecutiveBg, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  if (maxConsecutiveBg >= 4) {
    warn(`Same bg color used ${maxConsecutiveBg}× consecutively — breaks the chromatic arc`);
  }

  // 7b. Chromatic arc — detect batch boundary jumps
  // A "jump" is where the bg color changes abruptly with no transitional slides
  // This typically happens at batch boundaries in incremental compose
  const allBgs = slides.map(slide => {
    const m = slide.match(/<!-- bg: ([A-Fa-f0-9]+) -->/);
    return m ? m[1] : null;
  });
  for (let i = 1; i < allBgs.length; i++) {
    if (allBgs[i] && allBgs[i-1] && allBgs[i] !== allBgs[i-1]) {
      // Calculate color distance
      const a = allBgs[i-1], b = allBgs[i];
      const dr = parseInt(a.slice(0,2),16) - parseInt(b.slice(0,2),16);
      const dg = parseInt(a.slice(2,4),16) - parseInt(b.slice(2,4),16);
      const db = parseInt(a.slice(4,6),16) - parseInt(b.slice(4,6),16);
      const dist = Math.sqrt(dr*dr + dg*dg + db*db);
      if (dist > 300) {
        warn(`Abrupt color jump at slide ${i+1}: #${a} → #${b} (distance ${Math.round(dist)}) — possible batch boundary`);
      }
    }
  }

  // 8. Label adoption
  const labelPct = (withLabel / total * 100).toFixed(0);
  const labelExpected = { minimal: 10, moderate: 40, maximal: 55 };
  if (withLabel / total < (labelExpected[intensity] || 30) / 100) {
    warn(`### labels on ${labelPct}% of slides (${intensity} expects ${labelExpected[intensity]}%+)`);
  }

  // 9. Font variety (moderate+ should use at least 1 override)
  if (intensity !== "minimal" && fonts.size === 0) {
    warn(`No font overrides — ${intensity} expects typographic contrast`);
  }

  // 10. "split" overuse — the most common generic layout
  const splitCount = layoutCounts["split"] || 0;
  const splitPct = (splitCount / total * 100).toFixed(0);
  const splitMax = { minimal: 40, moderate: 30, maximal: 20 };
  if (splitCount / total > (splitMax[intensity] || 30) / 100) {
    warn(`"split" used ${splitCount}× (${splitPct}%) — ${intensity} caps at ${splitMax[intensity]}%. Try stagger, rotated, fragment, overlap.`);
  }

  // Summary
  if (results.length === 0) {
    results.push({
      severity: "info",
      check: "directive",
      message: `✓ All checks pass: ${uniqueLayouts.size} layout types, ${bgPct}% bg overrides, ${labelPct}% labels, ${fonts.size} font overrides`,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════
// SOURCE VALIDATION — catch issues BEFORE composing
// ═══════════════════════════════════════════════════════

function validateSource(md) {
  const results = [];
  const warn = (msg) => results.push({ severity: "warning", check: "source", message: msg });
  const fail = (msg) => results.push({ severity: "error", check: "source", message: msg });

  // 1. Unclosed HTML comments (<!-- without matching -->)
  const opens = (md.match(/<!--/g) || []).length;
  const closes = (md.match(/-->/g) || []).length;
  if (opens !== closes) {
    fail(`Unbalanced HTML comments: ${opens} opens, ${closes} closes — will leak into rendered slides`);
  }

  // 2. Multi-line comments spanning --- separators
  const multiLineComments = md.match(/<!--[\s\S]*?-->/g) || [];
  multiLineComments.forEach(comment => {
    if (comment.includes("\n---\n") && !/<!--\s*(layout|bg|font|design|style):/.test(comment)) {
      warn(`Multi-line HTML comment spans slide separators (${comment.length} chars) — content inside will be hidden`);
    }
  });

  // 3. Empty slides
  const slides = md.split(/\n---\n/).filter(s => s.trim());
  slides.forEach((slide, i) => {
    const stripped = slide.replace(/<!--[\s\S]*?-->/g, "").replace(/```notes[\s\S]*?```/g, "").trim();
    if (stripped.length < 3) {
      warn(`Slide ${i + 1} appears empty (${stripped.length} chars after stripping directives/notes)`);
    }
  });

  // 4. Common typos / spelling
  const typos = [
    [/\bPractioner\b/g, "Practitioner"],
    [/\bAccesibility\b/gi, "Accessibility"],
    [/\bOccured\b/gi, "Occurred"],
    [/\bRecieve\b/gi, "Receive"],
    [/\bSeperate\b/gi, "Separate"],
    [/\bOccur?ance\b/gi, "Occurrence"],
    [/\bDefin[ai]tly\b/gi, "Definitely"],
    [/\bAccomodation\b/gi, "Accommodation"],
    [/\bNeccessary\b/gi, "Necessary"],
    [/\bGoverment\b/gi, "Government"],
    [/\bEnvironement\b/gi, "Environment"],
    [/\bDemonstate\b/gi, "Demonstrate"],
  ];
  typos.forEach(([pattern, correct]) => {
    const matches = md.match(pattern);
    if (matches) {
      warn(`Possible typo: "${matches[0]}" → "${correct}" (${matches.length} occurrence${matches.length > 1 ? "s" : ""})`);
    }
  });

  // 5. Inconsistent counts ("6 weekly themes" but 7 listed)
  const countClaims = md.match(/\b(\d+)\s+(?:weekly\s+)?(?:themes?|topics?|points?|items?|lens(?:es)?)\b/gi) || [];
  // (informational only — hard to validate without context)

  // 6. Slides with heading but no content
  slides.forEach((slide, i) => {
    const hasHeading = /^#{1,3}\s+.+/m.test(slide);
    const stripped = slide
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/```notes[\s\S]*?```/g, "")
      .replace(/^#{1,3}\s+.+$/gm, "")
      .trim();
    if (hasHeading && stripped.length < 5) {
      warn(`Slide ${i + 1} has a heading but no body content — may appear empty`);
    }
  });

  // 7. Very long slides (might overflow)
  slides.forEach((slide, i) => {
    const lines = slide.split("\n").filter(l => l.trim()).length;
    const bullets = (slide.match(/^\s*[-*]\s/gm) || []).length;
    if (bullets > 10) {
      warn(`Slide ${i + 1} has ${bullets} bullets — may overflow in most layouts`);
    }
    if (lines > 30) {
      warn(`Slide ${i + 1} has ${lines} lines — very dense, may not render well`);
    }
  });

  return results;
}

module.exports = { runQA, auditA11y, scoreDesign, validateLayouts, validateIntensity, validateContentPreservation, validateDirectiveAdoption, validateSource, contrastRatio, relativeLuminance, INTENSITY_RULES };
