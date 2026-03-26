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
    return {
      ...theme,
      text: "F0EBE3", textMid: "B8B0A2", textLight: "A09890",
      accentLight: "F09080", white: "F0EBE3",
    };
  }
  if (!bgDark && themeBgDark) {
    return {
      ...theme,
      text: "1A1A1A", textMid: "5C5549", textLight: "7A7168",
    };
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
    bg: "F8F5F0", bgAlt: "FAFAF7", bgDark: "1A1A1A",
    text: "1A1A1A", textMid: "5C5549", textLight: "65594E",
    accent: "B7311A", accentLight: "F09080", accent2: "1B5E80", accent3: "2B7038", accent4: "876512",
    white: "FFFFFF", black: "1A1A1A", grey: "D4CEC4",
  },
  dark: {
    bg: "1A1A1A", bgAlt: "242424", bgDark: "111111",
    text: "F0EBE3", textMid: "C4BDB0", textLight: "A09890",
    accent: "B7311A", accentLight: "F09080", accent2: "1B5E80", accent3: "2B7038", accent4: "876512",
    white: "F0EBE3", black: "1A1A1A", grey: "3A3A3A",
  },
  red: {
    bg: "F8F5F0", bgAlt: "FAFAF7", bgDark: "6B1A10",
    text: "1A1A1A", textMid: "5C5549", textLight: "65594E",
    accent: "B7311A", accentLight: "F09080", accent2: "1B5E80", accent3: "2B7038", accent4: "876512",
    white: "FFFFFF", black: "1A1A1A", grey: "D4CEC4",
  },
  blue: {
    bg: "F0F4F8", bgAlt: "F7FAFB", bgDark: "0F2A4A",
    text: "1A1A1A", textMid: "4A5568", textLight: "4E5766",
    accent: "1B5E80", accentLight: "80C0D8", accent2: "B7311A", accent3: "2B7038", accent4: "876512",
    white: "FFFFFF", black: "1A1A1A", grey: "CBD5E0",
  },
};

// ═══════════════════════════════════════════════════════
// MARKDOWN PARSER
// ═══════════════════════════════════════════════════════

