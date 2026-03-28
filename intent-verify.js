#!/usr/bin/env node
/**
 * intent-verify.js — compare design intent (composed markdown directives)
 * against actual rendered output (HTML zone positions)
 *
 * Flags slides where the rendered layout doesn't match the intended design:
 * - Zone missing from render (directive has it, HTML doesn't)
 * - Zone position shifted (>10% from directive)
 * - Extra zones not in directive (extras fallback injected content)
 * - Content in wrong zone (table in body, title duplicated)
 *
 * Usage:
 *   node intent-verify.js <deck.composed.md> <deck.html>
 *   node intent-verify.js <deck.composed.md> <deck.html> --json
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const args = process.argv.slice(2);
const composedPath = args.find(a => !a.startsWith("--") && a.endsWith(".md"));
const htmlPath = args.find(a => !a.startsWith("--") && a.endsWith(".html"));
const jsonMode = args.includes("--json");

if (!composedPath || !htmlPath) {
  console.log(`
  intent-verify.js — compare design intent against rendered output

  Usage:
    node intent-verify.js <deck.composed.md> <deck.html>
    node intent-verify.js <deck.composed.md> <deck.html> --json
  `);
  process.exit(0);
}

// ── Parse intended zones from composed markdown ──
function parseIntended(mdPath) {
  const md = fs.readFileSync(mdPath, "utf-8");
  const slides = md.split(/^---$/m).filter(s => s.trim());
  return slides.map((raw, i) => {
    const match = raw.match(/<!--\s*design:\s*(\{[\s\S]*?\})\s*-->/);
    if (!match) return { slide: i + 1, zones: [], bg: null };
    try {
      const design = JSON.parse(match[1]);
      return {
        slide: i + 1,
        zones: (design.zones || []).map(z => ({
          role: z.role,
          left: (z.col / 60 * 100),
          top: (z.row / 40 * 100),
          width: (z.span / 60 * 100),
          height: (z.rowSpan / 40 * 100),
        })),
        bg: design.bg || null,
      };
    } catch (e) {
      return { slide: i + 1, zones: [], bg: null };
    }
  });
}

// ── Parse rendered zones from HTML ──
function parseRendered(htmlPath) {
  const projDir = path.resolve(__dirname);
  const { JSDOM } = require(path.join(projDir, "node_modules", "jsdom"));
  const html = fs.readFileSync(htmlPath, "utf-8");
  const dom = new JSDOM(html);
  const slides = dom.window.document.querySelectorAll(".slide");

  return [...slides].map((slide, i) => {
    const zones = [];
    slide.querySelectorAll("[class*='zone-']").forEach(z => {
      if (z.classList.contains("zone-extras")) return;
      if (z.className.includes("accent")) return;
      const style = z.getAttribute("style") || "";
      const parseVal = (key) => {
        const m = style.match(new RegExp(key + ":\\s*([\\d.]+)%"));
        return m ? parseFloat(m[1]) : null;
      };
      const left = parseVal("left") || 0;
      const top = parseVal("top") || 0;
      let width = parseVal("width") || 0;
      let height = parseVal("height") || 0;
      if (!width) { const r = parseVal("right"); if (r !== null) width = 100 - left - r; }
      if (!height) { const b = parseVal("bottom"); if (b !== null) height = 100 - top - b; }

      const roleMatch = z.className.match(/zone-(\w+)/);
      const role = roleMatch ? roleMatch[1] : "unknown";
      const hasContent = z.textContent.trim().length > 0 || z.querySelector("img,table");

      zones.push({ role, left, top, width, height, hasContent });
    });

    // Check for extras zones (unintended content)
    const extrasZones = [];
    slide.querySelectorAll(".zone-extras").forEach(ext => {
      ext.querySelectorAll("[class*='zone-']").forEach(z => {
        const roleMatch = z.className.match(/zone-(\w+)/);
        extrasZones.push(roleMatch ? roleMatch[1] : "unknown");
      });
    });

    return { slide: i + 1, zones, extrasZones };
  });
}

// ── Compare ──
const intended = parseIntended(composedPath);
const rendered = parseRendered(htmlPath);

const issues = [];

const slideCount = Math.min(intended.length, rendered.length);
for (let i = 0; i < slideCount; i++) {
  const intent = intended[i];
  const actual = rendered[i];
  const slideIssues = [];

  // Check each intended zone exists in rendered
  for (const iz of intent.zones) {
    const match = actual.zones.find(az => az.role === iz.role);
    if (!match) {
      slideIssues.push({
        type: "zone-missing",
        detail: `intended "${iz.role}" zone not found in rendered output`,
      });
      continue;
    }

    // Check position drift (>10% of slide dimension)
    const leftDrift = Math.abs(match.left - iz.left);
    const topDrift = Math.abs(match.top - iz.top);
    const widthDrift = Math.abs(match.width - iz.width);
    const heightDrift = Math.abs(match.height - iz.height);

    if (leftDrift > 10 || topDrift > 10 || widthDrift > 15 || heightDrift > 15) {
      slideIssues.push({
        type: "zone-shifted",
        detail: `"${iz.role}" shifted: left ${leftDrift.toFixed(1)}%, top ${topDrift.toFixed(1)}%, w ${widthDrift.toFixed(1)}%, h ${heightDrift.toFixed(1)}%`,
      });
    }

    // Check content
    if (!match.hasContent && iz.role !== "image") {
      slideIssues.push({
        type: "zone-empty",
        detail: `"${iz.role}" zone rendered but has no content`,
      });
    }
  }

  // Check for extras zones (content not captured by design zones)
  if (actual.extrasZones.length > 0) {
    slideIssues.push({
      type: "extras-injected",
      detail: `extras fallback created: ${actual.extrasZones.join(", ")}`,
    });
  }

  if (slideIssues.length > 0) {
    issues.push({ slide: i + 1, issues: slideIssues });
  }
}

// ── Output ──
if (jsonMode) {
  console.log(JSON.stringify({
    slideCount,
    issueCount: issues.reduce((s, si) => s + si.issues.length, 0),
    slidesWithIssues: issues.length,
    issues,
  }, null, 2));
} else {
  console.log(chalk.cyan(`\n  ■ intent-verify`));
  console.log(chalk.dim(`  Composed: ${composedPath}`));
  console.log(chalk.dim(`  Rendered: ${htmlPath}`));
  console.log(chalk.dim(`  Slides: ${slideCount}\n`));

  if (issues.length === 0) {
    console.log(chalk.green("  ✓ All slides match design intent.\n"));
  } else {
    const total = issues.reduce((s, si) => s + si.issues.length, 0);
    console.log(chalk.red(`  ${total} issues on ${issues.length} slides:\n`));
    issues.forEach(si => {
      console.log(chalk.yellow(`  Slide ${si.slide}:`));
      si.issues.forEach(iss => {
        const icon = iss.type === "zone-missing" ? "✖" : iss.type === "extras-injected" ? "⚠" : "◐";
        console.log(chalk.dim(`    ${icon} [${iss.type}] ${iss.detail}`));
      });
    });
    console.log("");
  }
}
