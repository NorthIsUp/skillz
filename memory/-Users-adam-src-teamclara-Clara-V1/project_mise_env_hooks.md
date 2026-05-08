---
name: Mise env hooks for Claude Code
description: PR #665 - SessionStart + FileChanged hooks replace PreToolUse for mise env activation
type: project
---

PR #665 (branch adam/cla-846-ensure-mise-env-is-up-to-date-for-every-command) restructures how mise environment is activated in Claude Code sessions.

**Architecture:**
- `SessionStart` hook: runs `update-mise-env.sh` once at session start (was `scripts/mise-install.sh` for install, removed to simplify)
- `FileChanged` hook: watches `mise.toml|mise.dev.toml`, re-runs `update-mise-env.sh` on changes
- Previous approach: `PreToolUse` hook on every Bash call (too frequent, slow)
- `common.sh` has `export_mise_env()` that collapses multi-line values (e.g. RSA keys) for Claude Code's line-by-line env parsing

**Key files:**
- `.claude/settings.json` - hook definitions
- `.claude/hooks/update-mise-env.sh` - thin wrapper calling common.sh
- `.claude/hooks/common.sh` - shared `export_mise_env()` function
- `scripts/mise-install.sh` - POSIX bash install script (converted from zsh)

**How to apply:** If mise env isn't working in a session, check that the SessionStart hook ran successfully. The FileChanged hook auto-refreshes when toml files change.
