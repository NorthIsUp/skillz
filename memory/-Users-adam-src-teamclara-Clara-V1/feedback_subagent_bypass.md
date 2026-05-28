---
name: Subagents must use auto mode
description: Always spawn subagents with mode="auto" to avoid repeated permission prompts
type: feedback
originSessionId: 2524c0c9-51de-4f98-af3c-23916eba91c8
---

Always use `mode="auto"` when spawning subagents.

**Why:** Avoids repeated permission prompts that interrupt parallel work.

**How to apply:** Default to `mode="auto"` for all Agent tool calls.
