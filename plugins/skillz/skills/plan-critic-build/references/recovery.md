# Recovery and steering

## Change course mid-run

Don't message a workflow agent (SKILL.md lesson 1). Instead:

1. Edit the master plan's Global Constraints (or the section file a pending
   task reads) and commit it to the integration branch, holding the merge
   lock so it can't interleave with a reviewer's merge.
2. Agents that start after the commit read the new text. The build prompt
   tells them the current Global Constraints win.
3. Agents already running keep their old instructions. If that matters, stop
   the run and relaunch (below).

## Stop, inject, relaunch

Use this when a run is wedged (an agent was messaged, a wave failed, the
machine rebooted) or when prompts must change.

1. Stop the workflow (TaskStop on its task id).
2. Collect what finished from the run's `journal.jsonl` in its transcript
   directory: each agent's actual return value.
3. Put the finished results in `args.done`:
   - plan-critic: `done.research[key]` and `done.sections[id]` hold the
     structured results, verbatim.
   - wave-build: `done` is the list of task ids already merged. Confirm each
     with `git log --merges --oneline <branch> | grep "merge: <id>"` before
     trusting it.
4. Relaunch with the same `scriptPath` and the new `args`. Injected calls
   never run, so nothing depends on the resume cache.

`resumeFromRunId` replays only the longest unchanged prefix of `agent()`
calls. Any changed input (prompt, options, agent type) is a miss, and so is
everything after a call that failed. Injection is the reliable path; resume is
a bonus when it hits.

## Run the leftovers

The build's result lists `not_run`: graph tasks that are neither in `done` nor
merged. It covers tasks the critic added outside the waves, tasks after a
failed wave, and tasks with no plan file. After fixing whatever stopped the
run:

1. Re-derive waves for the leftovers from the graph's dependencies (all their
   dependencies must be in `done` or earlier leftover waves).
2. Relaunch wave-build with `done` = everything merged so far and `waves` =
   the leftover waves.

## Status when the user asks

Workflows notify only on completion. For a mid-run answer, read the run's
`journal.jsonl` (and `/workflows` for the live tree), then report as
buckets: merged, in progress, queued, failed. Say up front, at launch, that
no milestones will be pushed.

## Stale locks

Both locks are `mkdir` directories under `/tmp`, so a reboot clears them.
A holder that died leaves its lock, and the template's waiter clears it once it
is older than `staleMinutes` and no process matches `busy`. To clear one by
hand, check that nothing is using the resource, then `rmdir` it.
