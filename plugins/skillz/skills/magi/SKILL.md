---
name: magi
description: Convene the MAGI — three deliberation personas (Melchior-1 the Scientist, Balthasar-2 the Engineer, Casper-3 the User) that independently evaluate a proposal and vote APPROVE / REJECT / CONDITIONAL, then reach a verdict by consensus or majority. Use to get a ruling on a design, plan, architecture decision, or PR. Triggers on "have the MAGI decide", "MAGI vote", "MAGI, rule on X", "deliberate this", "get a ruling on X", "convene the MAGI", or "/magi".
---

# MAGI — Three-Persona Deliberation

Convene the three MAGI supercomputers to rule on a **proposal** — a design, a
plan, an architecture decision, a PR, or any judgment call passed in. Each unit
evaluates from its own lens, casts a vote, and the MAGI reach a verdict by
consensus or majority. A tie is a dramatic **deadlock**.

The three units (each is a subagent — dispatch via `Task`):

| Unit            | Persona (aspect)          | Lens                                                                  |
| --------------- | ------------------------- | --------------------------------------------------------------------- |
| **Melchior-1**  | The Scientist             | correctness, sound modeling, first-principles rigor                   |
| **Balthasar-2** | The Engineer (the Mother) | API design, extensibility, long-term maintainability (effort is free) |
| **Casper-3**    | The User (the Woman)      | real-world value, product coherence, honest scope, no gold-plating    |

Agent types: `magi-melchior`, `magi-balthasar`, `magi-casper`.

## The proposal

Take the proposal from the invocation (`/magi <proposal>`, "MAGI, rule on X",
or the surrounding context in autonomous work). Before dispatching, gather the
**relevant context** the units need to judge — the design doc, the diff
(`git diff <base>...HEAD`), the file paths, the stated goal. Pass that same
context to all three so they judge the same artifact. If the proposal is
ambiguous, state your one-line interpretation of it up front, then proceed.

## Round 1 — independent positions (always)

Dispatch **all three units in parallel** — a single message with three `Task`
calls, one per agent type. They must **not** see each other's positions; these
are independent priors.

**Never give a unit a `name`.** A named spawn becomes a teammate session, and a
teammate's plain text is invisible to its caller — reporting back requires
`SendMessage`, which the personas deliberately lack. The unit judges the
proposal perfectly well and then has no way to hand you the verdict, so it goes
idle and pings "available" forever while the tally waits on a vote that can
never arrive. Unnamed dispatch returns the position directly — inline when
synchronous, in the completion notification when backgrounded. Prefer
`run_in_background: false` so all three land in one round; Round 1 is a barrier
and calls in a single message run concurrently either way.

Each `Task` prompt contains:

- **The proposal** (verbatim or your crisp restatement).
- **The context/artifact** to judge (diff, doc, paths, goal).
- A reminder to return its **output contract**: a 2–5 sentence position from
  its lens, the merits and risks it sees, and a **VOTE: APPROVE | REJECT |
  CONDITIONAL** (with specific flip-conditions if CONDITIONAL).

Before the first dispatch, print the **boot block** and run `date +%s` — the
decision clock starts here and is read again at the verdict.

Collect the three positions and their initial votes.

**If Round 1 is unanimous** (all APPROVE, or all REJECT), skip Round 2 — the
priors already agree. Go straight to the verdict.

## Round 2 — cross-examination (only if Round 1 is not unanimous)

Now let the units see each other. Dispatch the three **in parallel again**
(unnamed, same as Round 1), giving each unit the **other two's** Round 1
positions and votes, and asking it to **reconsider and cast a FINAL vote**. Each may hold or change its vote, but
must give a **one-line reason** for holding or moving. A CONDITIONAL vote should
restate its conditions (or drop them if the cross-examination resolved them).

Stay in-lens: a unit updates because another surfaced something _within its own
lens_ it had missed — not because it was outvoted. Peer pressure is not
evidence.

## Tally + verdict

Compute the verdict from the **final** votes (Round 2 if it ran, else Round 1),
treating **CONDITIONAL as a conditional-APPROVE**:

- **UNANIMOUS APPROVE** — all three APPROVE.
- **MAJORITY APPROVE (2-1)** — two APPROVE, one REJECT.
- **CONDITIONAL** — the approving majority includes ≥1 CONDITIONAL, or the
  swing vote is CONDITIONAL. Approve **only if** the union of all live
  conditions is met; list them.
