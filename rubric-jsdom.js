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
  let spliceCount = 0, spliceVisibleCount = 0, spliceAtmosphericCount = 0, lowOpacitySpliceTotal = 0;
  const splicePlacements = new Set();
  const bgs = [], titleSizes = new Set(), zoneStarts = new Set(), zoneWidths = new Set();
  const fonts = new Set(), imgPlacements = new Set();
  let slidesWithAccents = 0;
  const perSlideTextLen = [];
  const perSlideWhitespace = [];
  const perSlideIssues = [];
  const perSlideBalance = [];     // Arnheim visual weight balance per slide
  const perSlideFlowScore = [];   // reading path quality per slide

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
    // DISABLED in jsdom: overflow:hidden is standard on all zones, and jsdom cannot
    // measure actual content overflow (no real layout engine). This produces false
    // positives on ~80% of slides. The Puppeteer path (rubric-headless.js) uses real
    // bounding boxes and correctly detects actual content clipping.
    // clippedContentSlides is left at 0 for jsdom evaluations.

    // ── Image analysis ──
    let genericAltImgs = 0;
    slide.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src');
      if (!src) brokenImgs++;
      // Check for generic/placeholder alt text — indicates unresolved content image
      const alt = (img.getAttribute('alt') || '').trim();
      if ((alt === 'Image' || alt === 'image' || alt === '') && !img.classList.contains('splice-img')) {
        genericAltImgs++;
        slideIssues.push('generic-alt');
      }
    });

    slide.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src');
      if (!src) return;

      totalImgs++;

      // Check splice image inclusion and visibility
      if (img.classList.contains('splice-img')) {
        spliceCount++;
        let el = img.parentElement;
        let opacity = 1;
        while (el && el !== slide) {
          const s = parseInlineStyle(el);
          if (s['opacity']) opacity *= parseFloat(s['opacity']);
          el = el.parentElement;
        }
        // Three tiers: visible (>=0.4), atmospheric (0.15-0.4), invisible (<0.15)
        if (opacity >= 0.4) spliceVisibleCount++;
        else if (opacity >= 0.15) spliceAtmosphericCount++;
        else lowOpacitySpliceTotal++;
        // Classify splice placement from parent container style
        const parentStyle = parseInlineStyle(img.parentElement || img);
        const pw = parseFloat(parentStyle['width']) || 0;
        const pinset = parentStyle['inset'];
        if (pinset === '0' || pw >= 95) splicePlacements.add('background');
        else if (parentStyle['bottom'] && parentStyle['left'] && pw < 30) splicePlacements.add('inset-bl');
        else if (parentStyle['top'] && parentStyle['right'] && pw < 30) splicePlacements.add('inset-tr');
        else if (parentStyle['left'] === '0' || parentStyle['left'] === '0%') splicePlacements.add('left');
        else if (parentStyle['right'] === '0' || parentStyle['right'] === '0%') splicePlacements.add('right');
        else if (parentStyle['bottom'] === '0') splicePlacements.add('bottom');
        else if (parentStyle['top'] === '0') splicePlacements.add('top');
        else splicePlacements.add('other');
      }

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

    // Text-on-image overlap: CSS rect intersection between image zones and text zones
    // Replaces the old approximation which produced false positives
    const imgZoneRects = [];
    const textZoneRects = [];
    slide.querySelectorAll('[class*="zone-"]').forEach(z => {
      if (z.className.includes('accent') || z.classList.contains('zone-extras')) return;
      const s = parseInlineStyle(z);
      const left = parseFloat(s['left']) || 0;
      const top = parseFloat(s['top']) || 0;
      let width = parseFloat(s['width']) || 0;
      let height = parseFloat(s['height']) || 0;
      if (!width && s['right']) width = 100 - left - (parseFloat(s['right']) || 0);
      if (!height && s['bottom']) height = 100 - top - (parseFloat(s['bottom']) || 0);
      if (width <= 0 || height <= 0) return;
      const rect = { left, top, right: left + width, bottom: top + height };
      // Only count dedicated image zones (role="image"), not body zones that happen to contain images
      if (z.classList.contains('zone-image')) {
        imgZoneRects.push(rect);
      } else if (z.textContent.trim().length > 10) {
        textZoneRects.push(rect);
      }
    });
    // Check for zone-level overlaps between text zones and image zones
    for (const ir of imgZoneRects) {
      for (const tr of textZoneRects) {
        const ox = Math.max(0, Math.min(ir.right, tr.right) - Math.max(ir.left, tr.left));
        const oy = Math.max(0, Math.min(ir.bottom, tr.bottom) - Math.max(ir.top, tr.top));
        const area = ox * oy;
        const imgArea = (ir.right - ir.left) * (ir.bottom - ir.top);
        if (area > imgArea * 0.2 && area > 50) {
          textOnImageCount++;
          imgOverlaps++;
          slideIssues.push('text-on-image');
          break;
        }
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

    // ── Per-slide zone collision detection (pure CSS rect intersection) ──
    // Collect ALL content zones with explicit dimensions (skip accents, skip empty extras wrapper)
    const zoneRects = [];
    slide.querySelectorAll('[class*="zone-"]').forEach(z => {
      if (z.classList.contains('zone-extras')) return;
      if (z.className.includes('accent')) return;
      const s = parseInlineStyle(z);
      const left = parseFloat(s['left']) || 0;
      const top = parseFloat(s['top']) || 0;
      let width = parseFloat(s['width']) || 0;
      let height = parseFloat(s['height']) || 0;
      // Handle right/bottom style instead of width/height
      if (!width && s['right']) width = 100 - left - (parseFloat(s['right']) || 0);
      if (!height && s['bottom']) height = 100 - top - (parseFloat(s['bottom']) || 0);
      if (width > 0 && height > 0 && z.textContent.trim().length > 0) {
        zoneRects.push({ cls: z.className.replace(/\s+/g, ' ').trim(), left, top, right: left + width, bottom: top + height });
      }
    });
    // Check all pairs for overlap (deduplicate: only count one collision per slide)
    let hasCollision = false;
    for (let a = 0; a < zoneRects.length && !hasCollision; a++) {
      for (let b = a + 1; b < zoneRects.length && !hasCollision; b++) {
        const ra = zoneRects[a], rb = zoneRects[b];
        const overlapX = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
        const overlapY = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
        const overlapArea = overlapX * overlapY;
        const minArea = Math.min(
          (ra.right - ra.left) * (ra.bottom - ra.top),
          (rb.right - rb.left) * (rb.bottom - rb.top)
        );
        // Flag if overlap > 15% of smaller zone
        if (overlapArea > minArea * 0.15 && overlapArea > 20) {
          hasCollision = true;
          slideIssues.push('zone-collision');
        }
      }
    }

    // ── Visual utilization (% of slide area covered by content zones) ──
    let slideUtilization = 0;
    for (const r of zoneRects) {
      slideUtilization += (r.right - r.left) * (r.bottom - r.top);
    }
    // Normalize to 0-1 (100% = zones cover entire 100x100 area)
    slideUtilization = Math.min(slideUtilization / 10000, 1);
    const hasContentImg = slide.querySelector('img:not(.splice-img)');
    const isDark = false; // can't reliably check bg in jsdom — skip dark divider exemption here
    if (slideUtilization < 0.25 && !hasContentImg && idx > 0 && perSlideTextLen[idx] > 30) {
      slideIssues.push('low-utilization');
    }
    // Whitespace ratio: 1 - utilization. Accumulate for deck-level average.
    perSlideWhitespace.push(1 - slideUtilization);

    // ── Gestalt proximity: are related zones (title+body) closer than unrelated? ──
    // Simple heuristic: title zone center should be closer to body zone than to image zone
    // Score 1 if title-body distance < title-image distance, 0 otherwise
    const titleRect = zoneRects.find(r => r.cls.includes('title'));
    const bodyRect = zoneRects.find(r => r.cls.includes('body') || r.cls.includes('bullets'));
    const imageRect = zoneRects.find(r => r.cls.includes('image'));
    if (titleRect && bodyRect) {
      const titleCenter = { x: (titleRect.left + titleRect.right) / 2, y: (titleRect.top + titleRect.bottom) / 2 };
      const bodyCenter = { x: (bodyRect.left + bodyRect.right) / 2, y: (bodyRect.top + bodyRect.bottom) / 2 };
      const tbDist = Math.sqrt((titleCenter.x - bodyCenter.x) ** 2 + (titleCenter.y - bodyCenter.y) ** 2);
      if (imageRect) {
        const imgCenter = { x: (imageRect.left + imageRect.right) / 2, y: (imageRect.top + imageRect.bottom) / 2 };
        const tiDist = Math.sqrt((titleCenter.x - imgCenter.x) ** 2 + (titleCenter.y - imgCenter.y) ** 2);
        // Title should be closer to body than to image (Gestalt proximity)
        if (tbDist >= tiDist * 0.9) slideIssues.push('gestalt-proximity-violation');
      }
    }

    // ── Arnheim visual balance: weight = area × distance_from_center ──
    // Compute center of visual weight; perfect balance = center of slide
    if (zoneRects.length > 0) {
      let totalWeight = 0, weightedX = 0, weightedY = 0;
      for (const r of zoneRects) {
        const area = (r.right - r.left) * (r.bottom - r.top);
        const cx = (r.left + r.right) / 2;
        const cy = (r.top + r.bottom) / 2;
        totalWeight += area;
        weightedX += area * cx;
        weightedY += area * cy;
      }
      if (totalWeight > 0) {
        const cogX = weightedX / totalWeight; // center of gravity X (0-100)
        const cogY = weightedY / totalWeight; // center of gravity Y (0-100)
        // Distance from slide center (50, 50). Normalize to 0-1.
        const balanceDist = Math.sqrt((cogX - 50) ** 2 + (cogY - 50) ** 2) / 70.7; // 70.7 = max possible dist
        perSlideBalance.push(1 - balanceDist); // 1 = perfectly centered, 0 = corner-heavy
      }
    }

    // ── Reading path: zones should flow top-to-bottom ──
    // Score based on whether zone vertical order matches semantic order (title → body → image)
    const roleOrder = { title: 0, label: 0.5, body: 1, bullets: 1, table: 1.5, quote: 2, image: 2.5, links: 3 };
    const orderedZones = zoneRects
      .map(r => {
        const roleMatch = r.cls.match(/zone-(\w+)/);
        const role = roleMatch ? roleMatch[1] : 'unknown';
        const midY = (r.top + r.bottom) / 2;
        return { role, midY, order: roleOrder[role] ?? 2 };
      })
      .sort((a, b) => a.midY - b.midY); // sort by vertical position

    let flowViolations = 0;
    for (let i = 1; i < orderedZones.length; i++) {
      // A zone that's lower on the page should have equal or higher semantic order
      if (orderedZones[i].order < orderedZones[i - 1].order - 0.5) {
        flowViolations++;
      }
    }
    perSlideFlowScore.push(flowViolations === 0 ? 1 : flowViolations === 1 ? 0.5 : 0);

    // ── Focal point hierarchy: title zone should have highest visual weight ──
    if (zoneRects.length >= 2) {
      const zoneWeights = zoneRects.map(r => {
        const area = (r.right - r.left) * (r.bottom - r.top);
        const roleMatch = r.cls.match(/zone-(\w+)/);
        return { role: roleMatch ? roleMatch[1] : 'unknown', area };
      }).sort((a, b) => b.area - a.area);
      // Largest zone should be title or body (not image or table)
      if (zoneWeights[0] && !['title', 'body', 'bullets'].includes(zoneWeights[0].role)) {
        slideIssues.push('focal-point-not-text');
      }
    }

    // ── Content preservation ──
    slide.querySelectorAll('.zone-body,.zone-bullets,.zone-quote').forEach(z => {
      if (!z.textContent.trim()) {
        // Don't count as empty if the slide has a table or content image
        const slideHasTable = slide.querySelector('table');
        const slideHasImg = slide.querySelector('img:not(.splice-img)');
        if (!slideHasTable && !slideHasImg) emptyBodyZones++;
      }
    });

    // Link-only slide detection: has links but no real text content
    const hasSubstantiveText = slide.querySelector('h1,h2,h3,p,.bullet,.label,blockquote,td');
    const hasLinks = slide.querySelectorAll('a').length > 0;
    const hasImage = slide.querySelector('img');
    if (!hasSubstantiveText && !hasImage) contentlessSlides++;
    if (hasLinks && !hasSubstantiveText && !hasImage) {
      slideIssues.push('link-only');
    }

    // Duplicate text detection: check if same text appears in non-nested sibling zones
    const topZones = [];
    slide.querySelectorAll('[class*="zone-"]').forEach(z => {
      // Skip zones nested inside another zone (parent-child is not duplication)
      if (z.parentElement && z.parentElement.className && z.parentElement.className.includes('zone-')) return;
      const t = z.textContent.trim();
      if (t.length > 20) topZones.push(t);
    });
    for (let a = 0; a < topZones.length; a++) {
      for (let b = a + 1; b < topZones.length; b++) {
        const shorter = topZones[a].length < topZones[b].length ? topZones[a] : topZones[b];
        const longer = topZones[a].length < topZones[b].length ? topZones[b] : topZones[a];
        if (longer.includes(shorter) && shorter.length > 20) {
          slideIssues.push('duplicate-text');
        }
      }
    }

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

  // ── Background hue range (palette diversity) ──
  // Convert light backgrounds to HSL hue, measure the range
  const lightBgHues = bgs
    .filter(b => lum(b) > 0.3) // light backgrounds only
    .map(b => {
      const max = Math.max(b.r, b.g, b.b), min = Math.min(b.r, b.g, b.b);
      if (max === min) return 0; // achromatic
      let h;
      if (max === b.r) h = ((b.g - b.b) / (max - min)) % 6;
      else if (max === b.g) h = (b.b - b.r) / (max - min) + 2;
      else h = (b.r - b.g) / (max - min) + 4;
      return Math.round(h * 60 + 360) % 360;
    })
    .filter(h => h > 0); // exclude achromatic
  const bgHueRange = lightBgHues.length > 1
    ? Math.max(...lightBgHues) - Math.min(...lightBgHues)
    : lightBgHues.length === 1 ? 0 : 999; // 999 = no chromatic bgs (neutral)

  // ── NEW: Chromatic transition smoothness ──
  const bgTransitions = [];
  for (let i = 1; i < bgs.length; i++) {
    const a = bgs[i - 1], b = bgs[i];
    const dist = Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
    bgTransitions.push(dist);
  }
  const avgTransition = bgTransitions.length > 0
    ? bgTransitions.reduce((s, v) => s + v, 0) / bgTransitions.length : 0;
  const transitionVariance = bgTransitions.length > 1
    ? bgTransitions.reduce((s, v) => s + (v - avgTransition) ** 2, 0) / bgTransitions.length : 0;

  // ── NEW: Layout archetype signatures ──
  const layoutSignatures = [];
  slides.forEach(slide => {
    const zones = slide.querySelectorAll('.zone');
    const sig = [];
    zones.forEach(z => {
      const s = parseInlineStyle(z);
      const l = Math.round(parseFloat(s['left']) || 0);
      const w = Math.round(parseFloat(s['width']) || 0);
      sig.push(`${l}-${w}`);
    });
    layoutSignatures.push(sig.sort().join('|'));
  });
  // Count consecutive identical layouts
  let maxArchetypeRun = 1, archRun = 1;
  for (let i = 1; i < layoutSignatures.length; i++) {
    if (layoutSignatures[i] === layoutSignatures[i - 1] && layoutSignatures[i] !== '') {
      archRun++;
      maxArchetypeRun = Math.max(maxArchetypeRun, archRun);
    } else {
      archRun = 1;
    }
  }
  const uniqueArchetypes = new Set(layoutSignatures.filter(s => s !== ''));
  // Non-default positions: zones NOT starting at 0% or spanning 100%
  let nonDefaultZones = 0, totalZones = 0;
  slides.forEach(slide => {
    slide.querySelectorAll('.zone').forEach(z => {
      totalZones++;
      const s = parseInlineStyle(z);
      const l = Math.round(parseFloat(s['left']) || 0);
      const w = Math.round(parseFloat(s['width']) || 0);
      if (l > 2 && w < 95) nonDefaultZones++;
    });
  });

  // ── NEW: Typography ratio (title vs body size) ──
  const bodySizes = new Set();
  slides.forEach(slide => {
    slide.querySelectorAll('p,.bullet,li,td,.body').forEach(el => {
      const s = parseInlineStyle(el);
      const fs = parseFloat(s['font-size']);
      if (!isNaN(fs) && fs > 0) bodySizes.add(Math.round(fs));
    });
  });
  const avgTitleSize = titleSizes.size > 0
    ? [...titleSizes].reduce((s, v) => s + v, 0) / titleSizes.size : 0;
  const avgBodySize = bodySizes.size > 0
    ? [...bodySizes].reduce((s, v) => s + v, 0) / bodySizes.size : 0;
  const typographyRatio = avgBodySize > 0 ? avgTitleSize / avgBodySize : 0;

  // ── NEW: Content density variance (visual rhythm) ──
  const densityMean = perSlideTextLen.length > 0
    ? perSlideTextLen.reduce((s, v) => s + v, 0) / perSlideTextLen.length : 0;
  const densityVariance = perSlideTextLen.length > 1
    ? perSlideTextLen.reduce((s, v) => s + (v - densityMean) ** 2, 0) / perSlideTextLen.length : 0;
  const densityCV = densityMean > 0 ? Math.sqrt(densityVariance) / densityMean : 0;

  // ── NEW: Accent saturation ──
  const accentRatio = total > 0 ? slidesWithAccents / total : 0;

  let slidesWithNoVisibleText = 0;
  perSlideTextLen.forEach((len, i) => {
    if (len < 5) {
      const slide = slides[i];
      const hasImg = slide && slide.querySelector('img');
      if (!hasImg) slidesWithNoVisibleText++;
    }
  });

  // ── Banality metrics ──
  // Low-density slides: below 15% of deck mean with no images
  let lowDensitySlides = 0;
  let sparseSlides = 0;
  const densityThreshold = densityMean * 0.15;
  perSlideTextLen.forEach((len, i) => {
    if (i === 0) return; // Exempt title slide
    const slide = slides[i];
    const hasImg = slide && slide.querySelector('img:not(.splice-img)');
    // Exempt dark dividers from both density penalties (consistent treatment)
    const bg = bgs[i] || { r: 250, g: 246, b: 238 };
    const isDarkDivider = lum(bg) < 0.15 && len < 50;
    if (len < Math.max(densityThreshold, 30) && !hasImg && !isDarkDivider) lowDensitySlides++;
    if (len < 150 && !hasImg && !isDarkDivider) sparseSlides++;
  });

  // Per-slide issue counts
  let linkOnlySlides = 0;
  let duplicateTextSlides = 0;
  let genericAltTotal = 0;
  let zoneCollisionSlides = 0;
  let lowUtilizationSlides = 0;
  perSlideIssues.forEach(issues => {
    if (issues.includes('link-only')) linkOnlySlides++;
    if (issues.includes('duplicate-text')) duplicateTextSlides++;
    if (issues.includes('zone-collision')) zoneCollisionSlides++;
    if (issues.includes('low-utilization')) lowUtilizationSlides++;
    genericAltTotal += issues.filter(i => i === 'generic-alt').length;
  });

  // ── Design theory metrics (v10) ──

  // Whitespace ratio: average across deck. Warde's crystal goblet: 25-45% is ideal.
  const avgWhitespace = perSlideWhitespace.length > 0
    ? perSlideWhitespace.reduce((s, v) => s + v, 0) / perSlideWhitespace.length : 0.5;

  // Typographic modular scale: check if title/body sizes follow a mathematical ratio.
  // Common scales: minor third (1.2x), major third (1.25x), perfect fourth (1.333x), golden (1.618x)
  const allTitleArr = [...titleSizes];
  const allBodyArr = [...bodySizes];
  let modularScaleScore = 0;
  if (allTitleArr.length > 0 && allBodyArr.length > 0) {
    const maxTitle = Math.max(...allTitleArr);
    const minTitle = Math.min(...allTitleArr);
    const avgBody = allBodyArr.reduce((s, v) => s + v, 0) / allBodyArr.length;
    if (avgBody > 0) {
      // Check if title-to-body ratio approximates a known scale
      const ratio = maxTitle / avgBody;
      const knownScales = [1.2, 1.25, 1.333, 1.414, 1.5, 1.618, 2.0, 2.618];
      const closestScale = knownScales.reduce((best, s) =>
        Math.abs(ratio - s) < Math.abs(ratio - best) ? s : best, knownScales[0]);
      const scaleFit = 1 - Math.abs(ratio - closestScale) / closestScale;
      modularScaleScore = scaleFit > 0.85 ? 2 : scaleFit > 0.7 ? 1 : 0;

      // Also check if title sizes form a consistent sequence
      if (allTitleArr.length >= 2) {
        const sorted = [...allTitleArr].sort((a, b) => b - a);
        const ratios = [];
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i + 1] > 0) ratios.push(sorted[i] / sorted[i + 1]);
        }
        // If all inter-title ratios are within 10% of each other, bonus
        if (ratios.length > 0) {
          const avgRatio = ratios.reduce((s, v) => s + v, 0) / ratios.length;
          const ratioVariance = ratios.reduce((s, v) => s + (v - avgRatio) ** 2, 0) / ratios.length;
          if (ratioVariance < 0.02) modularScaleScore = Math.min(modularScaleScore + 1, 3);
        }
      }
    }
  }

  // Color harmony: classify the bg palette into a named harmony system.
  // Extract hues from light backgrounds and check if they fit complementary/analogous/triadic/etc.
  const bgHues = bgs
    .map(b => {
      const max = Math.max(b.r, b.g, b.b), min = Math.min(b.r, b.g, b.b);
      if (max - min < 10) return -1; // achromatic
      let h;
      if (max === b.r) h = ((b.g - b.b) / (max - min)) % 6;
      else if (max === b.g) h = (b.b - b.r) / (max - min) + 2;
      else h = (b.r - b.g) / (max - min) + 4;
      return Math.round(h * 60 + 360) % 360;
    })
    .filter(h => h >= 0);
  const uniqueHues = [...new Set(bgHues.map(h => Math.round(h / 30) * 30))]; // quantize to 30-degree bins
  // Golden ratio detection: check if key zone proportions approximate 1:1.618
  let goldenRatioHits = 0, goldenRatioChecks = 0;
  const PHI = 1.618;
  const PHI_TOLERANCE = 0.15; // within 15% of golden ratio
  slides.forEach(slide => {
    slide.querySelectorAll('[class*="zone-"]').forEach(z => {
      if (z.classList.contains('zone-extras') || z.className.includes('accent')) return;
      const s = parseInlineStyle(z);
      const width = parseFloat(s['width']) || 0;
      const height = parseFloat(s['height']) || 0;
      if (width > 5 && height > 5) {
        goldenRatioChecks++;
        const ratio = Math.max(width, height) / Math.min(width, height);
        if (Math.abs(ratio - PHI) / PHI < PHI_TOLERANCE ||
            Math.abs(ratio - PHI * PHI) / (PHI * PHI) < PHI_TOLERANCE) {
          goldenRatioHits++;
        }
      }
    });
  });
  const goldenRatioFraction = goldenRatioChecks > 0 ? goldenRatioHits / goldenRatioChecks : 0;

  // Content density appropriateness
  let densityMismatches = 0;
  perSlideTextLen.forEach((len, i) => {
    const slide = slides[i];
    const hasH1 = slide && slide.querySelector('h1,h2');
    const hasTable = slide && slide.querySelector('table');
    const isTitle = i === 0;
    const isDivider = len < 50 && hasH1 && !hasTable;
    if (isDivider && len > 300) densityMismatches++;
    if (isTitle && len > 200) densityMismatches++;
  });

  let colorHarmonyType = "none";
  if (uniqueHues.length >= 2) {
    const hueGaps = [];
    for (let i = 0; i < uniqueHues.length; i++) {
      for (let j = i + 1; j < uniqueHues.length; j++) {
        const gap = Math.abs(uniqueHues[i] - uniqueHues[j]);
        hueGaps.push(Math.min(gap, 360 - gap));
      }
    }
    const maxGap = Math.max(...hueGaps);
    if (hueGaps.some(g => g >= 150 && g <= 210)) colorHarmonyType = "complementary";
    else if (maxGap < 60) colorHarmonyType = "analogous";
    else if (hueGaps.some(g => g >= 100 && g <= 140)) colorHarmonyType = "triadic";
    else if (maxGap < 90) colorHarmonyType = "analogous-wide";
    else colorHarmonyType = "mixed";
  } else if (uniqueHues.length === 1) {
    colorHarmonyType = "monochromatic";
  }
  const hasNamedHarmony = ["complementary", "analogous", "triadic", "monochromatic", "analogous-wide"].includes(colorHarmonyType);

  return {
    total, titles, designed, contrastErrors, contrastWarnings, overflows, brokenImgs,
    uniqueBgs: uniqueBgs.size, bgPalette: [...uniqueBgs], maxConsecBg: maxConsec, hasArc,
    zoneStarts: zoneStarts.size, zoneWidths: zoneWidths.size, titleSizes: [...titleSizes], fontSets: fonts.size,
    slidesWithAccents, totalImgs, imgOverlaps, imgPlacements: [...imgPlacements],
    tinyTextCount, tableTruncations, clippedContentSlides, textOnImageCount,
    emptyBodyZones, contentlessSlides, slidesWithNoVisibleText,
    perSlideTextLen, perSlideIssues,
    // v2 metrics
    maxArchetypeRun, uniqueArchetypes: uniqueArchetypes.size,
    nonDefaultZones, totalZones,
    typographyRatio, avgTitleSize, avgBodySize,
    densityCV, accentRatio,
    avgTransition, transitionVariance,
    inventedLabels: 0, // populated by content fidelity check
    // v3 banality metrics
    lowDensitySlides, linkOnlySlides, duplicateTextSlides, sparseSlides, genericAltTotal,
    zoneCollisionSlides, lowUtilizationSlides,
    // v4 splice metrics
    spliceCount, spliceVisibleCount, spliceAtmosphericCount, lowOpacitySpliceTotal,
    splicePlacementTypes: splicePlacements.size,
    // v9 diversity metrics
    bgHueRange,
    // v10 design theory metrics
    avgWhitespace, modularScaleScore, colorHarmonyType, hasNamedHarmony,
    // v10b: Gestalt, Arnheim, reading path
    gestaltViolations: perSlideIssues.reduce((n, iss) => n + (Array.isArray(iss) && iss.includes('gestalt-proximity-violation') ? 1 : 0), 0),
    focalPointViolations: perSlideIssues.reduce((n, iss) => n + (Array.isArray(iss) && iss.includes('focal-point-not-text') ? 1 : 0), 0),
    densityMismatches,
    avgBalance: perSlideBalance.length > 0 ? perSlideBalance.reduce((s, v) => s + v, 0) / perSlideBalance.length : 0.5,
    avgFlowScore: perSlideFlowScore.length > 0 ? perSlideFlowScore.reduce((s, v) => s + v, 0) / perSlideFlowScore.length : 1,
    goldenRatioFraction
  };
}

