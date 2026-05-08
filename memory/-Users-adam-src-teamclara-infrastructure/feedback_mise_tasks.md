---
name: Mise task preferences
description: All mise tasks must be executable zsh scripts in mise_tasks/ using usage CLI for arg parsing
type: feedback
---

All mise tasks MUST be executable scripts in `mise_tasks/` directory. Never put task logic inline in `mise.toml`.

- Shebang: `#!/usr/bin/env usage zsh` (uses `usage` CLI for arg parsing)
- Args: `#USAGE arg "name" help="..." { choices "a" "b" }` comments, accessed as `$usage_name`
- Metadata: `#MISE description="..."` comments
- `mise.toml` contains only thin refs: `[tasks."name"] description = "..." run = "mise_tasks/<script>"`

**Why:** User preference for all task logic in standalone scripts, not embedded in config files. `usage` provides proper arg parsing with help text and completions.

**How to apply:** When creating any new mise task, always create an executable script in `mise_tasks/` with `usage zsh` shebang and `#USAGE` arg specs for any parameters. Add a matching `[tasks."name"]` entry in `mise.toml` that just points to the script.
