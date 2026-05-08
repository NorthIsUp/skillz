---
name: Platform stack follow-ups
description: Open items on the teamclara-platform Pulumi stack as of 2026-04-28
type: project
originSessionId: d1a35c46-7463-457f-b818-902ae7688a85
---
After bootstrap (commits f5ffd52 + ec73428), the platform stack is mostly green. Outstanding items:

**Tailscale**
- Run a Tailscale **peer relay / subnet router** node so tailnet clients can reach private VPC IPs (Cloud SQL `10.5.0.3`, in-cluster services) directly, not just through Connect Gateway. Likely deploy as a `Connector` CR managed by the Tailscale operator advertising the VPC + pod + service CIDRs.

**Why:** Connect Gateway only covers the k8s API server; pods + Cloud SQL + Memorystore aren't reachable from devs' laptops without it.

**How to apply:** Add a `Connector` resource in `infra/core/src/core/tailscale.py` (or new module) that advertises subnets. ACL needs a tag (e.g. `tag:k8s-relay`) with `tagOwners` self-ownership.

**Other open items**
- ARC needs a real GitHub App or PAT (`githubConfigSecret`); currently blocking `arc-runner-ci` helm release.
- Argo CD `root-app` needs a Repository credential to sync `manifests/bootstrap` from this repo.
- Gateway is HTTP-only; need cert-manager + GCP managed cert before HTTPS.
- `gha-ci` SA may need more roles depending on what CI does (currently has container.developer, artifactregistry.writer, iam.workloadIdentityUser).
- `promote.yml` references `secrets.TAILNET` and `secrets.ARGOCD_TOKEN` — not set.
