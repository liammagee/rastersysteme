#!/usr/bin/env node
/**
 * compose — Claude-directed slide composition on a 60-column Swiss grid
 *
 * Reads markdown, sends it to Claude for radical Swiss / New Wave
 * layout interpretation, then renders via rastersysteme.
 *
 * Usage:
 *   node compose.js <input.md> [output.pptx] [options]
 *
 * Pipeline:
 *   input.md → Claude CLI (art direction) → *.composed.md → raster.js → output.pptx
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { generate, generateHTML, parseMarkdown } = require("./raster.js");

const dim = chalk.gray;
const accent = chalk.hex("#C44230");
const teal = chalk.hex("#2C7A92");
const sage = chalk.hex("#548C5A");
const amber = chalk.hex("#C79B38");

// ═══════════════════════════════════════════════════════
// DESIGN VOCABULARY — the prompt that teaches Claude
// to think like a Swiss / New Wave art director
// ═══════════════════════════════════════════════════════

const DESIGN_BRIEF = `You are a Swiss-trained art director who DESIGNS slides on a 60-column × 40-row grid. You do not select from templates — you compose each slide as a unique grid arrangement.

THE GRID:
- 60 horizontal columns (0–59) across the slide width
- 40 rows (0–39) down the height
- Elements are placed at specific column/row positions with specific spans
- Column 30 = centre. ÷12 = five 12-col zones. ÷5 = twelve 5-col zones.

YOUR TOOL: the <!-- design: {...} --> directive. This gives you FULL CONTROL over every slide's layout. You specify WHERE each element sits on the grid, HOW LARGE the typography is, WHAT COLOUR the background is, and WHAT ACCENTS are placed.

FORMAT — every slide gets a design directive as its FIRST line:

<!-- design: {
  "zones": [
    { "role": "title", "col": 0, "span": 24, "row": 2, "rowSpan": 15 },
    { "role": "body", "col": 30, "span": 26, "row": 5, "rowSpan": 30 }
  ],
  "accents": [
    { "type": "bar", "col": 26, "span": 2, "row": 0, "rowSpan": 40, "color": "E63946" }
  ],
  "typography": {
    "title": { "size": 48, "weight": 900, "transform": "uppercase", "tracking": "0.15em" },
    "body": { "size": 14, "leading": 1.6 }
  },
  "bg": "0A1628",
  "font": "Georgia"
} -->

ZONE ROLES: title, body, bullets, label, quote
ACCENT TYPES: bar (solid rectangle), line (thin), dot (circle), block (translucent)
TYPOGRAPHY: size (9-96px), weight (100-900), transform, tracking, leading, align, color
FONTS: Helvetica Neue (default), Georgia (serif), Palatino (classical), Courier New (mono), Futura (geometric)

CONTENT SYNTAX (after the design directive):
  # Title text
  ## Subtitle
  ### LABEL (small-caps, wide tracking)
  - Bullet item
  > Blockquote
  Bare text = body

RULES:
  1. Output ONLY slides separated by ---. No commentary, no code fences.
  2. Every slide MUST have a <!-- design: {...} --> directive as its FIRST line.
  3. Do NOT invent facts, URLs, dates. Content comes from the source only.
  4. Speaker notes from the source MUST be preserved (append design rationale).
  5. ALL substantive information must survive: URLs, emails, dates, names, criteria.

DESIGN PRINCIPLES (Swiss/New Wave):
- Typographic scale: the RATIO between title size and body size IS the hierarchy.
  48px title + 9px label = Weingart tension. 32px title + 14px body = Ruder clarity.
- Grid as argument: WHERE you place a title (col 0 vs col 20) changes its meaning.
  Left-anchored = declarative. Centred = monumental. Right-pushed = unconventional.
- Colour as structure: backgrounds create chapters. A chromatic arc across the deck
  gives the audience a felt sense of progression even before reading.
- Accents as punctuation: a single red bar at col 26 spanning the full height
  divides the slide like a caesura in a line of poetry.
- Whitespace as design: leaving cols 30-59 EMPTY is a stronger statement than
  filling them. The grid is as present in its absence as in its use.`;

// ═══════════════════════════════════════════════════════
// DEFAULT CREATIVE BRIEF — used when no --brief is given
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// DESIGN MOODS — one is randomly selected per run
// Each defines a distinct aesthetic direction
// ═══════════════════════════════════════════════════════

const DESIGN_MOODS = [
  { name: "nocturne",    seed: "Dark fields with rare signals of light. Near-black dominates; colour is an event, not a habit." },
  { name: "editorial",   seed: "Warm paper tones, serif typography, magazine pacing. Light is the ground; darkness punctuates." },
  { name: "brutalist",   seed: "Raw concrete. Binary black/white. One accent colour used once. No comfort, no warmth." },
  { name: "botanical",   seed: "Deep greens, earth tones, organic warmth. Growth as metaphor. Serif for reflection." },
  { name: "signal",      seed: "Control room aesthetic. Navy fields, alert accents. Clean, functional, slightly military." },
  { name: "archive",     seed: "Aged paper, scholarly layering. Serif authority. Dark brown chapter dividers." },
  { name: "bauhaus",     seed: "Primary geometry, Dessau precision. White ground, bold primaries. Futura. Democratic colour." },
  { name: "cinema",      seed: "Widescreen darkness. One warm pool of light. Sans-serif only. Spare. Cinematic pauses." },
  { name: "industrial",  seed: "Steel grey, exposed grid. Monospace dominates. Data as texture. No decoration." },
  { name: "solstice",    seed: "Warm-to-cool gradient across the deck. Golden opening fading to deep blue close." },
  { name: "manuscript",  seed: "Calligraphic warmth. Palatino and cream. Marginalia structure. The book as interface." },
  { name: "protest",     seed: "High contrast, urgent. Red and black only. Bold statements. Typography as weapon." },
];

function getDefaultBrief() {
  const mood = DESIGN_MOODS[Math.floor(Math.random() * DESIGN_MOODS.length)];
  process.stderr.write(`  ${dim("Mood:")} ${chalk.italic(mood.name)}\n`);
  return mood.seed;
}

const DEFAULT_BRIEF = "";

// ═══════════════════════════════════════════════════════
// INTENSITY GUIDES
// ═══════════════════════════════════════════════════════

const INTENSITY = {
  minimal: `INTENSITY: MINIMAL — Müller-Brockmann restraint

SLIDE COUNT: EXACTLY N slides (N = source count). No extras.

GRID PHILOSOPHY: wide margins, generous whitespace, quiet precision.
- Title zones: start at col 4–8, never span more than 30 cols. Leave right half empty.
- Body zones: start at col 4–8, span 30–40 cols. Narrow measure = elegant reading.
- Title sizes: 28–36px. Body: 13–16px. Weight: 400 (regular). No extremes.
- NO accent elements. The grid speaks through alignment and whitespace alone.
- Backgrounds: 80%+ slides use light/no-bg (F8F5F0, FAFAF8, FFFFFF). Max 3 slides
  with a mid-tone bg for chapter breaks. NO dark backgrounds.
- Font: Helvetica Neue ONLY. No font overrides.
- Tracking: 0–0.04em on body, 0.1–0.15em on ### labels.

EVERY SLIDE should look like a well-typeset page from a Swiss design annual.
Wide left margins. Clean type. Paper-white ground. Nothing decorative.

Example zone patterns:
  Title-only: { "role": "title", "col": 6, "span": 30, "row": 12, "rowSpan": 16 }
  Title+body: title at col:4 span:26, body at col:4 span:36 row:18
  Bullets: single zone col:6 span:34 — clean left-aligned list`,

  moderate: `INTENSITY: MODERATE — Gerstner editorial

SLIDE COUNT: EXACTLY N slides (N = source count). No extras.

GRID PHILOSOPHY: asymmetric 2-zone layouts with editorial confidence.
- Use the FULL grid vocabulary: 2-column splits, offset zones, accent bars.
- Title zones: vary position — sometimes col 0, sometimes col 20, sometimes col 35.
  Each slide should feel deliberately placed, not defaulting to top-left.
- Body zones: vary width — narrow (span 20) for emphasis, wide (span 40) for detail.
- Title sizes: 32–52px. Body: 12–16px. Weight: mix 400 and 700.
- Accent elements: use thin lines (type: "line") to divide zones, or small bars
  (span 1–3) as visual punctuation. 30–50% of slides should have an accent.
- Backgrounds: INVENT a 4-colour palette. 40% light, 30% mid-tone, 30% dark.
  The chromatic arc should cross light/dark at least 3 times across the deck.
- Font: Helvetica Neue default. Use Georgia on 15% of slides for editorial warmth.
- Tracking: vary between 0 and 0.12em to create typographic texture.

EVERY SLIDE should feel like a different page from the same magazine —
unified by palette and font choices but varied in grid composition.

Example zone patterns:
  Wide title: title col:0 span:58 row:8 rowSpan:10 (full-width statement)
  Sidebar: title col:0 span:18, body col:22 span:36 (narrow sidebar, wide content)
  Centred: title col:12 span:36 row:5 (centred column, generous margins both sides)
  Offset: title col:30 span:28 (right-aligned, left half empty = dramatic)`,

  maximal: `INTENSITY: MAXIMAL — Weingart confrontation

SLIDE COUNT: EXACTLY N slides (N = source count). No extras.

GRID PHILOSOPHY: every slide is a UNIQUE composition. No two slides should have
the same zone arrangement. The grid is an arena of opposing forces.

- Title zones: EXTREME positions. col:0 span:58 (full-bleed) on one slide,
  col:40 span:18 (small, right-pushed) on the next. Size: 18–96px.
  Weight: alternate between 100 (ultra-light) and 900 (black).
- Body zones: vary radically. Narrow cols (span 15) next to wide (span 50).
  Sometimes body ABOVE title. Sometimes body at col:0, title at col:40 (inverted).
- Accent elements: BOLD. Thick bars (span 4–8), colour blocks (type: "block"),
  dots as visual anchors. Use on 50%+ of slides.
- ### labels: on 70%+ of slides. Size 8–9px, tracking 0.2–0.4em, transform uppercase.
  The tiny label against the huge title IS the Weingart scale relationship.
- Backgrounds: INVENT 6-8 colours. HIGH CONTRAST: alternate near-black, vivid
  saturated (bright red, electric blue, golden yellow), and near-white.
  Adjacent slides must NEVER have similar brightness.
- Fonts: 2-3 typefaces. Futura for declarations, Georgia for reflection,
  Courier New for data. 20–30% of slides get font overrides.
- Tracking: extreme range. 0 on body text, 0.3em on labels, 0.15em on titles.

EVERY SLIDE should surprise. Different zone positions, different type scales,
different accent placements. The audience should feel that each slide was
individually composed, not generated from a template.

Example zone patterns (use these as STARTING POINTS then invent your own):
  Full-bleed title: title col:0 span:58 row:0 rowSpan:40, size 96px
  Split with bar: title col:0 span:24, accent bar col:26 span:2, body col:30 span:28
  Centred narrow: title col:18 span:24 row:4, body col:18 span:24 row:18 (column layout)
  Bottom-heavy: label col:4 span:20 row:2, title col:4 span:50 row:28 (title at bottom)
  Right-anchor: title col:32 span:26 row:4 (everything pushed right, left half breathes)
  Stacked: label row:2, title row:8 rowSpan:10, body row:22 (vertical rhythm)`,
};

// ═══════════════════════════════════════════════════════
// DESIGN SEEDS — random compositional emphasis per run
// ═══════════════════════════════════════════════════════

const DESIGN_SEEDS = [
  "Left-margin discipline: all titles start at col 6. Body never wider than span 36. The right third of every slide is whitespace.",
  "Full-bleed titles alternating with narrow centred columns. Scale jumps from 72px to 14px between slides.",
  "Accent bars as architecture: every slide has a coloured bar at a DIFFERENT column position, creating a visual rhythm across the deck.",
  "Right-anchored design: push titles to col 30+. The left half breathes. Unconventional, disorienting, deliberate.",
  "Vertical stacking: title at row 2, label at row 15, body at row 22. Vertical rhythm replaces horizontal composition.",
  "Narrow measure: body text never exceeds span 24. Maximum readability. Wide margins on both sides. Scholarly restraint.",
  "Extreme asymmetry: title zone span 15 (narrow) vs body zone span 40 (wide). The imbalance IS the design.",
  "Centred axis: everything on cols 12-48. Generous margins both sides. Title and body in one column. Monumental simplicity.",
  "Grid syncopation: alternate between cols 0-28 and cols 32-58 for title placement. The eye jumps left-right across slides.",
  "Dot accents as a visual motif: small dot (span 2) accents at different grid positions create a constellation across the deck.",
  "Primary colours on white ground. Bold bar accents. Geometric Futura. Bauhaus purity through grid discipline.",
  "Progressive reveal: slides start with title-only (one zone), add zones slide by slide, reaching maximum complexity at the climax.",
];

// ═══════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════

function buildPrompt(markdown, options = {}) {
  const { intensity = "moderate", brief = "" } = options;

  const parts = [DESIGN_BRIEF];

  parts.push(INTENSITY[intensity] || INTENSITY.moderate);

  // Pick a random mood and seed for variation across runs
  const seed = DESIGN_SEEDS[Math.floor(Math.random() * DESIGN_SEEDS.length)];
  process.stderr.write(`  ${dim("Seed:")} ${chalk.italic(seed.slice(0, 70))}${dim("...")}\n`);
  const direction = brief || getDefaultBrief();
  parts.push(`CREATIVE DIRECTION: ${direction}

COMPOSITIONAL EMPHASIS FOR THIS RUN: ${seed}`);

  // Pre-split source into numbered slides, optionally filtered by --slides range
  let sourceSlides = markdown.split(/\n---\n/).filter(s => s.trim());
  const slideRange = options.slides;
  if (slideRange) {
    const match = String(slideRange).match(/^(\d+)(?:-(\d+))?$/);
    if (match) {
      const start = parseInt(match[1], 10) - 1; // 1-indexed to 0-indexed
      const end = match[2] ? parseInt(match[2], 10) : start + 1;
      sourceSlides = sourceSlides.slice(start, end);
      process.stderr.write(`  ${dim("Slides:")} ${start + 1}-${end} of ${markdown.split(/\n---\n/).filter(s => s.trim()).length}\n`);
    }
  }
  const numberedSlides = sourceSlides.map((slide, i) => {
    return `=== SLIDE ${i + 1} of ${sourceSlides.length} ===\n${slide.trim()}`;
  }).join("\n\n");

  parts.push(`--- SOURCE SLIDES (${sourceSlides.length} total) ---

${numberedSlides}

--- END SOURCE ---

YOUR TASK HAS TWO PHASES:

═══ PHASE 1: MACRO DESIGN PLAN ═══
First, output a design plan as a comment block. This forces you to think about
the deck holistically BEFORE making per-slide decisions:

<!-- DESIGN PLAN
Aesthetic: [name it — invent a unique visual concept for this deck]
Palette: [4-8 hex colours with names, e.g. "0A1628 (ink night), D4A574 (sand)"]
Chromatic arc: [which bg colours on which slides — the colour journey]
Grid strategy: [how you'll vary zone positions across slides — e.g. "wide margins opening,
  tightening to full-bleed at climax, returning to wide for close"]
Type scale: [title size range, body size, label size — and how they vary]
Font strategy: [which typefaces on which slides and WHY]
Accent strategy: [where bars/lines/dots appear and what they mean]
Key moments: [2-3 slides with the most dramatic grid compositions]
-->

═══ PHASE 2: SLIDE OUTPUT ═══
Output EXACTLY ${sourceSlides.length} slides — one for each source slide, in the same order.
The content of each slide is FIXED. Your design plan determines the visual treatment.

For each of the ${sourceSlides.length} slides:
1. <!-- design: {...} --> as the FIRST line — a complete JSON design directive
   specifying zones (with col/span/row/rowSpan), accents, typography, bg, font.
   This is NOT optional. Every slide must have a unique design directive.
2. ### SECTION LABEL for typographic texture (optional, per intensity)
3. The slide's EXACT content from the source — unchanged, no rephrasing
4. Speaker notes preserved verbatim (you may append design rationale)

IMPORTANT: Each slide's design directive should be DIFFERENT from the others.
Vary zone positions, type sizes, accent placements, and backgrounds across slides.

Do NOT add extra slides. Do NOT remove slides.
The output must have EXACTLY ${sourceSlides.length} slides separated by ---.

CRITICAL: Your first output line must be <!-- DESIGN PLAN.
After the plan comment, output exactly ${sourceSlides.length} slides,
each starting with <!-- design: {. No other commentary, no code fences.`);

  return parts.join("\n\n");
}

function extractDesignPlan(raw) {
  const planMatch = raw.match(/<!-- DESIGN PLAN\n([\s\S]*?)-->/);
  if (planMatch) {
    const plan = planMatch[1].trim();
    process.stderr.write(`  ${dim("Design plan:")}\n`);
    plan.split("\n").slice(0, 5).forEach(l =>
      process.stderr.write(`    ${dim(l.trim())}\n`)
    );
  }
  return raw;
}

// ═══════════════════════════════════════════════════════
// CLAUDE CLI CALLER
// ═══════════════════════════════════════════════════════

function callClaudeAsync(prompt, options = {}) {
  const { spawn: spawnAsync } = require("child_process");
  return new Promise((resolve, reject) => {
    const label = options.label || "claude";
    const args = ["-p", "--output-format", "stream-json", "--verbose"];
    if (options.model) args.push("--model", options.model);

    const proc = spawnAsync("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let resultText = "";
    let buffer = "";
    let chars = 0;
    let phase = "starting";
    let model = "";
    const startTime = Date.now();
    const spin = ["\u2801", "\u2809", "\u2819", "\u2838", "\u2830", "\u2826", "\u2807", "\u2803"];
    let si = 0;

    function el() { return ((Date.now() - startTime) / 1000).toFixed(0); }

    let lastHeartbeat = 0;
    const heartbeat = setInterval(() => {
      const now = Math.floor((Date.now() - startTime) / 1000);
      if (now > 0 && now % 10 === 0 && now !== lastHeartbeat) {
        lastHeartbeat = now;
        const charInfo = chars > 0 ? ` ${amber(chars + " chars")}` : "";
        const modelInfo = model ? ` ${dim(model)}` : "";
        process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} ${dim(phase)} ${amber(now + "s")}${charInfo}${modelInfo}\n`);
      }
    }, 1000);

    proc.stdout.on("data", (d) => {
      buffer += d.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          if (ev.type === "system" && ev.subtype === "init") {
            phase = "generating";
            model = (ev.model || "").split("[")[0];
            process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} ${teal(model)} ${amber(el() + "s")}       \n`);
          } else if (ev.type === "assistant" && ev.message && ev.message.content) {
            phase = "streaming";
            for (const block of ev.message.content) {
              if (block.type === "text" && block.text) chars += block.text.length;
            }
          } else if (ev.type === "result") {
            phase = "done";
            resultText = ev.result || "";
            if (ev.usage) {
              const inp = ev.usage.input_tokens || 0;
              const out = ev.usage.output_tokens || 0;
              const cached = ev.usage.cache_read_input_tokens || 0;
              const cost = ev.total_cost_usd ? "$" + ev.total_cost_usd.toFixed(3) : "";
              process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} ${dim("tokens:")} ${amber(inp + "in " + out + "out")}${cached ? dim(" (" + cached + " cached)") : ""} ${cost ? dim(cost) : ""}       \n`);
            }
          }
        } catch { /* skip */ }
      }
    });
    let stderrBuf = "";
    proc.stderr.on("data", (d) => { stderrBuf += d.toString(); });
    proc.stdin.write(prompt);
    proc.stdin.end();

    function writeLog(reason, extraData) {
      const logDir = path.join(__dirname, "logs");
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const logFile = path.join(logDir, `claude-${label}-${ts}.log`);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const logData = [
        `timestamp: ${new Date().toISOString()}`,
        `label: ${label}`,
        `model: ${model || options.model || "default"}`,
        `reason: ${reason}`,
        `chars: ${chars}`,
        `elapsed: ${elapsed}s`,
        `result_length: ${resultText.length}`,
        stderrBuf ? `stderr:\n${stderrBuf}` : "stderr: (empty)",
        extraData || "",
      ].join("\n");
      try { fs.writeFileSync(logFile, logData); } catch { /* best effort */ }
      return logFile;
    }

    let killed = false; // Prevents close handler from re-logging after stall/timeout

    // Stall detection: if no chars after 90s, connection is dead — kill early
    const stallCheck = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 90 && chars === 0) {
        killed = true;
        clearInterval(stallCheck);
        clearInterval(heartbeat);
        clearTimeout(timeout);
        const logFile = writeLog(`STALL: 0 chars after ${elapsed.toFixed(0)}s`, "");
        proc.kill();
        process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} ${accent("✗")} stalled (0 chars after ${elapsed.toFixed(0)}s)\n`);
        process.stderr.write(`  ${dim("Log:")} ${teal(logFile)}\n`);
        reject(new Error(`Claude [${label}] stalled: 0 chars after ${elapsed.toFixed(0)}s`));
      }
    }, 10000);

    const timeout = setTimeout(() => {
      killed = true;
      clearInterval(stallCheck);
      clearInterval(heartbeat);
      const logFile = writeLog("TIMEOUT after 600s", `partial_result (first 500 chars):\n${resultText.slice(0, 500)}`);
      proc.kill();
      process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} ${accent("✗")} TIMEOUT after 600s (${chars} chars received)\n`);
      process.stderr.write(`  ${dim("Log:")} ${teal(logFile)}\n`);
      reject(new Error(`Claude [${label}] timed out after 600s (${chars} chars received)`));
    }, 600000);

    proc.on("close", (code) => {
      clearInterval(stallCheck);
      clearInterval(heartbeat);
      clearTimeout(timeout);
      if (killed) return; // Already handled by stall/timeout — don't re-log
      const totalEl = ((Date.now() - startTime) / 1000).toFixed(1);

      if (code !== 0) {
        const logFile = writeLog(`exit_code=${code}`, `result (first 500 chars):\n${resultText.slice(0, 500)}`);
        const errMsg = stderrBuf.trim() || `exit code ${code}`;
        process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} ${accent("✗")} ${errMsg.split("\n")[0].slice(0, 100)} ${amber(totalEl + "s")}\n`);
        process.stderr.write(`  ${dim("Log:")} ${teal(logFile)}\n`);
        return reject(new Error(`Claude [${label}] failed (code ${code}): ${errMsg.split("\n")[0]}`));
      }

      if (!resultText) {
        const logFile = writeLog("empty_response", "result: (empty)");
        process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} ${accent("✗")} empty response ${amber(totalEl + "s")}\n`);
        process.stderr.write(`  ${dim("Log:")} ${teal(logFile)}\n`);
        return reject(new Error(`Claude [${label}] returned empty response after ${totalEl}s`));
      }

      const logFile = writeLog(`success (code=${code})`, `result (first 500 chars):\n${resultText.slice(0, 500)}`);
      process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} ${sage("✓")} ${chalk.white.bold(chars)} chars ${amber(totalEl + "s")}\n`);
      resolve(resultText);
    });

    proc.on("error", (err) => {
      clearInterval(stallCheck);
      clearInterval(heartbeat);
      clearTimeout(timeout);
      const logFile = writeLog(`process_error: ${err.code || err.message}`, "");
      if (err.code === "ENOENT") {
        return reject(new Error("Claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code"));
      }
      process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} ${accent("✗")} ${err.message}\n`);
      process.stderr.write(`  ${dim("Log:")} ${teal(logFile)}\n`);
      reject(err);
    });
  });
}

