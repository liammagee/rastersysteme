#!/usr/bin/env node
/**
 * rastersysteme — interactive Swiss 60-column grid slide system
 *
 * One tool that does everything:
 *   compose → render → review → compare → present
 */

const readline = require("readline");
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const SCRIPT_DIR = __dirname;
const dim = chalk.gray;
const accent = chalk.hex("#C44230");
const teal = chalk.hex("#2C7A92");
const sage = chalk.hex("#548C5A");
const amber = chalk.hex("#C79B38");
const bright = chalk.bold;
const highlight = chalk.inverse;
const rule = dim("─".repeat(52));

// ═══════════════════════════════════════════════════════
// INTERACTIVE PRIMITIVES — arrow keys, first-letter, raw mode
// ═══════════════════════════════════════════════════════

readline.emitKeypressEvents(process.stdin);

function select(label, items, opts = {}) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(items[opts.defaultIndex || 0]);
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();

    let cursor = opts.defaultIndex || 0;
    const n = items.length;
    const cols = process.stdout.columns || 80;

    // Strip ANSI codes to measure visible width
    function visibleLen(s) { return s.replace(/\x1b\[[0-9;]*m/g, "").length; }

    // Truncate a styled string to fit within maxCols visible characters
    function truncate(s, maxCols) {
      let vis = 0, i = 0;
      while (i < s.length && vis < maxCols) {
        if (s[i] === "\x1b") {
          const end = s.indexOf("m", i);
          if (end >= 0) { i = end + 1; continue; }
        }
        vis++; i++;
      }
      return s.slice(0, i);
    }

    function buildLine(i) {
      const sel = i === cursor;
      const marker = sel ? accent("▸") : " ";
      const key = items[i].key ? (sel ? accent(items[i].key) : dim(items[i].key)) : "";
      const text = sel ? highlight(` ${items[i].label} `) : dim(items[i].label);
      const sep = key ? dim(".") : " ";
      const line = `    ${marker} ${key}${sep}${text}`;
      // Truncate to terminal width to prevent wrapping (reserve 1 col for safety)
      return truncate(line, cols - 1) + "\x1b[K";
    }

    function render(initial) {
      const lines = [];
      for (let i = 0; i < n; i++) lines.push(buildLine(i));
      const menu = lines.join("\n") + "\n";

      if (initial) {
        process.stdout.write(menu);
      } else {
        process.stdout.write(`\x1b[${n}A` + menu);
      }
    }

    process.stdout.write(`\n  ${dim(label)}\n`);
    render(true);

    const onKey = (str, key) => {
      if (!key) return;
      if (key.name === "up") { cursor = (cursor - 1 + n) % n; render(); }
      else if (key.name === "down") { cursor = (cursor + 1) % n; render(); }
      else if (key.name === "return") { finish(); }
      else if (key.ctrl && key.name === "c") { cleanup(); process.exit(0); }
      else if (str) {
        const c = str.toLowerCase();
        let m = items.findIndex((i) => i.key === c);
        if (m < 0) m = items.findIndex((i) => i.label[0].toLowerCase() === c);
        const num = parseInt(str, 10);
        if (m < 0 && num > 0 && num <= n) m = num - 1;
        if (m >= 0) {
          cursor = m;
          render();
          if (opts.autoSelect) finish();
        }
      }
    };

    function cleanup() {
      process.stdin.removeListener("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    function finish() {
      cleanup();
      // Collapse menu to just the selected item — single atomic write
      const clearLines = Array(n - 1).fill("\x1b[K").join("\n");
      process.stdout.write(
        `\x1b[${n}A` +
        `    ${sage("✓")} ${bright(items[cursor].label)}\x1b[K\n` +
        clearLines +
        (n > 2 ? `\x1b[${n - 2}A` : "")
      );
      resolve(items[cursor]);
    }

    process.stdin.on("keypress", onKey);
  });
}

function askText(prompt, defaultVal) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const hint = defaultVal ? dim(` [${defaultVal}]`) : "";
    rl.question(`  ${prompt}${hint}${dim(":")} `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultVal || "");
    });
  });
}

