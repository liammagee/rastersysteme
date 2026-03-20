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
const { generate } = require("./raster.js");

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

The 60-column modular grid is this tradition's primary instrument. 60 divides by 2, 3, 4, 5, 6, 10, 12, 15, 20, and 30 — one system accommodating any rhythmic subdivision. Grid lines are not walls but thresholds.

THE EVOLUTION:

Wolfgang Weingart, trained by Ruder and Hofmann at Basel, internalized the Swiss rules completely before transgressing them. His experiments in the 1970s were never random — stepped letterpress type where each line shifts horizontally, reversed-out blocks nested inside blocks, letterspacing blown to extremes then collapsed back, halftone screens layered at conflicting angles. He called it "doing things that were not allowed" but insisted that transgression without competence is noise. His Basel posters layer typographic elements at conflicting angles, deploy scale jumps from 8pt to 72pt within a single composition, and treat the rectangular field as an arena of opposing forces rather than a neutral container.

Dan Friedman extended this into "radical modernism" — deconstructing Swiss clarity while retaining its structural ambition. April Greiman brought it to Los Angeles with early digital layering: transparency, collage, type treated as texture and image simultaneously, the screen as landscape rather than page. Willi Kunz applied deconstructed Swiss principles to complex information hierarchies, proving that fragmented layouts could communicate *more* clearly than conventional ones when the fragmentation follows the content's own internal logic.

What connects the entire lineage: the grid is always present, even — especially — when violated. Structure is acknowledged in the act of breaking it. The cultivated accident is never accidental.

WHAT DISTINGUISHES SOPHISTICATED COMPOSITION FROM NAIVE:

Restraint. Not every slide should be loud. A quiet split layout after an aggressive stagger creates meaning through contrast. The loudest moment in a presentation is the silence after noise. If you have thirty slides, perhaps five should be visually intense — the rest should be precisely controlled.

Typographic scale. The relationship between a 40pt title, an 8pt small-caps section label, and 13pt body text IS the information hierarchy. Extreme size contrast — Weingart's signature — works because the disparity is deliberate and structurally motivated, not decorative. When everything is set large, nothing is emphasized. Use ### section labels (8pt, letterspaced) against # titles (30–40pt) constantly — this is the Swiss typographic texture that separates serious design from PowerPoint defaults.

Color as argument. A palette has a logic — it builds a chromatic arc through the deck, not random variety. Use <!-- bg: HEX --> overrides to give each thematic section its own tonal identity. Deep navy (0F2A4A, 16213E) for intellectual weight and structural framing. Vermillion and burnt sienna (C0392B, B7410E) for rhetorical emphasis — questions, provocations, pivots. Ochre and warm brown (B7860B, 6B2D0F) for grounding and human warmth. Forest green (1B4332) for social, dialogic, or reflective moments. Near-black (0A0A0A, 111111) for silence and punctuation. Warm off-white (F5F0EB) for content-heavy working slides. A single accent color deployed once is a signal; the same color on every slide is wallpaper.

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

  BACKGROUND COLOUR PALETTE — use these for chromatic arcs:
    Dark grounds:  111111, 1A1A1A, 0F2A4A, 1B3D22, 3D0A06, 2A1A0A
    Mid tones:     4A3728, 2C3E50, 1A3C34, 5B2D1E, 3B1F2E
    Warm accents:  B7311A, 876512, 8B4513, A0522D
    Cool accents:  1B5E80, 2B7038, 4A6741
    Near-whites:   F8F5F0, F0F4F8, FFF8E7

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

RULES — YOUR ROLE IS DESIGN, NOT EDITING:

  1. Output ONLY the markdown. No commentary, no preamble, no code fences. Raw slides.
  2. Every slide MUST have a <!-- layout: name --> directive.
  3. CONTENT IS SACRED. Do NOT rephrase, abbreviate, reorder, split, merge, or
     restructure slides. Each source slide becomes EXACTLY one output slide with
     the SAME text content, in the SAME order. You are a designer, not an editor.
     The words are fixed. The visual treatment is yours.
  4. You MUST add <!-- layout: name --> to every slide — this is your primary tool.
     Choose the layout that best serves each slide's existing content structure.
  5. You MAY add <!-- bg: HEX --> for background color overrides. Use them to build
     a chromatic arc through the deck. Each color should carry semantic meaning.
  6. You MAY add ### SECTION LABEL above existing content for typographic texture.
     This is a design element — a small-caps label that creates the Swiss scale
     relationship against the slide's existing title. Derive labels from the
     content's own themes and structure.
  7. You MAY add <!-- font: Name --> for per-slide font overrides.
  8. You MAY add blank slides (<!-- layout: blank -->) BETWEEN existing slides
     for pacing. These are insertions, not replacements.
  9. Speaker notes from the source MUST be preserved VERBATIM. You may append
     design rationale AFTER the original notes, separated by a blank line.
  10. Never use the same layout three times consecutively. Layout variation
      IS the visual argument.
  11. Do NOT invent content. Do NOT add titles, bullets, body text, or blockquotes
      that are not in the source. The only things you may add are: directives
      (layout, bg, font), ### labels, blank slides, and design rationale in notes.`;

