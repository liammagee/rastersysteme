# Accessibility Audit: decks/week-1i.html

Audited 2026-03-25 against WCAG 2.1 Level AA.

## Critical (WCAG A/AA failures)

### 1. Color Contrast Failures
- **Label text `#B8B0A4` on `#F8F5F0`**: ~2.1:1 ratio (needs 4.5:1 for normal text)
- **`--text-light: #7A7168` on `--bg-alt: #FAFAF7`**: ~3.3:1 (fails AA normal text)
- **`--text-mid: #5C5549` on `--bg-alt: #FAFAF7`**: ~5.2:1 (passes AA, but tight)
- **`.title-right .subtitle` `rgba(255,255,255,0.7)` on `#1A1A1A`**: ~10:1 (OK)
- **`.title-right p` `rgba(255,255,255,0.6)` on `#1A1A1A`**: ~7.5:1 (OK)
- **`.layout-section .subtitle` `rgba(255,255,255,0.5)` on `#1A1A1A`**: ~5.3:1 (borderline)
- **`.pill`, `.stagger-bar`, `.frag-cell` use `opacity: 0.85-0.88`** on white text over colored backgrounds — reduces effective contrast

### 2. Missing ARIA Landmarks
- No `role` or `aria-roledescription` on slide sections
- Deck container has no `role="application"` or similar
- No `aria-label` on slides to identify content
- No `aria-current="true"` on active slide

### 3. Progress Bar Not Accessible
- `<div class="progress">` lacks `role="progressbar"`
- Missing `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Slide counter not in an `aria-live` region

### 4. Iframe Missing Title
- YouTube embed (line 439) has no `title` attribute (WCAG 4.1.2)

### 5. Generic Image Alt Text
- Line 575: `alt="Image"` is non-descriptive — should describe actual content

## Moderate

### 6. Links Open New Tabs Without Warning
- All `target="_blank"` links lack visual indicator of new-window behavior
- Missing `rel="noopener noreferrer"` (security + performance)

### 7. No Focus Indicators
- No `:focus-visible` styles for links or interactive elements
- Keyboard users cannot see where focus is

### 8. Page Title Non-Descriptive
- `<title>week-1i.composed</title>` — not meaningful for screen readers or tab identification

### 9. Minimum Font Sizes Too Small
- `.label` uses `clamp(0.55rem, 0.9vmin, 0.75rem)` — minimum is 8.8px, below readable threshold
- `.code-lang` at `0.6rem` (9.6px) is borderline

## Minor

### 10. Empty Zones
- Multiple empty `zone-label` and `zone-body` divs add DOM noise

### 11. No Skip Navigation
- No mechanism to skip between slides for screen reader users (though arrow keys work)

### 12. Keyboard Shortcuts Not Discoverable
- N (notes), F (fullscreen), P (presenter) are undocumented to assistive tech

## Recommendations for Build System

These should be fixed in `raster.js` HTML renderer:

1. Add `aria-roledescription="slide"` and `aria-label` (from h1 text) to each `<section>`
2. Add `role="application"` to deck container
3. Emit `role="progressbar"` with aria-value* on progress element
4. Emit `aria-live="polite"` on counter
5. Set `aria-current="true"` on active slide via JS
6. Raise label color from `#B8B0A4` to at least `#8A8279` (≥4.5:1 on light bg)
7. Raise `--text-light` from `#7A7168` to at least `#6B6157` (≥4.5:1)
8. Remove opacity from `.pill`, `.stagger-bar`, `.frag-cell` — use solid colors instead
9. Add `title` attribute to all iframes (use figcaption text)
10. Add `rel="noopener noreferrer"` to all `target="_blank"` links
11. Generate descriptive page `<title>` from source filename/first h1
12. Add `:focus-visible` outline styles
13. Set minimum font clamp floors to `0.75rem` (12px)
14. Add `aria-label` or visually hidden keyboard instructions
