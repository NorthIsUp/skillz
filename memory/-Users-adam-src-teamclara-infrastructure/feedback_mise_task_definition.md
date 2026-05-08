---
name: Mise tasks — file-based, no double definition
description: Don't add a [tasks.X] block in mise.toml when the task is a file under mise_tasks/ already auto-included
type: feedback
originSessionId: d1a35c46-7463-457f-b818-902ae7688a85
---
When `mise.toml` has `[task_config] includes = ["mise_tasks/*"]`, every script under `mise_tasks/` is automatically a mise task. Don't also add a `[tasks."name"]` block in `mise.toml` pointing at the same file.

**Why:** It's redundant and misleads about how mise works. The file's filename IS the task name (e.g., `mise_tasks/keys-rotate` → `mise run keys-rotate`). Description/usage come from `#MISE description=` and `#USAGE` headers in the file itself, not from the toml block.

**How to apply:**
- Task directory must be `mise-tasks/` (hyphen) for auto-discovery — `mise_tasks/` (underscore) is NOT in mise's default search paths and won't be picked up without an explicit `task_config.includes`.
- New task → drop a script in `mise-tasks/<name>` with `#!/usr/bin/env -S usage bash`, `#MISE description="..."`, `#USAGE arg "..."` headers. Done.
- Don't write `[tasks."<name>"] run = "mise_tasks/<file>"` blocks unless you need to alias a different command (rare).
- Existing `[tasks.X]` blocks in mise.toml that just re-point to a file are also redundant — note this when touching the file but don't unilaterally remove pre-existing ones unless asked.
- Task name = filename. To get a colon in the name (e.g., `infra:up`), name the file with the colon (most filesystems support it) or live with hyphen.
