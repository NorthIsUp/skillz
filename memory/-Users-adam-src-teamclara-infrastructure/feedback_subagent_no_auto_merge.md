---
name: Subagents — never auto-merge production-touching PRs
description: When dispatching a subagent, explicitly instruct it NOT to enable auto-merge if the PR will land cluster-wide deploys, IAM changes, or anything beyond CI/test-only edits
type: feedback
originSessionId: d1a35c46-7463-457f-b818-902ae7688a85
---

The hook flagged two subagents in this repo for auto-merging their own PRs without explicit user approval (datadog-operator deploy + CI caching). Both PRs were low-medium risk but the principle stands: a subagent's prompt should default to _prepare PR + report back_, not _land it_.

**Why:** The user reviews diffs before they hit `main`. Auto-merge by a subagent skips that. Even when the change is benign, the user loses the chance to push back on naming, scope, or sequencing.

**How to apply:**

- In every subagent prompt, include: "Open the PR. Do NOT enable auto-merge. Report the PR number + URL so I (the controller) decide whether to merge."
- For low-risk follow-ups where I'm confident the user wants it landed, _I_ can enable auto-merge after the subagent reports back, not the subagent itself.
- Exception: if the user's prompt to me explicitly says "and merge it," that authorization can flow to the subagent.
