#!/usr/bin/env node
/**
 * export-pdf — export HTML slideshow to PDF (one page per slide)
 *
 * Uses Puppeteer to screenshot each slide at 16:9 and assemble into a PDF.
 * Speaker notes can be included as appendix pages.
 *
 * Usage:
 *   node export-pdf.js <slides.html> [options]
 *
 * Requires: npm install puppeteer (or puppeteer-core with Chrome path)
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

// ═══════════════════════════════════════════════════════
// PDF GENERATOR
// ═══════════════════════════════════════════════════════

async function exportPDF(htmlPath, options = {}) {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch {
    try {
      puppeteer = require("puppeteer-core");
    } catch {
      console.error(`  ${accent("✗")} Puppeteer not installed. Run: npm install puppeteer`);
      process.exit(1);
    }
  }

  const outputPath = options.output || htmlPath.replace(/\.html$/, ".pdf");
  const width = options.width || 1920;
  const height = options.height || 1080;
  const includeNotes = options.notes !== false;

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("export-pdf")}\n`);
  process.stderr.write(`  ${dim("Source:")} ${teal(path.basename(htmlPath))}\n`);
  process.stderr.write(`  ${dim("Size:")} ${width}×${height}\n`);

  // Resolve to file:// URL or http:// if already a URL
  const url = htmlPath.startsWith("http")
    ? htmlPath
    : `file://${path.resolve(htmlPath)}`;

  const browser = await puppeteer.launch({
    headless: "new",
    args: [`--window-size=${width},${height}`],
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

  // Count slides
  const slideCount = await page.evaluate(() => {
    return document.querySelectorAll(".slide, .grid-slide").length;
  });

  process.stderr.write(`  ${dim("Slides:")} ${slideCount}\n`);

  // Screenshot each slide
  const screenshots = [];
  const notes = [];

  for (let i = 0; i < slideCount; i++) {
    process.stderr.write(`\r  ${dim("Capturing")} ${i + 1}/${slideCount}...`);

    // Navigate to slide i
    await page.evaluate((idx) => {
      const slides = document.querySelectorAll(".slide, .grid-slide");
      slides.forEach((s, j) => {
        s.classList.toggle("active", j === idx);
        s.style.display = j === idx ? "flex" : "none";
      });
    }, i);

    // Brief pause for transitions/rendering
    await page.waitForTimeout(200);

    // Screenshot
    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height },
    });
    screenshots.push(screenshot);

    // Extract notes
    if (includeNotes) {
      const noteText = await page.evaluate((idx) => {
        const slides = document.querySelectorAll(".slide, .grid-slide");
        const noteEl = slides[idx]?.querySelector(".slide-notes");
        return noteEl ? noteEl.textContent.trim() : "";
      }, i);
      notes.push(noteText);
    }
  }

  process.stderr.write(`\r  ${sage("✓")} Captured ${slideCount} slides       \n`);

  // Build PDF using a new page with slide images
  const pdfPage = await browser.newPage();

  const slideImgs = screenshots.map((buf, i) => {
    const b64 = buf.toString("base64");
    const noteHtml = includeNotes && notes[i]
      ? `<div class="note"><div class="note-num">Slide ${i + 1} — Notes</div><div class="note-text">${notes[i].replace(/\n/g, "<br>")}</div></div>`
      : "";
    return `<div class="page"><img src="data:image/png;base64,${b64}"></div>${noteHtml}`;
  }).join("");

  const pdfHtml = `<!DOCTYPE html><html><head>
<style>
@page{size:${width}px ${height}px;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000}
.page{width:${width}px;height:${height}px;page-break-after:always;overflow:hidden}
.page img{width:100%;height:100%;object-fit:contain}
.note{width:${width}px;min-height:${height}px;page-break-after:always;
  background:#fafafa;padding:80px;font-family:'Helvetica Neue',sans-serif}
.note-num{font-size:14px;color:#888;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:24px;
  border-bottom:1px solid #ddd;padding-bottom:12px}
.note-text{font-size:18px;line-height:1.7;color:#333;white-space:pre-wrap}
</style></head><body>${slideImgs}</body></html>`;

  await pdfPage.setContent(pdfHtml, { waitUntil: "networkidle0" });

  await pdfPage.pdf({
    path: outputPath,
    width: `${width}px`,
    height: `${height}px`,
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();

  const fileSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
  process.stderr.write(`  ${sage("✓")} PDF → ${teal(outputPath)} ${dim(`(${fileSize}MB)`)}\n`);

  return { output: outputPath, slides: slideCount, size: fileSize };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  export-pdf — export HTML slideshow to PDF

  Usage:
    node export-pdf.js <slides.html> [options]

  Options:
    --output <path>     Output PDF path (default: same name as input)
    --width <px>        Page width (default: 1920)
    --height <px>       Page height (default: 1080)
    --no-notes          Exclude speaker notes pages
    --help              Show this help

  Requires:
    npm install puppeteer

  Examples:
    node export-pdf.js decks/week-1.html
    node export-pdf.js decks/week-1.html --output presentation.pdf
    node export-pdf.js decks/week-1.html --no-notes --width 2560 --height 1440
    `);
    process.exit(0);
  }

  const input = args[0];
  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  if (!fs.existsSync(input) && !input.startsWith("http")) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  exportPDF(input, {
    output: getFlag("--output"),
    width: parseInt(getFlag("--width") || "1920"),
    height: parseInt(getFlag("--height") || "1080"),
    notes: !args.includes("--no-notes"),
  }).catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { exportPDF };
