---
name: qa-visual
description: Run a visual accessibility and design consistency audit on an HTML slideshow using Claude in Chrome. Checks contrast, overflow, fonts, image collisions, and typographic stability.
---

# Visual QA Audit

Open an HTML slide deck in Chrome and run a comprehensive accessibility + design consistency audit.

## Arguments

`/qa-visual decks/week-1.html`
If no argument, ask which HTML file to audit. Check `decks/*.html` for options.

## Prerequisites

The deck must be servable via `npm run serve` (port 8701) or `node server.js` (port 8800).

## Steps

### 1. Connect to Chrome

Use `mcp__claude-in-chrome__tabs_context_mcp` to get available tabs.
Reuse an existing tab if the deck is already open, otherwise create a new one.
Navigate to `http://localhost:8701/<deck-path>`.

If connection fails, tell the user to open Chrome, click the extension icon, and run `npm run serve`.

### 2. Take an initial screenshot

Screenshot slide 1 to verify the deck loaded. Show it to the user.

### 3. Run the accessibility audit

Execute this JavaScript via `mcp__claude-in-chrome__javascript_tool`:

```javascript
(function() {
  const slides = document.querySelectorAll('.slide, .grid-slide');
  const total = slides.length;
  function parseRGB(str) {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
  }
  function lum(c) {
    const [r, g, b] = [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function cr(fg, bg) {
    const l1 = lum(fg), l2 = lum(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  const results = [];
  let errorCount = 0, warnCount = 0;
  slides.forEach((slide, idx) => {
    const wasDisplay = slide.style.display;
    const wasActive = slide.classList.contains('active');
    slide.style.display = 'flex';
    const cs = getComputedStyle(slide);
    const bg = parseRGB(cs.backgroundColor) || { r: 248, g: 245, b: 240 };
    const issues = [];
    // Contrast
    slide.querySelectorAll('h1,h2,h3,p,li,span,blockquote,.label,.bullet,.stagger-bar,.frag-cell,.pill,td,th,code').forEach(el => {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return;
      const text = el.textContent.trim();
      if (!text) return;
      const fg = parseRGB(st.color);
      let elBg = parseRGB(st.backgroundColor);
      if (!elBg || (elBg.r === 0 && elBg.g === 0 && elBg.b === 0 && st.backgroundColor.includes('0)'))) elBg = bg;
      if (fg && elBg) {
        const ratio = cr(fg, elBg);
        const size = parseFloat(st.fontSize);
        const bold = parseInt(st.fontWeight) >= 700;
        const large = size >= 18 || (size >= 14 && bold);
        const min = large ? 3.0 : 4.5;
        if (ratio < min) {
          const sev = ratio < 2 ? 'ERR' : 'WARN';
          if (sev === 'ERR') errorCount++; else warnCount++;
          issues.push(sev + ':' + ratio.toFixed(1) + '/' + min + ' "' + text.slice(0, 30) + '"');
        }
      }
    });
    // Broken images
    slide.querySelectorAll('img').forEach(img => {
      if (!img.complete || img.naturalWidth === 0) { issues.push('IMG:broken'); errorCount++; }
    });
    // Overflow
    let overflows = 0;
    slide.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (st.display === 'none' || r.width === 0) return;
      const tag = el.tagName.toLowerCase();
      if (['script','style','link','meta'].includes(tag)) return;
      if (r.right > window.innerWidth + 10 || r.bottom > window.innerHeight + 10) { overflows++; warnCount++; }
    });
    if (overflows > 0) issues.push('OVF:' + overflows);
    // Empty
    const visText = slide.textContent.trim().replace(/\\s+/g, ' ');
    const hasImgs = slide.querySelectorAll('img').length > 0;
    if (visText.length < 5 && !hasImgs && !slide.classList.contains('layout-blank')) {
      issues.push('EMPTY'); warnCount++;
    }
    if (!wasActive) slide.style.display = wasDisplay || 'none';
    if (issues.length > 0) results.push('S' + (idx+1) + ': ' + issues.join(' | '));
  });
  // Font loading
  const fontIssues = [];
  if (document.fonts && document.fonts.status === 'loaded') {
    ['DM Serif Display', 'Space Mono', 'DM Sans'].forEach(font => {
      if (!document.fonts.check('16px "' + font + '"')) fontIssues.push(font);
    });
  }
  return 'A11Y: ' + total + ' slides | ' + (total - results.length) + ' pass | ' + errorCount + ' errors | ' + warnCount + ' warnings | Fonts: ' + (fontIssues.length ? fontIssues.join(', ') : 'OK') + '\\n' + results.join('\\n');
})()
```

