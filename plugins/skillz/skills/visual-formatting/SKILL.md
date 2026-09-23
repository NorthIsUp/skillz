---
name: visual-formatting
description: Shaping a reply, status report, or completion summary to be scannable
---

# Visual formatting for scannability

Make replies scannable, not longer. Structure, not verbosity.

- **Emoji as anchors** — pick an emoji per recurring concept and reuse the
  _same_ one all session (e.g. ✅ done, ⚠️ caveat, 🔍 investigating, 📦
  file/artifact). Consistency is the point; a symbol that means one thing
  today and another later is noise. A few anchors, not a sticker sheet.
- **Whitespace + ASCII to separate** ideas, sections, and phases — blank
  lines between blocks, a rule (`───`) or a small ASCII header between major
  phases. Let the eye find the seams without reading every word.

## Header options

Border weight tracks how big the finding is — double for major, heavy for
midi, light for mini. Whatever the tier, the _outer_ border is one weight the
whole way round and everything inside it is thin: that contrast is what makes
a block read as a single object. Leave the right wall off every box — an
open-right box keeps alignment easy and sidesteps text wrapping entirely.

**L1 — major finding** (workflow return, phase complete, full status report):

```text
╔══════════════════════════════
║  TITLE
╟──────────────────────────────
║  ...
╟─ subtitle ───────────────────
║  ...
╚══════════════════════════════
```

**L2 — midi finding** (single agent return, small investigation complete):

```text
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  TITLE
┠──────────────────────────────
┠─ subtitle ───────────────────
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**L3 — mini finding** (one result, a couple of lines):

```text
┌──────────────────────────────
│  Section
└──────────────────────────────
```

**Borderless** — for necessary large-volume text, where a wall would just
indent every line. Same three weights, no box:

```text
▀▀ Section ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀   ← Mega weight (exceptionally rare usage)
══ Section ════════════════════   ← L1 weight
━━ Section ━━━━━━━━━━━━━━━━━━━━   ← L2 weight
── Section ────────────────────   ← L3 weight

🎯 Phase — inline anchor + em dash   ← phase / group inside a section

