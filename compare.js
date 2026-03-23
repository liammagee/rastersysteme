#!/usr/bin/env node
/**
 * compare — multi-style comparison and evaluation for rastersysteme
 *
 * Runs all 3 intensity levels against the same source markdown,
 * evaluates each against an a11y-inclusive rubric (via Claude + mechanical QA),
 * and generates a side-by-side comparison report.
 *
 * Usage:
 *   node compare.js <source.md> [options]
 *
 * Pipeline:
 *   source.md → compose (×3 intensities) → QA + evaluate (Claude) → compare.html
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.gray;
const accent = chalk.hex("#C44230");
const teal = chalk.hex("#2C7A92");
const sage = chalk.hex("#548C5A");
const amber = chalk.hex("#C79B38");

const { compose, composeAsync, composeIncremental, callClaude } = require("./compose.js");
const { generateHTML, parseMarkdown, THEMES, HTML_LAYOUTS, detectLayout, adaptThemeForBg, generateHTMLCSS, renderDesigned } = require("./raster.js");
const { runQA } = require("./qa.js");

const SCRIPT_DIR = __dirname;

// ═══════════════════════════════════════════════════════
// RUBRIC SCHEMA — 7 criteria, 100 total points
// ═══════════════════════════════════════════════════════

const RUBRIC = {
  contentCompleteness: {
    weight: 20,
    description: "All substantive source information survives: URLs, dates, names, weightings, deadlines, task descriptions, policies.",
    prompt: "Score 0-20: Does every piece of substantive information from the source appear somewhere in the composed deck? Check for dropped URLs, omitted dates, missing criteria, absent weekly tasks. Deduct 2pts per category of dropped information.",
  },
  contentFidelity: {
    weight: 15,
    description: "No information invented or hallucinated. Rephrasing and compression are fine; fabrication is not.",
    prompt: "Score 0-15: Does the composed deck introduce any information not present in the source? 15 = zero invention. Deduct 5pts per fabricated fact.",
  },
  designQuality: {
    weight: 20,
    description: "Layout variety, chromatic arc, typographic contrast (### labels vs # titles), appropriate layout choices.",
    prompt: "Score 0-20: Evaluate layout sequencing sophistication, typographic scale contrast (### / # relationship), color arc logic (do bg overrides build a meaningful sequence?), and layout appropriateness to content type.",
  },
  speakerNotes: {
    weight: 15,
    description: "Original source notes preserved, distributed across restructured slides, design rationale added.",
    prompt: "Score 0-15: Are the original speaker notes from the source preserved? Do they appear (possibly compressed/distributed) in the composed slides? 15 = complete preservation + useful additions. 0 = original notes entirely absent.",
  },
  pacing: {
    weight: 10,
    description: "Layout rhythm — density variation, blank slide usage, no 3× consecutive same layout.",
    prompt: "Score 0-10: Is there felt rhythm in the layout sequence? Are blank slides structural? Does any layout repeat 3+ times in a row? Is there density variation?",
  },
  accessibility: {
    weight: 10,
    description: "WCAG contrast ratios, readability at presentation scale.",
    prompt: "Score 0-10: Given the mechanical contrast data provided, assess whether the deck is readable at presentation scale. Note any combinations that would fail projected.",
  },
  narrativeCoherence: {
    weight: 10,
    description: "Structural logic — opening energy, development, climax, resolution; section slides at logical chapter boundaries.",
    prompt: "Score 0-10: Does the deck tell a coherent story? Do section slides appear at logical boundaries? Is there an opening, middle, and close?",
  },
};

// ═══════════════════════════════════════════════════════
// TOKEN EXTRACTION — gives Claude a checklist
// ═══════════════════════════════════════════════════════

function extractImportantTokens(md) {
  const urls = [...new Set((md.match(/https?:\/\/[^\s)>\]]+/g) || []))];
  const emails = [...new Set((md.match(/[\w.+-]+@[\w.-]+\.\w+/g) || []))];
  const dates = [...new Set((md.match(/\b(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}|\b(?:Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}|\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?|\b\d{4}-\d{2}-\d{2})\b/g) || []))];
  const weights = [...new Set((md.match(/\b\d+%|\b\d+\s*(?:points?|pts?)\b/gi) || []))];
  return { urls, emails, dates, weights };
}

// ═══════════════════════════════════════════════════════
// EVALUATION PROMPT BUILDER
// ═══════════════════════════════════════════════════════

function buildEvalPrompt(sourceMd, composedMd, qaData, intensity) {
  const rubricText = Object.entries(RUBRIC)
    .map(([key, r]) => `  ${key} (max ${r.weight}): ${r.prompt}`)
    .join("\n");

  const tokens = extractImportantTokens(sourceMd);
  const tokenList = [
    tokens.urls.length ? `URLs: ${tokens.urls.join(", ")}` : null,
    tokens.emails.length ? `Emails: ${tokens.emails.join(", ")}` : null,
    tokens.dates.length ? `Dates: ${tokens.dates.join(", ")}` : null,
    tokens.weights.length ? `Weights: ${tokens.weights.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  return `You are evaluating a composed slide deck against a rubric.
You will be given the source markdown, the composed deck (${intensity} intensity), and mechanical QA data.

RUBRIC — score each criterion:
${rubricText}

IMPORTANT TOKENS FROM SOURCE (these must all survive in the composed deck):
${tokenList || "(none extracted)"}

MECHANICAL QA DATA:
${JSON.stringify(qaData, null, 2)}

--- SOURCE MARKDOWN ---
${sourceMd}
--- END SOURCE ---

--- COMPOSED DECK (${intensity}) ---
${composedMd}
--- END COMPOSED ---

Return ONLY a valid JSON object with this exact structure — no commentary, no code fences:
{
  "scores": {
    "contentCompleteness": { "score": <0-20>, "rationale": "<2-3 sentences>", "findings": ["..."] },
    "contentFidelity": { "score": <0-15>, "rationale": "<2-3 sentences>", "findings": ["..."] },
    "designQuality": { "score": <0-20>, "rationale": "<2-3 sentences>", "findings": ["..."] },
    "speakerNotes": { "score": <0-15>, "rationale": "<2-3 sentences>", "findings": ["..."] },
    "pacing": { "score": <0-10>, "rationale": "<2-3 sentences>", "findings": ["..."] },
    "accessibility": { "score": <0-10>, "rationale": "<2-3 sentences>", "findings": ["..."] },
    "narrativeCoherence": { "score": <0-10>, "rationale": "<2-3 sentences>", "findings": ["..."] }
  },
  "totalScore": <0-100>,
  "strengths": ["<specific strength>", "..."],
  "weaknesses": ["<specific weakness>", "..."],
  "recommendation": "<1-2 sentence overall verdict>"
}

Your evaluation must be grounded in the text provided. Do not assess criteria you cannot verify. If uncertain, score conservatively and note it.`;
}

// ═══════════════════════════════════════════════════════
// EVALUATION PARSER
// ═══════════════════════════════════════════════════════

function parseEvaluation(raw) {
  let text = raw.trim();

  // Strip markdown fences
  if (/^```(?:json)?\s*\n/.test(text)) {
    text = text.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
  }

  // Find first { to last }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    text = text.slice(first, last + 1);
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed.scores && typeof parsed.totalScore === "number") {
      return parsed;
    }
  } catch { /* fall through */ }

  return {
    scores: {},
    totalScore: null,
    strengths: [],
    weaknesses: [],
    recommendation: "Evaluation parse failed — review composed markdown manually.",
    error: "Could not parse Claude's evaluation response as JSON.",
  };
}