### 4. Run the design consistency audit

Execute a second script to check font sizes, weight consistency, and image collisions:

```javascript
(function() {
  const slides = document.querySelectorAll('.slide, .grid-slide');
  const problems = [];
  const titleSizes = [], bodySizes = [], bulletSizes = [];
  slides.forEach((slide, idx) => {
    const wasDisplay = slide.style.display;
    slide.style.display = 'flex';
    const issues = [];
    // Title sizes
    slide.querySelectorAll('h1,h2').forEach(el => {
      const st = getComputedStyle(el);
      if (st.display === 'none') return;
      const size = parseFloat(st.fontSize);
      titleSizes.push(size);
      if (size < 32 || size > 56) issues.push('title:' + Math.round(size) + 'px');
    });
    // Body sizes
    slide.querySelectorAll('p').forEach(el => {
      const st = getComputedStyle(el);
      if (st.display === 'none') return;
      const text = el.textContent.trim();
      if (!text || text.length < 5) return;
      const size = parseFloat(st.fontSize);
      bodySizes.push(size);
      if (size < 11 || size > 18) issues.push('body:' + Math.round(size) + 'px');
    });
    // Bullet sizes
    slide.querySelectorAll('.bullet span:not(.dot):not(.dash)').forEach(el => {
      const st = getComputedStyle(el);
      if (st.display === 'none') return;
      const size = parseFloat(st.fontSize);
      bulletSizes.push(size);
      if (size < 11.5) issues.push('bullet:' + size.toFixed(1) + 'px');
    });
    // Image-text collision: check if image overlaps text zones
    const imgs = slide.querySelectorAll('div[style*="position:absolute"] img');
    imgs.forEach(img => {
      const imgDiv = img.parentElement;
      const ir = imgDiv.getBoundingClientRect();
      if (ir.width === 0) return;
      slide.querySelectorAll('h1,h2,p,.bullet').forEach(el => {
        const st = getComputedStyle(el);
        if (st.display === 'none') return;
        const tr = el.getBoundingClientRect();
        if (tr.width === 0 || tr.height === 0) return;
        // Check if text rect overlaps image rect
        if (tr.left < ir.right && tr.right > ir.left && tr.top < ir.bottom && tr.bottom > ir.top) {
          const imgOpacity = parseFloat(imgDiv.style.opacity || '1');
          if (imgOpacity > 0.15) {
            issues.push('IMG-COLLISION:opacity=' + imgOpacity.toFixed(2));
          }
        }
      });
    });
    slide.style.display = wasDisplay || 'none';
    if (issues.length > 0) problems.push('S' + (idx+1) + ': ' + issues.join(' | '));
  });
  const unique = arr => [...new Set(arr.map(v => Math.round(v)))].sort((a,b) => a-b);
  return 'DESIGN: titles=' + unique(titleSizes).join(',') + 'px | body=' + unique(bodySizes).join(',') + 'px | bullets=' + unique(bulletSizes).join(',') + 'px\\n' + (problems.length ? problems.join('\\n') : 'All slides consistent');
})()
```

### 5. Screenshot problem slides

For slides with **errors** or **design issues**, navigate to them and screenshot (up to 5):

```javascript
const slides = document.querySelectorAll('.slide, .grid-slide');
slides.forEach((s, i) => {
  s.classList.toggle('active', i === N);
  s.style.display = i === N ? 'flex' : 'none';
});
```

### 6. Report findings

Present a combined summary:

```
Visual QA Audit: decks/week-1k.html
────────────────────────────────────
A11Y:  40 slides — 35 pass | 0 errors | 8 warnings
DESIGN: titles=36,40,42,44,48,52px | body=12,14px | bullets=13,14px

Accessibility issues:
  S8: overflow (4 elements — content too dense)
  S15: overflow (1 element)

Design issues:
  S7: bullet text too small (11.2px)
  S21: body text too large (28px)
  S14: image-text collision (opacity=0.35)
```

### 7. Root cause analysis

Group issues by cause:
- **Theme-level** (CSS/raster.js) — affects all slides
- **Slide-level** (composed markdown) — affects specific slides
- **Image-level** (splice-images) — image placement collisions

### 8. Recommend fixes

Suggest concrete fixes for each issue. Offer to:
- Run `/qa-fix-loop` to apply fixes automatically
- Run `/edit-slide` for specific slide fixes
- Re-splice images with adjusted collision settings
