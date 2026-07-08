---
description: Base new git worktrees on origin/main, fetching first
alwaysApply: true
---

# Worktrees from origin/main

When creating a git worktree, first run `git fetch origin main`, then create the worktree from `origin/main` — never from the local `main` branch, which may be stale.

```sh
git fetch origin main
git worktree add ../my-worktree -b my-branch origin/main
```
