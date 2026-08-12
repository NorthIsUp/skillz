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

**Never give a unit a `name`.** A named spawn is routed to the teammate mailbox
rather than run as a task: the unit idles waiting for a message, never judges
the proposal, and you get a "finished" ping with no vote. Unnamed dispatch
returns the position directly — inline when synchronous, in the completion
notification otherwise. Prefer `run_in_background: false` so all three
positions land in one round; Round 1 is a barrier and calls in a single message
run concurrently either way.

Each `Task` prompt contains:

- **The proposal** (verbatim or your crisp restatement).
- **The context/artifact** to judge (diff, doc, paths, goal).
- A reminder to return its **output contract**: a 2–5 sentence position from
  its lens, the merits and risks it sees, and a **VOTE: APPROVE | REJECT |
  CONDITIONAL** (with specific flip-conditions if CONDITIONAL).

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

Report a **compact transcript** — a short header per unit with its final
position and vote — then the verdict line. MAGI-terminal aesthetic is welcome;
keep the ASCII light.

```text
╔════════════════════════════════════════╗
║  MAGI  ·  DELIBERATION  ·  <proposal>  ║
╚════════════════════════════════════════╝

── MELCHIOR-1 · The Scientist ──────────
<final position, 1–2 lines>            VOTE: APPROVE

── BALTHASAR-2 · The Engineer ──────────
<final position, 1–2 lines>            VOTE: CONDITIONAL

── CASPER-3 · The User ─────────────────
<final position, 1–2 lines>            VOTE: APPROVE

────────────────────────────────────────
VERDICT: CONDITIONAL APPROVE (2 APPROVE · 1 CONDITIONAL)
Conditions to satisfy:
  - <condition from Balthasar-2>
```

State the **resulting decision** in one line. If CONDITIONAL, list the exact
conditions that would make it a clean APPROVE. If DEADLOCK, say so plainly and
name the unresolved axis of disagreement.

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
