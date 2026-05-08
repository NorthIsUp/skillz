---
name: It isn't done if you haven't verified it
description: A merged PR or an applied manifest is not "done" — done means the change is observed working end-to-end against the real system. Don't claim completion based on a green commit or successful sync; verify the behavior.
type: feedback
originSessionId: ebf78e0f-dc9a-410e-b631-4422349723c2
---
It isn't done if you haven't verified it.

**Why:** I (Claude) have a habit of merging a PR and reporting "merged 🎉" or "should now work" without actually probing the resulting system. The user has had to repeatedly come back and tell me the thing didn't work — `OAuth state mismatch`, `502 Service Unavailable`, `MCPRemoteProxy Phase=Failed`, `Argo wiped the secret`. Every one of those was a case where I trusted the commit/merge as evidence of success when it wasn't.

**How to apply:** After merging an infra change OR applying a manifest, do at least one of these BEFORE saying "done":
- For an Argo Application: `kubectl get app <name> -n argocd` shows Synced + Healthy AND `kubectl get <resources>` shows them Ready.
- For a Pulumi change: `pulumi-up.yml` workflow ran to success AND the new exports actually resolve in ESC.
- For an HTTP endpoint change: `curl` it and confirm the expected status code + body shape.
- For an OAuth/auth flow: end-to-end at least one round-trip (or surface that browser interaction is needed and queue up the verification step explicitly).
- For a CRD-managed resource: `kubectl describe <kind> <name>` shows Phase=Running/Ready, NOT Pending/Failed.

If verification is blocked (auth expired, manual step required, browser flow needed), say so explicitly and don't claim completion. "Merged + waiting on auth refresh to verify" is honest. "Merged, sessions now persist 🎉" without actually re-running the OAuth flow is not.

**The trap to avoid:** "PR #N merged" → "should work now" → user hits the same error → I scramble. Never imply success without evidence. Symbols like ✅ or 🎉 require evidence under them, not optimism.
