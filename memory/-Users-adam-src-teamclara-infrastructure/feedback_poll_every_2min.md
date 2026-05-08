---
name: Poll every 2 minutes when waiting
description: When waiting on a long-running task (CI, pulumi-up, deploy), use ScheduleWakeup with delaySeconds=120 to fire a re-check every 2 minutes
type: feedback
originSessionId: 798cb3e8-b6fd-4d11-90ce-6e5fb9194904
---
When waiting on a long-running task (CI run, pulumi-up, k8s rollout, deploy verification), schedule a 120-second wakeup via `ScheduleWakeup` to come back and re-check state — don't sit silently or use longer delays.

**Why:** The user wants tight visibility on in-flight work. 2 minutes is short enough to feel responsive, long enough to actually advance state between checks, and well within the 5-minute prompt-cache TTL so cost stays low (~6 checks per cache window).

**How to apply:**
- For "wait + report" loops: `ScheduleWakeup(delaySeconds=120, prompt=<self-pacing instruction>, reason="checking <thing>")`. Replace ad-hoc background `until` polls when feasible.
- Don't use 300+ second delays — busts the cache.
- If a task wraps up faster than 2 minutes, that's fine — the user can interrupt.
- Stop scheduling when the wait resolves (success / fail / blocker that needs human input). Don't keep firing on a settled state.
