#!/usr/bin/env node
/**
 * export-gslides — export composed markdown to Google Slides
 *
 * Maps rastersysteme's 60-column grid, zones, accents, and typography
 * to native Google Slides API objects for maximum fidelity.
 *
 * Setup:
 *   1. Create a Google Cloud project at https://console.cloud.google.com
 *   2. Enable the Google Slides API and Google Drive API
 *   3. Create OAuth2 credentials (Desktop app type)
 *   4. Download credentials JSON to ./credentials.json (or set GOOGLE_CREDENTIALS_PATH)
 *
 * Usage:
 *   node export-gslides.js <input.composed.md> [options]
 *
 * Options:
 *   --theme <name>     Theme: light|dark|red|blue (default: light)
 *   --title <name>     Presentation title (default: filename)
 *   --open             Open in browser after creation
 *   --token <path>     Path to saved OAuth token (default: .gslides-token.json)
 *   --credentials <p>  Path to OAuth credentials JSON
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { URL } = require("url");
const chalk = require("chalk");
const { google } = require("googleapis");
const { parseMarkdown, createGrid, THEMES, detectLayout, adaptThemeForBg } = require("./raster.js");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const EMU_PER_INCH = 914400;
const SLIDE_WIDTH_IN = 10;
const SLIDE_HEIGHT_IN = 5.625;
const SLIDE_WIDTH_EMU = SLIDE_WIDTH_IN * EMU_PER_INCH;
const SLIDE_HEIGHT_EMU = SLIDE_HEIGHT_IN * EMU_PER_INCH;

const SCOPES = [
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/drive.file",
];

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════

function loadCredentials(credPath) {
  const raw = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  // Support both "installed" (desktop) and "web" credential types
  const creds = raw.installed || raw.web;
  if (!creds) {
    throw new Error("Invalid credentials.json — must contain 'installed' or 'web' key");
  }
  return creds;
}

function createOAuth2Client(creds) {
  return new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    "http://localhost:3847/oauth2callback"
  );
}

async function authorize(credPath, tokenPath) {
  const creds = loadCredentials(credPath);
  const oauth2 = createOAuth2Client(creds);

  // Try loading saved token
  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    oauth2.setCredentials(token);
    // Refresh if expired
    if (token.expiry_date && token.expiry_date < Date.now()) {
      try {
        const { credentials } = await oauth2.refreshAccessToken();
        oauth2.setCredentials(credentials);
        fs.writeFileSync(tokenPath, JSON.stringify(credentials, null, 2));
      } catch {
        // Token refresh failed — re-auth
        return authInteractive(oauth2, tokenPath);
      }
    }
    return oauth2;
  }

  return authInteractive(oauth2, tokenPath);
}

async function authInteractive(oauth2, tokenPath) {
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log(dim("\n  Google OAuth2 — authorize in your browser:"));
  console.log(teal(`  ${authUrl}\n`));

  // Spin up a tiny server to catch the redirect
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost:3847");
      const code = url.searchParams.get("code");
      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Authorized! You can close this tab.</h2>");
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end("Missing code parameter");
      }
    });
    server.listen(3847, () => {
      // Try to open browser
      const { exec } = require("child_process");
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${cmd} "${authUrl}"`);
    });
    server.on("error", reject);
    // Timeout after 2 minutes
    setTimeout(() => { server.close(); reject(new Error("Auth timeout")); }, 120000);
  });

  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  console.log(sage("  Token saved to"), dim(tokenPath));
  return oauth2;
}

// ═══════════════════════════════════════════════════════
// UNIT CONVERSION
// ═══════════════════════════════════════════════════════

function inchesToEmu(inches) {
  return Math.round(inches * EMU_PER_INCH);
}

function hexToRgb(hex) {
  hex = (hex || "000000").replace(/^#/, "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    red: parseInt(hex.slice(0, 2), 16) / 255,
    green: parseInt(hex.slice(2, 4), 16) / 255,
    blue: parseInt(hex.slice(4, 6), 16) / 255,
  };
}

function rgbColor(hex) {
  return { rgbColor: hexToRgb(hex) };
}

function ptToEmu(pt) {
  // 1 pt = 12700 EMU
  return Math.round(pt * 12700);
}

// ═══════════════════════════════════════════════════════
// GRID → EMU MAPPING
// ═══════════════════════════════════════════════════════

function createEmuGrid() {
  const g = createGrid(SLIDE_WIDTH_IN, SLIDE_HEIGHT_IN);
  return {
    ...g,
    // EMU versions of the grid functions
    ex: (col) => inchesToEmu(g.cx(col)),
    ey: (row) => inchesToEmu(g.cy(row)),
    ew: (span) => inchesToEmu(g.cw(span)),
    eh: (rowSpan) => inchesToEmu(g.ch(rowSpan)),
  };
}

// ═══════════════════════════════════════════════════════
// REQUEST BUILDERS
// ═══════════════════════════════════════════════════════

let elementIdCounter = 0;
function nextId(prefix = "el") {
  return `${prefix}_${Date.now()}_${elementIdCounter++}`;
}

function createSlideRequest(slideId, layoutRef) {
  return {
    createSlide: {
      objectId: slideId,
      slideLayoutReference: { predefinedLayout: layoutRef || "BLANK" },
    },
  };
}

function slideBackgroundRequest(slideId, hex) {
  return {
    updatePageProperties: {
      objectId: slideId,
      pageProperties: {
        pageBackgroundFill: {
          solidFill: {
            color: rgbColor(hex),
          },
        },
      },
      fields: "pageBackgroundFill.solidFill.color",
    },
  };
}

function createShapeRequest(shapeId, slideId, x, y, w, h, shapeType = "RECTANGLE") {
  return {
    createShape: {
      objectId: shapeId,
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: w, unit: "EMU" },
          height: { magnitude: h, unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: x, translateY: y,
          unit: "EMU",
        },
      },
      shapeType,
    },
  };
}

function createEllipseRequest(shapeId, slideId, x, y, w, h) {
  return {
    createShape: {
      objectId: shapeId,
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: w, unit: "EMU" },
          height: { magnitude: h, unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: x, translateY: y,
          unit: "EMU",
        },
      },
      shapeType: "ELLIPSE",
    },
  };
}

function shapeFillRequest(shapeId, hex, alpha = 1) {
  return {
    updateShapeProperties: {
      objectId: shapeId,
      shapeProperties: {
        shapeBackgroundFill: {
          solidFill: {
            color: rgbColor(hex),
            alpha,
          },
        },
        outline: { propertyState: "NOT_RENDERED" },
      },
      fields: "shapeBackgroundFill.solidFill,outline",
    },
  };
}

function insertTextRequest(shapeId, text) {
  return {
    insertText: {
      objectId: shapeId,
      text,
      insertionIndex: 0,
    },
  };
}

function textStyleRequest(shapeId, style, startIndex = 0, endIndex = undefined) {
  const isAll = endIndex === undefined && startIndex === 0;
  const req = {
    updateTextStyle: {
      objectId: shapeId,
      style: {},
      fields: "",
      textRange: isAll ? { type: "ALL" } : {
        type: "FIXED_RANGE",
        startIndex,
        endIndex,
      },
    },
  };

  const fields = [];

  if (style.fontSize) {
    req.updateTextStyle.style.fontSize = { magnitude: style.fontSize, unit: "PT" };
    fields.push("fontSize");
  }
  if (style.fontFamily) {
    req.updateTextStyle.style.fontFamily = style.fontFamily;
    fields.push("fontFamily");
  }
  if (style.color) {
    req.updateTextStyle.style.foregroundColor = { opaqueColor: rgbColor(style.color) };
    fields.push("foregroundColor");
  }
  if (style.bold !== undefined) {
    req.updateTextStyle.style.bold = style.bold;
    fields.push("bold");
  }
  if (style.italic !== undefined) {
    req.updateTextStyle.style.italic = style.italic;
    fields.push("italic");
  }

  req.updateTextStyle.fields = fields.join(",");
  return fields.length > 0 ? req : null;
}

function paragraphStyleRequest(shapeId, style, startIndex = 0, endIndex = undefined) {
  const isAll = endIndex === undefined && startIndex === 0;
  const req = {
    updateParagraphStyle: {
      objectId: shapeId,
      style: {},
      fields: "",
      textRange: isAll ? { type: "ALL" } : {
        type: "FIXED_RANGE",
        startIndex,
        endIndex,
      },
    },
  };

  const fields = [];

  if (style.alignment) {
    req.updateParagraphStyle.style.alignment = style.alignment;
    fields.push("alignment");
  }
  if (style.lineSpacing) {
    req.updateParagraphStyle.style.lineSpacing = style.lineSpacing;
    fields.push("lineSpacing");
  }
  if (style.spaceAbove) {
    req.updateParagraphStyle.style.spaceAbove = style.spaceAbove;
    fields.push("spaceAbove");
  }
  if (style.spaceBelow) {
    req.updateParagraphStyle.style.spaceBelow = style.spaceBelow;
    fields.push("spaceBelow");
  }

  req.updateParagraphStyle.fields = fields.join(",");
  return fields.length > 0 ? req : null;
}

function speakerNotesRequest(slideId, notesText) {
  // Speaker notes are on the notesPage of each slide.
  // We insert text into the notes shape (the first BODY placeholder on the notes page).
  return {
    insertText: {
      objectId: `${slideId}_notes`,
      text: notesText,
      insertionIndex: 0,
    },
  };
}

// ═══════════════════════════════════════════════════════
// IMAGE HANDLING
// ═══════════════════════════════════════════════════════

/**
 * Discover per-slide images from the composed-images directory.
 * Follows the same conventions as splice-images.js:
 *   decks/<base>.composed-images/slide-NN.png
 */
