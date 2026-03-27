#!/usr/bin/env node
/**
 * brief-extract — Extract a structured "design fingerprint" from a composed markdown file.
 *
 * Parses all <!-- design: {...} --> directives and summarizes:
 *   - Zone archetypes and rotation pattern
 *   - Background palette and chromatic arc
 *   - Font usage distribution
 *   - Typography ranges (title sizes, body sizes, weights)
 *   - Accent patterns (types, colors, frequency)
 *   - Design plan (if embedded)
 *   - Intensity profile (inferred from parameter distribution)
 *
 * Usage:
 *   node brief-extract.js <file.composed.md>         # print fingerprint JSON
 *   node brief-extract.js <file.composed.md> --save   # save to design-corpus/
 *
 * Module API:
 *   const { extractFingerprint } = require('./brief-extract.js');
 *   const fp = extractFingerprint('path/to/file.composed.md');
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;

// ─── Zone archetype classifier ──────────────────────────────────────
// Maps zone arrangements to named archetypes for pattern analysis.

function classifyArchetype(zones) {
  if (!zones || zones.length === 0) return "empty";

  const titleZone = zones.find(z => z.role === "title");
  const bodyZone = zones.find(z => z.role === "body" || z.role === "bullets");
  const imageZone = zones.find(z => z.role === "image");

  if (!titleZone && !bodyZone) {
    if (imageZone) return "image-only";
    return "minimal";
  }

  if (titleZone && !bodyZone && !imageZone) return "title-only";

  const tc = titleZone ? titleZone.col : 0;
  const ts = titleZone ? titleZone.span : 0;
  const bc = bodyZone ? bodyZone.col : 0;
  const bs = bodyZone ? bodyZone.span : 0;

  // Classify by spatial relationship
  if (tc >= 25 && ts <= 30) return "right-anchored";
  if (tc <= 8 && ts >= 44) return "monument";
  if (tc <= 8 && ts <= 30 && bc >= 28) return "sidebar-left";
  if (tc >= 10 && tc <= 20 && ts <= 40) return "editorial";
  if (bc <= 8 && bs <= 28 && titleZone && titleZone.col >= 28) return "sidebar-right";
  if (titleZone && bodyZone && Math.abs(tc - bc) <= 4 && ts <= 35 && bs <= 35) return "narrow-column";
  if (zones.length >= 3) return "multi-zone";
  if (titleZone && bodyZone) return "standard";

  return "other";
}

// ─── Parse design directives from markdown ──────────────────────────

function parseDirectives(content) {
  const slides = content.split(/\n---\n/);
  const directives = [];

  for (const slide of slides) {
    const match = slide.match(/<!--\s*design:\s*(\{[\s\S]*?\})\s*-->/);
    if (match) {
      try {
        const json = JSON.parse(match[1]);
        // Also capture the slide content (non-directive part)
        const textContent = slide
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/```notes[\s\S]*?```/g, "")
          .trim();
        directives.push({ directive: json, text: textContent });
      } catch {
        // Skip malformed JSON
      }
    } else {
      // Legacy format: <!-- layout: X --> + <!-- bg: Y -->
      const layoutMatch = slide.match(/<!--\s*layout:\s*(\w+)\s*-->/);
      const bgMatch = slide.match(/<!--\s*bg:\s*([0-9A-Fa-f]{6})\s*-->/);
      const fontMatch = slide.match(/<!--\s*font:\s*([\w\s]+)\s*-->/);
      if (layoutMatch || bgMatch) {
        directives.push({
          directive: {
            _legacy: true,
            layout: layoutMatch ? layoutMatch[1] : null,
            bg: bgMatch ? bgMatch[1] : null,
            font: fontMatch ? fontMatch[1].trim() : null,
          },
          text: slide.replace(/<!--[\s\S]*?-->/g, "").replace(/```notes[\s\S]*?```/g, "").trim(),
        });
      }
    }
  }

  return directives;
}

// ─── Extract design plan from composed markdown ─────────────────────

function extractDesignPlan(content) {
  const planMatch = content.match(/<!--\s*DESIGN PLAN\s*\n([\s\S]*?)-->/);
  if (planMatch) {
    const planText = planMatch[1].trim();
    // Try to parse as JSON (design system embed)
    try {
      return { type: "design-system", data: JSON.parse(planText) };
    } catch {
      return { type: "prose", data: planText };
    }
  }
  return null;
}

// ─── Build the fingerprint ──────────────────────────────────────────

function extractFingerprint(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const directives = parseDirectives(content);
  const designPlan = extractDesignPlan(content);

  if (directives.length === 0) {
    return { error: "No design directives found", file: filePath };
  }

  // Separate JSON directives from legacy
  const jsonDirectives = directives.filter(d => !d.directive._legacy);
  const legacyDirectives = directives.filter(d => d.directive._legacy);

  // ── Palette ──
  const bgColors = [];
  for (const d of directives) {
    const bg = d.directive.bg;
    if (bg) bgColors.push(bg.replace(/^#/, "").toUpperCase());
  }
  const uniqueBgs = [...new Set(bgColors)];
  const bgFrequency = {};
  for (const bg of bgColors) {
    bgFrequency[bg] = (bgFrequency[bg] || 0) + 1;
  }

  // Chromatic arc: light/dark transitions
  const bgLuminances = bgColors.map(hex => {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  });
  let arcCrossings = 0;
  for (let i = 1; i < bgLuminances.length; i++) {
    const prev = bgLuminances[i - 1] > 0.5 ? "light" : "dark";
    const curr = bgLuminances[i] > 0.5 ? "light" : "dark";
    if (prev !== curr) arcCrossings++;
  }
  const lightCount = bgLuminances.filter(l => l > 0.5).length;
  const darkCount = bgLuminances.filter(l => l <= 0.5).length;
  const lightPct = Math.round((lightCount / bgLuminances.length) * 100);

  // ── Fonts ──
  const fontUsage = {};
  for (const d of jsonDirectives) {
    const font = d.directive.font || "Helvetica Neue";
    fontUsage[font] = (fontUsage[font] || 0) + 1;
  }
  for (const d of legacyDirectives) {
    const font = d.directive.font || "Helvetica Neue";
    fontUsage[font] = (fontUsage[font] || 0) + 1;
  }

  // ── Typography ranges ──
  const titleSizes = [];
  const bodySizes = [];
  const titleWeights = [];
  for (const d of jsonDirectives) {
    const typo = d.directive.typography;
    if (typo) {
      if (typo.title) {
        if (typo.title.size) titleSizes.push(typo.title.size);
        if (typo.title.weight) titleWeights.push(typo.title.weight);
      }
      if (typo.body && typo.body.size) bodySizes.push(typo.body.size);
    }
  }

  // ── Zone archetypes ──
  const archetypes = [];
  for (const d of jsonDirectives) {
    archetypes.push(classifyArchetype(d.directive.zones));
  }
  const archetypeCounts = {};
  for (const a of archetypes) {
    archetypeCounts[a] = (archetypeCounts[a] || 0) + 1;
  }
  // Archetype rotation: count consecutive duplicates
  let maxConsecArchetype = 1;
  let currConsec = 1;
  for (let i = 1; i < archetypes.length; i++) {
    if (archetypes[i] === archetypes[i - 1]) {
      currConsec++;
      maxConsecArchetype = Math.max(maxConsecArchetype, currConsec);
    } else {
      currConsec = 1;
    }
  }

  // ── Accents ──
  const accentTypes = {};
  const accentColors = new Set();
  let slidesWithAccents = 0;
  for (const d of jsonDirectives) {
    if (d.directive.accents && d.directive.accents.length > 0) {
      slidesWithAccents++;
      for (const acc of d.directive.accents) {
        accentTypes[acc.type] = (accentTypes[acc.type] || 0) + 1;
        if (acc.color) accentColors.add(acc.color.toUpperCase());
      }
    }
  }

  // ── Zone statistics ──
  const allZoneStarts = new Set();
  const allZoneWidths = new Set();
  for (const d of jsonDirectives) {
    if (d.directive.zones) {
      for (const z of d.directive.zones) {
        if (z.col !== undefined) allZoneStarts.add(z.col);
        if (z.span !== undefined) allZoneWidths.add(z.span);
      }
    }
  }

  // ── Infer intensity profile ──
  let inferredIntensity = "moderate";
  const avgTitleSize = titleSizes.length
    ? titleSizes.reduce((a, b) => a + b, 0) / titleSizes.length
    : 36;
  const titleRange = titleSizes.length
    ? Math.max(...titleSizes) - Math.min(...titleSizes)
    : 0;
  const accentPct = jsonDirectives.length
    ? Math.round((slidesWithAccents / jsonDirectives.length) * 100)
    : 0;

  if (avgTitleSize <= 36 && titleRange <= 10 && accentPct < 15 && Object.keys(fontUsage).length <= 2) {
    inferredIntensity = "minimal";
  } else if (avgTitleSize >= 48 || titleRange >= 40 || accentPct > 50 || Object.keys(fontUsage).length >= 4) {
    inferredIntensity = "maximal";
  }

  const fingerprint = {
    file: filePath,
    slideCount: directives.length,
    directiveFormat: jsonDirectives.length > 0 ? (legacyDirectives.length > 0 ? "mixed" : "json") : "legacy",
    designPlan: designPlan,

    palette: {
      backgrounds: uniqueBgs,
      bgFrequency,
      lightPct,
      darkCount,
      arcCrossings,
      dominantBg: Object.entries(bgFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    },

    typography: {
      titleSizeRange: titleSizes.length ? [Math.min(...titleSizes), Math.max(...titleSizes)] : null,
      titleSizeAvg: titleSizes.length ? Math.round(avgTitleSize) : null,
      bodySizeRange: bodySizes.length ? [Math.min(...bodySizes), Math.max(...bodySizes)] : null,
      titleWeightRange: titleWeights.length ? [Math.min(...titleWeights), Math.max(...titleWeights)] : null,
      fontUsage,
    },

    zones: {
      archetypes: archetypeCounts,
      archetypeSequence: archetypes,
      uniqueArchetypes: Object.keys(archetypeCounts).length,
      maxConsecutiveSame: maxConsecArchetype,
      uniqueColStarts: allZoneStarts.size,
      uniqueSpanWidths: allZoneWidths.size,
    },

    accents: {
      slidesWithAccents,
      accentPct,
      types: accentTypes,
      colors: [...accentColors],
    },

    inferredIntensity,
  };

  return fingerprint;
}

// ─── CLI ────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith("-"));
  const save = args.includes("--save");

  if (!file) {
    console.error(`Usage: node brief-extract.js <file.composed.md> [--save]`);
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    console.error(`${accent("Error:")} file not found: ${file}`);
    process.exit(1);
  }

  const fp = extractFingerprint(file);

  if (fp.error) {
    console.error(`${accent("Error:")} ${fp.error}`);
    process.exit(1);
  }

  if (save) {
    const corpusDir = path.join(__dirname, "design-corpus");
    if (!fs.existsSync(corpusDir)) fs.mkdirSync(corpusDir, { recursive: true });
    const basename = path.basename(file, ".composed.md").replace(/\.composed$/, "");
    const outPath = path.join(corpusDir, `${basename}.fingerprint.json`);
    fs.writeFileSync(outPath, JSON.stringify(fp, null, 2) + "\n");
    console.log(`${teal("Saved:")} ${outPath}`);
  } else {
    console.log(JSON.stringify(fp, null, 2));
  }
}

module.exports = { extractFingerprint, classifyArchetype, parseDirectives };
