---
description: Rewrite a rough phrase into an excellent, verifiable /goal objective.
---

Take this phrase and turn it into an excellent input for the `/goal` builtin:

> $ARGUMENTS

A `/goal` objective is one durable, session-scoped outcome the agent pursues
across many turns. A Stop hook blocks the session from ending until the
objective's done-condition holds, so a _great_ objective is one whose
completion is unambiguous and checkable.

Rewrite the phrase into an objective that is:

- **Clear** — state the objective plainly up front, so anyone reading it knows
  exactly what "done" looks like without further context.
- **Distilled, not transcribed** — capture the _intent_ in natural language.
  Don't mechanically restate the phrase or dictate verbatim commands (e.g. write
  "PR #6 is merged to main with CI green", not "`gh pr view 6 --json state`
  reports MERGED"). Name the tool only when the exact invocation is the point.
- **Verifiable** — give a checkable done-condition (a merged PR, passing tests, a
  file that exists, an observed behavior). This is what the Stop hook keys on;
  without it the goal can never satisfy — but state it as an outcome, not a
  script.
- **Empirically tested** — a goal is not met until it has been empirically
  tested. Bake this into the done-condition: the change must be _exercised_ and
  observed to work (run the command, hit the endpoint, drive the flow), not just
  written, typechecked, or assumed. "Looks done" is not done.
- **Specific** — keep the concrete nouns (PR number, file path, service, test
  name) so it stays unambiguous turn after turn.
- **Achievable in this session** — a bounded outcome, not a standing policy or a
  recurring job.

**One target vs many.** If the phrase names a single outcome, write it as one
tight sentence. If it bundles **multiple distinct targets**, enumerate them as a
numbered list inside the objective — one concrete, verifiable item per line — so
each can be tracked and checked off independently.

**Formatting.** A `/goal` objective can span multiple lines — use them for
readability. Put a numbered list on its own lines and the completion instruction
on its own line, rather than cramming everything into one run-on sentence.

If the phrase is too vague to pin a done-condition (e.g. "make it better"),
state the single most likely interpretation and note what you assumed rather
than asking.

**Always append a completion instruction to the objective**, pointing at the
shared ceremony so the box spec lives in one place:

> When every item is done, run the `/supergoal-complete` routine: empirically
> test that the done-condition holds, then print a 🎉 box with the outcome,
> wall-clock time, turn count, and tokens used.

Output **only** the polished `/goal start` block, ready to paste, followed by a
copy link. It may be multi-line (a numbered list + the completion instruction on
its own line):

```text
/goal start <objective — one sentence, or a numbered list of targets on
separate lines — with its done-condition and the 🎉 completion-summary
instruction on its own line>
```

`[[󰆑copy](pbcopy://?t=<urlencoded /goal start line>)]`

No preamble, no explanation of your edits unless an assumption is worth flagging
in a single trailing line.
