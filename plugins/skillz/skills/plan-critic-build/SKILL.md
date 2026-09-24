---
name: plan-critic-build
description: Plan and build a large software project with parallel agents — spec, master plan with shared contracts written as code, parallel section planners that prototype their code, a critic that reconciles them into an execution graph, then a wave build where each task is implemented in its own git worktree and a fresh reviewer re-tests and merges it under a lock. Any stack — web app or service, CLI, library, data pipeline, mobile or desktop app, migration, infra, game port. Use it whenever the user wants a whole app, service, subsystem, rewrite, port or multi-chunk roadmap (v2 list, TODO list) for a codebase planned and built by many agents, asks to "plan → critic → build", "fan out planners", "run the plan in waves", "build this plan in parallel worktrees", or wants to resume, recover or extend such a run — even if they only say "build the whole thing with agents". Not for a single bounded change (use brainstorming directly), a one-PR review, or non-software plans.
---

# Plan → critic → wave build

Build software too big for one context: many planners write against shared
contracts, one critic makes their output a single executable plan, and a
workflow executes it wave by wave with a fresh implementer and a fresh
reviewer per task. Nothing here assumes a language, platform or toolchain;
every command, path and lock comes in through the templates' `args`.

## Gates come first

- **Design gates.** Brainstorming runs sectioned design approvals. Each
  decision (architecture, platform, data model, look) is an option-ID pick
  with the recommended option first (`unique-option-numbering`).
- **Opt-in.** The workflows launch only after the user explicitly opts into
  multi-agent orchestration (ultracode, or "use a workflow" in their own
  words). Without it, describe the run and its rough cost, and ask.

Never skip either to save time. The approved picks become the pinned
decisions every planner receives, and the run's cost is only acceptable
because the user chose it.

## What it's made of

| Piece                                                 | Where                                                                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Spec, then plan                                       | `superpowers-brainstorming` → `superpowers-writing-plans`                                                                     |
| Per-task implementer + reviewer, final review, finish | `superpowers-subagent-driven-development`, `superpowers-requesting-code-review`, `superpowers-finishing-a-development-branch` |
| Worktree per task                                     | `superpowers-using-git-worktrees`, `worktree-from-origin-main`                                                                |
| Guardrails in every prompt                            | `never-no-verify`, `checkbox-evidence`                                                                                        |
| Decision gates and status for the user                | `unique-option-numbering`, `visual-formatting`                                                                                |
| Workflow script API, resume, completeness critic      | `workflow-authoring` skill and the Workflow tool, built into Claude Code                                                      |
| Script templates                                      | [templates/](templates/)                                                                                                      |

The `superpowers-*` skills are vendored copies of superpowers 6.4.1 (MIT);
prefer the upstream `superpowers:*` names when that plugin is installed. See
[vendor/superpowers/PROVENANCE.md](../../vendor/superpowers/PROVENANCE.md).
`workflow-authoring` ships with Claude Code and is not vendored.

## Phases

### 1. Spec and master plan (inline, with the user)

Get the spec approved through the design gates, then write the **master
plan** with writing-plans. It holds no tasks, only what every section must
agree on:

- **Shared Contracts**, written by you as real code before any fan-out: type
  signatures with their members, data schemas as a full example document,
  binary or wire layouts as byte tables. Planners code against contracts;
  prose gets interpreted five different ways. Sections may add members, never
  rename or re-type.
- **Global Constraints**: project-wide rules, copied verbatim into every
  task's requirements. This is also the steering wheel mid-run (lesson 1).
- **Pinned decisions**: the option table the user approved.
- **Review Focus**: the five inputs most likely to break for a real user,
  each to be pinned by a test in an owning task.
- **A section table**: id, file, scope, depends-on. Right-size it before
  launch: split any section too big for one planner's context (a 20-task
  "everything else" section comes back thin) and update the table to match.

Shape and examples from several stacks:
[references/master-plan.md](references/master-plan.md).

Before fan-out, copy the pinned decisions each planner needs into its brief
(`decisions` in `args`). Planners then implement decisions instead of
re-deciding them.

When rebuilding or porting something that still runs, **observe the
reference implementation**: run the original (an emulator, the legacy
service, the old CLI) and measure its behaviour into a committed research
doc. It settles what the data and docs can't. A background observer agent
does it, time-boxed, capturing evidence as it goes:
[references/observe-reference.md](references/observe-reference.md).

Gitignored or copyrighted inputs (licensed assets, customer data dumps,
proprietary binaries) live in a gitignored `vendor/`, symlinked into each
worktree. Ignore it as `/vendor`, not `/vendor/`: the trailing slash doesn't
match a symlink, so each worktree's link shows up as untracked. Every agent is
told never to commit it or copy copyrighted text verbatim (`assets` in
`args`).

Commit research and plans as you go. Scratch under `/tmp` can vanish.

### 2. Plan + critic workflow

Launch [templates/plan-critic.workflow.js](templates/plan-critic.workflow.js)
with `Workflow({ scriptPath, args })`. The script's header documents every
key.

