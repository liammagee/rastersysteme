#!/usr/bin/env node
/**
 * rastersysteme — Swiss 60-column grid slide generator
 *
 * Usage:
 *   node raster.js input.md [output.pptx] [--theme dark|light|red|blue] [--ratio 16:9|4:3] [--font "Font Name"]
 *
 * Markdown format:
 *   Slides separated by ---
 *   # Heading 1 → title text
 *   ## Heading 2 → subtitle
 *   ### Heading 3 → section label
 *   - Bullet items (indent with 2 spaces for nesting)
 *   > Blockquote → callout
 *   ![alt](path) → embedded image
 *   | col | col | → table
 *   ```lang → code block (monospace)
 *   ```notes → speaker notes (not rendered)
 *   <!-- layout: name --> → force a layout
 *   <!-- bg: color --> → background override
 *   <!-- font: name --> → font override (per-slide)
 *   [text](url) → links preserved as text
 *
 * Available layouts (auto-detected or forced):
 *   title, section, bullets, stagger, overlap, fragment, rotated, arc, split, image, table, code, blank
 */

const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

// Try to load image-size for aspect-ratio-aware image placement
let imageSize;
try {
  imageSize = require("image-size");
} catch {
  imageSize = null;
}

// ═══════════════════════════════════════════════════════
// COLOR UTILITIES
// ═══════════════════════════════════════════════════════

function isDarkColor(hex) {
  if (!hex) return false;
  hex = hex.replace(/^#/, "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

function adaptThemeForBg(theme, bgHex) {
  if (!bgHex) return theme;
  const bgDark = isDarkColor(bgHex);
  const themeBgDark = isDarkColor(theme.bg);
  if (bgDark === themeBgDark) return theme;
  if (bgDark && !themeBgDark) {
    return { ...theme, text: "F0EBE3", textMid: "B8B0A2", textLight: "8C8478" };
  }
  if (!bgDark && themeBgDark) {
    return { ...theme, text: "1A1A1A", textMid: "5C5549", textLight: "8C8478" };
  }
  return theme;
}

// ═══════════════════════════════════════════════════════
// GRID SYSTEM
// ═══════════════════════════════════════════════════════

function createGrid(slideWidth, slideHeight, cols = 60, rows = 40, margin = 0.5, gutter = 0.02) {
  const iw = slideWidth - margin * 2;
  const ih = slideHeight - margin * 2;
  const cw = (iw - (cols - 1) * gutter) / cols;
  const rh = (ih - (rows - 1) * gutter) / rows;

  return {
    SW: slideWidth, SH: slideHeight,
    M: margin, G: gutter,
    COLS: cols, ROWS: rows,
    IW: iw, IH: ih, CW: cw, RH: rh,
    cx: (col) => margin + col * (cw + gutter),
    cy: (row) => margin + row * (rh + gutter),
    cw: (span) => span * cw + (span - 1) * gutter,
    ch: (span) => span * rh + (span - 1) * gutter,
  };
}

// ═══════════════════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════════════════

const THEMES = {
  light: {
    bg: "F8F5F0", bgAlt: "FFFFFF", bgDark: "1A1A1A",
    text: "1A1A1A", textMid: "5C5549", textLight: "8C8478",
    accent: "E63222", accent2: "1B4FA0", accent3: "2A7A4B", accent4: "F2C12E",
    white: "FFFFFF", black: "1A1A1A", grey: "D4CEC4",
  },
  dark: {
    bg: "1A1A1A", bgAlt: "2A2A2A", bgDark: "111111",
    text: "F0EBE3", textMid: "B8B0A2", textLight: "8C8478",
    accent: "E63222", accent2: "4A90D9", accent3: "5CB87A", accent4: "F2C12E",
    white: "FFFFFF", black: "1A1A1A", grey: "444444",
  },
  red: {
    bg: "F8F5F0", bgAlt: "FFFFFF", bgDark: "8B1A10",
    text: "1A1A1A", textMid: "5C5549", textLight: "8C8478",
    accent: "E63222", accent2: "1B4FA0", accent3: "2A7A4B", accent4: "F2C12E",
    white: "FFFFFF", black: "1A1A1A", grey: "D4CEC4",
  },
  blue: {
    bg: "F0F4F8", bgAlt: "FFFFFF", bgDark: "0F2A4A",
    text: "1A1A1A", textMid: "4A5568", textLight: "8C9AAF",
    accent: "1B4FA0", accent2: "E63222", accent3: "2A7A4B", accent4: "F2C12E",
    white: "FFFFFF", black: "1A1A1A", grey: "CBD5E0",
  },
};

// ═══════════════════════════════════════════════════════
// MARKDOWN PARSER
// ═══════════════════════════════════════════════════════

function parseMarkdownTable(lines) {
  if (lines.length < 2) return null;
  const parseCells = (row) => row.split("|").slice(1, -1).map(c => c.trim());

  const headers = parseCells(lines[0]);
  const sepLine = lines[1].trim();
  if (!/^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/.test(sepLine)) return null;

  const alignments = parseCells(lines[1]).map(cell => {
    const t = cell.replace(/\s/g, "");
    if (t.startsWith(":") && t.endsWith(":")) return "center";
    if (t.endsWith(":")) return "right";
    return "left";
  });

  const rows = lines.slice(2).map(parseCells);
  return { headers, alignments, rows };
}

function parseMarkdown(md) {
  const raw = md.split(/\n---\n/);
  return raw.map((slideText, idx) => {
    const slide = {
      index: idx,
      title: null,
      subtitle: null,
      sectionLabel: null,
      bullets: [],
      body: [],
      blockquote: null,
      notes: null,
      layout: null,
      bgOverride: null,
      links: [],
      images: [],
      tables: [],
      codeBlocks: [],
      fontOverride: null,
      raw: slideText.trim(),
    };

    // Extract directives
    const layoutMatch = slideText.match(/<!--\s*layout:\s*(\w+)\s*-->/);
    if (layoutMatch) slide.layout = layoutMatch[1];

    const bgMatch = slideText.match(/<!--\s*bg:\s*([#\w]+)\s*-->/);
    if (bgMatch) slide.bgOverride = bgMatch[1].replace("#", "");

    const fontMatch = slideText.match(/<!--\s*font:\s*([^->]+?)\s*-->/);
    if (fontMatch) slide.fontOverride = fontMatch[1].trim();

    // Extract notes
    const notesMatch = slideText.match(/```notes\n([\s\S]*?)```/);
    if (notesMatch) slide.notes = notesMatch[1].trim();

    // Clean text (remove directives, notes)
    let clean = slideText
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/```notes\n[\s\S]*?```/g, "")
      .trim();

    // Extract code blocks (non-notes)
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let codeMatch;
    while ((codeMatch = codeBlockRegex.exec(clean)) !== null) {
      slide.codeBlocks.push({ lang: codeMatch[1] || "text", code: codeMatch[2].trim() });
    }
    clean = clean.replace(/```\w*\n[\s\S]*?```/g, "").trim();

    // Parse lines
    const lines = clean.split("\n");
    let tableBuffer = [];
    let inTable = false;

    const flushTable = () => {
      if (tableBuffer.length >= 2) {
        const table = parseMarkdownTable(tableBuffer);
        if (table) slide.tables.push(table);
      }
      tableBuffer = [];
      inTable = false;
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inTable) flushTable();
        continue;
      }

      // Table detection: lines starting and ending with |
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        inTable = true;
        tableBuffer.push(trimmed);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Headings
      if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
        slide.title = trimmed.replace(/^#\s+/, "");
      } else if (trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
        slide.subtitle = trimmed.replace(/^##\s+/, "");
      } else if (trimmed.startsWith("### ")) {
        slide.sectionLabel = trimmed.replace(/^###\s+/, "");
      }
      // Images: ![alt](path)
      else if (/^!\[([^\]]*)\]\(([^)]+)\)$/.test(trimmed)) {
        const m = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        slide.images.push({ alt: m[1], src: m[2] });
      }
      // Bullets with nesting (detect indent from original line)
      else if (/^\s*[-*]\s+/.test(line)) {
        const m = line.match(/^(\s*)([-*])\s+(.*)/);
        if (m) {
          const level = Math.floor(m[1].length / 2);
          slide.bullets.push({ text: m[3].trim(), level });
        }
      }
      // Blockquotes
      else if (trimmed.startsWith("> ")) {
        slide.blockquote = (slide.blockquote || "") + trimmed.replace(/^>\s*/, "") + "\n";
      }
      // Standalone links
      else if (/^\[.*\]\(.*\)$/.test(trimmed)) {
        const m = trimmed.match(/\[([^\]]*)\]\(([^)]*)\)/);
        if (m) slide.links.push({ text: m[1], url: m[2] });
      }
      // Body text
      else if (!trimmed.startsWith("```")) {
        slide.body.push(trimmed);
      }
    }

    // Flush any trailing table
    if (inTable) flushTable();

    if (slide.blockquote) slide.blockquote = slide.blockquote.trim();

    return slide;
  }).filter(s => s.raw.length > 0);
}

