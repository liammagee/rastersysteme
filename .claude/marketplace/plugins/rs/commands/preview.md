---
name: preview
description: Open a slide deck in Chrome and navigate to a specific slide for visual inspection. Supports interactive browsing.
---

# Preview

Open or navigate to a specific slide in Chrome for visual inspection.

## Arguments

`/rs:preview decks/week-1k.html`
`/rs:preview decks/week-1k.html slide 15`
`/rs:preview slide 15` (uses currently open deck)
`/rs:preview next` / `/rs:preview prev`

## How to work

### 1. Connect to Chrome

Use `mcp__claude-in-chrome__tabs_context_mcp` to find available tabs.

If the deck is already open, reuse the tab. Otherwise create a new tab and navigate to `http://localhost:8701/<deck-path>`.

If connection fails, tell the user to:
- Open Chrome (not Arc/Brave)
- Click the Claude in Chrome extension icon
- Run `npm run serve` if the local server isn't running

### 2. Navigate to slide

```javascript
const slides = document.querySelectorAll('.slide, .grid-slide');
const N = <slide-number> - 1;
slides.forEach((s, i) => {
  s.classList.toggle('active', i === N);
  s.style.display = i === N ? 'flex' : 'none';
});
```

### 3. Screenshot and describe

Take a screenshot. Report: "Slide N of M — '<title>'"

Briefly describe what you see: layout type, whether the image placement looks good, any obvious issues.

### 4. Interactive mode

After showing the screenshot, the user can say:
- **"next" / "prev"** — step through slides
- **"slide 20"** — jump to a specific slide
- **"looks off"** → offer to run `/rs:edit-slide`
- **"audit this"** → run the QA checks on just this slide
