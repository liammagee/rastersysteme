#!/usr/bin/env node
/**
 * masters — define and apply reusable slide masters (templates)
 *
 * A master defines the visual treatment for a specific slide role:
 * title page, section divider, content, data, closing, etc.
 *
 * Masters are matched to slides by content structure (auto) or by
 * explicit <!-- master: name --> directives.
 *
 * Usage:
 *   node masters.js list
 *   node masters.js show <set-name>
 *   node masters.js apply <set-name> <input.md> [--output composed.md]
 *   node masters.js generate <set-name> [--brief "direction"] [--model sonnet]
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

const MASTERS_DIR = path.join(__dirname, "master-sets");

// ═══════════════════════════════════════════════════════
// MASTER SLIDE SCHEMA
// ═══════════════════════════════════════════════════════

/*
A master set contains named templates for different slide roles.
Each master specifies: layout, bg pattern, font, label strategy, transition.

Example master set:
{
  "name": "corporate-clean",
  "description": "Clean corporate presentation style",
  "masters": {
    "title": { "layout": "title", "bg": "0F2A4A", "font": "DM Serif Display", "transition": "zoom" },
    "section": { "layout": "section", "bg": "1A1A1A", "font": null, "transition": "fade", "labelFrom": "title" },
    "content": { "layout": "split", "bg": null, "font": null, "transition": "slide-left" },
    "data": { "layout": "stagger", "bg": null, "font": "Space Mono", "transition": "fade" },
    "list": { "layout": "bullets", "bg": null, "font": null },
    "quote": { "layout": "rotated", "bg": "1B3D22", "font": "Georgia" },
    "closing": { "layout": "section", "bg": "0F2A4A", "font": "DM Serif Display", "transition": "zoom" }
  },
  "matchRules": {
    "title": "index === 0",
    "closing": "index === total - 1",
    "section": "titleOnly && !subtitle",
    "quote": "hasBlockquote",
    "data": "bulletCount >= 5",
    "list": "bulletCount >= 1",
    "content": "default"
  }
}
*/

// ═══════════════════════════════════════════════════════
// LIBRARY
// ═══════════════════════════════════════════════════════

function ensureDir() {
  if (!fs.existsSync(MASTERS_DIR)) fs.mkdirSync(MASTERS_DIR, { recursive: true });
}

function listMasterSets() {
  ensureDir();
  return fs.readdirSync(MASTERS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(MASTERS_DIR, f), "utf-8"));
      return { name: f.replace(".json", ""), description: data.description || "", masterCount: Object.keys(data.masters || {}).length };
    });
}

function loadMasterSet(name) {
  const filePath = path.join(MASTERS_DIR, `${name}.json`);
  if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (fs.existsSync(name)) return JSON.parse(fs.readFileSync(name, "utf-8"));
  throw new Error(`Master set not found: ${name}`);
}

function saveMasterSet(name, set) {
  ensureDir();
  const filePath = path.join(MASTERS_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(set, null, 2));
  return filePath;
}

// ═══════════════════════════════════════════════════════
// MATCHER — assign a master to each slide by content structure
// ═══════════════════════════════════════════════════════

function matchMaster(slide, index, total, masterSet) {
  const masters = masterSet.masters || {};

  // Explicit directive: <!-- master: name -->
  if (slide.raw && slide.raw.match) {
    const explicit = slide.raw.match(/<!--\s*master:\s*(\w[\w-]*)\s*-->/);
    if (explicit && masters[explicit[1]]) return explicit[1];
  }

  // Auto-match by content structure
  const titleOnly = (slide.title || slide.subtitle) && slide.bullets.length === 0 && slide.body.length <= 1;
  const hasBlockquote = !!slide.blockquote;
  const bulletCount = slide.bullets.length;
  const hasImages = slide.images && slide.images.length > 0;
  const hasTables = slide.tables && slide.tables.length > 0;
  const hasCode = slide.codeBlocks && slide.codeBlocks.length > 0;

  if (index === 0 && masters.title) return "title";
  if (index === total - 1 && masters.closing) return "closing";
  if (titleOnly && !slide.subtitle && masters.section) return "section";
  if (hasBlockquote && masters.quote) return "quote";
  if (hasImages && masters.image) return "image";
  if (hasTables && masters.data) return "data";
  if (hasCode && masters.code) return "code";
  if (bulletCount >= 5 && masters.data) return "data";
  if (bulletCount >= 1 && masters.list) return "list";
  if (masters.content) return "content";

  return Object.keys(masters)[0] || "content";
}

