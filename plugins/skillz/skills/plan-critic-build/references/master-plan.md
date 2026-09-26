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
    run/                           # ledger: <kind>-<id>.json + PROGRESS.md, committed per agent
docs/research/<key>.md             # research, committed
```

## How this plan is organized

A table with one row per section: id, file, task count, depends-on. Under it,
a paragraph naming the serial chains (for example "every engine task adds
cases to the same two files, so the engine chain is serial") and pointing at
the Execution Graph for exact order.

Right-size the sections before launch. A section one planner can't hold in
context comes back thin: placeholders, skipped steps, guessed interfaces.
Split it along a seam (the Flying Colors "magic tools" section became 05a
stamps and text, 05b gradients and selection) and update this table.

## Global Constraints

One line per rule, exact values copied from the spec: platform floors,
language modes, banned APIs, test framework, where copyrighted or generated
material may live, commit trailer, "every command runs through the task
runner", "never `--no-verify`". Two kinds of line are easy to forget:

- **User decisions** made during planning, labelled with who and when
  (`**Asset source precedence (user decision):** …`).
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
  - Cover collections with parameterized tests, not one test per item.
  - Write one end-to-end run that covers every screen, endpoint or command
    the task touches and captures all their evidence, then look at it all.
```

## Pinned decisions

The option table the user approved at each gate, one row per decision with its
option ID. The orchestrator copies the rows each section needs into that
planner's brief (`decisions` in `args`), so the planner implements them
instead of re-deciding:

```markdown
| ID  | Decision                                                      |
| --- | ------------------------------------------------------------- |
| A2  | Postgres, not SQLite: several writers from day one            |
| B1  | REST with an OpenAPI spec; no GraphQL                         |
| C1  | Tablet layout first; phone layout after everything else works |
```

## Shared Contracts

The orchestrator writes these itself, before any fan-out, as real code in
the project's own languages. Planners code against them; a prose contract
gets interpreted differently by every planner. Numbered `C1`, `C2`, …, each
names its producer and its consumers
(`### C3. Core types (S2 defines them; everyone else uses them)`) and gives
the exact shape:

- **Types**: signatures with every member, such as a TypeScript interface, a
  Swift protocol and its enums, a Rust trait, a Python dataclass.
- **Data**: a full example document plus its schema, such as an OpenAPI
  component, a JSON Schema with a sample file, a protobuf message.
- **Storage and wire layouts**: a SQL table with its constraints and indexes,
  a byte table for a binary file format, a directory layout for generated
  files.

```typescript
// C2. Order API (S1 serves it; S3 and S4 call it)
export interface Order {
  id: string; // ULID
  status: "draft" | "paid" | "shipped" | "refunded";
  lines: { sku: string; qty: number; unitCents: number }[];
  createdAt: string; // RFC 3339, UTC
}
```

```sql
-- C3. orders table (S2 owns migrations; S1 reads and writes)
CREATE TABLE orders (
  id         text PRIMARY KEY,
  status     text NOT NULL CHECK (status IN ('draft','paid','shipped','refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

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
2. **Duplicate webhook delivery:** the second one is a no-op, not a second
   charge. Tested by `test_webhook_idempotent` (03-T2).
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