function callClaude(prompt, options = {}) {
  const args = ["-p", "--output-format", "text"];
  if (options.model) args.push("--model", options.model);

  const result = spawnSync("claude", args, {
    input: prompt,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 600000, // 10 minutes for complex decks
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(
        "Claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code"
      );
    }
    throw result.error;
  }

  // Log every call for debugging
  const logDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logLabel = options.label || "sync";
  const logFile = path.join(logDir, `claude-${logLabel}-${ts}.log`);
  const logData = [
    `timestamp: ${new Date().toISOString()}`,
    `model: ${options.model || "default"}`,
    `exit_code: ${result.status}`,
    `stdout_length: ${(result.stdout || "").length}`,
    `stderr: ${(result.stderr || "").trim() || "(empty)"}`,
  ].join("\n");
  try { fs.writeFileSync(logFile, logData); } catch { /* best effort */ }

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    process.stderr.write(`  ${accent("✗")} Claude failed (code ${result.status}) — log: ${logFile}\n`);
    throw new Error(`Claude exited with code ${result.status}${stderr ? ": " + stderr.split("\n")[0] : ""}`);
  }

  let output = (result.stdout || "").trim();

  if (!output) {
    process.stderr.write(`  ${accent("✗")} Claude returned empty — log: ${logFile}\n`);
    throw new Error("Claude returned empty output");
  }

  // Strip accidental code fences wrapping the entire response
  if (/^```(?:markdown)?\s*\n/.test(output) && /\n```\s*$/.test(output)) {
    output = output
      .replace(/^```(?:markdown)?\s*\n/, "")
      .replace(/\n```\s*$/, "");
  }

  // Skip slide sanitization if caller just wants raw text (e.g. brief generation)
  if (options.raw) return output;

  // Sanitize: extract only slide markdown if Claude added preamble/postscript
  const layoutIdx = output.indexOf("<!-- layout:");
  if (layoutIdx < 0) {
    throw new Error(
      "Claude did not return valid slide markdown (no <!-- layout: --> directives found). " +
      "This can happen if CLI hooks override the output format. Try again."
    );
  }
  if (layoutIdx > 0) {
    output = output.substring(layoutIdx);
  }

  // Strip trailing commentary after the last slide content
  const lines = output.split("\n");
  let lastContentLine = lines.length - 1;
  while (lastContentLine > 0) {
    const trimmed = lines[lastContentLine].trim();
    if (
      trimmed === "" || trimmed === "---" ||
      trimmed.startsWith("<!--") || trimmed.startsWith("#") ||
      trimmed.startsWith("-") || trimmed.startsWith(">") ||
      trimmed.startsWith("```")
    ) break;
    lastContentLine--;
  }
  output = lines.slice(0, lastContentLine + 1).join("\n").trimEnd();

  return output;
}