// ═══════════════════════════════════════════════════════
// LAYOUT DETECTION
// ═══════════════════════════════════════════════════════

function detectLayout(slide, index, total) {
  if (slide.layout) return slide.layout;

  // First slide → title
  if (index === 0) return "title";

  // Last slide with minimal content → blank or section
  if (index === total - 1 && !slide.title && slide.body.length <= 1) return "section";

  // Has title + subtitle but little else → section
  if (slide.title && slide.subtitle && slide.bullets.length === 0 &&
      slide.body.length <= 1 && slide.images.length === 0 &&
      slide.tables.length === 0 && slide.codeBlocks.length === 0) return "section";

  // New content types
  if (slide.images.length > 0) return "image";
  if (slide.tables.length > 0) return "table";
  if (slide.codeBlocks.length > 0) return "code";

  // Many top-level bullets (4+) → stagger; nested content stays as bullets
  const topLevel = slide.bullets.filter(b => (b.level || 0) === 0).length;
  if (topLevel >= 4 && topLevel === slide.bullets.length) return "stagger";

  // Has bullets → bullets
  if (slide.bullets.length > 0) return "bullets";

  // Has blockquote → rotated (use the quote as feature text)
  if (slide.blockquote) return "rotated";

  // Has title + body text → split
  if (slide.title && slide.body.length > 0) return "split";

  // Title only → section
  if (slide.title) return "section";

  // Links list → fragment
  if (slide.links.length > 0) return "fragment";

  return "split";
}

// ═══════════════════════════════════════════════════════
// RENDERING HELPERS
// ═══════════════════════════════════════════════════════

function fitImageDims(imgPath, maxW, maxH) {
  if (!imageSize) return { w: maxW, h: maxH };
  try {
    const dims = imageSize(imgPath);
    const imgAspect = dims.width / dims.height;
    const areaAspect = maxW / maxH;
    if (imgAspect > areaAspect) {
      return { w: maxW, h: maxW / imgAspect };
    } else {
      return { w: maxH * imgAspect, h: maxH };
    }
  } catch {
    return { w: maxW, h: maxH };
  }
}

function renderImage(s, g, img, col, row, spanCols, spanRows, basePath) {
  const imgPath = path.isAbsolute(img.src) ? img.src : path.join(basePath, img.src);
  const maxW = g.cw(spanCols);
  const maxH = g.ch(spanRows);

  if (!fs.existsSync(imgPath)) {
    s.addText("[Image: " + img.src + "]", {
      x: g.cx(col), y: g.cy(row), w: maxW, h: maxH,
      fontSize: 10, fontFace: "Helvetica Neue",
      color: "999999", align: "center", valign: "middle",
    });
    return;
  }

  const { w, h } = fitImageDims(imgPath, maxW, maxH);
  const xOff = (maxW - w) / 2;
  const yOff = (maxH - h) / 2;

  s.addImage({
    path: imgPath,
    x: g.cx(col) + xOff,
    y: g.cy(row) + yOff,
    w, h,
  });
}

function renderTable(s, g, table, col, row, spanCols, theme, fontFace) {
  const headerRow = table.headers.map((h, i) => ({
    text: h,
    options: {
      bold: true,
      color: theme.white,
      fill: { color: theme.accent },
      align: table.alignments[i] || "left",
      fontSize: 10,
      fontFace,
      border: { type: "solid", pt: 0.5, color: theme.accent },
      margin: [3, 6, 3, 6],
    },
  }));

  const dataRows = table.rows.map((r, ri) =>
    r.map((cell, ci) => ({
      text: cell,
      options: {
        color: theme.text,
        fill: { color: ri % 2 === 0 ? theme.bgAlt : theme.bg },
        align: table.alignments[ci] || "left",
        fontSize: 9,
        fontFace,
        border: { type: "solid", pt: 0.5, color: theme.grey },
        margin: [3, 6, 3, 6],
      },
    }))
  );

  const totalW = g.cw(spanCols);
  const colCount = table.headers.length;
  const colW = totalW / colCount;

  s.addTable([headerRow, ...dataRows], {
    x: g.cx(col),
    y: g.cy(row),
    w: totalW,
    colW: Array(colCount).fill(colW),
    rowH: 0.3,
  });
}

function renderCodeBlock(s, g, codeBlock, col, row, spanCols, spanRows, theme, pres) {
  const codeBg = theme.bg === "1A1A1A" ? "111111" : "2D2D2D";
  const codeText = "F8F8F2";

  // Background
  s.addShape(pres.shapes.RECTANGLE, {
    x: g.cx(col), y: g.cy(row),
    w: g.cw(spanCols), h: g.ch(spanRows),
    fill: { color: codeBg },
  });

  // Language label
  if (codeBlock.lang && codeBlock.lang !== "text") {
    s.addText(codeBlock.lang.toUpperCase(), {
      x: g.cx(col) + g.cw(spanCols) - 0.8,
      y: g.cy(row) + 0.05,
      w: 0.72, h: 0.18,
      fontSize: 6, fontFace: "Helvetica Neue",
      color: "666666", align: "right", margin: 0,
    });
  }

  // Code text (monospace)
  s.addText(codeBlock.code, {
    x: g.cx(col) + 0.15,
    y: g.cy(row) + 0.1,
    w: g.cw(spanCols) - 0.3,
    h: g.ch(spanRows) - 0.2,
    fontSize: 9, fontFace: "Courier New",
    color: codeText, margin: 0,
    lineSpacingMultiple: 1.25,
    valign: "top",
  });
}

// ═══════════════════════════════════════════════════════
// LAYOUT RENDERERS
// ═══════════════════════════════════════════════════════

function addSlideNumber(s, g, num, theme, dark = false) {
  s.addText(String(num).padStart(2, "0"), {
    x: g.cx(55), y: g.SH - 0.32, w: g.cw(5), h: 0.2,
    fontSize: 8, fontFace: "Helvetica Neue",
    color: dark ? theme.textMid : theme.textLight,
    align: "right", margin: 0,
  });
}

