---
name: Check for conflicts proactively when stacking PRs
description: After force-pushing or whenever the local branch and main might have diverged on the same files, check mergeStateStatus and rebase before walking away
type: feedback
originSessionId: d1a35c46-7463-457f-b818-902ae7688a85
---

When I'm rapidly opening PRs in sequence — especially ones that touch the same files (workflows, mise.toml, argocd.py, **main**.py) — auto-merge will silently get blocked by conflicts because each merged PR shifts main while the next branch was based on the previous state.

**Symptom:** PR sits "OPEN" with `mergeStateStatus: DIRTY` or `BEHIND` for tens of minutes, user notices, has to ping me. Wastes their time.

**Why this happens:** I create branches off `origin/main` snapshots that quickly go stale as prior PRs land. The `gh pr merge --auto --squash` flag doesn't auto-rebase; it waits for a clean fast-forward.

**How to apply:**

1. **After pushing any PR**, run `gh pr view N --json mergeStateStatus -q .mergeStateStatus` and check it's `CLEAN` or `BEHIND` (mergeable). If `DIRTY`, rebase + force-push immediately.
2. **Before opening a new PR** that touches files another open PR also touches: rebase locally onto current `origin/main` first.
3. **In any background waiter that polls a PR**, also check `mergeStateStatus` not just `state`. Surface `DIRTY` immediately so I rebase.
4. **Touch-files I should treat as conflict-prone in this repo:** `.github/workflows/*.yml`, `mise.toml`, `infra/platform/__main__.py`, `infra/platform/Pulumi.clara.yaml`, `infra/core/src/core/argocd.py`, `infra/core/src/core/gha_wif.py`, `infra/tests/test_platform_stack.py`. PRs touching these should be merged in strict sequence, not parallel.
