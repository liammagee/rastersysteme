#!/usr/bin/env node
/**
 * visual-audit.js — Puppeteer-based visual flaw detector
 *
 * Checks each slide for rendering flaws the headless rubric misses:
 * 1. Broken images (naturalWidth === 0)
 * 2. Content overflowing zone boundaries (scrollHeight > clientHeight)
 * 3. Zone-zone bounding box collisions (excluding renderer fallbacks)
 * 4. Text-image collisions (excluding same-cell table content)
 * 5. Tiny text (< 12px computed)
 * 6. Elements extending beyond slide boundaries
 * 7. Table row visual overlaps
 *
 * Severity: critical | warning | info
 *
 * Usage:
 *   node visual-audit.js <deck.html>
 *   node visual-audit.js <deck.html> --severity critical,warning
 *   node visual-audit.js <deck.html> --json
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('--'));
const deckPath = path.resolve(input || 'decks/week-2-v7.html');
const jsonMode = args.includes('--json');
const severityFlag = args.find(a => a.startsWith('--severity'));
const showSeverities = severityFlag
  ? severityFlag.split('=')[1]?.split(',') || ['critical', 'warning']
  : ['critical', 'warning'];

function classifySeverity(issue) {
  // Critical: broken images, large overflows, real zone-zone collisions
  if (issue.type === 'broken-image') return 'critical';
  if (issue.type === 'clipped-overflow') return 'info'; // visually hidden, not a rendering bug
  if (issue.type === 'overflow') {
    const px = parseInt(issue.detail.match(/(\d+)px/)?.[1] || '0');
    return px > 100 ? 'critical' : px > 20 ? 'warning' : 'info';
  }
  if (issue.type === 'zone-collision') {
    // zone-extras collisions are renderer fallback, not real overlaps
    if (issue.detail.includes('zone-extras') || issue.detail.includes('zone-title')) return 'info';
    return 'critical';
  }
  // Warning: text-image collisions (unless inside same table cell)
  if (issue.type === 'text-image-collision') {
    if (issue.sameCell) return 'info'; // table cell contains both text and image = expected
    return 'warning';
  }
  if (issue.type === 'tiny-text') return 'warning';
  if (issue.type === 'out-of-bounds') return 'info'; // accent overflow is cosmetic
  if (issue.type === 'table-row-overlap') return 'warning';
  return 'info';
}

if (require.main === module) (async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1920,1080'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('file://' + deckPath, { waitUntil: 'networkidle0', timeout: 30000 });

  const slideCount = await page.evaluate(() =>
    document.querySelectorAll('.slide, .grid-slide').length
  );

  const allIssues = [];

  for (let idx = 0; idx < slideCount; idx++) {
    await page.evaluate((i) => {
      const slides = document.querySelectorAll('.slide, .grid-slide');
      slides.forEach((s, j) => {
        s.classList.toggle('active', j === i);
        s.style.display = j === i ? 'flex' : 'none';
      });
    }, idx);
    await new Promise(r => setTimeout(r, 150));

    const slideIssues = await page.evaluate((slideIdx) => {
      const slide = document.querySelectorAll('.slide, .grid-slide')[slideIdx];
      if (!slide) return [];
      const problems = [];

      // 1. Broken images
      slide.querySelectorAll('img').forEach(img => {
        if (img.naturalWidth === 0 || img.complete === false) {
          problems.push({ type: 'broken-image', detail: img.src.split('/').pop() });
        }
      });

      // 2. Content overflow (distinguish visible vs clipped)
      slide.querySelectorAll('[class*="zone-"]').forEach(zone => {
        if (zone.scrollHeight > zone.clientHeight + 5) {
          const overflow = zone.scrollHeight - zone.clientHeight;
          const cls = zone.className.match(/zone-\w+/)?.[0] || 'zone';
          const style = getComputedStyle(zone).overflow;
          const clipped = style === 'hidden' || style === 'clip';
          problems.push({
            type: clipped ? 'clipped-overflow' : 'overflow',
            detail: `${cls}: ${overflow}px ${clipped ? 'clipped' : 'visible'} overflow`
          });
        }
      });

      // 3. Zone-zone collisions (skip zone-extras which is a renderer fallback)
      const zones = [...slide.querySelectorAll('[class*="zone-"]')];
      for (let a = 0; a < zones.length; a++) {
        for (let b = a + 1; b < zones.length; b++) {
          const ra = zones[a].getBoundingClientRect();
          const rb = zones[b].getBoundingClientRect();
          const overlapX = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
          const overlapY = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
          if (overlapX > 5 && overlapY > 5) {
            const clsA = zones[a].className.match(/zone-\w+/)?.[0] || 'zone';
            const clsB = zones[b].className.match(/zone-\w+/)?.[0] || 'zone';
            problems.push({
              type: 'zone-collision',
              detail: `${clsA} overlaps ${clsB} by ${overlapX.toFixed(0)}x${overlapY.toFixed(0)}px`
            });
          }
        }
      }

      // 4. Text-image collisions (check if they share a parent cell)
      const textEls = [...slide.querySelectorAll('h1,h2,h3,p,.bullet,.label,li,blockquote,a')];
      const imgEls = [...slide.querySelectorAll('img')];
      for (const txt of textEls) {
        const tr = txt.getBoundingClientRect();
        if (tr.width === 0 || tr.height === 0) continue;
        for (const img of imgEls) {
          const ir = img.getBoundingClientRect();
          if (ir.width === 0 || ir.height === 0) continue;
          const overlapX = Math.max(0, Math.min(tr.right, ir.right) - Math.max(tr.left, ir.left));
          const overlapY = Math.max(0, Math.min(tr.bottom, ir.bottom) - Math.max(tr.top, ir.top));
          if (overlapX > 10 && overlapY > 10) {
            // Check if text and image share a common table cell (<td>)
            const txtCell = txt.closest('td');
            const imgCell = img.closest('td');
            const sameCell = (txtCell && imgCell && txtCell === imgCell) ||
                             (txt.closest('table') && img.closest('table') &&
                              txt.closest('table') === img.closest('table'));
            const textPreview = txt.textContent.trim().substring(0, 40);
            problems.push({
              type: 'text-image-collision',
              sameCell,
              detail: `"${textPreview}..." over ${img.src.split('/').pop()}`
            });
          }
        }
      }

      // 5. Tiny text
      textEls.forEach(el => {
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size > 0 && size < 12 && el.textContent.trim().length > 5) {
          problems.push({
            type: 'tiny-text',
            detail: `${size.toFixed(1)}px: "${el.textContent.trim().substring(0, 30)}..."`
          });
        }
      });

      // 6. Out of bounds
      const slideRect = slide.getBoundingClientRect();
      [...slide.querySelectorAll('[class*="zone-"], .accent-el')].forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > slideRect.right + 5 || r.bottom > slideRect.bottom + 5) {
          const cls = el.className.match(/zone-\w+|accent-\w+/)?.[0] || 'element';
          problems.push({ type: 'out-of-bounds', detail: `${cls} extends beyond slide edge` });
        }
      });

      // 7. Table row overlaps
      slide.querySelectorAll('table').forEach(table => {
        const rows = [...table.querySelectorAll('tr')];
        for (let r = 0; r < rows.length - 1; r++) {
          const ra = rows[r].getBoundingClientRect();
          const rb = rows[r + 1].getBoundingClientRect();
          if (rb.top < ra.bottom - 2) {
            problems.push({
              type: 'table-row-overlap',
              detail: `rows ${r+1}/${r+2} overlap by ${(ra.bottom - rb.top).toFixed(0)}px`
            });
          }
        }
      });

      return problems;
    }, idx);

    if (slideIssues.length > 0) {
      allIssues.push({ slide: idx + 1, issues: slideIssues });
    }
  }

  await browser.close();

  // Classify severity
  for (const s of allIssues) {
    for (const issue of s.issues) {
      issue.severity = classifySeverity(issue);
    }
  }

  // Filter by requested severity
  const filtered = allIssues.map(s => ({
    slide: s.slide,
    issues: s.issues.filter(i => showSeverities.includes(i.severity))
  })).filter(s => s.issues.length > 0);

  // Summary counts
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const s of allIssues) {
    for (const i of s.issues) counts[i.severity]++;
  }

  // Report
  const dim = chalk.dim;
  const red = chalk.red;
  const yellow = chalk.yellow;
  const green = chalk.green;

  process.stderr.write(`\n  ${red('■')} ${chalk.bold('visual-audit')}\n`);
  process.stderr.write(`  ${dim('Deck:')} ${chalk.cyan(path.basename(deckPath))}\n`);
  process.stderr.write(`  ${dim('Slides:')} ${slideCount}\n`);
  process.stderr.write(`  ${dim('Issues:')} ${red(counts.critical + ' critical')} ${yellow(counts.warning + ' warning')} ${dim(counts.info + ' info')}\n\n`);

  if (filtered.length === 0) {
    process.stderr.write(`  ${green('✓')} No ${showSeverities.join('/')} issues found.\n`);
  } else {
    for (const s of filtered) {
      process.stderr.write(`  Slide ${s.slide}:\n`);
      for (const issue of s.issues) {
        const color = issue.severity === 'critical' ? red : issue.severity === 'warning' ? yellow : dim;
        const icon = issue.severity === 'critical' ? '✖' : issue.severity === 'warning' ? '⚠' : '·';
        process.stderr.write(`    ${color(icon)} [${issue.type}] ${issue.detail}\n`);
      }
    }
  }

  // JSON output
  const result = { slideCount, counts, issues: allIssues };
  const jsonPath = deckPath.replace(/\.html$/, '.visual-audit.json');
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  process.stderr.write(`\n  ${dim('JSON:')} ${chalk.cyan(path.relative(process.cwd(), jsonPath))}\n`);

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  }
})();

module.exports = { classifySeverity };
