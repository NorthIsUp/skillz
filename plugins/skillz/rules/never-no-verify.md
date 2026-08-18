---
description: Committing or pushing when a git hook fails — never bypass it with --no-verify
alwaysApply: true
---

# Never `--no-verify`

`git commit --no-verify` (and `git push --no-verify`) is banned. Hooks are the
only thing standing between a broken commit and the default branch; bypassing
them moves the failure to CI, or past it.

A failing hook is a finding, not an obstacle. Root-cause it: the code is wrong,
or the hook is wrong. Fix whichever it turns out to be. Reaching for a skip —
`--no-verify`, `HK_SKIP_STEPS`, `SKIP=`, disabling the step — is how a broken
gate stays broken for months, and how the next person learns to route around it
too.

Bypassing anyway needs explicit human permission, granted per commit or per PR
— not a standing exemption, and never self-granted by an agent. Say which hook
is failing, what the root cause turned out to be, and why it can't be fixed
now, then ask.

A `PreToolUse` hook (`bin/block-no-verify`) blocks the flag outright. Once the
human grants a bypass, the command carries `NO_VERIFY_OK=1` — the grant is
visible in the command that used it.