// Normalise Claude's varied design JSON formats to our expected schema
function normaliseDesign(raw) {
  if (!raw || typeof raw !== "object") return null;
  const d = { zones: [], accents: [], typography: {} };

  // Copy through standard fields
  d.bg = (raw.bg || raw.background || "").replace(/^#/, "") || undefined;
  d.font = raw.font || undefined;
  d.gap = raw.gap || undefined;

  // Normalise a single zone object from Claude's varied key names
  function normaliseZone(z, role) {
    return {
      role: z.role || z.id || z.type || role,
      col: z.col ?? z.x ?? 0,
      span: z.span ?? z.colSpan ?? z.width ?? 30,
      row: z.row ?? z.y ?? 0,
      rowSpan: z.rowSpan ?? z.height ?? 20,
    };
  }

  // Normalise an accent from Claude's varied formats
  function normaliseAccent(a) {
    return {
      type: a.type || "bar",
      col: a.col ?? a.x ?? 0,
      span: a.span ?? a.colSpan ?? a.width ?? 2,
      row: a.row ?? a.y ?? 0,
      rowSpan: a.rowSpan ?? a.height ?? 40,
      color: (a.color || a.fill || a.stroke || "E63946").replace(/^#/, ""),
    };
  }

  // Case 1: zones is already an array
  if (Array.isArray(raw.zones)) {
    d.zones = raw.zones.map(z => normaliseZone(z, z.role || z.id || "body"));
  }
  // Case 2: zones is an object { title: {...}, body: {...} }
  else if (raw.zones && typeof raw.zones === "object") {
    for (const [role, z] of Object.entries(raw.zones)) {
      d.zones.push(normaliseZone(z, role));
    }
  }
  // Case 3: no zones, but has titleZone/bodyZone keys
  else {
    if (raw.titleZone) d.zones.push(normaliseZone(raw.titleZone, "title"));
    if (raw.bodyZone) d.zones.push(normaliseZone(raw.bodyZone, "body"));
    if (raw.labelZone || raw.label) {
      const lz = raw.labelZone || raw.label;
      if (typeof lz === "object" && lz.col !== undefined) d.zones.push(normaliseZone(lz, "label"));
    }
  }

  // Normalise accents
  if (Array.isArray(raw.accents)) {
    d.accents = raw.accents.map(normaliseAccent);
  } else {
    // Look for accent-like keys: accentBar, rule, vbar, etc.
    for (const [key, val] of Object.entries(raw)) {
      if ((key.includes("accent") || key.includes("bar") || key.includes("rule")) &&
          typeof val === "object" && val !== null && !Array.isArray(val)) {
        d.accents.push(normaliseAccent(val));
      }
    }
  }

  // Normalise typography
  if (raw.typography) {
    d.typography = raw.typography;
  } else {
    // Extract typography from zone-level or top-level keys
    for (const role of ["title", "body", "label"]) {
      const src = raw[role] || raw[`${role}Zone`] || {};
      if (src.size || src.fontSize || src.weight || src.fontWeight) {
        d.typography[role] = {
          size: src.size || src.fontSize,
          weight: src.weight || src.fontWeight,
          transform: src.transform || src.case === "upper" ? "uppercase" : undefined,
          tracking: src.tracking || src.letterSpacing,
        };
      }
    }
  }

  // Must have at least one zone OR accent to be valid
  if (d.zones.length === 0 && d.accents.length === 0) return null;

  return d;
}

function parseMarkdownTable(lines, slide) {
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

  // Extract images and body text from table cells (handles PowerPoint export format)
  if (slide) {
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const allCells = [...headers, ...rows.flat()];
    for (const cell of allCells) {
      // Extract images
      let m;
      while ((m = imgRegex.exec(cell)) !== null) {
        const ytId = extractYouTubeId(m[2]);
        if (ytId) {
          slide.videos.push({ title: m[1] || "", id: ytId, url: m[2] });
        } else {
          slide.images.push({ alt: m[1], src: m[2] });
        }
      }
      // Extract text content from cells with <br> separators (PowerPoint export)
      const textContent = cell
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "")  // strip images
        .replace(/<br\s*\/?>/gi, "\n")               // <br> → newlines
        .replace(/\n{2,}/g, "\n")                    // collapse multiple newlines
        .trim();
      if (textContent.length > 3) {
        // Split on newlines to get paragraphs
        const lines = textContent.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        lines.forEach(line => {
          // Don't duplicate content already captured as title/subtitle/sectionLabel
          if (line !== slide.title && line !== slide.subtitle && line !== slide.sectionLabel) {
            slide.body.push(line);
          }
        });
      }
    }
  }

  return { headers, alignments, rows };
}

// ═══════════════════════════════════════════════════════
// YOUTUBE HELPERS
// ═══════════════════════════════════════════════════════

const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

function extractYouTubeId(url) {
  const m = url.match(YT_REGEX);
  return m ? m[1] : null;
}

function parseMarkdown(md) {
  // Strip multi-line HTML comments BEFORE splitting on --- separators.
  // This prevents <!-- ... --> blocks that span multiple slides from
  // leaking their delimiters into rendered slides.
  // Preserve directive comments (<!-- layout: -->, <!-- design: {...} -->, etc.)
  md = md.replace(/<!--[\s\S]*?-->/g, (match) => {
    if (!match.includes("\n")) return match; // single-line — always keep
    if (/<!--\s*(layout|bg|font|transition|style|design|master|image):/.test(match)) return match; // directive — keep
    return ""; // generic multi-line comment — strip
  });

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
      videos: [],
      tables: [],
      codeBlocks: [],
      fontOverride: null,
      transition: null,
      style: null,
      design: null,
      raw: slideText.trim(),
    };

    // Extract directives
    const layoutMatch = slideText.match(/<!--\s*layout:\s*(\w+)\s*-->/);
    if (layoutMatch) slide.layout = layoutMatch[1];

    const bgMatch = slideText.match(/<!--\s*bg:\s*([#\w]+)\s*-->/);
    if (bgMatch) slide.bgOverride = bgMatch[1].replace("#", "");

    const fontMatch = slideText.match(/<!--\s*font:\s*([^->]+?)\s*-->/);
    if (fontMatch) slide.fontOverride = fontMatch[1].trim();

    const transMatch = slideText.match(/<!--\s*transition:\s*(\w[\w-]*)\s*-->/);
    if (transMatch) slide.transition = transMatch[1].trim();

    // Style overrides: <!-- style: title-size=48; spacing=tight; opacity=0.8 -->
    const styleMatch = slideText.match(/<!--\s*style:\s*(.+?)\s*-->/);
    if (styleMatch) {
      slide.style = {};
      styleMatch[1].split(";").forEach(pair => {
        const [k, v] = pair.split("=").map(s => s.trim());
        if (k && v) slide.style[k] = v;
      });
    }

    // Design directive: <!-- design: { "zones": [...], ... } -->
    const designMatch = slideText.match(/<!--\s*design:\s*([\s\S]*?)\s*-->/);
    if (designMatch) {
      try {
        const raw = JSON.parse(designMatch[1].trim());
        slide.design = normaliseDesign(raw);
      } catch {
        slide.design = null;
      }
    }

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
        const table = parseMarkdownTable(tableBuffer, slide);
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

      // Helper: extract inline ![alt](src) images from a string, return cleaned text
      function extractInlineImages(text) {
        const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let m;
        while ((m = imgRegex.exec(text)) !== null) {
          const ytId = extractYouTubeId(m[2]);
          if (ytId) {
            slide.videos.push({ title: m[1] || "", id: ytId, url: m[2] });
          } else {
            slide.images.push({ alt: m[1], src: m[2] });
          }
        }
        return text.replace(/!\[([^\]]*)\]\(([^)]+)\)\s*/g, "").trim();
      }

      // Headings — also extract any embedded images
      // Skip PowerPoint export counters like "## Slide 1", "## Slide 12"
      if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
        const raw = trimmed.replace(/^#\s+/, "");
        slide.title = extractInlineImages(raw) || slide.title;
      } else if (trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
        const raw = trimmed.replace(/^##\s+/, "");
        const cleaned = extractInlineImages(raw);
        // Skip PowerPoint export slide counters
        if (cleaned && !/^Slide\s+\d+$/i.test(cleaned)) {
          slide.subtitle = cleaned;
        }
      } else if (trimmed.startsWith("### ")) {
        const raw = trimmed.replace(/^###\s+/, "");
        const cleaned = extractInlineImages(raw);
        if (cleaned) {
          // Long ### content (>150 chars) is body text from PowerPoint export, not a section label
          if (cleaned.length > 150) {
            // Split on double-space or **bold** section headers to create body paragraphs
            const paragraphs = cleaned
              .split(/\s{2,}/)
              .map(p => p.trim())
              .filter(p => p.length > 0);
            // Use first short segment as title if none set
            if (!slide.title && !slide.subtitle && paragraphs[0].length < 100) {
              slide.subtitle = paragraphs.shift();
            }
            paragraphs.forEach(p => slide.body.push(p));
          } else {
            slide.sectionLabel = cleaned;
          }
        }
      }
      // Images or YouTube videos: ![alt](path) — standalone line
      else if (/^!\[([^\]]*)\]\(([^)]+)\)/.test(trimmed)) {
        extractInlineImages(trimmed);
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
      // Standalone links (YouTube URLs become videos)
      else if (/^\[.*\]\(.*\)$/.test(trimmed)) {
        const m = trimmed.match(/\[([^\]]*)\]\(([^)]*)\)/);
        if (m) {
          const ytId = extractYouTubeId(m[2]);
          if (ytId) {
            slide.videos.push({ title: m[1] || "", id: ytId, url: m[2] });
          } else {
            slide.links.push({ text: m[1], url: m[2] });
          }
        }
      }
      // Bare YouTube URL on its own line
      else if (YT_REGEX.test(trimmed) && /^https?:\/\//.test(trimmed)) {
        const ytId = extractYouTubeId(trimmed);
        if (ytId) slide.videos.push({ title: "", id: ytId, url: trimmed });
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

// Track layout history for variety in auto-detection
let _layoutHistory = [];

function detectLayout(slide, index, total) {
  if (slide.layout) return slide.layout;

  // Reset history for new decks
  if (index === 0) _layoutHistory = [];

  // First slide → title
  if (index === 0) { _layoutHistory.push("title"); return "title"; }

  // Last slide with minimal content → section
  if (index === total - 1 && !slide.title && slide.body.length <= 1) {
    _layoutHistory.push("section"); return "section";
  }

  // Has title + subtitle but little else → section
  if (slide.title && slide.subtitle && slide.bullets.length === 0 &&
      slide.body.length <= 1 && slide.images.length === 0 && slide.videos.length === 0 &&
      slide.tables.length === 0 && slide.codeBlocks.length === 0) {
    _layoutHistory.push("section"); return "section";
  }

  // New content types
  if (slide.videos.length > 0) { _layoutHistory.push("video"); return "video"; }
  if (slide.images.length > 0) { _layoutHistory.push("image"); return "image"; }
  if (slide.tables.length > 0) { _layoutHistory.push("table"); return "table"; }
  if (slide.codeBlocks.length > 0) { _layoutHistory.push("code"); return "code"; }

  // Many top-level bullets (4+) → stagger or fragment (rotate)
  const topLevel = slide.bullets.filter(b => (b.level || 0) === 0).length;
  if (topLevel >= 4 && topLevel === slide.bullets.length) {
    const last = _layoutHistory[_layoutHistory.length - 1];
    // Alternate between stagger and fragment for variety
    const choice = last === "stagger" ? "fragment" : "stagger";
    _layoutHistory.push(choice);
    return choice;
  }

  // Has bullets → bullets, but rotate to split if bullets was just used
  if (slide.bullets.length > 0) {
    const last = _layoutHistory[_layoutHistory.length - 1];
    const choice = last === "bullets" ? "split" : "bullets";
    _layoutHistory.push(choice);
    return choice;
  }

  // Has blockquote → rotated
  if (slide.blockquote) { _layoutHistory.push("rotated"); return "rotated"; }

  // Has title + body text → split, rotated, or overlap (rotate for variety)
  if (slide.title && slide.body.length > 0) {
    const last = _layoutHistory[_layoutHistory.length - 1];
    const prev2 = _layoutHistory[_layoutHistory.length - 2];
    let choice;
    if (last === "split" && prev2 === "split") choice = "rotated";
    else if (last === "split") choice = "split";
    else choice = "split";
    // Every 5th text slide, use arc for variety
    const splitCount = _layoutHistory.filter(l => l === "split").length;
    if (splitCount > 0 && splitCount % 4 === 0) choice = "arc";
    _layoutHistory.push(choice);
    return choice;
  }

  // Title only → section (but use rotated if section was just used)
  if (slide.title) {
    const last = _layoutHistory[_layoutHistory.length - 1];
    const choice = last === "section" ? "rotated" : "section";
    _layoutHistory.push(choice);
    return choice;
  }

  // Links list → fragment
  if (slide.links.length > 0) { _layoutHistory.push("fragment"); return "fragment"; }

  _layoutHistory.push("split");
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
        color: theme.accentLight || theme.accent, bold: true, margin: 0, charSpacing: 3,
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
    const items = slide.bullets.length > 0
      ? slide.bullets.map(b => b.text)
      : slide.body;
    const startRow = slide.title ? 10 : 2;
    const step = Math.min(7, Math.floor(30 / (items.length || 1)));
    const colStep = Math.min(8, Math.floor(30 / (items.length || 1)));

    items.forEach((text, i) => {
      const col = i * colStep;
      const row = startRow + i * step;
      if (row > 36) return;
      const c = colors[i % 4];
      const textOnDark = theme.white;

      s.addShape(pres.shapes.RECTANGLE, {
        x: g.cx(col), y: g.cy(row), w: g.cw(Math.min(42, 60 - col)), h: g.ch(Math.max(4, step - 1)),
        fill: { color: c, transparency: c === theme.accent4 ? 25 : 15 },
      });
      s.addText(text, {
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

    const items = [...slide.bullets.map(b => b.text), ...slide.body, ...slide.links.map(l => l.text)];
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
      const textColor = theme.white;
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

  // ─── VIDEO (PPTX fallback — clickable thumbnail placeholder) ───
  video(s, slide, g, theme, pres, num, opts) {
    const ff = opts.fontFace;
    s.background = { color: theme.bgAlt };

    if (slide.sectionLabel) {
      s.addText(slide.sectionLabel.toUpperCase(), {
        x: g.cx(0), y: g.cy(0), w: g.cw(30), h: g.ch(3),
        fontSize: 8, fontFace: ff,
        color: theme.accent, bold: true, margin: 0, charSpacing: 3,
      });
    }

    if (slide.title) {
      s.addText(slide.title, {
        x: g.cx(0), y: g.cy(slide.sectionLabel ? 3 : 0),
        w: g.cw(40), h: g.ch(7),
        fontSize: 28, fontFace: ff,
        color: theme.text, bold: true, margin: 0,
      });
    }

    // Render each video as a dark placeholder box with a play icon and link
    const startRow = slide.title ? 10 : 2;
    const rowSpan = slide.title ? 26 : 34;
    slide.videos.forEach((v, i) => {
      const perVideo = Math.floor(rowSpan / slide.videos.length);
      const row = startRow + i * perVideo;
      // Dark background box
      s.addShape(pres.ShapeType.rect, {
        x: g.cx(4), y: g.cy(row), w: g.cw(50), h: g.ch(perVideo - 2),
        fill: { color: "1A1A1A" }, rectRadius: 0.08,
      });
      // Play triangle + label
      const label = v.title || "YouTube Video";
      s.addText([
        { text: "\u25B6  ", options: { fontSize: 28, color: "FF0000" } },
        { text: label, options: { fontSize: 14, fontFace: ff, color: "FFFFFF", hyperlink: { url: v.url } } },
      ], {
        x: g.cx(4), y: g.cy(row), w: g.cw(50), h: g.ch(perVideo - 2),
        align: "center", valign: "middle",
      });
    });

    if (slide.body.length > 0) {
      s.addText(slide.body.join(" "), {
        x: g.cx(0), y: g.cy(36), w: g.cw(58), h: g.ch(3),
        fontSize: 9, fontFace: ff,
        color: theme.textLight, italic: true, margin: 0,
      });
    }

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

    // Use designed renderer for slides with a design directive
    if (slide.design) {
      renderDesignedPPTX(s, slide, g, effectiveTheme, pres, fontFace);
    } else {
      const renderer = LAYOUTS[layout] || LAYOUTS.split;
      renderer(s, slide, g, effectiveTheme, pres, idx + 1, opts);
    }

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
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/\\n/g, "<br>")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Linkify markdown [text](url) first
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="auto-link">$1</a>')
    // Then auto-link remaining bare URLs (not already inside an href)
    .replace(/(?<!href=")(https?:\/\/[^\s<>"')\]]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="auto-link">$1</a>');
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
    links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.text)} \u2192</a>`).join("\n") +
    '</div>';
}

function imagesHTML(images) {
  if (!images.length) return "";
  const cls = images.length === 1 ? "images single" : "images grid";
  return `<div class="${cls}">` +
    images.map(img => `<figure><img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy"><figcaption>${esc(img.alt)}</figcaption></figure>`).join("\n") +
    '</div>';
}

function videosHTML(videos) {
  if (!videos.length) return "";
  const cls = videos.length === 1 ? "videos single" : "videos grid";
  return `<div class="${cls}">` +
    videos.map(v => {
      const caption = v.title ? `<figcaption>${esc(v.title)}</figcaption>` : "";
      const iframeTitle = v.title ? esc(v.title) : "Embedded video";
      return `<figure class="video-wrap"><div class="video-responsive"><iframe src="https://www.youtube-nocookie.com/embed/${v.id}" title="${iframeTitle}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>${caption}</figure>`;
    }).join("\n") +
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
    const body = !slide.subtitle ? bodyHTML(slide.body) : "";
    return `<div class="title-left"><div class="accent-block">${slideTitle(slide, "h1")}</div></div>
<div class="title-right">${slideSubtitle(slide)}${body}${pills}</div>`;
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
    const items = slide.bullets.length > 0
      ? slide.bullets.map(b => b.text)
      : slide.body;
    const bars = items.map((text, i) => {
      const c = colors[i % 4];
      const ml = i * 8;
      return `<div class="stagger-bar" style="background:var(--${c});margin-left:${ml}%">${esc(text)}</div>`;
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
    const items = [
      ...slide.bullets.map(b => b.text),
      ...slide.body,
      ...slide.links.map(l => l.text),
    ];
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
    const caption = slide.body.length ? `<p class="image-caption">${esc(slide.body.join(" "))}</p>` : "";
    return `${slideLabel(slide)}${slideTitle(slide, "h1")}${imagesHTML(slide.images)}${caption}`;
  },

  video(slide) {
    const caption = slide.body.length ? `<p class="image-caption">${esc(slide.body.join(" "))}</p>` : "";
    return `${slideLabel(slide)}${slideTitle(slide, "h1")}${videosHTML(slide.videos)}${caption}`;
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

// ═══════════════════════════════════════════════════════
// DESIGNED SLIDE RENDERER (parameterised grid)
// ═══════════════════════════════════════════════════════

function typographyToCSS(typo) {
  if (!typo) return "";
  const parts = [];
  if (typo.size) parts.push(`font-size:${typo.size}px`);
  if (typo.weight) parts.push(`font-weight:${typo.weight}`);
  if (typo.transform) parts.push(`text-transform:${typo.transform}`);
  if (typo.tracking) parts.push(`letter-spacing:${typo.tracking}`);
  if (typo.leading) parts.push(`line-height:${typo.leading}`);
  if (typo.align) parts.push(`text-align:${typo.align}`);
  if (typo.color) parts.push(`color:#${typo.color.replace(/^#/, "")}`);
  return parts.join(";");
}

function zonePositionCSS(zone) {
  const left = (zone.col / 60 * 100).toFixed(4);
  const width = (zone.span / 60 * 100).toFixed(4);
  const top = (zone.row / 40 * 100).toFixed(4);
  const height = (zone.rowSpan / 40 * 100).toFixed(4);
  return `left:${left}%;width:${width}%;top:${top}%;height:${height}%`;
}

function renderDesigned(slide) {
  const design = slide.design;
  if (!design) return "";
  const typography = design.typography || {};
  const gapVal = design.gap === "tight" ? "0.5vmin" : design.gap === "loose" ? "4vmin" : "2vmin";

  // Render accent elements
  const accentsHTML = (design.accents || []).map(a => {
    const pos = zonePositionCSS(a);
    let extra = "";
    if (a.type === "bar") {
      extra = `background:#${(a.color || "E63946").replace(/^#/, "")}`;
    } else if (a.type === "line") {
      // Determine orientation: wider than tall = horizontal, else vertical
      const isHoriz = a.span / 60 > a.rowSpan / 40;
      if (isHoriz) {
        extra = `background:#${(a.color || "E63946").replace(/^#/, "")};height:2px;top:${(a.row / 40 * 100).toFixed(4)}%`;
      } else {
        extra = `background:#${(a.color || "E63946").replace(/^#/, "")};width:2px;left:${(a.col / 60 * 100).toFixed(4)}%`;
      }
    } else if (a.type === "dot") {
      const size = Math.min(parseFloat((a.span / 60 * 100).toFixed(4)), parseFloat((a.rowSpan / 40 * 100).toFixed(4)));
      extra = `background:#${(a.color || "E63946").replace(/^#/, "")};border-radius:50%;width:${size}%;height:0;padding-bottom:${size}%`;
    } else if (a.type === "block") {
      extra = `background:#${(a.color || "E63946").replace(/^#/, "")};opacity:0.15`;
    }
    return `<div class="accent-el accent-${a.type || "bar"}" style="${pos};${extra}"></div>`;
  }).join("\n");

  // Render zones
  // Deduplicate zones by role — Claude sometimes emits two "body" zones,
  // which causes the same content to render twice.
  const seenRoles = new Set();
  const deduped = (design.zones || []).filter(zone => {
    if (seenRoles.has(zone.role)) return false;
    seenRoles.add(zone.role);
    return true;
  });

  const zonesHTML = deduped.map(zone => {
    const pos = zonePositionCSS(zone);
    const typoStyle = typographyToCSS(typography[zone.role] || {});
    const style = [pos, typoStyle].filter(Boolean).join(";");
    let content = "";

    switch (zone.role) {
      case "title": {
        const text = slide.title || slide.subtitle || "";
        content = text ? `<h1 style="${typoStyle}">${esc(text)}</h1>` : "";
        break;
      }
      case "body": {
        content = slide.body.map(l => `<p style="${typoStyle}">${esc(l)}</p>`).join("\n");
        break;
      }
      case "bullets": {
        content = bulletsToHTML(slide.bullets);
        break;
      }
      case "label": {
        const labelText = slide.sectionLabel || "";
        const labelStyle = typographyToCSS(typography.label || {});
        content = labelText ? `<span class="label" style="font-variant-caps:small-caps;${labelStyle}">${esc(labelText)}</span>` : "";
        break;
      }
      case "quote": {
        content = slide.blockquote ? `<blockquote style="${typoStyle}">${esc(slide.blockquote)}</blockquote>` : "";
        break;
      }
      case "video": {
        content = videosHTML(slide.videos);
        break;
      }
      case "image": {
        content = imagesHTML(slide.images);
        break;
      }
      case "links": {
        content = linksHTML(slide.links);
        break;
      }
      case "code": {
        content = slide.codeBlocks.map(cb => codeToHTML(cb)).join("\n");
        break;
      }
      default:
        break;
    }

    return `<div class="zone zone-${zone.role}" style="${style};padding:${gapVal}">${content}</div>`;
  }).join("\n");

  // Append unzoned content: videos/images/links that have no matching zone in the design
  const zonedRoles = new Set((design.zones || []).map(z => z.role));
  let extras = "";
  if (slide.videos.length && !zonedRoles.has("video")) {
    extras += videosHTML(slide.videos);
  }
  if (slide.images.length && !zonedRoles.has("image")) {
    // Smart image placement — varies by zone layout, image count, and slide position
    const zones = design.zones || [];
    const textLeft = Math.min(...zones.map(z => (z.col || 0) / 60 * 100), 100);
    const textRight = Math.max(...zones.map(z => ((z.col || 0) + (z.span || 30)) / 60 * 100), 0);
    const textTop = Math.min(...zones.map(z => (z.row || 0) / 40 * 100), 100);
    const textBottom = Math.max(...zones.map(z => ((z.row || 0) + (z.rowSpan || 20)) / 40 * 100), 0);
    const textBodyLen = slide.body.join(" ").length + (slide.blockquote || "").length;
    const isImageHeavy = slide.images.length > 1 && textBodyLen < 100;
    const isImagePrimary = !slide.title && !slide.subtitle && textBodyLen < 50;

    // Determine placement strategy
    let imgStyle;
    if (isImagePrimary) {
      // Image IS the slide — show large, centred
      imgStyle = `position:absolute;inset:5%;overflow:hidden;z-index:0;opacity:0.9;display:flex;align-items:center;justify-content:center`;
    } else if (isImageHeavy) {
      // Multiple images, light text — grid them across the right half
      imgStyle = `position:absolute;right:2%;top:5%;width:45%;height:90%;overflow:hidden;z-index:0;opacity:0.85;display:flex;flex-direction:column;gap:2%;justify-content:center`;
    } else if (textRight < 65) {
      // Text occupies left side — image goes right, tall panel
      imgStyle = `position:absolute;right:2%;top:8%;width:32%;height:70%;overflow:hidden;z-index:0;opacity:0.85;border-radius:4px`;
    } else if (textLeft > 20) {
      // Text is offset right — image goes left
      imgStyle = `position:absolute;left:2%;top:8%;width:18%;height:60%;overflow:hidden;z-index:0;opacity:0.85;border-radius:4px`;
    } else if (textTop > 25) {
      // Text starts low — image strip across top
      imgStyle = `position:absolute;top:3%;left:5%;right:5%;height:22%;overflow:hidden;z-index:0;opacity:0.8;border-radius:4px`;
    } else if (textBottom < 70) {
      // Text ends early — image strip across bottom
      imgStyle = `position:absolute;bottom:3%;left:5%;right:5%;height:28%;overflow:hidden;z-index:0;opacity:0.85;border-radius:4px`;
    } else {
      // Text fills most of the slide — small inset, use slide index to vary corner
      const corner = (slide.index || 0) % 4;
      const positions = [
        `position:absolute;right:3%;top:5%;width:22%;height:30%;overflow:hidden;z-index:0;opacity:0.7;border-radius:4px`,
        `position:absolute;left:3%;bottom:5%;width:22%;height:30%;overflow:hidden;z-index:0;opacity:0.7;border-radius:4px`,
        `position:absolute;right:3%;bottom:5%;width:22%;height:30%;overflow:hidden;z-index:0;opacity:0.7;border-radius:4px`,
        `position:absolute;left:3%;top:5%;width:22%;height:30%;overflow:hidden;z-index:0;opacity:0.7;border-radius:4px`,
      ];
      imgStyle = positions[corner];
    }

    const showImages = isImagePrimary ? slide.images : slide.images.slice(0, 2);
    const imgFit = isImagePrimary ? 'object-fit:contain;max-width:100%;max-height:100%' : 'width:100%;height:auto;object-fit:cover';
    const imgHTML = showImages.map(img =>
      `<img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy" style="${imgFit};display:block;margin-bottom:4px;border-radius:3px">`
    ).join("");
    extras += `<div style="${imgStyle}">${imgHTML}</div>`;
  }
  if (slide.links.length && !zonedRoles.has("links")) {
    extras += linksHTML(slide.links);
  }
  const extrasHTML = extras
    ? (slide.images.length && !zonedRoles.has("image"))
      ? extras  // images already positioned absolutely
      : `<div class="zone zone-extras" style="position:absolute;left:10%;right:10%;top:5%;bottom:5%;display:flex;flex-direction:column;justify-content:center;z-index:1;pointer-events:auto">${extras}</div>`
    : "";

  return `${accentsHTML}\n${zonesHTML}\n${extrasHTML}`;
}

function renderDesignedPPTX(s, slide, g, theme, pres, fontFace) {
  const design = slide.design;
  if (!design) return;
  const typography = design.typography || {};

  // Background
  if (design.bg) {
    s.background = { color: design.bg.replace(/^#/, "") };
  }

  // Render accent elements
  (design.accents || []).forEach(a => {
    const color = (a.color || "E63946").replace(/^#/, "");
    if (a.type === "dot") {
      s.addShape(pres.shapes.OVAL, {
        x: g.cx(a.col), y: g.cy(a.row),
        w: g.cw(a.span), h: g.ch(a.rowSpan),
        fill: { color },
      });
    } else if (a.type === "block") {
      s.addShape(pres.shapes.RECTANGLE, {
        x: g.cx(a.col), y: g.cy(a.row),
        w: g.cw(a.span), h: g.ch(a.rowSpan),
        fill: { color, transparency: 85 },
      });
    } else if (a.type === "line") {
      s.addShape(pres.shapes.RECTANGLE, {
        x: g.cx(a.col), y: g.cy(a.row),
        w: a.span / 60 > a.rowSpan / 40 ? g.cw(a.span) : 0.02,
        h: a.span / 60 > a.rowSpan / 40 ? 0.02 : g.ch(a.rowSpan),
        fill: { color },
      });
    } else {
      // bar (default)
      s.addShape(pres.shapes.RECTANGLE, {
        x: g.cx(a.col), y: g.cy(a.row),
        w: g.cw(a.span), h: g.ch(a.rowSpan),
        fill: { color },
      });
    }
  });

  // Render zones
  const ff = design.font || fontFace;
  (design.zones || []).forEach(zone => {
    const typo = typography[zone.role] || {};
    const textOpts = {
      x: g.cx(zone.col), y: g.cy(zone.row),
      w: g.cw(zone.span), h: g.ch(zone.rowSpan),
      fontSize: typo.size || 14,
      fontFace: ff,
      color: typo.color ? typo.color.replace(/^#/, "") : theme.text,
      bold: (typo.weight || 400) >= 700,
      margin: [4, 8, 4, 8],
      valign: "top",
    };
    if (typo.align) textOpts.align = typo.align;
    if (typo.leading) textOpts.lineSpacingMultiple = typo.leading;
    if (typo.tracking) {
      const em = parseFloat(typo.tracking);
      if (!isNaN(em)) textOpts.charSpacing = em * (typo.size || 14);
    }

    let text = "";
    switch (zone.role) {
      case "title":
        text = slide.title || slide.subtitle || "";
        break;
      case "body":
        text = slide.body.join("\n");
        break;
      case "bullets":
        text = slide.bullets.map(b => {
          const prefix = (b.level || 0) === 0 ? "\u2022 " : "  \u2014 ";
          return prefix + b.text;
        }).join("\n");
        break;
      case "label":
        text = (slide.sectionLabel || "").toUpperCase();
        if (typo.tracking) {
          const em = parseFloat(typo.tracking);
          if (!isNaN(em)) textOpts.charSpacing = em * (typo.size || 8);
        }
        break;
      case "quote":
        text = slide.blockquote || "";
        textOpts.italic = true;
        break;
      default:
        break;
    }

    if (text) {
      s.addText(text, textOpts);
    }
  });
}

function generateHTMLCSS() {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.deck{width:100vw;height:100vh;position:relative}
.slide{position:absolute;inset:0;padding:5vmin;display:none;flex-direction:column;gap:2vmin;
  font-family:var(--font);color:var(--text);background:var(--bg-alt);overflow:hidden}
.slide.active{display:flex}

/* === Designed slides (parameterised grid) === */
.slide.designed{position:absolute;inset:0;overflow:hidden;padding:0}
.slide.designed .zone{position:absolute;display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden;z-index:2}
.slide.designed .accent-el{position:absolute;pointer-events:none}

/* Typography — uses CSS custom properties for per-slide overrides */
h1{font-size:var(--title-size,clamp(1.8rem,5vmin,3.5rem));font-weight:700;line-height:1.1;letter-spacing:-0.02em}
h2.subtitle{font-size:var(--body-size,clamp(1rem,2.5vmin,1.6rem));font-weight:400;color:var(--text-mid)}
p{font-size:var(--body-size,clamp(0.85rem,1.8vmin,1.2rem));line-height:1.5;color:var(--text-mid)}
.slide{gap:var(--slide-gap,2vmin)}
.label{font-size:clamp(0.75rem,0.9vmin,0.85rem);letter-spacing:0.25em;text-transform:uppercase;
  color:var(--accent);font-weight:700;display:block;margin-bottom:1vmin}
.layout-section .label{color:var(--accent-light,var(--accent))}
blockquote{border-left:3px solid var(--accent);padding:1.5vmin 2vmin;margin:1vmin 0;
  background:color-mix(in srgb,var(--accent) 6%,transparent);font-style:italic;color:var(--text-mid);
  font-size:clamp(0.8rem,1.6vmin,1.1rem);line-height:1.5}

/* Bullets */
.bullets{display:flex;flex-direction:column;gap:1.2vmin;flex:1;min-height:0}
.bullet{display:flex;align-items:baseline;gap:1.2vmin}
.bullet.level-0{font-size:clamp(0.9rem,2vmin,1.3rem);color:var(--text)}
.bullet.level-1{font-size:clamp(0.8rem,1.6vmin,1.1rem);color:var(--text-mid);padding-left:3vmin}
.bullet.level-2,.bullet.level-3{font-size:clamp(0.8rem,1.6vmin,1rem);color:var(--text-light);padding-left:6vmin}
.dot{width:2.4vmin;height:2.4vmin;min-width:18px;min-height:18px;border-radius:50%;color:var(--white);
  font-size:clamp(0.7rem,1vmin,0.75rem);font-weight:700;display:inline-flex;align-items:center;
  justify-content:center;flex-shrink:0}
.dash{color:var(--text-light);flex-shrink:0}

/* Tables */
table{width:100%;border-collapse:collapse;font-size:clamp(0.7rem,1.4vmin,0.95rem)}
thead th{background:var(--accent);color:var(--white);padding:1vmin 1.5vmin;font-weight:700;
  border:1px solid var(--accent)}
tbody td{padding:0.8vmin 1.5vmin;border:1px solid var(--grey)}
tbody tr:nth-child(even){background:var(--bg)}
tbody tr:nth-child(odd){background:var(--bg-alt)}

/* Code */
.code-block{position:relative;background:var(--code-bg,#2D2D2D);border-radius:0.5vmin;flex:1;min-height:0;overflow:auto}
.code-block pre{padding:2.5vmin;margin:0;overflow:auto;height:100%}
.code-block code{font-family:'SF Mono','Fira Code','Cascadia Code','Courier New',monospace;
  font-size:clamp(0.65rem,1.3vmin,0.9rem);color:#F8F8F2;line-height:1.6;white-space:pre;display:block}
.code-lang{position:absolute;top:0.8vmin;right:1.2vmin;font-size:0.75rem;color:#888;
  font-family:var(--font);text-transform:uppercase;letter-spacing:0.1em}

/* Images */
.images{flex:1;display:flex;align-items:center;justify-content:center;gap:2vmin;min-height:0}
.images.grid{flex-wrap:wrap}
.images figure{display:flex;flex-direction:column;align-items:center;gap:0.5vmin;max-height:100%;max-width:100%}
.images.single figure{max-height:100%;max-width:100%}
.images img{max-width:100%;max-height:55vmin;object-fit:contain;border-radius:0.3vmin}
.images img[src$=".png"],.images img[src$=".jpg"],.images img[src$=".jpeg"]{
  /* Hide broken images gracefully */}
img:not([src]),.images img[alt]:not([src]){display:none}
/* Mixed layout: when image layout has bullets, split into flex row */
.layout-image{flex-direction:row;gap:3vmin}
.layout-image .images{flex:0 0 45%;max-height:100%}
.layout-image .bullets{flex:1}
.images figcaption{font-size:0.7rem;color:var(--text-light);font-style:italic}

/* Videos */
.videos{flex:1;display:flex;align-items:center;justify-content:center;gap:2vmin;min-height:0}
.videos.grid{flex-wrap:wrap}
.videos figure.video-wrap{display:flex;flex-direction:column;align-items:center;gap:0.5vmin;flex:1;max-width:100%;min-width:0}
.videos.single figure.video-wrap{max-width:85%;width:85%}
.video-responsive{position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.5vmin}
.video-responsive iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}
.extra-videos{position:absolute;right:5vmin;bottom:5vmin;width:45%;max-height:55%;z-index:5;
  border-radius:0.5vmin;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3)}
.extra-videos .videos,.extra-videos .videos.single{width:100%;height:100%}
.extra-videos .videos figure.video-wrap{max-width:100%;width:100%}
.extra-videos .video-responsive{max-height:100%}
.videos figcaption{font-size:0.7rem;color:var(--text-light);font-style:italic}

/* Links */
.links{display:flex;flex-direction:column;gap:0.8vmin}
.links a{color:var(--accent2);text-decoration:none;font-size:clamp(0.75rem,1.5vmin,1rem)}
.links a:hover{text-decoration:underline}
a.auto-link{color:var(--accent2);text-decoration:underline;text-decoration-thickness:1px;
  text-underline-offset:2px;word-break:break-all;font-size:inherit}
a.auto-link:hover{color:var(--accent);text-decoration-thickness:2px}

/* === LAYOUT: title === */
.layout-title{background:var(--bg-dark);flex-direction:row;gap:5vmin;padding:0}
.title-left{flex:0 0 40%;display:flex}
.accent-block{background:var(--accent);padding:5vmin;display:flex;align-items:flex-start;width:100%}
.accent-block h1{color:var(--white);font-size:clamp(1.5rem,4.5vmin,3rem)}
.title-right{flex:1;display:flex;flex-direction:column;justify-content:center;gap:2vmin;padding:5vmin 5vmin 5vmin 0;color:var(--white)}
.title-right .subtitle{color:rgba(255,255,255,0.7)}
.title-right p{color:rgba(255,255,255,0.7)}
.pills{display:flex;flex-direction:column;gap:0.8vmin;margin-top:auto}
.pill{padding:1.2vmin 2vmin;color:var(--white);font-weight:700;font-size:clamp(0.75rem,1.3vmin,0.9rem)}

/* === LAYOUT: section === */
.layout-section{background:var(--bg-dark);justify-content:center;align-items:flex-start;padding:5vmin 8vmin}
.layout-section h1,.layout-section .section-title{color:var(--white);font-size:clamp(2rem,6vmin,4rem)}
.layout-section .subtitle{color:rgba(255,255,255,0.7);margin-top:1vmin}
.accent-bar{width:8vmin;height:0.3vmin;background:var(--accent);margin:2vmin 0}
.layout-section .links a{color:var(--accent2)}

/* === LAYOUT: stagger === */
.stagger-bars{display:flex;flex-direction:column;gap:0.6vmin;flex:1}
.stagger-bar{padding:2vmin 3vmin;color:var(--white);font-weight:700;font-size:clamp(0.85rem,1.8vmin,1.2rem)}

/* === LAYOUT: split === */
.layout-split{flex-direction:row;gap:4vmin;padding:5vmin}
.split-left{flex:0 0 38%;display:flex;flex-direction:column;gap:1.5vmin;
  border-right:1px solid color-mix(in srgb,var(--accent) 15%,transparent);padding-right:4vmin}
.split-right{flex:1;display:flex;flex-direction:column;gap:1.5vmin;overflow:auto}

/* === LAYOUT: rotated === */
.layout-rotated{flex-direction:row;padding:0}
.rotated-bar{flex:0 0 15%;background:color-mix(in srgb,var(--accent) 85%,transparent);
  display:flex;align-items:center;justify-content:center;overflow:hidden}
.rotated-text{color:var(--white);font-weight:700;font-size:clamp(1.5rem,4vmin,3rem);
  writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:0.05em}
.rotated-content{flex:1;padding:5vmin;display:flex;flex-direction:column;justify-content:center;gap:2vmin}
.rotated-body{font-size:clamp(0.95rem,2.2vmin,1.4rem);line-height:1.6;color:var(--text)}
.rotated-bullet{color:var(--text-mid);font-size:clamp(0.8rem,1.5vmin,1rem)}

/* === LAYOUT: fragment === */
.frag-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0.5vmin;flex:1}
.frag-cell{display:flex;align-items:center;padding:2vmin;color:var(--white);font-weight:700;
  font-size:clamp(0.75rem,1.4vmin,0.95rem)}

/* === LAYOUT: overlap === */
.overlap-fields{display:flex;flex:1;position:relative;margin-top:2vmin}
.overlap-a,.overlap-b{padding:3vmin;color:var(--white);flex:1;display:flex;flex-direction:column;gap:1vmin;
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
.image-caption{font-size:clamp(0.65rem,1.2vmin,0.85rem);font-style:italic;color:var(--text-light);text-align:center}

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

/* ═══ ENHANCED TYPOGRAPHY (Google Fonts loaded in HTML head) ═══ */
h1{font-family:'DM Serif Display',var(--font),serif;letter-spacing:-0.03em;text-wrap:balance}
.label{font-family:'Space Mono',var(--font),monospace;letter-spacing:0.3em}
.layout-section h1{font-family:'DM Serif Display',var(--font),serif;font-weight:400;
  font-size:clamp(2.5rem,7vmin,5rem);line-height:1.05;letter-spacing:-0.04em}
.rotated-text{font-family:'DM Serif Display',var(--font),serif;text-shadow:0 2px 12px rgba(0,0,0,0.3)}
.counter{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:0.15em}
.notes-panel h3{font-family:'Space Mono',monospace;letter-spacing:0.2em;color:var(--accent)}
blockquote{position:relative;border-left-width:2px;padding:2vmin 3vmin}

/* ═══ SLIDE TRANSITIONS ═══ */
:root{--t-duration:0.5s;--t-ease:cubic-bezier(0.16,1,0.3,1)}

/* Default: fade */
.slide{opacity:0;transition:opacity var(--t-duration) var(--t-ease),transform var(--t-duration) var(--t-ease)}
.slide.active{opacity:1}

/* fade (default) */
.slide[data-transition="fade"]{transform:none}

/* slide-up */
.slide[data-transition="slide-up"]{transform:translateY(4vh)}
.slide[data-transition="slide-up"].active{transform:translateY(0)}
.slide[data-transition="slide-up"].exit-down{transform:translateY(-4vh);opacity:0}

/* slide-down */
.slide[data-transition="slide-down"]{transform:translateY(-4vh)}
.slide[data-transition="slide-down"].active{transform:translateY(0)}

/* slide-left */
.slide[data-transition="slide-left"]{transform:translateX(5vw)}
.slide[data-transition="slide-left"].active{transform:translateX(0)}
.slide[data-transition="slide-left"].exit-left{transform:translateX(-5vw);opacity:0}

/* slide-right */
.slide[data-transition="slide-right"]{transform:translateX(-5vw)}
.slide[data-transition="slide-right"].active{transform:translateX(0)}

/* zoom */
.slide[data-transition="zoom"]{transform:scale(0.92);opacity:0}
.slide[data-transition="zoom"].active{transform:scale(1);opacity:1}

/* zoom-out */
.slide[data-transition="zoom-out"]{transform:scale(1.08);opacity:0}
.slide[data-transition="zoom-out"].active{transform:scale(1);opacity:1}

/* cut (instant, no animation) */
.slide[data-transition="cut"]{transition:none}
.slide[data-transition="cut"].active{opacity:1}

/* none (same as cut) */
.slide[data-transition="none"]{transition:none}
.slide[data-transition="none"].active{opacity:1}

/* Respect reduced motion */
@media(prefers-reduced-motion:reduce){
  .slide{transition:none !important;transform:none !important}
  .slide.active{opacity:1}
}

/* ═══ MICRO-INTERACTIONS ═══ */
.stagger-bar{border-radius:2px;transition:transform 0.3s cubic-bezier(0.16,1,0.3,1);position:relative;overflow:hidden}
.stagger-bar::after{content:"";position:absolute;inset:0;
  background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.08) 100%);pointer-events:none}
.stagger-bar:hover{transform:translateX(8px)}
.frag-cell{border-radius:3px;transition:transform 0.2s cubic-bezier(0.16,1,0.3,1);position:relative;overflow:hidden}
.frag-cell::after{content:"";position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,0.1) 0%,transparent 50%);pointer-events:none}
.pills .pill{transition:transform 0.3s cubic-bezier(0.16,1,0.3,1)}
.pills .pill:hover{transform:translateX(4px)}
.overlap-a,.overlap-b{border-radius:4px}
.overlap-a{box-shadow:4px 4px 20px rgba(0,0,0,0.15)}

/* ═══ GEOMETRIC ANIMATIONS ═══ */
.arc-outer{animation:arc-breathe 6s ease-in-out infinite}
@keyframes arc-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
.arc-dot{animation:arc-pulse 2s ease-in-out infinite}
@keyframes arc-pulse{0%,100%{opacity:1}50%{opacity:0.5}}

/* ═══ ACCENT DETAILS ═══ */
.layout-section::before{content:"";position:absolute;top:0;left:0;width:100%;height:1px;
  background:linear-gradient(90deg,var(--accent) 0%,transparent 60%)}
.split-left::after{content:"";position:absolute;right:0;top:10%;bottom:10%;width:1px;
  background:linear-gradient(180deg,transparent,var(--accent),transparent)}
.layout-blank::after{content:"";position:absolute;top:50%;left:50%;width:4px;height:4px;
  border-radius:50%;background:var(--accent);opacity:0.3;transform:translate(-50%,-50%)}
.progress{height:2px;background:transparent}
.progress-bar{box-shadow:0 0 8px var(--accent)}
.notes-panel{backdrop-filter:blur(20px);background:rgba(0,0,0,0.88)}

/* ═══ GRAIN TEXTURE ═══ */
body::after{content:"";position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:0.03;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat:repeat}

/* ═══ ACCESSIBILITY ═══ */
a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
.slide:focus-visible{outline:none}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0,0,0,0);white-space:nowrap;border:0}
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
    slides[cur].removeAttribute('aria-current');
    cur=n;
    slides[cur].classList.add('active');
    slides[cur].setAttribute('aria-current','true');
    bar.style.width=((cur+1)/slides.length*100)+'%';
    counter.textContent=(cur+1)+' / '+slides.length;
    var prog=document.querySelector('.progress');
    if(prog)prog.setAttribute('aria-valuenow',cur+1);
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
    if(e.target.tagName==='A'||e.target.closest('a'))return;
    if(e.clientX>window.innerWidth*0.65)go(cur+1);
    else if(e.clientX<window.innerWidth*0.35)go(cur-1);
  });

  // Presenter mode — press P to open synced notes window
  const bc=new BroadcastChannel('rastersysteme-presenter');
  let presenterWin=null;

  function broadcastSlide(){
    const noteEl=slides[cur].querySelector('.slide-notes');
    const nextNoteEl=cur+1<slides.length?slides[cur+1].querySelector('.slide-notes'):null;
    bc.postMessage({
      type:'slide',
      index:cur,
      total:slides.length,
      notes:noteEl?noteEl.innerHTML:'<span class="empty">(no notes)</span>',
      nextNotes:nextNoteEl?nextNoteEl.innerHTML:'',
      title:document.title
    });
  }

  // Broadcast on every slide change
  const origGo=go;
  go=function(n){origGo(n);broadcastSlide()};

  function openPresenter(){
    if(presenterWin&&!presenterWin.closed){presenterWin.focus();return}
    presenterWin=window.open('','rastersysteme_notes','width=800,height=600');
    if(!presenterWin)return;
    presenterWin.document.write(\`<!DOCTYPE html><html><head><title>Presenter Notes</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Mono:wght@400;700&family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#0a0a0a;color:#e8e0d4;overflow-y:auto}

/* Header bar */
.header{display:flex;align-items:center;justify-content:space-between;
  padding:1rem 2rem;border-bottom:1px solid #222;position:sticky;top:0;background:#0a0a0a;z-index:10}
.slide-num{font-family:'Space Mono',monospace;font-size:.75rem;color:#8C8478;letter-spacing:0.15em}
.elapsed{font-family:'Space Mono',monospace;font-size:1.8rem;color:#333;font-variant-numeric:tabular-nums}
.progress-row{display:flex;gap:2px;align-items:center}
.progress-dot{width:6px;height:6px;border-radius:50%;background:#333}
.progress-dot.past{background:#548C5A}
.progress-dot.current{background:#B7311A;width:8px;height:8px}

/* Timing cue */
.timing{display:flex;align-items:center;gap:1rem;padding:0.8rem 2rem;
  background:#111;border-bottom:1px solid #1a1a1a;font-family:'Space Mono',monospace}
.timing-icon{font-size:1rem}
.timing-range{font-size:.85rem;color:#C79B38}
.timing-duration{font-size:.85rem;color:#548C5A;margin-left:auto}

/* Main notes */
.notes-body{padding:2rem;min-height:40vh}
.notes{font-size:1.25rem;line-height:1.8;color:#e8e0d4}
.notes br{display:block;content:"";margin:0.3em 0}
.notes em{color:#C79B38;font-style:italic}
.notes strong{color:#fff;font-weight:700}
.notes .empty{color:#555;font-style:italic}

/* Next slide preview */
.next-section{border-top:1px solid #222;padding:1.5rem 2rem}
.next-label{font-family:'Space Mono',monospace;font-size:.65rem;color:#555;
  text-transform:uppercase;letter-spacing:0.2em;margin-bottom:0.8rem}
.next-notes{font-size:.9rem;color:#666;line-height:1.6;max-height:15vh;overflow:hidden}
.next-notes em{color:#876512}

/* Keyboard hints */
.countdown{font-family:'Space Mono',monospace;font-size:1rem;color:#2B7038;font-variant-numeric:tabular-nums;margin-top:0.2rem}
.countdown.warning{color:#876512}
.countdown.danger{color:#B7311A;animation:pulse 1s ease-in-out infinite}
.countdown.over{color:#B7311A}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.duration-set{display:flex;align-items:center;gap:0.5rem;padding:0.5rem 2rem;border-bottom:1px solid #1a1a1a}
.duration-label{font-family:'Space Mono',monospace;font-size:.65rem;color:#555;letter-spacing:0.1em}
.hints{padding:0.8rem 2rem;border-top:1px solid #1a1a1a;
  font-family:'Space Mono',monospace;font-size:.6rem;color:#333;letter-spacing:0.1em}
</style></head><body>
<div class="header">
  <div>
    <div class="slide-num" id="pn-num">SLIDE 1</div>
    <div class="progress-row" id="pn-progress"></div>
  </div>
  <div style="text-align:right">
    <div class="elapsed" id="pn-timer">00:00</div>
    <div class="countdown" id="pn-countdown" style="display:none">remaining</div>
  </div>
</div>
<div class="timing" id="pn-timing" style="display:none">
  <span class="timing-icon">\\u23F1</span>
  <span class="timing-range" id="pn-timing-range"></span>
  <span class="timing-duration" id="pn-timing-dur"></span>
</div>
<div class="duration-set" id="pn-duration-set">
  <span class="duration-label">Duration:</span>
  <input type="number" id="pn-duration-input" min="1" max="600" placeholder="minutes" style="width:60px;background:#222;border:1px solid #333;color:#e8e0d4;padding:4px 8px;border-radius:3px;font-family:'Space Mono',monospace;font-size:.75rem">
  <button id="pn-duration-btn" style="background:#222;border:1px solid #333;color:#8C8478;padding:4px 10px;border-radius:3px;font-family:'Space Mono',monospace;font-size:.75rem;cursor:pointer">Set</button>
</div>
<div class="notes-body">
  <div class="notes" id="pn-notes">Press <strong>P</strong> in the slide window to sync.</div>
</div>
<div class="next-section">
  <div class="next-label">NEXT</div>
  <div class="next-notes" id="pn-next"></div>
</div>
<div class="hints">\\u2190 \\u2192 navigate &nbsp;&nbsp; N notes panel &nbsp;&nbsp; F fullscreen</div>
<script>
const bc2=new BroadcastChannel('rastersysteme-presenter');
const startTime=Date.now();
let totalSlides=1;

bc2.onmessage=function(e){
  if(e.data.type==='slide'){
    const idx=e.data.index;
    totalSlides=e.data.total;
    document.getElementById('pn-num').textContent='SLIDE '+(idx+1)+' / '+totalSlides;
    document.getElementById('pn-notes').innerHTML=e.data.notes;
    document.getElementById('pn-next').innerHTML=e.data.nextNotes||'<span class="empty">(end of deck)</span>';

    // Progress dots
    const dots=document.getElementById('pn-progress');
    dots.innerHTML='';
    for(let i=0;i<totalSlides;i++){
      const d=document.createElement('div');
      d.className='progress-dot'+(i<idx?' past':i===idx?' current':'');
      dots.appendChild(d);
    }

    // Extract timing cue if present (format: \\u23F1 Xm \\u2192 Ym (Z:ZZ))
    const notesText=e.data.notes||'';
    const timingMatch=notesText.match(/\\u23F1\\s*(\\S+)\\s*\\u2192\\s*(\\S+)\\s*\\(([^)]+)\\)/);
    const timingEl=document.getElementById('pn-timing');
    if(timingMatch){
      timingEl.style.display='flex';
      document.getElementById('pn-timing-range').textContent=timingMatch[1]+' \\u2192 '+timingMatch[2];
      document.getElementById('pn-timing-dur').textContent=timingMatch[3];
    } else {
      timingEl.style.display='none';
    }

    // Scroll to top
    window.scrollTo(0,0);
  }
};

let durationMinutes=0;
document.getElementById('pn-duration-btn').addEventListener('click',function(){
  const v=parseInt(document.getElementById('pn-duration-input').value);
  if(v>0){durationMinutes=v;document.getElementById('pn-duration-set').style.display='none'}
});
document.getElementById('pn-duration-input').addEventListener('keydown',function(e){
  if(e.key==='Enter'){document.getElementById('pn-duration-btn').click()}
});

setInterval(function(){
  const s=Math.floor((Date.now()-startTime)/1000);
  const h=Math.floor(s/3600);
  const m=Math.floor((s%3600)/60);
  const sec=s%60;
  const t=h>0
    ? h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0')
    : String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  document.getElementById('pn-timer').textContent=t;

  // Countdown
  const cdEl=document.getElementById('pn-countdown');
  if(durationMinutes>0){
    cdEl.style.display='block';
    const remaining=durationMinutes*60-s;
    if(remaining<=0){
      cdEl.textContent='OVER by '+Math.abs(Math.floor(remaining/60))+'m';
      cdEl.className='countdown over';
    } else {
      const rm=Math.floor(remaining/60);
      const rs=remaining%60;
      cdEl.textContent=rm+':'+String(rs).padStart(2,'0')+' left';
      const pct=remaining/(durationMinutes*60);
      cdEl.className='countdown'+(pct<0.1?' danger':pct<0.25?' warning':'');
    }
  }
},1000);
<\\/script></body></html>\`);
    presenterWin.document.close();
    broadcastSlide();
  }

  document.addEventListener('keydown',function(e){
    if(e.key==='p'||e.key==='P'){openPresenter()}
  });

  // Auto-fit: shrink text in designed zones that overflow their container
  function autoFitZones(){
    document.querySelectorAll('.slide.designed .zone').forEach(function(zone){
      // Reset any previous auto-fit
      zone.style.removeProperty('--auto-fit-size');
      var els=zone.querySelectorAll('p,blockquote,h1,h2,span.label,.bullet,.bullets');
      // Get the base font size from inline style or computed
      var base=parseFloat(zone.style.fontSize)||parseFloat(getComputedStyle(zone).fontSize)||16;
      var size=base;
      var min=Math.max(8,base*0.45);
      while(zone.scrollHeight>zone.clientHeight+1&&size>min){
        size-=0.5;
        els.forEach(function(el){el.style.fontSize=size+'px'});
      }
    });
  }

  // Run auto-fit on load and after each slide transition
  var origGo2=go;
  go=function(n){origGo2(n);autoFitZones()};
  autoFitZones();

  go(0);
})();
`;
}

// ═══════════════════════════════════════════════════════
// EXTERNAL CSS — write standalone stylesheet for reuse
// ═══════════════════════════════════════════════════════

function generateExternalCSS(outputPath) {
  const css = `/* rastersysteme.css — Swiss 60-column grid slide system
 * Standalone stylesheet — link from any HTML slideshow.
 *
 * Theme variables must be set via :root in your HTML:
 *   :root {
 *     --bg:#F8F5F0; --bg-alt:#F0EDE8; --bg-dark:#2D2D2D; --code-bg:#2D2D2D;
 *     --text:#1A1A1A; --text-mid:#4A4A4A; --text-light:#888;
 *     --accent:#B7311A; --accent-light:#D4654E; --accent2:#2D5A7B; --accent3:#6B8E5A; --accent4:#8B6B4A;
 *     --white:#FFFFFF; --black:#1A1A1A; --grey:#CCCCCC;
 *     --font:'Helvetica Neue','Helvetica',Arial,sans-serif;
 *   }
 */
${generateHTMLCSS()}
`;
  fs.writeFileSync(outputPath, css, "utf-8");
  return outputPath;
}

async function generateHTML(inputPath, outputPath, options = {}) {
  const themeName = options.theme || "light";
  const theme = THEMES[themeName] || THEMES.light;
  const globalFont = options.font || "Helvetica Neue";
  const globalTransition = options.transition || "fade";

  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);

  const cssVars = Object.entries({
    bg: theme.bg, "bg-alt": theme.bgAlt, "bg-dark": theme.bgDark,
    "code-bg": isDarkColor(theme.bg) ? "111111" : "2D2D2D",
    text: theme.text, "text-mid": theme.textMid, "text-light": theme.textLight,
    accent: theme.accent, "accent-light": theme.accentLight || theme.accent, accent2: theme.accent2, accent3: theme.accent3, accent4: theme.accent4,
    white: theme.white, black: theme.black, grey: theme.grey,
  }).map(([k, v]) => `--${k}:#${v}`).join(";");

  const slidesHTML = slides.map((slide, idx) => {
    const layout = detectLayout(slide, idx, slides.length);
    const renderer = HTML_LAYOUTS[layout] || HTML_LAYOUTS.split;

    // Build per-slide inline styles — merge font, bg, and adapted colors
    const styleParts = [];
    if (slide.fontOverride) {
      styleParts.push(`font-family:'${esc(slide.fontOverride)}',var(--font)`);
    }
    if (slide.bgOverride) {
      styleParts.push(`background:#${slide.bgOverride}`);
      // Adapt CSS variables per-slide when bg darkness contradicts theme
      const adapted = adaptThemeForBg(theme, slide.bgOverride);
      if (adapted !== theme) {
        styleParts.push(`--text:#${adapted.text}`);
        styleParts.push(`--text-mid:#${adapted.textMid}`);
        styleParts.push(`--text-light:#${adapted.textLight}`);
        styleParts.push(`--accent:#${adapted.accent}`);
        styleParts.push(`--accent2:#${adapted.accent2}`);
        styleParts.push(`--accent3:#${adapted.accent3}`);
        styleParts.push(`--accent4:#${adapted.accent4}`);
      }
    }
    // Apply style overrides from <!-- style: key=value; ... -->
    if (slide.style) {
      const styleMap = {
        "title-size": (v) => `--title-size:${v}px`,
        "body-size": (v) => `--body-size:${v}px`,
        "spacing": (v) => `--slide-gap:${v === "tight" ? "0.5vmin" : v === "loose" ? "4vmin" : v === "none" ? "0" : v}`,
        "padding": (v) => `padding:${v === "none" ? "0" : v === "tight" ? "2vmin" : v === "loose" ? "8vmin" : v}`,
        "opacity": (v) => `opacity:${v}`,
        "align": (v) => `text-align:${v}`,
        "letter-spacing": (v) => `letter-spacing:${v}`,
        "text-transform": (v) => `text-transform:${v}`,
        "color": (v) => `color:#${v.replace(/^#/, "")}`,
        "invert": (v) => v === "true" ? `filter:invert(1)` : "",
      };
      for (const [k, v] of Object.entries(slide.style)) {
        const fn = styleMap[k];
        if (fn) { const r = fn(v); if (r) styleParts.push(r); }
        else {
          // Pass through raw CSS — add # prefix to bare hex colour values
          const val = /^[0-9A-Fa-f]{6}$/.test(v) ? `#${v}` : v;
          styleParts.push(`${k}:${val}`);
        }
      }
    }

    const style = styleParts.length ? ` style="${styleParts.join(";")}"` : "";

    const trans = ` data-transition="${slide.transition || globalTransition}"`;

    // Append videos in non-video layouts — constrained so they don't overlap text
    const extraVideos = (slide.videos && slide.videos.length > 0 && layout !== "video")
      ? `<div class="extra-videos">${videosHTML(slide.videos)}</div>` : "";

    // Use designed renderer for slides with a design directive
    if (slide.design) {
      const designStyle = [];
      if (slide.design.bg) {
        designStyle.push(`background:#${slide.design.bg.replace(/^#/, "")}`);
        const adapted = adaptThemeForBg(theme, slide.design.bg.replace(/^#/, ""));
        if (adapted !== theme) {
          designStyle.push(`--text:#${adapted.text}`);
          designStyle.push(`--text-mid:#${adapted.textMid}`);
          designStyle.push(`--text-light:#${adapted.textLight}`);
          designStyle.push(`--accent:#${adapted.accent}`);
          designStyle.push(`--accent2:#${adapted.accent2}`);
          designStyle.push(`--accent3:#${adapted.accent3}`);
          designStyle.push(`--accent4:#${adapted.accent4}`);
        }
      }
      if (slide.design.font) designStyle.push(`font-family:'${esc(slide.design.font)}',var(--font)`);
      designStyle.push(...styleParts);
      const ds = designStyle.length ? ` style="${designStyle.join(";")}"` : "";
      const slideAria = slide.title ? ` aria-roledescription="slide" aria-label="${esc(slide.title)}"` : ` aria-roledescription="slide"`;
      return `<section class="slide designed"${ds}${trans}${slideAria}>${renderDesigned(slide)}${extraVideos}${slideNotes(slide)}</section>`;
    }

    const slideAria = slide.title ? ` aria-roledescription="slide" aria-label="${esc(slide.title)}"` : ` aria-roledescription="slide"`;
    return `<section class="slide layout-${layout}"${style}${trans}${slideAria}>${renderer(slide)}${extraVideos}${slideNotes(slide)}</section>`;
  }).join("\n");

  // Derive descriptive page title from first slide's h1 or filename
  const firstTitle = slides[0] && (slides[0].title || slides[0].subtitle);
  const title = firstTitle ? esc(firstTitle) : esc(path.basename(inputPath, ".md"));

  // External CSS mode: link to standalone stylesheet instead of inlining
  const cssFileName = options.cssFileName || "rastersysteme.css";
  const styleBlock = options.externalCSS
    ? `<style>\n:root{${cssVars};--font:'${globalFont}','Helvetica Neue',Helvetica,Arial,sans-serif}\n</style>\n<link rel="stylesheet" href="${cssFileName}">`
    : `<style>\n:root{${cssVars};--font:'${globalFont}','Helvetica Neue',Helvetica,Arial,sans-serif}\n${generateHTMLCSS()}\n</style>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<title>${title}</title>
${styleBlock}
</head>
<body>
<div class="deck" role="application" aria-roledescription="slide deck" aria-label="${title}">
${slidesHTML}
</div>
<div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${slides.length}" aria-valuenow="1" aria-label="Slide progress"><div class="progress-bar"></div></div>
<div class="counter" aria-live="polite" aria-atomic="true"></div>
<div class="notes-panel"><h3>Speaker Notes</h3><div class="notes-content"></div></div>
<script>
${generateHTMLJS()}
</script>
</body>
</html>`;

  // Write external CSS file alongside HTML if needed
  if (options.externalCSS) {
    const cssPath = path.join(path.dirname(outputPath), cssFileName);
    if (!fs.existsSync(cssPath)) {
      generateExternalCSS(cssPath);
    }
  }

  fs.writeFileSync(outputPath, html, "utf-8");
  return { slides: slides.length, output: outputPath, theme: themeName };
}

// ═══════════════════════════════════════════════════════
// REVIEW / VISUAL VALIDATION
// ═══════════════════════════════════════════════════════

function validateSlide(slide, layout) {
  const issues = [];
  const warnings = [];

  // Content checks
  if (!slide.title && !slide.subtitle && !slide.body.length && !slide.bullets.length &&
      !slide.tables.length && !slide.codeBlocks.length && !slide.images.length &&
      !slide.videos.length && !slide.blockquote && layout !== "blank") {
    issues.push("Empty slide — no content detected");
  }
  if (slide.bullets.length > 8 && layout === "stagger") {
    warnings.push("Stagger with " + slide.bullets.length + " items may overflow");
  }
  if (slide.bullets.length > 6 && layout === "bullets") {
    warnings.push("Dense bullets (" + slide.bullets.length + ") — consider stagger or split");
  }
  if (slide.tables.length > 0 && slide.tables[0].rows.length > 10) {
    warnings.push("Table has " + slide.tables[0].rows.length + " rows — may overflow");
  }
  if (slide.codeBlocks.length > 0 && slide.codeBlocks[0].code.split("\n").length > 20) {
    warnings.push("Code block has " + slide.codeBlocks[0].code.split("\n").length + " lines — may clip");
  }
  if (slide.title && slide.title.length > 50) {
    warnings.push("Long title (" + slide.title.length + " chars)");
  }
  if (slide.subtitle && slide.subtitle.length > 60) {
    warnings.push("Long subtitle (" + slide.subtitle.length + " chars)");
  }

  // Layout-specific checks
  if (layout === "fragment" && slide.bullets.length + slide.links.length > 9) {
    issues.push("Fragment max 9 cells — " + (slide.bullets.length + slide.links.length) + " items will clip");
  }
  if (layout === "image" && slide.images.length > 0) {
    slide.images.forEach(img => {
      if (!img.src) issues.push("Image with empty src");
    });
  }
  if (!slide.title && !slide.subtitle && layout !== "section" && layout !== "blank") {
    warnings.push("No heading — slide may lack visual anchor");
  }

  // Content type inventory
  const content = [];
  if (slide.title) content.push("title");
  if (slide.subtitle) content.push("subtitle");
  if (slide.sectionLabel) content.push("label");
  if (slide.bullets.length) content.push(slide.bullets.length + " bullets");
  if (slide.body.length) content.push(slide.body.length + " body");
  if (slide.blockquote) content.push("quote");
  if (slide.tables.length) content.push(slide.tables.length + " table");
  if (slide.codeBlocks.length) content.push(slide.codeBlocks.length + " code");
  if (slide.images.length) content.push(slide.images.length + " image");
  if (slide.videos.length) content.push(slide.videos.length + " video");
  if (slide.links.length) content.push(slide.links.length + " link");
  if (slide.notes) content.push("notes");
  if (slide.fontOverride) content.push("font:" + slide.fontOverride);
  if (slide.bgOverride) content.push("bg:#" + slide.bgOverride);

  return { issues, warnings, content };
}

async function generateReview(inputPath, outputPath, options = {}) {
  const themeName = options.theme || "light";
  const theme = THEMES[themeName] || THEMES.light;
  const globalFont = options.font || "Helvetica Neue";

  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);

  const cssVars = Object.entries({
    bg: theme.bg, "bg-alt": theme.bgAlt, "bg-dark": theme.bgDark,
    "code-bg": isDarkColor(theme.bg) ? "111111" : "2D2D2D",
    text: theme.text, "text-mid": theme.textMid, "text-light": theme.textLight,
    accent: theme.accent, "accent-light": theme.accentLight || theme.accent, accent2: theme.accent2, accent3: theme.accent3, accent4: theme.accent4,
    white: theme.white, black: theme.black, grey: theme.grey,
  }).map(([k, v]) => `--${k}:#${v}`).join(";");

  const cards = slides.map((slide, idx) => {
    const layout = detectLayout(slide, idx, slides.length);
    const renderer = HTML_LAYOUTS[layout] || HTML_LAYOUTS.split;
    const fontStyle = slide.fontOverride ? `font-family:'${esc(slide.fontOverride)}',var(--font);` : "";
    const bgStyle = slide.bgOverride ? `background:#${slide.bgOverride};` : "";
    let adaptedVars = "";
    if (slide.bgOverride) {
      const adapted = adaptThemeForBg(theme, slide.bgOverride);
      if (adapted !== theme) {
        adaptedVars = `--text:#${adapted.text};--text-mid:#${adapted.textMid};--text-light:#${adapted.textLight};--accent:#${adapted.accent};--accent2:#${adapted.accent2};--accent3:#${adapted.accent3};--accent4:#${adapted.accent4};`;
      }
    }
    const slideStyle = fontStyle + bgStyle + adaptedVars;
    const validation = validateSlide(slide, layout);

    const statusClass = validation.issues.length > 0 ? "has-issues" :
                        validation.warnings.length > 0 ? "has-warnings" : "ok";
    const statusIcon = validation.issues.length > 0 ? "\u2716" :
                       validation.warnings.length > 0 ? "\u26A0" : "\u2714";

    const issuesHTML = [...validation.issues.map(i => `<div class="issue">\u2716 ${esc(i)}</div>`),
                        ...validation.warnings.map(w => `<div class="warning">\u26A0 ${esc(w)}</div>`)].join("");
    const contentHTML = validation.content.map(c => `<span class="tag">${esc(c)}</span>`).join("");
    const notesPreview = slide.notes ? esc(slide.notes.slice(0, 120)) + (slide.notes.length > 120 ? "..." : "") : "";

    return `<div class="card ${statusClass}" data-index="${idx}">
  <div class="card-header">
    <span class="card-num">${String(idx + 1).padStart(2, "0")}</span>
    <span class="card-layout">${layout}</span>
    <span class="card-status">${statusIcon}</span>
  </div>
  <div class="card-preview">
    <div class="slide-scaled ${slide.design ? "designed" : `layout-${layout}`}" style="${slide.design ? (slide.design.bg ? `background:#${slide.design.bg.replace(/^#/, "")};` : "") + (slide.design.font ? `font-family:'${esc(slide.design.font)}',var(--font);` : "") + slideStyle + "position:relative;overflow:hidden;padding:0" : slideStyle}">${slide.design ? renderDesigned(slide) : renderer(slide)}</div>
  </div>
  <div class="card-meta">
    <div class="tags">${contentHTML}</div>
    ${issuesHTML}
    ${notesPreview ? `<div class="notes-preview">${notesPreview}</div>` : ""}
  </div>
</div>`;
  }).join("\n");

  // Summary stats
  const total = slides.length;
  const layoutCounts = {};
  let totalIssues = 0, totalWarnings = 0;
  slides.forEach((slide, idx) => {
    const layout = detectLayout(slide, idx, slides.length);
    layoutCounts[layout] = (layoutCounts[layout] || 0) + 1;
    const v = validateSlide(slide, layout);
    totalIssues += v.issues.length;
    totalWarnings += v.warnings.length;
  });
  const layoutSummary = Object.entries(layoutCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([l, c]) => `<span class="tag">${l} \u00d7${c}</span>`).join("");

  const title = esc(path.basename(inputPath, ".md"));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Review: ${title}</title>
<style>
:root{${cssVars};--font:'${globalFont}','Helvetica Neue',Helvetica,Arial,sans-serif}

*{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#ccc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;padding:20px}

.review-header{margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #333}
.review-header h1{font-size:20px;color:#fff;margin-bottom:8px}
.review-header .summary{display:flex;gap:16px;align-items:center;flex-wrap:wrap;font-size:13px;color:#888}
.review-header .stat{background:#222;padding:4px 10px;border-radius:3px}
.review-header .stat.issues{color:#E63222}
.review-header .stat.warnings{color:#F2C12E}
.review-header .stat.ok{color:#2A7A4B}
.review-header .layouts{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:16px}

.card{background:#1a1a1a;border:2px solid #333;border-radius:6px;overflow:hidden;cursor:pointer;transition:all 0.15s}
.card:hover{border-color:#666}
.card.focused{border-color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,0.4);z-index:10;position:relative;transform:scale(1.01)}
.card.has-issues{border-color:#E63222}
.card.has-issues.focused{border-color:#ff6b6b;box-shadow:0 0 0 3px rgba(230,50,34,0.5)}
.card.has-warnings{border-color:#F2C12E}
.card.has-warnings.focused{border-color:#ffd966;box-shadow:0 0 0 3px rgba(242,193,46,0.5)}

.card-header{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#222;font-size:12px}
.card-num{color:#fff;font-weight:700;font-family:'SF Mono',monospace}
.card-layout{color:var(--accent);text-transform:uppercase;letter-spacing:0.1em;font-size:10px;font-weight:700}
.card-status{margin-left:auto;font-size:14px}
.ok .card-status{color:#2A7A4B}
.has-warnings .card-status{color:#F2C12E}
.has-issues .card-status{color:#E63222}

.card-preview{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:#000}
.slide-scaled{position:absolute;width:1280px;height:720px;transform-origin:top left;
  padding:40px;display:flex;flex-direction:column;gap:14px;
  font-family:var(--font);color:var(--text);background:var(--bg-alt);overflow:hidden}

.card-meta{padding:10px 12px;font-size:11px;display:flex;flex-direction:column;gap:6px}
.tags{display:flex;flex-wrap:wrap;gap:4px}
.tag{background:#2a2a2a;color:#999;padding:2px 6px;border-radius:2px;font-size:10px}
.issue{color:#E63222;font-size:11px}
.warning{color:#F2C12E;font-size:11px}
.notes-preview{color:#555;font-size:10px;font-style:italic;line-height:1.4;max-height:2.8em;overflow:hidden}

/* Slide content styles (scaled down) */
${generateHTMLCSS()}

/* Override for scaled context */
.slide-scaled h1{font-size:28px}
.slide-scaled h2.subtitle{font-size:14px}
.slide-scaled p{font-size:11px}
.slide-scaled .label{font-size:7px}
.slide-scaled .bullet.level-0{font-size:12px}
.slide-scaled .bullet.level-1{font-size:10px;padding-left:20px}
.slide-scaled .bullet.level-2,.slide-scaled .bullet.level-3{font-size:9px;padding-left:40px}
.slide-scaled .dot{width:16px;height:16px;min-width:16px;min-height:16px;font-size:8px}
.slide-scaled .bullets{gap:6px}
.slide-scaled .pill{padding:6px 10px;font-size:8px}
.slide-scaled .pills{gap:4px}
.slide-scaled table{font-size:9px}
.slide-scaled thead th{padding:4px 8px}
.slide-scaled tbody td{padding:3px 8px}
.slide-scaled .code-block code{font-size:8px;line-height:1.4}
.slide-scaled .code-block pre{padding:12px}
.slide-scaled .code-lang{font-size:6px}
.slide-scaled blockquote{font-size:10px;padding:8px 12px}
.slide-scaled .stagger-bar{padding:10px 16px;font-size:11px}
.slide-scaled .frag-cell{padding:10px;font-size:9px}
.slide-scaled .accent-block{padding:40px}
.slide-scaled .accent-block h1{font-size:24px}
.slide-scaled .accent-bar{width:50px;height:2px}
.slide-scaled .links a{font-size:10px}
.slide-scaled .section-title{font-size:32px}
.slide-scaled .rotated-text{font-size:24px}
.slide-scaled .rotated-body{font-size:12px}
.slide-scaled .rotated-bullet{font-size:10px}
.slide-scaled .overlap-a,.slide-scaled .overlap-b{font-size:11px;padding:16px}
.slide-scaled .split-left{padding-right:20px}
.slide-scaled .arc-outer{width:200px}

/* Lightbox */
.lightbox{position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:1000;display:none;align-items:center;justify-content:center;cursor:pointer}
.lightbox.open{display:flex}
.lightbox-inner{width:90vw;max-width:1280px;aspect-ratio:16/9;position:relative}
.lightbox-slide{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px;
  padding:40px;font-family:var(--font);color:var(--text);background:var(--bg-alt);overflow:hidden}
.lightbox-info{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
  background:#222;padding:8px 16px;border-radius:4px;font-size:12px;color:#888;display:flex;gap:12px}
.lightbox-close{position:fixed;top:20px;right:20px;color:#666;font-size:24px;cursor:pointer}
.lightbox-close:hover{color:#fff}
.lightbox-nav{position:fixed;top:50%;font-size:32px;color:#444;cursor:pointer;padding:20px;user-select:none}
.lightbox-nav:hover{color:#fff}
.lightbox-prev{left:10px;transform:translateY(-50%)}
.lightbox-next{right:10px;transform:translateY(-50%)}
</style>
</head>
<body>
<div class="review-header">
  <h1>\u2630 Review: ${title}</h1>
  <div class="summary">
    <span class="stat">${total} slides</span>
    <span class="stat">Theme: ${themeName}</span>
    <span class="stat ${totalIssues > 0 ? "issues" : "ok"}">${totalIssues} issues</span>
    <span class="stat ${totalWarnings > 0 ? "warnings" : "ok"}">${totalWarnings} warnings</span>
  </div>
  <div class="layouts">${layoutSummary}</div>
</div>
<div class="grid">
${cards}
</div>
<div class="lightbox" id="lb">
  <div class="lightbox-close" id="lb-close">\u2715</div>
  <div class="lightbox-prev lightbox-nav" id="lb-prev">\u2039</div>
  <div class="lightbox-next lightbox-nav" id="lb-next">\u203A</div>
  <div class="lightbox-inner" id="lb-inner"></div>
  <div class="lightbox-info" id="lb-info"></div>
</div>
<script>
(function(){
  const cards=document.querySelectorAll('.card');
  const lb=document.getElementById('lb');
  const lbInner=document.getElementById('lb-inner');
  const lbInfo=document.getElementById('lb-info');
  let current=-1;

  // Scale slide previews to fit cards
  function scaleAll(){
    document.querySelectorAll('.card-preview').forEach(function(p){
      const s=p.querySelector('.slide-scaled');
      if(!s)return;
      const scale=p.clientWidth/1280;
      s.style.transform='scale('+scale+')';
    });
  }
  scaleAll();
  window.addEventListener('resize',scaleAll);

  function openLB(idx){
    current=idx;
    const card=cards[idx];
    const preview=card.querySelector('.slide-scaled');
    const layout=card.querySelector('.card-layout').textContent;
    const num=card.querySelector('.card-num').textContent;
    lbInner.innerHTML='';
    const clone=preview.cloneNode(true);
    clone.className='lightbox-slide '+preview.className.replace('slide-scaled','');
    clone.style.transform='none';
    clone.style.position='absolute';
    lbInner.appendChild(clone);
    lbInfo.innerHTML='<span>'+num+'</span><span>'+layout+'</span><span>'+(idx+1)+' / '+cards.length+'</span>';
    lb.classList.add('open');
  }
  function closeLB(){lb.classList.remove('open');current=-1}
  function navLB(dir){
    if(current<0)return;
    const next=current+dir;
    if(next>=0&&next<cards.length)openLB(next);
  }

  // Grid navigation state
  let focused=-1;
  function focusCard(idx){
    if(idx<0||idx>=cards.length)return;
    if(focused>=0)cards[focused].classList.remove('focused');
    focused=idx;
    cards[focused].classList.add('focused');
    cards[focused].scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function getGridCols(){
    if(!cards.length)return 1;
    const first=cards[0].getBoundingClientRect();
    let cols=1;
    for(let i=1;i<cards.length;i++){
      if(cards[i].getBoundingClientRect().top>first.top+10)break;
      cols++;
    }
    return cols;
  }

  cards.forEach(function(c,i){
    c.addEventListener('click',function(){openLB(i)});
    c.addEventListener('mouseenter',function(){focusCard(i)});
  });
  document.getElementById('lb-close').addEventListener('click',function(e){e.stopPropagation();closeLB()});
  document.getElementById('lb-prev').addEventListener('click',function(e){e.stopPropagation();navLB(-1)});
  document.getElementById('lb-next').addEventListener('click',function(e){e.stopPropagation();navLB(1)});
  lb.addEventListener('click',closeLB);
  lbInner.addEventListener('click',function(e){e.stopPropagation()});

  document.addEventListener('keydown',function(e){
    // Lightbox mode — arrows navigate slides, Escape closes
    if(current>=0){
      if(e.key==='Escape'){closeLB();e.preventDefault()}
      else if(e.key==='ArrowRight'){navLB(1);e.preventDefault()}
      else if(e.key==='ArrowLeft'){navLB(-1);e.preventDefault()}
      return;
    }
    // Grid mode — arrows move focus, page scrolls naturally to follow
    var cols=getGridCols();
    if(e.key==='ArrowRight'){focusCard(Math.min(focused+1,cards.length-1))}
    else if(e.key==='ArrowLeft'){focusCard(Math.max(focused-1,0))}
    else if(e.key==='ArrowDown'){focusCard(Math.min(focused+cols,cards.length-1))}
    else if(e.key==='ArrowUp'){focusCard(Math.max(focused-cols,0))}
    else if(e.key==='Enter'&&focused>=0){e.preventDefault();openLB(focused)}
    else if(e.key==='Home'){focusCard(0)}
    else if(e.key==='End'){focusCard(cards.length-1)}
  });

  // Start with first card focused
  if(cards.length)focusCard(0);
})();
</script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, "utf-8");

  // Print validation summary to console
  let consoleOut = "";
  slides.forEach((slide, idx) => {
    const layout = detectLayout(slide, idx, slides.length);
    const v = validateSlide(slide, layout);
    if (v.issues.length || v.warnings.length) {
      consoleOut += "  Slide " + String(idx + 1).padStart(2, "0") + " [" + layout + "]:";
      v.issues.forEach(i => { consoleOut += "\n    \u2716 " + i; });
      v.warnings.forEach(w => { consoleOut += "\n    \u26A0 " + w; });
      consoleOut += "\n";
    }
  });
  if (consoleOut) {
    console.log("\nValidation:");
    console.log(consoleOut);
  }

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
    --format <f>     Output format: pptx (default), html, review
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

  const transIdx = args.indexOf("--transition");
  const transition = transIdx >= 0 ? args[transIdx + 1] : undefined;

  const formatIdx = args.indexOf("--format");
  const format = formatIdx >= 0 ? args[formatIdx + 1] : "pptx";

  const ext = format === "review" ? ".review.html" : format === "html" ? ".html" : ".pptx";
  let output = args[1] && !args[1].startsWith("--") ? args[1] : input.replace(/\.md$/, ext);

  if (!fs.existsSync(input)) {
    console.error("Error: File not found: " + input);
    process.exit(1);
  }

  const gen = format === "review" ? generateReview : format === "html" ? generateHTML : generate;
  gen(input, output, { theme, ratio, font, transition })
    .then(result => {
      console.log("\u2713 Generated " + result.slides + " slides \u2192 " + result.output);
      console.log("  Theme: " + result.theme + " | Format: " + format + " | Ratio: " + ratio);
    })
    .catch(err => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}

module.exports = { generate, generateHTML, generateReview, parseMarkdown, createGrid, THEMES, LAYOUTS, HTML_LAYOUTS, detectLayout, adaptThemeForBg, generateHTMLCSS, generateHTMLJS, generateExternalCSS, renderDesigned };
