---
name: fnox-env plugin shim recursion + env override bug (fixed locally)
description: fnox-env plugin had two compounding bugs (shim recursion + env override); both fixed via local commit, not pushed upstream
type: project
originSessionId: eb96a749-80ae-453b-82c4-cadc6078ffee
---

The `fnox-env` mise plugin (`NorthIsUp/mise-env-fnox`, `feat/lease-credentials`) had two compounding bugs that surfaced together when `fnox.toml` uses `type = "pulumi-esc"` leases:

**Bug 1 - Shim recursion (5s+ hang):** `resolve_fnox_bin()` preferred `~/.local/share/mise/shims/fnox`. Running the shim re-triggered mise env resolution -> re-invoked fnox-env -> called shim -> loop. Tail: `warning: shims/fnox config-files failed: signal 15 (SIGTERM)` repeated.

**Bug 2 - Env override:** `cmd.exec(command, {env = {PATH = fnox_dir..":"..PATH}})` REPLACED the subprocess env (not merged). Subprocess lost HOME, so `esc` CLI couldn't read `~/.pulumi/credentials.json`. Error: `Configuration error: esc CLI not found` or `Pulumi ESC credentials not found`.

**Applied fix (2026-04-21, commit `b16e2fc` local only):** Edited `~/.local/share/mise/plugins/fnox-env/hooks/mise_env.lua`:

- Dropped `resolve_fnox_bin()` entirely
- Dropped `exec_opts = {env = {PATH = ...}}`
- `fnox_bin` defaults to literal `"fnox"`, resolved via injected PATH from `tools=true`
- Subprocess inherits full parent env -> HOME available -> esc finds creds

Tested: `mise env` 5.2s (hung) -> 0.18s (clean). All secrets exported correctly. 0 warnings after `esc login`.

**Upstream status:** Commit `b16e2fc` is LOCAL only. Branch still tracks `origin/feat/lease-credentials`; `git status` is NOT clean now (1 commit ahead). Needs `git push` to NorthIsUp remote.

**Why it works now:** mise 2026.4.9+ [PR #9011](https://github.com/jdx/mise/pull/9011) stabilized `tools=true` PATH injection for env modules. Empirically confirmed in mise 2026.4.18. The 2026-04-08 workaround is no longer needed.

**Debugging signatures:**

- Hangs + `signal 15 (SIGTERM)` on `shims/fnox config-files` -> shim recursion. Fix: this plugin commit, or pass `fnox_bin = "<absolute path>"` in mise.esc.toml as a workaround.
- `esc CLI not found` / `Pulumi ESC credentials not found` after `esc login` -> env override nuked HOME. Fix: this plugin commit.
- `unknown variant pulumi-esc` from `fnox::commands::hook_env` -> stale `_fnox_hook` in shell. Fix: `eval "$(fnox activate zsh)"`.
