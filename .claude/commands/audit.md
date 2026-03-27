---
name: audit
description: Scan existing decks, extract design fingerprints, evaluate, and synthesize corpus insights to improve future compositions.
---

# Audit

Scan the `decks/` folder, extract design briefs/parameters from composed sources, pair with rubric scores, and synthesize data-driven insights that feed back into future composition.

## Arguments

`/audit`                              — full cycle: scan, synthesize, report
`/audit decks/week-2-v3.html`         — audit a single deck
`/audit --eval`                       — also run rubric-eval on unscored decks
`/audit --report`                     — only print report from existing corpus

## How to work

### 1. Run the deck audit

Scan all decks, extract fingerprints, load scores:

```bash
node deck-audit.js
```

Or with evaluation of unscored decks:

```bash
node deck-audit.js --eval
```

Or for a single deck:

```bash
node deck-audit.js --deck week-2-v3
```

This produces:
- **design-corpus/*.json** — one corpus entry per deck (fingerprint + scores + derived lessons)
- **design-corpus/audit-report.md** — consolidated report

### 2. Synthesize insights

Run the corpus synthesizer to extract data-driven rules:

```bash
node corpus-synthesize.js
```

This reads all corpus entries and produces:
- **design-insights.md** — structured insights file with MUST/SHOULD/CONSIDER rules
- Rules are automatically injected into `compose.js` prompts on next composition

### 3. Review and report

Read the generated files and present findings to the user:

1. Read `design-corpus/audit-report.md` for the full report
2. Read `design-insights.md` for the synthesized composition rules
3. Highlight:
   - **Tier distribution** — how many decks are Exhibition/Professional/Competent/Draft/Broken
   - **Weakest dimensions** — which rubric dimensions need the most work across the corpus
   - **Parameter-score correlations** — what design choices produce good/bad scores
   - **Exemplar decks** — best and worst, with specific parameter differences
   - **New rules** — any MUST/SHOULD rules that weren't in design-lessons.md before

### 4. Optional: targeted improvements

If the user wants to improve specific decks based on audit findings:
- Suggest running `/design <deck.composed.md>` on low-scoring decks
- Or `/refine-loop <deck.html>` for autonomous improvement
- The corpus insights will automatically inform the next `/compose` run

## Pipeline

```
decks/*.html + *.composed.md
  ↓ brief-extract.js          → design fingerprint (zones, palette, typography, accents)
  ↓ rubric-eval.js / logs/qa  → scores per dimension
  ↓ deck-audit.js             → design-corpus/*.json (fingerprint + scores + lessons)
  ↓ corpus-synthesize.js      → design-insights.md (MUST/SHOULD/CONSIDER rules)
  ↓ compose.js                → next composition uses corpus-derived rules
```

## Key files

| File | Role |
|------|------|
| `brief-extract.js` | Extract design fingerprint from composed markdown |
| `deck-audit.js` | Batch scanner: HTML → fingerprint + scores → corpus entry |
| `corpus-synthesize.js` | Cross-deck analysis → data-driven composition rules |
| `design-insights.md` | Generated insights file, read by compose.js |
| `design-corpus/` | Per-deck corpus entries (JSON) + audit report |
