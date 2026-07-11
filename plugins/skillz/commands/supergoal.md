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
- **Verifiable** — give an explicit, checkable done-condition (a passing
  command, a merged PR, a file that exists, an observed behavior). This is what
  the Stop hook keys on; without it the goal can never satisfy.
- **Specific** — keep the concrete nouns (PR number, file path, service, test
  name) so it stays unambiguous turn after turn.
- **Achievable in this session** — a bounded outcome, not a standing policy or a
  recurring job.

**One target vs many.** If the phrase names a single outcome, write it as one
tight sentence. If it bundles **multiple distinct targets**, enumerate them as a
numbered list inside the objective — one concrete, verifiable item per line — so
each can be tracked and checked off independently.

If the phrase is too vague to pin a done-condition (e.g. "make it better"),
state the single most likely interpretation and note what you assumed rather
than asking.

**Always append this completion instruction to the objective**, verbatim intent:

> When every item is done, print a summary in a nice box titled with 🎉 that
> gives: the outcome achieved, how long it took (wall-clock), how many turns,
> and how many tokens used.

Output **only** the polished `/goal start` line, ready to paste, followed by a
copy link:

```text
/goal start <objective (enumerated if multiple targets), its done-condition, and the 🎉 completion-summary instruction>
```

`[[󰆑copy](pbcopy://?t=<urlencoded /goal start line>)]`

No preamble, no explanation of your edits unless an assumption is worth flagging
in a single trailing line.
