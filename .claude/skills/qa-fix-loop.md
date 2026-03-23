---
name: qa-fix-loop
description: Run visual QA audit, fix issues, re-render, verify. Autonomous a11y fix loop using Claude in Chrome + codebase access.
user_invocable: true
---

# QA Fix Loop

Autonomous accessibility fix cycle: audit → fix → re-render → verify.

## Instructions

When the user invokes `/qa-fix-loop`, follow this cycle:

### Step 1: Audit (Chrome)

Connect to Chrome via `mcp__claude-in-chrome__tabs_context_mcp`.
Navigate to the slideshow. Run the a11y audit JS (from /qa-visual skill).
Capture the results as JSON.

### Step 2: Analyze findings

Read the JSON results. Categorize issues:

**Theme-level fixes** (affect ALL slides):
- `textMid` contrast too low → fix in `raster.js` THEMES object
- `accent` on bg clash → fix in THEMES or adaptThemeForBg

**Slide-level fixes** (affect specific slides):
- Dark bg with light-theme text → fix `<!-- bg: -->` in composed.md
- Overflow → adjust layout or content in composed.md
- Broken images → check image paths

**CSS fixes**:
- Hardcoded colors → replace with CSS variables in generateHTMLCSS()

### Step 3: Apply fixes

For theme fixes:
```bash
# Read current theme values
grep -n "textMid\|accent" raster.js | head -10
# Edit the theme in raster.js
```

For slide fixes:
```bash
# Edit the composed markdown
# Re-render
node raster.js <composed.md> <output.html> --theme light --format html
```

### Step 4: Re-render

```bash
node raster.js <source> <output.html> --theme light --format html
```

### Step 5: Verify (Chrome again)

Reload the tab and re-run the audit:
```javascript
location.reload()
```
Wait 2 seconds, then re-run the audit JS.

### Step 6: Report

Compare before/after:
- Issues before: N
- Issues after: M
- Fixed: N - M
- Remaining: M (with details)

If M > 0, ask the user if they want another fix cycle.

### Step 7: Commit (optional)

If all issues are fixed, offer to commit:
```bash
git add raster.js <composed.md>
git commit -m "Fix a11y issues: [summary]"
```

## Example

User: `/qa-fix-loop decks/week-1.html`

Claude:
1. Opens Chrome, audits → "13 slides with contrast warnings (textMid 4.4:1)"
2. Reads raster.js → textMid is #5C5549
3. Calculates: needs #4A4540 for 4.5:1 on #F8F5F0
4. Edits raster.js
5. Re-renders HTML
6. Reloads Chrome, re-audits → "0 issues"
7. "Fixed. Commit?"
