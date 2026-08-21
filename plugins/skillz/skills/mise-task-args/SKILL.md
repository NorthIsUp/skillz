---
name: mise-task-args
description: Adding or editing a mise task that takes args — use usage specs, never hand-parse argv
paths:
  - "**/mise.toml"
  - "**/.mise.toml"
  - "**/mise.local.toml"
  - "**/.mise/config.toml"
  - "**/.config/mise/config.toml"
  - "**/mise-tasks/**"
  - "**/.mise-tasks/**"
  - "**/mise/tasks/**"
  - "**/.mise/tasks/**"
  - "**/.config/mise/tasks/**"
---

# Mise task CLI args — always usage-based

A mise task that takes args declares them in bracketed `# [USAGE]` spec lines
and reads parsed values from `usage_<name>` env vars, not from argv
(`getopts`, `argparse`, `$1`). `raw = true` does not interfere — it only
rewires stdio, and `usage_*` still populates under it.

But `raw_args = true` silently turns the whole spec off: no `usage_*` vars,
and `required=#true` stops rejecting anything, so a task keeps running with
the flag unset. That is the mechanism behind the one real exception — pure
passthrough to an underlying tool (`pytest "$@"`), where a spec would lose
quoting fidelity for args like `-k "a and b"`. Use `raw_args` deliberately
for passthrough, never alongside a spec you expect to parse.

Push validation into the spec, not the script:

- `flag "--env <env>" required=#true` or `arg "<name>"` (angle brackets =
  required) — usage rejects before the script runs, so the script needs no
  presence check.
- `default="..."` means the env var is always set; don't re-default in the
  script. A valueless boolean flag is the one case that needs a script-side
  default — it is `true` when passed and unset when not, so read it as
  `${usage_verbose:-false}`.
- `env="VAR"` on a flag gives precedence `explicit flag > env var > default`.
- KDL booleans are `#true`, never `"true"`.
- A `choices` block covers closed enums only; open patterns (`dev-*` env
  wildcards) still need script validation. Every line carries the
  `# [USAGE]` prefix, closing brace included:

  ```bash
  # [USAGE] flag "--format <format>" default="tui" help="Output format" {
  # [USAGE]   choices "tui" "plain" "github"
  # [USAGE] }
  ```

- Multi-value (`flag "--job <name>" var=#true`, `arg "[files]..."`) arrives
  space-joined and shell-quoted in one env var — split with `shlex.split()`
  in Python or `eval "arr=( ${usage_files:-} )"` in shell, never plain word
  splitting.

Two things that fail quietly: a task file that isn't executable (`chmod +x`)
is skipped by mise without a word, and a task whose `# [MISE] description`
is vague or missing is unfindable in `mise tasks --local` and the mise MCP
task list. A description says what the task does plus any non-obvious scope
("matches CI", "default: staging"), not a vague label; per-flag `help=`
strings carry the rest of the interface.

Check the spec is complete by reading `--help`: it should render the whole
interface, `[possible values: ...]` and `[env: ...]` included.

Everything above is verified against mise 2026.7.15. For spec directives and
properties this rule doesn't cover, read the docs rather than guessing:
[usage spec reference](https://mise.jdx.dev/tasks/task-arguments.html#complete-usage-specification-reference),
[task arguments](https://mise.jdx.dev/tasks/task-arguments.html),
[task configuration](https://mise.jdx.dev/tasks/task-configuration.html).
