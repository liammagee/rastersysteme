#!/usr/bin/env node
/**
 * rubric-jsdom.js — headless rubric evaluation using jsdom (no Puppeteer required)
 *
 * Evaluates slide decks using jsdom for DOM parsing and inline style analysis.
 * No Chrome/Chromium needed, no network dependency.
 *
 * Usage:
 *   node rubric-jsdom.js <deck.html>              evaluate only, formatted output
 *   node rubric-jsdom.js <deck.html> --json       evaluate only, JSON output
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { JSDOM } = require('jsdom');

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

// ═══════════════════════════════════════════════════════
// JSDOM-based evaluation — inline style parsing
// ═══════════════════════════════════════════════════════

function evaluate(htmlPath) {
  // Read HTML from disk
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML file not found: ${htmlPath}`);
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  const dom = new JSDOM(html, {
    url: 'file://' + htmlPath,
    pretendToBeVisual: true
  });

  const document = dom.window.document;
  const slides = document.querySelectorAll('.slide,.grid-slide');
  const total = slides.length;

  if (!total) {
    return { error: 'No slides' };
  }

  // ── Utility functions ──
  function parseRGB(str) {
    if (!str) return null;
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
  }

  function lum(c) {
    const [r, g, b] = [c.r, c.g, c.b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function cr(a, b) {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function hexRGB(c) {
    return '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function parseInlineStyle(elem) {
    const style = elem.getAttribute('style') || '';
    const result = {};
    const pairs = style.split(';').filter(p => p.trim());
    pairs.forEach(pair => {
      const [key, val] = pair.split(':').map(s => s.trim());
      if (key && val) result[key] = val;
    });
    return result;
  }

  function getInlineValue(elem, prop) {
    const style = parseInlineStyle(elem);
    return style[prop] || null;
  }

  function parseColor(colorStr) {
    if (!colorStr) return null;
    // Handle rgb/rgba
    const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    // Handle hex
    if (colorStr.startsWith('#')) {
      const hex = colorStr.slice(1);
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16)
        };
      }
    }
    return null;
  }

  // ── Counters ──
  let contrastErrors = 0, contrastWarnings = 0, overflows = 0, brokenImgs = 0;
  let titles = 0, designed = 0, totalImgs = 0;
  let emptyBodyZones = 0, contentlessSlides = 0;
  let tinyTextCount = 0, tableTruncations = 0, clippedContentSlides = 0;
  let textOnImageCount = 0, imgOverlaps = 0;
  const bgs = [], titleSizes = new Set(), zoneStarts = new Set(), zoneWidths = new Set();
  const fonts = new Set(), imgPlacements = new Set();
  let slidesWithAccents = 0;
  const perSlideTextLen = [];
  const perSlideIssues = [];

  slides.forEach((slide, idx) => {
    const slideIssues = [];

    // Get computed background color
    const computedStyle = dom.window.getComputedStyle(slide);
    const bgColorStr = computedStyle.backgroundColor || 'rgb(250, 246, 238)';
    const bg = parseRGB(bgColorStr) || { r: 250, g: 246, b: 238 };
    bgs.push(bg);

    // Check for title and designed class
    if (slide.querySelector('h1,h2')) titles++;
    if (slide.classList.contains('designed')) designed++;

    // ── Text elements: contrast + font size audit ──
    let slideVisibleText = '';
    slide.querySelectorAll('h1,h2,h3,p,li,span,blockquote,.label,.bullet,td,th,code,a').forEach(el => {
      const text = el.textContent.trim();
      if (!text) return;
      slideVisibleText += text + ' ';

      // Font size check (jsdom issue: getComputedStyle may not cascade properly)
      const inlineStyle = parseInlineStyle(el);
      let fontSize = parseFloat(inlineStyle['font-size']);
      if (isNaN(fontSize) || fontSize === 0) {
        // Try computed style
        const computed = dom.window.getComputedStyle(el);
        fontSize = parseFloat(computed.fontSize) || 14; // fallback to 14px
      }

      if (fontSize < 11.5 && text.length > 1) {
        tinyTextCount++;
        slideIssues.push('tiny-text:' + fontSize.toFixed(0) + 'px');
      }

      // Contrast check: parse colors from inline style or computed
      const inlineColor = getInlineValue(el, 'color');
      const inlineBgColor = getInlineValue(el, 'background-color');

      let fgColor = inlineColor ? parseColor(inlineColor) : null;
      let bgColor = inlineBgColor ? parseColor(inlineBgColor) : null;

      // If no inline style, try computed (but jsdom won't cascade well)
      if (!fgColor) {
        const computed = dom.window.getComputedStyle(el);
        fgColor = parseRGB(computed.color);
      }
      if (!bgColor) {
        bgColor = bg; // fall back to slide bg
      }

      if (fgColor && bgColor) {
        const ratio = cr(fgColor, bgColor);
        const bold = parseInt(dom.window.getComputedStyle(el).fontWeight) >= 700;
        const lg = fontSize >= 18 || (fontSize >= 14 && bold);
        if (ratio < (lg ? 3 : 4.5)) {
          if (ratio < 2) contrastErrors++;
          else contrastWarnings++;
        }
      }
    });
    perSlideTextLen.push(slideVisibleText.trim().length);

    // ── Overflow detection: parse inline styles for zone/element positioning ──
    // In jsdom, getBoundingClientRect returns zeros. We parse inline styles instead.
    slide.querySelectorAll('*').forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'link', 'meta', 'img'].includes(tag)) return;
      if (el.classList.contains('accent-el') || el.closest('.accent-el')) return;
      if (el.classList.contains('dot')) return;
      if (!el.textContent.trim()) return;

      // Try to detect overflow via inline style inspection
      const inlineStyle = parseInlineStyle(el);
      const left = parseFloat(inlineStyle['left']) || 0;
      const top = parseFloat(inlineStyle['top']) || 0;
      const width = parseFloat(inlineStyle['width']) || 0;
      const height = parseFloat(inlineStyle['height']) || 0;

      // If positioned with left + width >= 100%, likely overflowing
      if (left + width > 100 && left < 100 && width > 0) {
        overflows++;
        slideIssues.push('overflow');
      }
    });

    // ── Table truncation detection (simplified) ──
    slide.querySelectorAll('table').forEach(table => {
      const inlineStyle = parseInlineStyle(table);
      const tableWidth = parseFloat(inlineStyle['width']) || 0;
      const parent = table.parentElement;
      if (parent) {
        const parentStyle = parseInlineStyle(parent);
        const parentWidth = parseFloat(parentStyle['width']) || 100;
        // Heuristic: if table is much wider than container
        if (tableWidth > parentWidth * 1.05 && tableWidth > 0 && parentWidth > 0) {
          tableTruncations++;
          slideIssues.push('table-wider-than-container');
        }
      }
      // Count rows as proxy for height
      const rows = table.querySelectorAll('tr');
      if (rows.length > 30) {
        tableTruncations++;
        slideIssues.push('table-rows-clipped:' + rows.length);
      }
    });

    // ── Clipped content detection ──
    let hasClipped = false;
    slide.querySelectorAll('.zone,.zone-body,.zone-bullets,.zone-quote,.zone-table').forEach(zone => {
      const zoneStyle = parseInlineStyle(zone);
      const overflow = zoneStyle['overflow'];
      if (overflow === 'hidden' || overflow === 'auto') {
        // Zone has overflow:hidden; check if it contains large text blocks
        const textEls = zone.querySelectorAll('h1,h2,h3,p,.bullet,li,td,blockquote');
        if (textEls.length > 0 && zone.textContent.length > 100) {
          hasClipped = true;
        }
      }
    });
    if (hasClipped) {
      clippedContentSlides++;
      slideIssues.push('content-clipped');
    }

    // ── Image analysis ──
    if (idx === 0) {
      slide.querySelectorAll('img').forEach(img => {
        // In jsdom, naturalWidth is always 0 for images not loaded
        // We count by presence of src attribute
        const src = img.getAttribute('src');
        if (!src) brokenImgs++;
      });
    }

    slide.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src');
      if (!src) return;

      totalImgs++;

      // Parse image position from inline style or nearest positioned parent
      const inlineStyle = parseInlineStyle(img);
      let cx = 50, cy = 50; // default center
      const left = parseFloat(inlineStyle['left']);
      const top = parseFloat(inlineStyle['top']);
      const width = parseFloat(inlineStyle['width']) || 0;

      if (!isNaN(left) && width > 0) {
        cx = left + width / 2;
      }
      if (!isNaN(top)) {
        cy = top;
      }

      // Classify placement (simplified, assuming 100% width = 100, height = 100)
      if (cx > 65) imgPlacements.add('right');
      else if (cx < 35) imgPlacements.add('left');
      else if (cy < 35) imgPlacements.add('top');
      else if (cy > 65) imgPlacements.add('bottom');
      else imgPlacements.add('centre');
    });

    // Text-on-image overlap (simplified: count text near images)
    // Without real bounding boxes, we approximate by counting text and images on same slide
    const imgCount = slide.querySelectorAll('img').length;
    const textEls = slide.querySelectorAll('h1,h2,h3,p,.bullet,blockquote,.label,td,th,a,code');
    if (imgCount > 0 && textEls.length > 0) {
      // Conservative estimate: if both text and images exist, assume some overlap
      const overlapRatio = Math.min(textEls.length * 0.1, imgCount * 0.3);
      if (overlapRatio > 0.3) {
        textOnImageCount += Math.round(overlapRatio);
        imgOverlaps += Math.round(overlapRatio);
        slideIssues.push('text-on-image');
      }
    }

    // ── Zone and font metrics (parse inline styles) ──
    slide.querySelectorAll('.zone').forEach(z => {
      const style = parseInlineStyle(z);
      const left = parseFloat(style['left']) || 0;
      const width = parseFloat(style['width']) || 0;
      zoneStarts.add(Math.round(left));
      zoneWidths.add(Math.round(width));
    });

    slide.querySelectorAll('h1,h2').forEach(el => {
      const style = parseInlineStyle(el);
      const fontSize = parseFloat(style['font-size']);
      if (!isNaN(fontSize)) {
        titleSizes.add(Math.round(fontSize));
      }
    });

    slide.querySelectorAll('h1,h2,p,.bullet,.label').forEach(el => {
      const style = parseInlineStyle(el);
      const fontFamily = style['font-family'];
      if (fontFamily) {
        const cleanName = fontFamily.replace(/['"]/g, '').split(',')[0].trim();
        if (cleanName) fonts.add(cleanName);
      }
    });

    if (slide.querySelectorAll('.accent-el,[class*=accent]').length) {
      slidesWithAccents++;
    }

    // ── Content preservation ──
    slide.querySelectorAll('.zone-body,.zone-bullets,.zone-quote').forEach(z => {
      if (!z.textContent.trim()) emptyBodyZones++;
    });

    const hasAnyText = slide.querySelector('h1,h2,h3,p,.bullet,.label,blockquote,td,a');
    const hasImage = slide.querySelector('img');
    if (!hasAnyText && !hasImage) contentlessSlides++;

    perSlideIssues.push(slideIssues);
  });

  // ── Deck-level metrics ──
  let maxConsec = 1, run = 1;
  for (let i = 1; i < bgs.length; i++) {
    if (hexRGB(bgs[i]) === hexRGB(bgs[i - 1])) {
      run++;
      maxConsec = Math.max(maxConsec, run);
    } else {
      run = 1;
    }
  }

  const uniqueBgs = new Set(bgs.map(hexRGB));
  const hasArc = bgs.length > 1 && [...new Set(bgs.map(b => lum(b) > 0.5 ? 'L' : 'D'))].length > 1;

  let slidesWithNoVisibleText = 0;
  perSlideTextLen.forEach((len, i) => {
    if (len < 5) {
      const slide = slides[i];
      const hasImg = slide && slide.querySelector('img');
      if (!hasImg) slidesWithNoVisibleText++;
    }
  });

  return {
    total, titles, designed, contrastErrors, contrastWarnings, overflows, brokenImgs,
    uniqueBgs: uniqueBgs.size, bgPalette: [...uniqueBgs], maxConsecBg: maxConsec, hasArc,
    zoneStarts: zoneStarts.size, zoneWidths: zoneWidths.size, titleSizes: [...titleSizes], fontSets: fonts.size,
    slidesWithAccents, totalImgs, imgOverlaps, imgPlacements: [...imgPlacements],
    tinyTextCount, tableTruncations, clippedContentSlides, textOnImageCount,
    emptyBodyZones, contentlessSlides, slidesWithNoVisibleText,
    perSlideTextLen, perSlideIssues
  };
}

function computeScores(metrics) {
  const scores = {};
  const m = metrics;

  // 1. Accessibility
  scores.accessibility = Math.max(1, Math.min(10,
    10
    - m.contrastErrors * 2
    - m.contrastWarnings * 0.3
    - m.brokenImgs * 2
    - m.tinyTextCount * 0.3
    - Math.min(m.overflows * 0.2, 2)
  ));

  // 2. Communicability (visual-only)
  scores.communicability = null;

  // 3. Taste (visual-only)
  scores.taste = null;

  // 4. Grid Utilization
  scores.grid = Math.max(1, Math.min(10,
    (m.designed / m.total) * 4
    + Math.min(m.zoneStarts / 4, 1.5) * 2
    + Math.min(m.zoneWidths / 3, 1.5) * 2
    + (m.designed > 0 ? 2 : 0)
  ));

  // 5. Color Harmonics
  scores.color = Math.max(1, Math.min(10,
    Math.min(m.uniqueBgs / 3, 2) * 2
    + (m.hasArc ? 3 : 1)
    + (m.maxConsecBg <= 3 ? 3 : m.maxConsecBg <= 5 ? 2 : 1)
    + (m.contrastErrors === 0 ? 2 : 0)
  ));

  // 6. Balance (visual-only)
  scores.balance = null;

  // 7. Coherence & Variance
  scores.coherence = Math.max(1, Math.min(10,
    (m.titleSizes.length >= 2 && m.titleSizes.length <= 6 ? 3 : 1)
    + (m.fontSets >= 2 ? 2 : 1)
    + (m.uniqueBgs >= 3 ? 2 : 1)
    + (m.maxConsecBg <= 3 ? 2 : 0)
    + (m.designed > m.total * 0.5 ? 1 : 0)
  ));

  // 8. Image Integration
  const imgPenalty = Math.min(m.textOnImageCount * 0.5, 6);
  scores.images = m.totalImgs === 0 ? 5 : Math.max(1, Math.min(10,
    10
    - imgPenalty
    - (m.imgPlacements.length < 3 ? 2 : 0)
    - (m.totalImgs < m.total * 0.2 ? 1 : 0)
  ));

  // 9. Content Completeness
  scores.contentCompleteness = Math.max(1, Math.min(10,
    10
    - m.emptyBodyZones * 0.5
    - m.contentlessSlides * 2
    - m.tableTruncations * 1
    - m.clippedContentSlides * 1.5
    - m.slidesWithNoVisibleText * 2
  ));

  // Round all scores
  for (const k of Object.keys(scores)) {
    if (scores[k] !== null) scores[k] = Math.round(scores[k] * 10) / 10;
  }

  // Compute total
  const computedDims = Object.entries(scores).filter(([, v]) => v !== null);
  const computedTotal = Math.round(computedDims.reduce((a, [, v]) => a + v, 0) * 10) / 10;
  const maxComputed = computedDims.length * 10;

  return { scores, computedTotal, maxComputed };
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.includes('--help')) {
    console.log(`
  rubric-jsdom — evaluate slide decks using jsdom (no Puppeteer)

  Usage:
    node rubric-jsdom.js <deck.html>              Formatted output
    node rubric-jsdom.js <deck.html> --json       JSON output
    `);
    process.exit(0);
  }

  const htmlPath = args[0];
  const jsonOutput = args.includes('--json');

  process.stderr.write(`\n  ${accent('■')} ${chalk.white.bold('rubric-jsdom')}\n`);
  process.stderr.write(`  ${dim('Deck:')} ${teal(htmlPath)}\n`);

  const metrics = evaluate(htmlPath);

  if (metrics.error) {
    process.stderr.write(`  ${accent('✖')} ${metrics.error}\n`);
    process.exit(1);
  }

  const { scores, computedTotal, maxComputed } = computeScores(metrics);

  const result = { metrics, scores, computedTotal, maxComputed };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Formatted output
    process.stderr.write(`\n  ${dim('── Evaluation ──')}\n`);
    const dims = [
      ['Accessibility', scores.accessibility],
      ['Communicability', scores.communicability],
      ['Taste', scores.taste],
      ['Grid', scores.grid],
      ['Color', scores.color],
      ['Balance', scores.balance],
      ['Coherence', scores.coherence],
      ['Images', scores.images],
      ['Content', scores.contentCompleteness],
    ];

    dims.forEach(([n, s]) => {
      if (s === null || s === undefined) {
        process.stderr.write(`  ${dim('○')} ${dim(n.padEnd(16))} ${dim('  —  visual only')}\n`);
      } else {
        const icon = s >= 8 ? sage('●') : s >= 6 ? amber('●') : accent('●');
        process.stderr.write(`  ${icon} ${n.padEnd(16)} ${String(s).padStart(4)}\n`);
      }
    });

    const pct = Math.round(computedTotal / maxComputed * 100);
    process.stderr.write(`  ${dim('Computed:')} ${chalk.white.bold(computedTotal + '/' + maxComputed)} ${dim('(' + pct + '%)')}\n`);

    // Detail warnings
    const m = metrics;
    if (m.tinyTextCount > 0) process.stderr.write(`  ${amber('⚠')} ${m.tinyTextCount} text elements below 12px\n`);
    if (m.textOnImageCount > 0) process.stderr.write(`  ${accent('✖')} ${m.textOnImageCount} text-on-image overlaps\n`);
    if (m.tableTruncations > 0) process.stderr.write(`  ${accent('✖')} ${m.tableTruncations} table truncations\n`);
    if (m.clippedContentSlides > 0) process.stderr.write(`  ${amber('⚠')} ${m.clippedContentSlides} slides with clipped content\n`);
    if (m.emptyBodyZones > 0) process.stderr.write(`  ${amber('⚠')} ${m.emptyBodyZones} empty body zones\n`);
    if (m.contentlessSlides > 0) process.stderr.write(`  ${accent('✖')} ${m.contentlessSlides} contentless slides\n`);
    if (m.slidesWithNoVisibleText > 0) process.stderr.write(`  ${amber('⚠')} ${m.slidesWithNoVisibleText} slides with no visible text\n`);

    process.stderr.write('\n');
  }
}

main();
