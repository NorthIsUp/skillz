---
name: Use ~/tmp for temp files
description: Write temp files to ~/tmp instead of /tmp to avoid permission prompts on recreation
type: feedback
---

Use `~/tmp/` instead of `/tmp/` for temporary files.

**Why:** Writing to `/tmp/` then deleting triggers permission prompts every time the file is recreated. `~/tmp/` avoids this.

**How to apply:** When you need a scratch file (e.g., YAML for `esc env edit -f`), write to `~/tmp/filename`. The directory exists. Do not clean up files there aggressively - leaving them avoids permission re-prompts.
