---
name: qa-visual
description: Run a visual accessibility audit on an HTML slideshow using Claude in Chrome. Screenshots each slide, checks contrast ratios, overflow, broken images, empty slides, and font loading.
user_invocable: true
---

# Visual QA Audit

Open an HTML slide deck in Chrome and run a comprehensive a11y audit using browser automation.

## Arguments

The user provides a path: `/qa-visual decks/week-1.html`
If no argument, ask which HTML file to audit. Check `decks/*.html` for options.

## Prerequisites

The deck must be servable. Either:
- `npm run serve` (python static server on port 8701), OR
- `node server.js` (dashboard on port 8800)

Both serve files from the project root, so `http://localhost:PORT/decks/foo.html` works.

## Steps

### 1. Resolve the URL

Given a file path like `decks/week-1.html`, construct the URL.
Try port 8701 first (simpler server). If the user says it's not running, try 8800.

```
http://localhost:8701/decks/week-1.html
```

### 2. Connect to Chrome

Use `mcp__claude-in-chrome__tabs_context_mcp` to get available tabs.

If the slideshow URL is already open in a tab, reuse it.
Otherwise, create a new tab with `mcp__claude-in-chrome__tabs_create_mcp`.

Then navigate to the URL with `mcp__claude-in-chrome__navigate`.

If connection fails, tell the user:
- Open Chrome (not Arc/Brave)
- Click the Claude in Chrome extension icon to connect
- Run `npm run serve` if local server isn't running

### 3. Take an initial screenshot

Use `mcp__claude-in-chrome__computer` with `action: "screenshot"` to verify the deck loaded.
Show it to the user so they can confirm it looks right.

### 4. Run the full audit

Execute this JavaScript via `mcp__claude-in-chrome__javascript_tool`. This is the **canonical audit script** — qa-fix-loop also references it.

