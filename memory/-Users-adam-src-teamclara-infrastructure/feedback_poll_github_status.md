---
name: Poll GitHub status; do not rely on notifications
description: GitHub status (PR merge state, CI conclusions, run completion) does not reliably reach me via push notifications — I must actively poll with `gh` until terminal state, surfacing intermediate state to the user
type: feedback
originSessionId: d1a35c46-7463-457f-b818-902ae7688a85
---
I do NOT have reliable push notifications for GitHub state changes. Backgrounded `gh` poll loops occasionally exit before the actual terminal state is reached, miss merge conflicts that appear later, or finish without surfacing the most useful detail. The user has explicitly told me this multiple times.

**Why:** When I rely on a single background poll, the user ends up watching CI in their browser and pinging me with screenshots ("conflict", "still slow", "failed on main"). That's their job back on them.

**How to apply:**

1. **Always poll, don't sleep-and-check.** Use `until <terminal-condition>; do gh ... ; sleep 30; done` so I exit on the actual terminal state, not after a guessed wait. Memory: feedback_until_over_sleep.md.

2. **Poll multiple states, not just one.** A PR can be:
   - OPEN/BLOCKED (waiting on CI) → keep polling
   - OPEN/DIRTY (merge conflict) → rebase NOW, don't keep polling
   - OPEN/CLEAN (CI green, auto-merge will fire) → keep polling
   - MERGED → check what happened next (auto-triggered run?)
   - CLOSED → done
   The poll loop must terminate on MERGED OR DIRTY (so I rebase) OR an explicit FAILURE in checks (so I read logs).

3. **After every push, immediately check `gh pr view N --json mergeStateStatus`** before walking away. Don't trust the previous "auto-merge enabled" — it doesn't auto-rebase.

4. **For workflow runs, check both status AND conclusion.** `status: completed` with `conclusion: failure` is a hard fail; `conclusion: cancelled` likely means superseded by a newer push.

5. **When a background poll completes, read its OUTPUT FILE first** before saying "done". Don't summarize from memory of what I expected — the file has the actual final state.

6. **If a notification fires for a task I already moved past**, ignore it. Don't act on stale signals.

7. **Surface PR/run state in the user-visible reply**, not just internally. They want to know whether to babysit themselves.
