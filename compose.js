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

RULES:

  1. Output ONLY the composed markdown. No commentary, no preamble, no code fences. Raw slides.
  2. Every slide MUST have a <!-- layout: name --> directive.
  3. You may restructure freely: split, merge, reorder, promote body to title,
     demote titles to labels. Content is material, not scripture.
  4. Do NOT invent content. Rephrase, fragment, abbreviate, recompose — but
     the words come from the source. Editorial compression is encouraged;
     editorial invention is not.
  4b. CONTENT COMPLETENESS: All substantive information from the source must
     appear in the output. URLs, dates, names, assessment weightings, deadlines,
     weekly task descriptions, criteria, policies — everything that a student or
     audience member would need. You may compress phrasing, but you may not
     drop information. If the source has a Zoom link, include it. If the source
     has six weekly questions, all six must appear. The composed deck must be
     usable as a REPLACEMENT for the original, not a teaser for it.
  5. Use ### section labels constantly. They create the typographic texture
     that distinguishes Swiss-informed design from generic slides. Tiny labels
     anchoring large titles is the foundational Swiss scale relationship.
  6. Blank slides are structural punctuation. Use them — but earn them.
  7. A single word or phrase can be a full section slide if the conviction is there.
  8. Build a narrative arc: opening energy → development → climax → resolution → silence.
  9. Never repeat the same layout three times consecutively. The rhythm of layout
     variation IS the visual argument. If you catch yourself defaulting to one layout,
     the composition has gone wrong.
  10. Use <!-- bg: HEX --> overrides to build a chromatic arc through the entire deck.
      Each color should carry semantic meaning, not just visual variety.
  11. SPEAKER NOTES: The source material contains speaker notes (in \`\`\`notes blocks).
      These are the presenter's script — they MUST be preserved in the output. When you
      restructure slides, distribute the original notes to whichever composed slide inherits
      that content. Paraphrase or compress if needed, but the substance must survive.
      You may add brief design rationale AFTER the preserved notes, separated by a blank line,
      but never replace the original notes entirely. If a source slide has no notes, you may
      add design rationale alone. The notes pane is how the presenter delivers the talk —
      without them, the deck is unusable.`;

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
  faithful: `INTENSITY: FAITHFUL — The Müller-Brockmann position

Philosophy: The content's existing structure IS the design. Your job is to
dress it in Swiss clothing, not to rewrite the script.

HARD CONSTRAINTS:
- Output slide count must be within ±20% of source slide count.
- Do NOT merge or split slides. One source slide → one output slide.
  Exception: you may add up to 2 section dividers for chapter structure.
- Do NOT reorder content. The sequence of the source is the sequence of the output.
- LAYOUT SELECTION is your primary tool. Choose the best layout for each slide's
  existing content. A slide with 3 bullets gets "bullets". A slide with a quote
  gets "rotated". A slide with a title only gets "section".
- Apply ### section labels to create typographic texture — but derive them from
  the source's own structure (topic names, headings), don't invent new ones.
- Use bg overrides SPARINGLY — no more than 30% of slides. Color is reserved
  for structural emphasis (chapter breaks, key moments), not decoration.
- Keep "split" to under 25% of total layouts. Prefer bullets, stagger, section.
- Preserve ALL speaker notes exactly as they appear in the source.
- NO blank slides. Faithful mode does not add structural silence.

VISUAL IDENTITY:
- Font: Helvetica Neue only. No font overrides. The Swiss baseline.
- Colour: neutral palette. Use bg overrides only in greyscale (111111, 1A1A1A, F8F5F0).
  No coloured backgrounds. Let the accent colours do the work.
- Density: content-heavy slides. Fill the grid. This is an information design, not a poster.

The result should look like the source material was poured into a Swiss grid
and set in Helvetica — recognisably the same content, unmistakably better designed.`,

  moderate: `INTENSITY: MODERATE — The Gerstner position

Philosophy: The content's logic leads, but you edit for visual impact.
You are a skilled editor with a grid, not a faithful transcriber.

HARD CONSTRAINTS:
- Output slide count may be 1.2–1.8× the source slide count.
- You MAY split dense source slides into 2–3 output slides.
- You MAY add section dividers (up to 1 per 5 content slides).
- You MAY promote a strong phrase from body text to a title slide.
- You MAY reorder within sections but not across them.
- LAYOUT VARIETY: use at least 6 different layout types. No layout may
  exceed 30% of total slides. "split" is not the default — it is one
  of 13 tools. Reach for stagger, rotated, fragment, overlap, arc.
- Use bg overrides on 30–60% of slides. Build a 2–3 color chromatic arc
  (e.g. dark → accent → dark → different accent → close).
- Add 1–2 blank slides as structural punctuation at major transitions.
- Speaker notes: preserve original notes, add brief design rationale on
  slides where you made significant layout choices.

VISUAL IDENTITY:
- Font: Helvetica Neue as default. Use <!-- font: Georgia --> on 2–3 slides
  for editorial contrast (quotes, reflective moments). No more than 10%.
- Colour: build a 2–3 colour chromatic arc using the dark/mid palette.
  Example arc: 1A1A1A → 0F2A4A → 1A1A1A → 1B3D22 → 111111.
  Warm accent slides (3D0A06, 4A3728) at emotional peaks.
- Density: vary deliberately. Dense stagger slides followed by sparse section
  slides. The contrast in density IS the rhythm.

The result should feel like an experienced designer interpreted the content —
the same information, but with pacing, emphasis, and visual rhythm that the
raw source lacked.`,

  radical: `INTENSITY: RADICAL — The Weingart position

Philosophy: The design IS the interpretation. Form and content are inseparable.
You are not presenting information — you are composing a visual argument.

HARD CONSTRAINTS:
- Output slide count may be 1.5–2.5× the source slide count.
- LAYOUT DIVERSITY is mandatory: use at least 8 different layout types.
  No single layout may exceed 20% of total slides.
  BANNED from overuse: "split" may appear on no more than 15% of slides.
  REQUIRED minimum usage:
    - At least 2 stagger slides (cascading Musica Viva bars)
    - At least 2 rotated slides (vertical type — Weingart's signature)
    - At least 1 fragment slide (shattered mosaic)
    - At least 1 overlap slide (dialectic colour fields)
    - At least 3 section slides (structural anchors)
    - At least 2 blank slides (composed silence)
- RECOMPOSITION is expected: break paragraphs into stagger cascades,
  isolate single words as section slides, turn lists into fragment mosaics,
  split a quote across a rotated layout, reorder for dramatic arc.
- bg overrides on 50–80% of slides. Build a FULL chromatic arc across the
  deck — not just accent colors but deep custom backgrounds that create
  an atmospheric journey. USE SPECIFIC COLOURS:
    Opening: 111111 or 0F2A4A (near-black or deep navy)
    Tension: 3D0A06 or 5B2D1E (dark blood, burnt sienna)
    Relief: 1B3D22 or 1A3C34 (deep forest)
    Warmth: 2A1A0A or 4A3728 (espresso, earth)
    Close: 111111 (return to darkness)
  NOT every slide needs a bg — some should breathe with the theme default.
- TYPOGRAPHIC SCALE: vary heading levels aggressively. A ### label over a
  # title is the Swiss scale relationship. Use it on 60%+ of content slides.
- FONT MIXING is mandatory:
    Use <!-- font: Georgia --> on 15–25% of slides (quotes, editorial, reflective).
    Use <!-- font: Courier New --> on data-heavy or technical slides.
    Use <!-- font: Futura --> on bold statements or manifestos.
    The default Helvetica Neue is the ground; other fonts are events.
- VISUAL DENSITY CONTRAST: alternate between dense and sparse.
    A stagger with 5 bars → blank → single-word section → 8-bullet rotated.
    The variation in density across adjacent slides IS the design.
- Speaker notes: preserve all original notes, add design rationale explaining
  WHY each radical choice was made.
- ALL substantive content must survive. Radical design, not radical deletion.
  If the source has URLs, dates, criteria, questions — they all appear.
  Present them radically, but present them.

The result should look like it was composed by someone who internalized the
Swiss tradition so completely that their departures from it are legible as
informed transgressions. Austere. Strange. Precise. Unmistakably designed.`,
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

  // Pick a random design seed for variation across runs
  const seed = DESIGN_SEEDS[Math.floor(Math.random() * DESIGN_SEEDS.length)];
  process.stderr.write(`  ${dim("Seed:")} ${chalk.italic(seed.slice(0, 70))}${dim("...")}\n`);
  const direction = brief || DEFAULT_BRIEF;
  parts.push(`CREATIVE DIRECTION: ${direction}

COMPOSITIONAL EMPHASIS FOR THIS RUN: ${seed}`);

  parts.push(`--- SOURCE MATERIAL ---
${markdown}
--- END SOURCE ---

Compose the slide deck now.

CRITICAL: Your response must begin with <!-- layout: on the very first line and contain NOTHING but rastersysteme slide markdown. No commentary, no insights, no explanations, no code fences, no preamble, no postscript. The first characters of your output must be <!-- layout: and the output must end with slide content. Begin.`);

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
  return { ...result, composedPath };
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

  return { ...result, composedPath };
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
    --intensity <level>    faithful | moderate (default) | radical
    --brief "<direction>"  Creative direction (supplements the default brief)
    --dry-run              Output composed markdown to stdout, skip render
    --model <model>        Claude model override
    --help                 Show this help

  Examples:
    node compose.js talk.md
    node compose.js talk.md deck.pptx --theme dark --intensity radical
    node compose.js notes.md --brief "brutalist, maximum contrast" --dry-run
    node compose.js pitch.md --intensity faithful --theme blue

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
