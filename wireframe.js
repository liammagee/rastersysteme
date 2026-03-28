#!/usr/bin/env node
/**
 * wireframe.js — generate ASCII wireframe diagrams from composed markdown
 *
 * Reads design directives and renders each slide as a 60-col × 20-row ASCII
 * grid showing intended zone placement, accents, and content summary.
 *
 * Usage:
 *   node wireframe.js <deck.composed.md>                   All slides
 *   node wireframe.js <deck.composed.md> --slide 7         Single slide
 *   node wireframe.js <deck.composed.md> --json            JSON output
 *   node wireframe.js <deck.composed.md> --compare <dir>   Compare against screenshots
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const COLS = 60;
const ROWS = 20; // half the 40-row grid for terminal readability
const EMPTY = " ";
const BORDER_H = "─";
const BORDER_V = "│";
const CORNER_TL = "┌";
const CORNER_TR = "┐";
const CORNER_BL = "└";
const CORNER_BR = "┘";
const ACCENT_H = "═";
const ACCENT_V = "║";

const ROLE_CHARS = {
  title: "T",
  body: "B",
  bullets: "●",
  table: "▦",
  image: "▣",
  label: "L",
  quote: "Q",
  links: "→",
  code: "C",
  video: "▶",
};

function parseSlides(mdPath) {
  const md = fs.readFileSync(mdPath, "utf-8");
  const rawSlides = md.split(/^---$/m);
  const slides = [];

  for (const raw of rawSlides) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Extract design directive
    const designMatch = trimmed.match(/<!--\s*design:\s*(\{[\s\S]*?\})\s*-->/);
    let design = null;
    if (designMatch) {
      try {
        design = JSON.parse(designMatch[1]);
      } catch (e) {
        // malformed JSON
      }
    }

    // Extract heading
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/m);
    const heading = headingMatch ? headingMatch[1].trim() : "";

    // Extract content summary
    const lines = trimmed.split("\n").filter(l =>
      !l.startsWith("<!--") && !l.startsWith("```") && l.trim()
    );
    const contentLines = lines.filter(l => !l.startsWith("#")).slice(0, 3);
    const hasTable = /^\|/.test(trimmed);
    const hasImage = /!\[/.test(trimmed);
    const hasBullets = /^\s*-\s/.test(trimmed);
    const hasLink = /\[.*\]\(http/.test(trimmed);

    slides.push({ design, heading, contentLines, hasTable, hasImage, hasBullets, hasLink, raw: trimmed });
  }

  return slides;
}

function renderWireframe(slide, slideNum) {
  // Create grid
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));

  const design = slide.design;
  if (!design) {
    // No design directive — show content summary only
    placeText(grid, 2, 1, `S${slideNum}: No design directive`);
    placeText(grid, 2, 3, slide.heading || "(no heading)");
    return gridToString(grid, slideNum, slide);
  }

  const zones = design.zones || [];
  const accents = design.accents || [];
  const bg = design.bg || "FFFFFF";
  const font = design.font || "";

  // Draw zones
  for (const zone of zones) {
    const col = Math.round(zone.col * COLS / 60);
    const span = Math.round(zone.span * COLS / 60);
    const row = Math.round(zone.row * ROWS / 40);
    const rowSpan = Math.max(2, Math.round(zone.rowSpan * ROWS / 40));

    const left = Math.max(0, Math.min(col, COLS - 2));
    const top = Math.max(0, Math.min(row, ROWS - 2));
    const right = Math.min(left + span, COLS - 1);
    const bottom = Math.min(top + rowSpan, ROWS - 1);

    drawBox(grid, left, top, right, bottom);

    // Label the zone
    const roleChar = ROLE_CHARS[zone.role] || zone.role[0].toUpperCase();
    const label = ` ${zone.role.toUpperCase()} `;
    placeText(grid, left + 1, top, label.substring(0, right - left - 1));

    // Place content hint inside the zone
    placeContentHint(grid, left + 1, top + 1, right - left - 1, bottom - top - 1, zone.role, slide);
  }

  // Draw accents
  for (const accent of accents) {
    const col = Math.round(accent.col * COLS / 60);
    const span = Math.round(accent.span * COLS / 60);
    const row = Math.round(accent.row * ROWS / 40);
    const rowSpan = Math.max(1, Math.round(accent.rowSpan * ROWS / 40));

    if (accent.type === "bar" || accent.type === "line") {
      if (span > rowSpan * 2) {
        // Horizontal accent
        for (let c = col; c < Math.min(col + span, COLS); c++) {
          if (row >= 0 && row < ROWS && c >= 0) grid[row][c] = ACCENT_H;
        }
      } else {
        // Vertical accent
        for (let r = row; r < Math.min(row + rowSpan, ROWS); r++) {
          if (r >= 0 && col >= 0 && col < COLS) grid[r][col] = ACCENT_V;
        }
      }
    } else if (accent.type === "dot") {
      const r = Math.min(row, ROWS - 1);
      const c = Math.min(col, COLS - 1);
      if (r >= 0 && c >= 0) grid[r][c] = "◉";
    }
  }

  return gridToString(grid, slideNum, slide);
}

function drawBox(grid, left, top, right, bottom) {
  // Clamp to grid
  const l = Math.max(0, left);
  const t = Math.max(0, top);
  const r = Math.min(right, COLS - 1);
  const b = Math.min(bottom, ROWS - 1);

  if (l >= r || t >= b) return;

  // Corners
  grid[t][l] = CORNER_TL;
  grid[t][r] = CORNER_TR;
  grid[b][l] = CORNER_BL;
  grid[b][r] = CORNER_BR;

  // Horizontal edges
  for (let c = l + 1; c < r; c++) {
    grid[t][c] = BORDER_H;
    grid[b][c] = BORDER_H;
  }

  // Vertical edges
  for (let row = t + 1; row < b; row++) {
    grid[row][l] = BORDER_V;
    grid[row][r] = BORDER_V;
  }
}

function placeText(grid, col, row, text) {
  if (row < 0 || row >= ROWS) return;
  for (let i = 0; i < text.length && col + i < COLS; i++) {
    if (col + i >= 0) grid[row][col + i] = text[i];
  }
}

function placeContentHint(grid, col, row, width, height, role, slide) {
  if (width < 2 || height < 1) return;
  const maxW = width - 1;

  switch (role) {
    case "title":
      placeText(grid, col, row, truncate(slide.heading || "Title", maxW));
      break;
    case "body":
      for (let i = 0; i < Math.min(slide.contentLines.length, height); i++) {
        placeText(grid, col, row + i, truncate(slide.contentLines[i] || "", maxW));
      }
      break;
    case "bullets":
      if (slide.hasBullets) placeText(grid, col, row, truncate("- bullet items...", maxW));
      break;
    case "table":
      placeText(grid, col, row, truncate("|col|col|col|", maxW));
      if (height > 1) placeText(grid, col, row + 1, truncate("|---|---|---|", maxW));
      break;
    case "image":
      placeText(grid, col, row, truncate("[image]", maxW));
      break;
    case "label":
      placeText(grid, col, row, truncate(slide.heading || "Label", maxW));
      break;
    case "quote":
      placeText(grid, col, row, truncate("> blockquote", maxW));
      break;
    case "links":
      placeText(grid, col, row, truncate("[link] ->", maxW));
      break;
  }
}

function truncate(s, maxLen) {
  return s.length > maxLen ? s.substring(0, maxLen - 2) + ".." : s;
}

function gridToString(grid, slideNum, slide) {
  const design = slide.design || {};
  const bg = design.bg || "------";
  const font = design.font || "default";

  const header = `S${String(slideNum).padStart(2, "0")} │ bg:#${bg} │ ${font}`;
  const topBorder = "┌" + BORDER_H.repeat(COLS) + "┐";
  const bottomBorder = "└" + BORDER_H.repeat(COLS) + "┘";

  const lines = [header, topBorder];
  for (const row of grid) {
    lines.push(BORDER_V + row.join("") + BORDER_V);
  }
  lines.push(bottomBorder);
  return lines.join("\n");
}

// ── CLI ──

function main() {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith("--"));

  if (!input || args.includes("--help")) {
    console.log(`
  wireframe.js — ASCII wireframe diagrams from composed markdown

  Usage:
    node wireframe.js <deck.composed.md>              All slides
    node wireframe.js <deck.composed.md> --slide 7    Single slide
    node wireframe.js <deck.composed.md> --json        JSON output
    `);
    process.exit(0);
  }

  const slideFlag = args.indexOf("--slide");
  const targetSlide = slideFlag >= 0 ? parseInt(args[slideFlag + 1]) : null;
  const jsonMode = args.includes("--json");

  const slides = parseSlides(input);

  if (jsonMode) {
    const wireframes = slides.map((s, i) => ({
      slide: i + 1,
      heading: s.heading,
      wireframe: renderWireframe(s, i + 1),
      zones: s.design ? s.design.zones.map(z => z.role) : [],
      accents: s.design ? s.design.accents.length : 0,
      bg: s.design ? s.design.bg : null,
      font: s.design ? s.design.font : null,
    }));
    console.log(JSON.stringify(wireframes, null, 2));
  } else {
    for (let i = 0; i < slides.length; i++) {
      if (targetSlide && (i + 1) !== targetSlide) continue;
      console.log(renderWireframe(slides[i], i + 1));
      console.log("");
    }
  }
}

main();