function sanitizeClaudeOutput(raw) {
  let output = (raw || "").trim();
  if (!output) throw new Error("Claude returned empty output");

  if (/^```(?:markdown)?\s*\n/.test(output) && /\n```\s*$/.test(output)) {
    output = output.replace(/^```(?:markdown)?\s*\n/, "").replace(/\n```\s*$/, "");
  }

  // Extract and log the design plan — but KEEP it in the output for reference
  extractDesignPlan(output);

  // Find first slide directive — either <!-- design: or <!-- layout:
  const designIdx = output.indexOf("<!-- design:");
  const layoutIdx = output.indexOf("<!-- layout:");
  const firstDirective = designIdx >= 0 && (layoutIdx < 0 || designIdx < layoutIdx) ? designIdx : layoutIdx;
  if (firstDirective < 0) {
    throw new Error("Claude did not return valid slide markdown (no <!-- design: --> or <!-- layout: --> directives found).");
  }
  // Strip preamble text but keep HTML comments (design plans, etc.)
  if (firstDirective > 0) {
    const beforeDirective = output.substring(0, firstDirective);
    const comments = beforeDirective.match(/<!--[\s\S]*?-->/g) || [];
    output = comments.join("\n\n") + "\n\n" + output.substring(firstDirective);
  }

  const lines = output.split("\n");
  let lastContentLine = lines.length - 1;
  while (lastContentLine > 0) {
    const trimmed = lines[lastContentLine].trim();
    if (
      trimmed === "" || trimmed === "---" ||
      trimmed.startsWith("<!--") || trimmed.startsWith("#") ||
      trimmed.startsWith("-") || trimmed.startsWith(">") ||
      trimmed.startsWith("```")
    ) break;
    lastContentLine--;
  }
  return lines.slice(0, lastContentLine + 1).join("\n").trimEnd();
}