// ═══════════════════════════════════════════════════════
// DEFAULT CREATIVE BRIEF — used when no --brief is given
// ═══════════════════════════════════════════════════════

const DEFAULT_BRIEF = `Your default posture is radical experimental within austere modernist constraints.
Not expressionism — not warmth, not comfort, not invitation. Cold structure made strange.

ESTRANGEMENT AS METHOD:
Treat the audience's expectations as material to work against. When content is familiar —
a syllabus, a schedule, an assessment rubric — your job is to make it unfamiliar again.
Defamiliarize. Viktor Shklovsky's ostranenie applied to visual composition: the purpose
of design is not to make information easy but to make perception *difficult enough* to be
conscious. A course schedule rendered as a stagger cascade forces the reader to re-encounter
what they thought they already understood. A single policy statement filling a dark field
at 40pt makes it impossible to skim.

The audience should feel that something has happened to the content — that it has been
processed through a formal intelligence that sees structure where they see prose. This is
not hostility. It is respect: the assumption that the audience can meet the design halfway.

AUSTERITY:
Prefer severity to warmth. Near-black (0A0A0A, 111111) and deep navy (0F2A4A, 16213E) as
dominant fields — not accents but the prevailing condition. Warm off-white (F5F0EB) used
sparingly for contrast, not as a default. Color should feel *withheld*, so when vermillion
(C0392B) or burnt sienna (B7410E) appears, it registers as an event. Think Hofmann's
teaching: remove until what remains is only what is structurally necessary.

TYPOGRAPHIC VIOLENCE:
Extreme scale contrast is mandatory, not optional. Set ### section labels (8pt, letterspaced,
small-caps) directly against # titles (30-40pt) on nearly every slide — this 5:1 ratio is
the primary visual tension. The small text is not subordinate; it is a different register
operating simultaneously. Weingart's stepped type, Kunz's information layering — the eye
must navigate competing scales and decide for itself what to read first.

SPATIAL DISRUPTION:
Deploy rotated layouts aggressively. The vertical title bar is not a decorative option —
it is a spatial argument. When text rotates 270°, it breaks the horizontal contract between
presenter and audience. Use this where the content itself performs a disruption: a paradox,
a provocation, a policy that cuts against expectation.

Favor fragment and overlap over bullets — always. Bullets are the default language of
presentations; they are precisely what this system exists to overcome. If content can be
shattered into a fragment mosaic or split across overlapping fields, do that. Bullets are
a last resort for genuinely sequential processes.

RHYTHM AS ARGUMENT:
Blank slides are not pauses — they are structural silences. Near-black blanks between
loud slides create the equivalent of Webern's rests: the silence is composed, not empty.
The sequence blank → section → blank is a three-part phrase where the statement exists
in isolation, bracketed by darkness.

Vary density with conviction. A stagger cascade (dense, diagonal, kinetic) followed by
a near-black blank (nothing) followed by a single-word section slide (everything compressed
to one gesture) — this is a designed experience, not a slideshow.

The overall chromatic arc should feel nocturnal and industrial: dark fields predominating,
occasional flares of vermillion or ochre (B7860B) that feel like signals in darkness,
not decoration. Forest green (1B4332) only where something genuinely human — dialogue,
exchange, ethical weight — demands a shift in register.

The result should look like it was composed by someone who has internalized the Swiss
tradition so completely that their departures from it are legible as informed transgressions,
not ignorance. Austere. Strange. Precise.`;

// ═══════════════════════════════════════════════════════
// INTENSITY GUIDES
// ═══════════════════════════════════════════════════════

