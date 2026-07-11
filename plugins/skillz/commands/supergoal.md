---
description: Rewrite a rough phrase into an excellent, verifiable /goal objective.
---

Take this phrase and turn it into an excellent input for the `/goal` builtin:

> $ARGUMENTS

A `/goal` objective is one durable, session-scoped outcome the agent pursues
across many turns. A Stop hook blocks the session from ending until the
objective's done-condition holds, so a _great_ objective is one whose
completion is unambiguous and checkable.

Rewrite the phrase into a single objective that is:

- **One concrete outcome**, not a task list. If the phrase bundles several
  things, pick the real target and fold the rest into the done-condition.
- **Verifiable** — end with an explicit, checkable done-condition (a passing
  command, a merged PR, a file that exists, an observed behavior). This is
  what the Stop hook keys on; without it the goal can never satisfy.
- **Specific** — keep the concrete nouns (PR number, file path, service,
  test name) so it stays unambiguous turn after turn.
- **Achievable in this session** — a bounded outcome, not a standing policy
  or a recurring job.

If the phrase is too vague to pin a done-condition (e.g. "make it better"),
state the single most likely interpretation and note what you assumed rather
than asking.

Output **only** the polished `/goal start` line, ready to paste, followed by a
copy link:

```text
/goal start <objective, with its done-condition>
```

`[[󰆑copy](pbcopy://?t=<urlencoded /goal start line>)]`

Keep the objective one tight sentence or two. No preamble, no explanation of
your edits unless an assumption is worth flagging in a single trailing line.