const LAYOUTS = {

  // ─── TITLE ───
  title(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgDark };

    // Accent block
    s.addShape(pres.shapes.RECTANGLE, {
      x: g.cx(0), y: g.cy(0), w: g.cw(24), h: g.ch(22),
      fill: { color: theme.accent },
    });

    const titleText = slide.title || slide.body[0] || "Untitled";
    const titleSize = titleText.length > 40 ? 26 : titleText.length > 25 ? 30 : 34;
    s.addText(titleText, {
      x: g.cx(1), y: g.cy(1), w: g.cw(22), h: g.ch(20),
      fontSize: titleSize, fontFace: ff,
      color: theme.white, bold: true, lineSpacingMultiple: 0.95,
      valign: "top", margin: 0,
    });

    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: g.cx(28), y: g.cy(4), w: g.cw(30), h: g.ch(6),
        fontSize: 24, fontFace: ff,
        color: theme.white, bold: true, margin: 0,
      });
    }

    // Bullets as topic pills
    const colors = [theme.accent2, theme.accent3, theme.accent4];
    slide.bullets.forEach((b, i) => {
      const row = 16 + i * 5;
      if (row > 35) return;
      s.addShape(pres.shapes.RECTANGLE, {
        x: g.cx(28), y: g.cy(row), w: g.cw(22), h: g.ch(4),
        fill: { color: colors[i % 3], transparency: i === 2 ? 35 : 20 },
      });
      s.addText(b.text, {
        x: g.cx(29), y: g.cy(row), w: g.cw(20), h: g.ch(4),
        fontSize: 11, fontFace: ff,
        color: theme.white, bold: true, margin: 0, valign: "middle",
      });
    });

    // Body lines as subtitle
    if (!slide.subtitle && slide.body.length > 0) {
      const bodyText = slide.body.filter(b => b !== titleText).join("\n");
      if (bodyText) {
        s.addText(bodyText, {
          x: g.cx(28), y: g.cy(6), w: g.cw(30), h: g.ch(10),
          fontSize: 14, fontFace: ff,
          color: theme.textMid, margin: 0, lineSpacingMultiple: 1.3,
        });
      }
    }

    s.addShape(pres.shapes.OVAL, {
      x: g.cx(25), y: g.cy(22), w: 0.22, h: 0.22,
      fill: { color: theme.accent4 },
    });

    addSlideNumber(s, g, num, theme, true);
  },

  // ─── SECTION ───
  section(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgDark };

    const title = slide.title || slide.subtitle || slide.body[0] || "";
    s.addText(title, {
      x: g.cx(4), y: g.cy(10), w: g.cw(52), h: g.ch(12),
      fontSize: 40, fontFace: ff,
      color: theme.white, bold: true, margin: 0, valign: "middle",
    });

    if (slide.subtitle && slide.title) {
      s.addText(slide.subtitle, {
        x: g.cx(4), y: g.cy(22), w: g.cw(40), h: g.ch(5),
        fontSize: 18, fontFace: ff,
        color: theme.textMid, margin: 0,
      });
    }

    if (slide.sectionLabel) {
      s.addText(slide.sectionLabel.toUpperCase(), {
        x: g.cx(4), y: g.cy(5), w: g.cw(30), h: g.ch(3),
        fontSize: 8, fontFace: ff,
        color: theme.accent, bold: true, margin: 0, charSpacing: 3,
      });
    }

    // Accent bar
    s.addShape(pres.shapes.RECTANGLE, {
      x: g.cx(4), y: g.cy(28), w: g.cw(8), h: g.ch(0.5),
      fill: { color: theme.accent },
    });

    // Links
    slide.links.forEach((l, i) => {
      s.addText(l.text + " \u2192", {
        x: g.cx(4), y: g.cy(30 + i * 3), w: g.cw(40), h: g.ch(3),
        fontSize: 10, fontFace: ff,
        color: theme.accent2, margin: 0,
        hyperlink: { url: l.url },
      });
    });

    addSlideNumber(s, g, num, theme, true);
  },

  // ─── BULLETS ───
  bullets(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    if (slide.sectionLabel) {
      s.addText(slide.sectionLabel.toUpperCase(), {
        x: g.cx(0), y: g.cy(0), w: g.cw(25), h: g.ch(3),
        fontSize: 8, fontFace: ff,
        color: theme.accent, bold: true, margin: 0, charSpacing: 3,
      });
    }

    if (slide.title) {
      s.addText(slide.title, {
        x: g.cx(0), y: g.cy(slide.sectionLabel ? 3 : 0),
        w: g.cw(35), h: g.ch(7),
        fontSize: 30, fontFace: ff,
        color: theme.text, bold: true, margin: 0,
      });
    }

    const startRow = (slide.title ? 11 : 4);
    const colors = [theme.accent, theme.accent2, theme.accent3, theme.accent4];
    let bulletNum = 0;

    slide.bullets.forEach((b, i) => {
      const level = b.level || 0;
      const indentCols = level * 4;
      const row = startRow + i * Math.min(6, Math.floor(28 / slide.bullets.length));
      if (row > 36) return;
      const rh = Math.min(5, Math.floor(26 / slide.bullets.length));

      if (level === 0) {
        bulletNum++;
        // Number circle
        s.addShape(pres.shapes.OVAL, {
          x: g.cx(indentCols), y: g.cy(row), w: 0.24, h: 0.24,
          fill: { color: colors[bulletNum % 4] },
        });
        s.addText(String(bulletNum), {
          x: g.cx(indentCols), y: g.cy(row), w: 0.24, h: 0.24,
          fontSize: 9, fontFace: ff,
          color: theme.white, bold: true, align: "center", valign: "middle", margin: 0,
        });
      } else {
        // Sub-bullet dash
        s.addText("\u2014", {
          x: g.cx(indentCols), y: g.cy(row) - 0.02, w: 0.2, h: 0.24,
          fontSize: level === 1 ? 10 : 8, fontFace: ff,
          color: theme.textLight, margin: 0,
        });
      }

      s.addText(b.text, {
        x: g.cx(indentCols + (level === 0 ? 3 : 2)), y: g.cy(row) - 0.02,
        w: g.cw(55 - indentCols - (level === 0 ? 3 : 2)), h: g.ch(rh),
        fontSize: level === 0 ? 14 : (level === 1 ? 12 : 10),
        fontFace: ff,
        color: level === 0 ? theme.text : theme.textMid,
        margin: 0, valign: "top",
      });
    });

    if (slide.blockquote) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: g.cx(0), y: g.cy(34), w: g.cw(58), h: g.ch(5),
        fill: { color: theme.accent, transparency: 92 },
      });
      s.addText(slide.blockquote, {
        x: g.cx(1), y: g.cy(34), w: g.cw(56), h: g.ch(5),
        fontSize: 11, fontFace: ff,
        color: theme.textMid, italic: true, margin: 0, valign: "middle",
      });
    }

    addSlideNumber(s, g, num, theme);
  },

  // ─── STAGGER (Musica Viva vertical cascade) ───
  stagger(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    if (slide.title) {
      s.addText(slide.title, {
        x: g.cx(0), y: g.cy(0), w: g.cw(40), h: g.ch(8),
        fontSize: 28, fontFace: ff,
        color: theme.text, bold: true, margin: 0,
      });
    }

    const colors = [theme.accent, theme.accent2, theme.accent3, theme.accent4];
    const startRow = slide.title ? 10 : 2;
    const step = Math.min(7, Math.floor(30 / slide.bullets.length));
    const colStep = Math.min(8, Math.floor(30 / slide.bullets.length));

    slide.bullets.forEach((b, i) => {
      const col = i * colStep;
      const row = startRow + i * step;
      if (row > 36) return;
      const c = colors[i % 4];
      const textOnDark = c === theme.accent4 ? theme.black : theme.white;

      s.addShape(pres.shapes.RECTANGLE, {
        x: g.cx(col), y: g.cy(row), w: g.cw(Math.min(42, 60 - col)), h: g.ch(Math.max(4, step - 1)),
        fill: { color: c, transparency: c === theme.accent4 ? 25 : 15 },
      });
      s.addText(b.text, {
        x: g.cx(col) + 0.12, y: g.cy(row), w: g.cw(Math.min(40, 58 - col)), h: g.ch(Math.max(4, step - 1)),
        fontSize: 15, fontFace: ff,
        color: textOnDark, bold: true, margin: 0, valign: "middle",
      });
    });

    addSlideNumber(s, g, num, theme);
  },

  // ─── SPLIT (left title, right content) ───
  split(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    // Left zone
    s.addShape(pres.shapes.RECTANGLE, {
      x: g.cx(0), y: g.cy(0), w: g.cw(22), h: g.ch(40),
      fill: { color: theme.accent, transparency: 90 },
    });

    if (slide.sectionLabel) {
      s.addText(slide.sectionLabel.toUpperCase(), {
        x: g.cx(1), y: g.cy(1), w: g.cw(20), h: g.ch(3),
        fontSize: 8, fontFace: ff,
        color: theme.accent, bold: true, margin: 0, charSpacing: 3,
      });
    }

    if (slide.title) {
      s.addText(slide.title, {
        x: g.cx(1), y: g.cy(slide.sectionLabel ? 5 : 2),
        w: g.cw(20), h: g.ch(14),
        fontSize: 28, fontFace: ff,
        color: theme.text, bold: true, margin: 0,
      });
    }

    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: g.cx(1), y: g.cy(18), w: g.cw(20), h: g.ch(6),
        fontSize: 14, fontFace: ff,
        color: theme.textMid, margin: 0,
      });
    }

    // Right zone — body text + bullets + images
    const rightCol = 25;
    let row = 2;

    slide.body.forEach(line => {
      if (row > 35) return;
      s.addText(line, {
        x: g.cx(rightCol), y: g.cy(row), w: g.cw(33), h: g.ch(4),
        fontSize: 13, fontFace: ff,
        color: theme.text, margin: 0,
      });
      row += 4;
    });

    slide.bullets.forEach((b, i) => {
      if (row > 35) return;
      const level = b.level || 0;
      const indent = level * 3;
      const prefix = level === 0 ? (i + 1) + ".  " : "\u2014 ";
      s.addText(prefix + b.text, {
        x: g.cx(rightCol + indent), y: g.cy(row), w: g.cw(33 - indent), h: g.ch(4),
        fontSize: level === 0 ? 12 : 10, fontFace: ff,
        color: level === 0 ? theme.textMid : theme.textLight,
        margin: 0,
      });
      row += level === 0 ? 4 : 3;
    });

    // Images in right zone
    slide.images.forEach(img => {
      if (row > 30) return;
      renderImage(s, g, img, rightCol, row, 33, 12, opts.basePath);
      row += 14;
    });

    if (slide.blockquote) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: g.cx(rightCol), y: g.cy(row), w: g.cw(33), h: g.ch(6),
        fill: { color: theme.accent, transparency: 92 },
      });
      s.addText(slide.blockquote, {
        x: g.cx(rightCol + 1), y: g.cy(row), w: g.cw(31), h: g.ch(6),
        fontSize: 11, fontFace: ff,
        color: theme.textMid, italic: true, margin: 0, valign: "middle",
      });
    }

    // Links
    slide.links.forEach((l, i) => {
      if (row > 36) return;
      s.addText(l.text + " \u2192", {
        x: g.cx(rightCol), y: g.cy(row + i * 3), w: g.cw(33), h: g.ch(3),
        fontSize: 10, fontFace: ff,
        color: theme.accent2, margin: 0,
        hyperlink: { url: l.url },
      });
    });

    addSlideNumber(s, g, num, theme);
  },

  // ─── ROTATED (Musica Viva rotated type) ───
  rotated(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    // Red vertical bar — 13 cols
    s.addShape(pres.shapes.RECTANGLE, {
      x: g.cx(0), y: g.cy(0), w: g.cw(13), h: g.ch(40),
      fill: { color: theme.accent, transparency: 15 },
    });

    // Rotated title
    const rotTitle = slide.title || "\u2014";
    const textW = Math.min(4.2, rotTitle.length * 0.3);
    const textH = 0.6;
    const centerX = g.cx(6.5);
    const centerY = g.cy(0) + g.ch(40) / 2;
    s.addText(rotTitle.toUpperCase(), {
      x: centerX - textW / 2, y: centerY - textH / 2,
      w: textW, h: textH,
      fontSize: 38, fontFace: ff,
      color: theme.white, bold: true, margin: 0,
      rotate: 270, valign: "middle", align: "center",
    });

    // Divider
    s.addShape(pres.shapes.LINE, {
      x: g.cx(15), y: g.cy(3), w: 0, h: g.ch(34),
      line: { color: theme.text, width: 0.15, transparency: 85 },
    });

    // Body / blockquote
    const mainText = slide.blockquote || slide.body.join("\n") || "";
    if (mainText) {
      s.addText(mainText, {
        x: g.cx(17), y: g.cy(6), w: g.cw(40), h: g.ch(22),
        fontSize: 17, fontFace: ff,
        color: theme.text, margin: 0, lineSpacingMultiple: 1.4,
      });
    }

    slide.bullets.forEach((b, i) => {
      s.addText("\u2014 " + b.text, {
        x: g.cx(17), y: g.cy(28 + i * 3), w: g.cw(40), h: g.ch(3),
        fontSize: 12, fontFace: ff,
        color: theme.textMid, margin: 0,
      });
    });

    addSlideNumber(s, g, num, theme);
  },

  // ─── FRAGMENT (Musica Viva fragmented grid) ───
  fragment(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    const items = [...slide.bullets.map(b => b.text), ...slide.links.map(l => l.text)];
    const colors = [theme.accent, theme.accent2, theme.accent3, theme.accent4, theme.black];

    // Auto-generate fragment positions
    const positions = [
      [0, 0, 18, 8], [20, 0, 18, 8], [40, 0, 18, 8],
      [0, 9, 18, 8], [20, 9, 18, 8], [40, 9, 18, 8],
      [0, 18, 18, 8], [20, 18, 18, 8], [40, 18, 28, 8],
    ];

    items.forEach((item, i) => {
      if (i >= positions.length) return;
      const [c, r, cs, rs] = positions[i];
      s.addShape(pres.shapes.RECTANGLE, {
        x: g.cx(c), y: g.cy(r + 10), w: g.cw(cs), h: g.ch(rs),
        fill: { color: colors[i % 5], transparency: i % 5 === 4 ? 10 : 40 },
      });
      const textColor = (colors[i % 5] === theme.accent4) ? theme.black : theme.white;
      s.addText(item, {
        x: g.cx(c) + 0.08, y: g.cy(r + 10) + 0.04,
        w: g.cw(cs - 1), h: g.ch(rs - 1),
        fontSize: 11, fontFace: ff,
        color: textColor, bold: true, margin: 0, valign: "middle",
      });
    });

    if (slide.title) {
      s.addText(slide.title, {
        x: g.cx(0), y: g.cy(1), w: g.cw(40), h: g.ch(8),
        fontSize: 26, fontFace: ff,
        color: theme.text, bold: true, margin: 0,
      });
    }

    addSlideNumber(s, g, num, theme);
  },

  // ─── OVERLAP (Musica Viva overlapping fields) ───
  overlap(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    // Two overlapping fields
    s.addShape(pres.shapes.RECTANGLE, {
      x: g.cx(0), y: g.cy(10), w: g.cw(32), h: g.ch(26),
      fill: { color: theme.accent, transparency: 35 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: g.cx(26), y: g.cy(10), w: g.cw(32), h: g.ch(26),
      fill: { color: theme.accent2, transparency: 40 },
    });

    if (slide.title) {
      s.addText(slide.title, {
        x: g.cx(0), y: g.cy(1), w: g.cw(40), h: g.ch(8),
        fontSize: 30, fontFace: ff,
        color: theme.text, bold: true, margin: 0,
      });
    }

    // Split bullets across two fields
    const half = Math.ceil(slide.bullets.length / 2);
    slide.bullets.slice(0, half).forEach((b, i) => {
      s.addText(b.text, {
        x: g.cx(2), y: g.cy(14 + i * 5), w: g.cw(24), h: g.ch(4),
        fontSize: 13, fontFace: ff,
        color: theme.white, margin: 0, valign: "middle",
      });
    });
    slide.bullets.slice(half).forEach((b, i) => {
      s.addText(b.text, {
        x: g.cx(28), y: g.cy(14 + i * 5), w: g.cw(28), h: g.ch(4),
        fontSize: 13, fontFace: ff,
        color: theme.white, margin: 0, valign: "middle",
      });
    });

    // Body in overlap zone
    if (slide.body.length > 0) {
      s.addText(slide.body.join("\n"), {
        x: g.cx(2), y: g.cy(12), w: g.cw(28), h: g.ch(20),
        fontSize: 13, fontFace: ff,
        color: theme.white, margin: 0, lineSpacingMultiple: 1.4,
      });
    }

    addSlideNumber(s, g, num, theme);
  },

  // ─── ARC ───
  arc(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    const acx = g.cx(35);
    const acy = g.cy(20);

    s.addShape(pres.shapes.OVAL, {
      x: acx - 2.2, y: acy - 2.2, w: 4.4, h: 4.4,
      fill: { color: theme.accent, transparency: 93 },
      line: { color: theme.accent, width: 3 },
    });
    s.addShape(pres.shapes.OVAL, {
      x: acx - 1.3, y: acy - 1.3, w: 2.6, h: 2.6,
      fill: { color: theme.accent2, transparency: 94 },
      line: { color: theme.accent2, width: 2 },
    });
    s.addShape(pres.shapes.OVAL, {
      x: acx - 0.12, y: acy - 0.12, w: 0.24, h: 0.24,
      fill: { color: theme.accent },
    });

    if (slide.title) {
      s.addText(slide.title, {
        x: g.cx(0), y: g.cy(2), w: g.cw(25), h: g.ch(10),
        fontSize: 40, fontFace: ff,
        color: theme.text, bold: true, margin: 0,
      });
    }

    slide.body.forEach((line, i) => {
      s.addText(line, {
        x: g.cx(0), y: g.cy(14 + i * 4), w: g.cw(25), h: g.ch(4),
        fontSize: 13, fontFace: ff,
        color: theme.textMid, margin: 0,
      });
    });

    addSlideNumber(s, g, num, theme);
  },

  // ─── IMAGE ───
  image(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    if (slide.sectionLabel) {
      s.addText(slide.sectionLabel.toUpperCase(), {
        x: g.cx(0), y: g.cy(0), w: g.cw(25), h: g.ch(3),
        fontSize: 8, fontFace: ff,
        color: theme.accent, bold: true, margin: 0, charSpacing: 3,
      });
    }

    // Title top-left
    if (slide.title) {
      s.addText(slide.title, {
        x: g.cx(0), y: g.cy(slide.sectionLabel ? 3 : 0),
        w: g.cw(25), h: g.ch(8),
        fontSize: 28, fontFace: ff,
        color: theme.text, bold: true, margin: 0,
      });
    }

    // Render images
    if (slide.images.length === 1) {
      // Single image — large, right side
      renderImage(s, g, slide.images[0], 0, slide.title ? 10 : 2, 58, slide.title ? 28 : 36, opts.basePath);
    } else {
      // Multiple images — grid arrangement
      const imgCols = Math.min(slide.images.length, 3);
      const imgSpan = Math.floor(58 / imgCols);
      const imgStartRow = slide.title ? 10 : 2;
      const imgRowSpan = slide.title ? 28 : 36;
      const rowsPerImg = Math.floor(imgRowSpan / Math.ceil(slide.images.length / imgCols));

      slide.images.forEach((img, i) => {
        const col = (i % imgCols) * imgSpan;
        const row = imgStartRow + Math.floor(i / imgCols) * rowsPerImg;
        if (row + rowsPerImg > 40) return;
        renderImage(s, g, img, col, row, imgSpan - 1, rowsPerImg - 1, opts.basePath);
      });
    }

    // Body text below images (as caption)
    if (slide.body.length > 0) {
      const captionRow = slide.title ? 36 : 36;
      s.addText(slide.body.join(" "), {
        x: g.cx(0), y: g.cy(captionRow), w: g.cw(58), h: g.ch(3),
        fontSize: 9, fontFace: ff,
        color: theme.textLight, italic: true, margin: 0,
      });
    }

    // Bullets below title if present
    let bulletRow = slide.title ? (slide.sectionLabel ? 12 : 9) : 2;
    slide.bullets.forEach((b, i) => {
      if (bulletRow > 35 || slide.images.length > 0) return;
      s.addText("\u2014 " + b.text, {
        x: g.cx(0), y: g.cy(bulletRow), w: g.cw(25), h: g.ch(3),
        fontSize: 11, fontFace: ff,
        color: theme.textMid, margin: 0,
      });
      bulletRow += 3;
    });

    addSlideNumber(s, g, num, theme);
  },

  // ─── TABLE ───
  table(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    if (slide.sectionLabel) {
      s.addText(slide.sectionLabel.toUpperCase(), {
        x: g.cx(0), y: g.cy(0), w: g.cw(30), h: g.ch(3),
        fontSize: 8, fontFace: ff,
        color: theme.accent, bold: true, margin: 0, charSpacing: 3,
      });
    }

    let startRow = 0;
    if (slide.title) {
      s.addText(slide.title, {
        x: g.cx(0), y: g.cy(slide.sectionLabel ? 3 : 0),
        w: g.cw(40), h: g.ch(7),
        fontSize: 28, fontFace: ff,
        color: theme.text, bold: true, margin: 0,
      });
      startRow = slide.sectionLabel ? 11 : 8;
    } else {
      startRow = slide.sectionLabel ? 4 : 1;
    }

    // Render tables
    slide.tables.forEach((table, ti) => {
      if (startRow > 35) return;
      renderTable(s, g, table, 0, startRow, 58, theme, ff);
      startRow += table.rows.length * 3 + 5;
    });

    // Body text after tables
    slide.body.forEach(line => {
      if (startRow > 36) return;
      s.addText(line, {
        x: g.cx(0), y: g.cy(startRow), w: g.cw(58), h: g.ch(3),
        fontSize: 12, fontFace: ff,
        color: theme.textMid, margin: 0,
      });
      startRow += 3;
    });

    addSlideNumber(s, g, num, theme);
  },

  // ─── CODE ───
  code(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    if (slide.sectionLabel) {
      s.addText(slide.sectionLabel.toUpperCase(), {
        x: g.cx(0), y: g.cy(0), w: g.cw(30), h: g.ch(3),
        fontSize: 8, fontFace: ff,
        color: theme.accent, bold: true, margin: 0, charSpacing: 3,
      });
    }

    let startRow = 0;
    if (slide.title) {
      s.addText(slide.title, {
        x: g.cx(0), y: g.cy(slide.sectionLabel ? 3 : 0),
        w: g.cw(40), h: g.ch(7),
        fontSize: 28, fontFace: ff,
        color: theme.text, bold: true, margin: 0,
      });
      startRow = slide.sectionLabel ? 11 : 8;
    } else {
      startRow = slide.sectionLabel ? 4 : 1;
    }

    // Render code blocks
    slide.codeBlocks.forEach((cb, ci) => {
      if (startRow > 34) return;
      const lines = cb.code.split("\n").length;
      const blockRows = Math.min(28, Math.max(8, lines * 2));
      renderCodeBlock(s, g, cb, 0, startRow, 58, blockRows, theme, pres);
      startRow += blockRows + 2;
    });

    // Body text after code
    slide.body.forEach(line => {
      if (startRow > 36) return;
      s.addText(line, {
        x: g.cx(0), y: g.cy(startRow), w: g.cw(58), h: g.ch(3),
        fontSize: 12, fontFace: ff,
        color: theme.textMid, margin: 0,
      });
      startRow += 3;
    });

    addSlideNumber(s, g, num, theme);
  },

  // ─── BLANK ───
  blank(s, slide, g, theme, pres, num, opts) {
    s.background = { color: theme.bgAlt };
    addSlideNumber(s, g, num, theme);
  },
};

