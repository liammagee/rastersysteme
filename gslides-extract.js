#!/usr/bin/env node
/**
 * gslides-extract — extract Google Slides content to markdown
 *
 * Reads a Google Slides presentation via the API and converts to
 * rastersysteme source markdown format (one slide per --- block).
 *
 * Usage:
 *   node gslides-extract.js <presentation-id-or-url> [--output <path>]
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { google } = require("googleapis");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;

const EMU_PER_INCH = 914400;

// ── Auth ─────────────────────────────────────────

function authenticate() {
  const credPath = process.env.GOOGLE_CREDENTIALS_PATH || "/Users/lmagee/Dev/youtube-playlist/client_secret.json";
  const tokenPath = ".gslides-token.json";

  if (!fs.existsSync(credPath)) {
    throw new Error(`Credentials not found: ${credPath}`);
  }
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`Token not found: ${tokenPath} — run export-gslides.js first to authenticate`);
  }

  const raw = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  const creds = raw.installed || raw.web;
  const oauth2 = new google.auth.OAuth2(
    creds.client_id, creds.client_secret, "http://localhost:3847/oauth2callback"
  );
  oauth2.setCredentials(JSON.parse(fs.readFileSync(tokenPath, "utf-8")));
  return oauth2;
}

// ── Text extraction ──────────────────────────────

function extractText(shape) {
  if (!shape?.text?.textElements) return [];
  const lines = [];
  let current = "";
  for (const el of shape.text.textElements) {
    if (el.textRun) {
      const text = el.textRun.content;
      if (text === "\n") {
        if (current.trim()) lines.push(current.trim());
        current = "";
      } else {
        current += text;
      }
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

function extractRichText(shape) {
  if (!shape?.text?.textElements) return { lines: [], isBullets: false };
  const lines = [];
  let current = "";
  let currentLevel = 0;
  let isBullets = false;

  const flush = () => {
    if (current.trim()) lines.push({ text: current.trim(), level: currentLevel });
    current = "";
  };

  for (const el of shape.text.textElements) {
    if (el.paragraphMarker) {
      flush();
      if (el.paragraphMarker.bullet) {
        isBullets = true;
        currentLevel = el.paragraphMarker.bullet.nestingLevel || 0;
      } else {
        currentLevel = 0;
      }
    }
    if (el.textRun) {
      current += el.textRun.content.replace(/\n$/, "");
    }
  }
  flush();
  return { lines, isBullets };
}

function rgbToHex(rgb) {
  if (!rgb) return null;
  return [rgb.red || 0, rgb.green || 0, rgb.blue || 0]
    .map(c => Math.round(c * 255).toString(16).padStart(2, "0"))
    .join("");
}

// ── Shape classification ─────────────────────────

function classifyShape(shape) {
  if (!shape.shape) return "unknown";
  const placeholder = shape.shape.placeholder;
  if (placeholder) {
    switch (placeholder.type) {
      case "TITLE": case "CENTERED_TITLE": return "title";
      case "SUBTITLE": return "subtitle";
      case "BODY": return "body";
      case "SLIDE_NUMBER": return "slide-number";
      default: return placeholder.type.toLowerCase();
    }
  }
  // No placeholder — classify by size/position
  const size = shape.size || {};
  const w = (size.width?.magnitude || 0) / EMU_PER_INCH;
  const h = (size.height?.magnitude || 0) / EMU_PER_INCH;
  if (w > 7 && h < 1.5) return "title-like";
  if (w > 5) return "body-like";
  return "other";
}

// ── Slide → Markdown ─────────────────────────────

function slideToMarkdown(slide, index, imagesDir) {
  const elements = slide.pageElements || [];
  const parts = { title: "", subtitle: "", label: "", body: [], bullets: [], images: [], notes: "", bg: null };

  // Extract background color
  const bg = slide.slideProperties?.notesPage ? null :
    slide.slideProperties?.background?.solidFill?.color?.rgbColor;
  if (bg) {
    const hex = rgbToHex(bg);
    if (hex && hex !== "000000" && hex !== "ffffff") {
      parts.bg = hex;
    }
  }

  // Extract background image
  const bgImage = slide.slideProperties?.background?.stretchedPictureFill;
  if (bgImage?.contentUrl) {
    parts.images.push({ url: bgImage.contentUrl, type: "background" });
  }

  // Process each element (shapes AND images)
  for (const el of elements) {
    // Extract images
    if (el.image) {
      const url = el.image.contentUrl || el.image.sourceUrl;
      if (url) {
        parts.images.push({ url, type: "inline" });
      }
    }

    if (!el.shape) continue;
    const type = classifyShape(el);
    const { lines, isBullets } = extractRichText(el.shape);
    const text = lines.map(l => l.text).join("\n");

    if (!text) continue;

    switch (type) {
      case "title":
      case "title-like":
      case "centered_title":
        parts.title = lines[0]?.text || "";
        if (lines.length > 1) parts.subtitle = lines.slice(1).map(l => l.text).join("\n");
        break;
      case "subtitle":
        parts.subtitle = text;
        break;
      case "body":
      case "body-like":
        if (isBullets) {
          parts.bullets.push(...lines);
        } else {
          parts.body.push(...lines.map(l => l.text));
        }
        break;
      case "other":
        // Small text boxes — could be labels or captions
        if (text.length < 60) {
          parts.label = text;
        } else {
          parts.body.push(text);
        }
        break;
    }
  }

  // Extract speaker notes
  const notesPage = slide.slideProperties?.notesPage;
  if (notesPage?.pageElements) {
    for (const el of notesPage.pageElements) {
      if (el.shape?.placeholder?.type === "BODY") {
        const noteLines = extractText(el.shape);
        if (noteLines.length > 0 && noteLines.some(l => l.length > 0)) {
          parts.notes = noteLines.join("\n");
        }
      }
    }
  }

  // Build markdown
  const md = [];

  if (parts.label) {
    md.push(`### ${parts.label}`);
  }

  if (parts.title) {
    md.push(`# ${parts.title}`);
  }

  if (parts.subtitle) {
    md.push(`\n## ${parts.subtitle}`);
  }

  if (parts.bullets.length > 0) {
    md.push("");
    for (const b of parts.bullets) {
      const level = typeof b === "object" ? b.level || 0 : 0;
      const text = typeof b === "object" ? b.text : b;
      const indent = "  ".repeat(level);
      md.push(`${indent} - ${text}`);
    }
  }

  if (parts.body.length > 0) {
    md.push("");
    for (const line of parts.body) {
      md.push(line);
    }
  }

  if (parts.images.length > 0 && imagesDir) {
    md.push("");
    for (let j = 0; j < parts.images.length; j++) {
      const img = parts.images[j];
      const filename = `slide-${String(index + 1).padStart(2, "0")}${j > 0 ? `-${j + 1}` : ""}.png`;
      const localPath = `images/${filename}`;
      // Store download info for later
      img.localPath = path.join(imagesDir, filename);
      img.mdPath = localPath;
      md.push(`![slide ${index + 1} image](${localPath})`);
    }
  }

  if (parts.notes) {
    md.push("");
    md.push("```notes");
    md.push(parts.notes);
    md.push("```");
  }

  // Prepend directives
  const directives = [];
  if (parts.bg) directives.push(`<!-- bg: ${parts.bg} -->`);

  const content = [...directives, ...md].join("\n").trim();
  return { markdown: content || `<!-- slide ${index + 1}: empty -->`, images: parts.images };
}

// ── Main ─────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.includes("--help")) {
    console.log(`
  gslides-extract — extract Google Slides to markdown

  Usage:
    node gslides-extract.js <presentation-id-or-url> [--output <path>]

  Examples:
    node gslides-extract.js 1TimgHnV... --output content/week-3/week-3.md
    node gslides-extract.js https://docs.google.com/presentation/d/1TimgHnV.../edit
    `);
    process.exit(0);
  }

  // Parse presentation ID from URL or raw ID
  let presId = args.find(a => !a.startsWith("--"));
  const urlMatch = presId.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) presId = urlMatch[1];

  const outputIdx = args.indexOf("--output");
  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : null;

  process.stderr.write(`\n  ${accent("\u25a0")} ${chalk.white.bold("gslides-extract")}\n`);
  process.stderr.write(`  ${dim("Presentation:")} ${teal(presId)}\n`);

  const auth = authenticate();
  const slidesApi = google.slides({ version: "v1", auth });

  process.stderr.write(`  ${dim("Fetching presentation...")}\n`);
  const res = await slidesApi.presentations.get({ presentationId: presId });
  const pres = res.data;

  process.stderr.write(`  ${dim("Title:")} ${pres.title}\n`);
  process.stderr.write(`  ${dim("Slides:")} ${pres.slides.length}\n`);

  // Determine images directory
  const outputDir = outputPath ? path.dirname(outputPath) : process.cwd();
  const imagesDir = path.join(outputDir, "images");

  // Convert each slide
  const slideResults = [];
  const allImages = [];
  for (let i = 0; i < pres.slides.length; i++) {
    const result = slideToMarkdown(pres.slides[i], i, imagesDir);
    slideResults.push(result);
    allImages.push(...result.images.filter(img => img.url && img.localPath));
  }

  const fullMarkdown = slideResults.map(r => r.markdown).join("\n\n---\n\n") + "\n";

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, fullMarkdown, "utf-8");
    process.stderr.write(`  ${sage("\u2713")} ${slideResults.length} slides \u2192 ${teal(outputPath)}\n`);
  } else {
    process.stdout.write(fullMarkdown);
  }

  // Download images
  if (allImages.length > 0) {
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    process.stderr.write(`  ${dim("Downloading")} ${allImages.length} images...\n`);

    const https = require("https");
    const http = require("http");

    let downloaded = 0;
    let failed = 0;
    for (const img of allImages) {
      try {
        await new Promise((resolve, reject) => {
          const get = img.url.startsWith("https") ? https.get : http.get;
          get(img.url, (res) => {
            if (res.statusCode === 200) {
              const chunks = [];
              res.on("data", c => chunks.push(c));
              res.on("end", () => {
                fs.writeFileSync(img.localPath, Buffer.concat(chunks));
                downloaded++;
                resolve();
              });
            } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              // Follow redirect
              const rget = res.headers.location.startsWith("https") ? https.get : http.get;
              rget(res.headers.location, (res2) => {
                const chunks = [];
                res2.on("data", c => chunks.push(c));
                res2.on("end", () => {
                  fs.writeFileSync(img.localPath, Buffer.concat(chunks));
                  downloaded++;
                  resolve();
                });
              }).on("error", reject);
            } else {
              failed++;
              resolve();
            }
          }).on("error", () => { failed++; resolve(); });
        });
      } catch {
        failed++;
      }
    }

    process.stderr.write(`  ${sage("\u2713")} ${downloaded} images downloaded`);
    if (failed > 0) process.stderr.write(` ${accent("(" + failed + " failed)")}`);
    process.stderr.write(`\n  ${dim("Images dir:")} ${teal(imagesDir)}\n\n`);
  } else {
    process.stderr.write(`  ${dim("No images found in presentation")}\n\n`);
  }
}

main().catch(err => {
  console.error(`  ${accent("\u2717")} ${err.message}`);
  process.exit(1);
});
