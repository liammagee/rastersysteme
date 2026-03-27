---
name: chrome-keepalive
description: Internal utility — keeps Chrome extension connection alive during long operations by pinging tabs_context periodically.
---

# Chrome Keepalive

Chrome's MCP extension connection drops after ~30s of inactivity. This is caused by idle timeouts across multiple layers (MCP protocol: 60s, Chrome DevTools MCP navigation: 30s, OS WebSocket: variable). None of these are currently user-configurable through settings files.

## Reconnect-on-demand (preferred pattern)

Rather than keeping Chrome alive during long operations, **reconnect when you need it**. This is more reliable than periodic pinging because:

- Long operations (imagine --generate, compose, refine-loop) can run 5-20 minutes
- Pinging every 20s for 20 minutes wastes tool calls and can still miss
- The connection recovers cleanly if you call `tabs_context_mcp` before any Chrome interaction

### Pattern

```
// 1. Start long operation in background
Bash({ command: "node imagine.js ...", run_in_background: true })

// 2. Do other work or wait for completion notification
//    Do NOT try to keep Chrome alive during this time

// 3. When ready for Chrome, reconnect:
tabs_context_mcp()          // re-establishes connection, gets tab IDs
navigate({ url, tabId })    // use fresh tab ID from step 3
```

### Rules

- **Always call `tabs_context_mcp()` before any Chrome tool** after a gap of >20 seconds
- **Never reuse stale tab IDs** from before a long operation — get fresh ones
- **If any Chrome tool returns "extension not connected"**, call `tabs_context_mcp()` and retry once
- **If retry also fails**, the extension may need manual restart in the browser — inform the user

## Active keepalive (when Chrome must stay connected)

Only use this when Chrome is actively needed throughout a long operation (e.g., multi-slide QA-fix-loop with screenshots between each fix). For most workflows, reconnect-on-demand above is better.

1. Run the long command with `run_in_background: true`
2. While waiting, ping Chrome every 20 seconds:

```
mcp__claude-in-chrome__tabs_context_mcp
```

3. When the background command completes, stop pinging.

## Timeout architecture (reference)

| Layer | Default | Source |
|-------|---------|--------|
| MCP Protocol | 60s | `@modelcontextprotocol/sdk` `DEFAULT_REQUEST_TIMEOUT_MSEC` |
| Chrome DevTools MCP navigation | 30s | `chrome-devtools-mcp` `DEFAULT_TIMEOUT` |
| Tool execution (page interaction) | 5s | `McpContext.js` `setDefaultTimeout` |
| WebSocket transport | OS-managed | No explicit config |

The 30s navigation timeout is the most likely cause of drops during idle periods. A feature request for configurable `idleTimeout` in Claude Code MCP server settings would be the proper fix.

## When this matters

- `/imagine --generate` (30-60s per image, 20-40 min total)
- `/compose --incremental` (60-300s)
- `/compare` (120-600s)
- `/refine-loop` iterations (60-120s each)
- Any Bash command with `run_in_background: true`
