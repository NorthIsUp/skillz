---
description: Declare mise task CLI args with bracketed usage specs, never hand-parse argv
alwaysApply: true
---

# Mise task CLI args — always usage-based

Every mise task declares its CLI interface with bracketed `# [USAGE]` spec
lines and reads parsed values from `usage_<name>` env vars. Never parse argv
by hand: no `case`/`shift` loops, no `getopts`, no `argparse`, no
`sys.argv`, no bare `$1`/`$2`. This works in every task — `usage_*` env vars
populate even with `# [MISE] raw = true` (verified mise 2026.7.2).

## Push validation into the spec, not the script

- **Required** → `flag "--env <env>" required=#true` or `arg "<name>"`
  (angle brackets = required). No manual `[ -z ... ]` or `${var:?}` guards —
  usage rejects before the script runs.
- **Closed enums** → a `choices` block; delete the now-dead `*)` case
  branches. Not usable for open patterns (e.g. `dev-*` env wildcards — keep
  script validation there).

  ```bash
  # [USAGE] flag "--format <format>" default="tui" help="Output format" {
  # [USAGE]   choices "tui" "plain" "github"
  # [USAGE] }
  ```

- **Defaults** → `default="..."` on the spec; the env var is then always
  set, so don't re-default in the script (`${usage_timeout}`, not
  `${usage_timeout:-300}`).
- **Env-var fallback** → `env="VAR"` on the flag (precedence: explicit flag
  > env var > default). Never hand-roll `${usage_x:-${VAR:-}}` chains.
  KDL booleans are `#true`, never `"true"`.

## Multi-value args

- Repeatable value flag: `flag "--job <name>" var=#true`. Variadic
  positional: `arg "[files]..."`. Both arrive space-joined and
  shell-quoted in one env var — split with `shlex.split()` in Python or
  `eval "arr=( ${usage_files:-} )"` in shell, never plain word-splitting.
- Pure passthrough to an underlying tool (`pytest "$@"`, `pulumi up "$@"`)
  stays `"$@"` — forcing it through usage loses quoting fidelity for args
  like `-k "a and b"`.

## Hygiene

- **Descriptions drive discoverability.** Every task gets a specific
  `# [MISE] description = "..."` — it's how humans (`mise tasks --local`),
  agents (the mise MCP server's task list), and `--help` find the task.
  Say what it does and any non-obvious scope (e.g. "matches CI",
  "default: staging"), not a vague label; per-flag `help=` strings carry
  the rest of the interface.
- Task files must be executable (`chmod +x`) or mise silently skips them.
- `--help` should render the whole interface, including
  `[possible values: ...]` and `[env: ...]`.
