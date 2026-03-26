#!/bin/bash
# Reject Bash commands that embed multi-line programs (servers, etc.)
# Receives tool input JSON on stdin from PreToolUse hook

cmd=$(jq -r '.tool_input.command // ""')

# Block inline http servers
if echo "$cmd" | grep -q 'createServer\|http\.listen\|\.listen('; then
  echo "BLOCKED: Don't embed servers in Bash commands. Write a script file instead." >&2
  exit 2
fi

# Block background server + sleep + foreground command pattern
if echo "$cmd" | grep -q '&' && echo "$cmd" | grep -q 'sleep'; then
  echo "BLOCKED: Don't chain background processes with & + sleep. Write an orchestration script instead." >&2
  exit 2
fi

# Block lsof/kill piped combos (force-killing ports)
if echo "$cmd" | grep -q 'lsof.*xargs kill\|kill.*lsof'; then
  echo "BLOCKED: Don't force-kill port owners inline. Use a proper shutdown or a script." >&2
  exit 2
fi

# Block excessively long node -e commands (>200 chars after "node -e")
node_inline=$(echo "$cmd" | grep -oP 'node -e\s+"\K[^"]*' | head -1)
if [ ${#node_inline} -gt 200 ]; then
  echo "BLOCKED: node -e command too long. Write to a temp file and run it instead." >&2
  exit 2
fi

exit 0