// ═══════════════════════════════════════════════════════
// COMPOSE PIPELINE
// ═══════════════════════════════════════════════════════

async function composeAsync(inputPath, outputPath, options = {}) {
  const md = fs.readFileSync(inputPath, "utf-8");
  const intensity = options.intensity || "moderate";

  process.stderr.write(`  ${dim("[")}${accent(intensity)}${dim("] Composing...")}\n`);

  const prompt = buildPrompt(md, options);
  const raw = await callClaudeAsync(prompt, { ...options, label: intensity });
  const composed = sanitizeClaudeOutput(raw);

  const composedPath = outputPath.replace(/\.(pptx|html)$/, ".composed.md");
  fs.writeFileSync(composedPath, composed);
  process.stderr.write(`  ${dim("[")}${accent(intensity)}${dim("]")} → ${teal(composedPath)}\n`);

  if (options.dryRun) {
    return { slides: 0, output: composedPath, dryRun: true };
  }

  const renderer = outputPath.endsWith(".html") ? generateHTML : generate;
  const result = await renderer(composedPath, outputPath, {
    theme: options.theme,
    ratio: options.ratio,
  });

  process.stderr.write(`  ${dim("[")}${accent(intensity)}${dim("]")} ${sage("✓")} ${chalk.white.bold(result.slides)} slides\n`);

  // Content preservation + intensity compliance checks
  const { validateIntensity, validateContentPreservation } = require("./qa.js");
  const composedContent = fs.readFileSync(composedPath, "utf-8");
  const composedSlides = parseMarkdown(composedContent);

  const sourceSlideCount = md.split(/\n---\n/).filter(s => s.trim()).length;
  const contentCheck = validateContentPreservation(md, composedContent);
  const intensityCheck = validateIntensity(composedSlides, intensity, sourceSlideCount);
  const allChecks = [...contentCheck, ...intensityCheck];

  if (allChecks.length > 0) {
    process.stderr.write(`  ${dim("[")}${accent(intensity)}${dim("]")} validation:\n`);
    allChecks.forEach(r => {
      const icon = r.severity === "error" ? accent("\u2716") : amber("\u26A0");
      process.stderr.write(`    ${icon} ${r.message}\n`);
    });
  }

  return { ...result, composedPath, validation: allChecks };
}

