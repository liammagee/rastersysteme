#!/usr/bin/env node
/**
 * rubric-headless.js — headless rubric evaluation + autonomous refine loop
 *
 * Runs entirely in node.js with Puppeteer. No Chrome extension needed.
 * No Claude Code permission prompts. Fully autonomous.
 *
 * Usage:
 *   node rubric-headless.js <deck.html>                      evaluate only
 *   node rubric-headless.js <deck.html> --refine              evaluate + refine loop
 *   node rubric-headless.js <deck.html> --refine --max 5      max iterations
 *   node rubric-headless.js <deck.html> --refine --target 8   target per-dimension score
 *   node rubric-headless.js <deck.html> --screenshots         save sample screenshots
 *   node rubric-headless.js <deck.html> --json                output JSON scorecard
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { parseMarkdown, generateHTML } = require("./raster.js");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

// ═══════════════════════════════════════════════════════
// HEADLESS EVALUATION — Puppeteer-based rubric scoring
// ═══════════════════════════════════════════════════════

async function evaluate(htmlPath, options = {}) {
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const url = htmlPath.startsWith("http") ? htmlPath
    : `http://localhost:${options.port || 8701}/${htmlPath}`;
  await page.goto(url, { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 1500)); // extra wait for images to load

  const metrics = await page.evaluate(() => {
    const slides = document.querySelectorAll(".slide,.grid-slide");
    const total = slides.length;
    if (!total) return { error: "No slides" };

    // ── Utility functions ──
    function parseRGB(str) { const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? { r: +m[1], g: +m[2], b: +m[3] } : null; }
    function lum(c) { const [r,g,b] = [c.r,c.g,c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126*r + 0.7152*g + 0.0722*b; }
    function cr(a,b) { const l1=lum(a),l2=lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); }
    function hexRGB(c) { return "#" + [c.r,c.g,c.b].map(v => v.toString(16).padStart(2,"0")).join(""); }
    function overlapArea(a, b) {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    }

    // ── Counters ──
    let contrastErrors=0, contrastWarnings=0, overflows=0, brokenImgs=0;
    let titles=0, designed=0, totalImgs=0;
    let emptyBodyZones=0, contentlessSlides=0;
    // NEW metrics
    let tinyTextCount=0, tableTruncations=0, clippedContentSlides=0;
    let textOnImageCount=0, imgOverlaps=0;
    const bgs=[], titleSizes=new Set(), zoneStarts=new Set(), zoneWidths=new Set();
    const fonts=new Set(), imgPlacements=new Set();
    let slidesWithAccents=0;
    const perSlideTextLen = [];
    const perSlideIssues = [];

    slides.forEach((slide, idx) => {
      slide.style.display = "flex";
      const cs = getComputedStyle(slide);
      const bg = parseRGB(cs.backgroundColor) || {r:250,g:246,b:238};
      bgs.push(bg);
      if (slide.querySelector("h1,h2")) titles++;
      if (slide.classList.contains("designed")) designed++;
      const slideIssues = [];

      // ── Text elements: contrast + font size audit ──
      let slideVisibleText = "";
      slide.querySelectorAll("h1,h2,h3,p,li,span,blockquote,.label,.bullet,td,th,code,a").forEach(el => {
        const st = getComputedStyle(el);
        if (st.display==="none"||st.visibility==="hidden"||st.opacity==="0") return;
        const text = el.textContent.trim();
        if (!text) return;
        slideVisibleText += text + " ";

        // Font size floor (12px minimum per a11y rules)
        const fontSize = parseFloat(st.fontSize);
        if (fontSize < 11.5 && text.length > 1) {
          tinyTextCount++;
          slideIssues.push("tiny-text:" + fontSize.toFixed(0) + "px");
        }

        // Contrast check
        const fg=parseRGB(st.color); let elBg=parseRGB(st.backgroundColor);
        if (!elBg||(elBg.r===0&&elBg.g===0&&elBg.b===0&&st.backgroundColor.includes("0)"))) elBg=bg;
        if (fg&&elBg) { const r=cr(fg,elBg); const sz=fontSize; const bold=parseInt(st.fontWeight)>=700; const lg=sz>=18||(sz>=14&&bold); if (r<(lg?3:4.5)) { if (r<2) contrastErrors++; else contrastWarnings++; } }
      });
      perSlideTextLen.push(slideVisibleText.trim().length);

      // ── Overflow detection (skip decorative elements) ──
      slide.querySelectorAll("*").forEach(el => {
        const r=el.getBoundingClientRect(); const st=getComputedStyle(el);
        if (st.display==="none"||r.width===0) return;
        const tag = el.tagName.toLowerCase();
        if (["script","style","link","meta","img"].includes(tag)) return;
        if (el.classList.contains("accent-el") || el.closest(".accent-el")) return;
        if (el.classList.contains("dot")) return;
        if (!el.textContent.trim()) return;
        if (r.right>window.innerWidth+10||r.bottom>window.innerHeight+10) {
          let clipped = false;
          let parent = el.parentElement;
          while (parent && parent !== slide) {
            const ps = getComputedStyle(parent);
            if (ps.overflow==="hidden"||ps.overflow==="clip"||ps.overflow==="auto") { clipped=true; break; }
            parent = parent.parentElement;
          }
          if (!clipped) { overflows++; slideIssues.push("overflow"); }
        }
      });

      // ── Table truncation detection ──
      slide.querySelectorAll("table").forEach(table => {
        const tableRect = table.getBoundingClientRect();
        const parent = table.parentElement;
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        const parentStyle = getComputedStyle(parent);
        if (tableRect.width > parentRect.width + 5) {
          tableTruncations++;
          slideIssues.push("table-wider-than-container");
        }
        if (parentStyle.overflow === "hidden" || parentStyle.overflow === "auto") {
          let hiddenRows = 0;
          table.querySelectorAll("tr").forEach(row => {
            if (row.getBoundingClientRect().bottom > parentRect.bottom + 2) hiddenRows++;
          });
          if (hiddenRows > 0) { tableTruncations++; slideIssues.push("table-rows-clipped:" + hiddenRows); }
        }
      });

      // ── Clipped content detection (overflow:hidden hiding real text) ──
      let hasClipped = false;
      slide.querySelectorAll(".zone,.zone-body,.zone-bullets,.zone-quote,.zone-table").forEach(zone => {
        const zs = getComputedStyle(zone);
        if (zs.overflow !== "hidden" && zs.overflow !== "auto") return;
        const zr = zone.getBoundingClientRect();
        zone.querySelectorAll("h1,h2,h3,p,.bullet,li,td,blockquote").forEach(el => {
          if (el.getBoundingClientRect().bottom > zr.bottom + 5 && el.textContent.trim()) hasClipped = true;
        });
      });
      if (hasClipped) { clippedContentSlides++; slideIssues.push("content-clipped"); }

      // ── Image analysis with bounding-box overlap ──
      if (idx === 0) slide.querySelectorAll("img").forEach(img => { if (!img.complete||img.naturalWidth===0) brokenImgs++; });
      // Generic alt text detection — images with meaningless alt text
      slide.querySelectorAll("img").forEach(img => {
        const alt = (img.getAttribute("alt") || "").trim();
        if ((alt === "Image" || alt === "image" || alt === "") && !img.classList.contains("splice-img")) {
          slideIssues.push("generic-alt");
        }
      });
      const imgInfos = [];
      slide.querySelectorAll("img").forEach(img => {
        const ir = img.getBoundingClientRect();
        if (ir.width===0 || ir.height===0) return;
        totalImgs++;
        let effectiveOpacity = 1;
        let el = img;
        while (el && el !== slide) { effectiveOpacity *= parseFloat(getComputedStyle(el).opacity||"1"); el = el.parentElement; }
        const cx=ir.left+ir.width/2, cy=ir.top+ir.height/2;
        imgPlacements.add(cx>window.innerWidth*0.65?"right":cx<window.innerWidth*0.35?"left":cy<window.innerHeight*0.35?"top":cy>window.innerHeight*0.65?"bottom":"centre");
        imgInfos.push({ rect: ir, opacity: effectiveOpacity });
      });

      // Text-on-image overlap (bounding box intersection, opacity-aware)
      slide.querySelectorAll("h1,h2,h3,p,.bullet,blockquote,.label,td,th,a,code").forEach(el => {
        const st = getComputedStyle(el);
        if (st.display==="none"||st.visibility==="hidden"||!el.textContent.trim()) return;
        const tr = el.getBoundingClientRect();
        if (tr.width===0||tr.height===0) return;
        for (const imgInfo of imgInfos) {
          if (imgInfo.opacity <= 0.2) continue;
          const overlap = overlapArea(tr, imgInfo.rect);
          const textArea = tr.width * tr.height;
          if (textArea===0) continue;
          const pct = overlap / textArea;
          if (pct > 0.3 && (imgInfo.opacity >= 0.5 || pct > 0.7)) {
            textOnImageCount++;
            imgOverlaps++;
            slideIssues.push("text-on-image");
            break;
          }
        }
      });

      // ── Zone and font metrics ──
      slide.querySelectorAll(".zone").forEach(z => { zoneStarts.add(Math.round(parseFloat(z.style.left)||0)); zoneWidths.add(Math.round(parseFloat(z.style.width)||0)); });
      slide.querySelectorAll("h1,h2").forEach(el => { if (getComputedStyle(el).display!=="none") titleSizes.add(Math.round(parseFloat(getComputedStyle(el).fontSize))); });
      slide.querySelectorAll("h1,h2,p,.bullet,.label").forEach(el => { const f=getComputedStyle(el).fontFamily.split(",")[0].replace(/['"]/g,"").trim(); if (f) fonts.add(f); });
      if (slide.querySelectorAll(".accent-el,[class*=accent]").length) slidesWithAccents++;

      // ── Content preservation ──
      slide.querySelectorAll(".zone-body,.zone-bullets,.zone-quote").forEach(z => {
        if (!z.textContent.trim()) {
          // Don't count as empty if the slide has a table or image — content is present, just in a different element
          const slideHasTable = slide.querySelector("table");
          const slideHasImg = slide.querySelector("img:not(.splice-img)");
          if (!slideHasTable && !slideHasImg) emptyBodyZones++;
        }
      });
      const hasSubstantiveText = slide.querySelector("h1,h2,h3,p,.bullet,.label,blockquote,td");
      const hasLinks = slide.querySelectorAll("a").length > 0;
      const hasImage = slide.querySelector("img");
      if (!hasSubstantiveText && !hasImage) contentlessSlides++;
      if (hasLinks && !hasSubstantiveText && !hasImage) slideIssues.push("link-only");
      // Duplicate text across non-nested sibling zones
      const topZones = [];
      slide.querySelectorAll("[class*='zone-']").forEach(z => {
        if (z.parentElement && z.parentElement.className && z.parentElement.className.includes("zone-")) return;
        const t = z.textContent.trim();
        if (t.length > 20) topZones.push(t);
      });
      for (let a = 0; a < topZones.length; a++) {
        for (let b = a + 1; b < topZones.length; b++) {
          const shorter = topZones[a].length < topZones[b].length ? topZones[a] : topZones[b];
          const longer = topZones[a].length < topZones[b].length ? topZones[b] : topZones[a];
          if (longer.includes(shorter) && shorter.length > 20) slideIssues.push("duplicate-text");
        }
      }

      perSlideIssues.push(slideIssues);
      if (idx>0) slide.style.display="none";
    });

    // ── Deck-level metrics ──
    let maxConsec=1, run=1;
    for (let i=1;i<bgs.length;i++) { if (hexRGB(bgs[i])===hexRGB(bgs[i-1])) { run++; maxConsec=Math.max(maxConsec,run); } else run=1; }
    const uniqueBgs=new Set(bgs.map(hexRGB));
    const hasArc=bgs.length>1 && [...new Set(bgs.map(b=>lum(b)>0.5?"L":"D"))].length>1;
    // Only count "no visible text" if the slide also has no images (image-only slides are OK)
    let slidesWithNoVisibleText = 0;
    perSlideTextLen.forEach((len, i) => {
      if (len < 5) {
        const slide = slides[i];
        const hasImg = slide && slide.querySelector("img");
        if (!hasImg) slidesWithNoVisibleText++;
      }
    });

    // ── Banality metrics ──
    let lowDensitySlides = 0;
    const deckMeanText = perSlideTextLen.length > 0 ? perSlideTextLen.reduce((s,v)=>s+v,0)/perSlideTextLen.length : 0;
    const lowThreshold = Math.max(deckMeanText * 0.15, 30);
    perSlideTextLen.forEach((len, i) => {
      const slide = slides[i];
      const hasImg = slide && slide.querySelector("img");
      if (len < lowThreshold && !hasImg) lowDensitySlides++;
    });
    let linkOnlySlides = 0, duplicateTextSlides = 0, genericAltTotal = 0;
    let sparseSlides = 0;
    perSlideIssues.forEach(issues => {
      if (issues.includes("link-only")) linkOnlySlides++;
      if (issues.includes("duplicate-text")) duplicateTextSlides++;
      genericAltTotal += issues.filter(i => i === "generic-alt").length;
    });
    perSlideTextLen.forEach((len, i) => {
      if (i === 0) return; // Exempt title slide — intentionally sparse
      const slide = slides[i];
      const hasImg = slide && slide.querySelector("img:not(.splice-img)");
      // Exempt section divider/break slides (dark bg with minimal text is intentional)
      const bgStr = bgs[i] ? hexRGB(bgs[i]) : "";
      const isDarkDivider = lum(bgs[i] || {r:250,g:246,b:238}) < 0.15 && len < 50;
      if (len < 150 && !hasImg && !isDarkDivider) sparseSlides++;
    });

    // ── NEW: Layout archetype signatures ──
    const layoutSignatures = [];
    slides.forEach(slide => {
      const zones = slide.querySelectorAll(".zone");
      const sig = [];
      zones.forEach(z => {
        const l = Math.round(parseFloat(z.style.left) || 0);
        const w = Math.round(parseFloat(z.style.width) || 0);
        sig.push(l + "-" + w);
      });
      layoutSignatures.push(sig.sort().join("|"));
    });
    let maxArchetypeRun = 1, archRun = 1;
    for (let i = 1; i < layoutSignatures.length; i++) {
      if (layoutSignatures[i] === layoutSignatures[i - 1] && layoutSignatures[i] !== "") {
        archRun++;
        maxArchetypeRun = Math.max(maxArchetypeRun, archRun);
      } else archRun = 1;
    }
    const uniqueArchetypes = new Set(layoutSignatures.filter(s => s !== ""));
    let nonDefaultZones = 0, totalZonesCount = 0;
    slides.forEach(slide => {
      slide.querySelectorAll(".zone").forEach(z => {
        totalZonesCount++;
        const l = Math.round(parseFloat(z.style.left) || 0);
        const w = Math.round(parseFloat(z.style.width) || 0);
        if (l > 2 && w < 95) nonDefaultZones++;
      });
    });

    // ── NEW: Typography ratio ──
    const bodySizes = new Set();
    slides.forEach(slide => {
      slide.querySelectorAll("p,.bullet,li,td,.body").forEach(el => {
        if (getComputedStyle(el).display === "none") return;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (!isNaN(fs) && fs > 0) bodySizes.add(Math.round(fs));
      });
    });
    const avgTitleSize = titleSizes.size > 0 ? [...titleSizes].reduce((s,v) => s+v, 0) / titleSizes.size : 0;
    const avgBodySize = bodySizes.size > 0 ? [...bodySizes].reduce((s,v) => s+v, 0) / bodySizes.size : 0;
    const typographyRatio = avgBodySize > 0 ? avgTitleSize / avgBodySize : 0;

    // ── NEW: Content density variance ──
    const densityMean = perSlideTextLen.length > 0 ? perSlideTextLen.reduce((s,v) => s+v, 0) / perSlideTextLen.length : 0;
    const densityVariance = perSlideTextLen.length > 1 ? perSlideTextLen.reduce((s,v) => s+(v-densityMean)**2, 0) / perSlideTextLen.length : 0;
    const densityCV = densityMean > 0 ? Math.sqrt(densityVariance) / densityMean : 0;

    // ── NEW: Accent saturation & chromatic transitions ──
    const accentRatio = total > 0 ? slidesWithAccents / total : 0;
    const bgTransitions = [];
    for (let i = 1; i < bgs.length; i++) {
      const a = bgs[i-1], b = bgs[i];
      bgTransitions.push(Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2));
    }
    const avgTransition = bgTransitions.length > 0 ? bgTransitions.reduce((s,v)=>s+v,0)/bgTransitions.length : 0;
    const transitionVariance = bgTransitions.length > 1 ? bgTransitions.reduce((s,v)=>s+(v-avgTransition)**2,0)/bgTransitions.length : 0;

    return { total, titles, designed, contrastErrors, contrastWarnings, overflows, brokenImgs,
      uniqueBgs:uniqueBgs.size, bgPalette:[...uniqueBgs], maxConsecBg:maxConsec, hasArc,
      zoneStarts:zoneStarts.size, zoneWidths:zoneWidths.size, titleSizes:[...titleSizes], fontSets:fonts.size,
      slidesWithAccents, totalImgs, imgOverlaps, imgPlacements:[...imgPlacements],
      tinyTextCount, tableTruncations, clippedContentSlides, textOnImageCount,
      emptyBodyZones, contentlessSlides, slidesWithNoVisibleText,
      perSlideTextLen, perSlideIssues,
      maxArchetypeRun, uniqueArchetypes: uniqueArchetypes.size,
      nonDefaultZones, totalZones: totalZonesCount,
      typographyRatio, avgTitleSize, avgBodySize,
      densityCV, accentRatio, avgTransition, transitionVariance,
      inventedLabels: 0,
      lowDensitySlides, linkOnlySlides, duplicateTextSlides,
      sparseSlides, genericAltTotal };
  });

  if (options.screenshots) {
    const dir = options.screenshotDir || "/tmp/rubric-screenshots";
    fs.mkdirSync(dir, { recursive: true });
    const total = metrics.total;
    for (const idx of [0, Math.floor(total/4), Math.floor(total/2), Math.floor(3*total/4), total-1]) {
      await page.evaluate(n => { document.querySelectorAll(".slide,.grid-slide").forEach((s,i) => { s.classList.toggle("active",i===n); s.style.display=i===n?"flex":"none"; }); }, idx);
      await new Promise(r => setTimeout(r, 300));
      await page.screenshot({ path: path.join(dir, `slide-${idx+1}.png`) });
    }
  }

  await browser.close();

  // ── Score (9 dimensions, each /10, total /90) ──
  const scores = {};
  const m = metrics;

  // 1. Accessibility — contrast, font sizes, broken images
  scores.accessibility = Math.max(1, Math.min(10,
    10
    - m.contrastErrors * 2
    - m.contrastWarnings * 0.5
    - m.brokenImgs * 2
    - m.tinyTextCount * 0.5
    - Math.min(m.overflows * 0.5, 3)
  ));

  // 2. Communicability — visual only (stub: requires Claude vision assessment)
  scores.communicability = null;

  // 3. Taste — visual only (stub: requires Claude vision assessment)
  scores.taste = null;

  // 4. Grid Utilization — layout quality, not just variety count
  const designedRatio = m.total > 0 ? m.designed / m.total : 0;
  const nonDefaultRatio = m.totalZones > 0 ? m.nonDefaultZones / m.totalZones : 0;
  const archetypeRepeatPenalty = m.maxArchetypeRun >= 4 ? 2 : m.maxArchetypeRun >= 3 ? 1 : 0;
  const archetypeVariety = m.total > 0 ? Math.min(m.uniqueArchetypes / (m.total * 0.4), 1) : 0;
  scores.grid = Math.max(1, Math.min(10,
    designedRatio * 3
    + nonDefaultRatio * 3
    + archetypeVariety * 2
    - archetypeRepeatPenalty
    + Math.min(m.zoneStarts / 6, 1) * 2
  ));

  // 5. Color Harmonics — transition quality, not just binary arc
  const arcScore = m.hasArc
    ? (m.avgTransition > 40 && m.avgTransition < 280 ? 2.5 : 1.5)
    : 0.5;
  const transitionSmoothnessBonus = m.transitionVariance > 0
    ? (Math.sqrt(m.transitionVariance) / (m.avgTransition || 1) < 1.5 ? 1 : 0)
    : 0;
  scores.color = Math.max(1, Math.min(10,
    Math.min(m.uniqueBgs / 4, 1.5) * 2
    + arcScore
    + transitionSmoothnessBonus
    + (m.maxConsecBg <= 2 ? 2.5 : m.maxConsecBg <= 3 ? 1.5 : 0.5)
    + (m.contrastErrors === 0 ? 1 : 0)
  ));

  // 6. Layout Balance — visual only (stub)
  scores.balance = null;

  // 7. Coherence & Variance — typography hierarchy, layout variety, visual rhythm
  const titleSizeCount = m.titleSizes.length;
  const titleSizeScore = titleSizeCount >= 2 && titleSizeCount <= 5 ? 2
    : titleSizeCount === 1 ? 1
    : titleSizeCount <= 7 ? 1.5 : 0.5;
  const fontScore = m.fontSets >= 2 && m.fontSets <= 4 ? 1.5 : 0.5;
  const layoutVarietyScore = m.uniqueArchetypes >= 5 ? 1.5 : m.uniqueArchetypes >= 3 ? 1 : 0.5;
  const densityRhythm = m.densityCV > 0.4 && m.densityCV < 2.0 ? 1.5 : 0.5;
  const accentBalance = m.accentRatio > 0.3 && m.accentRatio < 0.85 ? 1.5 : 0.5;
  const typoHierarchy = m.typographyRatio >= 1.8 && m.typographyRatio <= 3.0 ? 2
    : m.typographyRatio > 1.3 ? 1 : 0;
  scores.coherence = Math.max(1, Math.min(10,
    titleSizeScore + fontScore + layoutVarietyScore + densityRhythm + accentBalance + typoHierarchy
  ));

  // 8. Image Integration — overlap + generic alt + placement
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
    - m.emptyBodyZones * 1.5
    - m.contentlessSlides * 2.5
    - m.tableTruncations * 1.5
    - m.clippedContentSlides * 2
    - m.slidesWithNoVisibleText * 2
    - (m.inventedLabels || 0) * 0.3
    - (m.lowDensitySlides || 0) * 0.8
    - (m.sparseSlides || 0) * 0.5
    - (m.linkOnlySlides || 0) * 1.5
    - (m.duplicateTextSlides || 0) * 1.5
  ));

  // Round all computed scores
  for (const k of Object.keys(scores)) {
    if (scores[k] !== null) scores[k] = Math.round(scores[k] * 10) / 10;
  }

  // Total: sum of computed dimensions only (visual-only dimensions excluded)
  const computedDims = Object.entries(scores).filter(([, v]) => v !== null);
  const computedTotal = Math.round(computedDims.reduce((a, [, v]) => a + v, 0) * 10) / 10;
  const maxComputed = computedDims.length * 10;

  return { metrics, scores, computedTotal, maxComputed };
}

// ═══════════════════════════════════════════════════════
// REFINE — automated design improvement
// ═══════════════════════════════════════════════════════

function applyFixes(composedPath, scores, metrics) {
  let md = fs.readFileSync(composedPath, "utf-8");
  const parts = md.split(/\n---\n/);
  const changes = [];

  // Fix 1: Break consecutive bg runs > 3
  if (metrics.maxConsecBg > 3) {
    const bgs = parts.map(p => { const m = p.match(/"bg":"([A-Fa-f0-9]+)"/); return m ? m[1] : null; });
    let run = 1;
    for (let i = 1; i < bgs.length; i++) {
      if (bgs[i] && bgs[i] === bgs[i-1]) {
        run++;
        if (run > 3 && parseInt(bgs[i].slice(0,2),16) > 180) {
          const alt = (i % 3 === 0) ? "1A2840" : "F0EAD8";
          parts[i] = parts[i].replace(/"bg":"[A-Fa-f0-9]+"/, `"bg":"${alt}"`);
          if (alt === "1A2840") {
            parts[i] = parts[i]
              .replace(/"title":\{([^}]*?)"color":"[12][A-Fa-f0-9]{5}"/g, '"title":{$1"color":"FAF6EE"')
              .replace(/"body":\{([^}]*?)"color":"[12][A-Fa-f0-9]{5}"/g, '"body":{$1"color":"F0EAD8"');
          }
          changes.push(`S${i+1}: bg → ${alt} (break run)`);
          run = 1;
        }
      } else run = 1;
    }
  }

  // Fix 2: Light text on light bg
  if (metrics.contrastErrors > 0) {
    parts.forEach((p, i) => {
      const bgM = p.match(/"bg":"([A-Fa-f0-9]+)"/);
      if (!bgM) return;
      if (parseInt(bgM[1].slice(0,2),16) > 180) {
        const before = p;
        parts[i] = p.replace(/"color":"[EF][A-Fa-f0-9]{5}"/g, '"color":"1A2840"');
        if (parts[i] !== before) changes.push(`S${i+1}: fix light-on-light text`);
      }
    });
  }

  // Fix 3: Add right-offset layouts
  if (metrics.zoneStarts < 5) {
    let n = 0;
    parts.forEach((p, i) => {
      if (n >= 4) return;
      if (i % 6 === 3 && p.includes('"role":"title","col":6')) {
        parts[i] = p.replace('"role":"title","col":6', '"role":"title","col":28');
        changes.push(`S${i+1}: title → col 28`);
        n++;
      }
    });
  }

  // Fix 4: Expand cramped body/table zones to reduce overflow and clipping
  if (metrics.overflows > 0 || metrics.clippedContentSlides > 0 || metrics.tableTruncations > 0) {
    parts.forEach((p, i) => {
      // Expand body rowSpan if it's small
      const bodyZone = p.match(/"role":"body","col":(\d+),"span":(\d+),"row":(\d+),"rowSpan":(\d+)/);
      if (bodyZone && parseInt(bodyZone[4]) < 24) {
        const newSpan = Math.min(parseInt(bodyZone[4]) + 6, 30);
        const before = parts[i];
        parts[i] = p.replace(/"role":"body","col":(\d+),"span":(\d+),"row":(\d+),"rowSpan":(\d+)/,
          `"role":"body","col":$1,"span":$2,"row":$3,"rowSpan":${newSpan}`);
        if (parts[i] !== before) changes.push(`S${i+1}: body rowSpan → ${newSpan}`);
      }
      // Widen narrow body spans (< 30 cols) on slides with lots of content
      if (bodyZone && parseInt(bodyZone[2]) < 30) {
        const lineCount = (p.match(/\n/g) || []).length;
        if (lineCount > 10) {
          const newSpan = Math.min(parseInt(bodyZone[2]) + 10, 52);
          const before = parts[i];
          parts[i] = parts[i].replace(/"role":"body","col":(\d+),"span":(\d+)/,
            `"role":"body","col":$1,"span":${newSpan}`);
          if (parts[i] !== before) changes.push(`S${i+1}: body span → ${newSpan}`);
        }
      }
      // Expand table zones similarly
      const tableZone = p.match(/"role":"table","col":(\d+),"span":(\d+),"row":(\d+),"rowSpan":(\d+)/);
      if (tableZone) {
        const tSpan = parseInt(tableZone[2]), tRowSpan = parseInt(tableZone[4]);
        const before = parts[i];
        if (tSpan < 50) parts[i] = parts[i].replace(/"role":"table","col":(\d+),"span":\d+/, `"role":"table","col":$1,"span":${Math.min(tSpan + 8, 54)}`);
        if (tRowSpan < 30) parts[i] = parts[i].replace(/"role":"table","col":(\d+),"span":(\d+),"row":(\d+),"rowSpan":\d+/, `"role":"table","col":$1,"span":$2,"row":$3,"rowSpan":${Math.min(tRowSpan + 6, 34)}`);
        if (parts[i] !== before) changes.push(`S${i+1}: expanded table zone`);
      }
      // Reduce large title sizes to prevent overflow
      const titleTypo = p.match(/"title":\{([^}]*?)"size":(\d+)/);
      if (titleTypo && parseInt(titleTypo[2]) > 44) {
        const before = parts[i];
        parts[i] = parts[i].replace(/"title":\{([^}]*?)"size":\d+/, `"title":{$1"size":38`);
        if (parts[i] !== before) changes.push(`S${i+1}: title size → 38`);
      }
    });
  }

  // Fix 4b: Bump tiny label text to 12px minimum
  if (metrics.tinyTextCount > 0) {
    let labelFixes = 0;
    parts.forEach((p, i) => {
      const labelTypo = p.match(/"label":\{([^}]*?)"size":(\d+)/);
      if (labelTypo && parseInt(labelTypo[2]) < 12) {
        parts[i] = p.replace(/"label":\{([^}]*?)"size":\d+/, '"label":{$1"size":12');
        labelFixes++;
      }
    });
    if (labelFixes) changes.push(`Labels: bumped ${labelFixes} labels to 12px minimum`);
  }

  // Fix 4c: Remove empty body zones from image-only or table-only slides
  if (metrics.emptyBodyZones > 0) {
    parts.forEach((p, i) => {
      // Only remove body zone if slide has no body/bullets/quote content (just images or tables)
      const hasBodyContent = /\n\s*[-*]\s+/.test(p) || /\n[A-Za-z]/.test(p.replace(/<!--[\s\S]*?-->/g, "").replace(/```[\s\S]*?```/g, "").replace(/^###?\s.*/gm, ""));
      if (!hasBodyContent) {
        const before = parts[i];
        // Remove the body zone from the JSON
        parts[i] = parts[i].replace(/,?\{"role":"body"[^}]*\}/g, "");
        // Clean up trailing/leading commas in zones array
        parts[i] = parts[i].replace(/\[,/g, "[").replace(/,,/g, ",").replace(/,\]/g, "]");
        if (parts[i] !== before) changes.push(`S${i+1}: removed empty body zone`);
      }
    });
  }

  // Fix 5: Clamp accent and zone boundaries to grid (col+span<=60, row+rowSpan<=40)
  parts.forEach((p, i) => {
    // Accent clamping
    let modified = p.replace(/"col":(\d+),"span":(\d+)/g, (match, col, span) => {
      const c = parseInt(col), s = parseInt(span);
      if (c + s > 60) {
        const newSpan = Math.max(1, 60 - c);
        changes.push(`S${i+1}: clamped span ${s}→${newSpan} (col ${c})`);
        return `"col":${c},"span":${newSpan}`;
      }
      return match;
    });
    modified = modified.replace(/"row":(\d+),"rowSpan":(\d+)/g, (match, row, span) => {
      const r = parseInt(row), s = parseInt(span);
      if (r + s > 40) {
        const newSpan = Math.max(1, 40 - r);
        return `"row":${r},"rowSpan":${newSpan}`;
      }
      return match;
    });
    parts[i] = modified;
  });

  // Fix 6: Bump contrast on near-miss warnings (darken text slightly on light bgs)
  if (metrics.contrastWarnings > 0) {
    parts.forEach((p, i) => {
      const bgM = p.match(/"bg":"([A-Fa-f0-9]+)"/);
      if (!bgM) return;
      const bgLum = parseInt(bgM[1].slice(0, 2), 16);
      if (bgLum > 200) {
        // Very light bg — darken any mid-tone text colors
        const before = p;
        parts[i] = p.replace(/"color":"([89A-Ba-b][A-Fa-f0-9]{5})"/g, (match, hex) => {
          // Darken by ~15%
          const r = Math.max(0, Math.round(parseInt(hex.slice(0,2),16) * 0.85));
          const g = Math.max(0, Math.round(parseInt(hex.slice(2,4),16) * 0.85));
          const b = Math.max(0, Math.round(parseInt(hex.slice(4,6),16) * 0.85));
          const newHex = [r,g,b].map(v => v.toString(16).padStart(2,"0")).join("");
          return `"color":"${newHex}"`;
        });
        if (parts[i] !== before) changes.push(`S${i+1}: darkened mid-tone text for contrast`);
      }
    });
  }

  // Fix 7: Darken label accent colors
  let joined = parts.join("\n---\n");
  const labelCount = (joined.match(/"label":\{[^}]*"color":"[BC][A-Fa-f0-9]{5}"/g) || []).length;
  if (labelCount > 0) {
    joined = joined.replace(/"label":\{([^}]*?)"color":"[BC][A-Fa-f0-9]{5}"/g, '"label":{$1"color":"8B7355"');
    changes.push(`Labels: darkened ${labelCount} accent labels`);
  }

  fs.writeFileSync(composedPath, joined);
  return changes;
}