// ═══════════════════════════════════════════════════════
// APPLY — inject master directives into source markdown
// ═══════════════════════════════════════════════════════

function applyMasters(sourceMd, masterSet) {
  const { parseMarkdown } = require("./raster.js");
  const slides = parseMarkdown(sourceMd);
  const sourceSlides = sourceMd.split(/\n---\n/).filter(s => s.trim());
  const masters = masterSet.masters || {};

  const assembled = sourceSlides.map((raw, i) => {
    const slide = slides[i];
    if (!slide) return raw;

    const masterName = matchMaster(slide, i, slides.length, masterSet);
    const master = masters[masterName] || {};

    const parts = [];
    if (master.layout) parts.push(`<!-- layout: ${master.layout} -->`);
    if (master.bg) parts.push(`<!-- bg: ${master.bg} -->`);
    if (master.font) parts.push(`<!-- font: ${master.font} -->`);
    if (master.transition) parts.push(`<!-- transition: ${master.transition} -->`);

    // Auto-label from title if specified
    if (master.labelFrom === "title" && slide.title) {
      parts.push(`### ${slide.title.toUpperCase().slice(0, 30)}`);
    } else if (master.label) {
      parts.push(`### ${master.label}`);
    }

    parts.push(raw.trim());
    return parts.join("\n");
  });

  return assembled.join("\n\n---\n\n");
}

// ═══════════════════════════════════════════════════════
// GENERATE — ask Claude to create a master set
// ═══════════════════════════════════════════════════════