───────────────────────────────    ← divider between phases (plain rule)
```

Rules of thumb: one L1 per message, and don't stack two boxes of the same
weight back to back. `╟` / `┠` / `├` are the interior tees — heavy rail, thin
branch — so a subtitle divides the block without breaking its edge. `─`
(U+2500) for interior rules, full-width-ish. Box-drawing characters only,
never `---` / `===` ASCII: those render as a markdown hr or heading.

## Dashboard headers

Two header rows anchor a dashboard (an L1 block):

- **Title** — a boxed L1 (`╔ ║ ╟ ╚`) wrapping the report title. One per report.
- **Goal** — a tree branch `╟─ 🎯 Goal N — <desc> ──`: the `╟─` roots it to the
  left rail, `🎯` anchors it, an em dash introduces the description, and a short
  trailing rule closes the row.

## Contents

Under each goal, group items by **status bucket**, not in a flat list:

- **Bucket row** — sits on the rail as `║ <glyph> <label>` (e.g. `║ ✅ complete`,
  `║ ⏳ in progress`, `║ ⬜ upcoming`, `║ 👀 watching`). The glyph names the
  bucket's state.
- **Item lines** — indented one step further under the rail as
  `║   <glyph> <item> ..... <state>`. A leading anchor glyph, then the item, then
  dotted leaders aligning a short state or note at the right. One item per line.

Reuse the _same_ glyphs everywhere:

- ✅ done
- ❎ canceled by user
- ❇️ deferred by user
- ⏳ in progress
- 🆙 pending/up next
- ❌ failed
- 🔴 blocked
- 👀 watching
- 🔄 looping
- ⚠️ caveat/track
- 🔍 investigating
- 🧪 tests/CI
- 🩺 health
- 🚀 deploy
- 🎯 goal
- 📦 artifact
- 🗄️ data/table
- 🔀 PR
- ❗️ interesting info
- ‼️ important info
- ❓ question
- ⁉️ blocking question

## Multiple goals

Stack goals highest-priority (or newest) first — `Goal 2` above `Goal 1`.
Separate them with a bare `║` spacer line. Each goal repeats the header +
bucket structure independently, so the eye can scan one goal at a time.

## Example — a status report

Dotted leaders align state; a status glyph ends every line; a boxed header
titles the block; rules split phases.

```text
╔════════════════════════════════════════════════════════
║  🔍 CLA-1980  ·  medallion ETL  ·  merge + prod deploy
╟─ 🎯 Goal 2 — ship the Dagster ETL foundation to prod ──
║
║ ✅ complete
║   📦 merge #2139 → main ........ complete   (squash 6d4194248)
║
║ ⏳ in progress
║   🧪 main CI ................... in progress
║   🚀 staging deploy + migrate .. queued behind CI
║
║ 🆙 upcoming
║   🩺 verify staging migrate .... pending
║
╟─ 🎯 Goal 1 — prod stability ───────────────────────────
║
║ ✅ complete
║   🩺 legacy Celery ETL ......... STABLE  (8/8 monitors OK)
║
║ 👀 watching
║   ⚠️  psycopg async-conn regression (~1.3k/day) — track, not blocking
╚════════════════════════════════════════════════════════
```

## Important question block

When the reply is blocked on an answer, the question can't be a sentence buried
in prose — box it so it survives skimming. Rounded thin box (`╭ │ ╰`), off the
weight ladder on purpose so it reads as a pause rather than a finding: one
question, options as short labeled lines.

```text
╭────────────────────────────────────────
│  ❓ Deploy staging before or after the migration?
│
│  A1  migrate first ..... safer, ~10 min downtime
│  A2  deploy first ...... no downtime, migration may fail
╰────────────────────────────────────────
```

One question per block, at most one block per message, placed last so it's the
final thing read. Options carry globally-unique IDs (`unique-option-numbering`).
No block when you can pick a sensible default and say what you picked.

## Unacceptable: bare option IDs

Every option must be restated in the message that asks for the pick. No
exceptions, even if the list was in the message right before.

```text
Still open:
- MI1 / MI2: in DATA.md, say "48k to 8.5M+ tokens" (measured only) or keep "over 20M" (extrapolated).
- MG4 / MG5: put the three eval questions in README.md, or keep them as our private answer key.
```

Which ID is which choice? One sentence with an "or" in it is not a list, and
the IDs point at tables from turns ago that the reader has forgotten. Each ID
gets its own line saying what it does:

```text
Still open:
  MI1  DATA.md says "48k to 8.5M+ tokens" ..... measured only
  MI2  DATA.md keeps "over 20M" ............... extrapolated
  MG4  eval questions go in README.md
  MG5  eval questions stay our private answer key
say **MI1** or **MI2**, and **MG4** or **MG5**
```

Repeat the list, keeping the same IDs (`unique-option-numbering`). Don't
point back to it, even when it's only one message up.

## Unacceptable: "say AB1 or AB2" with no options anywhere

A real reply, trimmed. It ends by asking for a pick, but AB1 and AB2 are never
stated anywhere in the message:

```text
The staging-persona plan is now recorded as a TODO in …/TODO.md, pushed to
#3128 as 729802efa. No design work continues on it for now.

📦 The entry covers:
- Why: persona data never reaches silver or gold. …
- Where to seed: the staging cluster and its database branch, …

╔═════════════════════════════
║  📋 where things stand
╟─────────────────────────────
║  🔀 #3128 OPEN · 729802efa · CI restarted · claw:ignore until green
║     ✅ Y1 · R5/R6 · bot review fixes · medallion TODO

⏳ The #3128 agent is now waiting on CI for 729802efa. When that's green, …