// ═══════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════

async function generate(inputPath, outputPath, options = {}) {
  const themeName = options.theme || "light";
  const theme = THEMES[themeName] || THEMES.light;
  const ratio = options.ratio || "16:9";
  const globalFont = options.font || "Helvetica Neue";
  const basePath = path.dirname(path.resolve(inputPath));

  const pres = new pptxgen();

  let sw, sh;
  if (ratio === "4:3") {
    pres.layout = "LAYOUT_4x3";
    sw = 10; sh = 7.5;
  } else {
    pres.layout = "LAYOUT_16x9";
    sw = 10; sh = 5.625;
  }

  pres.author = "rastersysteme";
  pres.title = path.basename(inputPath, ".md");

  const g = createGrid(sw, sh);
  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);

  slides.forEach((slide, idx) => {
    const layout = detectLayout(slide, idx, slides.length);
    const s = pres.addSlide();

    // Speaker notes
    if (slide.notes) {
      s.addNotes(slide.notes);
    }

    // Adapt text colors when bg override darkness differs from theme
    const effectiveTheme = adaptThemeForBg(theme, slide.bgOverride);

    const fontFace = slide.fontOverride || globalFont;
    const opts = { fontFace, basePath };

    const renderer = LAYOUTS[layout] || LAYOUTS.split;
    renderer(s, slide, g, effectiveTheme, pres, idx + 1, opts);

    // Background override applied AFTER renderer so it takes precedence
    if (slide.bgOverride) {
      s.background = { color: slide.bgOverride };
    }
  });

  await pres.writeFile({ fileName: outputPath });
  return { slides: slides.length, output: outputPath, theme: themeName };
}

