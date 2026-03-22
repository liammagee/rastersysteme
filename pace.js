#!/usr/bin/env node
/**
 * pace — add timing cues to slide speaker notes
 *
 * Estimates per-slide duration based on content density and notes length,
 * distributes time across slides to match a total presentation duration,
 * and prepends timestamps to speaker notes.
 *
 * Usage:
 *   node pace.js <input.md> [options]
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.gray;
const accent = chalk.hex("#C44230");
const teal = chalk.hex("#2C7A92");
const sage = chalk.hex("#548C5A");
const amber = chalk.hex("#C79B38");

// ═══════════════════════════════════════════════════════
// TIMING ESTIMATOR
// ═══════════════════════════════════════════════════════

function estimateSlideWeight(slide) {
  let weight = 1; // base weight for every slide

  // Notes length is the strongest signal — more notes = more to say
  if (slide.notes) {
    const words = slide.notes.split(/\s+/).length;
    weight += words / 60; // ~60 words per minute speaking pace
  }

  // Bullet count
  weight += (slide.bullets || []).length * 0.3;

  // Body text
  const bodyWords = (slide.body || []).join(" ").split(/\s+/).length;
  weight += bodyWords / 80;

  // Blockquote — usually discussed
  if (slide.blockquote) weight += 0.5;

  // Title-only slides (section breaks) are brief
  if (!slide.notes && (slide.body || []).length === 0 && (slide.bullets || []).length === 0) {
    weight = 0.3;
  }

  // Blank slides are just pauses
  if (slide.layout === "blank" || (!slide.title && !slide.subtitle && (slide.body || []).length === 0 && (slide.bullets || []).length === 0)) {
    weight = 0.1;
  }

  return weight;
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes % 1) * 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTimestamp(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

// ═══════════════════════════════════════════════════════
// PACER — adds timestamps to notes
// ═══════════════════════════════════════════════════════

function paceSlides(md, totalMinutes) {
  const { parseMarkdown } = require("./raster.js");
  const slides = parseMarkdown(md);

  // Calculate weights
  const weights = slides.map(estimateSlideWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Distribute time proportionally
  const durations = weights.map(w => (w / totalWeight) * totalMinutes);

  // Build timing table
  let elapsed = 0;
  const timing = slides.map((slide, i) => {
    const start = elapsed;
    const duration = durations[i];
    elapsed += duration;
    return {
      slide: i + 1,
      title: slide.title || slide.subtitle || "(untitled)",
      start,
      duration,
      end: elapsed,
      weight: weights[i],
    };
  });

  return { slides, timing, durations, totalMinutes };
}

function injectTimestamps(md, totalMinutes, options = {}) {
  const { timing } = paceSlides(md, totalMinutes);

  // Split the source markdown into raw slides
  const rawSlides = md.split(/\n---\n/);

  const paced = rawSlides.map((raw, i) => {
    if (i >= timing.length) return raw;
    const t = timing[i];
    const timestamp = `⏱ ${formatTimestamp(t.start)} → ${formatTimestamp(t.end)} (${formatTime(t.duration)})`;

    // Check if this slide has notes
    const notesMatch = raw.match(/```notes\n([\s\S]*?)```/);
    if (notesMatch) {
      // Prepend timestamp to existing notes
      return raw.replace(
        /```notes\n/,
        `\`\`\`notes\n${timestamp}\n\n`
      );
    } else {
      // Add notes block with timestamp
      return `${raw.trimEnd()}\n\n\`\`\`notes\n${timestamp}\n\`\`\``;
    }
  });

  return paced.join("\n---\n");
}

// ═══════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════

function printTimingReport(md, totalMinutes) {
  const { timing } = paceSlides(md, totalMinutes);

  console.log("");
  console.log(`  ${accent("■")} ${chalk.white.bold("Pacing Report")}`);
  console.log(`  ${dim("Total:")} ${amber(totalMinutes + " minutes")} ${dim(`(${formatTime(totalMinutes)})`)}`);
  console.log(`  ${dim("Slides:")} ${timing.length}`);
  console.log("");

  // Find natural chapter breaks (slides with significantly longer duration)
  const avgDuration = totalMinutes / timing.length;

  timing.forEach((t) => {
    const bar = "█".repeat(Math.max(1, Math.round(t.duration / avgDuration * 8)));
    const isLong = t.duration > avgDuration * 1.5;
    const isShort = t.duration < avgDuration * 0.3;
    const barColor = isLong ? accent : isShort ? dim : teal;

    console.log(
      `  ${dim(String(t.slide).padStart(2))}. ${amber(formatTimestamp(t.start).padEnd(6))} ${barColor(bar.padEnd(15))} ${formatTime(t.duration).padEnd(6)} ${dim(t.title.slice(0, 50))}`
    );
  });

  console.log("");
  console.log(`  ${dim("Legend:")} ${accent("█")} ${dim("long")}  ${teal("█")} ${dim("normal")}  ${dim("█")} ${dim("short/pause")}`);

  // Suggest break points
  let accumulated = 0;
  const breakPoints = [];
  timing.forEach((t) => {
    accumulated += t.duration;
    if (accumulated >= totalMinutes / 2 && breakPoints.length === 0) {
      breakPoints.push(t);
    }
  });

  if (breakPoints.length > 0 && totalMinutes > 60) {
    console.log("");
    console.log(`  ${amber("☕")} Suggested break after slide ${breakPoints[0].slide} (${formatTimestamp(breakPoints[0].end)})`);
  }
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  pace — add timing cues to slide speaker notes

  Usage:
    node pace.js <input.md> --duration <minutes> [options]

  Options:
    --duration <min>   Total presentation time in minutes (required)
    --output <path>    Write paced markdown (default: prints report only)
    --report           Print timing report (default when no --output)
    --help             Show this help

  Examples:
    node pace.js decks/week-1.md --duration 170
    node pace.js decks/week-1.md --duration 170 --output decks/week-1-paced.md
    node pace.js decks/week-1.md --duration 50 --report
    `);
    process.exit(0);
  }

  const input = args[0];
  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const duration = parseInt(getFlag("--duration") || "0");
  const output = getFlag("--output");

  if (!duration) {
    console.error("Error: --duration <minutes> is required");
    process.exit(1);
  }

  if (!fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  const md = fs.readFileSync(input, "utf-8");

  // Always print the report
  printTimingReport(md, duration);

  // Write paced markdown if --output specified
  if (output) {
    const paced = injectTimestamps(md, duration);
    fs.writeFileSync(output, paced);
    console.log(`\n  ${sage("✓")} Paced markdown → ${teal(output)}`);
  }
}

module.exports = { paceSlides, injectTimestamps, printTimingReport, estimateSlideWeight };
