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

    function parseRGB(str) { const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? { r: +m[1], g: +m[2], b: +m[3] } : null; }
    function lum(c) { const [r,g,b] = [c.r,c.g,c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126*r + 0.7152*g + 0.0722*b; }
    function cr(a,b) { const l1=lum(a),l2=lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); }
    function hexRGB(c) { return "#" + [c.r,c.g,c.b].map(v => v.toString(16).padStart(2,"0")).join(""); }
    function dist(a,b) { return Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2); }

    let contrastErrors=0, contrastWarnings=0, overflows=0, brokenImgs=0;
    let titles=0, designed=0, totalImgs=0, imgOverlaps=0;
    const bgs=[], titleSizes=new Set(), zoneStarts=new Set(), zoneWidths=new Set();
    const fonts=new Set(), imgPlacements=new Set();
    let slidesWithAccents=0;

    slides.forEach((slide, idx) => {
      slide.style.display = "flex";
      const cs = getComputedStyle(slide);
      const bg = parseRGB(cs.backgroundColor) || {r:250,g:246,b:238};
      bgs.push(bg);
      if (slide.querySelector("h1,h2")) titles++;
      if (slide.classList.contains("designed")) designed++;

      slide.querySelectorAll("h1,h2,h3,p,li,span,blockquote,.label,.bullet,td,th,code").forEach(el => {
        const st = getComputedStyle(el);
        if (st.display==="none"||st.visibility==="hidden"||st.opacity==="0") return;
        if (!el.textContent.trim()) return;
        const fg=parseRGB(st.color); let elBg=parseRGB(st.backgroundColor);
        if (!elBg||(elBg.r===0&&elBg.g===0&&elBg.b===0&&st.backgroundColor.includes("0)"))) elBg=bg;
        if (fg&&elBg) { const r=cr(fg,elBg); const sz=parseFloat(st.fontSize); const bold=parseInt(st.fontWeight)>=700; const lg=sz>=18||(sz>=14&&bold); if (r<(lg?3:4.5)) { if (r<2) contrastErrors++; else contrastWarnings++; } }
      });

      slide.querySelectorAll("*").forEach(el => {
        const r=el.getBoundingClientRect(); const st=getComputedStyle(el);
        if (st.display==="none"||r.width===0) return;
        if (["script","style","link","meta"].includes(el.tagName.toLowerCase())) return;
        if (r.right>window.innerWidth+10||r.bottom>window.innerHeight+10) overflows++;
      });

      // Note: lazy-loaded images on display:none slides won't be complete — only count visible slide's images as broken
      if (idx === 0) slide.querySelectorAll("img").forEach(img => { if (!img.complete||img.naturalWidth===0) brokenImgs++; });
      slide.querySelectorAll(".zone").forEach(z => { zoneStarts.add(Math.round(parseFloat(z.style.left)||0)); zoneWidths.add(Math.round(parseFloat(z.style.width)||0)); });
      slide.querySelectorAll("h1,h2").forEach(el => { if (getComputedStyle(el).display!=="none") titleSizes.add(Math.round(parseFloat(getComputedStyle(el).fontSize))); });
      slide.querySelectorAll("h1,h2,p,.bullet,.label").forEach(el => { const f=getComputedStyle(el).fontFamily.split(",")[0].replace(/['"]/g,"").trim(); if (f) fonts.add(f); });
      if (slide.querySelectorAll(".accent,[class*=accent]").length) slidesWithAccents++;

      const imgs=slide.querySelectorAll("img"); totalImgs+=imgs.length;
      imgs.forEach(img => {
        const ir=img.getBoundingClientRect(); if (ir.width===0) return;
        const cx=ir.left+ir.width/2, cy=ir.top+ir.height/2;
        imgPlacements.add(cx>window.innerWidth*0.65?"right":cx<window.innerWidth*0.35?"left":cy<window.innerHeight*0.35?"top":cy>window.innerHeight*0.65?"bottom":"centre");
        slide.querySelectorAll("h1,h2,p,.bullet").forEach(el => { const tr=el.getBoundingClientRect(); if (tr.width===0) return; if (tr.left<ir.right&&tr.right>ir.left&&tr.top<ir.bottom&&tr.bottom>ir.top) { const d=img.closest("div[style]"); if (d&&parseFloat(d.style.opacity||"1")>0.15) imgOverlaps++; } });
      });
      if (idx>0) slide.style.display="none";
    });

    let maxConsec=1, run=1;
    for (let i=1;i<bgs.length;i++) { if (hexRGB(bgs[i])===hexRGB(bgs[i-1])) { run++; maxConsec=Math.max(maxConsec,run); } else run=1; }
    const uniqueBgs=new Set(bgs.map(hexRGB));
    const hasArc=bgs.length>1 && [...new Set(bgs.map(b=>lum(b)>0.5?"L":"D"))].length>1;

    return { total, titles, designed, contrastErrors, contrastWarnings, overflows, brokenImgs,
      uniqueBgs:uniqueBgs.size, bgPalette:[...uniqueBgs], maxConsecBg:maxConsec, hasArc,
      zoneStarts:zoneStarts.size, zoneWidths:zoneWidths.size, titleSizes:[...titleSizes], fontSets:fonts.size,
      slidesWithAccents, totalImgs, imgOverlaps, imgPlacements:[...imgPlacements] };
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

  // ── Score ──
  const scores = {};
  scores.accessibility = Math.max(1, Math.min(10, 10 - metrics.contrastErrors*2 - metrics.contrastWarnings*0.3 - Math.min(metrics.overflows*0.1,2) - metrics.brokenImgs*2));
  scores.grid = Math.max(1, Math.min(10, (metrics.designed/metrics.total)*4 + Math.min(metrics.zoneStarts/4,1.5)*2 + Math.min(metrics.zoneWidths/3,1.5)*2 + (metrics.designed>0?2:0)));
  scores.color = Math.max(1, Math.min(10, Math.min(metrics.uniqueBgs/3,2)*2 + (metrics.hasArc?3:1) + (metrics.maxConsecBg<=3?3:metrics.maxConsecBg<=5?2:1) + (metrics.contrastErrors===0?2:0)));
  scores.coherence = Math.max(1, Math.min(10, (metrics.titleSizes.length>=2&&metrics.titleSizes.length<=6?3:1) + (metrics.fontSets>=2?2:1) + (metrics.uniqueBgs>=3?2:1) + (metrics.maxConsecBg<=3?2:0) + (metrics.designed>metrics.total*0.5?1:0)));
  scores.images = metrics.totalImgs===0 ? 5 : Math.max(1, Math.min(10, (metrics.imgOverlaps===0?4:Math.max(1,4-metrics.imgOverlaps)) + Math.min(metrics.imgPlacements.length/3,1)*3 + (metrics.totalImgs>metrics.total*0.3?2:1) + 1));
  for (const k of Object.keys(scores)) scores[k] = Math.round(scores[k]*10)/10;
  const computedTotal = Math.round(Object.values(scores).reduce((a,b)=>a+b,0)*10)/10;

  return { metrics, scores, computedTotal, maxComputed: 50 };
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

  // Fix 4: Reduce overflow by expanding body zones
  if (metrics.overflows > 20) {
    parts.forEach((p, i) => {
      // Expand body rowSpan if it's small
      const bodyZone = p.match(/"role":"body","col":(\d+),"span":(\d+),"row":(\d+),"rowSpan":(\d+)/);
      if (bodyZone && parseInt(bodyZone[4]) < 14) {
        const newSpan = Math.min(parseInt(bodyZone[4]) + 4, 18);
        parts[i] = p.replace(/"role":"body","col":(\d+),"span":(\d+),"row":(\d+),"rowSpan":(\d+)/,
          `"role":"body","col":$1,"span":$2,"row":$3,"rowSpan":${newSpan}`);
        changes.push(`S${i+1}: body rowSpan → ${newSpan}`);
      }
      // Reduce large title sizes to prevent overflow
      const titleTypo = p.match(/"title":\{([^}]*?)"size":(\d+)/);
      if (titleTypo && parseInt(titleTypo[2]) > 48) {
        parts[i] = p.replace(/"title":\{([^}]*?)"size":\d+/, `"title":{$1"size":44`);
        changes.push(`S${i+1}: title size → 44`);
      }
    });
  }

  // Fix 5: Darken label accent colors
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

  const composedPath = htmlPath.replace(/\.html$/, ".composed.md");
  const hasComposed = fs.existsSync(composedPath);

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("rubric-headless")}\n`);
  process.stderr.write(`  ${dim("Deck:")} ${teal(htmlPath)}\n`);

  const scoreHistory = [];
  const result = await evaluate(htmlPath, { screenshots: doScreenshots });
  scoreHistory.push({ iteration: 0, ...result });

  function printScores(r, label) {
    process.stderr.write(`\n  ${dim("── " + label + " ──")}\n`);
    [["Accessibility", r.scores.accessibility], ["Grid", r.scores.grid], ["Color", r.scores.color],
     ["Coherence", r.scores.coherence], ["Images", r.scores.images]].forEach(([n, s]) => {
      const icon = s >= target ? sage("●") : s >= target-2 ? amber("●") : accent("●");
      process.stderr.write(`  ${icon} ${n.padEnd(16)} ${String(s).padStart(4)}\n`);
    });
    process.stderr.write(`  ${dim("Total:")} ${chalk.white.bold(r.computedTotal + "/50")} ${dim("(" + Math.round(r.computedTotal/50*100) + "%)")}\n`);
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
    process.stderr.write(`\n  ${dim("Score:")} ${f.computedTotal}/50 → ${chalk.white.bold(l.computedTotal+"/50")} (${sage("+"+(l.computedTotal-f.computedTotal).toFixed(1))})\n`);
  }

  const logDir = path.join(path.dirname(htmlPath), "..", "logs", "qa");
  fs.mkdirSync(logDir, { recursive: true });
  const scorecardPath = path.join(logDir, path.basename(htmlPath, ".html") + "-scorecard.json");
  fs.writeFileSync(scorecardPath, JSON.stringify(scoreHistory, null, 2));
  process.stderr.write(`  ${dim("Scorecard:")} ${teal(scorecardPath)}\n\n`);

  if (jsonOutput) console.log(JSON.stringify(scoreHistory, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
module.exports = { evaluate };
