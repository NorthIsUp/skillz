---
description: Print the current Claude Code session ID
allowed-tools: Bash
---

!`env | grep -iE 'claude|session' | sort`

Output only the value of whichever variable is the session UUID. If none obviously contains it, list the candidates.
