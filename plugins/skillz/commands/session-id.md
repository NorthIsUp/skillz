---
description: Print the current Claude Code session ID
allowed-tools: Bash
---

Output only the value of whichever variable is the session UUID. If none obviously contains it, list the candidates.

This command will echo it if set

```bash
! env | grep CLAUDE_CODE_SESSION_ID
```

otherwise search with this

```bash
!env | grep -iE 'claude|session' | sort
```