// Use shared scoring module — single source of truth for all dimension formulas
const { computeScores: _sharedScores } = require('./rubric-scores.js');
function computeScores(metrics) {
  return _sharedScores(metrics, { accessibilityCap: 8 }); // jsdom cap: can't check CSS-class contrast
}

function _computeScores_UNUSED(metrics) {
  // DEPRECATED: kept as reference. The live scoring is in rubric-scores.js
  const scores = {};
  const m = metrics;

  // 1. Accessibility — capped at 8 in jsdom mode (can't reliably check CSS-class contrast)
  scores.accessibility = Math.max(1, Math.min(8,
    8
    - m.contrastErrors * 2
    - m.contrastWarnings * 0.5
    - m.brokenImgs * 2
    - m.tinyTextCount * 0.5
    - Math.min(m.overflows * 0.5, 3)
  ));

  // 2. Communicability (visual-only)
  scores.communicability = null;

  // 3. Taste (visual-only)
  scores.taste = null;

  // 4. Grid Utilization — now measures layout quality, not just variety count
  const designedRatio = m.total > 0 ? m.designed / m.total : 0;
  const nonDefaultRatio = m.totalZones > 0 ? m.nonDefaultZones / m.totalZones : 0;
  const archetypeRepeatPenalty = m.maxArchetypeRun >= 4 ? 2 : m.maxArchetypeRun >= 3 ? 1 : 0;
  const archetypeVariety = m.total > 0 ? Math.min(m.uniqueArchetypes / (m.total * 0.4), 1) : 0;
  const collisionPenalty = Math.min((m.zoneCollisionSlides || 0) * 1.5, 6);  // -1.5 per slide with collisions, max -6
  scores.grid = Math.max(1, Math.min(10,
    designedRatio * 3                            // 3pts: all slides designed
    + nonDefaultRatio * 3                         // 3pts: zones use non-trivial positions
    + archetypeVariety * 2                        // 2pts: variety of layout archetypes
    - archetypeRepeatPenalty                      // -1 or -2: monotonous consecutive layouts
    + Math.min(m.zoneStarts / 6, 1) * 2           // 2pts: diverse column starts (need 6+)
    - collisionPenalty                             // -1.5 per slide with zone collisions
  ));

  // 5. Color Harmonics — now measures transition quality, not just binary arc
  const arcScore = m.hasArc
    ? (m.avgTransition > 40 && m.avgTransition < 280 ? 2.5 : 1.5)  // smooth arc vs erratic
    : 0.5;
  const transitionSmoothnessBonus = m.transitionVariance > 0
    ? (Math.sqrt(m.transitionVariance) / (m.avgTransition || 1) < 1.5 ? 1 : 0)  // low CV = consistent transitions
    : 0;
  scores.color = Math.max(1, Math.min(10,
    Math.min(m.uniqueBgs / 4, 1.5) * 2           // 3pts: need 4+ backgrounds to max (was 3)
    + arcScore                                     // 2.5pts: smooth arc (was binary 3/1)
    + transitionSmoothnessBonus                    // 1pt: consistent transition distances
    + (m.maxConsecBg <= 2 ? 2.5 : m.maxConsecBg <= 3 ? 1.5 : 0.5)  // 2.5pts: stricter run limit
    + (m.contrastErrors === 0 ? 1 : 0)             // 1pt: clean contrast
  ));

  // 6. Balance (visual-only)
  scores.balance = null;

  // 7. Coherence & Variance — typography hierarchy, layout variety, visual rhythm
  const titleSizeCount = m.titleSizes.length;
  const titleSizeScore = titleSizeCount >= 2 && titleSizeCount <= 5 ? 2
    : titleSizeCount === 1 ? 1
    : titleSizeCount <= 7 ? 1.5 : 0.5;            // penalize chaos (7+) AND monotony (1)
  const fontScore = m.fontSets >= 2 && m.fontSets <= 4 ? 1.5 : 0.5;  // 2-4 fonts good; 5+ bad
  const layoutVarietyScore = m.uniqueArchetypes >= 5 ? 1.5 : m.uniqueArchetypes >= 3 ? 1 : 0.5;
  const densityRhythm = m.densityCV > 0.4 && m.densityCV < 2.0 ? 1.5 : 0.5;  // text density varies but not wildly
  const accentBalance = m.accentRatio > 0.3 && m.accentRatio < 0.85 ? 1.5 : 0.5;  // not too sparse, not saturated
  // NEW: Typography hierarchy — title should be 1.8-3.0x body size
  const typoHierarchy = m.typographyRatio >= 1.8 && m.typographyRatio <= 3.0 ? 2
    : m.typographyRatio > 1.3 ? 1 : 0;            // flat hierarchy = no visual distinction
  scores.coherence = Math.max(1, Math.min(10,
    titleSizeScore
    + fontScore
    + layoutVarietyScore
    + densityRhythm
    + accentBalance
    + typoHierarchy
  ));

  // 8. Image Integration — combined overlap penalty (don't double-count textOnImage + imgOverlaps)
  const overlapPenalty = Math.min(Math.max(m.textOnImageCount, m.imgOverlaps) * 1, 4);
  const genericAltPenalty = Math.min((m.genericAltTotal || 0) * 0.15, 2);
  scores.images = m.totalImgs === 0 ? 5 : Math.max(1, Math.min(10,
    10
    - overlapPenalty
    - genericAltPenalty
    - (m.imgPlacements.length < 3 ? 2 : m.imgPlacements.length < 4 ? 1 : 0)
    - (m.totalImgs < m.total * 0.15 ? 1 : 0)
  ));

  // 9. Content Completeness — penalizes absence AND banality
  scores.contentCompleteness = Math.max(1, Math.min(10,
    10
    - m.emptyBodyZones * 1.5                       // empty body zones are serious
    - m.contentlessSlides * 2.5                     // slides with nothing
    - m.tableTruncations * 1.5                      // clipped tables
    - m.clippedContentSlides * 2                    // overflow hidden
    - m.slidesWithNoVisibleText * 2
    - (m.inventedLabels || 0) * 0.3                 // hallucinated headings
    - (m.lowDensitySlides || 0) * 0.4               // near-empty slides (banality, dark dividers exempt)
    - (m.sparseSlides || 0) * 0.5                   // under-150-chars slides with no images
    - (m.linkOnlySlides || 0) * 1.5                 // slides with only a link
    - (m.duplicateTextSlides || 0) * 1.5            // duplicate content across zones
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
