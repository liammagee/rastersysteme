---
name: qa-fix-loop
description: Autonomous a11y fix cycle — audit via Chrome, analyze, fix code, re-render, verify. Loops until clean or user stops.
user_invocable: true
---

# QA Fix Loop

Autonomous cycle: **audit → analyze → fix → re-render → verify → repeat**.

## Arguments

`/qa-fix-loop decks/week-1.html`
If no argument, ask which HTML file. Also need the source `.composed.md` to re-render.

## Steps

### 1. Audit (Chrome)

Connect to Chrome and run the audit JavaScript from the `/qa-visual` skill.
Use the **exact same audit script** from qa-visual Step 4.
Capture the JSON results.

### 2. Analyze findings

Parse the JSON. Categorize each issue by fix location:

| Category | Where to fix | Example |
|----------|-------------|---------|
| **Theme-level** | `raster.js` THEMES object | `textMid` contrast too low on light bg |
| **Slide-level** | `*.composed.md` directives | Dark `<!-- bg: -->` with light-theme text |
| **CSS-level** | `raster.js` generateHTMLCSS() | Hardcoded color instead of CSS variable |
| **Content-level** | `*.composed.md` content | Too many bullets causing overflow |

### 3. Apply fixes

**Theme fixes** — edit the THEMES object in `raster.js`:
```javascript
// Example: darken textMid for better contrast
textMid: '#4A4540',  // was #5C5549
```

**Slide fixes** — edit the composed markdown:
- Change `<!-- bg: #HEX -->` to a better-contrasting color
- Switch `<!-- layout: -->` to avoid overflow
- Remove excess content

**CSS fixes** — replace hardcoded colors with CSS variables in `raster.js`.

### 4. Re-render

```bash
node raster.js <source.composed.md> <output.html> --theme light --format html
```

If the source markdown isn't obvious, check the deck filename pattern:
- `decks/week-1.html` → look for `content/week-1/*.composed.md` or `decks/week-1.composed.md`

### 5. Verify (Chrome)

Reload the tab:
```javascript
location.reload()
```

Wait 2 seconds for fonts/images to load, then re-run the audit JS from Step 1.

### 6. Report

Compare before and after:
```
Fix cycle complete
──────────────────
Before: 13 slides with issues (2 errors, 18 warnings)
After:  0 issues

Changes made:
  - raster.js: darkened textMid #5C5549 → #4A4540
  - week-1.composed.md: changed bg on slide 12
```

If issues remain (after > 0), ask the user if they want another cycle.

### 7. Commit (optional)

If all clean, offer to commit:
```bash
git add raster.js <composed.md> <output.html>
git commit -m "Fix a11y: [summary]"
```
