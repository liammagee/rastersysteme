#!/usr/bin/env node
/**
 * deck-audit — Scan decks/, pair each with its composed source + scores,
 * extract design fingerprints, and build a structured design corpus.
 *
 * For each deck:
 *   1. Find the HTML file and its corresponding .composed.md
 *   2. Extract a design fingerprint (brief-extract.js)
 *   3. Load existing scorecard OR run rubric-eval.js
 *   4. Write a corpus entry to design-corpus/<name>.json
 *   5. Print a consolidated report
 *
 * Usage:
 *   node deck-audit.js                    # scan all decks/
 *   node deck-audit.js --eval             # also run rubric-eval on unscored decks
 *   node deck-audit.js --deck week-2-v3   # audit a single deck
 *   node deck-audit.js --report           # only print report from existing corpus
 *
 * Module API:
 *   const { auditDeck, auditAll, loadCorpus, generateReport } = require('./deck-audit');
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const chalk = require("chalk");
const { extractFingerprint } = require("./brief-extract.js");
const { getTier } = require("./rubric-persist.js");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

// Normalize dimension names across scorecard formats
const DIM_ALIASES = {
  gridUtilization: "grid",
  colorHarmonics: "color",
  imageIntegration: "images",
  coherenceVariance: "coherence",
  layoutBalance: "balance",
};

function normalizeDimName(name) {
  return DIM_ALIASES[name] || name;
}

function normalizeScoreDims(scores) {
  const out = {};
  for (const [k, v] of Object.entries(scores)) {
    // Some formats store {score: N, source: ..., note: ...} — extract the number
    const val = (v && typeof v === "object" && "score" in v) ? v.score : v;
    out[normalizeDimName(k)] = val;
  }
  return out;
}

const DECKS_DIR = path.join(__dirname, "decks");
const CORPUS_DIR = path.join(__dirname, "design-corpus");
const QA_DIR = path.join(__dirname, "logs", "qa");

// ─── Find composed source for an HTML file ──────────────────────────

function findComposedSource(htmlPath) {
  const dir = path.dirname(htmlPath);
  const base = path.basename(htmlPath, ".html");

  // Try several naming conventions
  const candidates = [
    path.join(dir, `${base}.composed.md`),
    path.join(dir, `${base}.md`),
    // Check for compose/ directory (per-slide compose output)
    path.join(dir, `${base}.compose`),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      if (fs.statSync(c).isDirectory()) {
        // Per-slide compose directory — reconstruct composed markdown
        return { type: "compose-dir", path: c };
      }
      return { type: "file", path: c };
    }
  }

  return null;
}

// ─── Reconstruct composed markdown from compose/ directory ──────────

function reconstructFromComposeDir(composeDir) {
  const files = fs.readdirSync(composeDir)
    .filter(f => f.match(/^slide-\d+\.md$/))
    .sort();

  if (files.length === 0) return null;

  const slides = files.map(f => fs.readFileSync(path.join(composeDir, f), "utf-8").trim());
  return slides.join("\n\n---\n\n");
}

// ─── Load scorecard (either format) ─────────────────────────────────

function loadScores(htmlPath) {
  const base = path.basename(htmlPath, ".html");
  const scorecardFile = path.join(QA_DIR, `${base}-scorecard.json`);

  if (!fs.existsSync(scorecardFile)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(scorecardFile, "utf-8"));

    // Format 1: rubric-persist.js schema (has $schema key)
    if (data.$schema === "rubric-scorecard-v1") {
      return data.latest ? {
        format: "persist",
        scores: normalizeScoreDims({ ...(data.latest.computed || {}), ...(data.latest.visual || {}), ...(data.latest.textual || {}) }),
        total: data.latest.total,
        max: data.latest.max,
        normalized: data.latest.normalized,
        tier: data.latest.tier,
        trajectory: data.trajectory,
        runCount: data.runs.length,
      } : null;
    }

    // Format 2: flat array from rubric-eval.js [{iteration, metrics, scores, ...}]
    if (Array.isArray(data) && data.length > 0) {
      const latest = data[data.length - 1];
      return {
        format: "eval-array",
        scores: normalizeScoreDims(latest.scores),
        metrics: latest.metrics,
        total: latest.computedTotal,
        max: latest.maxComputed,
        normalized: latest.maxComputed > 0 ? Math.round((latest.computedTotal / latest.maxComputed) * 100) : 0,
        tier: getTier(latest.maxComputed > 0 ? Math.round((latest.computedTotal / latest.maxComputed) * 100) : 0),
        runCount: data.length,
        trajectory: data.map((d, i) => ({
          iteration: i,
          total: d.computedTotal,
          max: d.maxComputed,
          normalized: d.maxComputed > 0 ? Math.round((d.computedTotal / d.maxComputed) * 100) : 0,
        })),
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Run rubric-eval.js on an HTML file ─────────────────────────────

function runEval(htmlPath) {
  const result = spawnSync("node", [path.join(__dirname, "rubric-eval.js"), htmlPath, "--json"], {
    encoding: "utf-8",
    timeout: 30000,
  });

  if (result.status !== 0) {
    process.stderr.write(`  ${accent("!")} eval failed for ${path.basename(htmlPath)}: ${(result.stderr || "").slice(0, 200)}\n`);
    return null;
  }

  try {
    const data = JSON.parse(result.stdout);
    if (Array.isArray(data) && data.length > 0) {
      const latest = data[0];
      return {
        format: "eval-fresh",
        scores: normalizeScoreDims(latest.scores),
        metrics: latest.metrics,
        total: latest.computedTotal,
        max: latest.maxComputed,
        normalized: latest.maxComputed > 0 ? Math.round((latest.computedTotal / latest.maxComputed) * 100) : 0,
        tier: getTier(latest.maxComputed > 0 ? Math.round((latest.computedTotal / latest.maxComputed) * 100) : 0),
        runCount: 1,
      };
    }
  } catch {
    // parse failure
  }
  return null;
}

// ─── Identify strengths and weaknesses from scores ──────────────────

function analyzeScores(scores) {
  if (!scores) return { strengths: [], weaknesses: [], missing: [] };

  const strengths = [];
  const weaknesses = [];
  const missing = [];

  for (const [dim, score] of Object.entries(scores)) {
    if (score === null || score === undefined) {
      missing.push(dim);
    } else if (score >= 8) {
      strengths.push({ dim, score });
    } else if (score < 6) {
      weaknesses.push({ dim, score });
    }
  }

  strengths.sort((a, b) => b.score - a.score);
  weaknesses.sort((a, b) => a.score - b.score);

  return { strengths, weaknesses, missing };
}

// ─── Derive lessons from fingerprint + scores ───────────────────────

function deriveLessons(fingerprint, scoreData) {
  if (!scoreData || !fingerprint) return [];
  const lessons = [];
  const scores = scoreData.scores;
  const fp = fingerprint;

  // Accessibility lessons
  if (scores.accessibility !== null && scores.accessibility !== undefined) {
    if (scores.accessibility < 5 && fp.palette.darkCount > fp.slideCount * 0.4) {
      lessons.push({
        dimension: "accessibility",
        finding: "Heavy dark palette correlated with low accessibility",
        parameter: `${fp.palette.darkCount}/${fp.slideCount} dark slides (${100 - fp.palette.lightPct}%)`,
        recommendation: "Reduce dark backgrounds to <20% of slides; use >7:1 contrast text on dark",
      });
    }
    if (scores.accessibility < 5 && fp.palette.lightPct < 60) {
      lessons.push({
        dimension: "accessibility",
        finding: "Insufficient light orientation",
        parameter: `lightPct=${fp.palette.lightPct}%`,
        recommendation: "Target >=80% light backgrounds per design-lessons.md",
      });
    }
  }

  // Grid lessons
  if (scores.grid !== null && scores.grid !== undefined) {
    if (scores.grid < 7 && fp.zones.uniqueArchetypes < 4) {
      lessons.push({
        dimension: "grid",
        finding: "Low archetype diversity correlated with grid score",
        parameter: `${fp.zones.uniqueArchetypes} unique archetypes`,
        recommendation: "Rotate through >=4 archetypes; no 2 adjacent slides same archetype",
      });
    }
    if (scores.grid >= 9 && fp.zones.uniqueArchetypes >= 5) {
      lessons.push({
        dimension: "grid",
        finding: "High archetype diversity produces strong grid scores",
        parameter: `${fp.zones.uniqueArchetypes} archetypes, ${fp.zones.uniqueColStarts} col starts`,
        recommendation: "Maintain this level of zone variety in future compositions",
        positive: true,
      });
    }
  }

  // Color lessons
  if (scores.color !== null && scores.color !== undefined) {
    if (scores.color < 7 && fp.palette.backgrounds.length < 4) {
      lessons.push({
        dimension: "color",
        finding: "Limited palette correlated with low color score",
        parameter: `${fp.palette.backgrounds.length} unique backgrounds`,
        recommendation: "Use >=4 unique backgrounds with chromatic arc (light/dark transitions)",
      });
    }
    if (scores.color >= 9 && fp.palette.arcCrossings >= 3) {
      lessons.push({
        dimension: "color",
        finding: "Strong chromatic arc produces excellent color scores",
        parameter: `${fp.palette.arcCrossings} light/dark crossings`,
        recommendation: "Maintain >=3 arc crossings per deck",
        positive: true,
      });
    }
  }

  // Coherence lessons
  if (scores.coherence !== null && scores.coherence !== undefined) {
    if (scores.coherence < 7 && fp.zones.maxConsecutiveSame >= 3) {
      lessons.push({
        dimension: "coherence",
        finding: "Consecutive same-archetype runs reduce coherence score",
        parameter: `maxConsecutiveSame=${fp.zones.maxConsecutiveSame}`,
        recommendation: "Break runs of >2 consecutive same-archetype slides",
      });
    }
    if (scores.coherence < 7 && Object.keys(fp.typography.fontUsage).length < 2) {
      lessons.push({
        dimension: "coherence",
        finding: "Monotonous font usage reduces coherence-variance",
        parameter: `${Object.keys(fp.typography.fontUsage).length} font(s)`,
        recommendation: "Use 2-3 fonts with intentional alternation (not random)",
      });
    }
  }

  // Content completeness lessons
  if (scores.contentCompleteness !== null && scores.contentCompleteness !== undefined) {
    const metrics = scoreData.metrics;
    if (scores.contentCompleteness < 6 && metrics) {
      if (metrics.emptyBodyZones > 3) {
        lessons.push({
          dimension: "contentCompleteness",
          finding: "Excessive empty body zones degrade content score",
          parameter: `${metrics.emptyBodyZones} empty body zones`,
          recommendation: "Remove body zones from image-only slides; match zone roles to content",
        });
      }
      if (metrics.tableTruncations > 0) {
        lessons.push({
          dimension: "contentCompleteness",
          finding: "Table truncation causes content loss",
          parameter: `${metrics.tableTruncations} tables truncated`,
          recommendation: "Tables need span>=50 and rowSpan>=30 with body size 10-11px",
        });
      }
    }
  }

  // Image integration lessons
  if (scores.images !== null && scores.images !== undefined) {
    if (scores.images < 7 && fp.accents.accentPct > 60) {
      lessons.push({
        dimension: "images",
        finding: "Excessive accents may conflict with image integration",
        parameter: `${fp.accents.accentPct}% slides with accents`,
        recommendation: "Reduce accent density on image-heavy slides",
      });
    }
  }

  // Typography-related cross-dimension lessons
  if (fp.typography.titleSizeAvg && fp.typography.titleSizeAvg > 52) {
    lessons.push({
      dimension: "typography",
      finding: "Large average title size risks overflow on content-heavy slides",
      parameter: `avgTitleSize=${fp.typography.titleSizeAvg}px`,
      recommendation: "Cap titles at 44px for most slides; reserve 48-52px for section dividers",
    });
  }

  return lessons;
}

// ─── Audit a single deck ────────────────────────────────────────────

function auditDeck(htmlPath, opts = {}) {
  const base = path.basename(htmlPath, ".html");
  const source = findComposedSource(htmlPath);

  let fingerprint = null;
  if (source) {
    if (source.type === "compose-dir") {
      const reconstructed = reconstructFromComposeDir(source.path);
      if (reconstructed) {
        // Write temp file for fingerprint extraction
        const tmpPath = path.join(CORPUS_DIR, `_tmp_${base}.md`);
        fs.mkdirSync(CORPUS_DIR, { recursive: true });
        fs.writeFileSync(tmpPath, reconstructed);
        fingerprint = extractFingerprint(tmpPath);
        fs.unlinkSync(tmpPath);
      }
    } else {
      fingerprint = extractFingerprint(source.path);
    }
  }

  // Load or run scores
  let scoreData = loadScores(htmlPath);
  if (!scoreData && opts.eval) {
    process.stderr.write(`  ${dim("Evaluating")} ${base}...\n`);
    scoreData = runEval(htmlPath);
  }

  // Analyze
  const analysis = scoreData ? analyzeScores(scoreData.scores) : { strengths: [], weaknesses: [], missing: [] };
  const lessons = deriveLessons(fingerprint, scoreData);

  const entry = {
    deck: base,
    htmlPath,
    sourcePath: source ? source.path : null,
    sourceType: source ? source.type : null,
    timestamp: new Date().toISOString(),

    fingerprint: fingerprint && !fingerprint.error ? {
      slideCount: fingerprint.slideCount,
      directiveFormat: fingerprint.directiveFormat,
      inferredIntensity: fingerprint.inferredIntensity,
      palette: fingerprint.palette,
      typography: fingerprint.typography,
      zones: {
        archetypes: fingerprint.zones.archetypes,
        uniqueArchetypes: fingerprint.zones.uniqueArchetypes,
        maxConsecutiveSame: fingerprint.zones.maxConsecutiveSame,
        uniqueColStarts: fingerprint.zones.uniqueColStarts,
        uniqueSpanWidths: fingerprint.zones.uniqueSpanWidths,
      },
      accents: fingerprint.accents,
    } : null,

    scores: scoreData ? {
      dimensions: scoreData.scores,
      total: scoreData.total,
      max: scoreData.max,
      normalized: scoreData.normalized,
      tier: scoreData.tier,
      runCount: scoreData.runCount,
    } : null,

    analysis: {
      strengths: analysis.strengths.map(s => s.dim),
      weaknesses: analysis.weaknesses.map(w => `${w.dim} (${w.score})`),
      missing: analysis.missing,
    },

    lessons,
  };

  return entry;
}

// ─── Discover all auditable decks ───────────────────────────────────

function discoverDecks() {
  const htmlFiles = [];

  function walk(dir, depth = 0) {
    if (depth > 3) return; // Don't recurse too deep
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith(".")) {
        walk(full, depth + 1);
      } else if (e.isFile() && e.name.endsWith(".html") && !e.name.startsWith("_")) {
        htmlFiles.push(full);
      }
    }
  }

  walk(DECKS_DIR);

  // Deduplicate: prefer non-compare versions when both exist
  const byBase = {};
  for (const f of htmlFiles) {
    const base = path.basename(f, ".html");
    const isCompare = f.includes("compare-");
    if (!byBase[base] || (!isCompare && byBase[base].isCompare)) {
      byBase[base] = { path: f, isCompare };
    }
  }

  return Object.values(byBase).map(v => v.path).sort();
}

// ─── Audit all decks ────────────────────────────────────────────────

function auditAll(opts = {}) {
  const decks = opts.decks || discoverDecks();
  fs.mkdirSync(CORPUS_DIR, { recursive: true });

  const entries = [];
  const total = decks.length;

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("deck-audit")}\n`);
  process.stderr.write(`  ${dim("Scanning")} ${total} decks...\n\n`);

  for (let i = 0; i < decks.length; i++) {
    const deck = decks[i];
    const base = path.basename(deck, ".html");
    process.stderr.write(`  ${dim(`[${i + 1}/${total}]`)} ${base}...`);

    const entry = auditDeck(deck, opts);
    entries.push(entry);

    // Save individual corpus entry
    const outPath = path.join(CORPUS_DIR, `${base}.json`);
    fs.writeFileSync(outPath, JSON.stringify(entry, null, 2) + "\n");

    // Status indicator
    if (entry.scores) {
      const tier = entry.scores.tier;
      const icon = tier === "Exhibition" || tier === "Professional" ? sage("●")
        : tier === "Competent" ? amber("●")
        : accent("●");
      process.stderr.write(` ${icon} ${dim(tier)} ${dim(`(${entry.scores.normalized}%)`)}`);
    } else {
      process.stderr.write(` ${dim("○ no scores")}`);
    }
    if (entry.fingerprint) {
      process.stderr.write(` ${dim(entry.fingerprint.inferredIntensity)}`);
    } else {
      process.stderr.write(` ${dim("no source")}`);
    }
    process.stderr.write("\n");
  }

  return entries;
}

// ─── Load existing corpus ───────────────────────────────────────────

function loadCorpus() {
  if (!fs.existsSync(CORPUS_DIR)) return [];
  const files = fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith(".json") && !f.startsWith("_"));
  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, f), "utf-8"));
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// ─── Generate report from corpus ────────────────────────────────────

function generateReport(entries) {
  const scored = entries.filter(e => e.scores);
  const fingerprintedAndScored = scored.filter(e => e.fingerprint);

  const lines = [];
  lines.push("# Deck Audit Report");
  lines.push(`\nGenerated: ${new Date().toISOString().split("T")[0]}`);
  lines.push(`Decks scanned: ${entries.length}`);
  lines.push(`Decks with scores: ${scored.length}`);
  lines.push(`Decks with fingerprints + scores: ${fingerprintedAndScored.length}`);

  // ── Tier distribution ──
  lines.push("\n## Tier Distribution\n");
  const tiers = { Exhibition: 0, Professional: 0, Competent: 0, Draft: 0, Broken: 0 };
  for (const e of scored) tiers[e.scores.tier]++;
  for (const [tier, count] of Object.entries(tiers)) {
    if (count > 0) lines.push(`- **${tier}**: ${count}`);
  }

  // ── Dimension averages ──
  lines.push("\n## Average Scores by Dimension\n");
  const dimSums = {};
  const dimCounts = {};
  for (const e of scored) {
    for (const [d, s] of Object.entries(e.scores.dimensions)) {
      if (s !== null && s !== undefined) {
        dimSums[d] = (dimSums[d] || 0) + s;
        dimCounts[d] = (dimCounts[d] || 0) + 1;
      }
    }
  }
  const dimAvgs = Object.entries(dimSums)
    .map(([d, sum]) => [d, +(sum / dimCounts[d]).toFixed(1)])
    .sort((a, b) => b[1] - a[1]);
  for (const [d, avg] of dimAvgs) {
    const icon = avg >= 8 ? "+" : avg >= 6 ? "~" : "-";
    lines.push(`| ${d.padEnd(22)} | ${String(avg).padStart(4)} | ${icon} |`);
  }

  // ── Common weaknesses ──
  lines.push("\n## Most Common Weaknesses\n");
  const weaknessCounts = {};
  for (const e of scored) {
    for (const w of e.analysis.weaknesses) {
      const dim = w.replace(/\s*\(.*/, "");
      weaknessCounts[dim] = (weaknessCounts[dim] || 0) + 1;
    }
  }
  const sortedWeaknesses = Object.entries(weaknessCounts).sort((a, b) => b[1] - a[1]);
  for (const [dim, count] of sortedWeaknesses.slice(0, 5)) {
    lines.push(`- **${dim}**: weak in ${count}/${scored.length} decks`);
  }

  // ── Parameter-score correlations ──
  if (fingerprintedAndScored.length >= 3) {
    lines.push("\n## Parameter-Score Correlations\n");
    lines.push("_Based on " + fingerprintedAndScored.length + " decks with both fingerprints and scores._\n");

    // Intensity vs scores
    const byIntensity = {};
    for (const e of fingerprintedAndScored) {
      const int = e.fingerprint.inferredIntensity;
      if (!byIntensity[int]) byIntensity[int] = [];
      byIntensity[int].push(e.scores.normalized);
    }
    lines.push("### Intensity Profile vs Score");
    for (const [int, scores] of Object.entries(byIntensity)) {
      const avg = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0);
      lines.push(`- **${int}**: avg ${avg}% (n=${scores.length})`);
    }

    // Light percentage vs accessibility
    const accessScored = fingerprintedAndScored.filter(
      e => e.scores.dimensions.accessibility !== null && e.scores.dimensions.accessibility !== undefined
    );
    if (accessScored.length >= 3) {
      const highLight = accessScored.filter(e => e.fingerprint.palette.lightPct >= 80);
      const lowLight = accessScored.filter(e => e.fingerprint.palette.lightPct < 60);
      if (highLight.length > 0 && lowLight.length > 0) {
        const hlAvg = +(highLight.reduce((s, e) => s + e.scores.dimensions.accessibility, 0) / highLight.length).toFixed(1);
        const llAvg = +(lowLight.reduce((s, e) => s + e.scores.dimensions.accessibility, 0) / lowLight.length).toFixed(1);
        lines.push(`\n### Light Orientation vs Accessibility`);
        lines.push(`- **>=80% light backgrounds**: avg accessibility ${hlAvg} (n=${highLight.length})`);
        lines.push(`- **<60% light backgrounds**: avg accessibility ${llAvg} (n=${lowLight.length})`);
      }
    }

    // Archetype diversity vs grid score
    const gridScored = fingerprintedAndScored.filter(
      e => e.scores.dimensions.grid !== null && e.scores.dimensions.grid !== undefined
        && e.fingerprint.zones.uniqueArchetypes > 0
    );
    if (gridScored.length >= 3) {
      const highDiv = gridScored.filter(e => e.fingerprint.zones.uniqueArchetypes >= 5);
      const lowDiv = gridScored.filter(e => e.fingerprint.zones.uniqueArchetypes < 4);
      if (highDiv.length > 0 || lowDiv.length > 0) {
        lines.push(`\n### Archetype Diversity vs Grid Score`);
        if (highDiv.length > 0) {
          const avg = +(highDiv.reduce((s, e) => s + e.scores.dimensions.grid, 0) / highDiv.length).toFixed(1);
          lines.push(`- **>=5 archetypes**: avg grid ${avg} (n=${highDiv.length})`);
        }
        if (lowDiv.length > 0) {
          const avg = +(lowDiv.reduce((s, e) => s + e.scores.dimensions.grid, 0) / lowDiv.length).toFixed(1);
          lines.push(`- **<4 archetypes**: avg grid ${avg} (n=${lowDiv.length})`);
        }
      }
    }
  }

  // ── Aggregated lessons ──
  const allLessons = entries.flatMap(e => e.lessons || []);
  if (allLessons.length > 0) {
    lines.push("\n## Derived Lessons\n");

    // Deduplicate by finding+dimension
    const seen = new Set();
    const uniqueLessons = [];
    for (const l of allLessons) {
      const key = `${l.dimension}:${l.finding}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueLessons.push(l);
      }
    }

    // Count occurrences
    const lessonCounts = {};
    for (const l of allLessons) {
      const key = `${l.dimension}:${l.finding}`;
      lessonCounts[key] = (lessonCounts[key] || 0) + 1;
    }

    // Sort by frequency
    uniqueLessons.sort((a, b) => {
      const ka = `${a.dimension}:${a.finding}`;
      const kb = `${b.dimension}:${b.finding}`;
      return (lessonCounts[kb] || 0) - (lessonCounts[ka] || 0);
    });

    for (const l of uniqueLessons) {
      const key = `${l.dimension}:${l.finding}`;
      const count = lessonCounts[key] || 1;
      const icon = l.positive ? "+" : "-";
      lines.push(`${icon} **${l.dimension}** (${count}x): ${l.finding}`);
      lines.push(`  _${l.recommendation}_`);
    }
  }

  // ── Per-deck summary table ──
  lines.push("\n## Per-Deck Summary\n");
  lines.push("| Deck | Tier | Score | Intensity | Strengths | Weaknesses |");
  lines.push("|------|------|-------|-----------|-----------|------------|");
  for (const e of entries) {
    const tier = e.scores ? e.scores.tier : "—";
    const score = e.scores ? `${e.scores.normalized}%` : "—";
    const intensity = e.fingerprint ? e.fingerprint.inferredIntensity : "—";
    const strengths = e.analysis.strengths.slice(0, 3).join(", ") || "—";
    const weaknesses = e.analysis.weaknesses.slice(0, 2).join(", ") || "—";
    lines.push(`| ${e.deck} | ${tier} | ${score} | ${intensity} | ${strengths} | ${weaknesses} |`);
  }

  return lines.join("\n");
}

// ─── CLI ────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const doEval = args.includes("--eval");
  const reportOnly = args.includes("--report");
  const deckFilter = args.find(a => a.startsWith("--deck="))?.split("=")[1]
    || (args.indexOf("--deck") >= 0 ? args[args.indexOf("--deck") + 1] : null);

  let entries;

  if (reportOnly) {
    entries = loadCorpus();
    if (entries.length === 0) {
      console.error(`${accent("Error:")} No corpus entries found. Run without --report first.`);
      process.exit(1);
    }
  } else if (deckFilter) {
    // Single deck mode
    const htmlPath = path.join(DECKS_DIR, `${deckFilter}.html`);
    if (!fs.existsSync(htmlPath)) {
      console.error(`${accent("Error:")} Deck not found: ${htmlPath}`);
      process.exit(1);
    }
    entries = [auditDeck(htmlPath, { eval: doEval })];
    fs.mkdirSync(CORPUS_DIR, { recursive: true });
    const outPath = path.join(CORPUS_DIR, `${deckFilter}.json`);
    fs.writeFileSync(outPath, JSON.stringify(entries[0], null, 2) + "\n");
    process.stderr.write(`  ${teal("Saved:")} ${outPath}\n`);
  } else {
    entries = auditAll({ eval: doEval });
  }

  const report = generateReport(entries);

  // Save report
  fs.mkdirSync(CORPUS_DIR, { recursive: true });
  const reportPath = path.join(CORPUS_DIR, "audit-report.md");
  fs.writeFileSync(reportPath, report + "\n");
  process.stderr.write(`\n  ${teal("Report:")} ${reportPath}\n\n`);

  // Print to stdout
  console.log(report);
}

module.exports = { auditDeck, auditAll, loadCorpus, generateReport, discoverDecks, findComposedSource, loadScores, deriveLessons };