// ═══════════════════════════════════════════════════════
// HTML SLIDESHOW GENERATOR
// ═══════════════════════════════════════════════════════

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bulletsToHTML(bullets) {
  if (!bullets.length) return "";
  const accentCycle = ["accent", "accent2", "accent3", "accent4"];
  let topIdx = 0;
  return '<div class="bullets">' + bullets.map(b => {
    const level = b.level || 0;
    if (level === 0) {
      topIdx++;
      const c = accentCycle[(topIdx - 1) % 4];
      return `<div class="bullet level-0"><span class="dot" style="background:var(--${c})">${topIdx}</span><span>${esc(b.text)}</span></div>`;
    }
    return `<div class="bullet level-${Math.min(level, 3)}"><span class="dash">\u2014</span><span>${esc(b.text)}</span></div>`;
  }).join("\n") + "</div>";
}

function tableToHTML(table) {
  const align = (i) => table.alignments[i] || "left";
  let h = '<table><thead><tr>' +
    table.headers.map((c, i) => `<th style="text-align:${align(i)}">${esc(c)}</th>`).join("") +
    '</tr></thead><tbody>';
  table.rows.forEach(row => {
    h += '<tr>' + row.map((c, i) => `<td style="text-align:${align(i)}">${esc(c)}</td>`).join("") + '</tr>';
  });
  return h + '</tbody></table>';
}