// ═══════════════════════════════════════════════════════
// FILE DISCOVERY
// ═══════════════════════════════════════════════════════

function findMarkdownFiles(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md")
        && !e.name.includes(".composed.")
        && !e.name.startsWith("TODO")
        && !e.name.startsWith("README")
        && !e.name.includes("-README"))
      .map((e) => path.join(dir, e.name))
      .sort();
  } catch { return []; }
}

async function selectInput() {
  const cwd = process.cwd();
  const decksDir = path.join(cwd, "decks");
  const mdFiles = [
    ...findMarkdownFiles(cwd),
    ...(fs.existsSync(decksDir) ? findMarkdownFiles(decksDir) : []),
  ];

  if (mdFiles.length === 0) {
    return askText("Input file (.md)");
  }

  const items = mdFiles.map((f) => {
    const rel = path.relative(cwd, f);
    return { label: rel, value: f };
  });

  const choice = await select("SELECT FILE", items);
  return choice.value;
}

// ═══════════════════════════════════════════════════════
// PIPELINE RUNNERS
// ═══════════════════════════════════════════════════════

function run(script, args) {
  const result = spawnSync("node", [path.join(SCRIPT_DIR, script), ...args], {
    stdio: "inherit",
    timeout: 600000,
    cwd: SCRIPT_DIR,
  });
  return result.status === 0;
}

function openFile(filePath) {
  if (filePath.endsWith(".html")) {
    // Serve via localhost to avoid file:// security restrictions
    const dir = path.dirname(filePath);
    const file = path.basename(filePath);
    const port = 8700 + Math.floor(Math.random() * 100);
    const { spawn: spawnBg } = require("child_process");
    const server = spawnBg("python3", ["-m", "http.server", String(port)], {
      cwd: dir, stdio: "ignore", detached: true,
    });
    server.unref();
    const url = `http://localhost:${port}/${file}`;
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    setTimeout(() => {
      try {
        execSync(`${cmd} "${url}"`, { stdio: "ignore" });
        console.log(`  ${sage("✓")} ${teal(url)}`);
      } catch {
        console.log(`  ${accent("✗")} Could not open browser`);
      }
    }, 300);
  } else {
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    try {
      execSync(`${cmd} "${filePath}"`, { stdio: "ignore" });
      console.log(`  ${sage("✓")} Opened ${teal(path.basename(filePath))}`);
    } catch {
      console.log(`  ${accent("✗")} Could not open ${filePath}`);
    }
  }
}

function generateQuickBrief(sourcePath) {
  console.log(`\n  ${amber("⟐")} ${dim("Asking Claude to analyze the content...")}`);
  try {
    const { callClaude } = require("./compose.js");
    const md = fs.readFileSync(sourcePath, "utf-8");
    const prompt = `You are a design director analyzing content for a Swiss grid slide presentation.
Write a 2-3 sentence creative brief for THIS specific content — not generic advice.
Consider tone, structure, emotional arc, and which Swiss/New Wave techniques would serve it.
Output ONLY the brief, no labels or formatting.

--- SOURCE ---
${md.slice(0, 4000)}
--- END ---`;
    return callClaude(prompt, { model: "sonnet", raw: true }).trim();
  } catch {
    return "";
  }
}

async function getBrief(sourcePath) {
  const briefMode = await select("CREATIVE BRIEF", [
    { key: "s", label: "skip             no custom brief (default)" },
    { key: "a", label: "ask Claude       generate a brief from the content" },
    { key: "w", label: "write my own     enter a brief manually" },
  ], { autoSelect: true });

  if (briefMode.key === "s") return "";

  if (briefMode.key === "w") {
    return askText("Brief", "");
  }

  // Ask Claude, then let user review/edit
  const generated = generateQuickBrief(sourcePath);
  if (generated) {
    console.log(`\n  ${dim("Claude suggests:")}`);
    console.log(`  ${chalk.italic(generated)}\n`);
    return askText("Edit brief or Enter to accept", generated);
  }
  return askText("Brief (Claude unavailable, enter manually)", "");
}