function discoverSplicedImages(inputPath) {
  const base = path.basename(inputPath, ".composed.md");
  const candidates = [
    path.join(path.dirname(inputPath), `${base}.composed-images`),
    path.join("decks", `${base}.composed-images`),
  ];
  const imgDir = candidates.find((d) => fs.existsSync(d));
  if (!imgDir) return {};

  const map = {};
  const files = fs.readdirSync(imgDir).filter((f) => f.endsWith(".png"));
  for (const f of files) {
    const m = f.match(/slide-(\d+)\.png/);
    if (m) {
      map[parseInt(m[1], 10)] = path.resolve(path.join(imgDir, f));
    }
  }
  return map;
}

/**
 * Upload a local image to Google Drive and return its file ID.
 * The file is created in the user's Drive root (or a folder if specified).
 */
async function uploadImageToDrive(driveApi, filePath, name) {
  const mimeType = filePath.endsWith(".svg") ? "image/svg+xml" : "image/png";
  const res = await driveApi.files.create({
    requestBody: {
      name,
      mimeType,
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },
    fields: "id",
  });
  // Make the file readable by anyone with the link (required for Slides API)
  await driveApi.permissions.create({
    fileId: res.data.id,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });
  return res.data.id;
}

/**
 * Build a createImage request for a slide.
 * Places the image as a full-bleed background behind text zones.
 */
