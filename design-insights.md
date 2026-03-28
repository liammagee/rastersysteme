# Design Insights

Data-driven composition guidance derived from the design corpus.
Generated: 2026-03-28 from 7 scored decks.

These rules are injected into Claude composition prompts alongside design-lessons.md.
Each rule is backed by corpus evidence (deck count, score correlation).

## Palette & Accessibility

- **Light orientation >= 80%**: avg accessibility 7.3/10 (n=5)
- **Light orientation < 60%**: avg accessibility 2.4/10 (n=2) — avoid
- **Chromatic arc >= 3 crossings**: avg color 9.7/10 (n=6)
- **Background variety**: median 6 unique backgrounds across corpus

## Grid & Zone Archetypes

- **>=5 archetypes**: avg grid 10.0/10 (n=6)
- **Consecutive same archetype >=3**: avg coherence 8.0 vs <=2: 7.0
- **Column start variety**: median 8 unique col starts

## Typography

- **Title size**: median avg 36px across corpus
- **Font variety**: median 2 fonts per deck

## Accents

- **Accent frequency**: median 83% of slides have accents
- **Most used accent types**: bar (99x), line (78x), dot (53x), block (3x)

## Content Completeness

- **Corpus median content score**: 6/10
- **Content completeness is the weakest dimension** — prioritize zone-content matching

## Intensity Profile Patterns

- **maximal**: avg normalized score 76% (n=7)
  - Weak dimensions: contentCompleteness (5.5), accessibility (5.9)

## Exemplar Decks

**Best**: week-2-v3 (95% — Exhibition)
  - Intensity: maximal
  - Palette: 4 bgs, 83% light
  - Archetypes: 12 unique
  - Fonts: Futura, Helvetica Neue, Georgia

**Weakest**: week-1e (38% — Broken)
  - Intensity: maximal
  - Palette: 5 bgs, 0% light
  - Archetypes: 4 unique

---

## Composition Rules (for Claude prompts)

_These rules are extracted by corpus-synthesize.js and injected into compose.js._

- **[SHOULD]** Avoid <60% light backgrounds. Dark-heavy palettes correlate with accessibility failures.
  _Evidence: 2 decks with <60% light: avg accessibility 2.4/10_
- **[SHOULD]** Use 6+ unique background colors for palette diversity.
  _Evidence: Corpus median: 6 unique backgrounds_
- **[SHOULD]** Limit consecutive same-archetype slides to <=2. Runs of 3+ reduce coherence-variance.
  _Evidence: maxConsec>=3: avg coherence 8.0 vs maxConsec<=2: avg 7.0_
- **[SHOULD]** Vary zone col starts across 8+ unique positions. Avoids monotonous left-anchoring.
  _Evidence: Corpus median: 8 unique col starts_
- **[SHOULD]** Use 2+ fonts with intentional alternation (serif/sans/mono).
  _Evidence: Corpus median: 2 fonts per deck_
- **[SHOULD]** Target ~83% of slides with accent elements. Over-accenting reduces clarity.
  _Evidence: Corpus median: 83% accent frequency_
- **[MUST]** Use >=80% light backgrounds (lightPct >= 80).
  _Evidence: 5 decks with >=80% light: avg accessibility 7.3/10_
- **[MUST]** Maintain >=3 light/dark chromatic arc crossings across the deck.
  _Evidence: 6 decks with >=3 crossings: avg color 9.7/10_
- **[MUST]** Use >=5 distinct zone archetypes (monument, sidebar-left, editorial, right-anchored, narrow-column, etc.).
  _Evidence: 6 decks with >=5 archetypes: avg grid 10.0/10_
- **[MUST]** Content completeness is the weakest dimension in the corpus. Prioritize: remove empty body zones from image-only slides, expand table zones, verify all body text has a zone.
  _Evidence: Median content score: 6/10 (lowest across dimensions)_
