#!/usr/bin/env node
// build-manifest.js — Generate decks/manifest.json for the static gallery
// Run: node build-manifest.js
// Called automatically by npm run gallery or before deploying to GitHub Pages.

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DECKS_DIR = path.join(ROOT, "decks");
const OUTPUT = path.join(DECKS_DIR, "manifest.json");

const seen = new Set();
const decks = [];

function extractDeckMeta(full, rel, category) {
  try {
    const stat = fs.statSync(full);
    const content = fs.readFileSync(full, "utf-8");
    const slideCount = (content.match(/<section class="slide/g) || []).length;
    if (slideCount === 0) return null;

    const name = path.basename(rel, ".html");
    let type = "deck";
    if (name.includes(".review") || name.includes("-review")) type = "review";
    else if (name.includes(".studio") || name.includes("-studio")) type = "studio";
    else if (name.includes(".qa") || name.includes(".audit")) type = "qa";
    else if (name.includes(".grid")) type = "grid";
    else if (name.includes(".reveal")) type = "reveal";
    else if (name.includes("diff-")) type = "diff";
    else if (name.includes(".spliced") || name.includes(".merged")) type = "spliced";

    let theme = "light";
    const bgMatch = content.match(/--bg:#([0-9A-Fa-f]{6})/);
    if (bgMatch) {
      const hex = bgMatch[1];
      const lum = parseInt(hex.slice(0,2),16)*0.299 + parseInt(hex.slice(2,4),16)*0.587 + parseInt(hex.slice(4,6),16)*0.114;
      theme = lum < 128 ? "dark" : "light";
    }

    const titleMatch = content.match(/<(?:h1|div)[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/i)
      || content.match(/<h1[^>]*>([^<]+)/i);
    const firstTitle = titleMatch ? titleMatch[1].trim().slice(0, 60) : "";

    return {
      type, category, path: rel, name,
      slides: slideCount, theme, firstTitle,
      size: (stat.size / 1024).toFixed(0) + "K",
      modified: stat.mtime.toISOString(),
    };
  } catch { return null; }
}

function scanHTML(dir, category, recursive = false) {
  if (!fs.existsSync(dir)) return;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && recursive) {
        if (entry.name.startsWith("compare-")) {
          scanCompareDir(full);
        } else if (!entry.name.includes("node_modules") && !entry.name.endsWith("-images")) {
          scanHTML(full, category, true);
        }
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
      if (entry.name === "index.html" || entry.name.includes("template")) continue;

      const rel = path.relative(ROOT, full);
      if (seen.has(rel)) continue;
      seen.add(rel);

      const meta = extractDeckMeta(full, rel, category);
      if (meta) decks.push(meta);
    }
  } catch {}
}

function scanCompareDir(dir) {
  const dirName = path.basename(dir);
  const dateMatch = dirName.match(/(\d{4}-\d{2}-\d{2}[-_]\d{2}[-_]\d{2})/);
  const dateStr = dateMatch ? dateMatch[1].replace(/_/g, "-") : "";
  const variants = [];

  try {
    for (const variant of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!variant.isDirectory()) continue;
      const variantDir = path.join(dir, variant.name);
      for (const f of fs.readdirSync(variantDir)) {
        if (!f.endsWith(".html")) continue;
        const full = path.join(variantDir, f);
        const rel = path.relative(ROOT, full);
        if (seen.has(rel)) continue;
        seen.add(rel);
        variants.push({ path: rel, variant: variant.name, name: f });
      }
    }
  } catch {}

  if (variants.length > 0) {
    decks.push({
      type: "compare", name: dirName, date: dateStr,
      path: path.relative(ROOT, dir), variants,
    });
  }
}

// Scan root-level HTML (showcase, etc.) and decks/ directory
scanHTML(ROOT, "root", false);
scanHTML(DECKS_DIR, "decks", true);

// Sort: regular decks first by modified date, compare runs last
decks.sort((a, b) => {
  if (a.type === "compare" && b.type !== "compare") return 1;
  if (a.type !== "compare" && b.type === "compare") return -1;
  return (b.modified || b.date || "") > (a.modified || a.date || "") ? 1 : -1;
});

fs.writeFileSync(OUTPUT, JSON.stringify(decks, null, 2));
console.log(`manifest.json: ${decks.length} decks written to ${path.relative(ROOT, OUTPUT)}`);