async function compose(inputPath, outputPath, options = {}) {
  const md = fs.readFileSync(inputPath, "utf-8");
  const intensity = options.intensity || "moderate";

  process.stderr.write(`  ${dim("Reading")} ${teal(path.basename(inputPath))}${dim("...")}\n`);

  const prompt = buildPrompt(md, options);
  const raw = await callClaudeAsync(prompt, { ...options, label: intensity });
  const composed = sanitizeClaudeOutput(raw);

  // Write intermediate composed markdown for inspection / manual editing
  const composedPath = outputPath.replace(/\.(pptx|html)$/, ".composed.md");
  fs.writeFileSync(composedPath, composed);
  process.stderr.write(`  ${dim("Composed →")} ${teal(composedPath)}\n`);

  if (options.dryRun) {
    process.stdout.write(composed + "\n");
    return { slides: 0, output: composedPath, dryRun: true };
  }

  // Render via rastersysteme
  const renderer = outputPath.endsWith(".html") ? generateHTML : generate;
  const result = await renderer(composedPath, outputPath, {
    theme: options.theme,
    ratio: options.ratio,
  });

  process.stderr.write(
    `  ${sage("✓")} ${chalk.white.bold(result.slides)} slides → ${teal(result.output)} ${dim(`(${result.theme}, 60×40)`)}\n`
  );

  // Content preservation + intensity compliance checks
  const { validateIntensity, validateContentPreservation } = require("./qa.js");
  const composedContent = fs.readFileSync(composedPath, "utf-8");
  const composedSlides = parseMarkdown(composedContent);

  const sourceSlideCount = md.split(/\n---\n/).filter(s => s.trim()).length;
  const contentCheck = validateContentPreservation(md, composedContent);
  const intensityCheck = validateIntensity(composedSlides, intensity, sourceSlideCount);
  const allChecks = [...contentCheck, ...intensityCheck];

  if (allChecks.length > 0) {
    process.stderr.write(`\n  Validation:\n`);
    allChecks.forEach(r => {
      const icon = r.severity === "error" ? accent("\u2716") : amber("\u26A0");
      process.stderr.write(`    ${icon} ${r.message}\n`);
    });
  }

  return { ...result, composedPath, validation: allChecks };
}

