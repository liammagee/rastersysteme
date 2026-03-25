---
paths:
  - "raster.js"
  - "qa.js"
  - "qa-html.js"
  - "qa-live.js"
---

# Accessibility Standards

HTML slide output targets WCAG 2.1 Level AA compliance:

- All text must meet 4.5:1 contrast ratio (3:1 for large text >= 18px or >= 14px bold)
- Theme `textLight` values must pass AA on their respective `bgAlt` backgrounds
- No `opacity` on text-bearing elements (pills, stagger bars, fragment cells) — use solid colors
- Minimum font-size clamp floor: 0.75rem (12px)
- All `<iframe>` elements must have a `title` attribute
- All `target="_blank"` links must include `rel="noopener noreferrer"`
- Every `<section>` slide gets `aria-roledescription="slide"` and `aria-label` from its heading
- Progress bar uses `role="progressbar"` with `aria-valuenow`
- Slide counter uses `aria-live="polite"` for screen reader announcements
- Focus-visible outlines on all interactive elements
