---
name: batch
description: Run a skill across all decks in batch — splice-images, qa-visual, render, compose, or any per-deck operation.
---

# Batch

Run a skill or command across multiple decks in the `decks/` folder.

## Arguments

`/batch <skill> [filter] [options]`

- First arg: the skill to run — `splice-images`, `qa-visual`, `render`, `compose`, `qa-fix-loop`, or **`all`** for the full pipeline
- Second arg (optional): filter to select which decks to process (see Filtering below)
- Remaining args: passed through to the underlying skill

### Filtering

Filters narrow which decks get processed. Multiple filter styles are supported:

| Filter | Matches | Example |
|--------|---------|---------|
| glob pattern | Shell-style wildcards | `week-1*.html`, `*.composed.md` |
| `--week N` | All decks for week N | `--week 2` matches `week-2*.html` |
| `--only <names>` | Comma-separated list of deck basenames | `--only week-1a,week-1b` |
| `--exclude <pattern>` | Remove matches from the set | `--exclude *-v[0-9]*` skips versioned decks |
| `--latest N` | Most recently modified N decks | `--latest 5` |
| `--modified` | Only decks modified since last commit | git-based filter |

Filters can be combined: `/batch render --week 1 --exclude *-radical*` renders all week-1 decks except radical variants.

When no filter is given, the default glob for the skill is used (see Discover targets below).

### Examples

```
/batch splice-images                          # splice images into all HTML decks
/batch splice-images week-1*.html             # only week-1 variants (glob)
/batch render --week 1                        # re-render all week-1 decks
/batch render --theme dark                    # re-render all with dark theme
/batch render --latest 3                      # re-render 3 most recently modified
/batch render --modified                      # re-render only decks changed since last commit
/batch qa-visual --only week-1a,week-1b       # audit specific decks
/batch qa-visual --exclude *studio*,*review*  # audit all except studio/review
/batch compose                                # compose all content/week-*/week-*.md
/batch compose --week 2                       # compose week-2 only
/batch all                                    # full pipeline: compose → render → splice for all weeks
/batch all --week 2                           # full pipeline for week-2 only
/batch all --week 2 --theme dark              # full pipeline for week-2, dark theme
```

## Steps

### 1. Discover targets

Based on the skill, find the right files using the default glob:

| Skill | Default glob | Directory |
|-------|-------------|-----------|
| `splice-images` | `*.html` (exclude `*.review.html`, `*.studio.html`, `*.audit.html`, `explorer.html`, `diff-*.html`) | `decks/` |
| `render` | `*.composed.md` | `decks/` |
| `qa-visual` | `*.html` (same exclusions as splice-images) | `decks/` |
| `qa-fix-loop` | `*.html` (same exclusions) | `decks/` |
| `compose` | `week-*.md` (the main source file per week) | `content/week-*/` |
| `all` | Each `content/week-*/` folder (runs full pipeline) | `content/` |

### 2. Apply filters

After discovering the default set, apply any user filters in this order:

1. **Glob pattern** (positional arg) — replace default glob, e.g., `week-1*.html`
2. **`--week N`** — filter to files matching `week-N` in the filename
3. **`--only <names>`** — keep only files whose basename (without extension) is in the comma-separated list
4. **`--exclude <pattern>`** — remove files matching the glob pattern from the set
5. **`--latest N`** — sort remaining files by mtime descending, keep top N
6. **`--modified`** — keep only files modified since the last git commit (`git diff --name-only HEAD`)

Show the final matched list and count. Ask for confirmation before proceeding if more than 10 files.

### 3. Run in sequence

For each target file, invoke the appropriate command. Use **subagents** where possible to parallelize independent work — but respect these constraints:

- `qa-visual` and `qa-fix-loop` need Chrome, so run **sequentially** (one tab at a time)
- `render` can run sequentially via direct `node` commands (fast, no Claude API needed)
- `splice-images` can run sequentially via `node splice-images.js` (fast)
- `compose` calls the Claude API, so run **sequentially** to avoid rate limits

For each target, run the underlying command directly:

**render:**
```bash
node raster.js <file.composed.md> <file.html> --format html [options]
```

**splice-images:**
```bash
node splice-images.js <file.html> <images-dir> --output <file.html> [options]
```
Images directory: infer from deck name (e.g., `week-1k.html` → `week-1-images/`).
Skip if no matching images directory exists.

**qa-visual:**
Run the `/rs:qa-visual` skill for each file, collecting results.

**qa-fix-loop:**
Run the `/rs:qa-fix-loop` skill for each file.

**compose:**

Discover source files by scanning `content/week-*/` for the main `week-N.md` file in each folder:
```bash
# For each content/week-N/ directory, find the source markdown:
#   content/week-1/week-1.md → compose → decks/week-1.html
#   content/week-2/week-2.md → compose → decks/week-2.html
node compose.js <source.md> decks/<name>.html [options]
```

**all (full pipeline per week):**

Runs compose → render → splice-images sequentially for each `content/week-*/` folder:

```bash
# For each content/week-N/ directory:
# 1. Compose: source markdown → composed markdown + HTML
node compose.js content/week-N/week-N.md decks/week-N.html [options]

# 2. Splice images (if a matching images dir exists)
node splice-images.js decks/week-N.html decks/week-N-images/ --output decks/week-N.html
#    Also check content/week-N/images/ and content/week-N/week-N-images/

# 3. Rebuild manifest
node build-manifest.js
```

Image directory resolution for each week:
1. `decks/week-N-images/` (primary)
2. `content/week-N/week-N-images/` (co-located with source)
3. `content/week-N/images/` (generic images folder)
4. Skip splice if none found

### 4. Track progress

Show a running tally as each deck completes:

```
Batch render: 22 decks
  [1/22] week-1.composed.md → week-1.html (40 slides) ✓
  [2/22] week-1a.composed.md → week-1a.html (40 slides) ✓
  [3/22] week-1b.composed.md → week-1b.html (40 slides) ✓
  ...
```

If a deck fails, log the error and continue to the next one. Don't stop the batch.

### 5. Report summary

```
Batch complete: render
─────────────────────────
22 decks processed
21 succeeded, 1 failed

Failed:
  week-1-radical-v2.composed.md — Error: missing layout directive on slide 12

Total time: 45s
```

For `qa-visual` batches, also show an aggregated issues summary:

```
Aggregated QA results:
  12/22 decks clean (0 issues)
  8 decks with warnings only
  2 decks with errors

Top issues:
  contrast — 34 instances across 10 decks
  overflow — 12 instances across 4 decks
```