function createImageRequest(imageId, slideId, imageUrl, x, y, w, h) {
  return {
    createImage: {
      objectId: imageId,
      url: imageUrl,
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: w, unit: "EMU" },
          height: { magnitude: h, unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: x, translateY: y,
          unit: "EMU",
        },
      },
    },
  };
}

/**
 * Reorder an image element to the back of the slide (behind text).
 */
function sendToBackRequest(imageId, slideId) {
  return {
    updatePageElementsZOrder: {
      pageElementObjectIds: [imageId],
      operation: "SEND_TO_BACK",
    },
  };
}

/**
 * Set transparency on an image element via its image properties.
 */
function imageTransparencyRequest(imageId, transparency) {
  return {
    updateImageProperties: {
      objectId: imageId,
      imageProperties: {
        transparency,
      },
      fields: "transparency",
    },
  };
}

// ═══════════════════════════════════════════════════════
// MARKDOWN → RICH TEXT RUNS
// ═══════════════════════════════════════════════════════

/**
 * Parse markdown bold (**text**) and italic (*text*) into text runs.
 * Returns array of { text, bold, italic } objects.
 */
function parseMarkdownRuns(text) {
  const runs = [];
  // Match **bold**, *italic*, and ***bold+italic*** patterns
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index), bold: false, italic: false });
    }
    if (match[2]) {
      // ***bold+italic***
      runs.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      // **bold**
      runs.push({ text: match[3], bold: true, italic: false });
    } else if (match[4]) {
      // *italic*
      runs.push({ text: match[4], bold: false, italic: true });
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), bold: false, italic: false });
  }

  // If no markdown was found, return the whole text as one run
  if (runs.length === 0) {
    runs.push({ text, bold: false, italic: false });
  }

  return runs;
}

// ═══════════════════════════════════════════════════════
// SLIDE BUILDER
// ═══════════════════════════════════════════════════════