Say AB1 or AB2 whenever you're ready.
```

What's wrong with it, worst first:

- **The ask has no options.** `Say AB1 or AB2` is the only thing the reader
  has to act on, and there's nothing to choose from. They would have to scroll
  back through the conversation and guess what each ID meant. Whenever you ask
  for a pick, write out every option in that same message, one line per ID,
  inside a question block placed last.
- **Prose, then the box, then more prose.** The box was supposed to carry the
  status; the paragraphs above and below repeat it. Everything goes in the box,
  or there is no box.
- **Box never closed.** It has no `╚` bottom, and its content is wider than
  the top rule. A box that trails off doesn't read as one object.
- **`·`-chained lines.** Four facts in one line, with no leaders and no
  buckets. One item per line, with its state on the right after dot leaders.
- **Undefined tokens.** `Y1` and `R5/R6` mean nothing to someone skimming.
  Name what they are, or leave them out.
- **Glyph drift.** `📦` stands for an artifact, not a list header. `⏳` opens a
  prose paragraph when it should be a bucket.

The same content, done right:

```text
╔════════════════════════════════════════════════════════
║  📋 staging-persona plan parked as a medallion TODO
╟────────────────────────────────────────────────────────
║ ✅ complete
║   📦 TODO entry ........... src/clara/medallion/TODO.md
║   🔀 #3128 OPEN ........... pushed 729802efa
║   ✅ bot review ........... both open findings fixed
║
║ ⏳ in progress
║   🧪 CI on 729802efa ...... running
║   🆙 on green ............. swap claw:ignore → claw:babysit
╚════════════════════════════════════════════════════════

╭────────────────────────────────────────
│  ❓ <the question AB1/AB2 answer>
│
│  AB1  <option, restated> ..... <tradeoff>
│  AB2  <option, restated> ..... <tradeoff>
╰────────────────────────────────────────
```

## Completion summary

When a task wraps, close with a compact summary — what shipped, what's left,
one line each. Put the _whole_ summary inside the box: title, status lines,
and the `result:` line all live between the top and bottom rules. L1 weight for
a whole task; drop to L2 for a single agent's finding.

```text
╔════════════════════════════════════════════════════════
║  ✅ CLA-1980 — medallion ETL shipped to prod
╟────────────────────────────────────────────────────────
║  📦 merged ...... #2139 → main (6d4194248)
║  🚀 deployed .... staging + prod, migrate clean
║  🩺 verified .... 8/8 monitors green, legacy ETL stable
║  ⚠️  follow-up .. psycopg async-conn regression — tracked, not blocking
╟─ result ───────────────────────────────────────────────
║  medallion ETL live in prod; migrate verified clean, legacy green.
╚════════════════════════════════════════════════════════
```

Keep it to what changed and what's open — no re-narrating the whole session.
A small task needs no box: a couple anchored lines then `result:`.

**PRs always show current state.** A `🔀 PR` line carries the PR's live state
right after the number, before the URL, so the reader sees status without
opening the link — `OPEN` / `DRAFT` / `MERGED` / `CLOSED`:

```text
║  🔀 PR ........ #44 OPEN https://github.com/org/repo/pull/44
```

Not `#44 https://…` — a bare number hides whether it merged. Refetch the
state at summary time; never carry a stale `OPEN` after a merge.

## "We done here" block

The last line of a finished task — nothing follows it. Heavier than the L1
box so completion is distinguishable at a glance from any other header:

```text
▛▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
▌  🎉  WE DONE HERE
▌  medallion ETL live in prod — 8/8 green
▙▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
```

One line of what landed, under the banner. Only when the whole task is
done — not per phase, not when anything is still open or blocked; those get
the completion summary box above instead. It replaces that box on a clean
finish rather than stacking with it, and never appears twice in a session.

Pairs with `ruthless-comments`: brevity still wins — this shapes what little
you write, it is not license to write more. Reach for the full boxed dashboard
on multi-phase status; a couple of anchored lines is plenty for a small update.
