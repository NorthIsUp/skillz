# Master plan shape

The master plan is the one document every planner, implementer and reviewer
reads. It starts with the writing-plans header (Goal, Architecture, Tech
Stack, Spec) and then carries the sections below. Task detail lives in one
section file per sub-project next to it:

```text
docs/superpowers/plans/
  YYYY-MM-DD-<project>.md          # master plan
  YYYY-MM-DD-<project>/
    00-foundation.md               # section plans, tasks <id>-T1, -T2, …
    01-<area>.md
docs/research/<key>.md             # research, committed
```

## How this plan is organized

A table with one row per section: id, file, task count, depends-on. Under it,
a paragraph naming the serial chains (for example "every engine task adds
cases to the same two files, so the engine chain is serial") and pointing at
the Execution Graph for exact order.

## Global Constraints

One line per rule, exact values copied from the spec: platform floors,
language modes, banned APIs, test framework, where copyrighted or generated
material may live, commit trailer, "every command runs through the task
runner", "never `--no-verify`". Two kinds of line are easy to forget:

- **User decisions** made during planning, labelled with who and when
  (`**Art source precedence (user decision):** …`).
- **Asset rules**: gitignored or copyrighted inputs stay in `vendor/`
  (ignored as `/vendor` so the worktree symlink matches), and no copyrighted
  text is copied verbatim.
- **Rules added mid-run.** This section is how the orchestrator steers a
  running workflow. The build prompt tells every agent the current text wins.
  Batch verification was added this way:

```markdown
- **Batch verification (user, <date>):** never check one control per
  build/lint/test loop.
  - Make all related edits first, then run one build plus lint and fix every
    reported error in a single pass.
  - Cover collections with parameterized tests, not one test per button.
  - For UI, write one UI test that visits every screen and state the task
    touches, saves all the screenshots in a single run, then view them all.
```

## Pinned decisions

The option table the user approved at each gate, one row per decision with its
option ID. The orchestrator copies the rows each section needs into that
planner's brief (`decisions` in `args`), so the planner implements them
instead of re-deciding:

```markdown
| ID  | Decision                                        |
| --- | ----------------------------------------------- |
| C1  | iPad first; the iPhone layout comes after v1    |
| D1  | Indexed 8-bit canvas, palette lookup at display |
```

## Shared Contracts

Numbered `C1`, `C2`, … Each names its producer and its consumers
(`### C3. Engine core types (S2 defines them; everyone else uses them)`) and
gives exact shapes: file layouts, JSON schemas, type and function signatures.
Sections may add members, never rename or re-type. The critic records every
addition here.

## Review Focus

Five numbered inputs or failure modes a real user will hit that no task's
happy-path tests cover, most likely first. Each line names the input, the
expected behaviour, and after the critic pass, the owning test by name and
task id:

```markdown
1. **Strokes off the canvas edge:** clip silently, no crash or wraparound.
   Tested by `StrokeTests.offCanvasStrokeClips` (02-T5).
```

## Execution Graph

Written by the critic, at the end of the master plan.

- **Dependencies**: a table, task → waits for.
- **Waves**: a table of wave number → tasks that run in parallel. Tasks in
  one wave touch disjoint files, so their branches merge without conflicts.
- **Files many tasks edit**: file, the tasks that edit it in order, and how
  (serial vs append-only). Serial chains here are usually the critical path.
- The critical path in one line.

The build workflow takes the waves as `args`. It never re-reads this section
mid-run, so tasks added after launch have to be run separately.

## Section plan header

Each section file opens with its goal, prerequisites (sections or task ids
that must be merged first) and a task index, then the tasks in writing-plans
format: Files, Interfaces (Consumes / Produces with exact signatures),
checkbox steps with real code and exact commands.
