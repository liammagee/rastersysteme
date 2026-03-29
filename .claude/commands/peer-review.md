# Peer Review Agent

Iterative academic peer review and refinement for the concentric loops paper. This IS the outer-outer loop: the epistemic process reviewing its own description.

## Arguments

`/peer-review` — run one review-and-refine iteration
`/peer-review --status` — show current review state
`/peer-review --converge` — loop until accept or minor revision

## How to work

### 1. Read the current state

Read these files:
- `content/papers/concentric-loops.md` — the paper source
- `paper/NOTES.md` — intellectual framing
- `paper/EVIDENCE.md` — empirical data
- `paper/review-log.md` — previous review iterations (if exists)

### 2. Review against journal criteria

You are reviewing for a design research journal (Design Studies, Design Issues, or ACM CHI). Score each criterion 1-5:

**Criteria:**
1. **Argument clarity** — Is the thesis stated precisely? Are claims scoped to evidence?
2. **Empirical grounding** — Is the evidence specific, traceable, and sufficient for the claims?
3. **Theoretical integration** — Do cited frameworks do analytical work (not just decoration)?
4. **Methodological honesty** — Are limitations addressed? Is researcher positionality acknowledged?
5. **Originality** — Does the paper contribute something new beyond "we built a system"?
6. **Related work** — Is the relevant literature engaged?
7. **Generalizability** — Are boundary conditions specified? Is the framework falsifiable?
8. **Writing quality** — Is the prose clear, the structure logical, the tone appropriate?

Score each 1-5. Compute total /40. Thresholds:
- **Accept**: >= 35/40 (all criteria >= 4)
- **Minor revision**: >= 30/40 (no criterion below 3)
- **Major revision**: >= 22/40
- **Reject**: < 22/40

### 3. Produce actionable findings

For each criterion scoring below 4, produce a specific finding:
```
FINDING: [criterion] scores [N]/5
ISSUE: [what is wrong, specifically]
FIX: [what to change in the paper, with line-level specificity]
PRIORITY: critical | important | minor
```

### 4. Apply fixes

Edit `content/papers/concentric-loops.md` to address each finding marked `critical` or `important`. Do NOT change the paper's core argument — improve how it's presented, evidenced, and bounded.

Common fixes:
- **Empirical grounding**: add data from EVIDENCE.md (7-version diversity table, splice algorithm loop, cross-version scores)
- **Methodological honesty**: add explicit limitations paragraphs
- **Related work**: add computational design evaluation references
- **Generalizability**: add boundary conditions for fractal design
- **Theoretical integration**: make decorative references do analytical work or remove them
- **Goodhart precision**: distinguish construct validity failure from Goodhart dynamics

### 5. Re-evaluate

After applying fixes, re-score all criteria. Record the delta.

### 6. Log the iteration

Append to `paper/review-log.md`:
```
## Iteration N — [date]
Scores: [list]
Total: X/40 → Y/40
Recommendation: [accept/minor/major/reject]
Fixes applied: [list]
Key insight: [what the iteration revealed about the paper]
```

### 7. Convergence check

If recommendation is "accept" or "minor revision" with all criteria >= 4:
- Stop iterating
- Report final scores
- Note what the review process itself revealed (the meta-loop)

If not converged and iteration < max:
- Continue to next iteration

### Rules

- Each iteration must improve the total score by at least 1 point, or stop (diminishing returns)
- Never invent evidence — only use data from EVIDENCE.md and the codebase
- Never change the paper's core thesis or the fractal design concept
- Do add: limitations, boundary conditions, related work, precision in theoretical claims
- Do tighten: Goodhart usage, RLHF analogy caveats, design theory integration
- The review process IS itself a concentric loop — note this in the log

ARGUMENTS: $ARGUMENTS
