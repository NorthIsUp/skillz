---
name: Prefer zsh for mise tasks
description: Use zsh (not bash) as the shell for mise task scripts
type: feedback
---

Use `#!/usr/bin/env zsh` for mise task scripts, not bash.

**Why:** User preference — zsh is the default shell on macOS and the team's standard.

**How to apply:** When creating new scripts in `scripts/mise_tasks/`, always use zsh shebangs.
