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

const STAGES = ["split", "design", "compose", "render", "gslides"];

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

function findImagesDir(inputPath) {
  const inputDir = path.dirname(path.resolve(inputPath));
  const inputBase = path.basename(inputPath, ".md").replace(".composed", "").replace(".masters", "").replace(".paced", "");
  const candidates = [];
  candidates.push(path.join(inputDir, `${inputBase}-images`));
  const stripped = inputBase.replace(/[a-z]$/, "");
  if (stripped !== inputBase) candidates.push(path.join(inputDir, `${stripped}-images`));
  const noSuffix = inputBase.replace(/[-_](v\d+|fresh|radical|paced|composed|default|merged).*$/, "");
  if (noSuffix !== inputBase) candidates.push(path.join(inputDir, `${noSuffix}-images`));
  const parentDir = path.dirname(inputDir);
  candidates.push(path.join(parentDir, `${inputBase}-images`));
  if (stripped !== inputBase) candidates.push(path.join(parentDir, `${stripped}-images`));
  if (noSuffix !== inputBase) candidates.push(path.join(parentDir, `${noSuffix}-images`));
  try {
    fs.readdirSync(inputDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.endsWith("-images"))
      .forEach(e => candidates.push(path.join(inputDir, e.name)));
  } catch {}
  // Also check parent's sibling dirs (e.g. content/week-2/ → decks/week-1-images/)
  try {
    fs.readdirSync(parentDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.endsWith("-images"))
      .forEach(e => candidates.push(path.join(parentDir, e.name)));
  } catch {}
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      const pngs = fs.readdirSync(dir).filter(f => /^slide-\d+\.png$/.test(f));
      if (pngs.length > 0) return { dir, count: pngs.length };
    }
  }
  return null;
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
// STAGE 3: COMPOSE — full incremental compose via compose.js
// Uses the same 5-stage pipeline (design system → per-slide
// design directives → assembly → render → images) that the
// CLI wizard uses, producing rich <!-- design: {...} --> JSON
// directives and image splicing.
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
      return { compositionPath, composedPath };
    }
  }

  // Reassemble slides from per-slide files
  const slideTexts = manifest.slides.map(s => {
    const fp = path.join(slideDir, s.file);
    return fs.readFileSync(fp, "utf-8").trim();
  });
  const reassembled = slideTexts.join("\n\n---\n\n");

  // Write reassembled source for compose.js to read
  const tempPath = path.join(buildDir, `${baseName}.reassembled.md`);
  fs.writeFileSync(tempPath, reassembled, "utf-8");

  // Detect images — check sibling *-images/ directories
  let imagesDir = null;
  const foundImages = findImagesDir(source);
  if (foundImages) {
    imagesDir = foundImages.dir;
    process.stderr.write(`  ${dim("compose")} found ${foundImages.count} images in ${teal(path.basename(imagesDir))}\n`);
  }

  // Use the full composeIncremental pipeline from compose.js
  // This gives us: design system → per-slide <!-- design: {...} --> JSON
  // directives → assembly → render → image splicing
  const { composeIncremental } = require("./compose.js");

  // Output path determines format — use HTML for the incremental pipeline
  // (it does its own rendering internally as Stage 4)
  const htmlPath = path.join(buildDir, `${baseName}.html`);

  const result = await composeIncremental(tempPath, htmlPath, {
    intensity: options.intensity || "moderate",
    model: options.model || "sonnet",
    theme: options.theme || "light",
    brief: options.brief,
    batchSize: options.batchSize || 5,
    parallel: options.parallel || 1,
    designSystem: options.designSystem,
    slides: options.slides,
    // Image options
    withImages: !!imagesDir || options.withImages,
    imagesDir: imagesDir || options.imagesDir,
    imageStyle: options.imageStyle,
    imageScale: options.imageScale || "subtle",
    dryRun: false,
  });

  // The incremental pipeline writes its own .composed.md — copy to our build dir
  const incrementalComposed = htmlPath.replace(/\.html$/, ".composed.md");
  if (fs.existsSync(incrementalComposed) && incrementalComposed !== composedPath) {
    fs.copyFileSync(incrementalComposed, composedPath);
  }

  // Write composition.md manifest from the composed output
  const sourceHash = hashContent(fs.readFileSync(source, "utf-8"));
  const { parseMarkdown } = require("./raster.js");
  const composedContent = fs.readFileSync(composedPath, "utf-8");
  const composedSlides = parseMarkdown(composedContent);

  const meta = {
    source: path.basename(source),
    source_hash: sourceHash,
    design_system: result.designSystem ? "design-system.json" : "none",
    theme: options.theme || "light",
    intensity: options.intensity || "moderate",
    generated: new Date().toISOString(),
  };

  const compSlides = manifest.slides.map((s, i) => {
    const cs = composedSlides[i] || {};
    return {
      slide: i + 1,
      title: s.title,
      file: `slides/${s.file}`,
      layout: cs.layoutOverride || null,
      bg: cs.bgOverride || null,
      font: cs.fontOverride || null,
      notes: null,
    };
  });

  writeComposition(compositionPath, meta, compSlides);
  process.stderr.write(`  ${dim("compose")} → ${teal(path.relative(process.cwd(), compositionPath))}\n`);

  // Save the design system to the build dir if generated
  if (result.designSystem) {
    const designPath = path.join(buildDir, "design-system.json");
    fs.writeFileSync(designPath, JSON.stringify(result.designSystem, null, 2), "utf-8");
  }

  // Clean up temp file
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  return { compositionPath, composedPath, htmlPath };
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

  // composeIncremental already renders HTML (Stage 4) — re-render here
  // only if explicitly running render stage or if HTML doesn't exist yet
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
// STAGE 5: GSLIDES — composed.md → Google Slides (optional)
// ═══════════════════════════════════════════════════════

