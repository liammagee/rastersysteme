---
name: qa-visual
description: Run a visual accessibility audit on an HTML slideshow using Claude in Chrome. Screenshots each slide, checks contrast ratios, overflow, broken images, and reports findings.
user_invocable: true
---

# Visual QA Audit

Run an interactive visual accessibility audit on an HTML slideshow using Chrome browser automation.

## What this skill does

1. Opens the slideshow in Chrome (or uses an already-open tab)
2. Navigates through each slide
3. Screenshots slides with issues
4. Runs computed a11y checks (contrast, overflow, broken images, empty slides, fonts)
5. Reports findings with screenshots

## Instructions

When the user invokes `/qa-visual`, follow these steps:

### Step 1: Get the target

Ask the user which HTML file to audit if not specified. Common locations:
- `decks/week-1.html`
- `decks/*.composed.html`
- Any `.html` file in the project

### Step 2: Connect to Chrome

Use `mcp__claude-in-chrome__tabs_context_mcp` to get tabs. If the slideshow is already open, use that tab. Otherwise create a new tab with `mcp__claude-in-chrome__tabs_create_mcp` and navigate to `http://localhost:8701/<path>` (the local dev server).

If the server isn't running, tell the user to run `npm run serve` first.

### Step 3: Navigate to slide 1

```javascript
// Go to first slide
const slides = document.querySelectorAll('.slide,.grid-slide');
slides.forEach((s,i) => { s.classList.toggle('active', i===0); s.style.display = i===0 ? 'flex' : 'none'; });
```

### Step 4: Run the audit

Execute this JavaScript on the page to audit ALL slides at once:

```javascript
(function() {
  const slides = document.querySelectorAll('.slide,.grid-slide');
  const total = slides.length;

  function parseRGB(str) {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
  }
  function lum(c) {
    const [r,g,b] = [c.r,c.g,c.b].map(v => { v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  }
  function cr(fg, bg) {
    const l1=lum(fg), l2=lum(bg);
    return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
  }

  const report = [];
  let passCount = 0;

  slides.forEach((slide, idx) => {
    const wasActive = slide.classList.contains('active');
    slide.style.display = 'flex';
    const cs = getComputedStyle(slide);
    const bg = parseRGB(cs.backgroundColor) || {r:248,g:245,b:240};
    const issues = [];

    // Contrast check
    slide.querySelectorAll('h1,h2,h3,p,li,span,.label,.stagger-bar,.frag-cell,.pill,td,th,blockquote').forEach(el => {
      const st = getComputedStyle(el);
      if (st.display==='none' || st.visibility==='hidden') return;
      const text = el.textContent.trim().slice(0,30);
      if (!text) return;
      const fg = parseRGB(st.color);
      let elBg = parseRGB(st.backgroundColor);
      if (!elBg || st.backgroundColor.includes('0)')) elBg = bg;
      if (fg && elBg) {
        const ratio = cr(fg, elBg);
        const size = parseFloat(st.fontSize);
        const bold = parseInt(st.fontWeight) >= 700;
        const large = size >= 18 || (size >= 14 && bold);
        const min = large ? 3.0 : 4.5;
        if (ratio < min) {
          issues.push({sev: ratio < 2 ? 'error' : 'warning', msg: ratio.toFixed(1) + ':1 (need ' + min + ') "' + text + '"'});
        }
      }
    });

    // Broken images
    slide.querySelectorAll('img').forEach(img => {
      if (!img.complete || img.naturalWidth === 0) issues.push({sev:'error', msg:'Broken image: ' + img.src.split('/').pop()});
    });

    // Overflow
    slide.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.right > window.innerWidth + 10) issues.push({sev:'warning', msg:'Overflow right: <' + el.tagName.toLowerCase() + '>'});
    });

    if (!wasActive) slide.style.display = 'none';

    if (issues.length > 0) report.push({ slide: idx+1, issues });
    else passCount++;
  });

  return JSON.stringify({ total, pass: passCount, fail: report.length, slides: report }, null, 2);
})()
```

### Step 5: Screenshot problem slides

For each slide with issues, navigate to it and take a screenshot:

```javascript
// Navigate to slide N (0-indexed)
const slides = document.querySelectorAll('.slide,.grid-slide');
slides.forEach((s,i) => { s.classList.toggle('active', i===N); s.style.display = i===N ? 'flex' : 'none'; });
```

Then use `mcp__claude-in-chrome__computer` with `action: "screenshot"` to capture it.

### Step 6: Report

Summarize the findings:
- Total slides, pass count, fail count
- Per-slide issues with severity
- Screenshots of the worst offenders
- Specific recommendations (e.g., "textMid color needs darkening for AA compliance")

### Step 7: Offer fixes

If issues are found, offer to:
- Fix the theme colors in `raster.js`
- Adjust specific `<!-- bg: -->` overrides in the composed markdown
- Re-render the slides

## Example invocation

User: `/qa-visual decks/week-1.html`

Response: Opens Chrome, audits all 44 slides, screenshots problem slides, reports:
```
Visual A11Y Audit: week-1.html
44 slides — 31 pass, 13 warn, 0 fail

Slide 7: 10 contrast warnings (sub-bullets at 4.4:1, need 4.5:1)
Slide 9: 6 contrast warnings (em-dashes at 4.4:1)
...

Recommendation: Darken textMid from #5C5549 to #4A4540 (+0.3 contrast)
```
