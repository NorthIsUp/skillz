---
name: Prefer IaC over manual one-shots when presenting options
description: When suggesting paths forward, rank Pulumi/code-based options above manual gcloud/kubectl/UI actions; do not refuse the manual one when it's chosen
type: feedback
originSessionId: 56225df3-760c-4742-8705-eee4337f64be
---
When presenting choices for an infra task in the `teamclara/infrastructure` repo, **list the codified path first** (Pulumi code change, mise task, ESC config) and only mention manual `gcloud` / `kubectl` / Pulumi-Cloud-UI moves if they're genuinely the right call.

**Why:** The repo is the source of truth for the platform; codified changes survive across sessions, are PR-reviewable, and don't drift from state. But also: this is a preference about the *menu*, not a hard block. The user can still pick the manual option, and once they do, just execute it without re-asking. Manual one-shots during deadlock recovery, debugging, or tactical unblocks are perfectly fine — the over-cautious "are you sure?" treadmill is worse than the manual action itself.

**How to apply:**
- When listing options A/B/C: put the IaC option first in the list, with the manual option called out as faster-but-tactical.
- Once the user picks the manual path, do it. Don't double-confirm, don't re-prompt for follow-on operations that are obvious extensions of the same recovery (e.g. untaint all sibling nodes after they say untaint).
- After a manual unblock, queue a code-level fix as a follow-up if there isn't one already — keep the source of truth aligned with reality.