// ═══════════════════════════════════════════════════════
// BRIEF GENERATOR — Claude analyzes content, writes a brief
// ═══════════════════════════════════════════════════════

function generateBrief(sourceMd, options = {}) {
  process.stderr.write(`  ${amber("⟐")} ${dim("Generating design brief...")}\n`);

  const prompt = `You are a design director with deep knowledge of Swiss International typography
(Müller-Brockmann, Ruder, Hofmann), New Wave experimentation (Weingart, Greiman, Kunz),
and contemporary editorial design. You are analyzing content for a slide presentation
composed on a 60-column modular grid.

Read the source material below and write a creative brief — 3-5 sentences — that
captures the SPECIFIC visual treatment this content deserves. Consider:

- The subject matter's tone and register (academic? provocative? technical? intimate?)
- Key structural features (lists, hierarchies, progressions, tensions, dialectics)
- Emotional arc (does it build? confront? unfold? layer?)
- What specific Swiss/New Wave techniques would serve this content
  (e.g., "Weingart stepped type for the escalating critique section",
  "Müller-Brockmann circle motif for the convergence of themes",
  "Kunz information layering for the dense technical material")
- Color mood (nocturnal/industrial? warm/human? clinical/precise?)
- What should feel DIFFERENT about this deck vs a generic presentation

Do NOT write generic advice. Write a brief that could only apply to THIS content.
Output ONLY the brief — no preamble, no labels, no formatting.

--- SOURCE MATERIAL ---
${sourceMd}
--- END ---`;

  try {
    const raw = callClaude(prompt, { model: options.model || "sonnet", raw: true });
    const brief = raw.trim().replace(/^```\w*\n/, "").replace(/\n```$/, "").trim();
    process.stderr.write(`  ${amber("⟐")} ${dim("Brief:")} ${chalk.italic(brief.slice(0, 80))}${dim("...")}\n`);
    return brief;
  } catch (err) {
    process.stderr.write(`  ${accent("✗")} Brief generation failed: ${err.message}\n`);
    return "";
  }
}

// ═══════════════════════════════════════════════════════
// VARIANT RUNNER
// ═══════════════════════════════════════════════════════

function timer() {
  const start = Date.now();
  return () => ((Date.now() - start) / 1000).toFixed(1) + "s";
}

