#!/usr/bin/env node
/**
 * design-system — save, list, show, preview, and apply design systems
 *
 * A design system captures: palette, typography, grid strategy, accent strategy.
 * Once saved, it can be reapplied to any deck for brand consistency.
 *
 * Usage:
 *   node design-system.js list
 *   node design-system.js show <name>
 *   node design-system.js save <name> <design-system.json>
 *   node design-system.js preview <name> [--slides sample.md]
 *   node design-system.js generate <name> [--brief "direction"] [--model sonnet]
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

const LIBRARY_DIR = path.join(__dirname, "design-systems");

// ═══════════════════════════════════════════════════════
// LIBRARY MANAGEMENT
// ═══════════════════════════════════════════════════════

function ensureLibrary() {
  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
}

function listSystems() {
  ensureLibrary();
  return fs.readdirSync(LIBRARY_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, f), "utf-8"));
      return {
        name: f.replace(".json", ""),
        aesthetic: data.aesthetic || "(unnamed)",
        palette: (data.palette || []).map(c => c.hex),
        fonts: data.fontStrategy ? [data.fontStrategy.default, data.fontStrategy.secondary].filter(Boolean) : [],
        file: path.join(LIBRARY_DIR, f),
      };
    });
}

function saveSystem(name, system) {
  ensureLibrary();
  const filePath = path.join(LIBRARY_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(system, null, 2));
  return filePath;
}

function loadSystem(nameOrPath) {
  // Try as a library name first
  const libraryPath = path.join(LIBRARY_DIR, `${nameOrPath}.json`);
  if (fs.existsSync(libraryPath)) {
    return JSON.parse(fs.readFileSync(libraryPath, "utf-8"));
  }
  // Try as a file path
  if (fs.existsSync(nameOrPath)) {
    return JSON.parse(fs.readFileSync(nameOrPath, "utf-8"));
  }
  throw new Error(`Design system not found: ${nameOrPath}`);
}

function deleteSystem(name) {
  const filePath = path.join(LIBRARY_DIR, `${name}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════
// DISPLAY
// ═══════════════════════════════════════════════════════

function showSystem(system, name) {
  console.log("");
  console.log(`  ${accent("■")} ${chalk.white.bold(name || "Design System")}`);
  console.log(`  ${dim(system.aesthetic || "")}`);
  console.log("");

  if (system.palette) {
    console.log(`  ${dim("PALETTE")}`);
    system.palette.forEach(c => {
      const swatch = chalk.bgHex(`#${c.hex}`)("  ");
      console.log(`    ${swatch} ${amber(`#${c.hex}`)} ${c.name} ${dim(`(${c.role})`)}`);
    });
    console.log("");
  }

  if (system.chromaticArc) {
    console.log(`  ${dim("CHROMATIC ARC")}`);
    console.log(`    ${system.chromaticArc}`);
    console.log("");
  }

  if (system.fontStrategy) {
    console.log(`  ${dim("TYPOGRAPHY")}`);
    const f = system.fontStrategy;
    console.log(`    ${chalk.white(f.default)} ${dim("(primary)")}`);
    if (f.secondary) console.log(`    ${chalk.white(f.secondary)} ${dim("(secondary)")}`);
    if (f.tertiary) console.log(`    ${chalk.white(f.tertiary)} ${dim("(tertiary)")}`);
    if (f.secondarySlides) console.log(`    ${dim(f.secondarySlides)}`);
    console.log("");
  }

  if (system.typeScale) {
    console.log(`  ${dim("TYPE SCALE")}`);
    const s = system.typeScale;
    if (s.titleRange) console.log(`    Title: ${s.titleRange[0]}–${s.titleRange[1]}pt`);
    if (s.bodySize) console.log(`    Body:  ${s.bodySize}pt`);
    if (s.labelSize) console.log(`    Label: ${s.labelSize}pt`);
    console.log("");
  }

  if (system.gridStrategy) {
    console.log(`  ${dim("GRID STRATEGY")}`);
    console.log(`    ${system.gridStrategy}`);
    console.log("");
  }

  if (system.accentStrategy) {
    console.log(`  ${dim("ACCENT STRATEGY")}`);
    console.log(`    ${system.accentStrategy}`);
    console.log("");
  }
}

// ═══════════════════════════════════════════════════════
// GENERATE — ask Claude to create a new design system
// ═══════════════════════════════════════════════════════

async function generateSystem(name, options = {}) {
  const { callClaudeWithRetry } = require("./compose.js");

  const brief = options.brief || "Create a distinctive, original design system for a professional presentation. Be specific and opinionated — name colors evocatively, choose fonts with purpose.";

  const prompt = `You are a Swiss-trained art director. Create a complete visual design system for slide presentations.

CREATIVE DIRECTION: ${brief}

Output ONLY valid JSON:
{
  "aesthetic": "Evocative name + 1-sentence description of the visual concept",
  "palette": [
    { "hex": "XXXXXX", "name": "evocative name", "role": "dominant|accent|ground|signal" }
  ],
  "chromaticArc": "How colours flow across a typical 20-40 slide deck",
  "gridStrategy": "How zone positions vary — where titles sit, how margins breathe",
  "typeScale": {
    "titleRange": [28, 42],
    "bodySize": 14,
    "labelSize": 8,
    "titleWeightRange": [400, 700]
  },
  "fontStrategy": {
    "default": "primary typeface",
    "secondary": "contrast typeface or null",
    "tertiary": "accent typeface or null",
    "secondarySlides": "when and why the secondary font appears"
  },
  "accentStrategy": "How geometric accents (bars, dots, lines, circles) are used"
}

Give the palette 4-6 colours. Be specific — no generic "blue" or "red". Name them like a paint manufacturer: "Ink Night", "Kiln Brick", "Archive Cream".
The design system should feel like it belongs to a specific creative studio, not a template library.`;

  process.stderr.write(`  ${amber("⟐")} Generating design system "${name}"...\n`);

  const raw = await callClaudeWithRetry(prompt, {
    model: options.model || "sonnet",
    label: "design-system",
    raw: true,
  });

  let json = raw.trim();
  if (/^```/.test(json)) json = json.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
  const first = json.indexOf("{");
  const last = json.lastIndexOf("}");
  if (first >= 0 && last > first) json = json.slice(first, last + 1);

  const system = JSON.parse(json);
  const filePath = saveSystem(name, system);

  process.stderr.write(`  ${sage("✓")} Saved → ${teal(filePath)}\n`);
  showSystem(system, name);

  return system;
}

// ═══════════════════════════════════════════════════════
// PREVIEW — render sample slides using the design system
// ═══════════════════════════════════════════════════════

async function previewSystem(name, options = {}) {
  const system = loadSystem(name);
  const { generateHTML, parseMarkdown } = require("./raster.js");

  // Use provided slides or generate sample content
  const sampleMd = options.slides
    ? fs.readFileSync(options.slides, "utf-8")
    : `# Design System Preview

## ${system.aesthetic || name}

---

## Typography Sample

### SECTION LABEL

Body text in the primary typeface. This demonstrates the type scale relationship between headings, labels, and body copy on the 60-column grid.

> A blockquote showing the secondary voice — often in a contrasting typeface.

---

## Colour Palette

${(system.palette || []).map(c => `- ${c.name} (#${c.hex}) — ${c.role}`).join("\n")}

---

## Bullet Layout

- First point demonstrates the accent dot colours
- Second point shows the stagger cascade potential
- Third point establishes the visual rhythm
- Fourth point completes the pattern

---

<!-- layout: section -->

## Section Divider

### CHAPTER BREAK`;

  // Apply design system as directives
  const slides = parseMarkdown(sampleMd);
  const layouts = ["title", "split", "stagger", "bullets", "section"];
  const bgs = (system.palette || []).filter(c => c.role === "dominant" || c.role === "ground").map(c => c.hex);
  const accentBgs = (system.palette || []).filter(c => c.role === "accent" || c.role === "signal").map(c => c.hex);

  const composed = sampleMd.split(/\n---\n/).filter(s => s.trim()).map((slide, i) => {
    const layout = layouts[i % layouts.length];
    const bg = i === 0 ? (bgs[0] || null) : i === slides.length - 1 ? (accentBgs[0] || null) : null;
    const font = i === 2 && system.fontStrategy?.secondary ? system.fontStrategy.secondary : null;

    const parts = [`<!-- layout: ${layout} -->`];
    if (bg) parts.push(`<!-- bg: ${bg} -->`);
    if (font) parts.push(`<!-- font: ${font} -->`);
    parts.push(slide.trim());
    return parts.join("\n");
  }).join("\n\n---\n\n");

  const previewDir = path.join(LIBRARY_DIR, "previews");
  fs.mkdirSync(previewDir, { recursive: true });
  const mdPath = path.join(previewDir, `${name}-preview.md`);
  const htmlPath = path.join(previewDir, `${name}-preview.html`);

  fs.writeFileSync(mdPath, composed);
  await generateHTML(mdPath, htmlPath, { theme: options.theme || "light" });

  process.stderr.write(`  ${sage("✓")} Preview → ${teal(htmlPath)}\n`);

  // Open it
  const { execSync } = require("child_process");
  const cmd = process.platform === "darwin" ? "open" : "xdg-open";
  try { execSync(`${cmd} "${htmlPath}"`, { stdio: "ignore" }); } catch {}

  return htmlPath;
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help") {
    console.log(`
  design-system — save, browse, and apply design systems

  Usage:
    node design-system.js list                          List saved systems
    node design-system.js show <name>                   Show system details
    node design-system.js save <name> <file.json>       Save a system to the library
    node design-system.js generate <name> [options]     Ask Claude to create one
    node design-system.js preview <name> [options]      Render sample slides
    node design-system.js delete <name>                 Remove from library

  Generate options:
    --brief "<direction>"   Creative direction for Claude
    --model <model>         Claude model (default: sonnet)

  Preview options:
    --slides <file.md>      Use this file instead of sample content
    --theme <name>          Theme: light (default), dark, red, blue

  Compose with a saved system:
    node compose.js slides.md --design-system brutalist-archive
    npm start   (select design system in the wizard)

  Examples:
    node design-system.js generate "midnight-editorial" --brief "nocturnal magazine aesthetic"
    node design-system.js generate "bauhaus-primary" --brief "pure Bauhaus, primary colours only"
    node design-system.js list
    node design-system.js preview midnight-editorial
    node design-system.js show midnight-editorial
    `);
    process.exit(0);
  }

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  if (command === "list") {
    const systems = listSystems();
    if (systems.length === 0) {
      console.log(`\n  ${dim("No saved design systems. Generate one:")}`);
      console.log(`  ${teal('node design-system.js generate "my-style" --brief "..."')}\n`);
    } else {
      console.log(`\n  ${accent("■")} ${chalk.white.bold("Design Systems")} ${dim(`(${systems.length})`)}\n`);
      systems.forEach(s => {
        const swatches = s.palette.slice(0, 4).map(hex => chalk.bgHex(`#${hex}`)("  ")).join("");
        const fonts = s.fonts.length ? dim(s.fonts.join(" + ")) : "";
        console.log(`  ${teal(s.name.padEnd(25))} ${swatches} ${s.aesthetic.slice(0, 50)} ${fonts}`);
      });
      console.log("");
    }

  } else if (command === "show") {
    const name = args[1];
    if (!name) { console.error("Usage: show <name>"); process.exit(1); }
    try {
      const system = loadSystem(name);
      showSystem(system, name);
    } catch (e) { console.error(e.message); process.exit(1); }

  } else if (command === "save") {
    const name = args[1];
    const file = args[2];
    if (!name || !file) { console.error("Usage: save <name> <file.json>"); process.exit(1); }
    const system = JSON.parse(fs.readFileSync(file, "utf-8"));
    const filePath = saveSystem(name, system);
    console.log(`  ${sage("✓")} Saved ${teal(name)} → ${dim(filePath)}`);

  } else if (command === "generate") {
    const name = args[1];
    if (!name) { console.error("Usage: generate <name> [--brief ...]"); process.exit(1); }
    generateSystem(name, {
      brief: getFlag("--brief"),
      model: getFlag("--model"),
    }).catch(err => { console.error(`Error: ${err.message}`); process.exit(1); });

  } else if (command === "preview") {
    const name = args[1];
    if (!name) { console.error("Usage: preview <name>"); process.exit(1); }
    previewSystem(name, {
      slides: getFlag("--slides"),
      theme: getFlag("--theme"),
    }).catch(err => { console.error(`Error: ${err.message}`); process.exit(1); });

  } else if (command === "delete") {
    const name = args[1];
    if (!name) { console.error("Usage: delete <name>"); process.exit(1); }
    if (deleteSystem(name)) {
      console.log(`  ${sage("✓")} Deleted ${teal(name)}`);
    } else {
      console.error(`  ${accent("✗")} Not found: ${name}`);
    }

  } else {
    console.error(`Unknown command: ${command}. Use --help.`);
    process.exit(1);
  }
}

module.exports = { listSystems, loadSystem, saveSystem, deleteSystem, showSystem, generateSystem, previewSystem, LIBRARY_DIR };
