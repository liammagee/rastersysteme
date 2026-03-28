---
name: audit
description: "Outer-outer loop: Review all deck progress, verify skills/rubric/eval have learned from the corpus. Closes the self-improvement loop."
user_invocable: true
effort: high
---

# Audit (Outer-Outer Loop)

Full corpus review: scan decks, synthesize insights, and **verify the system has learned**.

This is the outer-outer loop — it checks not just the decks, but whether the rubric, skills, and composition pipeline have incorporated lessons from previous iterations.

## Arguments

`/rs:audit`                              — full cycle: scan, synthesize, report
`/rs:audit decks/week-2-v3.html`         — audit a single deck
`/rs:audit --eval`                       — also run rubric-eval on unscored decks
`/rs:audit --report`                     — only print report from existing corpus

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

### 4. Learning verification (outer-outer loop)

Check that the system has actually learned from the corpus:

**a) Rubric evolution check:**
- Read RUBRIC-CHANGELOG.md — does the rubric address the weak dimensions found in step 3?
- Are there corpus patterns (e.g., "table slides always score low on content") that the rubric doesn't yet catch?
- Flag rubric blind spots: dimensions that are consistently low across decks but not improving

**b) Composition learning check:**
- Read design-insights.md — do the MUST/SHOULD rules match what the corpus data shows?
- Run a test: compose a simple slide set and check if the design directive follows the corpus rules
- Flag stale rules: insights that no longer match the latest corpus data

**c) Skill alignment check:**
- Read compose.md, evaluate.md, refine-step.md — do the skill instructions reflect current rubric?
- Are new rubric dimensions (zone collisions, visual utilization, typography hierarchy) mentioned in the relevant skills?
- Flag skill drift: skills referencing old rubric formulas or missing new checks

**d) Report learning gaps:**
For each gap found, create a tracking item:
- "Rubric doesn't penalize X, but corpus shows X correlates with low scores"
- "Compose skill doesn't mention Y, but rubric checks for Y"
- "Design-insights.md says Z, but latest corpus data contradicts Z"

### 5. Optional: targeted improvements

If the user wants to improve specific decks based on audit findings:
- Suggest running `/design <deck.composed.md>` on low-scoring decks
- Or `/refine-loop <deck.html>` for autonomous improvement
- The corpus insights will automatically inform the next `/rs:compose` run

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
