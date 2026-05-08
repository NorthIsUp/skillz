---
name: Always use subagent-driven execution
description: When executing implementation plans with independent tasks, always use the subagent-driven-development skill to parallelize work
type: feedback
---

Always use the `superpowers:subagent-driven-development` skill when executing implementation plans that have independent tasks.

**Why:** User prefers parallel subagent execution for efficiency and isolation rather than sequential single-thread work.

**How to apply:** When you have a plan with multiple independent steps, invoke the `superpowers:subagent-driven-development` skill to dispatch parallel agents instead of executing steps one by one in the main conversation.