function buildSlideRequests(slide, idx, totalSlides, theme, fontFace, g) {
  const requests = [];
  const slideId = `slide_${idx}`;
  const design = slide.design;
  const effectiveTheme = adaptThemeForBg(theme, slide.bgOverride || (design && design.bg));

  // Create blank slide
  requests.push(createSlideRequest(slideId));

  // Background
  const bgColor = (design && design.bg) || slide.bgOverride || theme.bg;
  if (bgColor) {
    requests.push(slideBackgroundRequest(slideId, bgColor));
  }

  if (design) {
    // ── DESIGNED SLIDE (grid-based zones + accents) ──

    const ff = design.font || fontFace;
    const typography = design.typography || {};

    // Accents
    (design.accents || []).forEach((a) => {
      const shapeId = nextId("accent");
      const color = (a.color || "E63946").replace(/^#/, "");
      const x = g.ex(a.col), y = g.ey(a.row);
      const w = g.ew(a.span), h = g.eh(a.rowSpan);

      if (a.type === "dot") {
        requests.push(createEllipseRequest(shapeId, slideId, x, y, w, h));
        requests.push(shapeFillRequest(shapeId, color));
      } else if (a.type === "block") {
        requests.push(createShapeRequest(shapeId, slideId, x, y, w, h));
        requests.push(shapeFillRequest(shapeId, color, 0.15));
      } else if (a.type === "line") {
        // Lines: thin rectangles (same logic as PPTX renderer)
        const isHorizontal = a.span / 60 > a.rowSpan / 40;
        const lw = isHorizontal ? g.ew(a.span) : inchesToEmu(0.02);
        const lh = isHorizontal ? inchesToEmu(0.02) : g.eh(a.rowSpan);
        requests.push(createShapeRequest(shapeId, slideId, x, y, lw, lh));
        requests.push(shapeFillRequest(shapeId, color));
      } else {
        // bar (default)
        requests.push(createShapeRequest(shapeId, slideId, x, y, w, h));
        requests.push(shapeFillRequest(shapeId, color));
      }
    });

    // Zones (text regions)
    (design.zones || []).forEach((zone) => {
      const typo = typography[zone.role] || zone.typography || {};
      const shapeId = nextId("zone");
      const x = g.ex(zone.col), y = g.ey(zone.row);
      const w = g.ew(zone.span), h = g.eh(zone.rowSpan);

      // Build text content
      let text = "";
      let isBold = (typo.weight || 400) >= 700;
      let isItalic = false;

      switch (zone.role) {
        case "title":
          text = slide.title || slide.subtitle || "";
          break;
        case "body":
          text = slide.body.join("\n");
          break;
        case "bullets":
          text = slide.bullets
            .map((b) => {
              const prefix = (b.level || 0) === 0 ? "\u2022 " : "  \u2014 ";
              return prefix + b.text;
            })
            .join("\n");
          break;
        case "label":
          text = (slide.sectionLabel || "").toUpperCase();
          break;
        case "quote":
          text = slide.blockquote || "";
          isItalic = true;
          break;
        default:
          break;
      }

      if (!text) return;

      // Create text box (TEXT_BOX type to support autofit control)
      requests.push(createShapeRequest(shapeId, slideId, x, y, w, h, "TEXT_BOX"));
      // Make it transparent, disable auto-fit to preserve grid dimensions
      requests.push({
        updateShapeProperties: {
          objectId: shapeId,
          shapeProperties: {
            shapeBackgroundFill: { propertyState: "NOT_RENDERED" },
            outline: { propertyState: "NOT_RENDERED" },
            contentAlignment: "TOP",
            autofit: { autofitType: "NONE" },
          },
          fields: "shapeBackgroundFill,outline,contentAlignment,autofit.autofitType",
        },
      });

      // Parse markdown bold/italic and insert as rich text runs
      const textColor = (typo.color || "").replace(/^#/, "") || effectiveTheme.text;
      const baseStyle = {
        fontSize: typo.size || 14,
        fontFamily: ff,
        color: textColor,
        bold: isBold,
        italic: isItalic,
      };

      const runs = parseMarkdownRuns(text);
      const plainText = runs.map(r => r.text).join("");
      requests.push(insertTextRequest(shapeId, plainText));

      // Apply base style to all text
      const tStyle = textStyleRequest(shapeId, baseStyle);
      if (tStyle) requests.push(tStyle);

      // Apply bold/italic overrides for markdown-formatted spans
      let offset = 0;
      for (const run of runs) {
        if (run.bold || run.italic) {
          const overrideStyle = {};
          const fields = [];
          if (run.bold) { overrideStyle.bold = true; fields.push("bold"); }
          if (run.italic) { overrideStyle.italic = true; fields.push("italic"); }
          if (fields.length > 0) {
            requests.push({
              updateTextStyle: {
                objectId: shapeId,
                style: overrideStyle,
                fields: fields.join(","),
                textRange: { type: "FIXED_RANGE", startIndex: offset, endIndex: offset + run.text.length },
              },
            });
          }
        }
        offset += run.text.length;
      }

      // Paragraph style
      const pStyle = {};
      if (typo.align) {
        const alignMap = { left: "START", center: "CENTER", right: "END", justify: "JUSTIFIED" };
        pStyle.alignment = alignMap[typo.align] || "START";
      }
      if (typo.leading) {
        pStyle.lineSpacing = parseFloat(typo.leading) * 100;
      }
      const pReq = paragraphStyleRequest(shapeId, pStyle);
      if (pReq) requests.push(pReq);
    });
  } else {
    // ── UNDESIGNED SLIDE (simple layout fallback) ──
    // Place content in sensible default positions

    const margin = inchesToEmu(0.6);
    const contentW = SLIDE_WIDTH_EMU - margin * 2;

    // Title
    if (slide.title) {
      const titleId = nextId("title");
      const titleH = inchesToEmu(0.8);
      requests.push(createShapeRequest(titleId, slideId, margin, inchesToEmu(0.5), contentW, titleH, "TEXT_BOX"));
      requests.push({
        updateShapeProperties: {
          objectId: titleId,
          shapeProperties: {
            shapeBackgroundFill: { propertyState: "NOT_RENDERED" },
            outline: { propertyState: "NOT_RENDERED" },
            autofit: { autofitType: "NONE" },
          },
          fields: "shapeBackgroundFill,outline,autofit.autofitType",
        },
      });
      requests.push(insertTextRequest(titleId, slide.title));
      const ts = textStyleRequest(titleId, {
        fontSize: 28,
        fontFamily: fontFace,
        color: effectiveTheme.text,
        bold: true,
      });
      if (ts) requests.push(ts);
    }

    // Section label
    if (slide.sectionLabel) {
      const labelId = nextId("label");
      requests.push(createShapeRequest(labelId, slideId, margin, inchesToEmu(0.3), contentW, inchesToEmu(0.4), "TEXT_BOX"));
      requests.push({
        updateShapeProperties: {
          objectId: labelId,
          shapeProperties: {
            shapeBackgroundFill: { propertyState: "NOT_RENDERED" },
            outline: { propertyState: "NOT_RENDERED" },
            autofit: { autofitType: "NONE" },
          },
          fields: "shapeBackgroundFill,outline,autofit.autofitType",
        },
      });
      requests.push(insertTextRequest(labelId, slide.sectionLabel.toUpperCase()));
      const ts = textStyleRequest(labelId, {
        fontSize: 10,
        fontFamily: fontFace,
        color: effectiveTheme.accent,
        bold: true,
      });
      if (ts) requests.push(ts);
    }

    // Body text
    if (slide.body.length) {
      const bodyId = nextId("body");
      const bodyY = slide.title ? inchesToEmu(1.5) : inchesToEmu(0.8);
      requests.push(createShapeRequest(bodyId, slideId, margin, bodyY, contentW, inchesToEmu(3.5), "TEXT_BOX"));
      requests.push({
        updateShapeProperties: {
          objectId: bodyId,
          shapeProperties: {
            shapeBackgroundFill: { propertyState: "NOT_RENDERED" },
            outline: { propertyState: "NOT_RENDERED" },
            autofit: { autofitType: "NONE" },
          },
          fields: "shapeBackgroundFill,outline,autofit.autofitType",
        },
      });
      requests.push(insertTextRequest(bodyId, slide.body.join("\n")));
      const ts = textStyleRequest(bodyId, {
        fontSize: 16,
        fontFamily: fontFace,
        color: effectiveTheme.textMid,
      });
      if (ts) requests.push(ts);
    }

    // Bullets
    if (slide.bullets.length) {
      const bulletsId = nextId("bullets");
      const bulletsY = slide.title ? inchesToEmu(1.5) : inchesToEmu(0.8);
      const bulletsText = slide.bullets
        .map((b) => {
          const prefix = (b.level || 0) === 0 ? "\u2022 " : "  \u2014 ";
          return prefix + b.text;
        })
        .join("\n");
      requests.push(createShapeRequest(bulletsId, slideId, margin, bulletsY, contentW, inchesToEmu(3.5), "TEXT_BOX"));
      requests.push({
        updateShapeProperties: {
          objectId: bulletsId,
          shapeProperties: {
            shapeBackgroundFill: { propertyState: "NOT_RENDERED" },
            outline: { propertyState: "NOT_RENDERED" },
            autofit: { autofitType: "NONE" },
          },
          fields: "shapeBackgroundFill,outline,autofit.autofitType",
        },
      });
      requests.push(insertTextRequest(bulletsId, bulletsText));
      const ts = textStyleRequest(bulletsId, {
        fontSize: 18,
        fontFamily: fontFace,
        color: effectiveTheme.text,
      });
      if (ts) requests.push(ts);
    }

    // Blockquote
    if (slide.blockquote) {
      const quoteId = nextId("quote");
      const quoteY = slide.title ? inchesToEmu(2.0) : inchesToEmu(1.5);
      requests.push(createShapeRequest(quoteId, slideId, inchesToEmu(1.0), quoteY, contentW - inchesToEmu(0.8), inchesToEmu(2.0), "TEXT_BOX"));
      requests.push({
        updateShapeProperties: {
          objectId: quoteId,
          shapeProperties: {
            shapeBackgroundFill: { propertyState: "NOT_RENDERED" },
            outline: { propertyState: "NOT_RENDERED" },
            autofit: { autofitType: "NONE" },
          },
          fields: "shapeBackgroundFill,outline,autofit.autofitType",
        },
      });
      requests.push(insertTextRequest(quoteId, slide.blockquote));
      const ts = textStyleRequest(quoteId, {
        fontSize: 18,
        fontFamily: fontFace,
        color: effectiveTheme.textMid,
        italic: true,
      });
      if (ts) requests.push(ts);
    }
  }

  return { requests, slideId };
}

// ═══════════════════════════════════════════════════════
// SPEAKER NOTES (post-creation via separate API call)
// ═══════════════════════════════════════════════════════

async function addSpeakerNotes(slidesApi, presentationId, slideObjectId, notesText) {
  // Get the slide to find the notes page shape
  const pres = await slidesApi.presentations.get({ presentationId });
  const slide = pres.data.slides.find((s) => s.objectId === slideObjectId);
  if (!slide || !slide.slideProperties || !slide.slideProperties.notesPage) return;

  const notesPage = slide.slideProperties.notesPage;
  // Find the BODY placeholder on the notes page
  const notesShape = notesPage.pageElements.find(
    (el) =>
      el.shape &&
      el.shape.placeholder &&
      el.shape.placeholder.type === "BODY"
  );
  if (!notesShape) return;

  await slidesApi.presentations.batchUpdate({
    presentationId,
    requestBody: {
      requests: [
        {
          insertText: {
            objectId: notesShape.objectId,
            text: notesText,
            insertionIndex: 0,
          },
        },
      ],
    },
  });
}

// ═══════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════

async function exportToGoogleSlides(inputPath, options = {}) {
  const themeName = options.theme || "light";
  const theme = THEMES[themeName] || THEMES.light;
  const fontFace = options.font || "Helvetica Neue";
  const title = options.title || path.basename(inputPath, ".composed.md").replace(/\./g, " ");
  const credPath = options.credentials || process.env.GOOGLE_CREDENTIALS_PATH || "credentials.json";
  const tokenPath = options.token || ".gslides-token.json";

  console.log(dim("\n  ┌─ export-gslides ──────────────────────────"));
  console.log(dim("  │ ") + `Input:  ${teal(inputPath)}`);
  console.log(dim("  │ ") + `Theme:  ${amber(themeName)}`);
  console.log(dim("  │ ") + `Title:  ${sage(title)}`);

  // Authenticate
  console.log(dim("  │"));
  console.log(dim("  │ ") + "Authenticating with Google...");
  const auth = await authorize(credPath, tokenPath);
  const slidesApi = google.slides({ version: "v1", auth });
  const driveApi = google.drive({ version: "v3", auth });

  // Parse markdown
  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);
  console.log(dim("  │ ") + `Parsed ${accent(slides.length)} slides`);

  // Discover spliced images — prefer preprocessed (opacity-baked) if available
  let splicedImages = {};
  const base = path.basename(inputPath, ".composed.md");
  const preprocessedDir = path.join(path.dirname(inputPath), `${base}.gslides-images`);
  if (fs.existsSync(preprocessedDir)) {
    // Use preprocessed images (opacity already baked in)
    const files = fs.readdirSync(preprocessedDir).filter(f => f.endsWith(".png"));
    for (const f of files) {
      const m = f.match(/slide-(\d+)\.png/);
      if (m) splicedImages[parseInt(m[1], 10)] = path.resolve(path.join(preprocessedDir, f));
    }
    console.log(dim("  │ ") + `Found ${teal(Object.keys(splicedImages).length)} preprocessed images (opacity-baked)`);
  } else {
    splicedImages = discoverSplicedImages(inputPath);
    if (Object.keys(splicedImages).length > 0) {
      console.log(dim("  │ ") + `Found ${teal(Object.keys(splicedImages).length)} spliced images (raw — run gslides-preprocess-images.js for better fidelity)`);
    }
  }
  const splicedCount = Object.keys(splicedImages).length;

  // Also collect inline images from slide content
  const basePath = path.dirname(path.resolve(inputPath));
  const inlineImages = [];
  slides.forEach((slide, idx) => {
    if (slide.images && slide.images.length > 0) {
      slide.images.forEach((img) => {
        const imgPath = path.isAbsolute(img.src) ? img.src : path.join(basePath, img.src);
        if (fs.existsSync(imgPath)) {
          inlineImages.push({ slideIdx: idx, img, imgPath });
        }
      });
    }
  });
  if (inlineImages.length > 0) {
    console.log(dim("  │ ") + `Found ${teal(inlineImages.length)} inline images`);
  }

  // Create the grid (EMU-aware)
  const g = createEmuGrid();

  // Build all slide requests
  console.log(dim("  │ ") + "Building slide requests...");
  const allRequests = [];
  const slideIds = [];
  const slideNotes = [];

  slides.forEach((slide, idx) => {
    const { requests, slideId } = buildSlideRequests(
      slide, idx, slides.length, theme, fontFace, g
    );
    allRequests.push(...requests);
    slideIds.push(slideId);
    if (slide.notes) {
      slideNotes.push({ slideId, notes: slide.notes });
    }
  });

  // Create presentation
  console.log(dim("  │ ") + "Creating presentation...");
  const presentation = await slidesApi.presentations.create({
    requestBody: {
      title,
      pageSize: {
        width: { magnitude: SLIDE_WIDTH_EMU, unit: "EMU" },
        height: { magnitude: SLIDE_HEIGHT_EMU, unit: "EMU" },
      },
    },
  });

  const presentationId = presentation.data.presentationId;
  console.log(dim("  │ ") + `Presentation ID: ${dim(presentationId)}`);

  // Delete the default blank slide that Google creates
  const defaultSlideId = presentation.data.slides[0].objectId;
  const deleteDefault = [{ deleteObject: { objectId: defaultSlideId } }];

  // Batch: delete default slide + create all our slides
  // Google Slides API has a limit of ~500 requests per batch, so chunk if needed
  const CHUNK_SIZE = 400;
  const fullRequests = [...deleteDefault, ...allRequests];

  for (let i = 0; i < fullRequests.length; i += CHUNK_SIZE) {
    const chunk = fullRequests.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(fullRequests.length / CHUNK_SIZE);
    if (totalChunks > 1) {
      console.log(dim("  │ ") + `Sending batch ${chunkNum}/${totalChunks} (${chunk.length} requests)...`);
    }
    await slidesApi.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: chunk },
    });
  }

  console.log(dim("  │ ") + sage(`Created ${slides.length} slides`));

  // Upload and place images
  const totalImages = splicedCount + inlineImages.length;
  if (totalImages > 0) {
    console.log(dim("  │"));
    console.log(dim("  │ ") + `Uploading ${totalImages} images to Drive...`);

    // Upload spliced images (atmospheric backgrounds, one per slide)
    const imageRequests = [];
    let uploaded = 0;

    for (const [slideNum, imgPath] of Object.entries(splicedImages)) {
      const idx = parseInt(slideNum, 10) - 1; // slide numbers are 1-based
      if (idx < 0 || idx >= slides.length) continue;
      const slideId = `slide_${idx}`;

      try {
        const fileName = `${title} - slide ${slideNum}`;
        const fileId = await uploadImageToDrive(driveApi, imgPath, fileName);
        const imageUrl = `https://drive.google.com/uc?id=${fileId}`;
        const imageId = nextId("img");

        // Full-bleed background image
        imageRequests.push(createImageRequest(
          imageId, slideId, imageUrl,
          0, 0, SLIDE_WIDTH_EMU, SLIDE_HEIGHT_EMU
        ));
        // Send to back so text zones render on top
        imageRequests.push(sendToBackRequest(imageId, slideId));

        uploaded++;
        if (uploaded % 10 === 0) {
          console.log(dim("  │ ") + dim(`  ${uploaded}/${totalImages} uploaded...`));
        }
      } catch (err) {
        console.log(dim("  │ ") + amber(`  Warning: failed to upload slide ${slideNum}: ${err.message}`));
      }
    }

    // Upload inline images (positioned in image zones or default placement)
    for (const { slideIdx, img, imgPath } of inlineImages) {
      const slideId = `slide_${slideIdx}`;
      const design = slides[slideIdx].design;

      try {
        const fileName = `${title} - ${path.basename(imgPath)}`;
        const fileId = await uploadImageToDrive(driveApi, imgPath, fileName);
        const imageUrl = `https://drive.google.com/uc?id=${fileId}`;
        const imageId = nextId("inlineimg");

        // Check if there's an image zone in the design directive
        const imageZone = design && (design.zones || []).find((z) => z.role === "image");
        if (imageZone) {
          // Place in the designated image zone
          imageRequests.push(createImageRequest(
            imageId, slideId, imageUrl,
            g.ex(imageZone.col), g.ey(imageZone.row),
            g.ew(imageZone.span), g.eh(imageZone.rowSpan)
          ));
        } else {
          // Default: right side of slide, moderate size
          imageRequests.push(createImageRequest(
            imageId, slideId, imageUrl,
            inchesToEmu(5.5), inchesToEmu(1.0),
            inchesToEmu(4.0), inchesToEmu(3.5)
          ));
        }

        uploaded++;
        if (uploaded % 10 === 0) {
          console.log(dim("  │ ") + dim(`  ${uploaded}/${totalImages} uploaded...`));
        }
      } catch (err) {
        console.log(dim("  │ ") + amber(`  Warning: failed to upload ${img.src}: ${err.message}`));
      }
    }

    console.log(dim("  │ ") + sage(`Uploaded ${uploaded} images`));

    // Batch the image placement requests
    if (imageRequests.length > 0) {
      console.log(dim("  │ ") + "Placing images on slides...");
      for (let i = 0; i < imageRequests.length; i += CHUNK_SIZE) {
        const chunk = imageRequests.slice(i, i + CHUNK_SIZE);
        await slidesApi.presentations.batchUpdate({
          presentationId,
          requestBody: { requests: chunk },
        });
      }
    }
  }

  // Add speaker notes (requires separate calls since we need the notes page shape IDs)
  if (slideNotes.length) {
    console.log(dim("  │ ") + `Adding speaker notes to ${slideNotes.length} slides...`);
    for (const { slideId, notes } of slideNotes) {
      try {
        await addSpeakerNotes(slidesApi, presentationId, slideId, notes);
      } catch (err) {
        console.log(dim("  │ ") + amber(`  Warning: could not add notes to ${slideId}: ${err.message}`));
      }
    }
  }

  const url = `https://docs.google.com/presentation/d/${presentationId}/edit`;
  console.log(dim("  │"));
  console.log(dim("  │ ") + sage("Done!"));
  console.log(dim("  │ ") + teal(url));
  console.log(dim("  └──────────────────────────────────────────\n"));

  // Open in browser if requested
  if (options.open) {
    const { exec } = require("child_process");
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${cmd} "${url}"`);
  }

  return { presentationId, url, slideCount: slides.length };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  ${accent("export-gslides")} — export composed markdown to Google Slides

  ${dim("Usage:")}
    node export-gslides.js <input.composed.md> [options]

  ${dim("Options:")}
    --theme <name>        Theme: light|dark|red|blue (default: light)
    --title <name>        Presentation title (default: filename)
    --font <name>         Font family (default: Helvetica Neue)
    --open                Open in browser after creation
    --token <path>        OAuth token file (default: .gslides-token.json)
    --credentials <path>  OAuth credentials JSON (default: credentials.json)

  ${dim("Setup:")}
    1. Create a Google Cloud project
    2. Enable Google Slides API + Google Drive API
    3. Create OAuth2 credentials (Desktop app)
    4. Download to ./credentials.json
`);
    process.exit(0);
  }

  const inputPath = args.find((a) => !a.startsWith("--"));
  const getOpt = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
  };

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error(accent("  Error:"), `File not found: ${inputPath}`);
    process.exit(1);
  }

  exportToGoogleSlides(inputPath, {
    theme: getOpt("--theme"),
    title: getOpt("--title"),
    font: getOpt("--font"),
    open: args.includes("--open"),
    token: getOpt("--token"),
    credentials: getOpt("--credentials"),
  }).catch((err) => {
    console.error(accent("  Error:"), err.message);
    if (err.errors) console.error(dim("  Details:"), JSON.stringify(err.errors, null, 2));
    process.exit(1);
  });
}

module.exports = {
  exportToGoogleSlides,
  // Internals exposed for testing
  _internals: {
    hexToRgb, rgbColor, inchesToEmu, ptToEmu,
    createEmuGrid,
    buildSlideRequests,
    discoverSplicedImages,
    createShapeRequest, createEllipseRequest,
    shapeFillRequest, insertTextRequest,
    textStyleRequest, paragraphStyleRequest,
    createImageRequest, sendToBackRequest, imageTransparencyRequest,
    slideBackgroundRequest, parseMarkdownRuns,
    EMU_PER_INCH, SLIDE_WIDTH_EMU, SLIDE_HEIGHT_EMU,
  },
};
