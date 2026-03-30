#!/usr/bin/env node
/**
 * gslides-preprocess-images — bake atmospheric opacity into PNGs for Google Slides export.
 *
 * Since the Google Slides API doesn't support per-element transparency,
 * we composite the slide background color over the image at a given opacity
 * to simulate the atmospheric effect used in the HTML splice renderer.
 *
 * Usage:
 *   node gslides-preprocess-images.js <source.composed.md> [--opacity 0.75] [--out <dir>]
 *
 * Produces: <out>/slide-NN.png for each source image, with background color overlaid.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { parseMarkdown } = require("./raster.js");

const DEFAULT_OPACITY = 0.75; // How much bg color covers the image (higher = more faded)

function hexToRgb(hex) {
  hex = (hex || "F8F5F0").replace(/^#/, "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/**
 * Use sips (macOS) to get image dimensions, then use a canvas script to composite.
 * Falls back to writing a Node script with Puppeteer canvas if needed.
 */
function processImage(srcPath, outPath, bgHex, opacity) {
  const bg = hexToRgb(bgHex);
  // Use ImageMagick (convert) or GraphicsMagick if available, otherwise Puppeteer
  // Try sips + canvas approach via a temp node script
  const script = `
const fs = require('fs');
const { createCanvas, loadImage } = (() => {
  try { return require('canvas'); } catch { return { createCanvas: null, loadImage: null }; }
})();

async function main() {
  if (!createCanvas) {
    // Fallback: use Puppeteer to do the compositing
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const imgBuf = fs.readFileSync('${srcPath.replace(/'/g, "\\'")}');
    const b64 = imgBuf.toString('base64');
    const dataUrl = 'data:image/png;base64,' + b64;

    await page.setContent('<canvas id="c"></canvas><script>'+
      'const img=new Image();img.onload=()=>{'+
      'const c=document.getElementById("c");c.width=img.width;c.height=img.height;'+
      'const ctx=c.getContext("2d");'+
      'ctx.drawImage(img,0,0);'+
      'ctx.fillStyle="rgba(${bg.r},${bg.g},${bg.b},${opacity})";'+
      'ctx.fillRect(0,0,c.width,c.height);'+
      'window.__result=c.toDataURL("image/png")};'+
      'img.src="'+dataUrl+'";'+
      '</'+'script>');

    await page.waitForFunction('window.__result', { timeout: 10000 });
    const result = await page.evaluate(() => window.__result);
    const pngData = Buffer.from(result.split(',')[1], 'base64');
    fs.writeFileSync('${outPath.replace(/'/g, "\\'")}', pngData);
    await browser.close();
    return;
  }

  // node-canvas path
  const img = await loadImage('${srcPath.replace(/'/g, "\\'")}');
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = 'rgba(${bg.r},${bg.g},${bg.b},${opacity})';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  fs.writeFileSync('${outPath.replace(/'/g, "\\'")}', canvas.toBuffer('image/png'));
}
main().catch(e => { console.error(e.message); process.exit(1); });
`;

  const tmpScript = path.join(path.dirname(outPath), ".gslides-composite-tmp.js");
  fs.writeFileSync(tmpScript, script);
  try {
    execSync(`node "${tmpScript}"`, { stdio: "pipe", timeout: 30000 });
  } finally {
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
  }
}

function discoverSplicedImages(inputPath) {
  const base = path.basename(inputPath, ".composed.md");
  const baseNoVersion = /-v\d+$/.test(base) ? base.replace(/-v\d+$/, "") : base;
  const dir = path.dirname(inputPath);
  const candidates = [
    path.join(dir, `${base}.composed-images`),
    path.join("decks", `${base}.composed-images`),
    path.join(dir, `${baseNoVersion}.composed-images`),
    path.join("decks", `${baseNoVersion}.composed-images`),
    path.join(dir, `${base}-images`),
    path.join("decks", `${base}-images`),
    path.join(dir, `${baseNoVersion}-images`),
    path.join("decks", `${baseNoVersion}-images`),
  ];
  const imgDir = candidates.find((d) => fs.existsSync(d));
  if (!imgDir) return {};
  const map = {};
  const files = fs.readdirSync(imgDir).filter((f) => f.endsWith(".png"));
  for (const f of files) {
    const m = f.match(/slide-(\d+)\.png/);
    if (m) map[parseInt(m[1], 10)] = path.resolve(path.join(imgDir, f));
  }
  return map;
}

async function preprocessImages(inputPath, options = {}) {
  const opacity = options.opacity || DEFAULT_OPACITY;
  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);
  const images = discoverSplicedImages(inputPath);

  const base = path.basename(inputPath, ".composed.md");
  const outDir = options.out || path.join(path.dirname(inputPath), `${base}.gslides-images`);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const chalk = require("chalk");
  console.log(chalk.dim("  Preprocessing images with opacity=" + opacity));

  let processed = 0;
  for (const [slideNum, srcPath] of Object.entries(images)) {
    const idx = parseInt(slideNum, 10) - 1;
    if (idx < 0 || idx >= slides.length) continue;

    // Get slide background color
    const design = slides[idx].design;
    const bgColor = (design && design.bg) || "F8F5F0";

    const outPath = path.join(outDir, `slide-${String(slideNum).padStart(2, "0")}.png`);
    try {
      processImage(srcPath, outPath, bgColor, opacity);
      processed++;
      if (processed % 10 === 0) {
        console.log(chalk.dim(`  ${processed}/${Object.keys(images).length} processed...`));
      }
    } catch (err) {
      console.log(chalk.yellow(`  Warning: ${slideNum}: ${err.message}`));
    }
  }

  console.log(chalk.green(`  Preprocessed ${processed} images → ${outDir}`));
  return { outDir, processed };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith("--"));
  const getOpt = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
  };
  if (!input) { console.error("Usage: node gslides-preprocess-images.js <source.composed.md>"); process.exit(1); }
  preprocessImages(input, {
    opacity: parseFloat(getOpt("--opacity") || DEFAULT_OPACITY),
    out: getOpt("--out"),
  }).catch((err) => { console.error(err.message); process.exit(1); });
}

module.exports = { preprocessImages, processImage, discoverSplicedImages };
