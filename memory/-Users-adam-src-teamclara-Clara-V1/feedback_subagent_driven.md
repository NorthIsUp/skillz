---
name: Always use subagent-driven execution
description: When executing plans, always choose subagent-driven development — never ask which execution mode to use
type: feedback
---

Always use subagent-driven development (superpowers:subagent-driven-development) when executing implementation plans. Do not ask which execution mode to use — just go straight to dispatching subagents.

**Why:** User finds the execution mode prompt unnecessary friction. Subagent-driven is always the preferred approach since it produces higher quality work with parallel execution.

**How to apply:** When transitioning from a plan to execution, skip the "how would you like to execute?" prompt and immediately invoke superpowers:subagent-driven-development. Never fall back to the single-threaded executing-plans skill unless subagents are genuinely unavailable.
