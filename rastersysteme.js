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

    function render(initial) {
      if (!initial) process.stdout.write(`\x1b[${n}A`);
      items.forEach((item, i) => {
        const sel = i === cursor;
        const marker = sel ? accent("▸") : " ";
        const key = item.key ? (sel ? accent(item.key) : dim(item.key)) : "";
        const text = sel ? highlight(` ${item.label} `) : dim(item.label);
        const sep = key ? dim(".") : " ";
        process.stdout.write(`    ${marker} ${key}${sep}${text}\x1b[K\n`);
      });
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
      // Replace list with just the selection
      process.stdout.write(`\x1b[${n}A`);
      for (let i = 0; i < n; i++) {
        if (i === cursor) {
          process.stdout.write(`    ${sage("✓")} ${bright(items[i].label)}\x1b[K\n`);
        } else {
          process.stdout.write(`\x1b[K\n`);
        }
      }
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

async function interactive(preselectedInput) {
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

    const brief = await getBrief(input);

    const outputName = await askText("Output name", inputBase);

    pptxPath = path.join(SCRIPT_DIR, `${outputName}.pptx`);
    htmlPath = path.join(SCRIPT_DIR, `${outputName}.html`);
    composedPath = path.join(SCRIPT_DIR, `${outputName}.composed.md`);

    console.log(`\n  ${rule}`);
    const composeArgs = [input, pptxPath, "--theme", themeName, "--intensity", intensityName, "--model", modelName];
    if (brief) composeArgs.push("--brief", brief);
    if (slideRange) composeArgs.push("--slides", slideRange);
    const ok = run("compose.js", composeArgs);

    if (!ok) {
      console.error(`  ${accent("✗")} Composition failed.`);
      process.exit(1);
    }

    console.log(dim("  ── HTML ──────────────────────────────────"));
    run("raster.js", [composedPath, htmlPath, "--theme", themeName, "--format", "html"]);

  } else if (mode.key === "r") {
    // ── RENDER ───────────────────────────────
    composedPath = path.resolve(input);
    const outputName = await askText("Output name", inputBase);
    pptxPath = path.join(SCRIPT_DIR, `${outputName}.pptx`);
    htmlPath = path.join(SCRIPT_DIR, `${outputName}.html`);

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

  } else if (mode.key === "v" || mode.key === "x") {
    // ── COMPARE / EXPLOSIVE ──────────────────
    const explosive = mode.key === "x";

    const brief = await getBrief(input);

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

    const genChoice = await select("GENERATE IMAGES?", [
      { key: "p", label: "prompts only    generate text prompts (no API needed)" },
      { key: "g", label: "generate        call image API (needs key in .env)" },
    ], { autoSelect: true });

    console.log(`\n  ${rule}`);
    const imagineArgs = [input, "--style", styleName, "--model", modelName];
    if (genChoice.key === "g") imagineArgs.push("--generate");
    run("imagine.js", imagineArgs);

    const imgDir = path.join(path.dirname(path.resolve(input)), `${inputBase}-images`);
    const galleryPath = path.join(imgDir, "gallery.md");
    if (fs.existsSync(galleryPath)) {
      console.log(`\n  ${sage("✓")} Gallery: ${teal(galleryPath)}`);
    }
    process.exit(0);
  }

  // ── POST-RENDER LOOP ──────────────────────
  console.log(`\n  ${sage("── Done ──────────────────────────────────")}`);

  let running = true;
  while (running) {
    const action = await select("", [
      { key: "o", label: "open HTML" },
      { key: "p", label: "open PPTX" },
      { key: "n", label: "presenter notes (press P in browser)" },
      { key: "w", label: "review (QA validation)" },
      { key: "v", label: "compare variants (3-way)" },
      { key: "r", label: "re-render (change theme)" },
      { key: "c", label: "recompose (call Claude again)" },
      { key: "e", label: "edit composed.md" },
      { key: "q", label: "quit" },
    ], { autoSelect: true });

    switch (action.key) {
      case "o":
        if (fs.existsSync(htmlPath)) openFile(htmlPath);
        else console.log(dim("  No HTML file found."));
        break;

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
        const composeArgs = [input, pptxPath, "--theme", themeName, "--intensity", newIntensity.label, "--model", modelName];
        if (newBrief) composeArgs.push("--brief", newBrief);
        if (slideRange) composeArgs.push("--slides", slideRange);
        const ok = run("compose.js", composeArgs);
        if (ok) run("raster.js", [composedPath, htmlPath, "--theme", themeName, "--format", "html"]);
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
