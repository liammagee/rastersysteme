# HTML → Google Slides Conversion Rules

Lessons learned from the HTML-to-Google Slides export pipeline. These rules apply when composing design directives that will be exported to Google Slides via `export-gslides.js`.

## Font Constraints

- **Default font: Palatino.** Only use `Courier New` for slides with table zones. The compose step sometimes assigns Courier New to non-data slides — the export pipeline overrides this, but it's better to compose correctly.
- **Title size cap: 36pt.** Google Slides renders text larger than HTML at the same pt size (no responsive `clamp()`). Titles above 36pt overflow their zones. The HTML renderer can use up to 52pt because it has `clamp()` with viewport-relative sizing.
- **Body minimum: 12pt.** Below 12pt text becomes unreadable in Google Slides (no anti-aliasing benefit of CSS rendering).

## Zone Layout Constraints

- **No vertical overlap between title and body/bullets zones.** In HTML, overlapping zones work because CSS `overflow:hidden` clips content. In Google Slides, text boxes render their full content regardless of zone boundaries. Body zone `row` must be > title zone `row + rowSpan`.
- **Body zones should not include bullets when a separate bullets zone exists.** The `body` zone fallback that combines body+bullets text causes duplication in Google Slides because both zones render independently.
- **Empty body zones are harmless in HTML but create invisible text boxes in Google Slides.** Skip zones with no matching content.

## Image Handling

- **Image transparency is not writable via the API.** Use `gslides-preprocess-images.js` to bake opacity (typically 0.75) into the PNG before upload. This simulates the HTML `opacity: 0.2` atmospheric effect.
- **Image zones need `width:100%;height:100%;object-fit:cover` in HTML** and full EMU dimensions in Google Slides. The default `imagesHTML()` function uses `max-width:100%;object-fit:contain` which keeps images small.
- **Version-suffix stripping for image discovery.** `week-2-v12` strips to `week-2` to find shared `week-2.composed-images/` directory. Both `export-gslides.js` and `gslides-preprocess-images.js` implement this.

## API Constraints

- **`TEXT_BOX` shape type required** for text zones. `RECTANGLE` does not support `autofit` control.
- **`autofit.autofitType: "NONE"` is essential.** Without it, Google Slides reshapes text boxes to fit content, destroying the 60-column grid (up to 38% height drift observed).
- **`textRange.type: "ALL"` must NOT include `startIndex`.** The API rejects `startIndex: 0` with range type `ALL`.
- **Batch limit: ~400 requests.** A 40-slide deck generates ~600-900 requests. Chunk into batches of 400.
- **Speaker notes require post-creation API calls** to discover the notes page shape ID, then insert text.

## Chromatic Arc

- **Dark background colors from the design system palette must be whitelisted** in `compose.js`. The default luminance check strips colors with `lum < 100`, killing the chromatic arc. Add palette hex values to a whitelist set.
- **Accent colors for dot backgrounds on dark slides** need WCAG AA contrast with white text (4.5:1). Use the `.dark-bg` CSS class to switch dot text from white to dark on dark-background slides.

## Content Density

- **Dense slides (>400 chars) need body font ≤ 12pt and expanded zones.** HTML handles overflow with `overflow:hidden` clipping, but Google Slides shows all text. Either reduce font or split the slide.
- **Tables render as formatted text** in Google Slides (the API doesn't support native tables in batch create). Full-width zones with 12pt font work best.

## Workflow

```bash
# Compose with design system
node pipeline.js content/week-2/week-2.md --design-system week-2-v12 --model opus --from split --to render

# Quick content refresh (no API call)
node refresh-content.js content/week-2/week-2.md decks/week-2-v18.composed.md --render

# Preprocess images (bake opacity)
node gslides-preprocess-images.js decks/week-2-v18.composed.md --opacity 0.75

# Export to Google Slides
node export-gslides.js decks/week-2-v18.composed.md --credentials <path> --title "Deck Title" --open

# Evaluate fidelity
node gslides-fidelity.js <presentation-id> decks/week-2-v18.composed.md
```
