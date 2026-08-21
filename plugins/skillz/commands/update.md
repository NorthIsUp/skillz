---
description: Pull the latest skillz plugins from the marketplace and reload them into this session.
allowed-tools: Bash, SlashCommand
---

Fresh copy pulled and installed:

```bash
!claude plugin marketplace update northisup-skillz; for p in skillz tmux-session-resume guarded-worktrees; do claude plugin update "$p@northisup-skillz" 2>&1 | tail -1; done
```

Now reload so this session picks it up: run `/reload-plugins`, then `/reload-skills`. If you have no SlashCommand tool, print those two lines and tell me to type them.

Report the resulting versions in one line each; skip plugins that were already current.
