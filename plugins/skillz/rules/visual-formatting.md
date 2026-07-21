---
description: Use emoji anchors and ASCII structure to make output scannable
alwaysApply: true
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

Match weight to importance — heaviest for the top-level title, lighter as you
nest. Don't stack two heavy headers back to back.

```text
╔══════════════════════════════╗   ← L1  session / report title
║  TITLE                        ║
╚══════════════════════════════╝

┌──────────────────────────────┐   ← L2  major section (boxed)
│  Section                       │
└──────────────────────────────┘

── Section ──────────────────────   ← L2  section (single rule, lighter)

🎯 Phase — inline anchor + em dash   ← L3  phase / group

────────────────────────────────    ← divider between phases (plain rule)
```

Rules of thumb: one L1 per message; `─` (U+2500) for dividers, full-width-ish;
box-drawing only, never `---`/`===` ASCII (renders as a markdown hr or heading).

## Example — a status report

Dotted leaders align state; a status glyph ends every line; a boxed header
titles the block; rules split phases. Reuse the _same_ glyphs everywhere:
✅ done · ⏳ in progress · ⬜ pending · ❌ failed · 🔴 blocked · ⚠️ caveat/track
· 🔍 investigating · 🧪 tests/CI · 🩺 health · 🚀 deploy · 🎯 goal · 📦 artifact
· 🗄️ data/table · 🔀 PR.

```text
╔═══════════════════════════════════════════════════════╗
║  CLA-1980  ·  medallion ETL  ·  merge + prod deploy   ║
╚═══════════════════════════════════════════════════════╝

🎯 Goal 2 — ship the Dagster ETL foundation to prod

📦 merge #2139 → main ........ ✅ done   (squash 6d4194248)
🧪 main CI ................... ⏳ in progress
🚀 staging deploy + migrate .. ⏳ queued behind CI
🩺 verify staging migrate .... ⬜ pending

────────────────────────────────────────────────────────

🎯 Goal 1 — prod stability

🩺 legacy Celery ETL ......... ✅ STABLE  (8/8 monitors OK)
⚠️  psycopg async-conn regression (~1.3k/day) — track, not blocking
```

## Completion summary

When a task wraps, close with a compact summary — what shipped, what's left,
one line each. Put the _whole_ summary inside the box: title, status lines,
and the `result:` line all live between the top and bottom rules. The right
wall is optional — an open-right box (`║` on the left only) is fine and keeps
alignment easy.

```text
╔════════════════════════════════════════════════════════
║  ✅ CLA-1980 — medallion ETL shipped to prod
║
║  📦 merged ...... #2139 → main (6d4194248)
║  🚀 deployed .... staging + prod, migrate clean
║  🩺 verified .... 8/8 monitors green, legacy ETL stable
║  ⚠️  follow-up .. psycopg async-conn regression — tracked, not blocking
║
║  result: medallion ETL live in prod; migrate verified clean, legacy green.
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

Pairs with the short-comments rule: brevity still wins — this shapes what
little you write, it is not license to write more. Reach for the full boxed
dashboard on multi-phase status; a couple of anchored lines is plenty for a
small update.