async function runVariant(sourcePath, intensity, themeName, outputDir, options = {}) {
  const base = path.basename(sourcePath, ".md");
  const label = `${intensity}-${themeName}`;
  const variantDir = path.join(outputDir, label);
  fs.mkdirSync(variantDir, { recursive: true });

  const pptxPath = path.join(variantDir, `${base}.${label}.pptx`);
  const htmlPath = path.join(variantDir, `${base}.${label}.html`);
  const composedPath = path.join(variantDir, `${base}.${label}.composed.md`);

  const t = timer();

  try {
    await composeIncremental(sourcePath, htmlPath, {
      theme: themeName,
      intensity,
      brief: options.brief,
      model: options.model,
      slides: options.slides,
      withImages: !!options.imagesDir,
      imagesDir: options.imagesDir,
    });
    process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} compose ${amber(t())}\n`);
  } catch (err) {
    process.stderr.write(`  ${accent("✗")} ${dim("[")}${accent(label)}${dim("]")} compose failed ${amber(t())} ${err.message}\n`);
    return null;
  }

  // Render HTML
  const tHtml = timer();
  try {
    await generateHTML(composedPath, htmlPath, { theme: themeName });
    process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} html   ${amber(tHtml())}\n`);
  } catch { /* non-fatal */ }

  // Run mechanical QA
  const tQa = timer();
  let qaResult = null;
  try {
    qaResult = runQA(composedPath, { theme: themeName });
    process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} qa     ${amber(tQa())}\n`);
  } catch { /* non-fatal */ }

  process.stderr.write(`  ${dim("[")}${accent(label)}${dim("]")} ${sage("total")}  ${amber(t())}\n`);
  return { intensity, theme: themeName, label, composedPath, pptxPath, htmlPath, qaResult };
}

async function runVariants(sourcePath, outputDir, options = {}) {
  const intensities = options.intensities || ["minimal", "moderate", "maximal"];
  const themes = options.themes || [options.theme || "light"];
  const maxParallel = options.maxParallel || 3;

  // Build all variant specs
  const specs = [];
  for (const themeName of themes) {
    for (const intensity of intensities) {
      specs.push({ intensity, themeName });
    }
  }

  process.stderr.write(`  ${teal("▶")} ${chalk.white.bold(specs.length)} variants ${dim(`(${maxParallel} parallel)`)}\n`);

  const tAll = timer();
  const variants = [];
  for (let i = 0; i < specs.length; i += maxParallel) {
    const batch = specs.slice(i, i + maxParallel);
    const batchNum = Math.floor(i / maxParallel) + 1;
    const totalBatches = Math.ceil(specs.length / maxParallel);
    if (totalBatches > 1) {
      process.stderr.write(`\n  ${dim(`── batch ${batchNum}/${totalBatches} ──`)}\n`);
    }
    const results = await Promise.all(
      batch.map((s) => runVariant(sourcePath, s.intensity, s.themeName, outputDir, options))
    );
    for (const r of results) {
      if (r) variants.push(r);
    }
  }
  process.stderr.write(`\n  ${sage("✓")} All variants ${amber(tAll())}\n`);

  return variants;
}

// ═══════════════════════════════════════════════════════
// EVALUATOR
// ═══════════════════════════════════════════════════════

async function evaluateVariant(sourceMd, composedMd, qaData, intensity, options = {}) {
  const prompt = buildEvalPrompt(sourceMd, composedMd, qaData, intensity);

  process.stderr.write(`  ${amber("⟐")} ${dim("Evaluating")} ${accent(intensity)}${dim("...")}\n`);

  try {
    const raw = callClaude(prompt, { model: options.evalModel || "sonnet", raw: true });
    return parseEvaluation(raw);
  } catch (err) {
    process.stderr.write(`  ${accent("✗")} Evaluation failed: ${err.message}\n`);
    return parseEvaluation("{}");
  }
}

// ═══════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════

function esc(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderSlidePreviewsHTML(composedPath, theme) {
  try {
    const md = fs.readFileSync(composedPath, "utf-8");
    const slides = parseMarkdown(md);
    return slides.map((slide, idx) => {
      const layout = detectLayout(slide, idx, slides.length);
      const renderer = HTML_LAYOUTS[layout];
      if (!renderer) return "";

      const effectiveTheme = adaptThemeForBg(theme, slide.bgOverride);
      const styleParts = [];
      // Font override
      if (slide.fontOverride) {
        styleParts.push(`font-family:'${slide.fontOverride}',var(--font)`);
      }
      // Background override + theme adaptation
      if (slide.bgOverride) {
        styleParts.push(`background:#${slide.bgOverride}`);
        if (effectiveTheme !== theme) {
          styleParts.push(`--text:#${effectiveTheme.text}`);
          styleParts.push(`--text-mid:#${effectiveTheme.textMid}`);
          styleParts.push(`--text-light:#${effectiveTheme.textLight}`);
          styleParts.push(`--accent:#${effectiveTheme.accent}`);
          styleParts.push(`--accent2:#${effectiveTheme.accent2}`);
          styleParts.push(`--accent3:#${effectiveTheme.accent3}`);
          styleParts.push(`--accent4:#${effectiveTheme.accent4}`);
        }
      }
      // Style overrides (title-size, body-size, spacing, etc.)
      if (slide.style) {
        const styleMap = {
          "title-size": (v) => `--title-size:${v}px`,
          "body-size": (v) => `--body-size:${v}px`,
          "spacing": (v) => `--slide-gap:${v === "tight" ? "0.5vmin" : v === "loose" ? "4vmin" : v === "none" ? "0" : v}`,
          "padding": (v) => `padding:${v === "none" ? "0" : v === "tight" ? "2vmin" : v === "loose" ? "8vmin" : v}`,
          "opacity": (v) => `opacity:${v}`,
          "align": (v) => `text-align:${v}`,
          "letter-spacing": (v) => `letter-spacing:${v}`,
          "text-transform": (v) => `text-transform:${v}`,
          "color": (v) => `color:#${v.replace(/^#/, "")}`,
          "invert": (v) => v === "true" ? `filter:invert(1)` : "",
        };
        for (const [k, v] of Object.entries(slide.style)) {
          const fn = styleMap[k];
          if (fn) { const r = fn(v); if (r) styleParts.push(r); }
          else {
            const val = /^[0-9A-Fa-f]{6}$/.test(v) ? `#${v}` : v;
            styleParts.push(`${k}:${val}`);
          }
        }
      }
      const style = styleParts.length ? ` style="${styleParts.join(";")}"` : "";

      // Use designed renderer for slides with a design directive
      if (slide.design) {
        const designStyleParts = [];
        if (slide.design.bg) designStyleParts.push(`background:#${slide.design.bg.replace(/^#/, "")}`);
        if (slide.design.font) designStyleParts.push(`font-family:'${slide.design.font}',var(--font)`);
        designStyleParts.push(...styleParts);
        designStyleParts.push(`position:relative;overflow:hidden;padding:0`);
        const ds = designStyleParts.length ? ` style="${designStyleParts.join(";")}"` : "";
        return `<div class="preview-card">
        <div class="preview-num">${String(idx + 1).padStart(2, "0")}</div>
        <div class="preview-slide">
          <div class="slide-inner slide designed"${ds}>${renderDesigned(slide)}</div>
        </div>
      </div>`;
      }

      return `<div class="preview-card">
        <div class="preview-num">${String(idx + 1).padStart(2, "0")}</div>
        <div class="preview-slide">
          <div class="slide-inner slide layout-${layout}"${style}>${renderer(slide)}</div>
        </div>
      </div>`;
    }).join("\n");
  } catch {
    return `<p class="preview-error">Could not render previews</p>`;
  }
}

function scoreColor(score, max) {
  const pct = score / max;
  if (pct >= 0.8) return "#548C5A";
  if (pct >= 0.5) return "#C79B38";
  return "#C44230";
}