const INTENSITY = {
  minimal: `INTENSITY: MINIMAL — The Müller-Brockmann position

Content stays exactly as written. You dress it in Swiss clothing.

DESIGN TOOLS:
- Pick the obvious best layout for each slide's content structure.
  3 bullets → "bullets". A quote → "rotated". Title only → "section".
- ### labels: add sparingly, derived from the content's own themes.
- bg overrides: no more than 30% of slides. Greyscale only (111111, 1A1A1A, F8F5F0).
- Font: Helvetica Neue only. No font overrides.
- No blank slides. No layout used more than 25% of the time.

The result: the same content, poured into a Swiss grid and set in Helvetica.`,

  moderate: `INTENSITY: MODERATE — The Gerstner position

Content stays exactly as written. You make bold design choices around it.

DESIGN TOOLS:
- Use at least 5 different layout types. No layout > 30% of slides.
  Reach for stagger, rotated, fragment, overlap — not just split and bullets.
- ### labels: add to most slides for typographic scale contrast.
- bg overrides: 30–60% of slides. Build a 2–3 color chromatic arc.
- Font: Helvetica Neue default. Use <!-- font: Georgia --> on 2–3 slides.
- May add 1–2 blank slides at major transitions.

The result: the same content, with pacing, emphasis, and visual rhythm.`,

  maximal: `INTENSITY: MAXIMAL — The Weingart position

Content stays exactly as written. You compose a visual argument around it.

DESIGN TOOLS:
- Use at least 8 different layout types. No layout > 20% of slides.
  "split" may not exceed 15%.
  REQUIRED minimums: 2× stagger, 2× rotated, 1× fragment, 1× overlap, 3× section.
- ### labels: on 60%+ of content slides. The 8pt label against a 30pt title
  IS the primary visual tension.
- bg overrides: 50–80% of slides. Build a FULL chromatic arc:
    Opening: 111111 or 0F2A4A (near-black or deep navy)
    Tension: 3D0A06 or 5B2D1E (dark blood, burnt sienna)
    Relief: 1B3D22 or 1A3C34 (deep forest)
    Warmth: 2A1A0A or 4A3728 (espresso, earth)
    Close: 111111 (return to darkness)
- Font mixing: <!-- font: Georgia --> on 15–25% of slides (quotes, reflective),
  <!-- font: Courier New --> on technical slides, <!-- font: Futura --> on statements.
- Add 2–4 blank slides as composed silence. Bracket key moments with darkness.

The result: austere, strange, precise. Every layout choice surprising but earned.
The same words, made unfamiliar through form.`,
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
  const { parseMarkdown } = require("./raster.js");

  const parts = [DESIGN_BRIEF];

  parts.push(INTENSITY[intensity] || INTENSITY.moderate);

  // Pick a random design seed for variation across runs
  const seed = DESIGN_SEEDS[Math.floor(Math.random() * DESIGN_SEEDS.length)];
  process.stderr.write(`  ${dim("Seed:")} ${chalk.italic(seed.slice(0, 70))}${dim("...")}\n`);
  const direction = brief || DEFAULT_BRIEF;
  parts.push(`CREATIVE DIRECTION: ${direction}

COMPOSITIONAL EMPHASIS FOR THIS RUN: ${seed}`);

  // Pre-split source into numbered slides so Claude can't skip any
  const sourceSlides = markdown.split(/\n---\n/).filter(s => s.trim());
  const numberedSlides = sourceSlides.map((slide, i) => {
    return `=== SLIDE ${i + 1} of ${sourceSlides.length} ===\n${slide.trim()}`;
  }).join("\n\n");

  parts.push(`--- SOURCE SLIDES (${sourceSlides.length} total) ---

${numberedSlides}

--- END SOURCE ---

YOUR TASK: Output exactly ${sourceSlides.length} slides, one for each source slide above,
in the same order. For each slide:
1. Add <!-- layout: name --> as the FIRST line
2. Optionally add <!-- bg: HEX --> and/or <!-- font: Name -->
3. Optionally add a ### SECTION LABEL for typographic texture
4. Copy the slide's content EXACTLY as written — do not rephrase, abbreviate, or drop anything
5. Preserve any existing speaker notes verbatim (you may append design rationale)

You may also INSERT blank slides (<!-- layout: blank -->) between slides for pacing,
but every source slide MUST appear in your output, unchanged.

Output the slide deck now. Start with <!-- layout: on the very first line.
No commentary, no code fences, no preamble.`);

  return parts.join("\n\n");
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
    proc.stderr.on("data", () => {});
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
      process.stderr.write(`\r  ${dim("[")}${accent(label)}${dim("]")} ${sage("✓")} ${chalk.white.bold(chars)} chars ${amber(totalEl + "s")}       \n`);
      if (code !== 0 && !resultText) {
        return reject(new Error("Claude exited with code " + code));
      }
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

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new Error(`Claude exited with code ${result.status}${stderr ? ": " + stderr : ""}`);
  }

  let output = (result.stdout || "").trim();

  if (!output) {
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

  const layoutIdx = output.indexOf("<!-- layout:");
  if (layoutIdx < 0) {
    throw new Error("Claude did not return valid slide markdown (no <!-- layout: --> directives found).");
  }
  if (layoutIdx > 0) output = output.substring(layoutIdx);

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

  const contentCheck = validateContentPreservation(md, composedContent);
  const intensityCheck = validateIntensity(composedSlides, intensity);
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

  const contentCheck = validateContentPreservation(md, composedContent);
  const intensityCheck = validateIntensity(composedSlides, intensity);
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

module.exports = { compose, composeAsync, buildPrompt, callClaude, callClaudeAsync, sanitizeClaudeOutput, DESIGN_BRIEF, DEFAULT_BRIEF, INTENSITY };