// ═══════════════════════════════════════════════════════
// INTERACTIVE FLOW
// ═══════════════════════════════════════════════════════

function timer() {
  const start = Date.now();
  return () => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return `${elapsed}s`;
  };
}

async function interactive(preselectedInput) {
  const pipelineTimer = timer();
  console.log("");
  console.log(`  ${accent("■")} ${bright("rastersysteme")}`);
  console.log(`  ${rule}`);
  console.log("");

  // 1. Select input
  const input = preselectedInput || (await selectInput());
  const inputBase = path.basename(input, ".md");

  // 2. Mode
  const mode = await select("MODE", [
    { key: "c", label: "compose         Claude → slides" },
    { key: "r", label: "render          markdown → PPTX/HTML" },
    { key: "v", label: "compare         3-way A/B evaluation" },
    { key: "x", label: "explosive       12-way: all themes × intensities" },
    { key: "i", label: "imagine         generate image prompts per slide" },
    { key: "w", label: "watch           hot-reload (edit → auto-refresh)" },
    { key: "d", label: "design          manage design systems" },
    { key: "p", label: "pace            timing cues for presentation" },
    { key: "f", label: "pdf             export to PDF" },
    { key: "q", label: "quit" },
  ], { autoSelect: true });

  if (mode.key === "q") { process.exit(0); }

  // 3. Theme (skip for explosive — it runs all themes)
  let themeName = "light";
  if (mode.key !== "x") {
    const theme = await select("THEME", [
      { key: "l", label: "light" },
      { key: "d", label: "dark" },
      { key: "r", label: "red" },
      { key: "b", label: "blue" },
    ], { autoSelect: true });
    themeName = theme.label;
  }

  // 4. Model (shared across modes that call Claude)
  const modelChoice = await select("MODEL", [
    { key: "s", label: "sonnet          balanced quality + speed" },
    { key: "h", label: "haiku           fast + cheap" },
    { key: "o", label: "opus            maximum quality" },
  ], { autoSelect: true });
  const modelName = modelChoice.label.split(/\s+/)[0];

  // 5. Slide range (optional — for fast iteration on a subset)
  const srcSlideCount = fs.readFileSync(input, "utf-8").split(/\n---\n/).filter(s => s.trim()).length;
  const slideRange = await askText(`Slide range (1-${srcSlideCount}, or Enter for all)`, "");
  if (slideRange) {
    process.stderr.write(`  ${dim("Slides:")} ${slideRange} of ${srcSlideCount}\n`);
  }

  let composedPath, pptxPath, htmlPath;

  if (mode.key === "c") {
    // ── COMPOSE ──────────────────────────────
    const intensity = await select("INTENSITY", [
      { key: "n", label: "minimal         Müller-Brockmann: clean grid, no rewrites" },
      { key: "m", label: "moderate        Gerstner: restructure for impact" },
      { key: "x", label: "maximal         Weingart: full chromatic arc, font mixing" },
    ], { autoSelect: true });
    const intensityName = intensity.label.split(/\s+/)[0];

    // Design system
    const { listSystems } = require("./design-system.js");
    const systems = listSystems();
    let designSystemName = null;
    if (systems.length > 0) {
      const dsItems = [
        { key: "n", label: "none            generate fresh design" },
        ...systems.map((s, i) => ({ key: String(i + 1), label: `${s.name.padEnd(16)} ${s.aesthetic.slice(0, 40)}`, value: s.name })),
      ];
      const dsChoice = await select("DESIGN SYSTEM", dsItems, { autoSelect: true });
      if (dsChoice.value) designSystemName = dsChoice.value;
    }

    // Transition
    const transChoice = await select("TRANSITION", [
      { key: "f", label: "fade            smooth crossfade (default)" },
      { key: "l", label: "slide-left      horizontal slide" },
      { key: "u", label: "slide-up        vertical slide" },
      { key: "z", label: "zoom            scale in" },
      { key: "c", label: "cut             instant, no animation" },
    ], { autoSelect: true });
    const transitionName = { f: "fade", l: "slide-left", u: "slide-up", z: "zoom", c: "cut" }[transChoice.key] || "fade";

    const brief = await getBrief(input);

    // Image generation option
    // Check for existing images
    const existingImgDir = path.join(path.dirname(path.resolve(input)), `${inputBase}-images`);
    const hasExistingImages = fs.existsSync(existingImgDir) &&
      fs.readdirSync(existingImgDir).some(f => /^slide-\d+\.png$/.test(f));
    const existingCount = hasExistingImages
      ? fs.readdirSync(existingImgDir).filter(f => /^slide-\d+\.png$/.test(f)).length : 0;

    const imgItems = [];
    if (hasExistingImages) {
      imgItems.push({ key: "e", label: `existing        use ${existingCount} images in ${inputBase}-images/` });
    }
    imgItems.push({ key: "n", label: "none            no images" });
    imgItems.push({ key: "s", label: "strategic       generate for key slides (Midjourney)" });
    imgItems.push({ key: "a", label: "all             generate for every slide (Midjourney)" });

    const imgChoice = await select("IMAGES", imgItems, { autoSelect: true });

    let imageStyle = null;
    let imagesDir = null;
    if (imgChoice.key === "e") {
      imagesDir = existingImgDir;
    } else if (imgChoice.key !== "n") {
      const { IMAGE_STYLES } = require("./imagine.js");
      const styleNames = Object.keys(IMAGE_STYLES);
      const styleItems = styleNames.map((s, i) => ({
        key: String(i + 1),
        label: `${s.padEnd(16)} ${IMAGE_STYLES[s].name}`,
      }));
      const styleChoice = await select("IMAGE STYLE", styleItems, { autoSelect: true });
      imageStyle = styleNames[parseInt(styleChoice.key, 10) - 1];
    }

    const outputName = await askText("Output name", inputBase);

    const outputDir = path.dirname(path.resolve(input));
    htmlPath = path.join(outputDir, `${outputName}.html`);
    pptxPath = path.join(outputDir, `${outputName}.pptx`);
    composedPath = path.join(outputDir, `${outputName}.composed.md`);

    console.log(`\n  ${rule}`);
    const composeArgs = [input, htmlPath, "--theme", themeName, "--intensity", intensityName, "--model", modelName, "--incremental", "--transition", transitionName];
    if (brief) composeArgs.push("--brief", brief);
    if (slideRange) composeArgs.push("--slides", slideRange);
    if (designSystemName) composeArgs.push("--design-system", designSystemName);
    if (imgChoice.key === "e" && imagesDir) {
      composeArgs.push("--images-dir", imagesDir);
    } else if (imgChoice.key !== "n") {
      composeArgs.push("--with-images");
      if (imageStyle) composeArgs.push("--image-style", imageStyle);
      if (imgChoice.key === "s") composeArgs.push("--image-slides", "1,5,10,15,20");
    }
    const ok = run("compose.js", composeArgs);

    if (!ok) {
      console.error(`  ${accent("✗")} Composition failed.`);
      process.exit(1);
    }

    // Auto-open the output in the browser
    if (fs.existsSync(htmlPath)) {
      openFile(htmlPath);
    }

  } else if (mode.key === "r") {
    // ── RENDER ───────────────────────────────
    composedPath = path.resolve(input);
    const outputName = await askText("Output name", inputBase);
    const renderDir = path.dirname(path.resolve(input));
    pptxPath = path.join(renderDir, `${outputName}.pptx`);
    htmlPath = path.join(renderDir, `${outputName}.html`);

    const fmt = await select("FORMAT", [
      { key: "b", label: "both            PPTX + HTML" },
      { key: "p", label: "pptx" },
      { key: "h", label: "html" },
    ], { autoSelect: true });
    const fmtKey = fmt.key;

    console.log(`\n  ${rule}`);
    if (fmtKey === "p" || fmtKey === "b") {
      run("raster.js", [composedPath, pptxPath, "--theme", themeName]);
    }
    if (fmtKey === "h" || fmtKey === "b") {
      run("raster.js", [composedPath, htmlPath, "--theme", themeName, "--format", "html"]);
    }
    // Auto-open
    if (fs.existsSync(htmlPath)) openFile(htmlPath);
    else if (fs.existsSync(pptxPath)) openFile(pptxPath);

  } else if (mode.key === "v" || mode.key === "x") {
    // ── COMPARE / EXPLOSIVE ──────────────────
    const explosive = mode.key === "x";

    const brief = await getBrief(input);

    // Image option for compare
    const cmpImgDir = path.join(path.dirname(path.resolve(input)), `${inputBase}-images`);
    const cmpHasImages = fs.existsSync(cmpImgDir) &&
      fs.readdirSync(cmpImgDir).some(f => /^slide-\d+\.png$/.test(f));
    let cmpImagesDir = null;
    if (cmpHasImages) {
      const cmpImgCount = fs.readdirSync(cmpImgDir).filter(f => /^slide-\d+\.png$/.test(f)).length;
      const cmpImgChoice = await select("IMAGES", [
        { key: "e", label: `existing        use ${cmpImgCount} images in ${inputBase}-images/` },
        { key: "n", label: "none            no images" },
      ], { autoSelect: true });
      if (cmpImgChoice.key === "e") cmpImagesDir = cmpImgDir;
    }

    const evalChoice = await select("EVALUATION", [
      { key: "y", label: "yes             Claude evaluates each variant" },
      { key: "n", label: "no              skip evaluation, variants only" },
    ], { autoSelect: true });
    const skipEval = evalChoice.key === "n";

    console.log(`\n  ${rule}`);
    const compareArgs = [input, "--model", modelName];
    if (!explosive) compareArgs.push("--theme", themeName);
    if (explosive) compareArgs.push("--explosive");
    compareArgs.push("--brief", brief || "default");
    if (skipEval) compareArgs.push("--skip-eval");
    if (slideRange) compareArgs.push("--slides", slideRange);
    if (cmpImagesDir) compareArgs.push("--images-dir", cmpImagesDir);
    run("compare.js", compareArgs);

    const reportPath = path.join(path.dirname(path.resolve(input)), `${inputBase}.compare.html`);
    if (fs.existsSync(reportPath)) {
      openFile(reportPath);
    }
    process.exit(0);

  } else if (mode.key === "i") {
    // ── IMAGINE ──────────────────────────────
    const { IMAGE_STYLES } = require("./imagine.js");
    const styleItems = Object.entries(IMAGE_STYLES).map(([key, s]) => ({
      key: key[0], label: `${key.padEnd(16)} ${s.description.slice(0, 50)}`,
      value: key,
    }));
    const styleChoice = await select("IMAGE STYLE", styleItems);
    const styleName = styleChoice.value;

    const absChoice = await select("ABSTRACTION", [
      { key: "s", label: "suggestive      semi-abstract, suggests the topic (default)" },
      { key: "r", label: "representational recognizable scenes in the chosen style" },
      { key: "a", label: "abstract        pure geometry, color fields" },
      { key: "l", label: "literal         direct visual of the content" },
    ], { autoSelect: true });
    const absName = { s: "suggestive", r: "representational", a: "abstract", l: "literal" }[absChoice.key] || "suggestive";

    const genChoice = await select("GENERATE IMAGES?", [
      { key: "p", label: "prompts only    generate text prompts (no API needed)" },
      { key: "g", label: "generate        call image API (needs key in .env)" },
    ], { autoSelect: true });

    console.log(`\n  ${rule}`);
    const imagineArgs = [input, "--style", styleName, "--abstraction", absName, "--model", modelName];
    if (genChoice.key === "g") imagineArgs.push("--generate");
    if (slideRange) imagineArgs.push("--slides", slideRange);
    run("imagine.js", imagineArgs);

    const imgDir = path.join(path.dirname(path.resolve(input)), `${inputBase}-images`);
    const galleryPath = path.join(imgDir, "gallery.md");
    if (fs.existsSync(galleryPath)) {
      console.log(`\n  ${sage("✓")} Gallery: ${teal(galleryPath)}`);
    }
    process.exit(0);

  } else if (mode.key === "w") {
    // ── WATCH ────────────────────────────────
    console.log(`\n  ${rule}`);
    run("watch.js", [input, "--theme", themeName]);
    process.exit(0);

  } else if (mode.key === "d") {
    // ── DESIGN SYSTEM ────────────────────────
    const dsAction = await select("DESIGN SYSTEM", [
      { key: "l", label: "list            browse saved systems" },
      { key: "g", label: "generate        ask Claude to create one" },
      { key: "p", label: "preview         render sample slides" },
      { key: "s", label: "show            display system details" },
    ], { autoSelect: true });

    if (dsAction.key === "l") {
      run("design-system.js", ["list"]);
    } else if (dsAction.key === "g") {
      const dsName = await askText("Name for the design system", "");
      if (dsName) {
        const dsBrief = await askText("Creative direction", "");
        const dsArgs = ["generate", dsName, "--model", modelName];
        if (dsBrief) dsArgs.push("--brief", dsBrief);
        run("design-system.js", dsArgs);
      }
    } else if (dsAction.key === "p") {
      const { listSystems: ls } = require("./design-system.js");
      const sysList = ls();
      if (sysList.length === 0) {
        console.log(dim("  No saved systems. Generate one first."));
      } else {
        const dsItems = sysList.map((s, i) => ({ key: String(i + 1), label: s.name, value: s.name }));
        const dsChoice = await select("SELECT SYSTEM", dsItems);
        run("design-system.js", ["preview", dsChoice.value, "--slides", input, "--theme", themeName]);
      }
    } else if (dsAction.key === "s") {
      const { listSystems: ls } = require("./design-system.js");
      const sysList = ls();
      if (sysList.length === 0) {
        console.log(dim("  No saved systems."));
      } else {
        const dsItems = sysList.map((s, i) => ({ key: String(i + 1), label: s.name, value: s.name }));
        const dsChoice = await select("SELECT SYSTEM", dsItems);
        run("design-system.js", ["show", dsChoice.value]);
      }
    }
    process.exit(0);

  } else if (mode.key === "p") {
    // ── PACE ─────────────────────────────────
    const duration = await askText("Presentation duration (minutes)", "50");
    const paceOutput = await askText("Write timestamps to notes? (y/n)", "y");

    console.log(`\n  ${rule}`);
    const paceArgs = [input, "--duration", duration];
    if (paceOutput.toLowerCase() === "y") {
      const pacedPath = input.replace(/\.md$/, "-paced.md");
      paceArgs.push("--output", pacedPath);
    }
    run("pace.js", paceArgs);
    process.exit(0);

  } else if (mode.key === "f") {
    // ── PDF ──────────────────────────────────
    // Need an HTML file first
    const htmlSource = await askText("HTML file to export", input.replace(/\.md$/, ".html"));
    if (!fs.existsSync(htmlSource)) {
      console.log(`  ${accent("✗")} ${htmlSource} not found — render HTML first`);
      process.exit(1);
    }
    const includeNotes = (await askText("Include speaker notes pages? (y/n)", "y")).toLowerCase() === "y";
    console.log(`\n  ${rule}`);
    const pdfArgs = [htmlSource];
    if (!includeNotes) pdfArgs.push("--no-notes");
    run("export-pdf.js", pdfArgs);
    process.exit(0);
  }

  // ── POST-RENDER LOOP ──────────────────────
  console.log(`\n  ${sage("── Done")} ${amber(pipelineTimer())} ${sage("──────────────────────────────────")}`);

  let running = true;
  while (running) {
    const action = await select("", [
      { key: "o", label: "open HTML" },
      { key: "p", label: "open PPTX" },
      { key: "s", label: "studio viewer (present + grid + QA)" },
      { key: "n", label: "presenter notes (press P in browser)" },
      { key: "w", label: "review (QA validation)" },
      { key: "v", label: "compare variants (3-way)" },
      { key: "r", label: "re-render (change theme)" },
      { key: "i", label: "add images (generate + splice)" },
      { key: "c", label: "recompose (call Claude again)" },
      { key: "f", label: "fresh start (clear cache, recompose)" },
      { key: "d", label: "diff (compare with another version)" },
      { key: "x", label: "export PDF" },
      { key: "t", label: "pace (add timing cues)" },
      { key: "e", label: "edit composed.md" },
      { key: "q", label: "quit" },
    ], { autoSelect: true });

    switch (action.key) {
      case "o":
        if (fs.existsSync(htmlPath)) openFile(htmlPath);
        else console.log(dim("  No HTML file found."));
        break;

      case "s": {
        const studioPath = htmlPath.replace(/\.html$/, ".studio.html");
        const studioSrc = composedPath || htmlPath.replace(/\.html$/, ".composed.md");
        if (fs.existsSync(studioSrc)) {
          run("studio.js", [studioSrc, studioPath, "--theme", themeName]);
          if (fs.existsSync(studioPath)) openFile(studioPath);
        } else {
          console.log(dim("  No composed.md found — compose first."));
        }
        break;
      }

      case "p":
        if (fs.existsSync(pptxPath)) openFile(pptxPath);
        else console.log(dim("  No PPTX file found."));
        break;

      case "n":
        if (fs.existsSync(htmlPath)) {
          console.log(`  ${dim("Press")} ${accent("P")} ${dim("in the browser to open presenter notes.")}`);
          openFile(htmlPath);
        } else console.log(dim("  No HTML — render first."));
        break;

      case "w": {
        const reviewPath = pptxPath.replace(/\.pptx$/, ".review.html");
        run("raster.js", [composedPath, reviewPath, "--theme", themeName, "--format", "review"]);
        if (fs.existsSync(reviewPath)) openFile(reviewPath);
        break;
      }

      case "v": {
        const skipEval = (await askText("Run Claude evaluation? (y/n)", "y")).toLowerCase() !== "y";
        const compareArgs = [input, "--theme", themeName, "--model", modelName];
        if (skipEval) compareArgs.push("--skip-eval");
        if (slideRange) compareArgs.push("--slides", slideRange);
        run("compare.js", compareArgs);
        const reportPath = path.join(path.dirname(path.resolve(input)), `${inputBase}.compare.html`);
        if (fs.existsSync(reportPath)) openFile(reportPath);
        break;
      }

      case "r": {
        const newTheme = await select("THEME", [
          { key: "l", label: "light" },
          { key: "d", label: "dark" },
          { key: "r", label: "red" },
          { key: "b", label: "blue" },
        ], { autoSelect: true });
        run("raster.js", [composedPath, pptxPath, "--theme", newTheme.label]);
        run("raster.js", [composedPath, htmlPath, "--theme", newTheme.label, "--format", "html"]);
        break;
      }

      case "c": {
        const newIntensity = await select("INTENSITY", [
          { key: "n", label: "minimal" },
          { key: "m", label: "moderate" },
          { key: "x", label: "maximal" },
        ], { autoSelect: true });
        const newBrief = await askText("Brief (optional)", "");
        console.log(`\n  ${rule}`);
        const composeArgs = [input, htmlPath, "--theme", themeName, "--intensity", newIntensity.label, "--model", modelName, "--incremental"];
        if (newBrief) composeArgs.push("--brief", newBrief);
        if (slideRange) composeArgs.push("--slides", slideRange);
        const ok = run("compose.js", composeArgs);
        break;
      }

      case "f": {
        // Fresh start: clear the .compose cache directory and recompose
        const cacheDir = htmlPath.replace(/\.html$/, ".compose");
        if (fs.existsSync(cacheDir)) {
          const { execSync: ex } = require("child_process");
          ex(`rm -rf "${cacheDir}"`);
          process.stderr.write(`  ${sage("✓")} Cleared cache: ${teal(cacheDir)}\n`);
        }
        const freshIntensity = await select("INTENSITY", [
          { key: "n", label: "minimal" },
          { key: "m", label: "moderate" },
          { key: "x", label: "maximal" },
        ], { autoSelect: true });
        const freshArgs = [input, htmlPath, "--theme", themeName, "--intensity", freshIntensity.label, "--model", modelName, "--incremental"];
        if (slideRange) freshArgs.push("--slides", slideRange);
        console.log(`\n  ${rule}`);
        run("compose.js", freshArgs);
        break;
      }

      case "i": {
        const { IMAGE_STYLES } = require("./imagine.js");
        const styleNames = Object.keys(IMAGE_STYLES);
        const imgStyleItems = styleNames.map((s, idx) => ({
          key: String(idx + 1),
          label: `${s.padEnd(16)} ${IMAGE_STYLES[s].name}`,
        }));
        const imgStyleChoice = await select("IMAGE STYLE", imgStyleItems, { autoSelect: true });
        const imgStyleName = styleNames[parseInt(imgStyleChoice.key, 10) - 1];

        const imgScope = await select("SCOPE", [
          { key: "s", label: "strategic       key slides only (1,5,10,15,20)" },
          { key: "a", label: "all             every slide" },
        ], { autoSelect: true });

        console.log(`\n  ${rule}`);
        const imagineArgs = [composedPath || input, "--style", imgStyleName, "--generate", "--model", modelName];
        if (imgScope.key === "s") imagineArgs.push("--slides", "1,5,10,15,20");
        const imgOk = run("imagine.js", imagineArgs);

        if (imgOk && fs.existsSync(htmlPath)) {
          const imgDir = path.join(path.dirname(path.resolve(composedPath || input)), `${inputBase}-images`);
          if (fs.existsSync(imgDir)) {
            process.stderr.write(`  ${amber("○")} Splicing images...\n`);
            run("splice-images.js", [htmlPath, imgDir, "--model", modelName]);
          }
        }
        break;
      }

      case "d": {
        const diffWith = await askText("Compare with (path to another .composed.md)", "");
        if (diffWith && fs.existsSync(diffWith) && fs.existsSync(composedPath)) {
          const diffOutput = composedPath.replace(".composed.md", ".diff.html");
          run("diff-slides.js", [composedPath, diffWith, "--output", diffOutput]);
          if (fs.existsSync(diffOutput)) openFile(diffOutput);
        } else {
          console.log(dim("  Both files must exist for diff."));
        }
        break;
      }

      case "x": {
        if (fs.existsSync(htmlPath)) {
          run("export-pdf.js", [htmlPath]);
        } else {
          console.log(dim("  No HTML file — render first."));
        }
        break;
      }

      case "t": {
        const dur = await askText("Duration (minutes)", "50");
        const pacedPath = composedPath ? composedPath.replace(".composed.md", "-paced.md") : input.replace(".md", "-paced.md");
        run("pace.js", [composedPath || input, "--duration", dur, "--output", pacedPath]);
        break;
      }

      case "e":
        if (fs.existsSync(composedPath)) {
          const editor = process.env.EDITOR || "code";
          try {
            execSync(`${editor} "${composedPath}"`, { stdio: "ignore" });
            console.log(`  ${sage("✓")} Opened in ${teal(editor)}`);
          } catch {
            console.log(`  ${dim("Edit manually:")} ${teal(composedPath)}`);
          }
        } else console.log(dim("  No composed markdown found."));
        break;

      case "q":
      default:
        running = false;
        break;
    }
  }

  process.exit(0);
}

// ═══════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════

const args = process.argv.slice(2);
const hasFlags = args.some((a) => a.startsWith("--"));

if (hasFlags) {
  const result = spawnSync("node", [path.join(SCRIPT_DIR, "compose.js"), ...args], {
    stdio: "inherit",
    timeout: 600000,
    cwd: SCRIPT_DIR,
  });
  process.exit(result.status || 0);
} else {
  const preselected = args[0] && fs.existsSync(args[0]) ? args[0] : null;
  interactive(preselected).catch((err) => {
    console.error(`  ${accent("✗")} ${err.message}`);
    process.exit(1);
  });
}
