---
name: uat
description: "Outer loop: Run user acceptance testing — screenshot every slide, compare wireframes, generate HTML checklist for human review."
user_invocable: true
effort: medium
---

# User Acceptance Test (Outer Loop)

Run the structured outer loop: screenshot every slide, generate wireframes, run visual audit, produce an HTML checklist for human review.

## Arguments

`/rs:uat decks/week-2-v11.spliced.html`
`/rs:uat decks/week-4-workshop.html --composed decks/week-4-workshop.composed.md`

## How to work

### 1. Run the UAT runner

```bash
node run-uat.js <deck.html>
```

This orchestrates:
1. Screenshot every slide (via rubric-headless --screenshots-all)
2. Generate wireframes (via wireframe.js)
3. Run visual audit (via visual-audit.js)
4. Run rubric evaluation
5. Generate HTML checklist: `<deck>.uat.html`

### 2. Present to user

Open the UAT checklist in Chrome. It shows:
- Rubric scores summary
- Each slide: screenshot (left) + wireframe (right)
- Visual audit issues per slide (critical/warning)
- Pass/fail checkbox (auto-unchecked for critical issues)
- Notes textarea for user comments

### 3. Collect feedback

Ask the user to review the checklist. For each failed slide:
- What's wrong? (overlapping text, missing image, empty space, etc.)
- Which rubric dimension should catch this?
- How severe? (blocks presentation / looks bad / minor)

### 4. Act on feedback

For each user-flagged issue:
1. Check if the rubric scored that dimension > 8 for the failing slide
2. If yes: **rubric blind spot** — add a check to catch this issue
3. If no: the rubric caught it but the inner loop didn't fix it — re-run refinement
4. Update RUBRIC-CHANGELOG.md with the feedback entry

### 5. Acceptance criteria

The deck passes UAT when:
- All automated dimensions >= 9/10
- Zero visual-audit critical issues
- Zero user-flagged failures
- Wireframe matches screenshot for every slide (no content routing mismatches)

After 3 consecutive UAT passes with zero new issues, the deck is accepted.
