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

The 60-column modular grid is this tradition's primary instrument. 60 divides by 2, 3, 4, 5, 6, 10, 12, 15, 20, and 30 — one system accommodating any rhythmic subdivision. Grid lines are not walls but thresholds.

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

// ═══════════════════════════════════════════════════════
// DESIGN MOODS — one is randomly selected per run
// Each defines a distinct aesthetic direction
// ═══════════════════════════════════════════════════════

const DESIGN_MOODS = [
  { name: "nocturne",
    brief: `MOOD: NOCTURNE — dark fields, signals in darkness.
Dominant backgrounds: near-black (111111), deep navy (0F2A4A), charcoal (2A2A2A).
Light slides (F8F5F0) are the exception — at most 20% of slides.
Accent color: a single vermillion (B7311A) moment at the rhetorical peak.
Secondary: forest green (1B3D22) for one reflective slide. Ochre (876512) for warmth.
Layouts: favor section (dark, monumental) and rotated (architectural disruption).
Typography: ### labels on 50%+ slides. Extreme scale contrast.` },

  { name: "editorial",
    brief: `MOOD: EDITORIAL — warm white fields, serif accents, magazine pacing.
Dominant backgrounds: warm off-white (F8F5F0, FFF8E7), paper tones.
Dark slides (1A1A1A, 0F2A4A) used for chapter breaks only — at most 25%.
Accent color: steel blue (1B5E80) and burnt sienna (8B4513) as editorial markers.
Font mixing: use <!-- font: Georgia --> on 30% of slides for editorial warmth.
Layouts: favor split (two-column editorial), stagger (visual lists), arc (contemplative).
Typography: refined, not violent. Generous whitespace. Readable density.` },

  { name: "brutalist",
    brief: `MOOD: BRUTALIST — raw concrete, exposed structure, no decoration.
Dominant backgrounds: alternate sharply between pure black (111111) and stark white (FFFFFF).
No gradients, no mid-tones, no warm colors. Binary: black or white.
Accent color: a single red (B7311A) used exactly once. Everything else is greyscale.
Font: <!-- font: Courier New --> on 20% of slides for raw, industrial texture.
Layouts: fragment (shattered), section (monumental), blank (structural void).
Typography: extreme. ### labels as large as titles in some places. No comfort.` },

  { name: "botanical",
    brief: `MOOD: BOTANICAL — deep greens, earth tones, organic warmth.
Dominant backgrounds: forest green (1B3D22, 1A3C34), warm earth (4A3728, 2A1A0A).
Light slides: warm cream (FFF8E7, F8F5F0) for content breathing room.
Accent: ochre (876512) for highlights, deep red (3D0A06) for emphasis.
Font mixing: <!-- font: Georgia --> on quotes and reflective slides.
Layouts: arc (cycles, growth), overlap (organic layering), split (rooted structure).
Typography: warm but precise. ### labels as gentle anchors, not confrontational.` },

  { name: "signal",
    brief: `MOOD: SIGNAL — high contrast, alert, urgent.
Dominant backgrounds: deep navy (0F2A4A, 2C3E50) — the control room.
Punctuation: vermillion (B7311A) on 3-4 slides as alarm signals.
Content slides: cool grey-white (F0F4F8) for readability.
Accent: steel blue (1B5E80) as the calm technical register.
Font: <!-- font: Futura --> on 2-3 statement slides for modernist punch.
Layouts: stagger (cascading alerts), fragment (information mosaic), section (sirens).
Typography: clean, functional, slightly military. ### labels as status indicators.` },

  { name: "archive",
    brief: `MOOD: ARCHIVE — aged paper, scholarly, layered time.
Dominant backgrounds: parchment (FFF8E7), aged cream (F8F5F0), coffee (4A3728).
Dark slides: deep brown (2A1A0A) for chapter dividers — library darkness.
Accent: muted red (5B2D1E, 3D0A06) — ink and binding.
Font mixing: <!-- font: Palatino --> on 25% of slides for classical authority.
<!-- font: Georgia --> on quotes and citations.
Layouts: split (marginalia structure), rotated (vertical spine), overlap (palimpsest).
Typography: scholarly precision. ### labels as catalogue entries.` },

  { name: "bauhaus",
    brief: `MOOD: BAUHAUS — primary geometry, functional clarity, Dessau precision.
Dominant backgrounds: pure white (FFFFFF) — the universal ground.
Dark slides: pure black (111111) for structural punctuation.
Accents: use ALL four theme accent colors boldly and evenly — each on ~15% of slides.
No muted tones. Full saturation. Democratic color distribution.
Font: <!-- font: Futura --> on 30% of slides — the Bauhaus typeface.
Layouts: fragment (grid as ideology), stagger (diagonal Kandinsky energy), arc (compass).
Typography: geometric. Clean. No ornament. Function is beauty.` },

  { name: "cinema",
    brief: `MOOD: CINEMA — widescreen, dramatic lighting, Kubrickian precision.
Dominant backgrounds: near-black (0A0A0A, 111111) — the darkened theatre.
Accent: a single warm pool of light — ochre (876512) or amber (A0522D) on 3 slides.
Cool: steel blue (1B5E80) for technical exposition — the clinical scene.
Content slides: dark grey (2A2A2A) — never white. This deck never leaves the dark.
Font: default Helvetica only — cinema is sans-serif.
Layouts: section (title cards), blank (black frames), split (shot/reverse-shot).
Typography: spare, cinematic. Large titles, small labels. Long pauses between scenes.` },
];

function getDefaultBrief() {
  const mood = DESIGN_MOODS[Math.floor(Math.random() * DESIGN_MOODS.length)];
  process.stderr.write(`  ${dim("Mood:")} ${chalk.italic(mood.name)}\n`);
  return mood.brief;
}

const DEFAULT_BRIEF = ""; // Replaced by getDefaultBrief() in buildPrompt

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
Mood: [name the mood/aesthetic you're applying]
Chromatic arc: [list the bg colors in sequence, e.g. "111111 → F8F5F0 → 0F2A4A → F8F5F0 → 1B3D22 → 111111"]
Layout rhythm: [list the layout sequence, e.g. "title section split stagger rotated split fragment section blank"]
Font strategy: [which slides get font overrides and why]
Key moments: [which 2-3 slides are the visual peaks — where color/layout is most dramatic]
Pacing: [where blank slides go and why]
-->

═══ PHASE 2: PER-SLIDE MICRO-DESIGN ═══
Now output exactly ${sourceSlides.length} slides, one for each source slide, in order.
Your macro plan above commits you — follow it. For each slide:

1. Add <!-- layout: name --> as the FIRST line (from your layout rhythm above)
2. Add <!-- bg: HEX --> if your chromatic arc calls for it on this slide
3. Add <!-- font: Name --> if your font strategy calls for it
4. Add a ### SECTION LABEL for typographic texture where appropriate
5. Copy the slide's content EXACTLY as written — no rephrasing, no dropping
6. Preserve speaker notes verbatim (you may append design rationale)

You may INSERT blank slides (<!-- layout: blank -->) between slides for pacing,
but every source slide MUST appear in your output, unchanged.

CRITICAL: Your first output line must be <!-- DESIGN PLAN.
After the plan comment, output the slides starting with <!-- layout:.
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

  // Extract and log the design plan if present, then strip it
  extractDesignPlan(output);
  output = output.replace(/<!-- DESIGN PLAN[\s\S]*?-->\s*/, "");

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

module.exports = { compose, composeAsync, buildPrompt, callClaude, callClaudeAsync, sanitizeClaudeOutput, DESIGN_BRIEF, DESIGN_MOODS, INTENSITY };
