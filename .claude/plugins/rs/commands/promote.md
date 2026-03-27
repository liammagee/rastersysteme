---
name: promote
description: Triage untracked scripts — classify as reusable tools or one-off hacks, then promote keepers into the codebase or delete throwaways.
user_invocable: true
---

# Promote Scripts

Scan for untracked scripts in the project root, classify each one, and either promote it into the codebase or clean it up.

## Arguments

`/rs:promote` — scan and triage all untracked .js files
`/rs:promote brief-extract.js` — promote a specific file

## How to work

### 1. Discover untracked scripts

Run `git ls-files --others --exclude-standard '*.js'` in the project root. Ignore files in `node_modules/`, `decks/`, `design-systems/`, and `master-sets/`.

Report the list to the user.

### 2. Classify each script

For each untracked script, read it and determine:

| Field | Description |
|-------|-------------|
| **Purpose** | What the script does (1 line) |
| **Type** | `tool` (reusable, parameterized) or `one-off` (hardcoded paths, specific slide numbers, single-use fix) |
| **Duplication** | Does it overlap with committed files? Check especially: `raster.js`, `compose.js`, `qa.js`, `qa-html.js`, `compare.js`, `rubric-headless.js`, `imagine.js`, `splice-images.js`, `pipeline.js` |
| **Quality** | Is it complete? Are there stubbed-out functions, TODOs, malformed code? |
| **Dependencies** | What does it require? (puppeteer, jsdom, chalk, etc.) |

Signals of a **one-off hack**:
- Hardcoded file paths or slide numbers
- No CLI argument parsing
- Incomplete/stubbed functions
- Comment like "quick fix" or "test this"
- Duplicates existing committed tool with less functionality

Signals of a **reusable tool**:
- Accepts arguments or has a clear API
- Unique functionality not in the codebase
- Complete implementation
- Could be called from other scripts or the CLI

### 3. Present the triage

Show a table:

```
| File | Type | Duplication | Action |
|------|------|-------------|--------|
| brief-extract.js | tool | None | Promote |
| fix-layout.js | one-off | apply-css-fixes.js | Delete |
```

Ask the user to confirm before proceeding.

### 4. Promote keepers

For each file marked "Promote":

1. **Read the script** thoroughly
2. **Check if it should merge into an existing module** — e.g., if it adds evaluation logic, could it be a new exported function in `compare.js` or `qa.js`?
3. **If standalone**: Keep as its own file, but ensure it has:
   - A proper shebang (`#!/usr/bin/env node`)
   - A `--help` flag
   - CLI argument parsing (at minimum)
   - `module.exports` for key functions
   - Consistent chalk output style (matching project conventions)
4. **If mergeable**: Extract the key function(s) and add them to the appropriate module. Delete the standalone script.
5. **Add to CLAUDE.md** key files table if it's a new standalone tool.

### 5. Clean up throwaways

For files marked "Delete":
- Delete the file
- If it contained a useful technique or lesson, note it briefly (but don't save it as a memory — the technique lives in git history)

### 6. Commit

Stage all changes and commit with a message like:
```
Promote reusable scripts, clean up one-off experiments
```

### When to use this skill

- After a session of experimentation that produced temp scripts
- When `git status` shows many untracked `.js` files
- Periodically as codebase hygiene
