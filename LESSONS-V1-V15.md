# Lessons from v1-v15: Recurring Patterns and Fixes

Distilled from 15 versions of week-2 deck composition and evaluation.
These lessons should be encoded into compose prompts, inner loop automation, and skill documentation.

## Always-Broken (source-level, every version)

### S7: Proto-Computing slide
**What**: Two manuscript images + table + body text. The compose step never assigns a title zone. The renderer creates an extras body zone that collides with the design zones.
**Fix applied every time**: Add `"role":"title"` zone, extract heading from garbled table markdown, separate images onto individual lines.
**Root cause**: The source markdown for this slide has images and text on the same line, plus a table with garbled bold formatting. The parser can't cleanly separate them.
**Permanent fix needed**: Clean up the source markdown for this slide. Or: add a post-compose fixup that detects slides with image+table zones but no title zone and adds one.

### S21: "For those mathematically / philosophically minded"
**What**: Only a body zone, no title zone. The first line reads as a heading but the compose step treats it as body text. Extras injects a title that overlaps the body zone.
**Fix applied every time**: Add `"role":"title"` zone.
**Root cause**: The source line doesn't use `###` — it's plain text that reads like a heading.
**Permanent fix needed**: Either add `###` to the source markdown, or add a post-compose rule: "if a slide has a body zone but no title zone, and the first line of body is < 80 chars, make it a title zone."

### S24: Discussion / Break
**What**: Body zone styled as display text (size 44, center-aligned). The body zone is empty because the parser puts "Discussion / Break" into `slide.title`, not `slide.body`.
**Fix applied every time**: Change `"role":"body"` to `"role":"title"`, change markdown to `## Discussion / Break`.
**Permanent fix needed**: Compose prompt should use "title" role for section dividers.

### S14: Big modernity table
**What**: 8-row × 3-column table with dense content. Truncated or clipped in most versions.
**Fix that works**: Full grid span (col:0, span:60, row:0, rowSpan:40), font size 9-10px, role "table" not "body".
**Permanent fix needed**: Compose prompt should recognize tables with >5 rows as "data-heavy" and assign maximum zone space.

## Always-Needs-Inner-Loop-Fixing

### Title size proliferation
**Pattern**: Opus composes 6-10 different title sizes every time. Inner loop always consolidates to 3-4.
**Lesson for compose prompt**: Add explicit instruction: "Use EXACTLY 3 title sizes: hero (44px), section (36px), standard (32px). No other sizes."

### Accent saturation
**Pattern**: Opus puts accents on every slide (ratio 0.9-1.0). Inner loop strips 5-8 accents to reach 0.75-0.85.
**Lesson for compose prompt**: Already says "60-80% of slides" but opus ignores it. Make it STRONGER: "IMPORTANT: Leave at least 6 slides WITHOUT any accent elements."

### Sparse slides
**Pattern**: 3-4 sparse slides per version. Always the same: S13 (link), S18 (practice link), S24 (break), S36 (closing).
**Lesson**: These are structural to the source content. The inner loop can't fix them without changing the source. Accept 3-4 sparse slides as the floor.

## Palette Convergence (the beige problem)

### Root cause (fixed in v15)
The compose.js prompt hardcoded "ground MUST be warm white/cream (luminance > 200)" — overriding any brief palette. This made every version beige regardless of the design brief.

### Fix applied
Changed prompt to "DERIVED FROM BRIEF PALETTE — not defaulting to warm cream."

### Remaining issue
Even with the fix, compose tends toward low-saturation backgrounds. The design-insights.md says "light orientation >= 80%" which pushes toward pastels. Need to balance readability (light bg) with chromatic identity (tinted, not just white).

## What the Rubric Catches vs What It Misses

### Catches well
- Zone collisions (CSS rect intersection)
- Title size proliferation (count)
- Accent saturation (ratio)
- Generic alt text (count)
- Empty body zones (presence)
- Sparse slides (text length)

### Misses
- The same S7/S21/S24 fixes needed every time — the rubric detects the symptom but the compose step keeps producing the cause
- Font consistency appears as `fontSets: 0` in jsdom (can't read CSS fonts) — Puppeteer detects it but the inner loop can't act on it
- Whether the design brief was actually followed (v14 brief said green, deck was beige)
- Visual quality, impact, surprise (permanently human-judgment)

## Recommendations for Skills/Agents

### Post-compose fixup agent
A new agent that runs AFTER compose.js and BEFORE render:
1. Scan for slides with image+table zones but no title zone → add one
2. Scan for body zones on slides where content is a single heading → change to title
3. Consolidate title sizes to 3 (using the most common sizes as targets)
4. Count accent slides — if >85%, strip accents from the least-important body slides
5. Verify the bg palette matches the brief's specified colors

This would eliminate ~80% of the inner loop work that's currently manual.

### Compose prompt refinements
Add to compose.js:
- "Use EXACTLY 3 title sizes"
- "Leave at least 6 slides WITHOUT accents"
- "Every slide with a `###` heading MUST have a title zone, not a label zone"
- "Slides whose primary content is a table must use role:table, not role:body"
- "Match the brief's hex colors exactly for bg — do not substitute warm cream"

### Inner loop automation
The refine-step should automate the standard fixes:
1. Title consolidation (always needed, always the same algorithm)
2. S7/S21/S24 fixes (detectable by zone+content pattern)
3. Accent stripping (if ratio > 0.85, strip from body-heavy slides)
4. Big table zone expansion (if table has >5 rows, maximize zone)

These should run AUTOMATICALLY before the first evaluation, not as manual iteration.
