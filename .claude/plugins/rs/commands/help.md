---
name: help
description: "Context-aware skill navigator -- scans deck state, shows relevant skills grouped by intent, and suggests next steps. The entry point for the rastersysteme toolkit."
user_invocable: true
---

# Rastersysteme Skill Navigator

When the user runs `/rs:help` (or `/rs:help <topic>`), scan the project state and present a context-aware guide to available skills.

## Arguments

`/rs:help` -- full navigator with deck state + skill guide
`/rs:help compose` -- deep help on a specific skill
`/rs:help "I have markdown, what now?"` -- intent-based routing

## How to work

### Step 1: Scan deck state (always)

Run these checks quickly (no heavy processing):

```bash
# Source content
ls content/week-*/

# Composed decks
ls decks/*.composed.md 2>/dev/null

# Rendered HTML
ls decks/week-*.html 2>/dev/null

# Spliced (image-merged) HTML
ls decks/*.spliced.html 2>/dev/null

# Scores / evaluations
ls decks/*.scores.json 2>/dev/null

# Comparison runs
ls -d decks/compare-* 2>/dev/null | tail -3

# Design systems
ls design-systems/*.json 2>/dev/null
```

Build a state map like:

```
week-1: source + 6 composed + 12 html + 2 spliced
week-2: source + 5 composed + 8 html + 3 spliced
```

### Step 2: Route by argument

**If no argument** (bare `/rs:help`): show the full navigator (Step 3).

**If argument matches a skill name** (e.g., `/rs:help compose`): read that skill's `.md` file from `.claude/plugins/rs/commands/` or `.claude/commands/` and present a concise usage summary: what it does, arguments, example invocation, and when to use it vs alternatives.

**If argument is a question or intent** (e.g., "I want to improve my deck"): match against the intent map below and recommend 1-2 skills with rationale.

### Step 3: Full navigator output

Print this structure, **but only show sections relevant to the user's current state**. If they have no source markdown, don't show editing skills. If they have no rendered HTML, don't show QA skills.

#### Header: Deck inventory

```
Decks in project:
  week-1  source -> 6 composed -> 12 html (2 spliced)
  week-2  source -> 5 composed ->  8 html (3 spliced)
```

#### Skill groups (show all, highlight applicable ones)

Format as a clear table with groups. Mark skills that apply to the current state with an indicator.

**Start here** (have source markdown, want a deck):

| Skill | What it does | Use when |
|-------|-------------|----------|
| `/rs:compose` | Assign design directives to slides | You want control over composition settings |
| `/rs:build-deck` | Full pipeline with auto-convergence | You want one command, hands-off |
| `/rs:compare` | Try 3-12 variants side by side | You want to explore before committing |

**Render & output** (have composed markdown):

| Skill | What it does | Use when |
|-------|-------------|----------|
| `/rs:render` | Rebuild HTML from composed markdown | After editing directives |
| `/rs:export` | PDF or PPTX | Final delivery |
| `/rs:splice-images` | Merge AI images into deck | After `/rs:imagine` or manual image generation |

**Edit slides** (have composed markdown):

| Skill | What it does | Use when |
|-------|-------------|----------|
| `/rs:edit-slide` | Change one slide's content or design | Targeted fix |
| `/rs:insert-slide` | Add a slide at position | Missing content |
| `/rs:delete-slide` | Remove slide(s) | Cutting content |
| `/rs:diff` | Compare two deck versions | Before/after review |

**Quality & scoring** (have rendered HTML):

| Skill | What it does | Use when |
|-------|-------------|----------|
| `/evaluate` | Score against 8-dimension rubric | Baseline measurement |
| `/rs:qa-visual` | Accessibility + design audit in Chrome | Visual inspection |
| `/rs:qa-fix-loop` | Auto audit-fix-verify cycle | Hands-off cleanup |

**Improve design** (have scores, want higher):

| Skill | What it does | Use when |
|-------|-------------|----------|
| `/design` | Edit directives targeting weak dimensions | Manual, targeted |
| `/refine-loop` | Auto evaluate-improve-render loop | Hands-off convergence |

**View & present** (have rendered HTML):

