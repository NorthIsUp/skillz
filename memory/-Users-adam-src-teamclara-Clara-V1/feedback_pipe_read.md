---
name: Use pipe read instead of command substitution
description: When running shell commands, prefer `cmd | read VAR` over `VAR=$(cmd)` for capturing values
type: feedback
---

Use `| read` instead of `$()` when capturing command output in bash tool calls.

**Why:** User preference for readability and consistency.
**How to apply:** When running shell commands that capture output into variables, pipe into `read` instead of using command substitution.
