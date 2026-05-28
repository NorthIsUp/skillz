---
name: Always prefer latest stable versions
description: When picking a chart, image tag, or library version, default to the latest stable release rather than pinning to whatever I happened to find first.
type: feedback
originSessionId: ebf78e0f-dc9a-410e-b631-4422349723c2
---

Always prefer the latest stable release when picking a chart version, container image tag, library version, or similar.

**Why:** Old versions miss CVE patches, lack newer API surfaces (e.g. ToolHive v0.12 forced inline OIDC; v0.24 brought v1beta1 with cleaner refs we actually wanted), and locking in a stale baseline creates upgrade debt that compounds.

**How to apply:** Before pinning any external dependency (Helm chart `targetRevision`, image `tag:`, OCI digest, language SDK), check the latest stable release tag (e.g. `helm show chart oci://... --version <highest>` or the project's GitHub Releases). Pick that. Only pin to an older version if there's a concrete blocker — a known regression, an explicit compat note in CHANGELOG, or a paired component that hasn't caught up. Always state the reason in a comment when you do pin to something older.