function codeToHTML(cb) {
  const lang = cb.lang && cb.lang !== "text" ? `<span class="code-lang">${esc(cb.lang)}</span>` : "";
  return `<div class="code-block">${lang}<pre><code>${esc(cb.code)}</code></pre></div>`;
}

function bodyHTML(body) {
  if (!body.length) return "";
  return body.map(l => `<p>${esc(l)}</p>`).join("\n");
}

function linksHTML(links) {
  if (!links.length) return "";
  return '<div class="links">' +
    links.map(l => `<a href="${esc(l.url)}" target="_blank">${esc(l.text)} \u2192</a>`).join("\n") +
    '</div>';
}

function imagesHTML(images) {
  if (!images.length) return "";
  const cls = images.length === 1 ? "images single" : "images grid";
  return `<div class="${cls}">` +
    images.map(img => `<figure><img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy"><figcaption>${esc(img.alt)}</figcaption></figure>`).join("\n") +
    '</div>';
}

function slideLabel(slide) {
  return slide.sectionLabel ? `<span class="label">${esc(slide.sectionLabel.toUpperCase())}</span>` : "";
}

function slideTitle(slide, tag) {
  const text = slide.title || slide.subtitle;
  return text ? `<${tag}>${esc(text)}</${tag}>` : "";
}

function slideSubtitle(slide) {
  return slide.subtitle ? `<h2 class="subtitle">${esc(slide.subtitle)}</h2>` : "";
}

function slideBlockquote(slide) {
  return slide.blockquote ? `<blockquote>${esc(slide.blockquote)}</blockquote>` : "";
}

function slideNotes(slide) {
  return slide.notes ? `<div class="slide-notes" hidden>${esc(slide.notes)}</div>` : "";
}

const HTML_LAYOUTS = {
  title(slide) {
    const pills = slide.bullets.length > 0
      ? '<div class="pills">' + slide.bullets.map((b, i) => {
          const c = ["accent2", "accent3", "accent4"][i % 3];
          return `<div class="pill" style="background:var(--${c})">${esc(b.text)}</div>`;
        }).join("") + '</div>'
      : "";
    return `<div class="title-left"><div class="accent-block">${slideTitle(slide, "h1")}</div></div>
<div class="title-right">${slideSubtitle(slide)}${bodyHTML(slide.body)}${pills}</div>`;
  },

  section(slide) {
    const title = slide.title || slide.subtitle || slide.body[0] || "";
    const sub = slide.subtitle && slide.title ? slideSubtitle(slide) : "";
    return `${slideLabel(slide)}<h1 class="section-title">${esc(title)}</h1>${sub}
<div class="accent-bar"></div>${linksHTML(slide.links)}`;
  },

  bullets(slide) {
    return `${slideLabel(slide)}${slideTitle(slide, "h1")}${bodyHTML(slide.body)}${bulletsToHTML(slide.bullets)}${slideBlockquote(slide)}`;
  },

  stagger(slide) {
    const colors = ["accent", "accent2", "accent3", "accent4"];
    const bars = slide.bullets.map((b, i) => {
      const c = colors[i % 4];
      const ml = i * 8;
      return `<div class="stagger-bar" style="background:var(--${c});margin-left:${ml}%">${esc(b.text)}</div>`;
    }).join("\n");
    return `${slideTitle(slide, "h1")}<div class="stagger-bars">${bars}</div>`;
  },

  split(slide) {
    return `<div class="split-left">${slideLabel(slide)}${slideTitle(slide, "h1")}${slideSubtitle(slide)}</div>
<div class="split-right">${bodyHTML(slide.body)}${bulletsToHTML(slide.bullets)}${imagesHTML(slide.images)}${slideBlockquote(slide)}${linksHTML(slide.links)}</div>`;
  },

  rotated(slide) {
    const rotTitle = slide.title || "\u2014";
    const mainText = slide.blockquote || slide.body.join("\n") || "";
    const bHTML = slide.bullets.map(b => `<p class="rotated-bullet">\u2014 ${esc(b.text)}</p>`).join("");
    return `<div class="rotated-bar"><span class="rotated-text">${esc(rotTitle.toUpperCase())}</span></div>
<div class="rotated-content">${mainText ? `<p class="rotated-body">${esc(mainText)}</p>` : ""}${bHTML}</div>`;
  },

  fragment(slide) {
    const items = [...slide.bullets.map(b => b.text), ...slide.links.map(l => l.text)];
    const colors = ["accent", "accent2", "accent3", "accent4", "black"];
    const cells = items.map((item, i) => {
      const c = colors[i % 5];
      return `<div class="frag-cell" style="background:var(--${c})">${esc(item)}</div>`;
    }).join("\n");
    return `${slideTitle(slide, "h1")}<div class="frag-grid">${cells}</div>`;
  },

  overlap(slide) {
    const half = Math.ceil(slide.bullets.length / 2);
    const left = slide.bullets.slice(0, half).map(b => `<p>${esc(b.text)}</p>`).join("");
    const right = slide.bullets.slice(half).map(b => `<p>${esc(b.text)}</p>`).join("");
    return `${slideTitle(slide, "h1")}<div class="overlap-fields">
<div class="overlap-a">${left}${slide.body.length ? bodyHTML(slide.body) : ""}</div>
<div class="overlap-b">${right}</div></div>`;
  },

  arc(slide) {
    return `<div class="arc-left">${slideTitle(slide, "h1")}${bodyHTML(slide.body)}</div>
<div class="arc-right"><div class="arc-outer"><div class="arc-inner"><div class="arc-dot"></div></div></div></div>`;
  },

  image(slide) {
    return `${slideLabel(slide)}${slideTitle(slide, "h1")}${imagesHTML(slide.images)}${bodyHTML(slide.body)}`;
  },

  table(slide) {
    const tables = slide.tables.map(t => tableToHTML(t)).join("\n");
    return `${slideLabel(slide)}${slideTitle(slide, "h1")}${tables}${bodyHTML(slide.body)}`;
  },

  code(slide) {
    const blocks = slide.codeBlocks.map(cb => codeToHTML(cb)).join("\n");
    return `${slideLabel(slide)}${slideTitle(slide, "h1")}${blocks}${bodyHTML(slide.body)}`;
  },

  blank() { return ""; },
};

