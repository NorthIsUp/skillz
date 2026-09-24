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

## User feedback during the build

- **It changes planned behaviour:** edit the plan task before that task runs.
  Grep every reference to what changed (other tasks, contracts, goldens) and
  update the tests with it, so the reviewer doesn't reject a correct
  implementation. Commit under the merge lock.
- **It's a bug in merged work:** hotfix it yourself or with one agent, in its
  own worktree from the integration branch. Verify it with a test that failed
  first and the evidence you viewed (screenshot, response, output), then merge
  through the same merge lock.
  The running build never sees a half-applied fix.

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
4. Clear the stopped run's locks: check nothing matching their busy pattern
   is running, then `rmdir` each. A stale lock makes every new agent wait
   until the runtime kills it for stalling (SKILL.md lesson 13).
5. Relaunch with the same `scriptPath` and the new `args`. Injected calls
   never run, so nothing depends on the resume cache.

`resumeFromRunId` replays only the longest unchanged prefix of `agent()`
calls. Any changed input (prompt, options, agent type) is a miss, and so is
everything after a call that failed. Injection is the reliable path; resume is
a bonus when it hits.

## Defer a chunk

Stopping early is cheap. Stop the run, drop the chunk from `sections` or
`chunks`, relaunch with everything finished in `done`, and record the chunk
as deferred in the project's TODO with the user's reason.

## After a session restart

In-flight workflow agents are lost; their scratch prototypes survive a
restart but not a reboot.

1. Inject every finished result from the old run's `journal.jsonl` as `done`.
2. Give each interrupted planner a `hint`: the path of its predecessor's
   prototype, to inspect and reuse.
3. Clear locks the dead run held: check nothing uses the resource, then
   `rmdir`.
4. Named teammate agents are gone too, and messages to them fail. Re-spawn
   them with full context; they remember nothing.

## Run the leftovers

The build's result lists `not_run`: graph tasks that are neither in `done` nor
merged. It covers tasks the critic added outside the waves, tasks after a
failed wave, tasks with no plan file, and tasks the fold agent added. The
final verification's `gaps` are leftovers too: plan a task for each. After fixing whatever stopped the
run:

1. Re-derive waves for the leftovers from the graph's dependencies (all their
   dependencies must be in `done` or earlier leftover waves).
2. Relaunch wave-build with `done` = everything merged so far and `waves` =
   the leftover waves.

## Status when the user asks

Workflows notify only on completion. For a mid-run answer, read the run's
`journal.jsonl` (and `/workflows` for the live tree), then report as a
dashboard (the `visual-formatting` rule) with buckets merged, in progress,
queued, failed, and an estimate in hours from the waves left and the average
wave time so far. Say up front, at launch, that no milestones will be pushed.
If you promised a ping and didn't send it, say so.

## Stale locks

Both locks are `mkdir` directories under `/tmp`, so a reboot clears them.
A holder that died leaves its lock, and the template's waiter clears it once it
is older than `staleMinutes` and no process matches `busy`. To clear one by
hand, check that nothing is using the resource, then `rmdir` it.
