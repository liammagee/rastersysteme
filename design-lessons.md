# Design Lessons

Accumulated from evaluation feedback loops. Read by `compose.js` to inform
future composition. Updated by `rubric-headless.js` after each evaluation run.

**Rotation policy**: Keep the 50 most recent lessons. Older lessons are summarized
into design-insights.md via `corpus-synthesize.js` before being pruned.

---

## Zone Sizing

- **Every slide with a heading (# or ##) MUST have a title zone.** Without a title
  zone, the heading text vanishes. This was the second most common compose error:
  7/36 slides had headings but no title zone.
- **Tables with >5 rows** need a dedicated `"table"` zone with `rowSpan >= 30`
  and body font-size <= 11px. Never rely on a generic body zone for large tables.
- **Body zones** need `rowSpan >= 24` when the slide has >5 bullets or >3 body
  paragraphs. Cramped zones cause overflow clipping.
- **Dense slides** (>10 content lines): use full-width body span (>= 44 cols).
  Narrow sidebar layouts (span 22-26) truncate dense content.
- **Image-only slides** (no text other than a caption): do NOT add a body zone.
  Empty body zones degrade the Content Completeness score.

## Typography

- **Label font-size minimum: 12px.** The WCAG floor is 0.75rem (12px). Labels
  at 9-10px fail accessibility audits. Use 12px with tracking 0.15-0.2em.
- **Body font-size minimum: 13px** for readability at projection distance.
  Exception: dense tables may use 10-11px if the table zone spans >50 cols.
- **Title font-size maximum: 44px** for most slides. Titles >48px cause overflow
  on slides with long headings. Reserve 48-52px for title-only/section slides.

## Contrast & Color

- **Dark backgrounds** (relative luminance < 0.2): use text colors with >7:1
  contrast. Safe values: FFFFFF (titles), F0EBE3 (body), D0C8B8 (labels).
- **Mid-tone backgrounds** (luminance 0.2-0.5): these are the danger zone.
  Both dark and light text can fail. Test contrast before using. Prefer
  either very light (>0.7 lum) or very dark (<0.15 lum) backgrounds.
- **Accent colors on dark backgrounds**: standard theme accents (B7311A, 1B5E80,
  2B7038) ALL fail WCAG on dark bgs. The renderer adapts them automatically,
  but design directives should not specify these as text colors on dark slides.
- **Light orientation**: use >= 80% light backgrounds. Reserve dark slides only
  for section dividers (max 4 per deck of 30+ slides).

## Content Preservation

- **NEVER invent ### labels.** If the source slide has no ### heading, the composed
  slide must have no ### heading. Labels are content, not decoration. This was the
  single most common composition error: 29/36 slides had invented labels in early runs.
- **NEVER rewrite, paraphrase, or add text.** Every word must trace to the source.
  The compose step adds design directives and speaker notes ONLY.
- **Every slide with body text or bullets MUST have a body zone** in the design
  directive. If the directive has only a title zone, body text renders as an
  unpositioned extra that may clip or overlap.
- **Two ### headings**: the first short ### becomes `sectionLabel`, the second
  becomes `subtitle`. Do not use two ### lines for label + title; use ### + ##.
- **Blockquotes**: if content includes `> ` blockquote syntax, add a `"quote"`
  zone. Otherwise body text in a quote zone will fall back correctly.
- **Links**: standalone `[text](url)` lines need either a body zone (fallback
  renders them) or a dedicated links zone.

## Image Integration

- **Splice with `--image-scale visible`** (the default). The `subtle` scale
  reduces opacity to 0.10–0.30 which is technically present but invisible
  at projection distance — the rubric now penalizes this. Use `visible`
  (0.45–0.70 opacity) for real aesthetic effect. Only use `bold` if
  text-on-image collisions are acceptable.
- **Decks MUST be spliced before evaluation.** The rubric penalizes unspliced
  decks (-2 on Image Integration). Always run `splice-images.js` before
  `run-rubric-eval.js`.
- **Splice visibility threshold: opacity >= 0.4.** Below this, images count
  as "present but invisible." If >50% of spliced images fall below 0.4
  opacity, the rubric applies a -1.5 penalty. This catches the Goodhart
  failure where subtle-scale decks score 98% with invisible images.
- **Source images** (from the markdown) are placed by the renderer into image
  zones or as extras. They don't conflict with spliced images.
- **Spliced image placement**: `right` and `left` sidebars are safest. `overlay`
  and `background` modes risk text-on-image overlap even at visible scale.

## Grid Composition

- **Rotate through >= 4 archetypes** to score well on Grid Utilization:
  Monument (col:4 span:52), Sidebar-L (body col:30+), Offset-R (title col:28+),
  Editorial (col:10 span:40), Split (two columns), Narrow (col:6 span:20).
- **No two adjacent slides** should share the same zone archetype.
- **Margins**: don't always start zones at col 0. Use col 4, 6, 8, 10 for
  breathing room. Full-bleed (col:0 span:60) should be rare.
- **Body zone width**: vary between span 24 (narrow, editorial) and span 52
  (wide, dense content). Match to content density.

---

*Last updated by rubric-headless.js evaluation loop.*
## Evaluation Log

Automatically appended by `rubric-headless.js` after each evaluation.

- [2026-03-27] **week-2.html**: 3 text elements below 12px. Increase label/caption font-size to >= 12px in design directives.
- [2026-03-27] **week-2.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2.html**: 3 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-27] **week-2.html**: 1 text elements below 12px. Increase label/caption font-size to >= 12px in design directives.
- [2026-03-27] **week-2.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2.html**: 3 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-27] **week-2-v2.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v2.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-27] **week-2-v2.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v2.spliced.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 4 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 4 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 12 WCAG contrast failures. On dark backgrounds (lum < 0.2), use FFFFFF/F8F5F0 for titles, F0EBE3 for body. Avoid mid-tone text on any background.
- [2026-03-27] **week-2-strata.html**: 11 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 4 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 12 WCAG contrast failures. On dark backgrounds (lum < 0.2), use FFFFFF/F8F5F0 for titles, F0EBE3 for body. Avoid mid-tone text on any background.
- [2026-03-27] **week-2-strata.html**: 11 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-v2.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v2.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-27] **week-2-v2.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v2.spliced.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 12 WCAG contrast failures. On dark backgrounds (lum < 0.2), use FFFFFF/F8F5F0 for titles, F0EBE3 for body. Avoid mid-tone text on any background.
- [2026-03-27] **week-2-strata.html**: 11 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2.html**: 8 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2.html**: 55 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-v2.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v2.spliced.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-27] **week-2-v2.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v2.spliced.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-27] **week-2-v2.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v2.spliced.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-27] **week-2-v2.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v2.spliced.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 12 WCAG contrast failures. On dark backgrounds (lum < 0.2), use FFFFFF/F8F5F0 for titles, F0EBE3 for body. Avoid mid-tone text on any background.
- [2026-03-27] **week-2-strata.html**: 29 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 12 WCAG contrast failures. On dark backgrounds (lum < 0.2), use FFFFFF/F8F5F0 for titles, F0EBE3 for body. Avoid mid-tone text on any background.
- [2026-03-27] **week-2-strata.html**: 29 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 12 WCAG contrast failures. On dark backgrounds (lum < 0.2), use FFFFFF/F8F5F0 for titles, F0EBE3 for body. Avoid mid-tone text on any background.
- [2026-03-27] **week-2-strata.html**: 29 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 12 WCAG contrast failures. On dark backgrounds (lum < 0.2), use FFFFFF/F8F5F0 for titles, F0EBE3 for body. Avoid mid-tone text on any background.
- [2026-03-27] **week-2-strata.html**: 43 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.
- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 22 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 22 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 22 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 22 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-strata.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-strata.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-strata.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2-strata.html**: 22 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.
- [2026-03-27] **week-2-strata.html**: 22 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.
- [2026-03-27] **week-2.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2.html**: 8 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-27] **week-2.html**: 55 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-strata.html**: 22 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-strata.html**: 22 contrast warnings. Darken label colors on light backgrounds (use 6A6052 or darker). Theme accent colors fail on dark backgrounds — let renderer adapt them.