// ═══════════════════════════════════════════════════════
// CONTENT FIDELITY — compare source vs composed markdown
// ═══════════════════════════════════════════════════════

function checkContentFidelity(composedPath) {
  // Try to find the source markdown
  const composed = fs.readFileSync(composedPath, "utf-8");
  const compSlides = composed.split(/\n---\n/).map(s => s.trim()).filter(s => s);

  // Look for source path — extract "week-N" from names like "week-2-v2.composed.md"
  const fileName = path.basename(composedPath);
  const weekMatch = fileName.match(/(week-\d+)/);
  const baseName = weekMatch ? weekMatch[1] : fileName.replace(/[.-].*$/, "");
  const possibleSources = [
    path.join(path.dirname(composedPath), "..", "content", baseName, baseName + ".md"),
    path.join(path.dirname(composedPath), "..", "content", baseName, baseName.replace(/-/g, "_") + ".md"),
  ];
  const sourcePath = possibleSources.find(p => fs.existsSync(p));
  if (!sourcePath) return null;

  const source = fs.readFileSync(sourcePath, "utf-8");
  const srcSlides = source.split(/\n---\n/).map(s => s.trim()).filter(s => s && !s.startsWith("<!---"));

  const issues = [];

  // Check for invented labels (### lines in composed that don't exist in source)
  let inventedLabels = 0;
  compSlides.forEach((cs, i) => {
    const labels = cs.match(/^### (.+)$/gm) || [];
    const srcClean = (srcSlides[i] || "").replace(/<!--[\s\S]*?-->/g, "");
    for (const label of labels) {
      const text = label.replace(/^### /, "").trim();
      if (text.length > 2 && !srcClean.includes(text)) {
        inventedLabels++;
      }
    }
  });

  if (inventedLabels > 0) {
    issues.push(`${inventedLabels} invented labels (### text not in source)`);
  }

  // Check slide count
  if (compSlides.length !== srcSlides.length) {
    issues.push(`slide count mismatch: source ${srcSlides.length} vs composed ${compSlides.length}`);
  }

  return { inventedLabels, slideCountMatch: compSlides.length === srcSlides.length, issues };
}

// ═══════════════════════════════════════════════════════
// LESSON EXTRACTION — feed evaluation insights back to compose
// ═══════════════════════════════════════════════════════

function extractLessons(metrics, scores, htmlPath) {
  const lessonsPath = path.join(path.dirname(htmlPath), "..", "design-lessons.md");
  const lessons = [];
  const m = metrics;
  const timestamp = new Date().toISOString().slice(0, 10);
  const deck = path.basename(htmlPath);

  // Analyze each metric and generate specific lessons
  if (m.tinyTextCount > 0) {
    lessons.push(`- [${timestamp}] **${deck}**: ${m.tinyTextCount} text elements below 12px. ` +
      `Increase label/caption font-size to >= 12px in design directives.`);
  }

  if (m.textOnImageCount > 5) {
    lessons.push(`- [${timestamp}] **${deck}**: ${m.textOnImageCount} text-on-image collisions. ` +
      `Use \`--image-scale subtle\` when splicing. Avoid \`overlay\` and \`background\` placement ` +
      `on text-heavy slides.`);
  }

  if (m.tableTruncations > 0) {
    lessons.push(`- [${timestamp}] **${deck}**: ${m.tableTruncations} table truncations. ` +
      `Tables need dedicated table zones with span >= 50 and rowSpan >= 30. ` +
      `Reduce body font-size to 10-11px for dense tables.`);
  }

  if (m.clippedContentSlides > 0) {
    lessons.push(`- [${timestamp}] **${deck}**: ${m.clippedContentSlides} slides with clipped content. ` +
      `Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). ` +
      `Add explicit body zones for slides with unzoned text.`);
  }

  if (m.emptyBodyZones > 2) {
    lessons.push(`- [${timestamp}] **${deck}**: ${m.emptyBodyZones} empty body zones. ` +
      `Remove body zones from image-only and table-only slides. ` +
      `Match zone roles to actual content type.`);
  }

  if (m.contrastErrors > 0) {
    lessons.push(`- [${timestamp}] **${deck}**: ${m.contrastErrors} WCAG contrast failures. ` +
      `On dark backgrounds (lum < 0.2), use FFFFFF/F8F5F0 for titles, F0EBE3 for body. ` +
      `Avoid mid-tone text on any background.`);
  }

  if (m.contrastWarnings > 10) {
    lessons.push(`- [${timestamp}] **${deck}**: ${m.contrastWarnings} contrast warnings. ` +
      `Darken label colors on light backgrounds (use 6A6052 or darker). ` +
      `Theme accent colors fail on dark backgrounds — let renderer adapt them.`);
  }

  if (m.overflows > 5) {
    lessons.push(`- [${timestamp}] **${deck}**: ${m.overflows} text overflows. ` +
      `Reduce title sizes to <= 44px on content slides. ` +
      `Widen body zones to span >= 44 on slides with >10 content lines.`);
  }

  if (m.slidesWithNoVisibleText > 0) {
    lessons.push(`- [${timestamp}] **${deck}**: ${m.slidesWithNoVisibleText} slides with no visible text (and no images). ` +
      `Ensure every non-image slide has a body or quote zone with content.`);
  }

  // Per-slide pattern detection
  const problemSlides = (m.perSlideIssues || [])
    .map((issues, i) => [i + 1, issues])
    .filter(([, issues]) => issues.length >= 3);
  if (problemSlides.length > 3) {
    lessons.push(`- [${timestamp}] **${deck}**: ${problemSlides.length} slides with 3+ issues each. ` +
      `Systematic design problems — review zone sizing, contrast, and image placement across the deck.`);
  }

  if (lessons.length === 0) {
    lessons.push(`- [${timestamp}] **${deck}**: All computed dimensions scored >= 8. No new lessons.`);
  }

  // Append to lessons file
  if (fs.existsSync(lessonsPath)) {
    let existing = fs.readFileSync(lessonsPath, "utf-8");
    // Add evaluation log section if not present
    if (!existing.includes("## Evaluation Log")) {
      existing += "\n\n## Evaluation Log\n\nAutomatically appended by `rubric-headless.js` after each evaluation.\n";
    }
    existing += "\n" + lessons.join("\n") + "\n";
    fs.writeFileSync(lessonsPath, existing);
  } else {
    const header = `# Design Lessons\n\nAccumulated from evaluation feedback loops.\n\n## Evaluation Log\n\n`;
    fs.writeFileSync(lessonsPath, header + lessons.join("\n") + "\n");
  }

  return lessons;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.includes("--help")) {
    console.log(`
  rubric-headless — evaluate and refine slide decks autonomously

  Usage:
    node rubric-headless.js <deck.html>                      Evaluate only
    node rubric-headless.js <deck.html> --refine              Evaluate + refine loop
    node rubric-headless.js <deck.html> --refine --max 5      Max iterations
    node rubric-headless.js <deck.html> --target 8            Target per-dimension score
    node rubric-headless.js <deck.html> --screenshots         Save sample screenshots
    node rubric-headless.js <deck.html> --json                Output JSON scorecard
    `);
    process.exit(0);
  }

  const htmlPath = args[0];
  const doRefine = args.includes("--refine");
  const maxIter = args.includes("--max") ? parseInt(args[args.indexOf("--max")+1]) : 5;
  const target = args.includes("--target") ? parseInt(args[args.indexOf("--target")+1]) : 7;
  const doScreenshots = args.includes("--screenshots");
  const jsonOutput = args.includes("--json");

  // Strip .spliced or .merged suffixes to find the composed markdown
  const basePath = htmlPath.replace(/\.(spliced|merged)\.html$/, ".html");
  const composedPath = basePath.replace(/\.html$/, ".composed.md");
  const hasComposed = fs.existsSync(composedPath);

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("rubric-headless")}\n`);
  process.stderr.write(`  ${dim("Deck:")} ${teal(htmlPath)}\n`);

  // Check content fidelity (source vs composed) if composed markdown exists
  let fidelity = null;
  if (hasComposed) {
    fidelity = checkContentFidelity(composedPath);
    if (fidelity && fidelity.issues.length > 0) {
      process.stderr.write(`  ${accent("⚠ Content fidelity:")}\n`);
      fidelity.issues.forEach(issue => {
        process.stderr.write(`    ${accent("✖")} ${issue}\n`);
      });
    }
  }

  const scoreHistory = [];
  const result = await evaluate(htmlPath, { screenshots: doScreenshots });
  // Inject fidelity data into metrics
  if (fidelity) {
    result.metrics.inventedLabels = fidelity.inventedLabels;
    // Penalize content completeness for invented content
    if (fidelity.inventedLabels > 0) {
      result.scores.contentCompleteness = Math.max(1, result.scores.contentCompleteness - fidelity.inventedLabels * 0.3);
      result.scores.contentCompleteness = Math.round(result.scores.contentCompleteness * 10) / 10;
      // Recompute total
      const computedDims = Object.entries(result.scores).filter(([, v]) => v !== null);
      result.computedTotal = Math.round(computedDims.reduce((a, [, v]) => a + v, 0) * 10) / 10;
    }
  }
  scoreHistory.push({ iteration: 0, ...result });

  function printScores(r, label) {
    process.stderr.write(`\n  ${dim("── " + label + " ──")}\n`);
    const dims = [
      ["Accessibility", r.scores.accessibility],
      ["Communicability", r.scores.communicability],
      ["Taste", r.scores.taste],
      ["Grid", r.scores.grid],
      ["Color", r.scores.color],
      ["Balance", r.scores.balance],
      ["Coherence", r.scores.coherence],
      ["Images", r.scores.images],
      ["Content", r.scores.contentCompleteness],
    ];
    dims.forEach(([n, s]) => {
      if (s === null || s === undefined) {
        process.stderr.write(`  ${dim("○")} ${dim(n.padEnd(16))} ${dim("  —  visual only")}\n`);
      } else {
        const icon = s >= target ? sage("●") : s >= target-2 ? amber("●") : accent("●");
        process.stderr.write(`  ${icon} ${n.padEnd(16)} ${String(s).padStart(4)}\n`);
      }
    });
    const pct = Math.round(r.computedTotal / r.maxComputed * 100);
    process.stderr.write(`  ${dim("Computed:")} ${chalk.white.bold(r.computedTotal + "/" + r.maxComputed)} ${dim("(" + pct + "%)")}\n`);
    // Detail warnings
    const mt = r.metrics;
    if (mt.tinyTextCount > 0) process.stderr.write(`  ${amber("⚠")} ${mt.tinyTextCount} text elements below 12px\n`);
    if (mt.textOnImageCount > 0) process.stderr.write(`  ${accent("✖")} ${mt.textOnImageCount} text-on-image overlaps\n`);
    if (mt.tableTruncations > 0) process.stderr.write(`  ${accent("✖")} ${mt.tableTruncations} table truncations\n`);
    if (mt.clippedContentSlides > 0) process.stderr.write(`  ${amber("⚠")} ${mt.clippedContentSlides} slides with clipped content\n`);
    if (mt.emptyBodyZones > 0) process.stderr.write(`  ${amber("⚠")} ${mt.emptyBodyZones} empty body zones\n`);
    if (mt.contentlessSlides > 0) process.stderr.write(`  ${accent("✖")} ${mt.contentlessSlides} contentless slides\n`);
    if (mt.slidesWithNoVisibleText > 0) process.stderr.write(`  ${amber("⚠")} ${mt.slidesWithNoVisibleText} slides with no visible text\n`);
    // Per-slide issue summary (show slides with 2+ issues)
    const issueSlides = (mt.perSlideIssues || [])
      .map((issues, i) => [i + 1, issues])
      .filter(([, issues]) => issues.length >= 2);
    if (issueSlides.length > 0) {
      process.stderr.write(`  ${dim("Problem slides:")}\n`);
      issueSlides.slice(0, 8).forEach(([n, issues]) => {
        process.stderr.write(`    ${dim("S" + n + ":")} ${issues.slice(0, 4).join(", ")}${issues.length > 4 ? ` +${issues.length - 4} more` : ""}\n`);
      });
      if (issueSlides.length > 8) process.stderr.write(`    ${dim("...and " + (issueSlides.length - 8) + " more")}\n`);
    }
  }

  printScores(result, "Baseline");

  if (doRefine && hasComposed) {
    for (let iter = 1; iter <= maxIter; iter++) {
      const prev = scoreHistory[scoreHistory.length - 1];
      if (Object.values(prev.scores).every(s => s >= target)) {
        process.stderr.write(`\n  ${sage("✓")} All dims >= ${target}. Done.\n`);
        break;
      }

      process.stderr.write(`\n  ${amber("⟐")} Iteration ${iter}\n`);
      const changes = applyFixes(composedPath, prev.scores, prev.metrics);
      if (!changes.length) { process.stderr.write(`  ${dim("No fixes. Done.")}\n`); break; }
      changes.forEach(c => process.stderr.write(`    ${dim("→")} ${c}\n`));

      process.stderr.write(`  ${dim("Rendering...")}\n`);
      await generateHTML(composedPath, htmlPath, { theme: "light" });

      const nr = await evaluate(htmlPath);
      scoreHistory.push({ iteration: iter, ...nr });
      printScores(nr, `Iteration ${iter}`);

      const delta = nr.computedTotal - prev.computedTotal;
      if (delta < 1) { process.stderr.write(`  ${amber("⚠")} Diminishing returns (Δ${delta.toFixed(1)}). Done.\n`); break; }
    }
  }

  if (scoreHistory.length > 1) {
    const f = scoreHistory[0], l = scoreHistory[scoreHistory.length-1];
    const maxC = l.maxComputed;
    process.stderr.write(`\n  ${dim("Score:")} ${f.computedTotal}/${maxC} → ${chalk.white.bold(l.computedTotal+"/"+maxC)} (${sage("+"+(l.computedTotal-f.computedTotal).toFixed(1))})\n`);
  }

  const logDir = path.join(path.dirname(htmlPath), "..", "logs", "qa");
  fs.mkdirSync(logDir, { recursive: true });
  const scorecardPath = path.join(logDir, path.basename(htmlPath, ".html") + "-scorecard.json");
  fs.writeFileSync(scorecardPath, JSON.stringify(scoreHistory, null, 2));
  process.stderr.write(`  ${dim("Scorecard:")} ${teal(scorecardPath)}\n`);

  // Extract lessons and feed back to design-lessons.md
  const finalResult = scoreHistory[scoreHistory.length - 1];
  const lessons = extractLessons(finalResult.metrics, finalResult.scores, htmlPath);
  if (lessons.length > 0) {
    const lessonsPath = path.join(path.dirname(htmlPath), "..", "design-lessons.md");
    process.stderr.write(`  ${dim("Lessons:")} ${teal(lessonsPath)} (${lessons.length} new)\n`);
  }
  process.stderr.write("\n");

  if (jsonOutput) console.log(JSON.stringify(scoreHistory, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
module.exports = { evaluate };
