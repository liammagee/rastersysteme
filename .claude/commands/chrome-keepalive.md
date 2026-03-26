---
name: chrome-keepalive
description: Internal utility — keeps Chrome extension connection alive during long operations by pinging tabs_context periodically.
---

# Chrome Keepalive

When running long operations (compose, compare, imagine) that take >30 seconds, Chrome's MCP connection drops because nothing pings the extension.

## How to use

Before starting a long Bash command, start a background keepalive:

1. Run the long command with `run_in_background: true`
2. While waiting, ping Chrome every 20 seconds:

```
mcp__claude-in-chrome__tabs_context_mcp
```

3. When the background command completes, stop pinging.

## Integration with skills

Any skill that runs a long Bash command (compose, compare, imagine, refine-loop) should:

1. Start the Bash command in background
2. Loop: ping Chrome → wait 20s → check if command finished
3. When done, proceed with Chrome-based verification

Example pattern:
```
// Start long operation
Bash({ command: "node compose.js ...", run_in_background: true })

// Keep Chrome alive while waiting
while (command not finished) {
  tabs_context_mcp()  // ping
  wait 20s
}

// Now Chrome is still connected for screenshots
computer({ action: "screenshot" })
```

## When to use

- `/compose` with `--incremental` (60-300s)
- `/compare` (120-600s)
- `/imagine --generate` (30-60s per image)
- `/refine-loop` iterations (60-120s each)