// ═══════════════════════════════════════════════════════
// INCREMENTAL COMPOSE — batched, resumable, progressive
// ═══════════════════════════════════════════════════════

async function composeIncremental(inputPath, outputPath, options = {}) {
  const md = fs.readFileSync(inputPath, "utf-8");
  const intensity = options.intensity || "moderate";
  const batchSize = options.batchSize || 1;
  const model = options.model || "sonnet";

  // Work directory for incremental state
  const workDir = outputPath.replace(/\.(pptx|html)$/, ".compose");
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  const sourceSlides = md.split(/\n---\n/).filter(s => s.trim());
  const total = sourceSlides.length;

  process.stderr.write(`\n  ${accent("━━━ INCREMENTAL COMPOSE ━━━━━━━━━━━━━━━━━━")}\n`);
  process.stderr.write(`  ${dim("Source:")} ${teal(path.basename(inputPath))} ${dim("(")}${total} slides${dim(")")}\n`);
  process.stderr.write(`  ${dim("Intensity:")} ${accent(intensity)} ${dim("| Model:")} ${amber(model)} ${dim("| Batch:")} ${batchSize}\n`);
  process.stderr.write(`  ${dim("Work dir:")} ${teal(workDir)}\n\n`);

  // ── STAGE 1: Design System ──────────────────────
  const designSystemPath = path.join(workDir, "design-system.json");
  let designSystem;

  if (fs.existsSync(designSystemPath)) {
    process.stderr.write(`  ${sage("✓")} Stage 1: Design system ${dim("(cached)")}\n`);
    designSystem = JSON.parse(fs.readFileSync(designSystemPath, "utf-8"));
  } else {
    process.stderr.write(`  ${amber("○")} Stage 1: Generating design system...\n`);

    const seed = DESIGN_SEEDS[Math.floor(Math.random() * DESIGN_SEEDS.length)];
    const mood = options.brief || getDefaultBrief();

    const designPrompt = `You are a Swiss-trained art director designing a slide deck on a 60-column × 40-row grid.

INTENSITY: ${intensity.toUpperCase()}
${INTENSITY[intensity] || INTENSITY.moderate}

CREATIVE DIRECTION: ${mood}
COMPOSITIONAL EMPHASIS: ${seed}

The source deck has ${total} slides. Design a COMPLETE visual system for it.

Output ONLY valid JSON (no code fences, no commentary):
{
  "aesthetic": "name and 1-sentence description of the visual concept",
  "palette": [
    { "hex": "XXXXXX", "name": "descriptive name", "role": "dominant|accent|ground|signal" }
  ],
  "chromaticArc": "1-sentence description of how colours flow across the ${total} slides",
  "gridStrategy": "1-sentence description of how zone positions vary across slides",
  "typeScale": {
    "titleRange": [min, max],
    "bodySize": N,
    "labelSize": N,
    "titleWeightRange": [min, max]
  },
  "fontStrategy": {
    "default": "font name",
    "secondary": "font name or null",
    "tertiary": "font name or null",
    "secondarySlides": "description of when secondary font is used"
  },
  "accentStrategy": "1-sentence description of accent element usage"
}`;

    try {
      const raw = await callClaudeAsync(designPrompt, { model, label: "design-system" });
      let json = raw.trim();
      if (/^```/.test(json)) json = json.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
      const firstBrace = json.indexOf("{");
      const lastBrace = json.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) json = json.slice(firstBrace, lastBrace + 1);
      designSystem = JSON.parse(json);
      fs.writeFileSync(designSystemPath, JSON.stringify(designSystem, null, 2));
      process.stderr.write(`  ${sage("✓")} Stage 1: ${chalk.white(designSystem.aesthetic || "Design system generated")}\n`);
    } catch (err) {
      process.stderr.write(`  ${accent("✗")} Stage 1 failed: ${err.message}\n`);
      throw err;
    }
  }

  // Show the design system
  if (designSystem.palette) {
    const swatches = designSystem.palette.map(c => `${dim(c.hex)} ${c.name}`).join(dim(" · "));
    process.stderr.write(`  ${dim("  Palette:")} ${swatches}\n`);
  }
  if (designSystem.fontStrategy) {
    process.stderr.write(`  ${dim("  Fonts:")} ${designSystem.fontStrategy.default}${designSystem.fontStrategy.secondary ? " + " + designSystem.fontStrategy.secondary : ""}\n`);
  }

  // ── STAGE 2: Per-slide design (batched) ─────────
  const perSlide = batchSize === 1;
  process.stderr.write(`\n  ${amber("○")} Stage 2: Designing ${total} slides${perSlide ? " (1 per call)" : ` in batches of ${batchSize}`}...\n`);

  const designSystemContext = JSON.stringify(designSystem, null, 2);
  const designPlanComment = `<!-- DESIGN PLAN\n${designSystemContext}\n-->`;
  const slideDesigns = [];
  let completed = 0;
  let failed = 0;

  // Check for cached batches
  for (let i = 0; i < total; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batchPath = path.join(workDir, `slide-${String(batchNum).padStart(2, "0")}.md`);

    if (fs.existsSync(batchPath)) {
      const cached = fs.readFileSync(batchPath, "utf-8");
      slideDesigns.push(cached);
      completed += 1;
      if (perSlide) {
        // Compact progress for single-slide mode
        if (batchNum === 1 || batchNum === total) {
          process.stderr.write(`  ${sage("✓")} Slide ${batchNum}/${total} ${dim("(cached)")}\n`);
        } else if (batchNum === 2) {
          process.stderr.write(`  ${sage("✓")} Slides 2-${total - 1} ${dim("(cached, checking...)")}\n`);
        }
      } else {
        process.stderr.write(`  ${sage("✓")} Batch ${batchNum}: slides ${i + 1}-${Math.min(i + batchSize, total)} ${dim("(cached)")}\n`);
      }
      continue;
    }

    const batchSlides = sourceSlides.slice(i, i + batchSize);
    const batchEnd = Math.min(i + batchSize, total);
    const numberedBatch = batchSlides.map((s, j) => `=== SLIDE ${i + j + 1} of ${total} ===\n${s.trim()}`).join("\n\n");

    const batchPrompt = `You are composing slides on a 60×40 grid. Here is the design system you MUST follow:

${designSystemContext}

INTENSITY: ${intensity.toUpperCase()}

Design slide ${i + 1} of ${total}. It needs a <!-- design: {...} --> directive as its FIRST line.

Use the palette, fonts, grid strategy, and accent strategy from the design system above.
The content is FIXED — copy it exactly. You may add a ### label for typographic texture.

${numberedBatch}

Output EXACTLY ONE slide starting with <!-- design: {.
No --- separators, no commentary, no code fences.`;

    if (perSlide) {
      process.stderr.write(`  ${amber("⟐")} Slide ${batchNum}/${total}...`);
    } else {
      process.stderr.write(`  ${amber("⟐")} Batch ${batchNum}: slides ${i + 1}-${batchEnd}...`);
    }

    try {
      const raw = await callClaudeAsync(batchPrompt, { model, label: perSlide ? `slide-${batchNum}` : `batch-${batchNum}` });
      let cleaned = raw.trim();
      if (/^```/.test(cleaned)) cleaned = cleaned.replace(/^```(?:markdown)?\s*\n/, "").replace(/\n```\s*$/, "");

      fs.writeFileSync(batchPath, cleaned);
      slideDesigns.push(cleaned);

      completed += 1;
      process.stderr.write(` ${sage("✓")}\n`);

      // Progressive render: assemble + render every 5 slides so user can preview
      if (completed % 5 === 0 && completed < total && !options.dryRun) {
        const partialComposed = designPlanComment + "\n\n" + slideDesigns.join("\n\n---\n\n");
        const partialPath = outputPath.replace(/\.(pptx|html)$/, ".composed.md");
        fs.writeFileSync(partialPath, partialComposed);
        try {
          const partialRenderer = outputPath.endsWith(".html") ? generateHTML : generate;
          await partialRenderer(partialPath, outputPath, { theme: options.theme, ratio: options.ratio });
          process.stderr.write(`  ${dim("  → preview:")} ${teal(outputPath)} ${dim(`(${completed}/${total} slides)`)}\n`);
        } catch { /* non-fatal */ }
      }

      // Brief pause between calls to avoid rate limiting
      if (i + batchSize < total) await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      // Retry once on stall/timeout (0 chars = connection issue, not content issue)
      if (err.message.includes("stalled") || (err.message.includes("timed out") && err.message.includes("0 chars"))) {
        process.stderr.write(` ${amber("↻")} retrying...\n`);
        try {
          const raw = await callClaudeAsync(batchPrompt, { model, label: `${perSlide ? "slide" : "batch"}-${batchNum}-retry` });
          let cleaned = raw.trim();
          if (/^```/.test(cleaned)) cleaned = cleaned.replace(/^```(?:markdown)?\s*\n/, "").replace(/\n```\s*$/, "");
          fs.writeFileSync(batchPath, cleaned);
          slideDesigns.push(cleaned);
          const batchSlideCount = (cleaned.match(/<!-- design:/g) || []).length + (cleaned.match(/<!-- layout:/g) || []).length;
          completed += batchSlideCount;
          process.stderr.write(`  ${sage("✓")} Batch ${batchNum} retry: ${batchSlideCount} slides\n`);
          continue;
        } catch (retryErr) {
          process.stderr.write(`  ${accent("✗")} Retry failed: ${retryErr.message.split("\n")[0].slice(0, 60)}\n`);
        }
      } else {
        process.stderr.write(` ${accent("✗")} ${err.message.split("\n")[0].slice(0, 60)}\n`);
      }
      failed++;
      // Insert fallback — plain source slides with minimal design
      const fallback = batchSlides.map((s) => {
        return `<!-- layout: split -->\n${s.trim()}`;
      }).join("\n\n---\n\n");
      slideDesigns.push(fallback);
      completed += batchSlides.length;
    }
  }

  process.stderr.write(`  ${completed === total ? sage("✓") : amber("⚠")} Stage 2: ${completed}/${total} slides designed (${failed} batch failures)\n`);

  // ── STAGE 3+4: Assembly + Render (progressive) ──
  const composedPath = outputPath.replace(/\.(pptx|html)$/, ".composed.md");

  function assembleAndRender() {
    const assembled = designPlanComment + "\n\n" + slideDesigns.join("\n\n---\n\n");
    fs.writeFileSync(composedPath, assembled);
    return assembled;
  }

  // Write assembled markdown
  process.stderr.write(`\n  ${amber("○")} Stage 3: Assembling ${teal(composedPath)}...\n`);
  assembleAndRender();
  process.stderr.write(`  ${sage("✓")} Stage 3: ${completed} slides assembled\n`);

  if (options.dryRun) {
    return { slides: total, output: composedPath, dryRun: true, designSystem, workDir };
  }

  // Render HTML/PPTX
  process.stderr.write(`  ${amber("○")} Stage 4: Rendering...\n`);
  const renderer = outputPath.endsWith(".html") ? generateHTML : generate;
  const result = await renderer(composedPath, outputPath, {
    theme: options.theme,
    ratio: options.ratio,
  });

  process.stderr.write(`  ${sage("✓")} Stage 4: ${chalk.white.bold(result.slides)} slides → ${teal(result.output)}\n`);

  // ── STAGE 5: Images (optional) ──────────────────
  if (options.withImages && outputPath.endsWith(".html")) {
    process.stderr.write(`\n  ${amber("○")} Stage 5: Generating images...\n`);

    const imagesDir = path.join(workDir, "images");
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    try {
      const { imagine } = require("./imagine.js");
      const imageStyle = options.imageStyle || "swiss-poster";
      const imageResult = await imagine(composedPath, {
        style: imageStyle,
        generate: true,
        model: options.model,
        outputDir: imagesDir,
        slides: options.imageSlides, // optional: "1,5,10" — key slides only
      });

      process.stderr.write(`  ${sage("✓")} Stage 5: ${imageResult.generated || 0} images generated\n`);

      // Splice images into the rendered HTML
      if (imageResult.generated > 0) {
        process.stderr.write(`  ${amber("○")} Stage 5b: Splicing images into HTML...\n`);
        const { spliceImages } = require("./splice-images.js");
        await spliceImages(outputPath, imagesDir, { model: options.model });
        process.stderr.write(`  ${sage("✓")} Stage 5b: Images spliced into ${teal(outputPath)}\n`);
      }
    } catch (err) {
      process.stderr.write(`  ${amber("⚠")} Stage 5: Image generation failed (non-fatal): ${err.message.split("\n")[0].slice(0, 80)}\n`);
    }
  }

  process.stderr.write(`  ${accent("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}\n\n`);

  return { ...result, composedPath, designSystem, workDir };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
  compose — Claude-directed slide composition on a 60-column Swiss grid

  Pipeline:
    input.md → Claude (art direction) → *.composed.md → raster.js → output.pptx

  Usage:
    node compose.js <input.md> [output.pptx] [options]

  Options:
    --theme <name>         Render theme: light (default), dark, red, blue
    --ratio <r>            Aspect ratio: 16:9 (default), 4:3
    --intensity <level>    minimal | moderate (default) | maximal
    --brief "<direction>"  Creative direction (supplements the default brief)
    --slides <range>       Slide range: "1" or "2-6" (subset for fast iteration)
    --dry-run              Output composed markdown to stdout, skip render
    --model <model>        Claude model override (default: sonnet)
    --help                 Show this help

  Examples:
    node compose.js talk.md
    node compose.js talk.md deck.pptx --theme dark --intensity maximal
    node compose.js talk.md --slides 1-3 --model opus    # quick test, 3 slides
    node compose.js notes.md --brief "brutalist" --dry-run
    node compose.js pitch.md --intensity minimal --theme blue

  The composed markdown is always saved as *.composed.md alongside the output.
  Edit it and re-render directly with: node raster.js talk.composed.md
    `);
    process.exit(0);
  }

  const input = args[0];
  let output =
    args[1] && !args[1].startsWith("--")
      ? args[1]
      : input.replace(/\.md$/, ".html");

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const options = {
    theme: getFlag("--theme"),
    ratio: getFlag("--ratio"),
    intensity: getFlag("--intensity"),
    brief: getFlag("--brief"),
    model: getFlag("--model") || "sonnet",
    slides: getFlag("--slides"),
    dryRun: args.includes("--dry-run"),
    incremental: args.includes("--incremental"),
    batchSize: parseInt(getFlag("--batch-size") || "1", 10),
    withImages: args.includes("--with-images"),
    imageStyle: getFlag("--image-style"),
    imageSlides: getFlag("--image-slides"),
  };

  if (!fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  const fn = options.incremental ? composeIncremental : compose;
  fn(input, output, options).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { compose, composeAsync, composeIncremental, buildPrompt, callClaude, callClaudeAsync, sanitizeClaudeOutput, DESIGN_BRIEF, DESIGN_MOODS, INTENSITY };
