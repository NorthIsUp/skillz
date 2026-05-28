---
name: no-unnecessary-path-prefixes
description: Don't prefix shell commands with unnecessary path segments like cd when the working directory is already correct
type: feedback
---

Don't prefix commands with unnecessary path segments. This includes:

- `cd backend &&` when a `dir` parameter exists
- Absolute paths like `ls /Users/adam/src/` when `ls src` works from the current directory
- Any redundant path prefix that the working directory already covers

**Why:** User finds it cluttered and redundant — commands should be as short as possible.

**How to apply:** Before writing a command, check what the working directory already is. Use relative paths from pwd. Only add `cd` or absolute paths when actually needed. Applies to Tiltfiles, scripts, mise tasks, documentation, tool calls, and any generated shell commands.
