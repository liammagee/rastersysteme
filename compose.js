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
const { generate, parseMarkdown } = require("./raster.js");

const dim = chalk.gray;
const accent = chalk.hex("#C44230");
const teal = chalk.hex("#2C7A92");
const sage = chalk.hex("#548C5A");
const amber = chalk.hex("#C79B38");

// ═══════════════════════════════════════════════════════
// DESIGN VOCABULARY — the prompt that teaches Claude
// to think like a Swiss / New Wave art director
// ═══════════════════════════════════════════════════════

const DESIGN_BRIEF = `You are an art director with deep knowledge of 20th-century Swiss graphic design and its New Wave evolution. You compose slides on a 60-column modular grid.

THE TRADITION:

The Swiss International Typographic Style emerged from two distinct schools in the 1950s. In Zurich, Josef Müller-Brockmann, Carlo Vivarelli, and Richard Paul Lohse developed mathematical proportioning systems — the grid as democratic structure, objectivity as ethical position, visual noise eliminated in favor of pure communication. Müller-Brockmann's Musica Viva concert posters proved that within rigid grid constraints, enormous visual tension and energy are possible: a circle cropped by the frame edge, a diagonal bisecting the field, color applied with surgical precision.

In Basel, Emil Ruder and Armin Hofmann taught typography as spatial architecture. Every letterform occupies and activates the space around it. Every interval between letters, every line break, every margin is an active decision. Ruder's "Typographie" demonstrated that a single word, set in the right weight at the right scale on the right field, is a complete composition.

THE 60-COLUMN HORIZONTAL GRID:

The slide is divided into 60 HORIZONTAL columns across the width, plus 40 rows down the height. This is NOT a 10×6 cell grid — it is 60 fine vertical divisions spanning the full slide width. Think of it like a typesetter's em-grid: elements snap to column positions (0–59), spanning any number of columns.

Key subdivisions: ÷12 gives 5 equal zones (the primary rhythm). ÷5 gives 12 narrow columns. ÷2 splits the slide in half at column 30. The 13 layouts use these subdivisions differently — "split" uses a 22/33 column asymmetric pair, "rotated" uses 13/40, "stagger" cascades diagonally across columns.

60 divides by 2, 3, 4, 5, 6, 10, 12, 15, 20, and 30 — one system for any subdivision.

THE EVOLUTION:

Wolfgang Weingart, trained by Ruder and Hofmann at Basel, internalized the Swiss rules completely before transgressing them. His experiments in the 1970s were never random — stepped letterpress type where each line shifts horizontally, reversed-out blocks nested inside blocks, letterspacing blown to extremes then collapsed back, halftone screens layered at conflicting angles. He called it "doing things that were not allowed" but insisted that transgression without competence is noise. His Basel posters layer typographic elements at conflicting angles, deploy scale jumps from 8pt to 72pt within a single composition, and treat the rectangular field as an arena of opposing forces rather than a neutral container.

Dan Friedman extended this into "radical modernism" — deconstructing Swiss clarity while retaining its structural ambition. April Greiman brought it to Los Angeles with early digital layering: transparency, collage, type treated as texture and image simultaneously, the screen as landscape rather than page. Willi Kunz applied deconstructed Swiss principles to complex information hierarchies, proving that fragmented layouts could communicate *more* clearly than conventional ones when the fragmentation follows the content's own internal logic.

What connects the entire lineage: the grid is always present, even — especially — when violated. Structure is acknowledged in the act of breaking it. The cultivated accident is never accidental.

WHAT DISTINGUISHES SOPHISTICATED COMPOSITION FROM NAIVE:

Restraint. Not every slide should be loud. A quiet split layout after an aggressive stagger creates meaning through contrast. The loudest moment in a presentation is the silence after noise. If you have thirty slides, perhaps five should be visually intense — the rest should be precisely controlled.

Typographic scale. The relationship between a 40pt title, an 8pt small-caps section label, and 13pt body text IS the information hierarchy. Extreme size contrast — Weingart's signature — works because the disparity is deliberate and structurally motivated, not decorative. When everything is set large, nothing is emphasized. Use ### section labels (8pt, letterspaced) against # titles (30–40pt) constantly — this is the Swiss typographic texture that separates serious design from PowerPoint defaults.

Color as argument. A palette has a logic — it builds a chromatic arc through the deck, not random variety. Use <!-- bg: HEX --> overrides to give each thematic section its own tonal identity. The CREATIVE DIRECTION below specifies which colors to use for this particular run. Follow it — the mood determines the palette.

Rhythm and pacing. The sequence of layouts is a musical score. Dense-sparse-dense. Loud-quiet-loud. Fragment-breath-section. Stagger-blank-rotated. The audience feels this rhythm before they read the content. Three section slides in succession is monotonous. Two blank slides back-to-back is dead air. A stagger followed by a blank followed by a quiet split is a phrase.

Productive tension. The best Swiss and post-Swiss design lives in controlled opposition: order vs. disruption, large vs. small, dark field vs. light field, horizontal reading axis vs. diagonal energy, dense information vs. empty space. Weingart's posters work because they hold opposing formal forces in equilibrium. A rotated title bar fighting against horizontal body text. A vermillion section slide interrupting a sequence of warm whites. An arc layout's geometric calm after a fragmented mosaic.

LAYOUTS — assign one to every slide via <!-- layout: name -->

  title    — Red accent block (24 cols) anchoring the top-left quadrant. Topic pills cascade at right.
             The declaration slide. Use once, at most twice. Its authority comes from scarcity.
             Effective when: opening a deck, establishing the central thesis.

  section  — Full dark background, large centered white type. One idea fills the frame.
             Ruder's principle: a single phrase at the right scale IS a complete composition.
             Effective when: transitions, chapter headings, rhetorical questions, provocations.
             Pair with: blank slides before or after, to give the statement room to resonate.

  bullets  — Numbered list with colored accent dots. Clean, orderly, rational.
             The most conventional layout — use sparingly and only when true enumeration
             is needed. If the items could be a stagger or fragment, prefer those.
             Effective when: ordered sequences, ranked priorities, stepwise processes.

  stagger  — Cascading colored bars, each stepping right and down on the diagonal.
             Musica Viva energy — each item enters the composition like an instrument
             joining an ensemble. The diagonal creates kinetic force against the horizontal grid.
             Effective when: parallel ideas building toward a point, escalation, accumulation.
             Poor when: items have no progressive or additive relationship.

  split    — Left zone (22 cols) for title/label. Right zone for body content.
             The classic Swiss two-column structure. Tension lives in the gutter between zones.
             Effective when: definition, argument + evidence, concept + elaboration.
             Use ### labels in the left zone for Kunz-style typographic texture.

  rotated  — 13-col vertical bar at left with title rotated 270°. Content floats at right.
             Direct Weingart influence. The rotated type becomes architecture — it activates
             the slide plane differently than horizontal text, forcing a perceptual shift.
             Effective when: the title is a statement worth spatializing, when you need
             to disrupt a sequence of horizontal layouts. The rotation should feel earned.
             Pairs well after: split or bullets (the sudden angle jolts the eye).

  fragment — Mosaic of colored blocks, non-hierarchical, shattered, democratic.
             Greiman's digital collage principle applied to information: many elements of
             equal visual weight. The fragmentation is not chaos — it follows the content's
             internal structure.
             Effective when: taxonomies, inventories, options, many parallel items.

  overlap  — Two translucent color fields intersecting at mid-slide, creating a third zone.
             Dialectic made visible. Content split across the fields should mirror a real
             conceptual opposition or complementarity.
             Effective when: comparing, contrasting, thesis vs. antithesis, two forces in tension.

  arc      — Concentric circles at right, text anchored at left.
             Müller-Brockmann's geometric vocabulary — circles cropped by the frame edge.
             A contemplative, meditative layout that slows the deck's tempo.
             Effective when: process, convergence, synthesis, a core idea radiating outward.

  blank    — Empty slide. Silence. Visual fermata. Always structural, never decorative.
             Effective when: after dense or loud slides, before major transitions, when the
             audience needs a beat to absorb. A blank slide between two section slides
             creates a three-part phrase: statement — breath — statement.

MARKDOWN SYNTAX — your output must use exactly this format:

  Slides separated by ---
  # Title          → main title text (this renders at 28–40pt — use for maximum scale)
  ## Subtitle      → secondary text (~18–24pt)
  ### LABEL        → small-caps section label (8pt, wide letterspacing — the Kunz texture)
  - bullet         → list item
    - nested       → indented sub-bullet (2-space indent = 1 level)
  > quote          → blockquote / callout
  <!-- layout: X -->   → REQUIRED on every slide
  <!-- bg: HEX -->     → background color override (6-char hex, no #)
  <!-- font: Name -->  → per-slide font override (default: Helvetica Neue)
  <!-- style: k=v; k=v -->  → per-slide visual overrides:
      title-size=48          → title font size in px (default: dynamic)
      body-size=14           → body/subtitle font size in px
      spacing=tight|loose|none → gap between elements
      padding=tight|loose|none → slide padding
      letter-spacing=0.1em   → tracking override
      text-transform=uppercase → force uppercase
      opacity=0.9            → slide opacity
      Any CSS property=value → passed through directly

  BACKGROUND COLOURS — you can use ANY valid 6-digit hex colour.
    Invent your own palette for each deck. Some starting points if needed:
    Dark:  0A1628, 1C1C1C, 0D2137, 1A2E1A, 2B0E0E
    Mid:   3E2723, 2A4858, 4A3728, 5B3A29
    Light: F5E6D0, EAF0E8, F0F4F8, FFF8E7
    But PREFER to choose your own colours that match the mood you're creating.

  FONT OPTIONS — use <!-- font: Name --> for typographic contrast:
    Georgia            → serif, editorial warmth (blockquotes, reflective slides)
    Palatino           → classical serif (formal content, policies)
    Courier New        → monospace (data, technical content, code-adjacent)
    Futura             → geometric sans (modernist statements)
    Helvetica Neue     → default neo-grotesque (the Swiss baseline)

  Using font overrides on 10–30% of slides creates typographic texture.
  A serif slide after 5 sans slides is a visual event.

  For speaker notes, use a fenced code block with the language tag "notes":
  three backticks + notes, then content, then three closing backticks.
  Use these for brief design rationale on key slides.

RULES (apply to all intensity levels):

  1. Output ONLY the markdown. No commentary, no preamble, no code fences. Raw slides.
  2. Every slide MUST have a <!-- layout: name --> directive as its first line.
  3. Do NOT invent facts, URLs, dates, or data. Content comes from the source only.
     You MAY rephrase and restructure as the intensity level permits.
  4. Speaker notes from the source MUST be preserved. You may redistribute them
     across slides and append design rationale.
  5. Never use the same layout three times consecutively.
  6. ALL substantive information must survive: URLs, emails, dates, percentages,
     names, criteria, policies. Nothing dropped — only restructured.

  Content handling varies by intensity level — see INTENSITY section below.`;

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
  minimal: `INTENSITY: MINIMAL — The Müller-Brockmann position

SLIDE COUNT: Output EXACTLY as many slides as the source. One source slide = one output slide.
Do NOT add blank slides. Do NOT split, merge, or restructure. The content is fixed.

WHAT YOU CONTROL:
- Layout selection: pick the best layout per slide's content structure.
  3 bullets → "bullets". A quote → "rotated". Title only → "section".
  Dense bullets (4+) → "stagger". Title + body → "split".
- ### section labels: add sparingly, derived from the content's themes.
- bg overrides: no more than 30% of slides. Restrained palette — 2-3 colours max.
- Font: Helvetica Neue only. No font overrides. No style overrides.
- No layout used more than 25% of the time.

The result: the same content, poured into a Swiss grid. Clean and restrained.`,

  moderate: `INTENSITY: MODERATE — The Gerstner position

SLIDE COUNT: Output EXACTLY as many slides as the source. One source slide = one output slide.
Do NOT add blank slides. Do NOT split, merge, or restructure. The content is fixed.

WHAT YOU CONTROL — you must DESIGN an original visual system:
- Layout selection: use at least 5 different layout types. No layout > 30%.
  Reach for stagger, rotated, fragment, overlap — not just split and bullets.
- ### section labels: add to most slides for typographic scale contrast.
- COLOUR: INVENT a 3–5 colour palette. Choose your own hex values.
  Use bg overrides on 30–60% of slides to build a chromatic arc.
- FONT: choose 1 secondary typeface for contrast on 2–3 slides.
  Options: Georgia, Palatino, Courier New, Futura.
- <!-- style: ... --> overrides on 3–5 slides for typographic variety.

The result: the same slides, with a designed visual identity.`,

  maximal: `INTENSITY: MAXIMAL — The Weingart position

SLIDE COUNT: Output EXACTLY as many slides as the source. One source slide = one output slide.
Do NOT add blank slides. Do NOT split, merge, or restructure. The content is fixed.
The design is radical. The structure is not.

WHAT YOU CONTROL — you must create an ORIGINAL design system:
- Layout selection: use at least 8 different types. No layout > 20%.
  "split" may not exceed 15%.
  REQUIRED: 2× stagger, 2× rotated, 1× fragment, 1× overlap.
- ### section labels: on 60%+ of slides. The 8pt label vs 30pt title
  IS the primary tension.
- COLOUR: INVENT a 5–8 colour palette. Choose your own hex values.
  Do NOT reuse examples. Use bg overrides on 50–80% of slides.
  Build a full chromatic arc with beginning, climax, and resolution.
- FONT: choose 2-3 typefaces, each with a specific role.
  Use font overrides on 15–25% of slides.
- STYLE OVERRIDES: use <!-- style: ... --> on 30%+ of slides.
  title-size=72 on statements. spacing=tight on dense slides.
  letter-spacing=0.15em on labels. text-transform=uppercase on declarations.
  Each slide should feel individually designed.

The result: the same content, made unrecognisable through radical form.`,
};

