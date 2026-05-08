---
name: Until-loops always need a reasonable timeout
description: When polling with `until <check>; do sleep N; done`, always set a Bash timeout so a stuck condition doesn't hang the agent indefinitely
type: feedback
originSessionId: d1a35c46-7463-457f-b818-902ae7688a85
---
When using `until ... do sleep N; done` to poll, always pass a reasonable `timeout` to the Bash tool. Don't rely on the default 2-min timeout being right — pick one that matches the operation (e.g. 180000ms for GitHub status reevaluation, 600000ms for a long CI run).

**Why:** A bare `until` loop with no timeout can hang at the maximum tool timeout if the condition never flips, wasting time and burning context. The user explicitly called this out.

**How to apply:** Whenever you write an `until <check>; do sleep N; done` Bash command, also set `timeout` on the Bash call.
