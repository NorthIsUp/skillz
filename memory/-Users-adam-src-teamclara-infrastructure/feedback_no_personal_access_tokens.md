---
name: No personal access tokens
description: teamclara/infrastructure policy — never propose PATs as auth, only long-lived Apps/SAs/WIF/OAuth clients
type: feedback
originSessionId: d1a35c46-7463-457f-b818-902ae7688a85
---

For teamclara infrastructure: **never propose or use personal access tokens (PATs)** for any service-to-service auth. Only mechanisms that survive the originating person leaving the company:

- **GitHub Apps** (e.g. clara-ci-bot for ARC, separate install of Google's Cloud Build App if needed)
- **GCP service accounts** (Workload Identity Federation, Workload Identity)
- **OAuth clients** (e.g. tailscale operator)
- **Webhook secrets** (rotatable shared secrets, not user creds)

**Why:** PATs are tied to a user account. When that user leaves or revokes, every system depending on the PAT breaks. Discovery is painful, often happens at the worst moment. Apps/SAs are tied to an org/project — survive personnel changes.

**How to apply:**

- When a system "needs a PAT", look for an App-based equivalent first.
- For Cloud Build v2 GitHub auth specifically: prefer webhook triggers (`webhookConfig`) over `repositoryEventConfig` if the latter requires a PAT in `authorizer_credential`.
- For ad-hoc CLI access where only PAT is supported (rare), document it as a per-developer thing, not a platform credential.

**Exception:** GitHub's own "fine-grained PAT scoped to a single repo with read-only" _might_ be acceptable if the only alternative is "do this manually forever", but only with a clear rotation policy and ownership in CODEOWNERS.