```javascript
(function auditAllSlides() {
  const slides = document.querySelectorAll('.slide, .grid-slide');
  const total = slides.length;

  function parseRGB(str) {
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
  function cr(fg, bg) {
    const l1 = lum(fg), l2 = lum(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  const report = [];
  let passCount = 0;

  slides.forEach((slide, idx) => {
    const wasDisplay = slide.style.display;
    const wasActive = slide.classList.contains('active');
    slide.style.display = 'flex';

    const cs = getComputedStyle(slide);
    const bg = parseRGB(cs.backgroundColor) || { r: 248, g: 245, b: 240 };
    const issues = [];

    // ── Contrast ──
    slide.querySelectorAll(
      'h1,h2,h3,p,li,span,blockquote,.label,.bullet,.stagger-bar,.frag-cell,.pill,td,th,code'
    ).forEach(el => {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return;
      const text = el.textContent.trim();
      if (!text) return;

      const fg = parseRGB(st.color);
      let elBg = parseRGB(st.backgroundColor);
      if (!elBg || (elBg.r === 0 && elBg.g === 0 && elBg.b === 0 && st.backgroundColor.includes('0)'))) {
        elBg = bg;
      }
      if (fg && elBg) {
        const ratio = cr(fg, elBg);
        const size = parseFloat(st.fontSize);
        const bold = parseInt(st.fontWeight) >= 700;
        const large = size >= 18 || (size >= 14 && bold);
        const min = large ? 3.0 : 4.5;
        if (ratio < min) {
          issues.push({
            sev: ratio < 2 ? 'error' : 'warning',
            check: 'contrast',
            msg: ratio.toFixed(1) + ':1 (need ' + min + ':1) "' + text.slice(0, 40) + '"',
            fg: 'rgb(' + fg.r + ',' + fg.g + ',' + fg.b + ')',
            bg: 'rgb(' + elBg.r + ',' + elBg.g + ',' + elBg.b + ')'
          });
        }
      }
    });

    // ── Broken images ──
    slide.querySelectorAll('img').forEach(img => {
      if (!img.complete || img.naturalWidth === 0) {
        issues.push({
          sev: 'error',
          check: 'image',
          msg: 'Broken image: ' + (img.src || '').split('/').pop()
        });
      }
    });

    // ── Overflow ──
    slide.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (st.display === 'none' || r.width === 0) return;
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'link', 'meta'].includes(tag)) return;
      if (r.right > window.innerWidth + 10 || r.bottom > window.innerHeight + 10) {
        issues.push({
          sev: 'warning',
          check: 'overflow',
          msg: '<' + tag + '> overflows (right:' + Math.round(r.right) + ' bottom:' + Math.round(r.bottom) + ')'
        });
      }
    });

    // ── Empty slide ──
    const visText = slide.textContent.trim().replace(/\s+/g, ' ');
    const hasImgs = slide.querySelectorAll('img').length > 0;
    const hasShapes = slide.querySelectorAll('[class*=accent],[class*=arc],[class*=dot]').length > 0;
    if (visText.length < 5 && !hasImgs && !hasShapes) {
      if (!slide.classList.contains('layout-blank') && !slide.querySelector('.blank')) {
        issues.push({ sev: 'warning', check: 'empty', msg: 'Slide appears empty' });
      }
    }

    // Restore display state
    if (!wasActive) slide.style.display = wasDisplay || 'none';

    if (issues.length > 0) {
      report.push({ slide: idx + 1, issues });
    } else {
      passCount++;
    }
  });

  // ── Font loading ──
  const fontIssues = [];
  if (document.fonts && document.fonts.status === 'loaded') {
    ['DM Serif Display', 'Space Mono', 'DM Sans'].forEach(font => {
      if (!document.fonts.check('16px "' + font + '"')) {
        fontIssues.push({ sev: 'warning', check: 'font', msg: 'Font "' + font + '" may not have loaded' });
      }
    });
  }

  const errors = report.reduce((n, r) => n + r.issues.filter(i => i.sev === 'error').length, 0);
  const warnings = report.reduce((n, r) => n + r.issues.filter(i => i.sev === 'warning').length, 0);

  return JSON.stringify({
    total,
    pass: passCount,
    fail: report.length,
    errors,
    warnings: warnings + fontIssues.length,
    slides: report,
    fontIssues
  }, null, 2);
})()
```

### 5. Screenshot problem slides

For each slide that has **errors** (not just warnings), navigate to it and screenshot:

```javascript
// Navigate to slide N (0-indexed)
const slides = document.querySelectorAll('.slide, .grid-slide');
slides.forEach((s, i) => {
  s.classList.toggle('active', i === N);
  s.style.display = i === N ? 'flex' : 'none';
});
```

Then capture with `mcp__claude-in-chrome__computer` action `screenshot`.

Only screenshot up to 5 slides — pick the ones with the most or worst issues.

### 6. Report findings

Present a summary table:

```
Visual A11Y Audit: <filename>
─────────────────────────────
Slides: 44 total — 31 pass, 13 with issues
Errors: 2  |  Warnings: 18

Slide  3: ✗ 2 contrast errors (1.8:1 on title text)
Slide  7: ⚠ 6 contrast warnings (textMid at 4.4:1, need 4.5:1)
Slide 12: ⚠ 3 overflow warnings (<li> elements)
...
```

Group common issues and identify root causes:
- If many slides share the same contrast issue → it's a **theme-level** problem (e.g., textMid too light)
- If one slide has unique issues → it's a **slide-level** problem (e.g., bad `<!-- bg: -->` override)
- If fonts didn't load → network/hosting issue

### 7. Recommend fixes

Based on the findings, suggest concrete fixes:

**Theme-level** (affects all slides):
- "Darken `textMid` from `#5C5549` to `#4A4540` in THEMES in `raster.js`"

**Slide-level** (affects specific slides):
- "Change `<!-- bg: #2B1A10 -->` to `<!-- bg: #3D2B1F -->` on slide 12"
- "Switch slide 15 from `layout: fragment` to `layout: bullets` to fix overflow"

**Offer to run `/qa-fix-loop`** to apply fixes automatically.