- **DEADLOCK** — the votes tie with no majority to approve (e.g. the decisive
  split cannot resolve). Eva-flavored: the MAGI cannot reach consensus.
- **REJECTED** — a majority REJECT.

### Presentation

**Do not hand-render the chrome.** `${CLAUDE_PLUGIN_ROOT}/bin/magi-render` owns
every glyph and every number. You author the judgments; it derives the rest —
blast radius from `git diff`, threat score, tally, breach %, bar fills, elapsed
time, and the seven-segment clock. Freehanded box-drawing drifts its column
widths between runs, and a model asked for "4 files · 210 LOC" or "sync 81%"
will invent both.

Write a state file, then call the renderer at three points and paste its stdout
verbatim into the report.

```bash
magi-render open  --state <file>   # boot + NERV header + target card; starts the clock
magi-render field --state <file>   # A.T. Field — only between Round 1 and Round 2
magi-render close --state <file>   # umbilical + trinity + transcript + clock + bar + verdict
```

`open` stamps `started` into the state file, so elapsed time never becomes your
bookkeeping. Add the unit positions and votes to the same file before `close`.

#### State schema

```json
{
  "proposal": "add retry policy to fetch_user()",
  "pattern": "blue",
  "interpretation": null,
  "kind": "interface",
  "base": "origin/main",
  "irreversible": false,
  "sensitive": false,
  "rounds": 2,
  "decision": "ship it, capped at 3 retries with no jitter",
  "conditions": ["cap at 3 retries", "4xx never retried"],
  "deadlock": false,
  "units": [
    { "id": "melchior", "vote": "approve", "position": "1–2 lines, pre-wrapped" },
    { "id": "balthasar", "vote": "conditional", "position": "..." },
    { "id": "casper", "vote": "reject", "position": "..." }
  ]
}
```

Only these fields are yours to judge:

| field                        | rule                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pattern`                    | `blue` when a concrete artifact was passed (diff, doc, paths); `orange` when you had to interpret                                                                                                                         |
| `interpretation`             | required on `orange` — your one-line reading, which the card prints instead of the authorisation line                                                                                                                     |
| `kind`                       | `behaviour` · `interface` · `structure` · `data` · `process`                                                                                                                                                              |
| `base`                       | a git ref, so blast radius is measured rather than guessed. Omit for doc/plan proposals — the card says so plainly                                                                                                        |
| `irreversible` · `sensitive` | feed the threat score: migrations and auth/money/security paths each add a point                                                                                                                                          |
| `deadlock`                   | a **judgment**, not arithmetic — three units and two blocs always yield a majority, so set this when the decisive conditions are genuinely contested. Also set `holdout`, `aspect` (科学者 / 母 / 女 の 部分), and `axis` |
| `decision` · `conditions`    | the resulting call, and what would make a CONDITIONAL a clean APPROVE                                                                                                                                                     |

`position` is printed inside a rail, so pre-wrap it to about 52 columns.

#### Conditional blocks

The renderer suppresses anything that carries no information: the umbilical
line prints only when Round 2 ran (a connected cable is not news), and `field`
is only worth calling when Round 1 was not unanimous — it is the _reason_
Round 2 is happening.

`magi-render selftest` checks the tally math, the threat scale, the CJK
display-width padding, and that every closed box comes out rectangular.

## Two modes of use

- **Interactive** — the user asked for a ruling. Present the transcript +
  verdict and stop. The decision is theirs to act on.
- **Decision gate in autonomous work** — the MAGI are a gate inside a larger
  task. **Act on the verdict**: proceed on APPROVE; proceed and satisfy the
  listed conditions on CONDITIONAL; stop and reconsider (or escalate) on
  REJECTED / DEADLOCK. Record the verdict briefly so the decision is traceable.

## Rules

- Round 1 is always independent — never show the units each other before they
  cast initial votes.
- Only run Round 2 when Round 1 isn't unanimous; don't burn a round on agreement.
- Each unit stays strictly in its lens. Balthasar never weighs effort/time/cost.
  Casper guards scope against gold-plating. Melchior judges only correctness.
- CONDITIONAL must carry concrete, checkable conditions — never a vague "maybe".
- Keep the transcript crisp: one short header + position + vote per unit, then
  the verdict. Don't re-narrate each round in full.
- Never hand-render the chrome — call `magi-render`. It is the only thing that
  keeps column widths stable and keeps derived numbers from being invented.
