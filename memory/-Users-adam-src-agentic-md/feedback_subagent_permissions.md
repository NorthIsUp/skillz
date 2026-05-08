---
name: Subagent permission mode should match session
description: When spawning subagents, set mode to match the current session's permission mode so the user isn't re-prompted for edits they already approved
type: feedback
originSessionId: 752ab8cc-7e3a-47e1-ac29-55ee72bdf8fa
---
When dispatching subagents via the Agent tool, set the `mode` parameter to match the current session's permission mode. If the user has "accept edits on" for the session, subagents should also have that — don't force the user to re-approve edits in each subagent context.

**Why:** User was repeatedly prompted for edit permissions by subagents even though they had "accept edits on" in their session. The session-level toggle doesn't propagate to subagent contexts automatically.

**How to apply:** Always use `mode: "acceptEdits"` at minimum when dispatching implementation subagents. Use `mode: "auto"` or `mode: "bypassPermissions"` if the user is in a fully permissive session mode.