function generateHTMLCSS() {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.deck{width:100vw;height:100vh;position:relative}
.slide{position:absolute;inset:0;padding:5vmin;display:none;flex-direction:column;gap:2vmin;
  font-family:var(--font);color:var(--text);background:var(--bg-alt);overflow:hidden}
.slide.active{display:flex}

/* Typography */
h1{font-size:clamp(1.8rem,5vmin,3.5rem);font-weight:700;line-height:1.1;letter-spacing:-0.02em}
h2.subtitle{font-size:clamp(1rem,2.5vmin,1.6rem);font-weight:400;color:var(--text-mid)}
p{font-size:clamp(0.85rem,1.8vmin,1.2rem);line-height:1.5;color:var(--text-mid)}
.label{font-size:clamp(0.55rem,0.9vmin,0.75rem);letter-spacing:0.25em;text-transform:uppercase;
  color:var(--accent);font-weight:700;display:block;margin-bottom:1vmin}
blockquote{border-left:3px solid var(--accent);padding:1.5vmin 2vmin;margin:1vmin 0;
  background:color-mix(in srgb,var(--accent) 6%,transparent);font-style:italic;color:var(--text-mid);
  font-size:clamp(0.8rem,1.6vmin,1.1rem);line-height:1.5}

/* Bullets */
.bullets{display:flex;flex-direction:column;gap:1.2vmin;flex:1;min-height:0}
.bullet{display:flex;align-items:baseline;gap:1.2vmin}
.bullet.level-0{font-size:clamp(0.9rem,2vmin,1.3rem);color:var(--text)}
.bullet.level-1{font-size:clamp(0.8rem,1.6vmin,1.1rem);color:var(--text-mid);padding-left:3vmin}
.bullet.level-2,.bullet.level-3{font-size:clamp(0.7rem,1.4vmin,0.95rem);color:var(--text-light);padding-left:6vmin}
.dot{width:2.4vmin;height:2.4vmin;min-width:18px;min-height:18px;border-radius:50%;color:#fff;
  font-size:clamp(0.55rem,1vmin,0.75rem);font-weight:700;display:inline-flex;align-items:center;
  justify-content:center;flex-shrink:0}
.dash{color:var(--text-light);flex-shrink:0}

/* Tables */
table{width:100%;border-collapse:collapse;font-size:clamp(0.7rem,1.4vmin,0.95rem)}
thead th{background:var(--accent);color:#fff;padding:1vmin 1.5vmin;font-weight:700;
  border:1px solid var(--accent)}
tbody td{padding:0.8vmin 1.5vmin;border:1px solid var(--grey)}
tbody tr:nth-child(even){background:var(--bg)}
tbody tr:nth-child(odd){background:var(--bg-alt)}

/* Code */
.code-block{position:relative;background:#2D2D2D;border-radius:0.5vmin;flex:1;min-height:0;overflow:auto}
.code-block pre{padding:2.5vmin;margin:0;overflow:auto;height:100%}
.code-block code{font-family:'SF Mono','Fira Code','Cascadia Code','Courier New',monospace;
  font-size:clamp(0.65rem,1.3vmin,0.9rem);color:#F8F8F2;line-height:1.6;white-space:pre;display:block}
.code-lang{position:absolute;top:0.8vmin;right:1.2vmin;font-size:0.6rem;color:#666;
  font-family:var(--font);text-transform:uppercase;letter-spacing:0.1em}

/* Images */
.images{flex:1;display:flex;align-items:center;justify-content:center;gap:2vmin;min-height:0}
.images.grid{flex-wrap:wrap}
.images figure{display:flex;flex-direction:column;align-items:center;gap:0.5vmin;max-height:100%;max-width:100%}
.images.single figure{max-height:100%;max-width:100%}
.images img{max-width:100%;max-height:55vmin;object-fit:contain;border-radius:0.3vmin}
.images figcaption{font-size:0.7rem;color:var(--text-light);font-style:italic}

/* Links */
.links{display:flex;flex-direction:column;gap:0.8vmin}
.links a{color:var(--accent2);text-decoration:none;font-size:clamp(0.75rem,1.5vmin,1rem)}
.links a:hover{text-decoration:underline}

/* === LAYOUT: title === */
.layout-title{background:var(--bg-dark)!important;flex-direction:row;gap:5vmin;padding:0}
.title-left{flex:0 0 40%;display:flex}
.accent-block{background:var(--accent);padding:5vmin;display:flex;align-items:flex-start;width:100%}
.accent-block h1{color:#fff;font-size:clamp(1.5rem,4.5vmin,3rem)}
.title-right{flex:1;display:flex;flex-direction:column;justify-content:center;gap:2vmin;padding:5vmin 5vmin 5vmin 0;color:#fff}
.title-right .subtitle{color:rgba(255,255,255,0.7)}
.title-right p{color:rgba(255,255,255,0.6)}
.pills{display:flex;flex-direction:column;gap:0.8vmin;margin-top:auto}
.pill{padding:1.2vmin 2vmin;color:#fff;font-weight:700;font-size:clamp(0.7rem,1.3vmin,0.9rem);opacity:0.85}

/* === LAYOUT: section === */
.layout-section{background:var(--bg-dark)!important;justify-content:center;align-items:flex-start;padding:5vmin 8vmin}
.layout-section h1,.layout-section .section-title{color:#fff;font-size:clamp(2rem,6vmin,4rem)}
.layout-section .subtitle{color:rgba(255,255,255,0.5);margin-top:1vmin}
.layout-section .label{color:var(--accent)}
.accent-bar{width:8vmin;height:0.3vmin;background:var(--accent);margin:2vmin 0}
.layout-section .links a{color:var(--accent2)}

/* === LAYOUT: stagger === */
.stagger-bars{display:flex;flex-direction:column;gap:0.6vmin;flex:1}
.stagger-bar{padding:2vmin 3vmin;color:#fff;font-weight:700;font-size:clamp(0.85rem,1.8vmin,1.2rem);opacity:0.88}

/* === LAYOUT: split === */
.layout-split{flex-direction:row;gap:4vmin;padding:5vmin}
.split-left{flex:0 0 38%;display:flex;flex-direction:column;gap:1.5vmin;
  border-right:1px solid color-mix(in srgb,var(--accent) 15%,transparent);padding-right:4vmin}
.split-right{flex:1;display:flex;flex-direction:column;gap:1.5vmin;overflow:auto}

/* === LAYOUT: rotated === */
.layout-rotated{flex-direction:row;padding:0}
.rotated-bar{flex:0 0 15%;background:color-mix(in srgb,var(--accent) 85%,transparent);
  display:flex;align-items:center;justify-content:center;overflow:hidden}
.rotated-text{color:#fff;font-weight:700;font-size:clamp(1.5rem,4vmin,3rem);
  writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:0.05em}
.rotated-content{flex:1;padding:5vmin;display:flex;flex-direction:column;justify-content:center;gap:2vmin}
.rotated-body{font-size:clamp(0.95rem,2.2vmin,1.4rem);line-height:1.6;color:var(--text)}
.rotated-bullet{color:var(--text-mid);font-size:clamp(0.8rem,1.5vmin,1rem)}

/* === LAYOUT: fragment === */
.frag-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0.5vmin;flex:1}
.frag-cell{display:flex;align-items:center;padding:2vmin;color:#fff;font-weight:700;
  font-size:clamp(0.7rem,1.4vmin,0.95rem);opacity:0.85}

/* === LAYOUT: overlap === */
.overlap-fields{display:flex;flex:1;position:relative;margin-top:2vmin}
.overlap-a,.overlap-b{padding:3vmin;color:#fff;flex:1;display:flex;flex-direction:column;gap:1vmin;
  font-size:clamp(0.85rem,1.6vmin,1.1rem)}
.overlap-a{background:color-mix(in srgb,var(--accent) 70%,transparent);margin-right:-5vmin;z-index:1}
.overlap-b{background:color-mix(in srgb,var(--accent2) 65%,transparent);margin-left:-5vmin}

/* === LAYOUT: arc === */
.layout-arc{flex-direction:row;gap:3vmin}
.arc-left{flex:0 0 45%;display:flex;flex-direction:column;gap:2vmin;justify-content:center}
.arc-right{flex:1;display:flex;align-items:center;justify-content:center}
.arc-outer{width:min(35vmin,300px);aspect-ratio:1;border-radius:50%;
  border:3px solid var(--accent);display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--accent) 5%,transparent)}
.arc-inner{width:60%;aspect-ratio:1;border-radius:50%;
  border:2px solid var(--accent2);display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--accent2) 5%,transparent)}
.arc-dot{width:10px;height:10px;border-radius:50%;background:var(--accent)}

/* === LAYOUT: image === */
.layout-image{gap:1.5vmin}

/* Progress & counter */
.progress{position:fixed;bottom:0;left:0;right:0;height:3px;background:rgba(128,128,128,0.2);z-index:100}
.progress-bar{height:100%;background:var(--accent);transition:width 0.3s ease;width:0}
.counter{position:fixed;bottom:8px;right:16px;font-family:var(--font);font-size:11px;
  color:rgba(128,128,128,0.5);z-index:100}

/* Notes panel */
.notes-panel{position:fixed;bottom:0;left:0;right:0;height:0;background:rgba(0,0,0,0.95);
  color:#ccc;overflow:auto;transition:height 0.3s ease;z-index:200;padding:0}
.notes-panel.open{height:25vh;padding:16px 24px}
.notes-panel h3{font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#666;margin-bottom:8px}
.notes-content{font-family:var(--font);font-size:14px;line-height:1.6;white-space:pre-wrap}
`;
}

function generateHTMLJS() {
  return `
(function(){
  const slides=document.querySelectorAll('.slide');
  const bar=document.querySelector('.progress-bar');
  const counter=document.querySelector('.counter');
  const notesPanel=document.querySelector('.notes-panel');
  const notesContent=document.querySelector('.notes-content');
  let cur=0,notesOpen=false;

  function go(n){
    if(n<0||n>=slides.length)return;
    slides[cur].classList.remove('active');
    cur=n;
    slides[cur].classList.add('active');
    bar.style.width=((cur+1)/slides.length*100)+'%';
    counter.textContent=(cur+1)+' / '+slides.length;
    const noteEl=slides[cur].querySelector('.slide-notes');
    notesContent.textContent=noteEl?noteEl.textContent:'(no notes)';
  }

  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){e.preventDefault();go(cur+1)}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(cur-1)}
    else if(e.key==='Home'){e.preventDefault();go(0)}
    else if(e.key==='End'){e.preventDefault();go(slides.length-1)}
    else if(e.key==='n'||e.key==='N'){
      notesOpen=!notesOpen;
      notesPanel.classList.toggle('open',notesOpen);
    }
    else if(e.key==='f'||e.key==='F'){
      if(!document.fullscreenElement)document.documentElement.requestFullscreen().catch(function(){});
      else document.exitFullscreen();
    }
  });

  // Touch/swipe support
  let tx=0;
  document.addEventListener('touchstart',function(e){tx=e.touches[0].clientX},{passive:true});
  document.addEventListener('touchend',function(e){
    const dx=e.changedTouches[0].clientX-tx;
    if(Math.abs(dx)>50){dx<0?go(cur+1):go(cur-1)}
  },{passive:true});

  // Click left/right halves
  document.addEventListener('click',function(e){
    if(e.target.tagName==='A')return;
    if(e.clientX>window.innerWidth*0.65)go(cur+1);
    else if(e.clientX<window.innerWidth*0.35)go(cur-1);
  });

  go(0);
})();
`;
}

async function generateHTML(inputPath, outputPath, options = {}) {
  const themeName = options.theme || "light";
  const theme = THEMES[themeName] || THEMES.light;
  const globalFont = options.font || "Helvetica Neue";

  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);

  const cssVars = Object.entries({
    bg: theme.bg, "bg-alt": theme.bgAlt, "bg-dark": theme.bgDark,
    text: theme.text, "text-mid": theme.textMid, "text-light": theme.textLight,
    accent: theme.accent, accent2: theme.accent2, accent3: theme.accent3, accent4: theme.accent4,
    white: theme.white, black: theme.black, grey: theme.grey,
  }).map(([k, v]) => `--${k}:#${v}`).join(";");

  const slidesHTML = slides.map((slide, idx) => {
    const layout = detectLayout(slide, idx, slides.length);
    const renderer = HTML_LAYOUTS[layout] || HTML_LAYOUTS.split;
    const fontStyle = slide.fontOverride ? ` style="font-family:'${esc(slide.fontOverride)}',var(--font)"` : "";
    const bgStyle = slide.bgOverride ? ` style="background:#${slide.bgOverride}"` : "";
    const style = fontStyle || bgStyle;
    return `<section class="slide layout-${layout}"${style}>${renderer(slide)}${slideNotes(slide)}</section>`;
  }).join("\n");

  const title = esc(path.basename(inputPath, ".md"));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
:root{${cssVars};--font:'${globalFont}','Helvetica Neue',Helvetica,Arial,sans-serif}
${generateHTMLCSS()}
</style>
</head>
<body>
<div class="deck">
${slidesHTML}
</div>
<div class="progress"><div class="progress-bar"></div></div>
<div class="counter"></div>
<div class="notes-panel"><h3>Speaker Notes</h3><div class="notes-content"></div></div>
<script>
${generateHTMLJS()}
</script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, "utf-8");
  return { slides: slides.length, output: outputPath, theme: themeName };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  rastersysteme — Swiss 60-column grid slide generator

  Usage:
    node raster.js <input.md> [output] [options]

  Options:
    --theme <name>   Theme: light (default), dark, red, blue
    --ratio <r>      Aspect ratio: 16:9 (default), 4:3
    --font <name>    Default font: "Helvetica Neue" (default)
    --format <f>     Output format: pptx (default), html
    --help           Show this help

  Markdown format:
    Slides separated by ---
    # Title \u2192 slide title
    ## Subtitle
    ### Section Label \u2192 small caps label
    - Bullet points (indent 2 spaces for nesting)
      - Nested sub-bullet
    > Blockquote \u2192 callout text
    ![alt](path) \u2192 embedded image
    | col | col | \u2192 table (with |---|---| separator)
    \`\`\`lang ... \`\`\` \u2192 code block (monospace)
    \`\`\`notes ... \`\`\` \u2192 speaker notes
    <!-- layout: name --> \u2192 force layout
    <!-- bg: HEXCOLOR --> \u2192 background override
    <!-- font: Name --> \u2192 per-slide font override

  Layouts (auto-detected or forced):
    title     First slide, accent block + pills
    section   Dark background, large centred text
    bullets   Numbered bullets with accent dots
    stagger   Musica Viva cascading colour bars
    split     Left title zone, right content
    rotated   Vertical rotated title bar
    fragment  Fragmented colour grid of items
    overlap   Two overlapping colour fields
    arc       Concentric circles + left text
    image     Image(s) with title and caption
    table     Data table with styled header
    code      Code block with monospace type
    blank     Empty slide
    `);
    process.exit(0);
  }

  const input = args[0];

  const themeIdx = args.indexOf("--theme");
  const theme = themeIdx >= 0 ? args[themeIdx + 1] : "light";

  const ratioIdx = args.indexOf("--ratio");
  const ratio = ratioIdx >= 0 ? args[ratioIdx + 1] : "16:9";

  const fontIdx = args.indexOf("--font");
  const font = fontIdx >= 0 ? args[fontIdx + 1] : undefined;

  const formatIdx = args.indexOf("--format");
  const format = formatIdx >= 0 ? args[formatIdx + 1] : "pptx";

  const ext = format === "html" ? ".html" : ".pptx";
  let output = args[1] && !args[1].startsWith("--") ? args[1] : input.replace(/\.md$/, ext);

  if (!fs.existsSync(input)) {
    console.error("Error: File not found: " + input);
    process.exit(1);
  }

  const gen = format === "html" ? generateHTML : generate;
  gen(input, output, { theme, ratio, font })
    .then(result => {
      console.log("\u2713 Generated " + result.slides + " slides \u2192 " + result.output);
      console.log("  Theme: " + result.theme + " | Format: " + format + " | Ratio: " + ratio);
    })
    .catch(err => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}

module.exports = { generate, generateHTML, parseMarkdown, createGrid, THEMES, LAYOUTS };