| Skill | What it does | Use when |
|-------|-------------|----------|
| `/rs:preview` | Open in Chrome, browse slides | Quick look |
| `/rs:studio` | Full presentation mode + grid + QA | Presenting or deep review |
| `/rs:pace` | Add timing cues to speaker notes | Preparing to present |

**Images** (have source or composed markdown):

| Skill | What it does | Use when |
|-------|-------------|----------|
| `/rs:imagine` | Generate image prompts with visual thread | Need images for the deck |
| `/rs:splice-images` | Place images into rendered HTML | Have images, need placement |

**Design systems & batch**:

| Skill | What it does | Use when |
|-------|-------------|----------|
| `/rs:design-system` | List, preview, generate, apply design systems | Exploring visual themes |
| `/rs:batch` | Run any skill across multiple decks | Bulk operations |
| `/rs:promote` | Triage untracked scripts | Codebase hygiene |

**Corpus & analysis**:

| Skill | What it does | Use when |
|-------|-------------|----------|
| `/audit` | Extract fingerprints, evaluate, synthesize insights | Cross-deck learning |

#### Suggested next steps

Based on the deck state, suggest 1-3 concrete next actions. Examples:

- "week-2 has composed markdown but no HTML yet -> `/rs:render decks/week-2.composed.md`"
- "week-1-fresh.html has no scores -> `/evaluate decks/week-1-fresh.html`"
- "week-1 has 12 HTML variants but no comparison -> `/rs:compare content/week-1/week-1.md`"
- "No images for week-2 -> `/rs:imagine content/week-2/week-2.md`"

Pick the most useful suggestions, not all of them. Prioritize gaps in the pipeline.

### Intent map (for question-based routing)

| User intent | Recommended skill(s) |
|------------|----------------------|
| "I have markdown, make it a deck" | `/rs:build-deck` (hands-off) or `/rs:compose` (control) |
| "Improve my deck" | `/evaluate` first, then `/design` or `/refine-loop` |
| "Check quality" | `/evaluate` (scores) or `/rs:qa-visual` (visual audit) |
| "Add/fix a slide" | `/rs:edit-slide` or `/rs:insert-slide` |
| "Need images" | `/rs:imagine` then `/rs:splice-images` |
| "Compare versions" | `/rs:compare` (new variants) or `/rs:diff` (existing versions) |
| "Present this" | `/rs:studio` (full mode) or `/rs:preview` (quick browse) |
| "Export for delivery" | `/rs:export --pdf` or `/rs:export --pptx` |
| "Run everything at once" | `/rs:batch all --week N` |
| "What design systems exist?" | `/rs:design-system list` |
| "Clean up temp scripts" | `/rs:promote` |
| "Learn from past decks" | `/audit` |

### Key disambiguation

When the user seems unsure between two skills, clarify the overlap:

- **compose vs build-deck**: `compose` gives you one composed output you control. `build-deck` runs compose + render + evaluate + fix in a loop until it converges. Use compose for iteration, build-deck for hands-off.
- **qa-visual vs qa-fix-loop**: `qa-visual` reports issues. `qa-fix-loop` reports AND fixes them automatically. Use qa-visual to understand problems, qa-fix-loop to just fix them.
- **preview vs studio**: `preview` is a quick slide browser. `studio` adds grid overview, QA panel, and speaker notes. Use preview for a quick glance, studio for serious review.
- **design vs refine-loop**: `design` makes one pass of targeted improvements. `refine-loop` runs evaluate+design+render in a loop until scores plateau. Use design for surgical changes, refine-loop for automation.
- **evaluate (command) vs qa-visual (plugin)**: `evaluate` runs the rubric (numeric scores across 8 dimensions). `qa-visual` is a visual Chrome audit (contrast, overflow, fonts). They complement each other.

## Formatting rules

- Keep output scannable -- tables over paragraphs
- Bold the skill names so they stand out
- Use the full invocation form (`/rs:compose`, not just `compose`) so users can copy-paste
- If showing example invocations, use actual file paths from the scan (not placeholders)
- Don't show skills for stages the user hasn't reached unless they ask
