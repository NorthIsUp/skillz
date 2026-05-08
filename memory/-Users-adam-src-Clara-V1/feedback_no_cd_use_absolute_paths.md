---
name: Don't use cd in bash commands
description: Use absolute paths or rely on working directory instead of cd-prefixed commands
type: feedback
---

Don't prefix bash commands with `cd /path &&` when the working directory is already correct, or when absolute paths would work. The user's working directory is visible and stable.

**Why:** Unnecessary cd commands were rejected by the user. The working directory was already correct.
**How to apply:** Always check the current working directory before running commands. Use absolute paths for git commands or rely on the existing cwd.
