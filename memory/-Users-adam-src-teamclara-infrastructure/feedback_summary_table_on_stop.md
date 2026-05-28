---
name: Summary table when stopping work
description: When ending a long autonomous session, provide a table summarizing what was done and the reason for stopping
type: feedback
originSessionId: 798cb3e8-b6fd-4d11-90ce-6e5fb9194904
---

When stopping work after a long autonomous session, finish with a **table** summarizing:

- What got done (PRs opened, merged, deployed)
- What's still in-flight (waiting on CI / pulumi-up / a manual step)
- The reason for stopping (handoff to user, blocked, deadline reached)

**Why:** The user is busy and can't reconstruct hours of session state from the chat scroll. A compact table gives them everything they need to triage what's pending and what they should look at next.

**How to apply:**

- One row per PR or major task. Columns: target / state / next-step or blocker.
- Include direct PR/run URLs.
- One-line "reason for stopping" at the top or bottom.
- Don't write a wall of prose — the table is the artifact.
