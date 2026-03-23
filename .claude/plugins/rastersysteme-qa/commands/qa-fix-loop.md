---
description: Autonomous a11y fix cycle — audit, fix code, re-render, verify
---

Run an autonomous accessibility fix loop on an HTML slideshow:
audit → analyze → fix code → re-render → verify.

The user may provide a file path as an argument (e.g., `/qa-fix-loop decks/week-1.html`).

## Steps

### 1. Audit (same as /qa-visual)

Connect to Chrome and run the a11y audit JavaScript (see /qa-visual skill for the full script).
Capture results as JSON.

### 2. Analyze findings

Categorize issues:

**Theme-level** (fix in `raster.js` THEMES object):
- `textMid` contrast too low → darken the hex value
- accent/bg clash → adjust in adaptThemeForBg

**Slide-level** (fix in composed.md):
- Dark bg override with light-theme text → change `<!-- bg: -->` hex
- Overflow → check bullet count, consider different layout

**CSS-level** (fix in generateHTMLCSS):
- Hardcoded `#fff` or `#000` → replace with `var(--white)` / `var(--black)`

### 3. Apply fixes

Read the relevant file, make the edit, save.

For theme fixes: edit THEMES in raster.js
For slide fixes: edit the .composed.md file
For CSS fixes: edit generateHTMLCSS() in raster.js

### 4. Re-render

```bash
node raster.js <source.md> <output.html> --theme light --format html
```

### 5. Verify

Reload the Chrome tab:
```javascript
location.reload()
```

Wait 2 seconds, then re-run the audit JavaScript.

### 6. Report

Compare before/after issue counts.
If issues remain, ask the user if they want another cycle.
If all clear, offer to commit the fixes.

### 7. Commit (if user agrees)

```bash
git add raster.js <composed.md>
git commit -m "Fix a11y: [summary of changes]"
```
