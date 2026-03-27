#!/usr/bin/env node
/**
 * corpus-synthesize — Read the design corpus and produce data-driven insights
 * for future composition. Replaces the append-only evaluation log in
 * design-lessons.md with structured, deduplicated, evidence-backed findings.
 *
 * Outputs:
 *   design-insights.md — structured insights file read by compose.js
 *   (also printed to stdout)
 *
 * Usage:
 *   node corpus-synthesize.js                    # synthesize from corpus
 *   node corpus-synthesize.js --scan             # run deck-audit first, then synthesize
 *   node corpus-synthesize.js --eval --scan      # scan with eval, then synthesize
 *
 * Module API:
 *   const { synthesize, loadCorpus } = require('./corpus-synthesize');
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { loadCorpus, auditAll } = require("./deck-audit.js");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

const INSIGHTS_PATH = path.join(__dirname, "design-insights.md");

// ─── Statistical helpers ────────────────────────────────────────────

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// ─── Core synthesis ─────────────────────────────────────────────────

function synthesize(corpus) {
  // Filter to entries with both fingerprints and scores
  const usable = corpus.filter(e => e.fingerprint && e.scores && e.scores.dimensions);

  if (usable.length === 0) {
    return { insights: "# Design Insights\n\nNo usable corpus entries found. Run `node deck-audit.js --eval` first.\n", rules: [] };
  }

  const rules = [];
  const lines = [];

  lines.push("# Design Insights");
  lines.push("");
  lines.push("Data-driven composition guidance derived from the design corpus.");
  lines.push(`Generated: ${new Date().toISOString().split("T")[0]} from ${usable.length} scored decks.`);
  lines.push("");
  lines.push("These rules are injected into Claude composition prompts alongside design-lessons.md.");
  lines.push("Each rule is backed by corpus evidence (deck count, score correlation).");

  // ── 1. Palette rules ──────────────────────────────────────────────

  lines.push("");
  lines.push("## Palette & Accessibility");
  lines.push("");

  const withAccess = usable.filter(e => {
    const s = e.scores.dimensions.accessibility;
    return s !== null && s !== undefined;
  });

  if (withAccess.length >= 2) {
    const highLight = withAccess.filter(e => e.fingerprint.palette.lightPct >= 80);
    const lowLight = withAccess.filter(e => e.fingerprint.palette.lightPct < 60);

    if (highLight.length > 0) {
      const hlAccess = avg(highLight.map(e => e.scores.dimensions.accessibility));
      rules.push({
        id: "palette-light-orientation",
        rule: "Use >=80% light backgrounds (lightPct >= 80).",
        evidence: `${highLight.length} decks with >=80% light: avg accessibility ${hlAccess.toFixed(1)}/10`,
        weight: highLight.length >= 3 ? "strong" : "moderate",
      });
      lines.push(`- **Light orientation >= 80%**: avg accessibility ${hlAccess.toFixed(1)}/10 (n=${highLight.length})`);
    }
    if (lowLight.length > 0) {
      const llAccess = avg(lowLight.map(e => e.scores.dimensions.accessibility));
      rules.push({
        id: "palette-avoid-dark-heavy",
        rule: "Avoid <60% light backgrounds. Dark-heavy palettes correlate with accessibility failures.",
        evidence: `${lowLight.length} decks with <60% light: avg accessibility ${llAccess.toFixed(1)}/10`,
        weight: lowLight.length >= 3 ? "strong" : "moderate",
      });
      lines.push(`- **Light orientation < 60%**: avg accessibility ${llAccess.toFixed(1)}/10 (n=${lowLight.length}) — avoid`);
    }

    // Arc crossings vs color score
    const withColor = usable.filter(e => {
      const s = e.scores.dimensions.color;
      return s !== null && s !== undefined;
    });
    if (withColor.length >= 2) {
      const highArc = withColor.filter(e => e.fingerprint.palette.arcCrossings >= 3);
      if (highArc.length > 0) {
        const arcColor = avg(highArc.map(e => e.scores.dimensions.color));
        rules.push({
          id: "palette-chromatic-arc",
          rule: "Maintain >=3 light/dark chromatic arc crossings across the deck.",
          evidence: `${highArc.length} decks with >=3 crossings: avg color ${arcColor.toFixed(1)}/10`,
          weight: "strong",
        });
        lines.push(`- **Chromatic arc >= 3 crossings**: avg color ${arcColor.toFixed(1)}/10 (n=${highArc.length})`);
      }
    }

    // Background variety
    const bgCounts = usable.map(e => e.fingerprint.palette.backgrounds.length);
    if (bgCounts.length >= 2) {
      const medBg = median(bgCounts);
      lines.push(`- **Background variety**: median ${medBg} unique backgrounds across corpus`);
      rules.push({
        id: "palette-bg-variety",
        rule: `Use ${Math.max(4, Math.round(medBg))}+ unique background colors for palette diversity.`,
        evidence: `Corpus median: ${medBg} unique backgrounds`,
        weight: "moderate",
      });
    }
  }

  // ── 2. Grid & archetype rules ─────────────────────────────────────

  lines.push("");
  lines.push("## Grid & Zone Archetypes");
  lines.push("");

  const withGrid = usable.filter(e => {
    const s = e.scores.dimensions.grid;
    return s !== null && s !== undefined && e.fingerprint.zones.uniqueArchetypes > 0;
  });

  if (withGrid.length >= 2) {
    const highDiv = withGrid.filter(e => e.fingerprint.zones.uniqueArchetypes >= 5);
    const lowDiv = withGrid.filter(e => e.fingerprint.zones.uniqueArchetypes < 4);

    if (highDiv.length > 0) {
      const hdGrid = avg(highDiv.map(e => e.scores.dimensions.grid));
      rules.push({
        id: "grid-archetype-diversity",
        rule: "Use >=5 distinct zone archetypes (monument, sidebar-left, editorial, right-anchored, narrow-column, etc.).",
        evidence: `${highDiv.length} decks with >=5 archetypes: avg grid ${hdGrid.toFixed(1)}/10`,
        weight: "strong",
      });
      lines.push(`- **>=5 archetypes**: avg grid ${hdGrid.toFixed(1)}/10 (n=${highDiv.length})`);
    }
    if (lowDiv.length > 0) {
      const ldGrid = avg(lowDiv.map(e => e.scores.dimensions.grid));
      lines.push(`- **<4 archetypes**: avg grid ${ldGrid.toFixed(1)}/10 (n=${lowDiv.length})`);
    }

    // Consecutive same-archetype runs
    const consecData = withGrid.map(e => ({
      maxConsec: e.fingerprint.zones.maxConsecutiveSame,
      coherence: e.scores.dimensions.coherence,
    })).filter(d => d.coherence !== null && d.coherence !== undefined);

    if (consecData.length >= 2) {
      const highConsec = consecData.filter(d => d.maxConsec >= 3);
      const lowConsec = consecData.filter(d => d.maxConsec <= 2);
      if (highConsec.length > 0 && lowConsec.length > 0) {
        const hcCoherence = avg(highConsec.map(d => d.coherence));
        const lcCoherence = avg(lowConsec.map(d => d.coherence));
        rules.push({
          id: "grid-no-consecutive-runs",
          rule: "Limit consecutive same-archetype slides to <=2. Runs of 3+ reduce coherence-variance.",
          evidence: `maxConsec>=3: avg coherence ${hcCoherence.toFixed(1)} vs maxConsec<=2: avg ${lcCoherence.toFixed(1)}`,
          weight: "moderate",
        });
        lines.push(`- **Consecutive same archetype >=3**: avg coherence ${hcCoherence.toFixed(1)} vs <=2: ${lcCoherence.toFixed(1)}`);
      }
    }

    // Zone start diversity
    const colStartData = withGrid.map(e => e.fingerprint.zones.uniqueColStarts);
    if (colStartData.length >= 2) {
      const medStarts = median(colStartData);
      lines.push(`- **Column start variety**: median ${medStarts} unique col starts`);
      rules.push({
        id: "grid-col-start-variety",
        rule: `Vary zone col starts across ${Math.max(8, Math.round(medStarts))}+ unique positions. Avoids monotonous left-anchoring.`,
        evidence: `Corpus median: ${medStarts} unique col starts`,
        weight: "moderate",
      });
    }
  }

  // ── 3. Typography rules ───────────────────────────────────────────

  lines.push("");
  lines.push("## Typography");
  lines.push("");

  const withTypo = usable.filter(e => e.fingerprint.typography.titleSizeAvg);

  if (withTypo.length >= 2) {
    const titleAvgs = withTypo.map(e => e.fingerprint.typography.titleSizeAvg);
    const medTitle = median(titleAvgs);
    lines.push(`- **Title size**: median avg ${medTitle}px across corpus`);

    // Correlate with content completeness
    const withContent = withTypo.filter(e => {
      const s = e.scores.dimensions.contentCompleteness;
      return s !== null && s !== undefined;
    });
    if (withContent.length >= 2) {
      const largeTitles = withContent.filter(e => e.fingerprint.typography.titleSizeAvg > 48);
      const normalTitles = withContent.filter(e => e.fingerprint.typography.titleSizeAvg <= 44);
      if (largeTitles.length > 0 && normalTitles.length > 0) {
        const ltContent = avg(largeTitles.map(e => e.scores.dimensions.contentCompleteness));
        const ntContent = avg(normalTitles.map(e => e.scores.dimensions.contentCompleteness));
        lines.push(`- **Large titles (avg >48px)**: avg contentCompleteness ${ltContent.toFixed(1)} (n=${largeTitles.length})`);
        lines.push(`- **Normal titles (avg <=44px)**: avg contentCompleteness ${ntContent.toFixed(1)} (n=${normalTitles.length})`);
        rules.push({
          id: "typography-title-cap",
          rule: "Cap average title size at 44px. Larger titles correlate with content overflow.",
          evidence: `avg>48px: content ${ltContent.toFixed(1)} vs avg<=44px: content ${ntContent.toFixed(1)}`,
          weight: largeTitles.length >= 2 ? "strong" : "suggestive",
        });
      }
    }

    // Font variety
    const fontCounts = withTypo.map(e => Object.keys(e.fingerprint.typography.fontUsage).length);
    const medFonts = median(fontCounts);
    lines.push(`- **Font variety**: median ${medFonts} fonts per deck`);
    rules.push({
      id: "typography-font-variety",
      rule: `Use ${Math.max(2, Math.round(medFonts))}+ fonts with intentional alternation (serif/sans/mono).`,
      evidence: `Corpus median: ${medFonts} fonts per deck`,
      weight: "moderate",
    });
  }

  // ── 4. Accent rules ───────────────────────────────────────────────

  lines.push("");
  lines.push("## Accents");
  lines.push("");

  const withAccents = usable.filter(e => e.fingerprint.accents);

  if (withAccents.length >= 2) {
    const accentPcts = withAccents.map(e => e.fingerprint.accents.accentPct);
    const medAccent = median(accentPcts);
    lines.push(`- **Accent frequency**: median ${medAccent}% of slides have accents`);

    // Most common accent types
    const typeTotals = {};
    for (const e of withAccents) {
      for (const [t, c] of Object.entries(e.fingerprint.accents.types)) {
        typeTotals[t] = (typeTotals[t] || 0) + c;
      }
    }
    const sortedTypes = Object.entries(typeTotals).sort((a, b) => b[1] - a[1]);
    if (sortedTypes.length > 0) {
      lines.push(`- **Most used accent types**: ${sortedTypes.map(([t, c]) => `${t} (${c}x)`).join(", ")}`);
    }

    rules.push({
      id: "accents-frequency",
      rule: `Target ~${Math.round(medAccent)}% of slides with accent elements. Over-accenting reduces clarity.`,
      evidence: `Corpus median: ${medAccent}% accent frequency`,
      weight: "moderate",
    });
  }

  // ── 5. Content completeness rules ─────────────────────────────────

  lines.push("");
  lines.push("## Content Completeness");
  lines.push("");

  const withContentScores = usable.filter(e => {
    const s = e.scores.dimensions.contentCompleteness;
    return s !== null && s !== undefined;
  });

  if (withContentScores.length >= 2) {
    const contentScores = withContentScores.map(e => e.scores.dimensions.contentCompleteness);
    const medContent = median(contentScores);
    lines.push(`- **Corpus median content score**: ${medContent}/10`);

    // This is commonly the weakest dimension — highlight it
    if (medContent < 7) {
      rules.push({
        id: "content-is-weakest",
        rule: "Content completeness is the weakest dimension in the corpus. Prioritize: remove empty body zones from image-only slides, expand table zones, verify all body text has a zone.",
        evidence: `Median content score: ${medContent}/10 (lowest across dimensions)`,
        weight: "strong",
      });
      lines.push(`- **Content completeness is the weakest dimension** — prioritize zone-content matching`);
    }
  }

  // ── 6. Intensity profile insights ─────────────────────────────────

  lines.push("");
  lines.push("## Intensity Profile Patterns");
  lines.push("");

  const byIntensity = {};
  for (const e of usable) {
    const int = e.fingerprint.inferredIntensity;
    if (!byIntensity[int]) byIntensity[int] = [];
    byIntensity[int].push(e);
  }

  for (const [intensity, entries] of Object.entries(byIntensity)) {
    const scores = entries.map(e => e.scores.normalized);
    const avgScore = avg(scores);
    lines.push(`- **${intensity}**: avg normalized score ${avgScore.toFixed(0)}% (n=${entries.length})`);

    // Per-dimension averages for this intensity
    const dimAvgs = {};
    for (const e of entries) {
      for (const [d, s] of Object.entries(e.scores.dimensions)) {
        if (s !== null && s !== undefined) {
          if (!dimAvgs[d]) dimAvgs[d] = [];
          dimAvgs[d].push(s);
        }
      }
    }
    const weakDims = Object.entries(dimAvgs)
      .map(([d, vals]) => [d, avg(vals)])
      .filter(([, a]) => a < 6)
      .sort((a, b) => a[1] - b[1]);

    if (weakDims.length > 0) {
      lines.push(`  - Weak dimensions: ${weakDims.map(([d, a]) => `${d} (${a.toFixed(1)})`).join(", ")}`);
    }
  }

  // ── 7. Best/worst deck exemplars ──────────────────────────────────

  lines.push("");
  lines.push("## Exemplar Decks");
  lines.push("");

  const sorted = [...usable].sort((a, b) => b.scores.normalized - a.scores.normalized);
  if (sorted.length > 0) {
    const best = sorted[0];
    lines.push(`**Best**: ${best.deck} (${best.scores.normalized}% — ${best.scores.tier})`);
    if (best.fingerprint) {
      lines.push(`  - Intensity: ${best.fingerprint.inferredIntensity}`);
      lines.push(`  - Palette: ${best.fingerprint.palette.backgrounds.length} bgs, ${best.fingerprint.palette.lightPct}% light`);
      lines.push(`  - Archetypes: ${best.fingerprint.zones.uniqueArchetypes} unique`);
      lines.push(`  - Fonts: ${Object.keys(best.fingerprint.typography.fontUsage).join(", ")}`);
    }

    if (sorted.length >= 2) {
      const worst = sorted[sorted.length - 1];
      lines.push(`\n**Weakest**: ${worst.deck} (${worst.scores.normalized}% — ${worst.scores.tier})`);
      if (worst.fingerprint) {
        lines.push(`  - Intensity: ${worst.fingerprint.inferredIntensity}`);
        lines.push(`  - Palette: ${worst.fingerprint.palette.backgrounds.length} bgs, ${worst.fingerprint.palette.lightPct}% light`);
        lines.push(`  - Archetypes: ${worst.fingerprint.zones.uniqueArchetypes} unique`);
      }
    }
  }

  // ── 8. Compile rules section (machine-readable) ───────────────────

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Composition Rules (for Claude prompts)");
  lines.push("");
  lines.push("_These rules are extracted by corpus-synthesize.js and injected into compose.js._");
  lines.push("");

  // Sort by weight (strong first)
  const weightOrder = { strong: 0, moderate: 1, suggestive: 2 };
  rules.sort((a, b) => (weightOrder[a.weight] || 9) - (weightOrder[b.weight] || 9));

  for (const r of rules) {
    const icon = r.weight === "strong" ? "MUST" : r.weight === "moderate" ? "SHOULD" : "CONSIDER";
    lines.push(`- **[${icon}]** ${r.rule}`);
    lines.push(`  _Evidence: ${r.evidence}_`);
  }

  return { insights: lines.join("\n"), rules };
}

// ─── CLI ────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const doScan = args.includes("--scan");
  const doEval = args.includes("--eval");

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("corpus-synthesize")}\n`);

  let corpus;
  if (doScan) {
    process.stderr.write(`  ${dim("Running deck-audit scan first...")}\n`);
    const entries = auditAll({ eval: doEval });
    corpus = entries;
  } else {
    corpus = loadCorpus();
  }

  if (corpus.length === 0) {
    process.stderr.write(`  ${accent("Error:")} No corpus entries. Run 'node deck-audit.js' first.\n`);
    process.exit(1);
  }

  process.stderr.write(`  ${dim("Corpus:")} ${corpus.length} entries\n`);

  const { insights, rules } = synthesize(corpus);

  // Save insights file
  fs.writeFileSync(INSIGHTS_PATH, insights + "\n");
  process.stderr.write(`  ${teal("Saved:")} ${INSIGHTS_PATH}\n`);
  process.stderr.write(`  ${dim("Rules:")} ${rules.length} composition rules extracted\n\n`);

  // Print to stdout
  console.log(insights);
}

module.exports = { synthesize, loadCorpus: loadCorpus };
