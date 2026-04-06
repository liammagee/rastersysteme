#!/usr/bin/env node
/**
 * Rename batch-generated images from local numbering (1-N) to presentation slide numbering.
 * Usage: node gslides-rename-batch.js --dir <images-dir> --start <first-pres-slide> --count <N>
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const getOpt = (f) => { const i = args.indexOf(f); return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined; };

const dir = getOpt("--dir") || "decks/gslides-1TimgHnV-images/gslides-imagine-temp-images";
const startSlide = parseInt(getOpt("--start") || "16");
const count = parseInt(getOpt("--count") || "14");
const outDir = getOpt("--out") || path.join(dir, "renamed");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (let i = 1; i <= count; i++) {
  const localNum = String(i).padStart(2, "0");
  const presNum = String(startSlide + i - 1).padStart(2, "0");
  const src = path.join(dir, `slide-${localNum}.png`);
  const dst = path.join(outDir, `slide-${presNum}.png`);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`  slide-${localNum}.png → slide-${presNum}.png (pres slide ${startSlide + i - 1})`);
  }
}
console.log(`Done. Renamed files in: ${outDir}`);
