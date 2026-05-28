---
name: Right-size review depth to task complexity
description: User finds two-stage review (spec + code quality) too slow for trivial mechanical tasks; reserve it for tasks with real judgment calls
type: feedback
originSessionId: 25f31e05-bb0f-4c84-92c5-5608798e99e7
---

When executing a plan via subagent-driven-development, do NOT run the full implementer → spec reviewer → code-quality reviewer loop on trivial mechanical tasks (boilerplate clap struct, `normalize_*` helpers, template-string rendering, README/LICENSE). The implementer's self-review plus the spec reviewer is sufficient.

Reserve the full two-stage review for tasks that involve judgment: architecture, dependency choices, CI/security, error-handling strategy, integration glue.

For small mechanical tasks, either:

1. Skip the code quality reviewer after spec compliance passes, OR
2. Batch several small tasks into one implementer dispatch and one reviewer dispatch covering all of them.

**Why:** User interrupted a code-quality review of a ~45-line clap-derived arg parser that the spec reviewer had already cleared. Called out "cli arg parsing is taking a really long time". The extra review round added minutes with no realistic signal for boilerplate of that shape.

**How to apply:** Before dispatching a code-quality reviewer, ask "is there any design judgment exercised here?" If no (pure mechanical transcription of a plan that specifies exact code), skip straight to marking complete. Batch small tasks when possible.
