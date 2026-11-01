---
name: ruthless-git
description: |
  Standing rules for git hooks when several tools want the same hook
  (hk, git-lfs, the repo's own scripts): one dispatcher per hook, a
  numbered provider slot each, installed by a mise task. Use whenever
  installing or editing git hooks, adding git-lfs or hk to a repo, writing
  a post-checkout / pre-push / prepare-commit-msg hook, or debugging "my
  hook never runs". Also fires for "git lfs pre-push didn't run", "hk
  install refuses", and "bootstrap new worktrees".
paths:
  - "**/mise-tasks/git/**"
  - "**/.git/hooks/**"
---

# Ruthless git

The standing bar for git hooks. git gives each hook exactly one file, and
providers fight over it: git-lfs and hk both refuse to overwrite a hook they
didn't write, so whoever installs first wins and the other silently never
runs. In Clara_V1, hk ended up owning pre-push, so `git lfs pre-push` never ran,
and git-lfs owned post-checkout, so the worktree bootstrap never ran. The fix
is a dispatcher per hook with a slot per provider. `references/hooks-install`
is the template mise task. Worktrees are `skillz:worktree-from-origin-main`.
Bypassing a hook is `skillz:never-no-verify`.

## Phrasing

- **A branch built on another PR is _stacked_ on it.** Write "stacked on #123", never "based on #123". "Based on" can mean the base branch or that the code was derived from it. Stacked branches are managed with `gh stack`: `init` (or `init --adopt b1 b2`), `add`, `submit`, `sync`. Don't hand-rebase a chain.
- **"Based on" is reserved for the start ref of a worktree or branch:** "cut from `origin/main`" (`skillz:worktree-from-origin-main`).

## The bar

- **Rule 0 — Prefer git's config hooks where the git has them.** Git 2.54 runs every `hook.<name>.event` + `hook.<name>.command` pair for an event, in config order, and then the `.git/hooks/<event>` file (`git help hook`). hk 2.x installs itself this way (`hook.hk-pre-commit.*`), so it never fights for the file. The dispatcher below is for providers that still write hook files (git-lfs) and for older git. Pin hk's env on its config command (Rule 11).
- **Rule 1 — Each hook is a dispatcher; each provider owns a file in `.git/hooks/<hook>.d/`.** The hook runs every executable in its `.d/` in filename order, under `set -e`, so the first failure still rejects. Adding a provider is a file drop, and no provider can displace another. The dispatcher carries a `# managed-by:` marker, so the installer knows which hooks it wrote.
- **Rule 2 — Slots are `<NN>-<owner>[-<purpose>]`, and the number is the order.**
  - `05-` guards that should fail fast, before any upload (protect-main).
  - `10-git-lfs`, then `20-hk`.
  - `30-<repo>-*` for the repo's own hooks, and `40+` for advisory ones.
  - `00-legacy` for a hook nobody claims.
- **Rule 3 — One mise task installs it all, and it's idempotent.** That task is `mise-tasks/git/hooks-install`, with a `--list` flag that prints the layout and a `--force` flag passed through to providers. Run it after cloning and from worktree init. Re-running it converges and never duplicates.
- **Rule 4 — Harvest, never delete.** Whatever occupies a slot is moved into `.d/`:
  - a provider's own pre-existing hook goes under that provider's name, so its reinstall replaces it rather than running it twice
  - anything unknown becomes `00-legacy`
  - providers then install into the emptied slot, so their refuse-to-overwrite check passes, and what they wrote gets harvested too
- **Rule 5 — Hooks resolve `--git-common-dir`, never `$GIT_DIR`.** Inside a worktree `$GIT_DIR` is `.git/worktrees/<name>`, but the hooks live in the shared `.git/hooks`. The same goes for anything a hook reads or writes about the repo.
- **Rule 6 — stdin is read once and replayed.** pre-push, post-rewrite and pre-receive get ref lines on stdin. The dispatcher buffers stdin when it isn't a terminal and feeds each provider a fresh copy, or `/dev/null`. Without that, only the first provider sees the refs.
- **Rule 7 — Hooks are written by rename, never in place.** A hidden temp file (`.<name>.tmp.<pid>`), then `chmod +x`, then `mv -f`. sh reads a script as it runs, so a hook rewritten mid-run resumes at a stale byte offset. The dispatcher skips dotfiles and `*.tmp.*`, so it never runs a half-written hook.
- **Rule 8 — `post-checkout` with an all-zeros previous HEAD means a new checkout.** `git worktree add` and `git clone` pass `0000…`, while a branch switch passes a real sha. That's the cheap trigger for worktree bootstrap: `mise trust`, then the repo's init task. Bootstrap failure is non-fatal and prints the command to rerun.
- **Rule 9 — Advisory hooks warn and never mutate.** A post-checkout or post-merge hook that sees a lockfile change prints the resync command and exits 0. Reinstalling deps under someone mid-task is worse than the drift. Best-effort upkeep, like `git lfs dedup`, is silent and can't fail.
- **Rule 10 — `prepare-commit-msg` adds only what it can prove.** It derives a ticket id only from a branch name that encodes one. It leaves `merge`, `squash`, `commit` (amend) and `template` sources alone, and never touches a subject that already carries the id.
- **Rule 11 — Pin the env a provider needs inside its own slot.** hk's generated hooks call `mise x -- hk`, which follows the ambient `MISE_ENV`. A per-dev `.miserc.toml` replaces the committed list rather than merging with it, so the hk profile drops out and a stale global hk runs. The installer prepends the `MISE_ENV` pin to `20-hk`, or to the `hook.hk-*.command` config for hk 2.x (`skillz:ruthless-hk` Rule 3).

## Anti-patterns (reject on sight)

| Smell                                                                 | Replace with                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| Two tools each running their own `install` into `.git/hooks`          | Dispatcher + `<hook>.d/` slots via `git:hooks-install`    |
| A hook script that calls the other tool's hook inline                 | Separate numbered slots                                   |
| Installer that `rm`s an existing hook                                 | Harvest it into `.d/` (`00-legacy` or the owner's slot)   |
| `$GIT_DIR/hooks` in a hook or installer                               | `git rev-parse --path-format=absolute --git-common-dir`   |
| Dispatcher that pipes stdin to the first provider only                | Buffer once, replay to each                               |
| `cat > .git/hooks/x` over a live hook                                 | Write a hidden temp file, then `mv -f`                    |
| Worktree setup as a manual README step                                | `post-checkout` slot keyed on the all-zeros previous HEAD |
| post-checkout hook that runs `pnpm install` / `uv sync`               | Warn with the resync command, exit 0                      |
| Commit-msg hook that invents or rewrites a ticket id                  | Derive from the branch only; skip merge/squash/amend      |
| `core.hooksPath` pointing at a committed dir with one script per hook | The dispatcher layout (providers can still drop slots)    |
| "based on #123" for a dependent PR                                    | "stacked on #123", managed with `gh stack`                |
| Hand-rebasing a chain of dependent branches                           | `gh stack sync`                                           |

## Reviewing git hooks (PRs, diffs)

Walk the diff against the bar. For each violation, quote the line and give the replacement. Lead with the rule number ("Rule 6: the dispatcher pipes stdin into the first provider only, buffer it and replay it") so the author can map the feedback back to the standard.
