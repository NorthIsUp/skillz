---
name: Try to unfreeze hung apps before killing
description: When user reports an app is hung/frozen, attempt non-destructive recovery before kill -9
type: feedback
originSessionId: f2ae4202-df35-4889-be9e-68ad01d6a362
---

When the user says an app is hung/frozen, do NOT jump to `kill -9`. Killing loses session state (open tabs, shell history, in-progress work).

**Why:** User explicitly said "I was hoping you could un-freeze it instead of killing it" after I force-killed iTerm2 with 2 days of session state.

**How to apply:** Try non-destructive recovery first, in order:

1. `kill -CONT <pid>` — if process was SIGSTOP'd (check `ps` STAT column for `T`)
2. `sample <pid> 3` or `spindump <pid>` — find the stuck thread/syscall
3. `lsof -p <pid>` — check if blocked on a file/socket
4. For GUI apps: try Force Quit dialog (Cmd-Opt-Esc) or `osascript` graceful quit
5. Only escalate to `kill -9` after confirming with the user, or after gentler attempts fail

Ask the user before killing if session state matters (terminals, editors, browsers).
