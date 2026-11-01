---
name: ruthless-mise
description: |
  Standing rules for mise: installing tools, task files, env vars and
  secrets, profiles and per-worktree overrides. Use whenever adding a
  tool, writing or editing a mise task or `mise.toml`, wiring a secret or
  env var into a script, running a repo's build/test/lint commands, or
  debugging "works locally, fails in CI". Also fires for "install X",
  "add a task", "make this a script", "where does this env var come from",
  and "pin the version".
paths:
  - "**/mise.toml"
  - "**/mise.*.toml"
  - "**/.mise.toml"
  - "**/.config/mise/config.toml"
  - "**/mise-tasks/**"
---

# Ruthless mise

The standing bar for mise in every repo. mise is the tool installer, the
task runner and the env/secret manager, one place for all three, so a
command behaves the same in Adam's shell, an agent's `mise run`, and CI.
The rules come from Clara_V1, homelab-gitops, free-return, tty7, PixKidz and
Flying Colors. Task args have their own skill: `skillz:mise-task-args`. hk,
the lint gate mise installs, is `skillz:ruthless-hk`.

## The bar

- **Rule 1 — mise installs every tool.** `mise use <tool>` for a project's `mise.toml`, `mise use -g <tool>` for a machine-wide one. Never `brew install`, `npm i -g`, `pipx install`, `curl | bash` or a vendor installer. When the registry has nothing (`mise registry | rg <name>`, `mise search <name>`), use an `aqua:`, `ubi:`, `github:` or `http:` backend. A tool installed any other way is invisible to CI and teammates and drifts silently.
- **Rule 2 — CI only has what `mise.toml` pins, so reproduce it that way.** A lint or test that passes locally can be using a global binary CI doesn't have. Before claiming "works locally", check `mise which <tool>` (an error means it's global only), or run with a mise-only PATH: `env -i HOME="$HOME" PATH="$(mise bin-paths | tr '\n' ':')/usr/bin:/bin" <cmd>`.
- **Rule 3 — Tasks are executable files in `mise-tasks/`.** `mise-tasks/<name>` (subfolders become `group:name`), `chmod +x`, a `#MISE description=` that says what it does, `#MISE depends=[...]` for ordering. `mise.toml` keeps `[tools]`, `[env]` and `[settings]` only. File tasks pass extra args straight through as `"$@"`, so there's no `-- --`. A task file that isn't executable is skipped without a word. Shebang `#!/usr/bin/env zsh`, unless the repo's tasks are already bash.
- **Rule 4 — A sequence run twice becomes a task, and the task is how it runs.** Build + sign + install, tag + push, the local test invocation with its env (`PGHOST=localhost mise run test:backend`): the second time is the time to write it down. After that, always go through the task, and when it's missing a step you keep adding by hand, fix the task.
- **Rule 5 — mise is the env and secret manager.** A script reads config and credentials from its environment, and mise puts them there. Non-secret config (a host, a site name) goes in `[env]`, committed, with a comment naming what it points at. Secrets come from Adam's store through a mise env plugin (fnox): never committed, never fetched with `op` from inside the script, never echoed. A script that's missing vars fails with a named error listing them. `mise env | grep <PREFIX>` shows what a task will see.
- **Rule 6 — Overrides go in gitignored layers, not edits to `mise.toml`.** Per-worktree or per-machine values (a `CARGO_TARGET_DIR` outside the worktree, a local port) go in `mise.local.toml`. A toolchain that only some workflows need goes in a profile, `mise.<env>.toml`, switched on with `MISE_ENV` (Clara_V1: `MISE_ENV=hk,dev` loads `mise.hk.toml` with the pinned hk and pkl). An unset profile shows up as a stale global tool, not as an error.
- **Rule 7 — One-off versions run through `mise x`, not global config.** `mise x talosctl@1.14.0 -- talosctl ...`, `mise x aqua:yonaskolb/XcodeGen@2.44.1 -- xcodegen`. On a shared box (claramini), never change its global mise config. Pin the exact version there, because its shims have no global versions.
- **Rule 8 — Shared machine-wide behaviour lives in the global mise config in dotfiles.** For example, `RUSTC_WRAPPER=sccache` for every Rust repo, instead of per-repo copies. Never share a `target/` across worktrees: sccache shares by content hash, and a shared target dir builds against another branch's crate.
- **Rule 9 — Name the bare command.** Give the user `mise run dev`, not a `cd` plus a path prefix plus a pile of env vars. The task carries the env (Rule 5, 6).

## Anti-patterns (reject on sight)

| Smell                                                       | Replace with                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| `brew install` / `npm i -g` / `pipx install` / `curl \| sh` | `mise use [-g] <tool>`, an `aqua:`/`ubi:`/`github:` backend     |
| `[tasks.<name>]` table in `mise.toml`                       | Executable `mise-tasks/<name>` with `#MISE description=`        |
| Task that parses `$1` / `getopts` / `argparse`              | `# [USAGE]` spec, read `usage_<name>` (`skillz:mise-task-args`) |
| Task file without `+x`                                      | `chmod +x`: mise skips it silently                              |
| `.envrc`, per-script config file, `op read` in a script     | `[env]` for config; secrets injected by mise                    |
| Secret value in `mise.toml` or a committed file             | The mise secret plugin; only the var name is committed          |
| Per-worktree value edited into the committed `mise.toml`    | `mise.local.toml` (gitignored)                                  |
| Long command pasted into a README, brief or PR twice        | A `mise-tasks/` file, then `mise run <task>`                    |
| Bare `pytest` / `cargo` where the repo has a task           | `mise run test` (the task carries the env)                      |
| "Works locally" with no mise-only PATH check                | `mise which <tool>`; `env -i ... PATH=$(mise bin-paths)`        |
| Editing a shared host's global mise config                  | `mise x <tool>@<version> -- ...`                                |
| `latest` for a tool CI's result depends on                  | An exact pin (templates may start at `latest`, repos pin)       |

## Reviewing mise (PRs, diffs)

Walk the diff against the bar. For each violation, quote the line and give the replacement. Lead with the rule number ("Rule 3: `[tasks.build]` in mise.toml, move it to `mise-tasks/build`") so the author can map the feedback back to the standard.

`NorthIsUp/template-python` and `template-rust` still define tasks as `[tasks.*]` tables, which breaks Rule 3. When a repo starts from one, move the tasks into `mise-tasks/`.
