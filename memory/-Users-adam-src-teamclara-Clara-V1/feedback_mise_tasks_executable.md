---
name: Mise tasks must be executable
description: After creating or editing mise task files, ensure they have the executable bit set
type: feedback
originSessionId: 9fb9901f-96d7-4378-8c36-65ae54f223df
---
Mise task files in `scripts/mise_tasks/` must have the executable bit (`chmod +x`). Without it, mise sees the file but refuses to run it.

**Why:** The Write tool doesn't preserve executable permissions. After writing or creating a mise task file, the executable bit is lost and mise errors with "no task found, but a non-executable file exists."

**How to apply:** After any Write/Edit to a mise task file, run `chmod +x` on it. Also verify with `ls -la` if unsure.
