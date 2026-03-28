# Design Insights

Data-driven composition guidance derived from the design corpus.
Generated: 2026-03-28 from 9 scored decks.

These rules are injected into Claude composition prompts alongside design-lessons.md.
Each rule is backed by corpus evidence (deck count, score correlation).

## Palette & Accessibility

- **Light orientation >= 80%**: avg accessibility 7.4/10 (n=7)
- **Light orientation < 60%**: avg accessibility 2.4/10 (n=2) — avoid
- **Chromatic arc >= 3 crossings**: avg color 9.8/10 (n=8)
- **Background variety**: median 6 unique backgrounds across corpus

## Grid & Zone Archetypes

- **>=5 archetypes**: avg grid 10.0/10 (n=7)
- **Consecutive same archetype >=3**: avg coherence 8.5 vs <=2: 7.0
- **Column start variety**: median 10 unique col starts

## Typography

- **Title size**: median avg 36px across corpus
- **Font variety**: median 3 fonts per deck

## Accents

- **Accent frequency**: median 83% of slides have accents
- **Most used accent types**: bar (130x), line (89x), dot (62x), block (11x)

## Content Completeness

- **Corpus median content score**: 8.7/10

## Intensity Profile Patterns

- **maximal**: avg normalized score 79% (n=9)

## Exemplar Decks

**Best**: week-2-v7 (100% — Exhibition)
  - Intensity: maximal
  - Palette: 7 bgs, 83% light
  - Archetypes: 10 unique
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
  _Evidence: maxConsec>=3: avg coherence 8.5 vs maxConsec<=2: avg 7.0_
- **[SHOULD]** Vary zone col starts across 10+ unique positions. Avoids monotonous left-anchoring.
  _Evidence: Corpus median: 10 unique col starts_
- **[SHOULD]** Use 3+ fonts with intentional alternation (serif/sans/mono).
  _Evidence: Corpus median: 3 fonts per deck_
- **[SHOULD]** Target ~83% of slides with accent elements. Over-accenting reduces clarity.
  _Evidence: Corpus median: 83% accent frequency_
- **[MUST]** Use >=80% light backgrounds (lightPct >= 80).
  _Evidence: 7 decks with >=80% light: avg accessibility 7.4/10_
- **[MUST]** Maintain >=3 light/dark chromatic arc crossings across the deck.
  _Evidence: 8 decks with >=3 crossings: avg color 9.8/10_
- **[MUST]** Use >=5 distinct zone archetypes (monument, sidebar-left, editorial, right-anchored, narrow-column, etc.).
  _Evidence: 7 decks with >=5 archetypes: avg grid 10.0/10_