async function gslides(context) {
  const { source, buildDir, options } = context;

  if (!options.gslides) {
    process.stderr.write(`  ${dim("gslides")} ${dim("skipped (pass --gslides to enable)")}\n`);
    return null;
  }

  const baseName = path.basename(source, ".md");
  const composedPath = path.join(buildDir, `${baseName}.composed.md`);

  if (!fs.existsSync(composedPath)) {
    throw new Error(`No composed file at ${composedPath} — run the compose stage first`);
  }

  const { exportToGoogleSlides } = require("./export-gslides.js");

  const result = await exportToGoogleSlides(composedPath, {
    theme: options.theme,
    font: options.font,
    title: options.gslidesTitle || baseName.replace(/[-_]/g, " "),
    credentials: options.gslidesCredentials,
    token: options.gslidesToken,
    open: options.gslidesOpen,
  });

  process.stderr.write(`  ${dim("gslides")} ${sage("✓")} → ${teal(result.url)} (${result.slideCount} slides)\n`);

  return {
    presentationId: result.presentationId,
    url: result.url,
    slideCount: result.slideCount,
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
  // Default: stop at render unless --gslides is passed or --to gslides is explicit
  const defaultTo = options.gslides ? STAGES.length - 1 : STAGES.indexOf("render");
  const toIdx = options.to ? STAGES.indexOf(options.to) : defaultTo;

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
      case "gslides":
        results.gslides = await gslides(context);
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
    gslides   export to Google Slides (requires --gslides flag)

  ${dim("Options:")}
    --from <stage>        start from: split, design, compose, render, gslides
    --to <stage>          stop after: split, design, compose, render, gslides
    --gslides             enable Google Slides export stage
    --gslides-credentials <path>  OAuth credentials JSON
    --gslides-title <name>        presentation title
    --gslides-open        open in browser after export
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
    gslides: hasFlag("gslides"),
    gslidesCredentials: flag("gslides-credentials"),
    gslidesTitle: flag("gslides-title"),
    gslidesOpen: hasFlag("gslides-open"),
    gslidesToken: flag("gslides-token"),
    withImages: !hasFlag("no-images"),
    imagesDir: flag("images-dir"),
    imageStyle: flag("image-style"),
    imageScale: flag("image-scale"),
    batchSize: parseInt(flag("batch-size") || "5"),
    parallel: parseInt(flag("parallel") || "1"),
  }).catch(err => {
    console.error(`  ${accent("✗")} ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runPipeline, split, design, compose, render, gslides, parseComposition, writeComposition, STAGES };
