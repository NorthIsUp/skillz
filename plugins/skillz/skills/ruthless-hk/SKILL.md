---
name: ruthless-hk
description: |
  Standing rules for hk, the git-hook and lint runner: hk.pkl shape,
  steps, pre-commit stash behaviour, pre-push tests, and what to do when a
  hook fails. Use whenever editing `hk.pkl`, adding a linter or check,
  validating files after an edit, committing in a repo with hk, or
  debugging a hook failure. Also fires for "lint this", "validate the
  yaml", "the pre-commit hook failed", "add a check for X", and "hk
  panics".
paths:
  - "**/hk.pkl"
  - "**/mise.hk.toml"
---

# Ruthless hk

The standing bar for hk in every repo. hk is the one lint gate: the same
steps run in pre-commit, pre-push, `hk check` and CI, so a green local run
means a green CI run. The rules come from Clara_V1, Flying Colors,
free-return, homelab-gitops and skillz. hk and pkl are installed by mise
(`skillz:ruthless-mise`). Bypassing a hook: `skillz:never-no-verify`.

## The bar

- **Rule 1 — `hk check` and `hk fix` are how files get validated.** After an edit, run `hk check`. If it finds issues, run `hk fix`. Never use an ad-hoc validator (`python -c "import yaml; ..."`), a separately installed linter, or a hand-rolled list of changed files: hk computes the changed set itself (`hk check --pr` for a branch, `--all` for everything).
- **Rule 2 — Strict from the first commit.** A new repo gets its hk.pkl and `hk install` in the first commit, every linter on. Turning strictness on later means a cleanup PR nobody wants.
- **Rule 3 — hk and pkl are pinned by mise, and `hk.pkl` amends the matching release.** The `amends "package://github.com/jdx/hk/releases/download/v<X>/hk@<X>#/Config.pkl"` version tracks the pinned hk. Version skew looks like a broken hook: `unexpected argument '--from-hook'`, or `install pkl cli to use pkl config files`. Those mean the pin or the mise profile isn't loaded (Clara_V1: `MISE_ENV=hk,dev git commit`). They never mean the hook should be skipped.
- **Rule 4 — One `linters` mapping, four hooks.** Define the steps once as `local linters = new Mapping<String, Step> {...}`.
  - `pre-commit`: `stash = "git"`, and `fix = true` unless the repo is check-only.
  - `pre-push`: `...linters` plus the test suite as a step with `exclusive = true`.
  - `fix`: `fix = true`.
  - `check`: the plain steps.
  - Use `Builtins.<tool>` where one exists, and override only `glob` or `check`.
- **Rule 5 — Every tool a step calls is a mise tool.** CI's PATH is `mise bin-paths` plus the system. A step that calls a globally installed binary passes on Adam's machine and fails in CI (`skillz:ruthless-mise` Rule 2).
- **Rule 6 — Respect `stash = "git"`: it stashes every unstaged and untracked file.**
  - One worktree per agent. Another agent's in-progress files get stashed and never come back.
  - Keep build output out of the worktree, or gitignored. A `target/` with ~20k untracked files hung the stash.
  - Stage LFS or vendored files before committing. An unstaged `vendor/` came back as LFS pointer stubs. Recover with `git lfs checkout vendor`.
  - `exclude` large generated trees from the steps.
- **Rule 7 — A fix that generates files must stage them.** A fix step that writes files after staging leaves them out of the commit, and CI's `hk check` then fails on the uncommitted output. Example: Clara_V1's rulesync mirror. Regenerate and `git add` in the same commit. A fixer that removes files from the index uses `stage = List()`, so `hk fix` never re-adds them.
- **Rule 8 — A failing step is a finding.** Root-cause it: either the code or the step is wrong, and you fix whichever it is. Never `--no-verify`, `HK_SKIP_STEPS`, `SKIP=`, or a disabled step. Skipping the slow pre-push needs an explicit per-session grant, and then it's visible in the command: `HK=0 NO_VERIFY_OK=1 git push`. Commit hooks always run.
- **Rule 9 — A project convention that can be checked is an hk step.** Examples: no `include!` of a `.rs` file, no machine-specific symlinks staged, a generated mirror committed. A rule that lives only in a README or a memory gets broken by the next agent. A step with no `glob` that has to inspect the index (symlinks are left out of hk's file lists) reads the index itself.
- **Rule 10 — A long pre-push needs a kept-alive connection.** git opens the SSH connection before the hook runs, and GitHub drops it after about 2 hours (exit 141 after every check passed). Push with `GIT_SSH_COMMAND="ssh -o ServerAliveInterval=20"`, or over HTTPS. On an empty new remote, hk needs `refs/remotes/origin/HEAD` to exist before the first push.

## Anti-patterns (reject on sight)

| Smell                                                    | Replace with                                          |
| -------------------------------------------------------- | ----------------------------------------------------- |
| `python -c "import yaml..."` / ad-hoc validator          | `hk check`, then `hk fix`                             |
| Separately installed linter run by hand                  | A step in `hk.pkl` (Builtins where it exists)         |
| `git commit --no-verify`, `HK_SKIP_STEPS`, disabled step | Fix the code or the step (`skillz:never-no-verify`)   |
| Same step list repeated per hook                         | One `local linters` mapping, spread with `...linters` |
| Tests in pre-commit                                      | Pre-push step with `exclusive = true`                 |
| `amends` pinned to a different hk than `mise.toml`       | Same version in both                                  |
| Step calling a binary that isn't in `mise.toml`          | `mise use <tool>`, then the step                      |
| Shared worktree across agents with `stash = "git"`       | One worktree per agent                                |
| Build dir inside the worktree, not gitignored            | Gitignore it or move it out (`CARGO_TARGET_DIR`)      |
| Fix step that writes files the commit doesn't include    | Regenerate and stage in the same commit               |
| Convention enforced only by a README line                | An hk step that fails on a violation                  |
| Hand-built list of changed files for a lint run          | `hk check --pr`                                       |

## Reviewing hk (PRs, diffs)

Walk the diff against the bar. For each violation, quote the line and give the replacement. Lead with the rule number ("Rule 4: pytest in pre-commit, move it to pre-push with `exclusive = true`") so the author can map the feedback back to the standard.
