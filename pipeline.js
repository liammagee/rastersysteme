#!/usr/bin/env node
/**
 * pipeline — staged slide generation
 *
 * Source .md → per-slide .md files + composition.md + design-system.json → HTML/PPTX
 *
 * Four stages, each independently runnable:
 *   split   — break source into individual slide files
 *   design  — generate or load a design system
 *   compose — run Claude to assign layout/bg/font directives
 *   render  — produce HTML (with external CSS) and PPTX
 *
 * Usage:
 *   node pipeline.js source.md [options]
 *   node pipeline.js source.md --from compose --intensity moderate
 *   node pipeline.js source.md --from render --theme dark
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const chalk = require("chalk");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

const STAGES = ["split", "design", "compose", "render"];

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════

function hashContent(str) {
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}

function slugify(text, maxLen = 40) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
}

function extractTitle(slideText) {
  // Try headings first, skip empty headings like "##\n"
  const match = slideText.match(/^#{1,3}\s+(\S.+)/m);
  if (match) return match[1].trim();
  // Fall back to first non-empty line of body text
  const lines = slideText.split("\n").map(l => l.replace(/^[-*]\s+/, "").trim()).filter(Boolean);
  return lines[0] || "";
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ═══════════════════════════════════════════════════════
// STAGE 1: SPLIT — source.md → per-slide files
// ═══════════════════════════════════════════════════════

async function split(context) {
  const { source, buildDir } = context;
  const slideDir = path.join(buildDir, "slides");
  ensureDir(slideDir);

  const md = fs.readFileSync(source, "utf-8");
  const sourceHash = hashContent(md);

  // Check manifest for change detection
  const manifestPath = path.join(slideDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (manifest.sourceHash === sourceHash) {
      process.stderr.write(`  ${dim("split")} ${sage("✓")} source unchanged, ${manifest.slides.length} slides cached\n`);
      return {
        slideDir,
        slideFiles: manifest.slides.map(s => path.join(slideDir, s.file)),
        count: manifest.slides.length,
      };
    }
  }

  // Split on --- separator
  const rawSlides = md.split(/\n---\n/).filter(s => s.trim());

  // Clean old slide files
  const existing = fs.readdirSync(slideDir).filter(f => f.endsWith(".md"));
  existing.forEach(f => fs.unlinkSync(path.join(slideDir, f)));

  const slideFiles = [];
  const manifestSlides = [];

  rawSlides.forEach((slideText, i) => {
    const idx = String(i + 1).padStart(2, "0");
    const title = extractTitle(slideText);
    const slug = title ? slugify(title) : "slide";
    const fileName = `${idx}-${slug}.md`;
    const filePath = path.join(slideDir, fileName);

    fs.writeFileSync(filePath, slideText.trim() + "\n", "utf-8");
    slideFiles.push(filePath);
    manifestSlides.push({ index: i + 1, file: fileName, title: title || `(slide ${i + 1})` });
  });

  // Write manifest
  const manifest = { sourceHash, generated: new Date().toISOString(), slides: manifestSlides };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  process.stderr.write(`  ${dim("split")} ${sage("✓")} ${slideFiles.length} slides → ${teal(path.relative(process.cwd(), slideDir))}\n`);

  return { slideDir, slideFiles, count: slideFiles.length };
}

// ═══════════════════════════════════════════════════════
// STAGE 2: DESIGN — generate or load design-system.json
// ═══════════════════════════════════════════════════════

async function design(context) {
  const { buildDir, options } = context;
  const designPath = path.join(buildDir, "design-system.json");

  // Option 1: user specified a library design system
  if (options.designSystem) {
    const { loadSystem } = require("./design-system.js");
    const system = loadSystem(options.designSystem);
    fs.writeFileSync(designPath, JSON.stringify(system, null, 2), "utf-8");
    process.stderr.write(`  ${dim("design")} ${sage("✓")} loaded "${options.designSystem}" → ${teal(path.relative(process.cwd(), designPath))}\n`);
    return { designSystem: system, designSystemPath: designPath };
  }

  // Option 2: design-system.json already exists (human may have edited it)
  if (fs.existsSync(designPath)) {
    const system = JSON.parse(fs.readFileSync(designPath, "utf-8"));
    process.stderr.write(`  ${dim("design")} ${sage("✓")} using existing ${teal(path.relative(process.cwd(), designPath))}\n`);
    return { designSystem: system, designSystemPath: designPath };
  }

  // Option 3: generate a new design system via Claude
  const { generateSystem } = require("./design-system.js");
  const name = path.basename(context.source, ".md");
  const system = await generateSystem(name, {
    brief: options.brief,
    model: options.model,
  });
  fs.writeFileSync(designPath, JSON.stringify(system, null, 2), "utf-8");
  process.stderr.write(`  ${dim("design")} ${sage("✓")} generated → ${teal(path.relative(process.cwd(), designPath))}\n`);
  return { designSystem: system, designSystemPath: designPath };
}

// ═══════════════════════════════════════════════════════
// COMPOSITION.MD — parse and write the manifest format
// ═══════════════════════════════════════════════════════

function parseComposition(text) {
  const lines = text.split("\n");
  const meta = {};
  const slides = [];

  // Parse YAML-like frontmatter
  let inFront = false;
  let lineIdx = 0;
  if (lines[0] && lines[0].trim() === "---") {
    inFront = true;
    lineIdx = 1;
    while (lineIdx < lines.length) {
      const line = lines[lineIdx].trim();
      if (line === "---") { lineIdx++; break; }
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) meta[m[1]] = m[2];
      lineIdx++;
    }
  }

  // Parse slide sections (split on --- between sections)
  let currentSlide = null;
  for (; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const trimmed = line.trim();

    if (trimmed === "---") {
      if (currentSlide) slides.push(currentSlide);
      currentSlide = null;
      continue;
    }

    // ## Slide N: Title
    const headingMatch = trimmed.match(/^##\s+Slide\s+(\d+):\s*(.*)$/i);
    if (headingMatch) {
      if (currentSlide) slides.push(currentSlide);
      currentSlide = { slide: parseInt(headingMatch[1]), title: headingMatch[2] };
      continue;
    }

    // - key: value
    if (currentSlide) {
      const kvMatch = trimmed.match(/^-\s+(\w+):\s*(.+)$/);
      if (kvMatch) {
        let val = kvMatch[2].trim();
        // Strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        currentSlide[kvMatch[1]] = val;
      }
    }
  }
  if (currentSlide) slides.push(currentSlide);

  return { meta, slides };
}

function writeComposition(compositionPath, meta, slides) {
  const lines = [];

  // Frontmatter
  lines.push("---");
  for (const [k, v] of Object.entries(meta)) {
    lines.push(`${k}: ${v}`);
  }
  lines.push("---");
  lines.push("");

  // Slide sections
  slides.forEach((s, i) => {
    if (i > 0) lines.push("---");
    lines.push("");
    lines.push(`## Slide ${s.slide}: ${s.title || "(untitled)"}`);
    if (s.file) lines.push(`- file: ${s.file}`);
    if (s.layout) lines.push(`- layout: ${s.layout}`);
    if (s.bg) lines.push(`- bg: ${s.bg}`);
    if (s.font) lines.push(`- font: ${s.font}`);
    if (s.transition) lines.push(`- transition: ${s.transition}`);
    if (s.label) lines.push(`- label: ${s.label}`);
    if (s.notes) lines.push(`- notes: "${s.notes}"`);
    lines.push("");
  });

  fs.writeFileSync(compositionPath, lines.join("\n"), "utf-8");
}

// ═══════════════════════════════════════════════════════
// STAGE 3: COMPOSE — Claude directives → composition.md
// ═══════════════════════════════════════════════════════

async function compose(context) {
  const { source, buildDir, options } = context;
  const slideDir = path.join(buildDir, "slides");
  const compositionPath = path.join(buildDir, "composition.md");
  const baseName = path.basename(source, ".md");
  const composedPath = path.join(buildDir, `${baseName}.composed.md`);

  // Read manifest to get slide file list
  const manifestPath = path.join(slideDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No manifest found at ${manifestPath} — run the split stage first`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  // If composition.md exists and source hasn't changed, use it (human override path)
  if (fs.existsSync(compositionPath) && !options.recompose) {
    const comp = parseComposition(fs.readFileSync(compositionPath, "utf-8"));
    const sourceHash = hashContent(fs.readFileSync(source, "utf-8"));
    if (comp.meta.source_hash === sourceHash) {
      process.stderr.write(`  ${dim("compose")} ${sage("✓")} using existing composition.md (source unchanged)\n`);

      // Reassemble composed.md from composition directives + slide files
      const directives = comp.slides.map(s => ({
        slide: s.slide,
        layout: s.layout || null,
        bg: s.bg || null,
        font: s.font || null,
        label: s.label || null,
        notes: s.notes || null,
      }));

      const sourceMd = fs.readFileSync(source, "utf-8");
      const { assembleComposed } = require("./compose.js");
      const composed = assembleComposed(sourceMd, directives);
      fs.writeFileSync(composedPath, composed, "utf-8");

      return { compositionPath, composedPath };
    }
  }

  // Reassemble slides from files (respecting order from manifest)
  const slideTexts = manifest.slides.map(s => {
    const fp = path.join(slideDir, s.file);
    return fs.readFileSync(fp, "utf-8").trim();
  });
  const reassembled = slideTexts.join("\n\n---\n\n");

  // Write reassembled to a temp file for compose.js
  const tempPath = path.join(buildDir, `${baseName}.reassembled.md`);
  fs.writeFileSync(tempPath, reassembled, "utf-8");

  // Load design system if available
  const designPath = path.join(buildDir, "design-system.json");
  let designSystem = null;
  if (fs.existsSync(designPath)) {
    designSystem = JSON.parse(fs.readFileSync(designPath, "utf-8"));
  }

  // Call composeAsync from compose.js
  const { composeAsync, assembleComposed, parseDirectives, buildPrompt, callClaudeWithRetry } = require("./compose.js");

  process.stderr.write(`  ${dim("compose")} calling Claude for directives...\n`);

  const prompt = buildPrompt(reassembled, {
    intensity: options.intensity || "moderate",
    designSystem,
    brief: options.brief,
  });

  const raw = await callClaudeWithRetry(prompt, {
    model: options.model,
    label: options.intensity || "moderate",
    raw: true,
  });

  const directives = parseDirectives(raw);
  process.stderr.write(`  ${dim("compose")} ${sage("✓")} ${directives.length} directives received\n`);

  // Write composition.md
  const sourceHash = hashContent(fs.readFileSync(source, "utf-8"));
  const meta = {
    source: path.basename(source),
    source_hash: sourceHash,
    design_system: fs.existsSync(designPath) ? "design-system.json" : "none",
    theme: options.theme || "light",
    intensity: options.intensity || "moderate",
    generated: new Date().toISOString(),
  };

  const compSlides = manifest.slides.map((s, i) => {
    const d = directives.find(x => x.slide === i + 1) || directives[i] || {};
    return {
      slide: i + 1,
      title: s.title,
      file: `slides/${s.file}`,
      layout: d.layout || null,
      bg: d.bg || null,
      font: d.font || null,
      transition: d.transition || null,
      label: d.label || null,
      notes: d.notes || null,
    };
  });

  writeComposition(compositionPath, meta, compSlides);
  process.stderr.write(`  ${dim("compose")} → ${teal(path.relative(process.cwd(), compositionPath))}\n`);

  // Also write flat .composed.md (backward compat)
  const composed = assembleComposed(reassembled, directives);
  fs.writeFileSync(composedPath, composed, "utf-8");
  process.stderr.write(`  ${dim("compose")} → ${teal(path.relative(process.cwd(), composedPath))}\n`);

  // Clean up temp file
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  return { compositionPath, composedPath };
}

// ═══════════════════════════════════════════════════════
// STAGE 4: RENDER — composed.md → HTML + PPTX
// ═══════════════════════════════════════════════════════

async function render(context) {
  const { source, buildDir, options } = context;
  const baseName = path.basename(source, ".md");
  const composedPath = path.join(buildDir, `${baseName}.composed.md`);

  if (!fs.existsSync(composedPath)) {
    throw new Error(`No composed file at ${composedPath} — run the compose stage first`);
  }

  const { generateHTML, generate, generateExternalCSS } = require("./raster.js");
  const useExternalCSS = options.externalCSS !== false; // default true in pipeline mode

  const htmlPath = path.join(buildDir, `${baseName}.html`);
  const pptxPath = path.join(buildDir, `${baseName}.pptx`);
  const cssFileName = "rastersysteme.css";

  // Render HTML
  const htmlResult = await generateHTML(composedPath, htmlPath, {
    theme: options.theme,
    ratio: options.ratio,
    font: options.font,
    transition: options.transition,
    externalCSS: useExternalCSS,
    cssFileName,
  });

  // Ensure CSS file exists alongside HTML
  if (useExternalCSS) {
    const cssPath = path.join(buildDir, cssFileName);
    generateExternalCSS(cssPath);
    process.stderr.write(`  ${dim("render")} ${sage("✓")} CSS → ${teal(path.relative(process.cwd(), cssPath))}\n`);
  }

  process.stderr.write(`  ${dim("render")} ${sage("✓")} HTML → ${teal(path.relative(process.cwd(), htmlPath))} (${htmlResult.slides} slides)\n`);

  // Render PPTX
  const pptxResult = await generate(composedPath, pptxPath, {
    theme: options.theme,
    ratio: options.ratio,
    font: options.font,
    transition: options.transition,
  });

  process.stderr.write(`  ${dim("render")} ${sage("✓")} PPTX → ${teal(path.relative(process.cwd(), pptxPath))}\n`);

  return {
    htmlPath,
    pptxPath,
    cssPath: useExternalCSS ? path.join(buildDir, cssFileName) : null,
    slideCount: htmlResult.slides,
  };
}

// ═══════════════════════════════════════════════════════
// ORCHESTRATOR — run stages sequentially
// ═══════════════════════════════════════════════════════

async function runPipeline(sourcePath, options = {}) {
  const source = path.resolve(sourcePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Source not found: ${source}`);
  }

  const baseName = path.basename(source, ".md");
  const sourceDir = path.dirname(source);

  // Build directory: sibling .build/ folder or flat (legacy)
  const buildDir = options.flat
    ? sourceDir
    : path.join(sourceDir, `${baseName}.build`);

  ensureDir(buildDir);

  const fromIdx = options.from ? STAGES.indexOf(options.from) : 0;
  const toIdx = options.to ? STAGES.indexOf(options.to) : STAGES.length - 1;

  if (fromIdx < 0) throw new Error(`Unknown stage: ${options.from}`);
  if (toIdx < 0) throw new Error(`Unknown stage: ${options.to}`);

  const context = { source, buildDir, options };

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("pipeline")} ${dim(path.relative(process.cwd(), source))}\n`);
  process.stderr.write(`  ${dim("build →")} ${teal(path.relative(process.cwd(), buildDir))}\n`);
  process.stderr.write(`  ${dim("stages:")} ${STAGES.slice(fromIdx, toIdx + 1).join(" → ")}\n\n`);

  const results = {};

  for (let i = fromIdx; i <= toIdx; i++) {
    const stage = STAGES[i];
    switch (stage) {
      case "split":
        results.split = await split(context);
        break;
      case "design":
        results.design = await design(context);
        break;
      case "compose":
        results.compose = await compose(context);
        break;
      case "render":
        results.render = await render(context);
        break;
    }
  }

  process.stderr.write(`\n  ${sage("✓")} pipeline complete\n\n`);
  return results;
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  ${chalk.white.bold("pipeline")} — staged slide generation

  ${dim("Usage:")}
    node pipeline.js <source.md> [options]

  ${dim("Stages (run in order):")}
    split     break source into individual slide files
    design    generate or load a design system
    compose   run Claude to assign layout/bg/font directives
    render    produce HTML (with external CSS) and PPTX

  ${dim("Options:")}
    --from <stage>        start from: split, design, compose, render
    --to <stage>          stop after: split, design, compose, render
    --flat                flat output (no .build/ directory)
    --inline-css          inline CSS instead of external (default: external)
    --theme <name>        theme: light, dark, red, blue
    --intensity <name>    composition: minimal, moderate, maximal
    --model <name>        Claude model: sonnet, haiku, opus
    --design-system <n>   use a saved design system by name
    --brief "<text>"      creative direction for design system
    --recompose           force re-composition even if source unchanged

  ${dim("Examples:")}
    node pipeline.js content/week-2/history.md
    node pipeline.js content/week-2/history.md --from compose --intensity moderate
    node pipeline.js content/week-2/history.md --from render --theme dark
    node pipeline.js content/week-2/history.md --to split
`);
    process.exit(0);
  }

  const input = args.find(a => !a.startsWith("--"));
  const flag = (name) => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const hasFlag = (name) => args.includes(`--${name}`);

  runPipeline(input, {
    from: flag("from"),
    to: flag("to"),
    flat: hasFlag("flat"),
    externalCSS: !hasFlag("inline-css"),
    theme: flag("theme"),
    intensity: flag("intensity"),
    model: flag("model"),
    designSystem: flag("design-system"),
    brief: flag("brief"),
    recompose: hasFlag("recompose"),
  }).catch(err => {
    console.error(`  ${accent("✗")} ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runPipeline, split, design, compose, render, parseComposition, writeComposition, STAGES };