- **The briefing block** (`briefing` in `args`) is prepended to every
  agent's prompt: the repo path (quoted, and flagged when it has spaces), the
  binding docs to read first, a scratch toolkit of ready-made helpers with
  their signatures plus the recipe that rebuilds it, facts already verified,
  known environment limits ("image reading is broken; analyze pixels
  numerically"), and toolchain versions with the style bar. Without it every
  agent spends its first twenty minutes rediscovering the same things.
- **Research** agents answer unknowns empirically. Every claim is backed by
  code actually run against the real inputs, verified code is embedded in the
  doc, and the result is `{doc_path, summary, confidence, open_questions}`.
  Committed docs stay copyright-clean: no copyrighted images, audio or
  verbatim text. You commit the docs. Items with `observe` get the observer
  instructions.
- **Research gates only the planners that need it.** Each section declares
  `needs: [researchKey]`. Sections with no needs start at once; the rest
  await only their own research. No barrier after all research.
- **Section planners** also start as soon as their upstream sections land,
  and return produces/consumes with exact signatures.
- **Planners prototype.** Each one applies its code to a scratch copy of main
  and runs the project's build, lint and tests, probing any API it is unsure
  of against the SDK or library itself: a typecheck-only compile of a
  one-file probe (`swiftc -typecheck`, `tsc --noEmit`, `cargo check`), a grep
  of the installed interface or type stubs, a query against a scratch
  database. The plan carries code that ran.
- **The critic fixes, not just reports.** It edits section files in place:
  consumes ↔ produces, contract collisions, spec coverage, placeholders,
  Review Focus tests, tooling. It edits the master plan only to record
  contract additions, never renames. It changes the spec only where research
  proved it wrong, and lists each change in `spec_changes` for the user. It
  compile-checks all sections together in one scratch copy and writes the
  **Execution Graph**: dependencies, waves of disjoint-file tasks, and the
  hot-files table.

Review `fixes_applied`, `spec_changes` and `remaining_gaps` with the user,
commit the plan, and get an explicit go before building.

### 3. Wave build workflow

Launch [templates/wave-build.workflow.js](templates/wave-build.workflow.js)
with the critic's `tasks` and `waves`, the merge-lock path, and a lock per
shared resource (a device or emulator, a test database, a port, a GPU). Per
task:

1. An implementer builds it in a fresh worktree from the integration branch,
   TDD, hooks passing, no merge.
2. On failure it retries once from a clean worktree, carrying the blocker.
3. A fresh reviewer reads the diff, re-runs the tests and lint itself, fixes
   what's real, and merges under `until mkdir <lock>` with stale-lock
   clearing.

Both prompts carry the **deviation rule**: the plan's code was verified
against a scratch assembly, so the integration branch may differ; keep the
plan's names and contracts, adapt mechanics to what's really there, and
report every deviation. Without it, implementers either force stale code in
or wander off the contracts.

A wave runs in parallel, in batches of `maxParallel`. The run stops at the
first wave with a failed task, so nothing builds on a broken merge.

Alongside the waves:

- **Fold agent** (`fold`). New observations or research arrive after
  planning. A concurrent agent rewrites the affected tasks, starting with the
  run; the build awaits it only just before `fold.beforeWave`, the first wave
  that depends on it. Tasks it adds come back in `not_run`.
- **Side jobs** (`sideJobs`). Independent data jobs: labelling assets,
  generating fixtures, backfilling a dataset. They write to scratch only; you
  review a sample and commit.
- **The user.** Feedback that changes planned behaviour is edited into the
  plan task before that task runs; grep every reference and keep its tests
  consistent. A user-reported bug is hotfixed in its own worktree, verified
  with a failing-first test and the evidence you viewed, and merged through
  the same merge lock. Recipes: [references/recovery.md](references/recovery.md).

**Final verification is required** (`final`; the template refuses to start
without it). It reports pass counts for every suite, a feature inventory
checked item by item against the spec (works, partial or missing, with
file:line), the evidence it actually viewed (screenshots, responses, output
files), and fixes only small things, listing bigger ones as `gaps`.

**All in one.** When the codebase works and the user approved a list of
chunks with their decisions (a v2 list), skip the gate between critic and
build: [templates/all-in-one.workflow.js](templates/all-in-one.workflow.js)
plans chunks (dependent planners chained by `needs`), runs the critic, then
calls wave-build as a sub-workflow. It takes `done.plans` for finished
planners and `priority` for the chunk whose tasks go first.

### 4. Finish

Diff the graph against what ran (the result's `not_run`, lesson 5), then run
the leftovers and the final verification's `gaps`. Then a whole-branch review
and `superpowers-finishing-a-development-branch`.

## Orchestrator checklist

- [ ] Every design decision was an option-ID pick, recommended first; the
      user opted into multi-agent orchestration.
- [ ] Spec approved and committed; master plan has Shared Contracts as code,
      Global Constraints, pinned decisions, Review Focus, a right-sized
      section table.
- [ ] Porting or rebuilding: the original was observed, findings committed.
- [ ] Research lives in committed, copyright-clean docs; scratch has a
      rebuild recipe.
- [ ] `briefing` filled: toolkit with signatures, verified facts, environment
      limits, toolchain.
- [ ] Gitignored assets: `/vendor` (no trailing slash) ignored, symlinked
      into worktrees, `assets` set.
- [ ] Plan run launched from the template; the user was told milestones are
      not pushed (lesson 7).
- [ ] Critic report and `spec_changes` reviewed; plan committed; user said
      go.
- [ ] Hot files named, and their tasks serialized in the graph.
- [ ] Lock paths chosen per project (`/tmp/<proj>-merge.lock`,
      `/tmp/<proj>-<resource>.lock`) with a `busyPattern` for stale checks.
- [ ] `maxParallel` set for heavy builds; every shared resource behind a
      lock.
- [ ] Build launched with `final`; mid-run changes went into Global
      Constraints or the pending task, never into a message.
- [ ] After the run: `not_run` and `gaps` empty or re-launched; final review
      done.

## Lessons (each one cost a run)

Numbers in brackets come from the worked example below.

1. **Never message a running workflow agent.** SendMessage resumes it outside
   the workflow: its result goes to you, and the workflow waits forever. To
   change course, edit a doc every agent reads (the master plan's Global
   Constraints; the build prompt says the current text wins). To recover,
   stop the run, inject the finished results as `args.done`, and relaunch.
2. **Inject finished results; don't trust replay.** Resume misses the cache
   whenever a call's inputs changed, even with an unchanged prompt (a
   changed agent type is enough), and a failed call early in the order
   forces every later call to re-run. Every template takes `done`.
3. **Batch verification.** Make every edit, then one build + lint pass.
   Parameterized tests over collections. One end-to-end run that captures
   every screenshot or output. Checking one control per build loop costs
   minutes each.
4. **`/tmp` is not storage.** A reboot wiped the research scratch once. Keep
   findings in committed docs and rebuild scratch from a recipe.
5. **The wave list is frozen at launch.** Tasks the planners or critic add
   mid-run won't execute. Diff the plan's graph against what ran and launch
   the leftovers.
6. **Shared-resource locks need stale handling.** A dead holder leaves the
   lock forever. The template clears a lock older than `staleMinutes` when
   nothing matching `busyPattern` is running.
7. **Workflows only notify on completion.** Tell the user up front that
   milestones won't be pushed. When they ask, read the run's `journal.jsonl`
   and report where it is.
8. **Name the hot files.** Files many tasks edit (dispatch switches, route
   tables, project or build files, task-runner config) go in the Execution
   Graph's hot-files table, and their tasks are serialized unless the edits
   are append-only.
9. **Rescoping is cheap early.** To defer a chunk, stop the run, drop the
   chunk, relaunch with `done`, and record it as deferred in the TODO.
10. **A session restart loses every agent, not its scratch.** In-flight
    workflow agents and named teammates are gone; messages to teammates fail.
    Relaunch with `hint` pointing each planner at its predecessor's prototype,
    clear stale locks, and re-spawn teammates with full context.
11. **Machine hygiene.** Parallel builds plus heavy test resources exhaust a
    shared machine [7 simulators, 27 GB of swap]. Cap `maxParallel` for heavy
    tasks and put every shared resource behind a lock. Helpers never kill
    processes they can't attribute to their own run: a broad `pkill` broke
    another run's builds.
12. **Keep the user's cadence.** Status comes as a dashboard
    (`visual-formatting`) with estimates in hours, not "a while". When a
    promised milestone ping didn't happen, say so: workflows don't push
    progress (lesson 7).

Recovery recipes (stopping, injecting, rescoping, restarts, hotfixes,
leftovers, polling): [references/recovery.md](references/recovery.md).

## Worked example: Flying Colors

An example, not a requirement: a native iPad rebuild of a 1997 kids' paint
program, from original disc images.

- **Gates:** engine, platform and look were option-ID picks; the user said
  "write the detailed plan then ultracode it".
- **Master plan:** contracts C1–C4 were a generated-asset directory layout, a
  full `catalog.json` example, Swift engine types with their members, and a
  byte table for the saved-painting format. The magic-tools section was split
  in two before launch.
- **Research:** decoders for the original resource formats, embedded in the
  docs, verified against the discs. The observer ran the original in an
  in-browser emulator and measured an ordered dither matrix, spray density
  profiles and border tiling rules; a fold agent wrote them into the pending
  tasks during waves 1–6.
- **Build:** 82 tasks in waves, simulator behind a lock, discs in a
  symlinked `vendor/`. Every task merged; one late fold task ran as a
  leftover. A side job labelled 1,150 stamps from generated contact sheets.
- **v2:** a roadmap of chunks ran through the all-in-one template, with the
  native look chunk as `priority` and the Mac app chunk deferred mid-run.
