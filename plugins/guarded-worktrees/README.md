# guarded-worktrees

A `PreToolUse` hook that refuses to create a worktree on `main`/`master` or
from a local base ref, and fetches `origin` before letting one be created.

Local refs go stale silently. A worktree cut from local `main` can be missing
commits that landed an hour ago, and you don't find out until the rebase.

## What it blocks

Both routes to a new worktree are guarded — the `EnterWorktree` tool and a
plain `git worktree add` in Bash.

| Call                                         | Result                                             |
| -------------------------------------------- | -------------------------------------------------- |
| `git worktree add ../wt -b feat origin/main` | ✅ fetches `origin main`, then proceeds            |
| `git worktree add ../wt -b feat main`        | ❌ local base ref                                  |
| `git worktree add ../wt -b feat`             | ❌ no remote base                                  |
| `git worktree add ../wt -b main origin/main` | ❌ branch is `main`                                |
| `EnterWorktree {name: "feat-x"}`             | ✅ fetches `origin/HEAD`'s branch first            |
| `EnterWorktree {name: "main"}`               | ❌ name is `main`                                  |
| `EnterWorktree {path: …}`                    | ✅ enters an existing worktree, nothing to refresh |

A blocked call exits 2, so the message goes back to the model and it can
retry with a remote base instead of asking you.

## The fetch

Runs at most once an hour per repo, tracked by a stamp file in the common git
dir (`.git/worktree-guard-fetch`) that is written **only on a successful
fetch**. Set `WORKTREE_GUARD_FETCH_TTL` (seconds) to change the window.

Not `FETCH_HEAD` — git refreshes that even when the fetch _fails_, so one
offline blip would suppress every retry for a full TTL.

A failed fetch warns (exit 1) rather than blocking, so being offline doesn't
stop you working.

## Pairs with `worktree.baseRef`

Claude Code's own `worktree.baseRef` setting already governs `EnterWorktree`:

```json
{ "worktree": { "baseRef": "fresh" } }
```

`fresh` (the default) branches from `origin/<default-branch>`; `head` branches
from local HEAD. This plugin adds the fetch that makes "fresh" actually fresh,
and extends the same rule to `git worktree add`, which that setting doesn't
cover.

## Notes

- Only a real invocation trips the rules — the phrase has to start a command,
  so a `grep 'git worktree add'` or an echo passes through.
- `origin/<anything>` satisfies the base rule, not just `origin/main`, so
  stacking a hotfix on `origin/release-2` still works.
- One stamp per repo rather than per ref; at an hour's horizon, tracking refs
  separately isn't worth the state.

## Tests

```bash
plugins/guarded-worktrees/tests/test-worktree-guard.sh
```

Runs both routes against a throwaway repo whose `origin` never resolves, so
"did it try to fetch?" shows up as a real exit code instead of a mock.
