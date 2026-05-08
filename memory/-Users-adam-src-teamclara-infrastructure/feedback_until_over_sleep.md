---
name: Prefer until-loops over sleep
description: When polling for a state change in shell, prefer `until <check>; do sleep N; done` over a fixed `sleep N` followed by a check
type: feedback
originSessionId: d1a35c46-7463-457f-b818-902ae7688a85
---
When waiting for something to become true in a shell command, prefer an `until` loop over a fixed `sleep`.

**Why:** A fixed `sleep N` is a guess — too short and you re-poll uselessly, too long and you waste real time. `until <cond>; do sleep N; done` exits as soon as the condition is met. The runtime also notifies on loop exit, so I don't need to chain sleeps to work around the long-leading-sleep block.

**How to apply:** Whenever I write `sleep N && <check>` or `sleep N; <check>`, restructure as `until <check>; do sleep N; done`. Examples:
- `sleep 4 && gh run list ...` → `until gh run list ... | grep -q completed; do sleep 5; done`
- Polling a deploy, a CI run, a pod becoming Ready, etc.

For one-shot "wait until done" of a known background task, use Bash `run_in_background` instead — runtime notifies on completion.
