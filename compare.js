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

const { compose, composeAsync, callClaude } = require("./compose.js");
const { generateHTML, parseMarkdown, THEMES, HTML_LAYOUTS, detectLayout, adaptThemeForBg, generateHTMLCSS } = require("./raster.js");
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
    await composeAsync(sourcePath, pptxPath, {
      theme: themeName,
      intensity,
      brief: options.brief,
      model: options.model,
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
  const intensities = options.intensities || ["faithful", "moderate", "radical"];
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
      const style = styleParts.length ? ` style="${styleParts.join(";")}"` : "";
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

  const variantColumns = variants.map((v, i) => {
    const ev = evaluations[i] || {};
    const scores = ev.scores || {};
    const total = ev.totalScore;
    return { ...v, ev, scores, total };
  });

  const rubricRows = criteriaKeys.map((key) => {
    const r = RUBRIC[key];
    const cells = variantColumns.map((vc) => {
      const s = vc.scores[key];
      if (!s || s.score == null) return `<td class="score na">—</td>`;
      const color = scoreColor(s.score, r.weight);
      return `<td class="score" style="color:${color}" title="${(s.rationale || "").replace(/"/g, "&quot;")}">${s.score}/${r.weight}</td>`;
    }).join("");
    return `<tr><td class="criterion">${key.replace(/([A-Z])/g, " $1").trim()}</td>${cells}</tr>`;
  }).join("\n");

  const totalRow = variantColumns.map((vc) => {
    if (vc.total == null) return `<td class="score total na">—</td>`;
    const color = scoreColor(vc.total, 100);
    return `<td class="score total" style="color:${color};font-weight:bold">${vc.total}/100</td>`;
  }).join("");

  // Render slide previews for each variant
  const previewColumns = variantColumns.map((vc) => {
    const variantTheme = THEMES[vc.theme || options.theme || "light"] || theme;
    const previews = renderSlidePreviewsHTML(vc.composedPath, variantTheme);
    const label = vc.label || vc.intensity;
    return `<div class="preview-col">
      <h3>${label} <span class="slide-count">${vc.total != null ? vc.total + "/100" : ""}</span></h3>
      <div class="preview-scroll">${previews}</div>
    </div>`;
  }).join("");

  const detailColumns = variantColumns.map((vc) => {
    const ev = vc.ev || {};
    const strengths = (ev.strengths || []).map((s) => `<li>${s}</li>`).join("");
    const weaknesses = (ev.weaknesses || []).map((w) => `<li>${w}</li>`).join("");
    const rec = ev.recommendation || "";
    const label = vc.label || vc.intensity;
    return `<div class="detail-col">
      <h3>${label}</h3>
      ${strengths ? `<h4>Strengths</h4><ul class="strengths">${strengths}</ul>` : ""}
      ${weaknesses ? `<h4>Weaknesses</h4><ul class="weaknesses">${weaknesses}</ul>` : ""}
      ${rec ? `<p class="verdict">${rec}</p>` : ""}
    </div>`;
  }).join("");

  // Find winner
  const scored = variantColumns.filter((vc) => vc.total != null);
  const winner = scored.length ? scored.reduce((a, b) => (a.total >= b.total ? a : b)) : null;
  const winnerLabel = winner ? (winner.label || winner.intensity) : "";
  const recommendation = winner
    ? `<strong>${winnerLabel}</strong> scored highest at ${winner.total}/100.`
    : "Evaluation incomplete — review variants manually.";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Compare: ${sourceName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#1a1a1a;color:#f0ebe3;line-height:1.5}
.header{padding:2rem 3rem;border-bottom:1px solid #333}
.header h1{font-size:1.4rem;font-weight:400;color:#8C8478;margin-bottom:.5rem}
.header h2{font-size:2rem;font-weight:700;letter-spacing:-0.02em}
.header .totals{display:flex;gap:2rem;margin-top:1rem}
.header .total-pill{padding:.4rem 1rem;border-radius:4px;background:#242424;font-size:1.1rem;font-weight:600}
.rubric{padding:2rem 3rem}
.rubric table{width:100%;border-collapse:collapse}
.rubric th,.rubric td{padding:.6rem 1rem;text-align:left;border-bottom:1px solid #333}
.rubric th{color:#8C8478;font-size:.75rem;text-transform:uppercase;letter-spacing:0.1em}
.criterion{font-size:.85rem;text-transform:capitalize}
.score{font-size:1rem;font-weight:600;text-align:center}
.score.na{color:#555}
.score.total{font-size:1.2rem;border-top:2px solid #555}
.details{display:flex;gap:2rem;padding:2rem 3rem}
.detail-col{flex:1;background:#242424;padding:1.5rem;border-radius:8px}
.detail-col h3{font-size:1rem;text-transform:uppercase;letter-spacing:0.15em;color:#8C8478;margin-bottom:1rem}
.detail-col h4{font-size:.75rem;text-transform:uppercase;letter-spacing:0.1em;color:#8C8478;margin:1rem 0 .5rem}
.strengths li{color:#548C5A;font-size:.85rem;margin-bottom:.3rem;list-style:none}
.strengths li::before{content:"+ ";font-weight:bold}
.weaknesses li{color:#C44230;font-size:.85rem;margin-bottom:.3rem;list-style:none}
.weaknesses li::before{content:"- ";font-weight:bold}
.verdict{margin-top:1rem;padding:1rem;background:#1a1a1a;border-radius:4px;font-size:.9rem;font-style:italic;color:#B8B0A2}
.recommendation{padding:2rem 3rem;border-top:1px solid #333}
.recommendation p{font-size:1.1rem}
.files{padding:2rem 3rem;border-top:1px solid #333;color:#8C8478;font-size:.8rem}
.files code{color:#B8B0A2}
/* Slide previews */
.previews{display:flex;gap:1rem;padding:2rem 3rem;border-top:1px solid #333}
.preview-col{flex:1;min-width:0}
.preview-col h3{font-size:.85rem;text-transform:uppercase;letter-spacing:0.1em;color:#8C8478;margin-bottom:1rem;display:flex;justify-content:space-between}
.slide-count{color:#548C5A}
.preview-scroll{max-height:80vh;overflow-y:auto;display:flex;flex-direction:column;gap:.5rem;padding-right:.5rem}
.preview-scroll::-webkit-scrollbar{width:4px}
.preview-scroll::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
.preview-card{position:relative}
.preview-num{position:absolute;top:4px;left:6px;font-size:.6rem;color:#8C8478;z-index:1;font-weight:600}
.preview-slide{aspect-ratio:16/9;overflow:hidden;border-radius:3px;border:1px solid #333;position:relative}
.slide-inner{position:absolute;width:960px;height:540px;transform-origin:top left;transform:scale(var(--preview-scale,0.3))}
.preview-error{color:#C44230;font-size:.85rem;padding:1rem}
</style>
<style>
/* Embedded slide layout CSS */
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
<div class="header">
  <h1>rastersysteme comparison</h1>
  <h2>${sourceName}</h2>
  <div class="totals">
    ${variantColumns.map((vc) => {
      const label = vc.label || vc.intensity;
      const score = vc.total != null ? `${vc.total}/100` : "—";
      return `<div class="total-pill">${label}: ${score}</div>`;
    }).join("")}
  </div>
</div>

<div class="previews">
  ${previewColumns}
</div>

<div class="rubric">
  <table>
    <thead><tr>
      <th>Criterion</th>
      ${variantColumns.map((vc) => `<th>${vc.label || vc.intensity}</th>`).join("")}
    </tr></thead>
    <tbody>
      ${rubricRows}
      <tr><td class="criterion" style="font-weight:bold">Total</td>${totalRow}</tr>
    </tbody>
  </table>
</div>

<div class="details">
  ${detailColumns}
</div>

<div class="recommendation">
  <p>${recommendation}</p>
</div>

<div class="files">
  <p>Generated files:</p>
  ${variantColumns.map((vc) => `<p><code>${vc.composedPath}</code></p>`).join("")}
</div>
<script>
document.querySelectorAll('.preview-slide').forEach(el => {
  const w = el.offsetWidth;
  el.style.setProperty('--preview-scale', (w / 960).toFixed(4));
  el.style.height = (w * 9 / 16) + 'px';
});
window.addEventListener('resize', () => {
  document.querySelectorAll('.preview-slide').forEach(el => {
    const w = el.offsetWidth;
    el.style.setProperty('--preview-scale', (w / 960).toFixed(4));
    el.style.height = (w * 9 / 16) + 'px';
  });
});
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
  const timestamp = new Date().toISOString().replace(/[T:]/g, "-").slice(0, 17);
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

  return { variants, evaluations, reportPath, outputDir };
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
    skipEval: args.includes("--skip-eval"),
    explosive: args.includes("--explosive"),
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

module.exports = { compare, runVariants, evaluateVariant, buildEvalPrompt, parseEvaluation, RUBRIC };
