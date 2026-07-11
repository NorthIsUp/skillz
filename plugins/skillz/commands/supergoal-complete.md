---
description: Finish a goal — verify it's really done, then print a 🎉 completion box.
---

The current objective is finished (or you were asked to wrap up). Run the
completion ceremony.

**1. Verify before you celebrate.** Confirm the done-condition actually holds —
run the check (tests pass, `gh pr view` shows MERGED, the file exists, the
behavior is observed). Evidence, not assumption. If it does **not** hold, say so
plainly and keep working instead of printing the box.

**2. Print the summary** in a box titled with 🎉. Include, one line each:

- **Outcome** — what was achieved, in plain terms.
- **Artifacts** — the concrete things that changed: PR/commit links, files,
  deploys. Skip the line if there are none.
- **Duration** — wall-clock time.
- **Turns** — number of assistant turns.
- **Tokens** — tokens used.
- **Follow-ups** — anything left open, deferred, or worth watching. Skip if none.

Use the visual-formatting box style (`╔ … ╚`, open-right is fine). Dotted
leaders to align the values. Keep each line tight.

**3. Be honest about metrics.** If duration, turns, or tokens aren't actually
instrumented in this session, give your best estimate and mark it as an estimate
— never present a guessed number as measured.

Example shape:

```text
╔════════════════════════════════════════════════
║  🎉  <one-line outcome>
║
║  📦 shipped ..... <PR / commit / files>
║  ⏱️  duration .... <wall-clock>
║  🔁 turns ....... <count>
║  🪙 tokens ...... <count or ~estimate>
║  🔭 follow-up ... <open item, or omit>
╚════════════════════════════════════════════════
```

Then, if this completes a `/goal`, a plain `result:` line stating the outcome.
