---
name: Follow up until the task is actually successful
description: After any fix, don't declare success on first positive signal — verify the full end-to-end outcome and keep going if the underlying problem isn't fully resolved
type: feedback
originSessionId: bc23f091-bba2-4171-91bd-000e43bc5c15
---
After any infra/CI fix, do not declare success on the first positive signal. Verify the *complete* end-to-end outcome (all pods Running / queue fully drained / downstream checks green) and keep digging if there's still a gap.

**Why:** On 2026-05-01 the c4a runner-pool unblock turned out to have *two* layered failures:
1. Wrong boot disk (`pd-balanced` on c4a) — scale-ups silently failed.
2. C4A spot CPU quota too small — even after the disk fix, 27 of 30 instances hit `QUOTA_EXCEEDED`.

I shipped the disk fix, saw 1 pod schedule onto a manually-provisioned node, and reported "fix verified" / "queue will drain" before the second problem surfaced. The user had to tell me twice ("still too much queueing", "follow up to make sure the task was successful") before I dug deeper. The right move was to keep watching IG sizes vs target / pending pod count until they actually reached zero, and surface the next failure mode the moment the curve flattened.

**How to apply:**
- For any "thing should now scale / drain / catch up" claim, define the target metric explicitly (e.g., `pending_pods=0`, `IG.size==target`, `gh run list --status queued | wc -l == 0`) and poll until it hits the target — not until it starts moving.
- If progress stalls below the target (sizes stuck at 1/0/2 vs target 10/10/10 etc.), inspect *per-instance* state (`lastAttempt.errors`) before assuming "just slow." GCE silently sits in `CREATING` while every attempt fails — no event surfaces unless you look at the instance directly.
- After the fix is applied, end the autonomous session only when the queue is empty AND the autoscaler is reconciled back to the steady-state config (i.e. revert manual overrides like `--no-enable-autoscaling` once normal operation has resumed).
- Never tell the user "queue should drain in N min" without a concrete check scheduled at N+1 min that confirms it actually did.
