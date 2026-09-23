---
name: plan-critic-build
description: Plan and build a large multi-part project with parallel agents — spec, master plan with shared contracts, parallel section planners, a critic that reconciles them into an execution graph, then a wave build where each task is implemented in its own git worktree and a fresh reviewer re-tests and merges it under a lock. Use this whenever the user wants a whole app, subsystem, rewrite or multi-chunk roadmap (v2 list, TODO list) planned and built by many agents, asks to "plan → critic → build", "fan out planners", "run the plan in waves", "build this plan in parallel worktrees", or wants to resume, recover or extend such a run — even if they only say "build the whole thing with agents". Not for a single bounded change (use brainstorming directly) or a one-PR review.
---

# Plan → critic → wave build

Build something too big for one context: many planners write against shared
contracts, one critic makes their output a single executable plan, and a
workflow executes it wave by wave with a fresh implementer and a fresh
reviewer per task.

It uses the **Workflow tool**, which needs the user's explicit opt-in to
multi-agent orchestration (ultracode, or "use a workflow" in their own words).
Without it, describe the run and its rough cost, and ask.

## What it's made of

| Piece                                                 | Where                                                                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Spec, then plan                                       | `superpowers-brainstorming` → `superpowers-writing-plans`                                                                     |
| Per-task implementer + reviewer, final review, finish | `superpowers-subagent-driven-development`, `superpowers-requesting-code-review`, `superpowers-finishing-a-development-branch` |
| Worktree per task                                     | `superpowers-using-git-worktrees`, `worktree-from-origin-main`                                                                |
| Guardrails in every prompt                            | `never-no-verify`, `checkbox-evidence`                                                                                        |
| Workflow script API, resume, completeness critic      | `workflow-authoring` skill and the Workflow tool, built into Claude Code                                                      |
| Script templates                                      | [templates/](templates/)                                                                                                      |

The `superpowers-*` skills are vendored copies of superpowers 6.4.1 (MIT);
prefer the upstream `superpowers:*` names when that plugin is installed. See
[vendor/superpowers/PROVENANCE.md](../../vendor/superpowers/PROVENANCE.md).
`workflow-authoring` ships with Claude Code and is not vendored.

## Phases

### 1. Spec and master plan (inline, with the user)

Run brainstorming on the architectural path, get the spec approved, then write
the **master plan** with writing-plans. For this method the master plan holds
no tasks. It holds what every section must agree on:

- **Shared Contracts**: exact names, types and file layouts that cross
  sections. Sections may add members, never rename or re-type.
- **Global Constraints**: project-wide rules, copied verbatim into every
  task's requirements. This is also the steering wheel mid-run (lesson 1).
- **Review Focus**: the five inputs most likely to break for a real user,
  each to be pinned by a test in an owning task.
- A section table: id, file, scope, depends-on.

Shape and examples: [references/master-plan.md](references/master-plan.md).

Commit research and plans as you go. Scratch under `/tmp` can vanish.

### 2. Plan + critic workflow

Launch [templates/plan-critic.workflow.js](templates/plan-critic.workflow.js)
with `Workflow({ scriptPath, args })`. Everything project-specific goes in
`args` (repo, spec, plan, section dir, research list, sections with
`needs`/`dependsOn`, the path of the writing-plans SKILL.md to follow). The
script's header documents every key.

- **Research** agents decode unknowns empirically and write committed docs.
- **Section planners** start as soon as their research and upstream sections
  land (pipelined, not barriered) and return produces/consumes with exact
  signatures.
- **The critic** reads everything and fixes in place: consumes ↔ produces,
  contract collisions, spec coverage, placeholder scan, Review Focus tests,
  tooling. It assembles the plans' code in a scratch copy, builds and tests
  it, and writes the **Execution Graph**: dependencies, waves of disjoint-file
  tasks, and the hot-files table.

Review the critic's `fixes_applied`, `spec_changes` and `remaining_gaps` with
the user, commit the plan, and get an explicit go before building.

### 3. Wave build workflow

Launch [templates/wave-build.workflow.js](templates/wave-build.workflow.js)
with the critic's `tasks` and `waves` in `args`, plus the merge-lock path and
any shared-resource locks (simulator, device, port). Per task:

1. An implementer builds it in a fresh worktree from the integration branch,
   TDD, hooks passing, no merge.
2. On failure it retries once from a clean worktree, carrying the blocker.
3. A fresh reviewer reads the diff, re-runs the tests and lint itself, fixes
   what's real, and merges under `until mkdir <lock>` with stale-lock
   clearing.

A wave runs in parallel. The run stops at the first wave with a failed task,
so nothing builds on a broken merge. An optional final agent verifies the
whole project against the spec.

### 4. Finish

Diff the graph against what ran (the result's `not_run`, lesson 5), run the
leftovers, then a final whole-branch review and
`superpowers-finishing-a-development-branch`.

## Orchestrator checklist

- [ ] User opted into multi-agent orchestration.
- [ ] Spec approved and committed; master plan has Shared Contracts, Global
      Constraints, Review Focus, section table.
- [ ] Research lives in committed docs; scratch has a rebuild recipe.
- [ ] Plan run launched from the template with `args`; the user was told
      milestones are not pushed (lesson 7).
- [ ] Critic report reviewed; plan committed; user said go.
- [ ] Hot files named, and their tasks serialized in the graph.
- [ ] Lock paths chosen per project (`/tmp/<proj>-merge.lock`,
      `/tmp/<proj>-<resource>.lock`) with a `busy` pattern for stale checks.
- [ ] Build launched; mid-run changes went into Global Constraints, never
      into a message.
- [ ] After the run: `not_run` empty or re-launched; final review done.

## Lessons (each one cost a run)

1. **Never message a running workflow agent.** SendMessage resumes it outside
   the workflow: its result goes to you, and the workflow waits forever. To
   change course, edit a doc every agent reads (the master plan's Global
   Constraints; the build prompt says the current text wins). To recover,
   stop the run, inject the finished results as `args.done`, and relaunch.
2. **Inject finished results; don't trust replay.** Resume misses the cache
   whenever a call's inputs changed, even with an unchanged prompt (a
   changed agent type is enough), and a failed call early in the order
   forces every later call to re-run. Both templates take `done`.
3. **Batch verification.** Make every edit, then one build + lint pass.
   Parameterized tests over collections. One UI test run that captures every
   screenshot. One control per build loop costs minutes each.
4. **`/tmp` is not storage.** A reboot wiped the research scratch once. Keep
   findings in committed docs and rebuild scratch from a recipe.
5. **The wave list is frozen at launch.** Tasks the planners or critic add
   mid-run won't execute. Diff the plan's graph against what ran and launch
   the leftovers.
6. **Shared-resource locks need stale handling.** A dead holder leaves the
   lock forever. The template clears a lock older than `staleMinutes` when
   nothing matching `busy` is running.
7. **Workflows only notify on completion.** Tell the user up front that
   milestones won't be pushed. When they ask, read the run's `journal.jsonl`
   and report where it is.
8. **Name the hot files.** Files many tasks edit (dispatch switches, project
   files, task-runner config) go in the Execution Graph's hot-files table, and
   their tasks are serialized unless the edits are append-only.

Recovery recipes (stopping, injecting, re-running leftovers, polling):
[references/recovery.md](references/recovery.md).