- [2026-03-27] **week-2-v7.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v7.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-v7.html**: 5 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-27] **week-2-v8.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v8.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-v8.spliced.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-27] **week-2-v8.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-27] **week-2-v8.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-27] **week-2-v8.spliced.html**: 7 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-28] **week-2-v9.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v9.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-28] **week-2-v9.spliced.html**: 6 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-28] **week-2-v9.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v9.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-28] **week-2-v9.spliced.html**: 6 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v9.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-28] **week-2-v9.spliced.html**: 6 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-28] **week-2-v9.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v9.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-28] **week-2-v9.spliced.html**: 6 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v8.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v8.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v10.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v10.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-28] **week-2-v10.spliced.html**: 6 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-28] **week-2-v9.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v10.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v10.spliced.html**: 2 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v10.spliced.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-28] **week-2-v10.spliced.html**: 5 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-28] **week-2-v10.spliced.html**: 2 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v10.spliced.html**: 2 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-28] **week-2-v10.spliced.html**: 5 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-28] **week-2-v11.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-28] **week-2-v11.spliced.html**: 6 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-28] **week-2-v11.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
- [2026-03-28] **week-2-v11.spliced.html**: 6 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.

- [2026-03-28] **week-2-v11.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-28] **week-2-v11.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-28] **week-2-v11.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-28] **week-2-v11.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-28] **week-2-v11.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-28] **week-2-v11.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-28] **week-2-v11.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v10.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v10.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v10.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: 3 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with no visible text (and no images). Ensure every non-image slide has a body or quote zone with content.

- [2026-03-28] **week-2-v11.spliced.html**: 3 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with no visible text (and no images). Ensure every non-image slide has a body or quote zone with content.

- [2026-03-28] **week-2-v11.spliced.html**: 3 empty body zones. Remove body zones from image-only and table-only slides. Match zone roles to actual content type.
- [2026-03-28] **week-2-v11.spliced.html**: 1 slides with no visible text (and no images). Ensure every non-image slide has a body or quote zone with content.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v10.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v10.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v10.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-4-workshop.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v10.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-4-workshop.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-4-workshop.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-4-workshop.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-4-workshop.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v11.spliced.html**: 88 text-on-image collisions. Use `--image-scale subtle` when splicing. Avoid `overlay` and `background` placement on text-heavy slides.
- [2026-03-28] **week-2-v11.spliced.html**: 9 slides with 3+ issues each. Systematic design problems — review zone sizing, contrast, and image placement across the deck.

- [2026-03-28] **week-2-v11.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v12.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v12.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v12.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v12.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v13.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v13.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v14.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v14.spliced.html**: All computed dimensions scored >= 8. No new lessons.

- [2026-03-28] **week-2-v15.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v15.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.

- [2026-03-28] **week-2-v15.spliced.html**: 1 table truncations. Tables need dedicated table zones with span >= 50 and rowSpan >= 30. Reduce body font-size to 10-11px for dense tables.
- [2026-03-28] **week-2-v15.spliced.html**: 1 slides with clipped content. Expand body zone rowSpan (>= 24 for bullet slides, >= 28 for prose). Add explicit body zones for slides with unzoned text.
