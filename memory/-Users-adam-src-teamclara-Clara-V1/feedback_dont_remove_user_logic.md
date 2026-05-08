---
name: Don't remove user logic from scripts
description: When cleaning up or rewriting user scripts, preserve all functional lines - don't silently drop logic that wasn't explicitly discussed for removal
type: feedback
---

When rewriting a user's script (e.g., to remove debug logging), preserve all functional lines. I removed the `CLAUDE_ENV_FILE` export from the SessionStart hook when "cleaning up" debug logging, which broke the PreToolUse hook that depended on it.

**Why:** The user had added that line intentionally. Removing it without discussion broke the chain between SessionStart and PreToolUse hooks.

**How to apply:** When simplifying or cleaning up a script, only remove the specific things discussed (e.g., debug logging). Keep all other logic intact, even if its purpose isn't immediately obvious.
