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

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

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
  ### Section label (ONLY if the source slide already has a ### heading)
  - Bullet item
  > Blockquote
  Bare text = body

RULES:
  1. Output ONLY slides separated by ---. No commentary, no code fences.
  2. Every slide MUST have a <!-- design: {...} --> directive as its FIRST line.
  3. Do NOT invent, rewrite, or add ANY text. Content comes from the source ONLY.
     This includes ### labels — NEVER add a ### line that does not exist in the source.
     If the source has no ### heading, the slide gets NO label. Labels are NOT decoration.
  4. Speaker notes from the source MUST be preserved (append design rationale).
  5. ALL substantive information must survive: URLs, emails, dates, names, criteria.
  6. Every word in the output must trace back to the source. If you cannot find it in
     the source, do not include it.

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
- Tracking: 0-0.04em on body, 0.1-0.15em on ### labels (only if source has ###).

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
- ### labels: ONLY on slides that already have ### headings in the source. Size 12–14px,
  tracking 0.15–0.3em, transform uppercase. Never invent labels.
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

  // Load design system early — it overrides intensity defaults for palette/font/accent
  let ds = null;
  if (options.designSystem) {
    ds = typeof options.designSystem === "string"
      ? require("./design-system.js").loadSystem(options.designSystem)
      : options.designSystem;
    process.stderr.write(`  ${dim("Design system:")} ${teal(ds.aesthetic || "loaded")}\n`);
  }

  // Inject intensity guide — but strip hardcoded palette/font/accent lines when a design system overrides them
  let intensityBlock = INTENSITY[intensity] || INTENSITY.moderate;
  if (ds) {
    // Remove lines that conflict with the design system's palette, font, and accent specs
    intensityBlock = intensityBlock
      .replace(/^.*INVENT \d+-\d+ colours.*$/gm, "")
      .replace(/^.*Futura for declarations.*$/gm, "")
      .replace(/^.*Georgia for reflection.*$/gm, "")
      .replace(/^.*Courier New for data.*$/gm, "")
      .replace(/^.*Helvetica Neue (default|ONLY).*$/gm, "")
      .replace(/^.*Font:.*$/gim, "")
      .replace(/^.*font:.*Helvetica.*$/gm, "")
      .replace(/^.*Use Georgia on.*$/gm, "")
      .replace(/^.*2-3 typefaces.*$/gm, "")
      .replace(/\n{3,}/g, "\n\n");
  }
  parts.push(intensityBlock);

  // Load design lessons from evaluation feedback (outer loop)
  const lessonsPath = path.join(__dirname, "design-lessons.md");
  if (fs.existsSync(lessonsPath)) {
    const lessonsText = fs.readFileSync(lessonsPath, "utf-8");
    // Extract just the lesson sections (skip evaluation log entries)
    const sections = lessonsText.split(/\n## /);
    const rules = sections
      .filter(s => !s.startsWith("Evaluation Log"))
      .map(s => s.replace(/^#.*\n/, "").trim())
      .filter(s => s.length > 20)
      .join("\n\n");
    if (rules) {
      parts.push(`DESIGN LESSONS (from prior evaluation feedback — follow these strictly):

${rules}

END DESIGN LESSONS`);
      process.stderr.write(`  ${dim("Lessons:")} loaded from design-lessons.md\n`);
    }
  }

  // Pick a random seed for variation across runs
  const seed = DESIGN_SEEDS[Math.floor(Math.random() * DESIGN_SEEDS.length)];
  process.stderr.write(`  ${dim("Seed:")} ${chalk.italic(seed.slice(0, 70))}${dim("...")}\n`);

  // Creative direction: design system aesthetic takes priority, then --brief, then random mood
  const direction = ds ? (brief || ds.aesthetic) : (brief || getDefaultBrief());
  parts.push(`CREATIVE DIRECTION: ${direction}

COMPOSITIONAL EMPHASIS FOR THIS RUN: ${seed}`);

  // Inject full design system constraints — these override all generic palette/font/accent guidance above
  if (ds) {
    const palette = (ds.palette || []).map(c => `${c.hex} (${c.name}, ${c.role})`).join(", ");
    const fonts = ds.fontStrategy
      ? `Primary: ${ds.fontStrategy.default}` + (ds.fontStrategy.secondary ? `, Secondary: ${ds.fontStrategy.secondary}` : "") + (ds.fontStrategy.tertiary ? `, Tertiary: ${ds.fontStrategy.tertiary}` : "")
      : "";
    parts.push(`BINDING DESIGN SYSTEM — these constraints override ALL generic guidance above:
Aesthetic: ${ds.aesthetic || ""}
Palette: ${palette}
Chromatic arc: ${ds.chromaticArc || ""}
Grid strategy: ${ds.gridStrategy || ""}
Type scale: title ${ds.typeScale?.titleRange?.[0] || 30}-${ds.typeScale?.titleRange?.[1] || 44}px, body ${ds.typeScale?.bodySize || 14}px, label ${ds.typeScale?.labelSize || 8}px, title weight ${ds.typeScale?.titleWeightRange?.[0] || 400}-${ds.typeScale?.titleWeightRange?.[1] || 700}
Font strategy: ${fonts}${ds.fontStrategy?.secondarySlides ? "\n  Secondary usage: " + ds.fontStrategy.secondarySlides : ""}
Accent strategy: ${ds.accentStrategy || ""}

CRITICAL: Use ONLY colours from this palette for bg overrides. Use ONLY the specified fonts. Follow the chromatic arc, grid strategy, and accent strategy exactly. Do NOT invent colours, fonts, or accent patterns outside this system.`);
  }

  // Strip multi-line HTML comments before processing (prevents leaked <!-- --> in output)
  // Preserve directive comments (layout, design, bg, font, etc.)
  const cleanedMarkdown = markdown.replace(/<!--[\s\S]*?-->/g, (match) => {
    if (!match.includes("\n")) return match;
    if (/<!--\s*(layout|bg|font|transition|style|design|master|image):/.test(match)) return match;
    return "";
  });

  // Pre-split source into numbered slides, optionally filtered by --slides range
  let sourceSlides = cleanedMarkdown.split(/\n---\n/).filter(s => s.trim());
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

YOUR TASK: Output ONLY a JSON array with exactly ${sourceSlides.length} objects —
one directive per source slide. Do NOT reproduce the slide content.
We will inject your directives into the original slides programmatically.

Each object specifies the FULL grid-based visual treatment for that slide.
${ds ? `You MUST use the design system's palette, fonts, grid strategy, accent strategy, and type scale.` : `INVENT a 4-colour palette (ground, dominant, accent, signal) and use it consistently. Use Helvetica Neue as default, Georgia as secondary serif.`}

{
  "slide": 1,
  "zones": [
    { "role": "title", "col": 0, "span": 36, "row": 2, "rowSpan": 15 },
    { "role": "body", "col": 0, "span": 40, "row": 18, "rowSpan": 20 }
  ],
  "accents": [
    { "type": "bar", "col": 0, "span": 60, "row": 1, "rowSpan": 1, "color": "B54B28" }
  ],
  "typography": {
    "title": { "size": 38, "weight": 700 },
    "body": { "size": 15 }
  },
  "bg": "F4EDE0",
  "font": "Helvetica Neue",
  "label": "INTRODUCTION",
  "notes": "Design rationale"
}

ZONE ROLES: title, body, bullets, label, quote, image
COLUMNS: 0-59 (col + span <= 60). ROWS: 0-39 (row + rowSpan <= 40).
ACCENT TYPES: bar (solid rectangle), line (thin), dot (circle), block (translucent)
TYPOGRAPHY: size (9-96px), weight (100-900), transform, tracking, leading, align, color

RULES:
- Return EXACTLY ${sourceSlides.length} objects in a JSON array
- Every slide MUST have zones, bg, and font — the "zones" array is MANDATORY
- Each slide should be a UNIQUE composition on the 60x40 grid — no two slides share the same zone arrangement
${ds ? `- Use ONLY colours from the design system palette for bg and accent colors
- Use ONLY the design system fonts (primary, secondary, tertiary)
- Follow the chromatic arc described in the design system
- Follow the accent strategy — place accent elements as specified
- Follow the type scale — title sizes within the specified range` :
`- Build a chromatic arc: vary bg darkness across the deck (light ground → dark dividers → light)
- Use font overrides sparingly (10-25% of slides) for typographic contrast
- Vary layouts: rotate through 4+ zone archetypes, no 3x consecutive repeats`}
- Labels should create Swiss-scale texture (tiny caps against large titles)
- The JSON array must be valid JSON — no trailing commas, no comments

Output ONLY the JSON array. No commentary, no code fences, no preamble.
Start with [ and end with ].`);

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
    const args = ["-p", "--output-format", "stream-json", "--verbose",
      "--setting-sources", "user",
      "--append-system-prompt", "Output ONLY what was requested. No commentary, no annotations. Raw output only."];
    if (options.model) args.push("--model", options.model);
    if (options.resume) args.push("--resume", options.resume);

    const proc = spawnAsync("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let resultText = "";
    let streamedText = "";
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
              if (block.type === "text" && block.text) {
                chars += block.text.length;
                streamedText += block.text;
              }
            }
          } else if (ev.type === "result") {
            phase = "done";
            resultText = ev.result || streamedText;
            if (ev.session_id) resultText = `__SESSION:${ev.session_id}__` + resultText;
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

    // Stall detection: only kill if we never connected (phase stuck at "starting")
    // Once connected ("generating"), Claude is thinking — don't kill, let the timeout handle it
    const stallCheck = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 90 && phase === "starting") {
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
  const args = ["-p", "--output-format", "text",
    "--setting-sources", "user",
    "--append-system-prompt", "Output ONLY what was requested. No commentary, no annotations. Raw output only."];
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
// RETRY LOGIC — exponential backoff for stalls, rate limits, parse failures
// ═══════════════════════════════════════════════════════

async function callClaudeWithRetry(prompt, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 10; // seconds
  const label = options.label || "claude";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const raw = await callClaudeAsync(prompt, options);

      // Check for rate limit response in the text
      if (raw && raw.includes("Credit balance is too low")) {
        throw new Error("RATE_LIMIT: Credit balance is too low");
      }

      return raw;
    } catch (err) {
      const msg = err.message || "";
      const isStall = msg.includes("stall");
      const isTimeout = msg.includes("timed out") || msg.includes("TIMEOUT");
      const isRateLimit = msg.includes("RATE_LIMIT") || msg.includes("rate") || msg.includes("429") || msg.includes("overloaded");
      const isEmpty = msg.includes("empty");
      const isExitCode = msg.includes("exit code") || msg.includes("non-zero");
      const isConnection = msg.includes("ECONNR") || msg.includes("EPIPE") || msg.includes("socket") || msg.includes("network");
      const isRetryable = isStall || isTimeout || isRateLimit || isEmpty || isExitCode || isConnection;

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      // Exponential backoff: 10s, 20s, 40s (with jitter)
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 5;
      const reason = isRateLimit ? "rate limited"
        : isStall ? "stalled"
        : isTimeout ? "timed out"
        : isExitCode ? "process error"
        : isConnection ? "connection error"
        : "empty response";

      process.stderr.write(
        `  ${dim("[")}${accent(label)}${dim("]")} ${amber("↻")} ${reason}, retry ${attempt}/${maxRetries} in ${Math.round(delay)}s\n`
      );

      await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }
  }
}

// ═══════════════════════════════════════════════════════
// DIRECTIVE ASSEMBLER — Claude outputs JSON, we inject into source markdown
// ═══════════════════════════════════════════════════════

function parseDirectives(raw) {
  let text = (raw || "").trim();

  // Strip code fences
  if (/^```/.test(text)) text = text.replace(/^```\w*\n/, "").replace(/\n```$/, "");

  // Find the JSON array
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  if (first < 0 || last <= first) {
    throw new Error("Claude did not return a valid JSON array of directives");
  }
  text = text.slice(first, last + 1);

  return JSON.parse(text);
}

function assembleComposed(sourceMd, directives) {
  const sourceSlides = sourceMd.split(/\n---\n/).filter(s => s.trim());

  const assembled = sourceSlides.map((slide, i) => {
    const d = directives.find(x => x.slide === i + 1) || directives[i] || {};

    const parts = [];

    // Full design directive (zones, accents, typography) — takes priority over layout
    if (d.zones) {
      const designObj = {};
      if (d.zones) designObj.zones = d.zones;
      if (d.accents) designObj.accents = d.accents;
      if (d.typography) designObj.typography = d.typography;
      if (d.bg) designObj.bg = d.bg;
      if (d.font) designObj.font = d.font;
      parts.push(`<!-- design: ${JSON.stringify(designObj)} -->`);
    } else {
      // Simple layout directive fallback
      if (d.layout) parts.push(`<!-- layout: ${d.layout} -->`);
      if (d.bg) parts.push(`<!-- bg: ${d.bg} -->`);
      if (d.font) parts.push(`<!-- font: ${d.font} -->`);
    }

    // Section label
    if (d.label) parts.push(`### ${d.label}`);

    // Original slide content — VERBATIM
    parts.push(slide.trim());

    // Append design rationale to notes if present
    if (d.notes) {
      const notesMatch = slide.match(/```notes\n([\s\S]*?)```/);
      if (notesMatch) {
        // Already has notes — append rationale
        const existingNotes = notesMatch[0];
        const withRationale = existingNotes.replace(/\n```$/, `\n\nDesign: ${d.notes}\n\`\`\``);
        parts[parts.length - 1] = parts[parts.length - 1].replace(existingNotes, withRationale);
      } else {
        // No notes — add a notes block
        parts.push(`\n\`\`\`notes\nDesign: ${d.notes}\n\`\`\``);
      }
    }

    return parts.join("\n");
  });

  return assembled.join("\n\n---\n\n");
}

// ═══════════════════════════════════════════════════════
// COMPOSE PIPELINE
// ═══════════════════════════════════════════════════════

async function composeAsync(inputPath, outputPath, options = {}) {
  const md = fs.readFileSync(inputPath, "utf-8");
  const intensity = options.intensity || "moderate";
  const cleanMd = md.replace(/<!--[\s\S]*?-->/g, (m) => {
    if (!m.includes("\n")) return m;
    if (/<!--\s*(layout|bg|font|transition|style|design|master|image):/.test(m)) return m;
    return "";
  });
  const sourceSlides = cleanMd.split(/\n---\n/).filter(s => s.trim());

  process.stderr.write(`  ${dim("[")}${accent(intensity)}${dim("]")} ${sourceSlides.length} slides → Claude for directives...\n`);

  const prompt = buildPrompt(md, options);
  const raw = await callClaudeWithRetry(prompt, { ...options, label: intensity, raw: true });

  // Parse JSON directives
  let directives;
  try {
    directives = parseDirectives(raw);
    process.stderr.write(`  ${dim("[")}${accent(intensity)}${dim("]")} ${sage("✓")} ${directives.length} directives received\n`);
  } catch (e) {
    process.stderr.write(`  ${accent("✗")} Failed to parse directives: ${e.message}\n`);
    const logPath = path.join(__dirname, "logs", `directives-fail-${Date.now()}.txt`);
    fs.mkdirSync(path.join(__dirname, "logs"), { recursive: true });
    fs.writeFileSync(logPath, raw);
    process.stderr.write(`  ${dim("Raw saved:")} ${teal(logPath)}\n`);
    throw e;
  }

  // Check directive count matches source
  if (directives.length !== sourceSlides.length) {
    process.stderr.write(`  ${amber("⚠")} Got ${directives.length} directives for ${sourceSlides.length} slides\n`);
  }

  // Assemble: inject directives into original slides (content untouched)
  const composed = assembleComposed(md, directives);
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

  process.stderr.write(`  ${dim("[")}${accent(intensity)}${dim("]")} ${sage("✓")} ${chalk.white.bold(result.slides)} slides rendered\n`);

  // Validation: content preservation + intensity compliance + directive adoption
  const { validateIntensity, validateContentPreservation, validateDirectiveAdoption } = require("./qa.js");
  const composedContent = fs.readFileSync(composedPath, "utf-8");
  const composedSlides = parseMarkdown(composedContent);

  const contentCheck = validateContentPreservation(md, composedContent);
  const intensityCheck = validateIntensity(composedSlides, intensity, sourceSlides.length);
  const directiveCheck = validateDirectiveAdoption(composedContent, intensity);
  const allChecks = [...contentCheck, ...intensityCheck, ...directiveCheck.filter(r => r.severity !== "info")];

  // Show directive adoption summary (info level)
  const infoMsg = directiveCheck.find(r => r.severity === "info");
  if (infoMsg) {
    process.stderr.write(`  ${dim("[")}${accent(intensity)}${dim("]")} ${sage(infoMsg.message)}\n`);
  }

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
  // Strip multi-line HTML comments before splitting
  const cleanMd = md.replace(/<!--[\s\S]*?-->/g, (m) => {
    if (!m.includes("\n")) return m;
    if (/<!--\s*(layout|bg|font|transition|style|design|master|image):/.test(m)) return m;
    return "";
  });
  const sourceSlides = cleanMd.split(/\n---\n/).filter(s => s.trim());

  process.stderr.write(`  ${dim("Reading")} ${teal(path.basename(inputPath))} ${dim(`(${sourceSlides.length} slides)`)}\n`);

  // Pre-compose source validation
  const { validateSource } = require("./qa.js");
  const sourceIssues = validateSource(md);
  if (sourceIssues.length > 0) {
    process.stderr.write(`  ${amber("⚠")} Source validation:\n`);
    sourceIssues.forEach(r => {
      const icon = r.severity === "error" ? accent("\u2716") : amber("\u26A0");
      process.stderr.write(`    ${icon} ${r.message}\n`);
    });
  }

  const prompt = buildPrompt(md, options);
  const raw = await callClaudeWithRetry(prompt, { ...options, label: intensity, raw: true });

  // Parse JSON directives and assemble
  let directives;
  try {
    directives = parseDirectives(raw);
  } catch (e) {
    process.stderr.write(`  ${accent("✗")} Failed to parse directives: ${e.message}\n`);
    throw e;
  }

  if (directives.length !== sourceSlides.length) {
    process.stderr.write(`  ${amber("⚠")} Got ${directives.length} directives for ${sourceSlides.length} slides\n`);
  }

  const composed = assembleComposed(md, directives);

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

  // Validation: content preservation + intensity compliance + directive adoption
  const { validateIntensity, validateContentPreservation, validateDirectiveAdoption } = require("./qa.js");
  const composedContent = fs.readFileSync(composedPath, "utf-8");
  const composedSlides = parseMarkdown(composedContent);

  const sourceSlideCount = md.split(/\n---\n/).filter(s => s.trim()).length;
  const contentCheck = validateContentPreservation(md, composedContent);
  const intensityCheck = validateIntensity(composedSlides, intensity, sourceSlideCount);
  const directiveCheck = validateDirectiveAdoption(composedContent, intensity);
  const allChecks = [...contentCheck, ...intensityCheck, ...directiveCheck.filter(r => r.severity !== "info")];

  const infoMsg = directiveCheck.find(r => r.severity === "info");
  if (infoMsg) {
    process.stderr.write(`  ${sage(infoMsg.message)}\n`);
  }

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
  let sessionId = null; // Reuse session across slides for speed

  // Work directory for incremental state
  const workDir = outputPath.replace(/\.(pptx|html)$/, ".compose");
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  // Strip multi-line HTML comments before splitting (prevents commented-out slides leaking)
  const cleanedMd = md.replace(/<!--[\s\S]*?-->/g, (match) => {
    if (!match.includes("\n")) return match;
    if (/<!--\s*(layout|bg|font|transition|style|design|master|image):/.test(match)) return match;
    return "";
  });

  let sourceSlides = cleanedMd.split(/\n---\n/).filter(s => s.trim());
  const totalAll = sourceSlides.length;

  // Apply --slides range filter
  if (options.slides) {
    const match = String(options.slides).match(/^(\d+)(?:-(\d+))?$/);
    if (match) {
      const start = parseInt(match[1], 10) - 1;
      const end = match[2] ? parseInt(match[2], 10) : start + 1;
      sourceSlides = sourceSlides.slice(start, end);
    }
  }
  const total = sourceSlides.length;

  process.stderr.write(`\n  ${accent("━━━ INCREMENTAL COMPOSE ━━━━━━━━━━━━━━━━━━")}\n`);
  process.stderr.write(`  ${dim("Source:")} ${teal(path.basename(inputPath))} ${dim("(")}${total}${total < totalAll ? "/" + totalAll : ""} slides${dim(")")}\n`);
  process.stderr.write(`  ${dim("Intensity:")} ${accent(intensity)} ${dim("| Model:")} ${amber(model)} ${dim("| Batch:")} ${batchSize}\n`);
  process.stderr.write(`  ${dim("Work dir:")} ${teal(workDir)}\n\n`);

  // ── STAGE 1: Design System ──────────────────────
  const designSystemPath = path.join(workDir, "design-system.json");
  let designSystem;

  // If a named design system was passed via --design-system, load and use it directly
  if (options.designSystem) {
    designSystem = typeof options.designSystem === "string"
      ? require("./design-system.js").loadSystem(options.designSystem)
      : options.designSystem;
    // Cache it to the work dir so incremental reruns reuse it
    fs.writeFileSync(designSystemPath, JSON.stringify(designSystem, null, 2));
    process.stderr.write(`  ${sage("✓")} Stage 1: ${chalk.white(designSystem.aesthetic || "Design system loaded")} ${dim("(from --design-system)")}\n`);
  } else if (fs.existsSync(designSystemPath)) {
    process.stderr.write(`  ${sage("✓")} Stage 1: Design system ${dim("(cached)")}\n`);
    designSystem = JSON.parse(fs.readFileSync(designSystemPath, "utf-8"));
  } else {
    process.stderr.write(`  ${amber("○")} Stage 1: Generating design system...\n`);

    const seed = DESIGN_SEEDS[Math.floor(Math.random() * DESIGN_SEEDS.length)];
    const mood = options.brief || getDefaultBrief();

    const themeName = options.theme || "light";
    const themeDesc = {
      light: "LIGHT THEME: The default background is warm white (#F8F5F0). Most slides should have NO bg override or use light/warm tones. Use dark bg ONLY on 2-3 section dividers. The deck should feel bright, clean, paper-like.",
      dark: "DARK THEME: The default background is near-black (#1A1A1A). Most slides should have NO bg override or use dark tones. Light bg slides are rare accent moments.",
      red: "RED THEME: Warm white default with red accents. Use the red accent colour strategically, not on every slide.",
      blue: "BLUE THEME: Cool grey-white default (#F0F4F8). Use deep blue for section dividers. Most slides stay light.",
    };

    const designPrompt = `You are a Swiss-trained art director designing a slide deck on a 60-column × 40-row grid.

${themeDesc[themeName] || themeDesc.light}

INTENSITY: ${intensity.toUpperCase()}
${INTENSITY[intensity] || INTENSITY.moderate}

CREATIVE DIRECTION: ${mood}
COMPOSITIONAL EMPHASIS: ${seed}

The source deck has ${total} slides. Design a COMPLETE visual system for it.
IMPORTANT: Your palette MUST match the ${themeName.toUpperCase()} theme.
${themeName === "light" ? `LIGHT THEME RULES:
- The ground/dominant colour MUST be a warm white or cream (luminance > 200). Examples: F8F5F0, FAFAF8, FFF8E7, EDE8E0.
- NO dark colours (luminance < 100) in the "ground" or "dominant" role.
- Dark colours are ONLY allowed in the "signal" or "accent" role, used on at most 1-2 slides.
- 80%+ of slides must use the light ground colour as bg.` : themeName === "dark" ? "Include near-blacks (1A1A1A, 111111) as the DOMINANT ground. Every slide needs an explicit bg." : "Include theme-appropriate ground colours. Every slide needs an explicit bg."}

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
      // Strip session prefix (added by callClaudeAsync for session tracking)
      json = json.replace(/^__SESSION:.*?__/, "");
      if (/^```/.test(json)) json = json.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
      const firstBrace = json.indexOf("{");
      const lastBrace = json.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) json = json.slice(firstBrace, lastBrace + 1);
      designSystem = JSON.parse(json);

      // Validate palette against theme — fix dark grounds in light themes
      const themeName = options.theme || "light";
      if (themeName === "light" && designSystem.palette) {
        designSystem.palette = designSystem.palette.map(c => {
          const hex = c.hex.replace(/^#/, "");
          const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
          const lum = r * 0.299 + g * 0.587 + b * 0.114;
          if ((c.role === "ground" || c.role === "dominant") && lum < 150) {
            process.stderr.write(`  ${amber("⚠")} Fixing dark ${c.role} colour #${hex} (lum ${Math.round(lum)}) → demoted to accent\n`);
            return { ...c, role: "accent" };
          }
          return c;
        });
        // Ensure at least one light ground exists
        const hasLightGround = designSystem.palette.some(c =>
          (c.role === "ground" || c.role === "dominant") &&
          parseInt(c.hex.slice(0, 2), 16) * 0.299 + parseInt(c.hex.slice(2, 4), 16) * 0.587 + parseInt(c.hex.slice(4, 6), 16) * 0.114 > 200);
        if (!hasLightGround) {
          designSystem.palette.unshift({ hex: "F8F5F0", name: "Warm White", role: "ground" });
          process.stderr.write(`  ${amber("⚠")} Added Warm White ground to palette\n`);
        }
      }

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
  const composedPath = outputPath.replace(/\.(pptx|html)$/, ".composed.md");
  const slideDesigns = [];
  let completed = 0;
  let failed = 0;

  // Background renderer: assembles + renders HTML every 8s so user can preview
  let bgRenderer = null;
  let lastRenderedCount = 0;
  if (!options.dryRun && outputPath.endsWith(".html")) {
    const renderInterval = setInterval(async () => {
      if (!bgRenderer) return; // Stopped — don't overwrite final/spliced output
      if (slideDesigns.length === 0 || slideDesigns.length === lastRenderedCount) return;
      lastRenderedCount = slideDesigns.length;
      try {
        const partial = designPlanComment + "\n\n" + slideDesigns.join("\n\n---\n\n");
        fs.writeFileSync(composedPath, partial);
        await generateHTML(composedPath, outputPath, { theme: options.theme || "light" });

        // Splice images into live preview if available
        if (options.withImages || options.imagesDir) {
          const imgDir = options.imagesDir || path.join(workDir, "images");
          if (fs.existsSync(imgDir) && fs.readdirSync(imgDir).some(f => /^slide-\d+\.png$/.test(f))) {
            try {
              const { spliceImages } = require("./splice-images.js");
              const spliced = spliceImages(outputPath, imgDir, { smart: false });
              if (spliced) fs.writeFileSync(outputPath, spliced);
            } catch {}
          }
        }

        process.stderr.write(`  ${dim("  → preview:")} ${teal(path.basename(outputPath))} ${dim(`(${lastRenderedCount}/${total})`)}\n`);
      } catch (renderErr) {
        process.stderr.write(`  ${dim("  → preview render failed:")} ${dim(renderErr.message.slice(0, 60))}\n`);
      }
    }, 8000);
    bgRenderer = renderInterval;
    process.stderr.write(`  ${dim("  Background renderer active — HTML updates live")}\n`);
  }

  const parallel = options.parallel || 1;

  // ── Build batch work items ──
  const withImg = options.withImages;
  const imgExample = withImg ? ', "image":"right", "imageSize":40' : '';
  const imgRules = withImg ? `
Also specify image placement per slide:
  "image": "right|left|inset-tr|inset-bl|background|none"
  "imageSize": 25-40 (% of slide width for sidebar modes). Use "none" for text-dense slides. Vary placements.

CRITICAL IMAGE-AWARE LAYOUT RULE:
  When "image":"right", ALL zones must fit in columns 0-${Math.floor(60 * 0.6)} (left 60%). No zone may extend into the image area.
  When "image":"left", ALL zones must fit in columns ${Math.floor(60 * 0.4)}-59 (right 60%).
  When "image":"background" or "image":"none", zones may use full width.
  When "image":"inset-tr", keep zones away from top-right corner (col < 45, or row > 10).
  When "image":"inset-bl", keep zones away from bottom-left corner (col > 15, or row < 30).
  ALWAYS design zones to AVOID the image area. Text over images is unreadable.` : "";

  // Intensity-specific design rules for per-slide prompts
  const INCREMENTAL_RULES = {
    minimal: `DESIGN RULES (MINIMAL — Müller-Brockmann restraint):
- Use ONE primary grid template: title col:6 span:30, body col:6 span:36. Wide left margins.
- Title sizes: 28–36px ONLY. Body: 13–16px. Weight: 400 (regular). No extremes.
- NO accent elements. The grid speaks through alignment and whitespace alone.
- bg: 80%+ slides use light ground (${(designSystem.palette || []).find(c => c.role === "ground")?.hex || "F8F5F0"}). Max 2–3 mid-tone slides.
- font: ${designSystem.fontStrategy?.default || "Helvetica Neue"} ONLY. No overrides.
- Every slide should look like a well-typeset page. Wide margins, clean type, nothing decorative.`,

    moderate: `DESIGN RULES (MODERATE — Gerstner editorial):
- Use 2-3 CONSISTENT grid templates, rotating between them for rhythm.
  E.g. Template A: title col:4 span:28, body col:4 span:40.
       Template B: title col:30 span:28, body col:2 span:26.
- SUBTLE variation within templates: shift a title col by 2-4, change size by 4-8px.
- Title sizes: pick 2-3 sizes (e.g. 36, 44, 52) and use them consistently. Body: 13-15px.
- bg: ALWAYS set. Use palette colours. Alternate light and dark for rhythm.
- Accents: use on 40%+ of slides. Vary position and type.
- font: vary between ${designSystem.fontStrategy?.default || "Helvetica Neue"} and ${designSystem.fontStrategy?.secondary || "Georgia"}.`,

    maximal: `DESIGN RULES (MAXIMAL — Weingart confrontation):
- Every slide MUST be a UNIQUE composition. NO two slides share the same zone arrangement.
- EXTREME zone positions: col:0 span:58 (full-bleed) on one slide, col:40 span:18 (right-pushed)
  on the next. Body ABOVE title sometimes. Inverted layouts (body col:0, title col:40).
- Title sizes: FULL RANGE 18–96px. Weight: alternate 100 (ultra-light) and 900 (black).
  48px title + 9px label = Weingart scale tension. Use it.
- ### labels on 70%+ of slides: size 8–9px, tracking 0.2–0.4em, uppercase.
- BOLD accents on 50%+ of slides: thick bars (span 4–8), colour blocks, dots as anchors.
- bg: HIGH CONTRAST. Adjacent slides NEVER share similar brightness. Alternate near-black,
  vivid saturated colours, and near-white from the palette.
- font: 2-3 typefaces. ${designSystem.fontStrategy?.default || "Futura"} for declarations,
  ${designSystem.fontStrategy?.secondary || "Georgia"} for reflection. 20-30% of slides get overrides.
- Tracking: extreme range. 0 on body, 0.3em on labels, 0.15em on titles.
- The audience should feel each slide was individually composed, not generated from a template.`,
  };

  function buildFullPrompt(slideSummaries, batchContext) {
    const accentHex = (designSystem.palette?.[2]?.hex) || 'D32F2F';
    const defaultFont = designSystem.fontStrategy?.default || "Helvetica Neue";

    // Intensity-appropriate example
    const examples = {
      minimal: `{"slide":1, "zones":[{"role":"title","col":6,"span":30,"row":12,"rowSpan":16},{"role":"body","col":6,"span":36,"row":20,"rowSpan":18}], "typography":{"title":{"size":32,"weight":400},"body":{"size":14}}, "bg":"F8F5F0", "font":"${defaultFont}"${imgExample}}`,
      moderate: `{"slide":1, "zones":[{"role":"title","col":4,"span":24,"row":4,"rowSpan":14},{"role":"body","col":4,"span":36,"row":20,"rowSpan":18}], "accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"${accentHex}"}], "typography":{"title":{"size":42,"weight":700},"body":{"size":14}}, "bg":"F8F5F0", "font":"${defaultFont}", "label":"SECTION NAME"${imgExample}}`,
      maximal: `{"slide":1, "zones":[{"role":"label","col":4,"span":20,"row":2,"rowSpan":4},{"role":"title","col":0,"span":58,"row":10,"rowSpan":20},{"role":"body","col":30,"span":26,"row":32,"rowSpan":8}], "accents":[{"type":"bar","col":26,"span":3,"row":0,"rowSpan":40,"color":"${accentHex}"},{"type":"dot","col":55,"span":3,"row":3,"rowSpan":3,"color":"${(designSystem.palette?.[3]?.hex) || 'FFD700'}"}], "typography":{"title":{"size":72,"weight":900,"tracking":"0.08em"},"body":{"size":13},"label":{"size":9,"tracking":"0.3em","transform":"uppercase"}}, "bg":"${(designSystem.palette?.[0]?.hex) || '0A1628'}", "font":"${defaultFont}", "label":"PROVOCATION"${imgExample}}`,
    };

    return `You are a Swiss-trained art director who DESIGNS slides on a 60-column × 40-row grid.
You do not select from templates — you compose each slide as a unique grid arrangement.

Design system: ${designSystemContext}

${INCREMENTAL_RULES[intensity] || INCREMENTAL_RULES.moderate}

I'll send slide summaries. For EACH slide, return a JSON object that specifies
WHERE elements sit on the grid.

Example:
${examples[intensity] || examples.moderate}

ZONE ROLES: title, body, bullets, label, quote
COLUMNS: 0-59 (col + span ≤ 60). ROWS: 0-39 (row + rowSpan ≤ 40).
ACCENT TYPES: bar (solid rectangle), line (thin), dot (circle), block (translucent)
TYPOGRAPHY: size (9-96px), weight (100-900), transform, tracking, leading, align, color

- bg: ALWAYS set. Use palette colours.
- font: vary between ${defaultFont} and ${designSystem.fontStrategy?.secondary || "Georgia"}.
${imgRules}
${batchContext}

${slideSummaries}

Output ONLY valid JSON — one object per line. No commentary.`;
  }

  function buildBatchContext(completedDesigns) {
    if (completedDesigns.length === 0) return "";
    const prevDirectives = [];
    completedDesigns.forEach(sd => {
      try {
        const lines = sd.split("\n").filter(l => l.trim());
        lines.forEach(l => {
          const layoutM = l.match(/<!-- layout: (\w+) -->/);
          const bgM = l.match(/<!-- bg: ([A-Fa-f0-9]+) -->/);
          const fontM = l.match(/<!-- font: ([^->]+?) -->/);
          if (layoutM) prevDirectives.push({ layout: layoutM[1], bg: bgM ? bgM[1] : null, font: fontM ? fontM[1].trim() : null });
        });
        lines.filter(l => l.startsWith("{")).forEach(l => {
          try { prevDirectives.push(JSON.parse(l)); } catch {}
        });
      } catch {}
    });
    if (prevDirectives.length === 0) return "";
    const prevLayouts = prevDirectives.map(d => d.layout).filter(Boolean);
    const prevBgs = [...new Set(prevDirectives.map(d => d.bg).filter(Boolean))];
    const prevFonts = [...new Set(prevDirectives.map(d => d.font).filter(Boolean))];
    const lastFew = prevDirectives.slice(-3);
    const layoutCounts = {};
    prevLayouts.forEach(l => layoutCounts[l] = (layoutCounts[l] || 0) + 1);
    return `
PREVIOUS SLIDES CONTEXT (maintain coherence):
- Slides completed: ${prevDirectives.length}
- Last 3 layouts: ${lastFew.map(d => d.layout).join(" → ")}
- Last 3 bgs: ${lastFew.map(d => d.bg || "null").join(" → ")}
- Layout distribution so far: ${Object.entries(layoutCounts).map(([k,v]) => `${k}:${v}`).join(", ")}
- Palette used: ${prevBgs.join(", ") || "none"}
- Fonts used: ${prevFonts.join(", ") || "default only"}
IMPORTANT: Continue the chromatic arc — don't repeat the last bg colour.
Don't use the same layout as the last slide. Maintain variety.`;
  }

  function buildSlideSummaries(batchSlides, offset) {
    return batchSlides.map((s, j) => {
      const title = (s.match(/^#\s+(.+)/m) || s.match(/^##\s+(.+)/m) || ["", "(untitled)"])[1];
      const bulletCount = (s.match(/^\s*[-*]\s/gm) || []).length;
      const hasQuote = /^>\s/m.test(s);
      const bodyLines = s.split("\n").filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith(">") && !l.startsWith("```") && !l.startsWith("<!--")).length;
      return `  Slide ${offset + j + 1}: "${title}" | ${bulletCount} bullets${hasQuote ? " | quote" : ""} | ${bodyLines} body lines`;
    }).join("\n");
  }

  function postProcessDirectives(directives) {
    // Enforce theme-appropriate bg colours
    const themeName = options.theme || "light";
    const groundColour = (designSystem.palette || []).find(c => c.role === "ground")?.hex || "F8F5F0";
    directives.forEach(d => {
      if (!d.bg) return;
      const hex = d.bg.replace(/^#/, "");
      if (hex.length !== 6) return;
      const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      if (themeName === "light" && lum < 100) {
        process.stderr.write(`  ${amber("⚠")} Slide ${d.slide}: bg #${hex} too dark (lum=${Math.round(lum)}) → replaced with #${groundColour}\n`);
        d.bg = groundColour;
      } else if (themeName === "dark" && lum > 200) {
        const darkGround = (designSystem.palette || []).find(c => c.role === "ground" || c.role === "dominant")?.hex || "1A1A1A";
        process.stderr.write(`  ${amber("⚠")} Slide ${d.slide}: bg #${hex} too light (lum=${Math.round(lum)}) → replaced with #${darkGround}\n`);
        d.bg = darkGround;
      }
    });

    // Enforce zone-image separation
    if (withImg) {
      directives.forEach(d => {
        if (!d.zones || !d.image || d.image === "none" || d.image === "background") return;
        const imgSize = d.imageSize || 35;
        const imgCols = Math.ceil(60 * imgSize / 100);
        d.zones.forEach(z => {
          if (typeof z.col !== "number" || typeof z.span !== "number") return;
          const zEnd = z.col + z.span;
          if (d.image === "right") {
            const boundary = 60 - imgCols;
            if (zEnd > boundary) {
              const oldSpan = z.span;
              z.span = Math.max(10, boundary - z.col);
              if (z.span < 10) { z.col = Math.max(0, boundary - 20); z.span = 20; }
              process.stderr.write(`  ${amber("⚠")} Slide ${d.slide}: zone "${z.role}" span ${oldSpan}→${z.span} (avoiding right image)\n`);
            }
          } else if (d.image === "left") {
            if (z.col < imgCols) {
              const oldCol = z.col;
              z.col = imgCols + 1;
              if (z.col + z.span > 60) z.span = 59 - z.col;
              process.stderr.write(`  ${amber("⚠")} Slide ${d.slide}: zone "${z.role}" col ${oldCol}→${z.col} (avoiding left image)\n`);
            }
          } else if (d.image === "inset-tr") {
            if (z.col + z.span > 44 && (z.row || 0) < 12) {
              z.span = Math.max(10, 44 - z.col);
            }
          } else if (d.image === "inset-bl") {
            if (z.col < 16 && (z.row || 0) + (z.rowSpan || 10) > 28) {
              z.col = 16;
              if (z.col + z.span > 60) z.span = 59 - z.col;
            }
          }
        });
      });
    }
  }

  function mergeDirectivesWithSlides(batchSlides, directives) {
    return batchSlides.map((src, j) => {
      const d = directives[j] || {};
      const parts = [];
      if (d.zones && Array.isArray(d.zones) && d.zones.length > 0) {
        const designObj = {};
        if (d.zones) designObj.zones = d.zones;
        if (d.accents) designObj.accents = d.accents;
        if (d.typography) designObj.typography = d.typography;
        if (d.bg) designObj.bg = d.bg.replace(/^#/, "");
        if (d.font) designObj.font = d.font;
        parts.push(`<!-- design: ${JSON.stringify(designObj)} -->`);
      } else if (d.layout) {
        parts.push(`<!-- layout: ${d.layout} -->`);
        if (d.bg) parts.push(`<!-- bg: ${d.bg.replace(/^#/, "")} -->`);
        if (d.font) parts.push(`<!-- font: ${d.font} -->`);
      }
      if (d.image && d.image !== "none") {
        parts.push(`<!-- image: ${d.image}${d.imageSize ? " " + d.imageSize : ""} -->`);
      }
      if (d.label) parts.push(`### ${d.label}`);
      parts.push(src.trim());
      return parts.join("\n");
    });
  }

  async function processBatch(i, batchNum, useSession) {
    const batchPath = path.join(workDir, `slide-${String(batchNum).padStart(2, "0")}.md`);

    if (fs.existsSync(batchPath)) {
      const cached = fs.readFileSync(batchPath, "utf-8");
      if (perSlide) {
        if (batchNum === 1 || batchNum === total) {
          process.stderr.write(`  ${sage("✓")} Slide ${batchNum}/${total} ${dim("(cached)")}\n`);
        } else if (batchNum === 2) {
          process.stderr.write(`  ${sage("✓")} Slides 2-${total - 1} ${dim("(cached, checking...)")}\n`);
        }
      } else {
        process.stderr.write(`  ${sage("✓")} Batch ${batchNum}: slides ${i + 1}-${Math.min(i + batchSize, total)} ${dim("(cached)")}\n`);
      }
      return { index: batchNum - 1, output: cached, ok: true };
    }

    const batchSlides = sourceSlides.slice(i, i + batchSize);
    const batchEnd = Math.min(i + batchSize, total);
    const slideSummaries = buildSlideSummaries(batchSlides, i);

    // In sequential mode, use session continuity + batch context
    // In parallel mode, each batch gets the full prompt independently
    let batchPrompt;
    if (useSession && sessionId) {
      const batchContext = buildBatchContext(slideDesigns);
      const continueNote = intensity === "maximal"
        ? "UNIQUE compositions — different zone positions, extreme type scales, bold accents. No repeats."
        : intensity === "minimal"
        ? "Maintain restraint — consistent margins, quiet precision, no accents."
        : "Continue editorial variety — vary zone positions, type sizes, accents.";
      batchPrompt = `Next slides (${continueNote}):
${batchContext}

${slideSummaries}

JSON objects, one per line:`;
    } else {
      const batchContext = useSession ? buildBatchContext(slideDesigns) : "";
      batchPrompt = buildFullPrompt(slideSummaries, batchContext);
    }

    if (perSlide) {
      process.stderr.write(`  ${amber("⟐")} Slide ${batchNum}/${total}...`);
    } else {
      process.stderr.write(`  ${amber("⟐")} Batch ${batchNum}: slides ${i + 1}-${batchEnd}...`);
    }

    try {
      const raw = await callClaudeWithRetry(batchPrompt, {
        model,
        label: perSlide ? `slide-${batchNum}` : `batch-${batchNum}`,
        resume: useSession ? sessionId : undefined,
        maxRetries: 3,
        baseDelay: 10,
      });
      let cleaned = raw.trim();
      // Always strip session prefix (present in both parallel and sequential modes)
      const sessionMatch = cleaned.match(/^__SESSION:(.*?)__/);
      if (sessionMatch) {
        if (useSession) sessionId = sessionMatch[1];
        cleaned = cleaned.replace(/^__SESSION:.*?__/, "");
      }
      if (/^```/.test(cleaned)) cleaned = cleaned.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");

      let directives;
      try {
        // Try parsing as a JSON array first
        const trimmed = cleaned.trim();
        const arrStart = trimmed.indexOf("[");
        const arrEnd = trimmed.lastIndexOf("]");
        if (arrStart >= 0 && arrEnd > arrStart && arrStart < 5) {
          directives = JSON.parse(trimmed.slice(arrStart, arrEnd + 1));
        } else if (trimmed.startsWith("{")) {
          // Single object or one-per-line
          const lines = trimmed.split("\n").filter(l => l.trim().startsWith("{"));
          directives = lines.map(l => JSON.parse(l));
        } else {
          // Try to find JSON object(s) anywhere in the text
          throw new Error("no leading JSON");
        }
      } catch {
        // Robust fallback: find balanced JSON objects using brace counting
        directives = [];
        let depth = 0, start = -1;
        for (let ci = 0; ci < cleaned.length; ci++) {
          if (cleaned[ci] === "{") { if (depth === 0) start = ci; depth++; }
          else if (cleaned[ci] === "}") {
            depth--;
            if (depth === 0 && start >= 0) {
              try { directives.push(JSON.parse(cleaned.slice(start, ci + 1))); } catch { /* skip */ }
              start = -1;
            }
          }
        }
      }

      postProcessDirectives(directives);
      const mergedSlides = mergeDirectivesWithSlides(batchSlides, directives);
      const mergedOutput = mergedSlides.join("\n\n---\n\n");
      fs.writeFileSync(batchPath, mergedOutput);

      process.stderr.write(` ${sage("✓")}\n`);
      return { index: batchNum - 1, output: mergedOutput, ok: true };
    } catch (err) {
      process.stderr.write(` ${accent("✗")} ${err.message.split("\n")[0].slice(0, 60)}\n`);
      const fallback = batchSlides.map((s) => `<!-- layout: split -->\n${s.trim()}`).join("\n\n---\n\n");
      return { index: batchNum - 1, output: fallback, ok: false };
    }
  }

  // ── Execute batches ──
  const totalBatches = Math.ceil(total / batchSize);
  const useParallel = parallel > 1 && totalBatches > 1;

  if (useParallel) {
    process.stderr.write(`  ${dim("  Parallel mode:")} ${Math.min(parallel, totalBatches)} concurrent batches\n`);

    // Build all batch tasks
    const tasks = [];
    for (let i = 0; i < total; i += batchSize) {
      const batchNum = Math.floor(i / batchSize) + 1;
      const offset = i;
      tasks.push(() => processBatch(offset, batchNum, false));
    }

    // Run with concurrency pool
    let taskIdx = 0;
    async function worker() {
      while (taskIdx < tasks.length) {
        const t = taskIdx++;
        const result = await tasks[t]();
        // Place in correct order
        slideDesigns[result.index] = result.output;
        if (result.ok) completed++; else failed++;
      }
    }
    const workers = Array.from({ length: Math.min(parallel, tasks.length) }, () => worker());
    await Promise.all(workers);

    // Compact slideDesigns (remove any undefined gaps from cached ordering)
    const ordered = [];
    for (let b = 0; b < totalBatches; b++) {
      if (slideDesigns[b]) ordered.push(slideDesigns[b]);
    }
    slideDesigns.length = 0;
    ordered.forEach(s => slideDesigns.push(s));

  } else {
    // Sequential mode — use session continuity for coherence
    for (let i = 0; i < total; i += batchSize) {
      const batchNum = Math.floor(i / batchSize) + 1;
      const result = await processBatch(i, batchNum, true);
      slideDesigns.push(result.output);
      if (result.ok) completed++; else failed++;

      // Brief pause between sequential calls to avoid rate limiting
      if (i + batchSize < total) await new Promise(r => setTimeout(r, 1000));
    }
  }

  process.stderr.write(`  ${completed === total ? sage("✓") : amber("⚠")} Stage 2: ${completed}/${total} slides designed (${failed} batch failures)\n`);

  // Stop background renderer before final render — set flag to prevent late writes
  if (bgRenderer) clearInterval(bgRenderer);
  bgRenderer = null; // Signal to any pending callback not to write

  // ── STAGE 3: Final assembly ─────────────────────
  process.stderr.write(`\n  ${amber("○")} Stage 3: Assembling ${teal(composedPath)}...\n`);
  const finalAssembled = designPlanComment + "\n\n" + slideDesigns.join("\n\n---\n\n");
  fs.writeFileSync(composedPath, finalAssembled);
  process.stderr.write(`  ${sage("✓")} Stage 3: ${completed} slides assembled\n`);

  if (options.dryRun) {
    return { slides: total, output: composedPath, dryRun: true, designSystem, workDir };
  }

  // ── STAGE 4: Final render ───────────────────────
  process.stderr.write(`  ${amber("○")} Stage 4: Rendering...\n`);
  const renderer = outputPath.endsWith(".html") ? generateHTML : generate;
  const result = await renderer(composedPath, outputPath, {
    theme: options.theme,
    ratio: options.ratio,
  });

  process.stderr.write(`  ${sage("✓")} Stage 4: ${chalk.white.bold(result.slides)} slides → ${teal(result.output)}\n`);

  // ── STAGE 5: Images (optional) ──────────────────
  if (options.withImages && outputPath.endsWith(".html")) {
    // Use existing images directory if provided, otherwise generate
    const imagesDir = options.imagesDir || path.join(workDir, "images");
    const hasExistingImages = fs.existsSync(imagesDir) &&
      fs.readdirSync(imagesDir).some(f => /^slide-\d+\.png$/.test(f));

    if (hasExistingImages && !options.imagesDir) {
      const existing = fs.readdirSync(imagesDir).filter(f => /^slide-\d+\.png$/.test(f)).length;
      process.stderr.write(`\n  ${sage("✓")} Stage 5a: ${existing} existing images in ${teal(path.basename(imagesDir))}\n`);
    } else if (options.imagesDir) {
      const existing = hasExistingImages ? fs.readdirSync(imagesDir).filter(f => /^slide-\d+\.png$/.test(f)).length : 0;
      process.stderr.write(`\n  ${sage("✓")} Stage 5a: Using ${existing} images from ${teal(options.imagesDir)}\n`);
    } else {
      process.stderr.write(`\n  ${amber("○")} Stage 5a: Generating images...\n`);
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    }

    try {
      // 5a: Generate images via imagine.js (skips existing, uses Midjourney by default)
      if (!options.imagesDir) {
        const { imagine } = require("./imagine.js");
        const imageStyle = options.imageStyle || "swiss-poster";
        const imageResult = await imagine(composedPath, {
          style: imageStyle,
          generate: true,
          model: options.model,
          outputDir: imagesDir,
          slides: options.imageSlides,
        });
        process.stderr.write(`  ${sage("✓")} Stage 5a: ${imageResult.generated || 0} images generated\n`);
      }

      // 5b: Splice images into HTML
      const imgCount = fs.readdirSync(imagesDir).filter(f => /^slide-\d+\.png$/.test(f)).length;
      if (imgCount > 0) {
        const composedContent = fs.readFileSync(composedPath, "utf-8");
        const imageDirectives = [];
        const slideChunks = composedContent.split(/\n---\n/).filter(s => s.trim());
        slideChunks.forEach((chunk, idx) => {
          const imgMatch = chunk.match(/<!--\s*image:\s*(\S+)(?:\s+(\d+))?\s*-->/);
          if (imgMatch) {
            imageDirectives.push({ slide: idx + 1, mode: imgMatch[1], size: parseInt(imgMatch[2] || "40", 10) });
          } else {
            imageDirectives.push({ slide: idx + 1, mode: "none" });
          }
        });

        const hasPlacement = imageDirectives.some(d => d.mode !== "none");

        process.stderr.write(`  ${amber("○")} Stage 5b: Splicing images into HTML...\n`);
        const { spliceImages } = require("./splice-images.js");
        // Pass pre-computed plan if available, otherwise let Claude decide
        const splicedHTML = spliceImages(outputPath, imagesDir, {
          model: options.model,
          plan: hasPlacement ? imageDirectives : undefined,
          imageScale: options.imageScale || "subtle",
        });
        if (splicedHTML) {
          fs.writeFileSync(outputPath, splicedHTML);
          process.stderr.write(`  ${sage("✓")} Stage 5b: Images spliced into ${teal(outputPath)}\n`);
        } else {
          process.stderr.write(`  ${amber("⚠")} Stage 5b: Splice returned no output\n`);
        }
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
    designSystem: getFlag("--design-system"),
    dryRun: args.includes("--dry-run"),
    incremental: args.includes("--incremental"),
    batchSize: parseInt(getFlag("--batch-size") || "1", 10),
    parallel: parseInt(getFlag("--parallel") || "1", 10),
    withImages: args.includes("--with-images") || !!getFlag("--images-dir"),
    imagesDir: getFlag("--images-dir"),
    imageStyle: getFlag("--image-style"),
    imageSlides: getFlag("--image-slides"),
    imageScale: getFlag("--image-scale") || "subtle",
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

module.exports = { compose, composeAsync, composeIncremental, buildPrompt, callClaude, callClaudeAsync, callClaudeWithRetry, sanitizeClaudeOutput, parseDirectives, assembleComposed, DESIGN_BRIEF, DESIGN_MOODS, INTENSITY };
