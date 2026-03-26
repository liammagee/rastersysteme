#!/usr/bin/env node
/**
 * qa-html — quality audit on a rendered HTML slideshow
 *
 * Opens the HTML in a headless browser, inspects each slide for:
 * - Actual rendered contrast ratios (computed colors, not theme values)
 * - Text overflow / clipping
 * - Missing images (broken src)
 * - Empty slides (no visible content)
 * - Font loading failures
 * - Element visibility issues
 *
 * Usage:
 *   node qa-html.js <slides.html> [options]
 *
 * Requires: npm install puppeteer
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
// CONTRAST UTILITIES
// ═══════════════════════════════════════════════════════

function parseCSSColor(cssColor) {
  const rgb = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) return { r: parseInt(rgb[1]), g: parseInt(rgb[2]), b: parseInt(rgb[3]) };
  return null;
}

function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ═══════════════════════════════════════════════════════
// HTML QA RUNNER
// ═══════════════════════════════════════════════════════

async function qaHTML(htmlPath, options = {}) {
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

  const url = htmlPath.startsWith("http") ? htmlPath : `file://${path.resolve(htmlPath)}`;

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("qa-html")}\n`);
  process.stderr.write(`  ${dim("Source:")} ${teal(path.basename(htmlPath))}\n`);

  const browser = await puppeteer.launch({ headless: "new", args: ["--window-size=1920,1080"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

  // Count slides
  const slideCount = await page.evaluate(() =>
    document.querySelectorAll(".slide, .grid-slide").length
  );

  process.stderr.write(`  ${dim("Slides:")} ${slideCount}\n\n`);

  const results = [];

  for (let i = 0; i < slideCount; i++) {
    // Show this slide
    await page.evaluate((idx) => {
      const slides = document.querySelectorAll(".slide, .grid-slide");
      slides.forEach((s, j) => {
        s.classList.toggle("active", j === idx);
        s.style.display = j === idx ? "flex" : "none";
      });
    }, i);
    await new Promise(r => setTimeout(r, 150));

    // Run checks on this slide
    const slideResults = await page.evaluate((slideIdx) => {
      const issues = [];
      const slide = document.querySelectorAll(".slide, .grid-slide")[slideIdx];
      if (!slide) return issues;

      const cs = getComputedStyle(slide);
      const bgColor = cs.backgroundColor;

      // Parse bg color
      function parseRGB(str) {
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
      }

      function lumFromRGB(c) {
        const [rs, gs, bs] = [c.r, c.g, c.b].map(v => {
          v = v / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      function contrast(fg, bg) {
        const l1 = lumFromRGB(fg), l2 = lumFromRGB(bg);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }

      const bg = parseRGB(bgColor) || { r: 255, g: 255, b: 255 };

      // 1. Check text contrast
      const textEls = slide.querySelectorAll("h1, h2, h3, p, li, span, blockquote, .label, .bullet, td, th, code, .stagger-bar, .frag-cell, .pill");
      textEls.forEach(el => {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return;
        const text = el.textContent.trim();
        if (!text) return;

        const fgColor = parseRGB(style.color);
        // Get the element's actual background (might differ from slide bg)
        let elBg = parseRGB(style.backgroundColor);
        if (!elBg || (elBg.r === 0 && elBg.g === 0 && elBg.b === 0 && style.backgroundColor.includes("0)"))) {
          elBg = bg; // transparent — use slide bg
        }

        if (fgColor && elBg) {
          const ratio = contrast(fgColor, elBg);
          const fontSize = parseFloat(style.fontSize);
          const isBold = parseInt(style.fontWeight) >= 700;
          const isLarge = fontSize >= 18 || (fontSize >= 14 && isBold);
          const minRatio = isLarge ? 3.0 : 4.5;

          if (ratio < minRatio) {
            issues.push({
              severity: ratio < 2 ? "error" : "warning",
              check: "contrast",
              message: `Contrast ${ratio.toFixed(1)}:1 (need ${minRatio}:1) on "${text.slice(0, 30)}" — fg:rgb(${fgColor.r},${fgColor.g},${fgColor.b}) bg:rgb(${elBg.r},${elBg.g},${elBg.b})`,
            });
          }
        }
      });

      // 2. Check for overflow / clipping
      const allEls = slide.querySelectorAll("*");
      allEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.display === "none" || rect.width === 0) return;
        if (rect.right > 1920 + 10 || rect.bottom > 1080 + 10) {
          const tag = el.tagName.toLowerCase();
          if (!["script", "style", "link", "meta"].includes(tag)) {
            issues.push({
              severity: "warning",
              check: "overflow",
              message: `Element <${tag}> overflows viewport (right:${Math.round(rect.right)} bottom:${Math.round(rect.bottom)})`,
            });
          }
        }
      });

      // 3. Check for broken images
      const imgs = slide.querySelectorAll("img");
      imgs.forEach(img => {
        if (!img.complete || img.naturalWidth === 0) {
          issues.push({
            severity: "error",
            check: "image",
            message: `Broken image: ${img.src.split("/").pop()}`,
          });
        }
      });

      // 4. Check for empty slide
      const visibleText = slide.textContent.trim().replace(/\s+/g, " ");
      const hasImages = slide.querySelectorAll("img").length > 0;
      const hasShapes = slide.querySelectorAll("[class*=accent], [class*=arc], [class*=dot]").length > 0;
      if (visibleText.length < 5 && !hasImages && !hasShapes) {
        // Only flag if it's not an intentional blank
        if (!slide.classList.contains("layout-blank") && !slide.querySelector(".blank")) {
          issues.push({
            severity: "warning",
            check: "empty",
            message: "Slide appears empty (no visible text, images, or shapes)",
          });
        }
      }

      return issues;
    }, i);

    if (slideResults.length > 0) {
      results.push({ slide: i + 1, issues: slideResults });
    }

    // Progress
    const status = slideResults.length === 0 ? sage("✓") :
      slideResults.some(r => r.severity === "error") ? accent("✗") : amber("⚠");
    process.stderr.write(`  ${status} Slide ${String(i + 1).padStart(2)} ${slideResults.length > 0 ? dim(`(${slideResults.length} issues)`) : ""}\n`);
  }

  // 5. Check font loading
  const fontIssues = await page.evaluate(() => {
    const issues = [];
    if (document.fonts && document.fonts.status === "loaded") {
      // Check specific fonts we expect
      const expected = ["DM Serif Display", "Space Mono", "DM Sans"];
      expected.forEach(font => {
        if (!document.fonts.check(`16px "${font}"`)) {
          issues.push({
            severity: "warning",
            check: "font",
            message: `Font "${font}" may not have loaded`,
          });
        }
      });
    }
    return issues;
  });

  await browser.close();

  // Summary
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0) + fontIssues.length;
  const errors = results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === "error").length, 0);
  const warnings = totalIssues - errors;
  const cleanSlides = slideCount - results.length;

  process.stderr.write(`\n  ${dim("─".repeat(40))}\n`);
  process.stderr.write(`  ${cleanSlides}/${slideCount} slides clean\n`);
  if (errors > 0) process.stderr.write(`  ${accent(`${errors} errors`)}\n`);
  if (warnings > 0) process.stderr.write(`  ${amber(`${warnings} warnings`)}\n`);

  // Detail
  if (totalIssues > 0) {
    process.stderr.write(`\n`);
    results.forEach(r => {
      r.issues.forEach(issue => {
        const icon = issue.severity === "error" ? accent("✗") : amber("⚠");
        process.stderr.write(`  ${icon} Slide ${r.slide}: ${issue.message}\n`);
      });
    });
    fontIssues.forEach(issue => {
      process.stderr.write(`  ${amber("⚠")} ${issue.message}\n`);
    });
  }

  if (totalIssues === 0) {
    process.stderr.write(`  ${sage("✓")} All checks passed\n`);
  }

  return { slideCount, cleanSlides, errors, warnings, results, fontIssues };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  qa-html — quality audit on rendered HTML slideshows

  Runs a headless browser and inspects each slide for:
    - WCAG contrast ratios (computed, not theme values)
    - Text/element overflow beyond viewport
    - Broken images
    - Empty slides
    - Font loading failures

  Usage:
    node qa-html.js <slides.html>
    node qa-html.js http://localhost:8701/decks/week-1.html

  Requires:
    npm install puppeteer

  Examples:
    node qa-html.js decks/week-1.html
    node qa-html.js decks/week-1.composed.html
    node qa-html.js http://localhost:8701/decks/week-1.html
    `);
    process.exit(0);
  }

  const input = args[0];
  if (!input.startsWith("http") && !fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  const jsonMode = args.includes("--json");

  qaHTML(input).then(result => {
    if (jsonMode) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(result.errors > 0 ? 1 : 0);
  }).catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { qaHTML };
