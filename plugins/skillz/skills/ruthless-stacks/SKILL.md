---
name: ruthless-stacks
description: |
  Standing rules for dependent PRs: any PR whose base is not the default
  branch is a `gh stack`, never a hand-set base. Use whenever opening a PR,
  setting or changing a PR's base, starting work that needs code from an
  open PR, or briefing an agent that will open one. Also fires for "stack
  this on #N", "base it on that branch", "retarget the PR", and "wait for
  #N to merge first".
alwaysApply: true
---

# Ruthless stacks

A PR whose base is not the default branch is created and maintained with
`gh stack` (the gh-stack extension: `init`, `add`, `submit`, `sync`), never a
hand-set `--base` or a manual retarget. A hand-set base doesn't follow the PR
below it: when that one squash-merges, its commits come back as duplicates that
need a manual rebase. Phrasing
("stacked on #N", not "based on #N") is `skillz:ruthless-git`.

## The bar

- **Rule 1 — Non-default bases only via `gh stack`.** No `gh pr create --base <branch>`, `gh pr edit --base`, or `gh api` PATCH of a pull's `base`.
- **Rule 2 — Stack now, don't wait.** If your change needs code from an open PR, put it in a `gh stack` on top of that PR now. Don't base it on the default branch and wait for the other PR to merge.
- **Rule 3 — Another owner's base is no exception.** A base PR owned by another session or agent still gets stacked on: coordinate (announce it in a PR comment, pause the other side's pushes), don't fall back to a plain base.
- **Rule 4 — Briefs say `gh stack`.** An agent brief that creates a PR says "create it with `gh stack` on top of #N", never "base = <branch>".
- **Rule 5 — `--force-with-lease` only.** Stack branches may be rebased and force-pushed, with `--force-with-lease`, never plain `--force`.

## The gate

`bin/block-plain-pr-base` (PreToolUse, Bash) blocks `gh pr create|edit --base/-B <x>` and `gh api .../pulls... -f base=<x>` when `<x>` is not the default branch. `gh stack` is never blocked. When the user explicitly grants an exception for one PR, the command carries a leading `PLAIN_BASE_OK=1`, so the grant is visible in the command that used it. An agent never grants itself one.
