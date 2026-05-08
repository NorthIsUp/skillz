---
name: Use git -C and separate Bash calls to avoid permission prompts
description: Avoid cd && git in one command; use git -C or separate Bash calls so each is auto-approved
type: feedback
---

Use `git -C /path` instead of `cd /path && git ...` in a single Bash call. Or use separate Bash tool calls.

**Why:** Combined `cd && git` commands trigger permission prompts in don't-ask mode. Separate calls or `git -C` each get auto-approved individually.

**How to apply:** For git operations outside the working directory, prefer `git -C /path/to/repo <command>`. For other cases, split into separate Bash calls.
