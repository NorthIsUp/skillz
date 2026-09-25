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

## Stop and relaunch

Use this when a run is wedged (an agent was messaged, a wave failed, the
machine rebooted, the usage limit hit) or when prompts must change.

1. Stop the workflow (TaskStop on its task id), if it is still running.
2. Clear the stopped run's locks: check nothing matching their busy pattern
   is running, then `rmdir` each. A stale lock makes every new agent wait
   until the runtime kills it for stalling (SKILL.md lesson 13).
3. Relaunch with the same `scriptPath` and `args`, without
   `resumeFromRunId`.

The ledger does the rest. The first agent snapshots it into
`<scratch>/.ledger.workflow.js` (wave-build uses `<worktrees>/`), which the
script loads with `workflow()`, since scripts can't read files themselves:

| Finished work     | Where the relaunch finds it                             |
| ----------------- | ------------------------------------------------------- |
| research result   | `<ledger>/research-<key>.json`                          |
| section / chunk   | `<ledger>/section-<id>.json`, `<ledger>/plan-<id>.json` |
| critic graph      | `<ledger>/critic-graph.json`                            |
| merged build task | a `merge: <id>` commit on the integration branch        |
| interrupted work  | `<scratch>/<id>/`, passed to that planner as `hint`     |

Ledger file names use a slug of the id (lowercase, runs of other characters
become `-`); the `id` inside the file is verbatim. `args.done` is merged over
the ledger, for results you have to inject by hand.

`resumeFromRunId` replays only the longest unchanged prefix of `agent()`
calls. Any changed input (prompt, options, agent type) is a miss, and so is
everything after a call that failed. The ledger is the reliable path.

## A run that predates the ledger

Write one ledger file per finished result, taken from the run's
`journal.jsonl` (or the `result` in its `workflows/wf_*.json` record):
`{"kind":"research","id":"<key>","result":{...}}`, and likewise `section`,
`plan` and `critic` (id `graph`). Commit them, then relaunch with `ledger` set.

## Args too big to pass inline

Put them in a script and pass its path. Every template starts by running it
with `workflow()` and merges any inline args over its result:

```js
// <scratch>/args.workflow.js
export const meta = { name: "run-args", description: "args for the plan run" };
return {
  repo: "...",
  ledger: "...",
  sections: [
    /* ... */
  ],
};
```

Then launch with `Workflow({ scriptPath: '<template>', args: { argsScript: '<scratch>/args.workflow.js' } })`.

## Defer a chunk

Stopping early is cheap. Stop the run, drop the chunk from `sections` or
`chunks`, relaunch with everything finished in `done`, and record the chunk
as deferred in the project's TODO with the user's reason.

## After a session restart

In-flight workflow agents are lost; their scratch prototypes survive a
restart but not a reboot. Clear the dead run's locks and relaunch as above:
finished work comes from the ledger, and each interrupted planner whose
prototype is still in `<scratch>/<id>` gets it as its `hint`. Named teammate
agents are gone too, and messages to them fail. Re-spawn them with full
context; they remember nothing.

## Run the leftovers

The build's result lists `not_run`: graph tasks that are neither in `done` nor
merged. It covers tasks the critic added outside the waves, tasks after a
failed wave, tasks with no plan file, and tasks the fold agent added. The
final verification's `gaps` are leftovers too: plan a task for each. After fixing whatever stopped the
run:

1. Re-derive waves for the leftovers from the graph's dependencies (all their
   dependencies must be merged or in earlier leftover waves).
2. Relaunch wave-build with `waves` = the leftover waves. Merged tasks are
   skipped from the branch's `merge:` commits.

## Status when the user asks

Workflows notify only on completion. For a mid-run answer, read
`<ledger>/PROGRESS.md` (one line per finished agent or merged task) and
`/workflows` for the live tree, then report as a dashboard (the `visual-formatting` rule) with buckets merged, in progress,
queued, failed, and an estimate in hours from the waves left and the average
wave time so far. Say up front, at launch, that no milestones will be pushed.
If you promised a ping and didn't send it, say so.

When a run ends, its `status` is the verdict: `complete`, or `INCOMPLETE`
with `resume.missing`. The run record's own `completed` only means the script
returned.

## Stale locks

Both locks are `mkdir` directories under `/tmp`, so a reboot clears them.
A holder that died leaves its lock, and the template's waiter clears it once it
is older than `staleMinutes` and no process matches `busy`. To clear one by
hand, check that nothing is using the resource, then `rmdir` it.