function generateCompareReport(variants, evaluations, sourceName, outputPath, options = {}) {
  const theme = THEMES[options.theme || "light"] || THEMES.light;
  const criteriaKeys = Object.keys(RUBRIC);
  const intensityColors = { minimal: "#4080D0", moderate: "#D0A030", maximal: "#D04030" };
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const modelUsed = options.model || "sonnet";

  const variantColumns = variants.map((v, i) => {
    const ev = evaluations[i] || {};
    const scores = ev.scores || {};
    const total = ev.totalScore;
    return { ...v, ev, scores, total };
  });

  // Parse slide metadata for each variant (layout types, bg colors, slide counts)
  const variantSlideMeta = variantColumns.map((vc) => {
    try {
      const md = fs.readFileSync(vc.composedPath, "utf-8");
      const slides = parseMarkdown(md);
      return slides.map((slide, idx) => {
        const layout = detectLayout(slide, idx, slides.length);
        return { layout, bg: slide.bgOverride || null };
      });
    } catch { return []; }
  });

  // Max slide count across variants
  const maxSlides = Math.max(...variantSlideMeta.map(m => m.length), 0);

  // Grade letter from score
  function gradeLetter(score) {
    if (score == null) return "—";
    if (score >= 90) return "A";
    if (score >= 80) return "B+";
    if (score >= 70) return "B";
    if (score >= 60) return "C+";
    if (score >= 50) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  // Build score cards HTML
  const scoreCardsHTML = variantColumns.map((vc) => {
    const intensity = vc.intensity || "unknown";
    const color = intensityColors[intensity] || "#D04030";
    const score = vc.total != null ? vc.total : null;
    const grade = gradeLetter(score);
    const label = vc.label || vc.intensity;
    return `<div class="score-card" style="--card-color:${color}">
      <div class="score-card__strip"></div>
      <div class="score-card__body">
        <div class="score-card__intensity">${intensity}</div>
        <div class="score-card__score">${score != null ? score : "—"}<span class="score-card__max">/100</span></div>
        <div class="score-card__grade">${grade}</div>
      </div>
    </div>`;
  }).join("");

  // Slide tabs HTML
  const slideTabsHTML = Array.from({ length: maxSlides }, (_, i) => {
    return `<button class="slide-tab${i === 0 ? " active" : ""}" data-slide="${i}">${String(i + 1).padStart(2, "0")}</button>`;
  }).join("");

  // Render slide previews for each variant (keeps renderSlidePreviewsHTML logic)
  const previewColumnsHTML = variantColumns.map((vc, vi) => {
    const variantTheme = THEMES[vc.theme || options.theme || "light"] || theme;
    const previews = renderSlidePreviewsHTML(vc.composedPath, variantTheme);
    const intensity = vc.intensity || "unknown";
    const color = intensityColors[intensity] || "#D04030";
    const label = vc.label || vc.intensity;
    const meta = variantSlideMeta[vi] || [];
    return `<div class="variant-col" data-variant="${vi}" data-intensity="${intensity}" style="--variant-color:${color}">
      <div class="variant-col__header" data-variant-toggle="${vi}">
        <span class="variant-col__name">${intensity}</span>
        <span class="variant-col__theme">${vc.theme || options.theme || "light"}</span>
      </div>
      <div class="variant-col__slides">${previews}</div>
    </div>`;
  }).join("");

  // Build slide metadata JSON for JS
  const slideMetaJSON = JSON.stringify(variantSlideMeta);

  // Evaluation bars data
  const barGroupsHTML = criteriaKeys.map((key) => {
    const r = RUBRIC[key];
    const label = key.replace(/([A-Z])/g, " $1").trim();
    const barsHTML = variantColumns.map((vc) => {
      const intensity = vc.intensity || "unknown";
      const color = intensityColors[intensity] || "#D04030";
      const s = vc.scores[key];
      const score = (s && s.score != null) ? s.score : 0;
      const max = r.weight;
      const pct = (score / max * 100).toFixed(1);
      const rationale = (s && s.rationale) ? s.rationale.replace(/"/g, "&quot;") : "";
      return `<div class="bar-row">
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color}" data-score="${score}" data-max="${max}"></div>
        </div>
        <span class="bar-value" style="color:${color}">${score}<span class="bar-value__max">/${max}</span></span>
        <div class="bar-tooltip">${rationale}</div>
      </div>`;
    }).join("");
    return `<div class="bar-group">
      <div class="bar-group__label">${label}</div>
      <div class="bar-group__bars">${barsHTML}</div>
    </div>`;
  }).join("");

  // Strengths / weaknesses cards
  const evalCardsHTML = variantColumns.map((vc) => {
    const ev = vc.ev || {};
    const intensity = vc.intensity || "unknown";
    const color = intensityColors[intensity] || "#D04030";
    const strengths = (ev.strengths || []).map((s) => `<li>${s}</li>`).join("");
    const weaknesses = (ev.weaknesses || []).map((w) => `<li>${w}</li>`).join("");
    const rec = ev.recommendation || "";
    return `<div class="eval-card" style="--eval-color:${color}">
      <div class="eval-card__header">${intensity}</div>
      ${strengths ? `<div class="eval-card__section">
        <div class="eval-card__section-title">Strengths</div>
        <ul class="eval-card__list eval-card__list--strengths">${strengths}</ul>
      </div>` : ""}
      ${weaknesses ? `<div class="eval-card__section">
        <div class="eval-card__section-title">Weaknesses</div>
        <ul class="eval-card__list eval-card__list--weaknesses">${weaknesses}</ul>
      </div>` : ""}
      ${rec ? `<div class="eval-card__verdict">${rec}</div>` : ""}
    </div>`;
  }).join("");

  // Find winner
  const scored = variantColumns.filter((vc) => vc.total != null);
  const winner = scored.length ? scored.reduce((a, b) => (a.total >= b.total ? a : b)) : null;
  const winnerIntensity = winner ? winner.intensity : "";
  const winnerColor = intensityColors[winnerIntensity] || "#D04030";

  // Build the bar legend
  const barLegendHTML = variantColumns.map((vc) => {
    const intensity = vc.intensity || "unknown";
    const color = intensityColors[intensity] || "#D04030";
    return `<span class="bar-legend__item"><span class="bar-legend__dot" style="background:${color}"></span>${intensity}</span>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Compare: ${sourceName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
/* ═══════════════════════════════════════════════════════ */
/* RESET & CUSTOM PROPERTIES                              */
/* ═══════════════════════════════════════════════════════ */
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0E0E12;
  --surface:#17171D;
  --surface-2:#1F1F27;
  --border:#2A2A35;
  --text:#E8E8F0;
  --text-2:#9090A8;
  --text-3:#606078;
  --accent:#D04030;
  --minimal:#4080D0;
  --moderate:#D0A030;
  --maximal:#D04030;
  --font-display:'Sora',sans-serif;
  --font-body:'Source Sans 3',sans-serif;
  --font-mono:'JetBrains Mono',monospace;
  --ease:cubic-bezier(0.4,0,0.2,1);
  --radius:6px;
  --radius-lg:10px;
}

/* ═══════════════════════════════════════════════════════ */
/* BASE                                                    */
/* ═══════════════════════════════════════════════════════ */
html{font-size:16px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
body{font-family:var(--font-body);background:var(--bg);color:var(--text);line-height:1.55;overflow-x:hidden}
::selection{background:rgba(208,64,48,0.3);color:#fff}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--text-3)}

/* ═══════════════════════════════════════════════════════ */
/* NAVIGATION                                              */
/* ═══════════════════════════════════════════════════════ */
.top-nav{
  position:fixed;top:0;left:0;right:0;z-index:100;
  padding:0.75rem 2rem;
  background:rgba(14,14,18,0.85);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
}
.top-nav__back{
  font-family:var(--font-display);font-size:0.8rem;font-weight:500;
  color:var(--text-2);text-decoration:none;
  display:flex;align-items:center;gap:0.4rem;
  transition:color 0.2s var(--ease);
}
.top-nav__back:hover{color:var(--text)}
.top-nav__back svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2}
.top-nav__title{
  font-family:var(--font-mono);font-size:0.75rem;font-weight:500;
  color:var(--text-3);letter-spacing:0.02em;
}

/* ═══════════════════════════════════════════════════════ */
/* HEADER                                                  */
/* ═══════════════════════════════════════════════════════ */
.header{
  padding:5rem 3rem 2.5rem;
  border-bottom:1px solid var(--border);
}
.header__meta{
  font-family:var(--font-mono);font-size:0.75rem;font-weight:400;
  color:var(--text-3);letter-spacing:0.02em;
  margin-bottom:0.75rem;
  display:flex;gap:1.5rem;flex-wrap:wrap;
}
.header__meta span{display:flex;align-items:center;gap:0.3rem}
.header__title{
  font-family:var(--font-display);font-size:clamp(2rem,4vw,3.2rem);
  font-weight:700;letter-spacing:-0.03em;line-height:1.1;
  color:var(--text);margin-bottom:2rem;
}
.score-cards{display:flex;gap:1rem;flex-wrap:wrap}
.score-card{
  flex:1;min-width:200px;
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);overflow:hidden;
  transition:transform 0.2s var(--ease),box-shadow 0.2s var(--ease);
}
.score-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.3)}
.score-card__strip{height:3px;background:var(--card-color)}
.score-card__body{padding:1.25rem 1.5rem}
.score-card__intensity{
  font-family:var(--font-display);font-size:0.7rem;font-weight:600;
  text-transform:uppercase;letter-spacing:0.12em;
  color:var(--card-color);margin-bottom:0.5rem;
}
.score-card__score{
  font-family:var(--font-display);font-size:2.4rem;font-weight:800;
  line-height:1;color:var(--text);
}
.score-card__max{font-size:1rem;font-weight:400;color:var(--text-3);margin-left:0.1em}
.score-card__grade{
  font-family:var(--font-display);font-size:0.85rem;font-weight:600;
  color:var(--text-2);margin-top:0.4rem;
}

/* ═══════════════════════════════════════════════════════ */
/* SLIDE COMPARISON                                        */
/* ═══════════════════════════════════════════════════════ */
.slides-section{padding:2rem 3rem;border-bottom:1px solid var(--border)}
.slides-section__title{
  font-family:var(--font-display);font-size:1.1rem;font-weight:600;
  color:var(--text);margin-bottom:1.25rem;
  display:flex;align-items:center;gap:0.75rem;
}
.slides-section__title span{
  font-family:var(--font-mono);font-size:0.7rem;font-weight:400;
  color:var(--text-3);
}

/* Slide tabs */
.slide-tabs{
  display:flex;gap:2px;flex-wrap:wrap;
  margin-bottom:1.5rem;
  background:var(--surface);border-radius:var(--radius);
  padding:3px;border:1px solid var(--border);
}
.slide-tab{
  font-family:var(--font-mono);font-size:0.75rem;font-weight:500;
  color:var(--text-3);background:transparent;border:none;
  padding:0.4rem 0.7rem;border-radius:4px;cursor:pointer;
  transition:all 0.15s var(--ease);
  min-width:2.2rem;text-align:center;
}
.slide-tab:hover{color:var(--text-2);background:var(--surface-2)}
.slide-tab.active{color:var(--text);background:var(--accent);font-weight:600}

/* Variant columns */
.slide-compare{display:flex;gap:1rem;min-height:0}
.variant-col{
  flex:1;min-width:0;
  border:1px solid var(--border);border-radius:var(--radius-lg);
  background:var(--surface);overflow:hidden;
  transition:flex 0.4s var(--ease);
}
.variant-col.solo{flex:3}
.variant-col:not(.solo){flex:1}
.variant-col__header{
  padding:0.6rem 1rem;
  background:var(--variant-color);
  display:flex;align-items:center;justify-content:space-between;
  cursor:pointer;user-select:none;
  transition:opacity 0.15s var(--ease);
}
.variant-col__header:hover{opacity:0.85}
.variant-col__name{
  font-family:var(--font-display);font-size:0.75rem;font-weight:700;
  text-transform:uppercase;letter-spacing:0.1em;color:#fff;
}
.variant-col__theme{
  font-family:var(--font-mono);font-size:0.65rem;font-weight:400;
  color:rgba(255,255,255,0.65);
}
.variant-col__slides{padding:0.75rem}

/* Individual slide cards within variant columns */
.variant-col .preview-card{
  position:relative;margin-bottom:0.5rem;
  display:none; /* hidden by default; JS shows the active slide */
}
.variant-col .preview-card.slide-visible{display:block}
.variant-col .preview-num{
  position:absolute;top:6px;left:8px;z-index:2;
  font-family:var(--font-mono);font-size:0.6rem;font-weight:600;
  color:rgba(255,255,255,0.5);
  background:rgba(0,0,0,0.5);padding:1px 5px;border-radius:3px;
}
.variant-col .preview-slide{
  aspect-ratio:16/9;overflow:hidden;border-radius:var(--radius);
  border:1px solid var(--border);position:relative;
  background:var(--surface-2);
}
.slide-inner{
  position:absolute;width:960px;height:540px;
  transform-origin:top left;transform:scale(var(--preview-scale,0.3));
  display:flex !important;
}
.slide-meta{
  display:flex;align-items:center;gap:0.5rem;
  padding:0.5rem 0 0;
}
.slide-meta__layout{
  font-family:var(--font-mono);font-size:0.6rem;font-weight:500;
  color:var(--text-3);background:var(--surface-2);
  padding:2px 8px;border-radius:3px;border:1px solid var(--border);
  text-transform:uppercase;letter-spacing:0.05em;
}
.slide-meta__bg{
  width:14px;height:14px;border-radius:3px;
  border:1px solid var(--border);flex-shrink:0;
}

.preview-error{
  font-family:var(--font-mono);font-size:0.8rem;
  color:var(--accent);padding:1rem;
}

/* ═══════════════════════════════════════════════════════ */
/* EVALUATION — BARS                                       */
/* ═══════════════════════════════════════════════════════ */
.eval-section{padding:2.5rem 3rem;border-bottom:1px solid var(--border)}
.eval-section__title{
  font-family:var(--font-display);font-size:1.1rem;font-weight:600;
  color:var(--text);margin-bottom:0.5rem;
}
.bar-legend{
  display:flex;gap:1.25rem;margin-bottom:1.5rem;
}
.bar-legend__item{
  font-family:var(--font-mono);font-size:0.7rem;font-weight:500;
  color:var(--text-2);display:flex;align-items:center;gap:0.35rem;
}
.bar-legend__dot{width:8px;height:8px;border-radius:2px}
.bar-group{
  display:flex;align-items:flex-start;gap:1rem;
  padding:0.65rem 0;border-bottom:1px solid var(--border);
}
.bar-group:last-child{border-bottom:none}
.bar-group__label{
  width:160px;flex-shrink:0;
  font-family:var(--font-body);font-size:0.8rem;font-weight:500;
  color:var(--text-2);text-transform:capitalize;
  padding-top:0.15rem;
}
.bar-group__bars{flex:1;display:flex;flex-direction:column;gap:0.35rem}
.bar-row{display:flex;align-items:center;gap:0.6rem;position:relative}
.bar-track{
  flex:1;height:20px;background:var(--surface-2);
  border-radius:3px;overflow:hidden;position:relative;
}
.bar-fill{
  height:100%;border-radius:3px;
  transition:width 0.6s var(--ease);
  position:relative;
}
.bar-value{
  font-family:var(--font-mono);font-size:0.75rem;font-weight:600;
  min-width:3.5rem;text-align:right;
}
.bar-value__max{font-weight:400;color:var(--text-3);font-size:0.65rem}
.bar-tooltip{
  display:none;position:absolute;left:0;top:100%;
  margin-top:4px;z-index:10;
  background:var(--surface-2);border:1px solid var(--border);
  border-radius:var(--radius);padding:0.6rem 0.8rem;
  font-family:var(--font-body);font-size:0.75rem;color:var(--text-2);
  line-height:1.4;max-width:360px;
  box-shadow:0 4px 16px rgba(0,0,0,0.4);
  pointer-events:none;
}
.bar-row:hover .bar-tooltip{display:block}

/* ═══════════════════════════════════════════════════════ */
/* EVALUATION — STRENGTHS / WEAKNESSES                     */
/* ═══════════════════════════════════════════════════════ */
.eval-cards-section{padding:2.5rem 3rem;border-bottom:1px solid var(--border)}
.eval-cards-section__title{
  font-family:var(--font-display);font-size:1.1rem;font-weight:600;
  color:var(--text);margin-bottom:1.25rem;
}
.eval-cards{display:flex;gap:1rem;flex-wrap:wrap}
.eval-card{
  flex:1;min-width:260px;
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);overflow:hidden;
}
.eval-card__header{
  padding:0.6rem 1.25rem;
  background:var(--eval-color);
  font-family:var(--font-display);font-size:0.7rem;font-weight:700;
  text-transform:uppercase;letter-spacing:0.12em;color:#fff;
}
.eval-card__section{padding:0.75rem 1.25rem 0}
.eval-card__section-title{
  font-family:var(--font-display);font-size:0.65rem;font-weight:600;
  text-transform:uppercase;letter-spacing:0.1em;
  color:var(--text-3);margin-bottom:0.4rem;
}
.eval-card__list{list-style:none;padding:0}
.eval-card__list li{
  font-family:var(--font-body);font-size:0.82rem;color:var(--text-2);
  padding:0.3rem 0 0.3rem 1rem;
  border-left:2px solid var(--eval-color);
  margin-bottom:0.3rem;line-height:1.4;
}
.eval-card__list--strengths li{border-left-color:#548C5A}
.eval-card__list--weaknesses li{border-left-color:var(--accent)}
.eval-card__verdict{
  padding:0.75rem 1.25rem 1rem;
  font-family:var(--font-body);font-size:0.82rem;
  color:var(--text-3);font-style:italic;line-height:1.4;
}

/* ═══════════════════════════════════════════════════════ */
/* FOOTER                                                  */
/* ═══════════════════════════════════════════════════════ */
.footer{
  padding:2rem 3rem;
  border-top:1px solid var(--border);
  display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;
}
.footer__item{
  font-family:var(--font-mono);font-size:0.7rem;
  color:var(--text-3);display:flex;align-items:center;gap:0.3rem;
}
.footer__item strong{color:var(--text-2);font-weight:600}

/* Winner banner */
.winner-banner{
  padding:1.5rem 3rem;
  background:var(--surface);border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:1rem;
}
.winner-banner__icon{
  width:32px;height:32px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:1rem;
}
.winner-banner__text{
  font-family:var(--font-body);font-size:0.95rem;color:var(--text-2);
}
.winner-banner__text strong{
  font-family:var(--font-display);font-weight:700;
  text-transform:uppercase;letter-spacing:0.05em;
}

/* ═══════════════════════════════════════════════════════ */
/* RESPONSIVE                                              */
/* ═══════════════════════════════════════════════════════ */
@media(max-width:900px){
  .header{padding:5rem 1.5rem 2rem}
  .slides-section,.eval-section,.eval-cards-section,.footer,.winner-banner{padding-left:1.5rem;padding-right:1.5rem}
  .slide-compare{flex-direction:column}
  .score-cards{flex-direction:column}
  .eval-cards{flex-direction:column}
  .bar-group{flex-direction:column;gap:0.4rem}
  .bar-group__label{width:auto}
}
</style>
<style>
/* Embedded slide layout CSS from raster.js */
${generateHTMLCSS()}
:root{${Object.entries({
    bg: theme.bg, "bg-alt": theme.bgAlt, "bg-dark": theme.bgDark,
    text: theme.text, "text-mid": theme.textMid, "text-light": theme.textLight,
    accent: theme.accent, accent2: theme.accent2, accent3: theme.accent3, accent4: theme.accent4,
    white: theme.white, black: theme.black, grey: theme.grey,
    font: "'Helvetica Neue',Helvetica,Arial,sans-serif",
  }).map(([k, v]) => `--${k}:${v.startsWith("'") || v.startsWith("#") ? v : "#" + v}`).join(";")}}
</style>
</head>
<body>

<!-- Fixed nav -->
<nav class="top-nav">
  <a class="top-nav__back" href="../index.html">
    <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    rastersysteme
  </a>
  <span class="top-nav__title">comparison report</span>
</nav>

<!-- Header -->
<header class="header">
  <div class="header__meta">
    <span>Source: ${esc(sourceName)}.md</span>
    <span>Theme: ${esc(options.theme || "light")}</span>
    <span>Model: ${esc(modelUsed)}</span>
  </div>
  <h1 class="header__title">${esc(sourceName)}</h1>
  <div class="score-cards">${scoreCardsHTML}</div>
</header>

<!-- Winner banner -->
${winner ? `<div class="winner-banner">
  <div class="winner-banner__icon" style="background:${winnerColor}">&#9733;</div>
  <div class="winner-banner__text">
    <strong style="color:${winnerColor}">${esc(winnerIntensity)}</strong> scored highest at <strong>${winner.total}/100</strong>
    ${winner.ev && winner.ev.recommendation ? ` &mdash; ${esc(winner.ev.recommendation)}` : ""}
  </div>
</div>` : `<div class="winner-banner">
  <div class="winner-banner__text">Evaluation incomplete &mdash; review variants manually.</div>
</div>`}

<!-- Slide comparison -->
<section class="slides-section">
  <div class="slides-section__title">
    Slide Comparison
    <span>${maxSlides} slide${maxSlides !== 1 ? "s" : ""} per variant</span>
  </div>
  <div class="slide-tabs" role="tablist">${slideTabsHTML}</div>
  <div class="slide-compare">${previewColumnsHTML}</div>
</section>

<!-- Evaluation bars -->
<section class="eval-section">
  <div class="eval-section__title">Rubric Scores</div>
  <div class="bar-legend">${barLegendHTML}</div>
  <div class="bar-groups">${barGroupsHTML}</div>
</section>

<!-- Strengths / weaknesses -->
<section class="eval-cards-section">
  <div class="eval-cards-section__title">Analysis</div>
  <div class="eval-cards">${evalCardsHTML}</div>
</section>

<!-- Footer -->
<footer class="footer">
  <div class="footer__item"><strong>Generated</strong> ${esc(timestamp)}</div>
  <div class="footer__item"><strong>Model</strong> ${esc(modelUsed)}</div>
  <div class="footer__item"><strong>Variants</strong> ${variants.length}</div>
  ${variantColumns.map((vc) => `<div class="footer__item"><strong>${esc(vc.intensity)}</strong> ${esc(vc.composedPath)}</div>`).join("")}
</footer>

<script>
// ═══════════════════════════════════════════════════════
// SLIDE META (layout + bg per variant per slide)
// ═══════════════════════════════════════════════════════
const slideMeta = ${slideMetaJSON};
const maxSlides = ${maxSlides};

// ═══════════════════════════════════════════════════════
// SCALE SLIDE PREVIEWS
// ═══════════════════════════════════════════════════════
function scaleSlides(){
  document.querySelectorAll('.preview-slide').forEach(el => {
    const w = el.offsetWidth;
    if (w > 0) {
      el.style.setProperty('--preview-scale', (w / 960).toFixed(4));
      el.style.height = (w * 9 / 16) + 'px';
    }
  });
}

// ═══════════════════════════════════════════════════════
// TABBED SLIDE NAVIGATION
// ═══════════════════════════════════════════════════════
let currentSlide = 0;

function showSlide(idx) {
  currentSlide = idx;
  // Update tabs
  document.querySelectorAll('.slide-tab').forEach(tab => {
    tab.classList.toggle('active', parseInt(tab.dataset.slide) === idx);
  });
  // Show/hide cards + add metadata
  document.querySelectorAll('.variant-col').forEach((col, vi) => {
    const cards = col.querySelectorAll('.preview-card');
    cards.forEach((card, ci) => {
      card.classList.toggle('slide-visible', ci === idx);
      // Add metadata badge if not already there
      if (ci === idx && !card.querySelector('.slide-meta')) {
        const meta = (slideMeta[vi] || [])[ci];
        if (meta) {
          const metaEl = document.createElement('div');
          metaEl.className = 'slide-meta';
          metaEl.innerHTML = '<span class="slide-meta__layout">' + (meta.layout || '?') + '</span>'
            + (meta.bg ? '<span class="slide-meta__bg" style="background:#' + meta.bg + '"></span>' : '');
          card.appendChild(metaEl);
        }
      }
    });
  });
  // Re-scale after display change
  requestAnimationFrame(scaleSlides);
}

// Tab clicks
document.querySelectorAll('.slide-tab').forEach(tab => {
  tab.addEventListener('click', () => showSlide(parseInt(tab.dataset.slide)));
});

// Arrow key navigation
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    if (currentSlide < maxSlides - 1) showSlide(currentSlide + 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentSlide > 0) showSlide(currentSlide - 1);
  }
});

// ═══════════════════════════════════════════════════════
// SOLO VIEW — click variant header to expand/collapse
// ═══════════════════════════════════════════════════════
document.querySelectorAll('[data-variant-toggle]').forEach(header => {
  header.addEventListener('click', () => {
    const vi = header.dataset.variantToggle;
    const col = header.closest('.variant-col');
    const allCols = document.querySelectorAll('.variant-col');
    const isSolo = col.classList.contains('solo');
    allCols.forEach(c => {
      c.classList.remove('solo');
      c.style.display = '';
    });
    if (!isSolo) {
      col.classList.add('solo');
      allCols.forEach(c => {
        if (c !== col) c.style.display = 'none';
      });
    }
    requestAnimationFrame(scaleSlides);
  });
});

// ═══════════════════════════════════════════════════════
// ANIMATE BARS ON SCROLL
// ═══════════════════════════════════════════════════════
const barObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.bar-fill').forEach(bar => {
        bar.style.width = bar.style.width; // trigger reflow
      });
      barObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });
document.querySelectorAll('.bar-group').forEach(g => barObserver.observe(g));

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
showSlide(0);
window.addEventListener('resize', scaleSlides);
</script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, "utf-8");
  return outputPath;
}

// ═══════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════

async function compare(sourcePath, options = {}) {
  const base = path.basename(sourcePath, ".md");
  const sourceDir = path.dirname(path.resolve(sourcePath));
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}-${String(now.getHours()).padStart(2,"0")}-${String(now.getMinutes()).padStart(2,"0")}`;
  const outputDir = path.join(sourceDir, `compare-${base}-${timestamp}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const explosive = options.explosive || false;
  const variantCount = explosive ? "12 (3 intensities × 4 themes)" : "3 intensities";

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("rastersysteme compare")}${explosive ? accent(" — EXPLOSIVE") : ""}\n`);
  process.stderr.write(`  ${dim("Source:")}  ${teal(path.basename(sourcePath))}\n`);
  process.stderr.write(`  ${dim("Variants:")} ${chalk.white.bold(variantCount)}\n`);
  process.stderr.write(`  ${dim("Output:")}  ${teal(outputDir + "/")}\n`);

  const tPipeline = timer();

  // 0. Generate design brief from content (unless one was provided)
  if (!options.brief) {
    // No brief provided at all — generate one from content
    const tBrief = timer();
    const sourceMdForBrief = fs.readFileSync(sourcePath, "utf-8");
    options.brief = generateBrief(sourceMdForBrief, options);
    process.stderr.write(`  ${dim("Brief generated")} ${amber(tBrief())}\n`);
  } else if (options.brief === "default") {
    // User explicitly chose "skip" — use the built-in DEFAULT_BRIEF
    options.brief = "";
  }

  // Set themes for explosive mode
  if (explosive) {
    options.themes = ["light", "dark", "red", "blue"];
  }

  // 1. Run variants
  const variants = await runVariants(sourcePath, outputDir, options);

  if (variants.length === 0) {
    process.stderr.write(`  ${accent("✗")} No variants produced.\n`);
    process.exit(1);
  }

  // 2. Evaluate (unless --skip-eval)
  const sourceMd = fs.readFileSync(sourcePath, "utf-8");
  const evaluations = [];

  if (!options.skipEval) {
    process.stderr.write(`\n  ${dim("── EVALUATION ──────────────────────────")}\n`);
    const tEval = timer();
    for (const variant of variants) {
      const tOne = timer();
      const composedMd = fs.readFileSync(variant.composedPath, "utf-8");
      const qaData = variant.qaResult || {};
      const ev = await evaluateVariant(sourceMd, composedMd, qaData, variant.intensity, options);
      evaluations.push(ev);
      const score = ev.totalScore != null ? `${ev.totalScore}/100` : "—";
      process.stderr.write(`  ${dim("[")}${accent(variant.label)}${dim("]")} ${sage(score)} ${amber(tOne())}\n`);
    }
    process.stderr.write(`  ${sage("✓")} Evaluation done ${amber(tEval())}\n`);
  } else {
    variants.forEach(() => evaluations.push(null));
  }

  // 3. Generate report
  const tReport = timer();
  const reportPath = path.join(sourceDir, `${base}.compare.html`);
  generateCompareReport(variants, evaluations, base, reportPath, options);
  process.stderr.write(`\n  ${sage("✓")} Report → ${teal(reportPath)} ${amber(tReport())}\n`);
  process.stderr.write(`  ${sage("✓")} ${chalk.white.bold("Total pipeline")} ${amber(tPipeline())}\n`);

  // 4. Best pick
  const pick = bestPick(variants, evaluations);
  if (pick) {
    process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("BEST PICK:")} ${teal(pick.label)} ${amber(pick.score + "/100")}${pick.margin > 0 ? dim(` (+${pick.margin} over next)`) : ""}\n`);
    process.stderr.write(`  ${dim(pick.reasoning)}\n`);
  }

  return { variants, evaluations, reportPath, outputDir, pick };
}

// ═══════════════════════════════════════════════════════
// BEST PICK — automated variant recommendation
// ═══════════════════════════════════════════════════════

function bestPick(variants, evaluations) {
  if (!evaluations || evaluations.every(e => !e || e.totalScore == null)) return null;

  // Score each variant
  const scored = variants.map((v, i) => {
    const ev = evaluations[i];
    if (!ev || ev.totalScore == null) return null;
    return {
      label: v.label || v.intensity,
      intensity: v.intensity,
      theme: v.theme,
      score: ev.totalScore,
      scores: ev.scores || {},
      strengths: ev.strengths || [],
      weaknesses: ev.weaknesses || [],
      recommendation: ev.recommendation || "",
    };
  }).filter(Boolean);

  if (scored.length === 0) return null;

  // Sort by total score descending
  scored.sort((a, b) => b.score - a.score);

  const winner = scored[0];
  const runnerUp = scored[1];
  const margin = runnerUp ? winner.score - runnerUp.score : 0;

  // Build reasoning
  const parts = [];

  // What it excels at
  if (winner.scores) {
    const criteria = Object.entries(winner.scores)
      .filter(([, v]) => v && v.score != null)
      .sort((a, b) => {
        const aMax = RUBRIC[a[0]]?.weight || 20;
        const bMax = RUBRIC[b[0]]?.weight || 20;
        return (b[1].score / bMax) - (a[1].score / aMax);
      });
    const topCriteria = criteria.slice(0, 2).map(([k]) => k.replace(/([A-Z])/g, " $1").trim().toLowerCase());
    if (topCriteria.length > 0) {
      parts.push(`Strongest in ${topCriteria.join(" and ")}`);
    }
  }

  // Margin assessment
  if (margin === 0 && runnerUp) {
    parts.push(`tied with ${runnerUp.label} — consider audience and context`);
  } else if (margin <= 5 && runnerUp) {
    parts.push(`narrow margin over ${runnerUp.label} (${margin}pts) — either is viable`);
  } else if (margin > 15 && runnerUp) {
    parts.push(`clear winner over ${runnerUp.label} by ${margin}pts`);
  }

  // Weaknesses to note
  if (winner.weaknesses.length > 0) {
    parts.push(`watch: ${winner.weaknesses[0].toLowerCase()}`);
  }

  return {
    label: winner.label,
    intensity: winner.intensity,
    theme: winner.theme,
    score: winner.score,
    margin,
    runnerUp: runnerUp ? { label: runnerUp.label, score: runnerUp.score } : null,
    reasoning: parts.join(". ") + ".",
    all: scored,
  };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
  compare — multi-style comparison and evaluation for rastersysteme

  Pipeline:
    source.md → compose (×3 intensities) → QA + evaluate → compare.html

  Usage:
    node compare.js <source.md> [options]

  Options:
    --theme <name>         Render theme: light (default), dark, red, blue
    --explosive            Run ALL themes × ALL intensities (12 variants)
    --brief "<direction>"  Creative brief (auto-generated if omitted)
    --model <model>        Claude model for composition (default: sonnet)
    --eval-model <model>   Claude model for evaluation (default: sonnet)
    --skip-eval            Generate variants only, skip Claude evaluation
    --help                 Show this help

  Examples:
    node compare.js talk.md
    node compare.js talk.md --explosive
    node compare.js talk.md --theme dark --brief "brutalist, maximum contrast"
    node compare.js notes.md --skip-eval
    `);
    process.exit(0);
  }

  const input = args[0];

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const options = {
    theme: getFlag("--theme") || "light",
    brief: getFlag("--brief"),
    model: getFlag("--model") || "sonnet",
    evalModel: getFlag("--eval-model") || "sonnet",
    slides: getFlag("--slides"),
    skipEval: args.includes("--skip-eval"),
    explosive: args.includes("--explosive"),
    imagesDir: getFlag("--images-dir"),
    maxParallel: parseInt(getFlag("--parallel") || "3"),
  };

  if (!fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  compare(input, options).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { compare, runVariants, evaluateVariant, buildEvalPrompt, parseEvaluation, generateCompareReport, bestPick, RUBRIC };