async function generateMasterSet(name, options = {}) {
  const { callClaudeWithRetry } = require("./compose.js");

  const brief = options.brief || "Create a distinctive master slide set for professional presentations.";

  const prompt = `You are a Swiss-trained art director. Create a master slide template set
for presentations on a 60-column grid.

CREATIVE DIRECTION: ${brief}

Define templates for these slide roles:
- title: opening slide (first slide)
- section: chapter divider (title only, dramatic)
- content: standard text slide (title + body)
- list: bullet point slide (1-4 items)
- data: data-heavy slide (5+ bullets, tables, charts)
- quote: blockquote/callout slide
- closing: final slide

For each, specify:
- layout: one of title, section, split, bullets, stagger, rotated, fragment, overlap, arc
- bg: 6-char hex color or null (theme default)
- font: typeface name or null (default Helvetica Neue)
- transition: fade, slide-left, slide-up, zoom, cut
- label: fixed ### label text, or null
- labelFrom: "title" to auto-generate label from slide title, or null

Output ONLY valid JSON:
{
  "name": "${name}",
  "description": "One-sentence description",
  "masters": {
    "title": { "layout": "title", "bg": "0F2A4A", "font": "DM Serif Display", "transition": "zoom", "label": null, "labelFrom": null },
    "section": { ... },
    "content": { ... },
    "list": { ... },
    "data": { ... },
    "quote": { ... },
    "closing": { ... }
  }
}

Be opinionated — each master should have a distinct visual character.
Not every master needs a bg override. Vary transitions. Use fonts strategically.`;

  process.stderr.write(`  ${amber("⟐")} Generating master set "${name}"...\n`);

  const raw = await callClaudeWithRetry(prompt, {
    model: options.model || "sonnet",
    label: "masters",
    raw: true,
  });

  let json = raw.trim();
  if (/^```/.test(json)) json = json.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
  const first = json.indexOf("{");
  const last = json.lastIndexOf("}");
  if (first >= 0 && last > first) json = json.slice(first, last + 1);

  const set = JSON.parse(json);
  const filePath = saveMasterSet(name, set);
  process.stderr.write(`  ${sage("✓")} Saved → ${teal(filePath)}\n`);

  return set;
}

// ═══════════════════════════════════════════════════════
// DISPLAY
// ═══════════════════════════════════════════════════════

function showMasterSet(set) {
  console.log(`\n  ${accent("■")} ${chalk.white.bold(set.name || "Master Set")}`);
  console.log(`  ${dim(set.description || "")}\n`);

  const masters = set.masters || {};
  for (const [role, m] of Object.entries(masters)) {
    const bg = m.bg ? chalk.bgHex(`#${m.bg}`)("  ") + ` #${m.bg}` : dim("theme default");
    const font = m.font ? teal(m.font) : dim("default");
    const trans = m.transition ? amber(m.transition) : dim("fade");
    console.log(`  ${chalk.white.bold(role.padEnd(10))} layout:${teal(m.layout || "auto").padEnd(10)} bg:${bg.padEnd(20)} font:${font.padEnd(18)} transition:${trans}`);
  }
  console.log("");
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help") {
    console.log(`
  masters — define and apply reusable slide master templates

  Usage:
    node masters.js list                              List saved master sets
    node masters.js show <set-name>                   Show set details
    node masters.js generate <set-name> [options]     Ask Claude to create one
    node masters.js apply <set-name> <input.md>       Apply masters to a deck

  Options:
    --brief "<direction>"   Creative direction for generate
    --model <model>         Claude model (default: sonnet)
    --output <path>         Output path for apply (default: input.masters.md)

  How masters work:
    Each slide is matched to a master by content structure:
    - First slide → title master
    - Last slide → closing master
    - Title only → section master
    - Has blockquote → quote master
    - 5+ bullets → data master
    - 1-4 bullets → list master
    - Everything else → content master

    Override with: <!-- master: name --> in the markdown.

  Examples:
    node masters.js generate "editorial" --brief "magazine style, serif-heavy"
    node masters.js apply editorial decks/week-1.md
    node masters.js apply editorial decks/week-1.md --output decks/week-1.composed.md
    `);
    process.exit(0);
  }

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  if (command === "list") {
    const sets = listMasterSets();
    if (sets.length === 0) {
      console.log(`\n  ${dim("No master sets. Generate one:")}`);
      console.log(`  ${teal('node masters.js generate "my-style" --brief "..."')}\n`);
    } else {
      console.log(`\n  ${accent("■")} ${chalk.white.bold("Master Sets")} ${dim(`(${sets.length})`)}\n`);
      sets.forEach(s => {
        console.log(`  ${teal(s.name.padEnd(25))} ${s.masterCount} masters  ${dim(s.description.slice(0, 50))}`);
      });
      console.log("");
    }

  } else if (command === "show") {
    const name = args[1];
    if (!name) { console.error("Usage: show <name>"); process.exit(1); }
    const set = loadMasterSet(name);
    showMasterSet(set);

  } else if (command === "generate") {
    const name = args[1];
    if (!name) { console.error("Usage: generate <name>"); process.exit(1); }
    generateMasterSet(name, {
      brief: getFlag("--brief"),
      model: getFlag("--model"),
    }).then(set => showMasterSet(set))
      .catch(err => { console.error(`Error: ${err.message}`); process.exit(1); });

  } else if (command === "apply") {
    const name = args[1];
    const input = args[2];
    if (!name || !input) { console.error("Usage: apply <set-name> <input.md>"); process.exit(1); }
    if (!fs.existsSync(input)) { console.error(`File not found: ${input}`); process.exit(1); }

    const set = loadMasterSet(name);
    const md = fs.readFileSync(input, "utf-8");
    const composed = applyMasters(md, set);

    const output = getFlag("--output") || input.replace(/\.md$/, ".masters.md");
    fs.writeFileSync(output, composed);

    // Count which masters were used
    const { parseMarkdown } = require("./raster.js");
    const slides = parseMarkdown(md);
    const usage = {};
    slides.forEach((slide, i) => {
      const master = matchMaster(slide, i, slides.length, set);
      usage[master] = (usage[master] || 0) + 1;
    });

    process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("apply masters")}\n`);
    process.stderr.write(`  ${dim("Set:")} ${teal(set.name || name)}\n`);
    process.stderr.write(`  ${dim("Input:")} ${teal(path.basename(input))} ${dim(`(${slides.length} slides)`)}\n`);
    Object.entries(usage).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => {
      process.stderr.write(`    ${dim(m.padEnd(12))} ${c} slides\n`);
    });
    process.stderr.write(`  ${sage("✓")} → ${teal(output)}\n`);

  } else {
    console.error(`Unknown command: ${command}. Use --help.`);
    process.exit(1);
  }
}

module.exports = { listMasterSets, loadMasterSet, saveMasterSet, matchMaster, applyMasters, generateMasterSet, showMasterSet, MASTERS_DIR };
