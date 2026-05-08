---
name: c4a/c4/n4 pools require hyperdisk-balanced
description: GKE node pools using c4a/c4/n4 machine families must explicitly set disk_type=hyperdisk-balanced; the default pd-balanced silently breaks scale-up
type: feedback
originSessionId: bc23f091-bba2-4171-91bd-000e43bc5c15
---
When creating a GKE NodePool with a c4a (Axion), c4, or n4 machine family, you MUST set `disk_type="hyperdisk-balanced"` on the node config. These third-gen GCE families do not support any pd-* boot disk.

**Why:** This bit us live on 2026-05-01 (post-#111 c4a swap). The pool was created with GKE's default `pd-balanced`. Every spot scale-up failed with `UNSUPPORTED_OPERATION: pd-balanced disk type cannot be used by c4a-standard-8 machine type`. The cluster-autoscaler surfaced it only as `Internal error` (and earlier `GCE quota exceeded` in a different zone), then dropped into per-zone exponential backoff up to 30m. 30 ARC runner pods sat Pending; CI queues for downstream apps stacked up. Fixed in [infrastructure#115](https://github.com/teamclara/infrastructure/pull/115).

**How to apply:**
- Always pin `disk_type="hyperdisk-balanced"` for any c4a/c4/n4 NodePool. Add it to `replace_on_changes` so a future disk swap rolls the IGM template instead of drifting in-place.
- When a GKE pool's autoscaler reports generic `Internal error` and IG size stays at 0, manually `gcloud compute instance-groups managed resize <igm> --size=1` to surface the real GCE error in the IG's `LAST_ERROR` field — the autoscaler eats the underlying message.
- During autoscaler backoff (5–30m), pre-warm zones via `gcloud ... resize` to drain queued pods immediately rather than waiting for backoff to clear.
- Cost delta hyperdisk-balanced vs pd-balanced is ~$0.02/GB-month and irrelevant for ephemeral spot CI disks.
