---
name: Master branch protection
description: Two-layer push protection on master - local hk pre-commit hook + GitHub API branch protection rules requiring PR with 1 approval
type: project
---

Master branch has two-layer protection against direct pushes, set up 2026-04-07.

**Layer 1 - Local (hk pre-commit hook):**
- `no-commit-to-branch` hook in hk blocks commits directly to master
- Error: "Cannot commit directly to protected branch 'master'"

**Layer 2 - Remote (GitHub branch protection):**
- Required PR reviews: 1 approving review
- Dismiss stale reviews on new pushes: enabled
- Enforce admins: true (no bypass for org admins)
- Force pushes: disabled
- Branch deletion: disabled
- Set via `gh api repos/teamclara/Clara_V1/branches/master/protection`

**Why:** User discovered something was merged without proper PR review. Both layers now enforce PR-only workflow.

**How to apply:** All changes to master must go through PRs. Direct push will fail at both the commit stage (hk) and push stage (GitHub). When working on features, always create a branch first (use `/sprout`).
