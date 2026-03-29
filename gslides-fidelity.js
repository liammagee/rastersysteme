#!/usr/bin/env node
/**
 * gslides-fidelity — compare Google Slides export against source design directives
 *
 * Reads back a presentation via the Slides API and measures fidelity across:
 *   - Zone positions and sizes (grid alignment)
 *   - Background colors
 *   - Typography (font, size, weight, color)
 *   - Accent shapes (count, type, position)
 *   - Image placement
 *   - Text content completeness
 *
 * Outputs a fidelity scorecard compatible with the rubric framework.
 *
 * Usage:
 *   node gslides-fidelity.js <presentation-id> <source.composed.md> [options]
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { google } = require("googleapis");
const { parseMarkdown, createGrid, THEMES, adaptThemeForBg } = require("./raster.js");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

const EMU_PER_INCH = 914400;

// ═══════════════════════════════════════════════════════
// READBACK
// ═══════════════════════════════════════════════════════

async function readPresentation(presentationId, auth) {
  const slidesApi = google.slides({ version: "v1", auth });
  const res = await slidesApi.presentations.get({ presentationId });
  return res.data;
}

// ═══════════════════════════════════════════════════════
// MEASUREMENT HELPERS
// ═══════════════════════════════════════════════════════

function renderedSize(el) {
  const s = el.size || {};
  const t = el.transform || {};
  return {
    w: (s.width?.magnitude || 0) * Math.abs(t.scaleX || 1),
    h: (s.height?.magnitude || 0) * Math.abs(t.scaleY || 1),
    x: t.translateX || 0,
    y: t.translateY || 0,
  };
}

function emuToInches(emu) { return emu / EMU_PER_INCH; }

function rgbToHex(rgb) {
  if (!rgb) return null;
  return [rgb.red || 0, rgb.green || 0, rgb.blue || 0]
    .map(c => Math.round(c * 255).toString(16).padStart(2, "0"))
    .join("");
}

function hexDistance(hex1, hex2) {
  if (!hex1 || !hex2) return 1;
  hex1 = hex1.replace(/^#/, "").toLowerCase();
  hex2 = hex2.replace(/^#/, "").toLowerCase();
  const r1 = parseInt(hex1.slice(0, 2), 16), g1 = parseInt(hex1.slice(2, 4), 16), b1 = parseInt(hex1.slice(4, 6), 16);
  const r2 = parseInt(hex2.slice(0, 2), 16), g2 = parseInt(hex2.slice(2, 4), 16), b2 = parseInt(hex2.slice(4, 6), 16);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) / 441.67; // normalize to 0-1
}

function extractText(shape) {
  if (!shape?.text?.textElements) return "";
  return shape.text.textElements
    .filter(t => t.textRun)
    .map(t => t.textRun.content)
    .join("")
    .trim();
}

function extractFont(shape) {
  if (!shape?.text?.textElements) return null;
  const run = shape.text.textElements.find(t => t.textRun);
  if (!run) return null;
  const style = run.textRun.style || {};
  return {
    family: style.fontFamily || null,
    size: style.fontSize?.magnitude || null,
    bold: style.bold || false,
    italic: style.italic || false,
    color: rgbToHex(style.foregroundColor?.opaqueColor?.rgbColor),
  };
}

// ═══════════════════════════════════════════════════════
// FIDELITY DIMENSIONS
// ═══════════════════════════════════════════════════════

function evaluateSlide(apiSlide, sourceSlide, slideIdx, grid) {
  const issues = [];
  const design = sourceSlide.design;
  if (!design) return { issues, designed: false };

  const elements = apiSlide.pageElements || [];
  const zoneEls = elements.filter(e => e.objectId.startsWith("zone"));
  const accentEls = elements.filter(e => e.objectId.startsWith("accent"));
  const imageEls = elements.filter(e => e.image || e.objectId.startsWith("img"));

  // ── Background Color ──
  const expectedBg = (design.bg || "").replace(/^#/, "").toLowerCase();
  const apiBgRgb = apiSlide.pageProperties?.pageBackgroundFill?.solidFill?.color?.rgbColor;
  const actualBg = rgbToHex(apiBgRgb);
  if (expectedBg && actualBg) {
    const dist = hexDistance(expectedBg, actualBg);
    if (dist > 0.02) {
      issues.push({ dim: "color", type: "bg_mismatch", expected: expectedBg, actual: actualBg, delta: dist });
    }
  } else if (expectedBg && !actualBg) {
    issues.push({ dim: "color", type: "bg_missing", expected: expectedBg });
  }

  // ── Zone Position & Size ──
  const expectedZones = design.zones || [];
  if (zoneEls.length < expectedZones.length) {
    issues.push({ dim: "grid", type: "zones_missing", expected: expectedZones.length, actual: zoneEls.length });
  }

  for (let z = 0; z < Math.min(expectedZones.length, zoneEls.length); z++) {
    const ez = expectedZones[z];
    const az = zoneEls[z];
    const { w, h, x, y } = renderedSize(az);

    const expectW = grid.cw(ez.span) * EMU_PER_INCH;
    const expectH = grid.ch(ez.rowSpan) * EMU_PER_INCH;
    const expectX = grid.cx(ez.col) * EMU_PER_INCH;
    const expectY = grid.cy(ez.row) * EMU_PER_INCH;

    const wPct = Math.abs(w - expectW) / expectW * 100;
    const hPct = Math.abs(h - expectH) / expectH * 100;
    const xDrift = Math.abs(x - expectX) / EMU_PER_INCH;
    const yDrift = Math.abs(y - expectY) / EMU_PER_INCH;

    if (wPct > 5) {
      issues.push({ dim: "grid", type: "zone_width_drift", role: ez.role, pct: wPct, expected: emuToInches(expectW), actual: emuToInches(w) });
    }
    if (hPct > 10) {
      issues.push({ dim: "grid", type: "zone_height_drift", role: ez.role, pct: hPct, expected: emuToInches(expectH), actual: emuToInches(h) });
    }
    if (xDrift > 0.15) {
      issues.push({ dim: "grid", type: "zone_x_drift", role: ez.role, drift: xDrift });
    }
    if (yDrift > 0.15) {
      issues.push({ dim: "grid", type: "zone_y_drift", role: ez.role, drift: yDrift });
    }
  }

  // ── Typography ──
  for (let z = 0; z < Math.min(expectedZones.length, zoneEls.length); z++) {
    const ez = expectedZones[z];
    const typo = (design.typography || {})[ez.role] || ez.typography || {};
    const az = zoneEls[z];
    const font = extractFont(az.shape);
    if (!font) continue;

    const expectedFont = design.font || "Helvetica Neue";
    if (font.family && font.family !== expectedFont) {
      issues.push({ dim: "typography", type: "font_mismatch", role: ez.role, expected: expectedFont, actual: font.family });
    }
    if (typo.size && font.size && Math.abs(font.size - typo.size) > 2) {
      issues.push({ dim: "typography", type: "size_mismatch", role: ez.role, expected: typo.size, actual: font.size });
    }
    if (typo.weight && ((typo.weight >= 700) !== font.bold)) {
      issues.push({ dim: "typography", type: "weight_mismatch", role: ez.role, expected: typo.weight >= 700, actual: font.bold });
    }
    if (typo.color) {
      const expectedColor = typo.color.replace(/^#/, "").toLowerCase();
      if (font.color && hexDistance(expectedColor, font.color) > 0.05) {
        issues.push({ dim: "typography", type: "color_mismatch", role: ez.role, expected: expectedColor, actual: font.color });
      }
    }
  }

  // ── Accents ──
  const expectedAccents = design.accents || [];
  if (accentEls.length !== expectedAccents.length) {
    issues.push({ dim: "accents", type: "count_mismatch", expected: expectedAccents.length, actual: accentEls.length });
  }

  // ── Text Content ──
  for (let z = 0; z < Math.min(expectedZones.length, zoneEls.length); z++) {
    const ez = expectedZones[z];
    const az = zoneEls[z];
    const apiText = extractText(az.shape);

    let expectedText = "";
    switch (ez.role) {
      case "title": expectedText = sourceSlide.title || sourceSlide.subtitle || ""; break;
      case "body": expectedText = sourceSlide.body.join("\n"); break;
      case "bullets": expectedText = sourceSlide.bullets.map(b => b.text).join(""); break;
      case "label": expectedText = (sourceSlide.sectionLabel || "").toUpperCase(); break;
      case "quote": expectedText = sourceSlide.blockquote || ""; break;
    }

    if (expectedText && !apiText) {
      issues.push({ dim: "content", type: "text_missing", role: ez.role });
    } else if (expectedText && apiText) {
      // Check if significant text was lost (allow formatting differences)
      const cleanExpected = expectedText.replace(/[\s\u2022\u2014]/g, "").toLowerCase();
      const cleanActual = apiText.replace(/[\s\u2022\u2014]/g, "").toLowerCase();
      if (cleanExpected.length > 10 && !cleanActual.includes(cleanExpected.slice(0, 30))) {
        issues.push({ dim: "content", type: "text_truncated", role: ez.role,
          expectedLen: cleanExpected.length, actualLen: cleanActual.length });
      }
    }
  }

  // ── Images ──
  const hasExpectedImage = imageEls.length > 0;
  if (!hasExpectedImage) {
    issues.push({ dim: "images", type: "no_images" });
  }

  return { issues, designed: true };
}

// ═══════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════

function computeFidelityScores(allIssues, slideCount) {
  const dims = {
    gridFidelity: 10,
    colorFidelity: 10,
    typographyFidelity: 10,
    accentFidelity: 10,
    contentFidelity: 10,
    imageFidelity: 10,
  };

  for (const { issues } of allIssues) {
    for (const iss of issues) {
      switch (iss.dim) {
        case "grid":
          if (iss.type === "zone_height_drift") dims.gridFidelity -= Math.min(2, iss.pct / 20);
          else if (iss.type === "zone_width_drift") dims.gridFidelity -= Math.min(1.5, iss.pct / 15);
          else if (iss.type.includes("drift")) dims.gridFidelity -= 0.5;
          else if (iss.type === "zones_missing") dims.gridFidelity -= 2;
          break;
        case "color":
          if (iss.type === "bg_missing") dims.colorFidelity -= 2;
          else if (iss.type === "bg_mismatch") dims.colorFidelity -= Math.min(2, iss.delta * 10);
          break;
        case "typography":
          if (iss.type === "font_mismatch") dims.typographyFidelity -= 1.5;
          else if (iss.type === "size_mismatch") dims.typographyFidelity -= 1;
          else if (iss.type === "weight_mismatch") dims.typographyFidelity -= 0.5;
          else if (iss.type === "color_mismatch") dims.typographyFidelity -= 0.5;
          break;
        case "accents":
          if (iss.type === "count_mismatch") dims.accentFidelity -= 2;
          break;
        case "content":
          if (iss.type === "text_missing") dims.contentFidelity -= 2;
          else if (iss.type === "text_truncated") dims.contentFidelity -= 1;
          break;
        case "images":
          if (iss.type === "no_images") dims.imageFidelity -= 0.3; // per-slide
          break;
      }
    }
  }

  // Clamp all to [0, 10]
  for (const k of Object.keys(dims)) {
    dims[k] = Math.max(0, Math.min(10, dims[k]));
  }

  const total = Object.values(dims).reduce((a, b) => a + b, 0);
  const max = Object.keys(dims).length * 10;

  return { dimensions: dims, total, max, normalized: (total / max * 100) };
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function evaluateFidelity(presentationId, sourcePath, options = {}) {
  const credPath = options.credentials || process.env.GOOGLE_CREDENTIALS_PATH || "/Users/lmagee/Dev/youtube-playlist/client_secret.json";
  const tokenPath = options.token || ".gslides-token.json";

  // Auth
  const raw = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  const creds = raw.installed || raw.web;
  const oauth2 = new google.auth.OAuth2(
    creds.client_id, creds.client_secret, "http://localhost:3847/oauth2callback"
  );
  oauth2.setCredentials(JSON.parse(fs.readFileSync(tokenPath, "utf-8")));

  // Read presentation
  const presData = await readPresentation(presentationId, oauth2);

  // Parse source
  const md = fs.readFileSync(sourcePath, "utf-8");
  const slides = parseMarkdown(md);
  const grid = createGrid(10, 5.625);

  console.log(dim("\n  ┌─ gslides-fidelity ────────────────────────"));
  console.log(dim("  │ ") + `Presentation: ${teal(presentationId)}`);
  console.log(dim("  │ ") + `Source: ${teal(sourcePath)}`);
  console.log(dim("  │ ") + `Slides: ${presData.slides.length} API / ${slides.length} source`);

  if (presData.slides.length !== slides.length) {
    console.log(dim("  │ ") + accent(`  ⚠ Slide count mismatch!`));
  }

  // Evaluate each slide
  const allIssues = [];
  let totalIssues = 0;

  for (let i = 0; i < Math.min(presData.slides.length, slides.length); i++) {
    const result = evaluateSlide(presData.slides[i], slides[i], i, grid);
    allIssues.push(result);
    totalIssues += result.issues.length;
  }

  // Score
  const scores = computeFidelityScores(allIssues, slides.length);

  // Report
  console.log(dim("  │"));
  console.log(dim("  │ ") + chalk.white.bold("Fidelity Scores:"));
  for (const [dim_name, score] of Object.entries(scores.dimensions)) {
    const bar = score >= 8 ? sage : score >= 5 ? amber : accent;
    const label = dim_name.replace(/([A-Z])/g, " $1").trim();
    console.log(dim("  │ ") + `  ${label.padEnd(22)} ${bar(score.toFixed(1).padStart(4))}/10`);
  }
  console.log(dim("  │"));
  console.log(dim("  │ ") + `  Total: ${scores.total.toFixed(1)}/${scores.max} (${scores.normalized.toFixed(1)}%)`);

  // Issue breakdown
  const issueCounts = {};
  for (const { issues } of allIssues) {
    for (const iss of issues) {
      const key = `${iss.dim}:${iss.type}`;
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    }
  }

  if (totalIssues > 0) {
    console.log(dim("  │"));
    console.log(dim("  │ ") + chalk.white.bold(`Issues (${totalIssues} total):`));
    for (const [key, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
      console.log(dim("  │ ") + `  ${amber(count.toString().padStart(3))}× ${key}`);
    }
  }

  console.log(dim("  └──────────────────────────────────────────\n"));

  return {
    presentationId,
    source: sourcePath,
    slideCount: { api: presData.slides.length, source: slides.length },
    scores,
    issueCounts,
    totalIssues,
    allIssues,
  };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes("--help")) {
    console.log(`
  ${accent("gslides-fidelity")} — evaluate Google Slides export fidelity

  ${dim("Usage:")}
    node gslides-fidelity.js <presentation-id> <source.composed.md>

  ${dim("Options:")}
    --credentials <path>  OAuth credentials JSON
    --token <path>        OAuth token file
    --json                Output raw JSON
`);
    process.exit(0);
  }

  const presId = args[0];
  const source = args[1];
  const getOpt = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
  };

  evaluateFidelity(presId, source, {
    credentials: getOpt("--credentials"),
    token: getOpt("--token"),
  }).then(result => {
    if (args.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    }
  }).catch(err => {
    console.error(accent("  Error:"), err.message);
    process.exit(1);
  });
}

module.exports = { evaluateFidelity, evaluateSlide, computeFidelityScores, renderedSize, rgbToHex, hexDistance, extractText, extractFont };
