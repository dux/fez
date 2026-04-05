#!/usr/bin/env bash
#
# claude-expert - Calls Claude Opus via CLI for deep reasoning
#
# Usage: This script is called with a prompt as stdin or as the first argument
# It passes the prompt to Claude CLI with the opus model and returns the response
#

set -e

# Get the prompt - either from first argument or stdin
if [ -n "$1" ]; then
  PROMPT="$1"
else
  PROMPT=$(cat)
fi

# Default model
MODEL="${CLAUDE_MODEL:-opus}"

# Call Claude with the prompt
# Using --print for non-interactive output
# Adding max tokens for comprehensive reasoning
claude --model "$MODEL" --print "$PROMPT"