// ═══════════════════════════════════════════════════════
// DESIGN SEEDS — random compositional emphasis per run
// ═══════════════════════════════════════════════════════

const DESIGN_SEEDS = [
  "Lead with the rotated layout — vertical type as primary structural intervention. Let horizontal slides feel like the exception.",
  "Let fragment mosaics dominate the middle section. Shatter content into democratic blocks where hierarchy would be false.",
  "Push typographic scale to extremes: 8pt labels directly adjacent to 40pt titles. The tension between registers IS the design.",
  "Build the chromatic arc from near-black to warm white across the deck, with a single vermillion moment at the rhetorical peak.",
  "Favor overlap layouts for every conceptual tension. Where two ideas coexist, make the overlap visible. Use arc for convergence.",
  "Deploy blank slides aggressively — silence between every major statement. The deck should breathe like Webern, not Mahler.",
  "Let the stagger cascade carry the main narrative thread. Section slides are chapter markers; everything else cascades diagonally.",
  "Use deep navy as the dominant field for 60%+ of slides. Warm off-white is the exception — content that earns lightness.",
  "Alternate between dense and sparse relentlessly. A 6-bullet stagger followed by a single-word section followed by a blank. Rhythm as argument.",
  "Treat every ### section label as the real content — the titles are architecture, the labels are where the reader's eye should land first.",
  "Open with maximum austerity — near-black, minimal text. Let the deck warm gradually, arriving at the richest color only at the close.",
  "Use the split layout as the backbone — left zone anchors identity, right zone delivers content. Disrupt with rotated or fragment only twice.",
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

  // Pre-split source into numbered slides
  const sourceSlides = markdown.split(/\n---\n/).filter(s => s.trim());
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
Mood: [name the aesthetic — invent it, don't pick from a list]
Palette: [5-8 hex colours YOU chose for this deck, e.g. "0A1628 (ink night), D4A574 (sand), 8B2500 (rust), F5E6D0 (linen), 2D4A3E (moss)"]
Chromatic arc: [which palette colours appear on which slides, in sequence]
Layout rhythm: [the full layout sequence — aim for maximum variety]
Font strategy: [which typeface on which slides and WHY — tied to content meaning]
Key moments: [2-3 slides that are the visual climax — different layout, different colour, different font]
Density plan: [which slides are dense, which are sparse, where the contrast hits]
-->

═══ PHASE 2: SLIDE OUTPUT ═══
Output EXACTLY ${sourceSlides.length} slides — one for each source slide, in the same order.
The content of each slide is FIXED. Your design plan above determines the visual treatment.

For each of the ${sourceSlides.length} slides:
1. <!-- layout: name --> as the FIRST line (from your layout rhythm above)
2. <!-- bg: HEX --> if your chromatic arc calls for it
3. <!-- font: Name --> if your font strategy calls for it
4. <!-- style: key=value --> for typographic overrides (if intensity permits)
5. ### SECTION LABEL for typographic texture where appropriate
6. The slide's EXACT content from the source — unchanged, no rephrasing
7. Speaker notes preserved verbatim (you may append design rationale)

Do NOT add extra slides. Do NOT remove slides. Do NOT add blank slides.
The output must have EXACTLY ${sourceSlides.length} slides separated by ---.

CRITICAL: Your first output line must be <!-- DESIGN PLAN.
After the plan comment, output exactly ${sourceSlides.length} slides starting with <!-- layout:.
No other commentary, no code fences.`);

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

    const heartbeat = setInterval(() => {
      si = (si + 1) % spin.length;
      const charInfo = chars > 0 ? ` ${amber(chars + " chars")}` : "";
      const modelInfo = model ? ` ${dim(model)}` : "";
      process.stderr.write(`\r  ${dim("[")}${accent(label)}${dim("]")} ${teal(spin[si])} ${dim(phase)} ${amber(el() + "s")}${charInfo}${modelInfo}   `);
    }, 250);

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
            process.stderr.write(`\r  ${dim("[")}${accent(label)}${dim("]")} ${teal(model)} ${amber(el() + "s")}       \n`);
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
              process.stderr.write(`\r  ${dim("[")}${accent(label)}${dim("]")} ${dim("tokens:")} ${amber(inp + "in " + out + "out")}${cached ? dim(" (" + cached + " cached)") : ""} ${cost ? dim(cost) : ""}       \n`);
            }
          }
        } catch { /* skip */ }
      }
    });
    let stderrBuf = "";
    proc.stderr.on("data", (d) => { stderrBuf += d.toString(); });
    proc.stdin.write(prompt);
    proc.stdin.end();

    const timeout = setTimeout(() => {
      clearInterval(heartbeat);
      proc.kill();
      reject(new Error("Claude timed out after 10 minutes"));
    }, 600000);

    proc.on("close", (code) => {
      clearInterval(heartbeat);
      clearTimeout(timeout);
      const totalEl = ((Date.now() - startTime) / 1000).toFixed(1);

      // Log to persistent file
      const logDir = path.join(__dirname, "logs");
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const logFile = path.join(logDir, `claude-${label}-${ts}.log`);
      const logData = [
        `timestamp: ${new Date().toISOString()}`,
        `label: ${label}`,
        `model: ${model || options.model || "default"}`,
        `exit_code: ${code}`,
        `chars: ${chars}`,
        `elapsed: ${totalEl}s`,
        `result_length: ${resultText.length}`,
        stderrBuf ? `stderr:\n${stderrBuf}` : "stderr: (empty)",
        `---`,
        resultText ? `result (first 500 chars):\n${resultText.slice(0, 500)}` : "result: (empty)",
      ].join("\n");
      try { fs.writeFileSync(logFile, logData); } catch { /* best effort */ }

      if (code !== 0) {
        const errMsg = stderrBuf.trim() || `exit code ${code}`;
        process.stderr.write(`\r  ${dim("[")}${accent(label)}${dim("]")} ${accent("✗")} ${errMsg.split("\n")[0].slice(0, 100)} ${amber(totalEl + "s")}       \n`);
        process.stderr.write(`  ${dim("Log:")} ${teal(logFile)}\n`);
        return reject(new Error(`Claude [${label}] failed (code ${code}): ${errMsg.split("\n")[0]}`));
      }

      if (!resultText) {
        process.stderr.write(`\r  ${dim("[")}${accent(label)}${dim("]")} ${accent("✗")} empty response ${amber(totalEl + "s")}       \n`);
        process.stderr.write(`  ${dim("Log:")} ${teal(logFile)}\n`);
        return reject(new Error(`Claude [${label}] returned empty response after ${totalEl}s`));
      }

      process.stderr.write(`\r  ${dim("[")}${accent(label)}${dim("]")} ${sage("✓")} ${chalk.white.bold(chars)} chars ${amber(totalEl + "s")}       \n`);
      resolve(resultText);
    });

    proc.on("error", (err) => {
      clearInterval(heartbeat);
      clearTimeout(timeout);
      if (err.code === "ENOENT") {
        return reject(new Error("Claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code"));
      }
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

  const layoutIdx = output.indexOf("<!-- layout:");
  if (layoutIdx < 0) {
    throw new Error("Claude did not return valid slide markdown (no <!-- layout: --> directives found).");
  }
  // Strip preamble text but keep HTML comments (design plans, etc.)
  if (layoutIdx > 0) {
    const beforeLayout = output.substring(0, layoutIdx);
    const comments = beforeLayout.match(/<!--[\s\S]*?-->/g) || [];
    output = comments.join("\n\n") + "\n\n" + output.substring(layoutIdx);
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

  const composedPath = outputPath.replace(/\.pptx$/, ".composed.md");
  fs.writeFileSync(composedPath, composed);
  process.stderr.write(`  ${dim("[")}${accent(intensity)}${dim("]")} → ${teal(composedPath)}\n`);

  if (options.dryRun) {
    return { slides: 0, output: composedPath, dryRun: true };
  }

  const result = await generate(composedPath, outputPath, {
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
  const composedPath = outputPath.replace(/\.pptx$/, ".composed.md");
  fs.writeFileSync(composedPath, composed);
  process.stderr.write(`  ${dim("Composed →")} ${teal(composedPath)}\n`);

  if (options.dryRun) {
    process.stdout.write(composed + "\n");
    return { slides: 0, output: composedPath, dryRun: true };
  }

  // Render via rastersysteme
  const result = await generate(composedPath, outputPath, {
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
    --dry-run              Output composed markdown to stdout, skip render
    --model <model>        Claude model override
    --help                 Show this help

  Examples:
    node compose.js talk.md
    node compose.js talk.md deck.pptx --theme dark --intensity maximal
    node compose.js notes.md --brief "brutalist, maximum contrast" --dry-run
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
      : input.replace(/\.md$/, ".pptx");

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
    dryRun: args.includes("--dry-run"),
  };

  if (!fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  compose(input, output, options).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { compose, composeAsync, buildPrompt, callClaude, callClaudeAsync, sanitizeClaudeOutput, DESIGN_BRIEF, DESIGN_MOODS, INTENSITY };
