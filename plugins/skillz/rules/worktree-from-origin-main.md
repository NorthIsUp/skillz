---
description: Creating a git worktree — fetch first, base it on the remote default branch
alwaysApply: true
---

# Worktrees from origin/main

Fetch before you branch: `git fetch origin <default>`, then
`git worktree add <path> -b <branch> origin/<default>` so the new branch is cut
from the freshly fetched ref — `<default>` being the repo's default branch,
usually but not always `main`. Local refs go stale silently, so a worktree cut
from local `main` can be missing commits that already landed.

Base on some other ref only when that's the point — stacking on an in-flight
branch, a hotfix off a release branch — and fetch that ref first too.
