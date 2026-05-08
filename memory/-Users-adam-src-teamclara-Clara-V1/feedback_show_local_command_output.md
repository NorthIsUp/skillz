---
name: Always show local command output
description: When user runs ! commands, always respond with the output shown in the conversation
type: feedback
---

Always respond to and show output from local `!` commands in the conversation. Do not say "(Local command, not responding.)" or similar.

**Why:** User expects Claude to acknowledge and discuss local command output, not ignore it.

**How to apply:** When a `!` command appears in the conversation with output, treat it as if the user ran the command and shared the result - comment on it or use it as context as appropriate.
