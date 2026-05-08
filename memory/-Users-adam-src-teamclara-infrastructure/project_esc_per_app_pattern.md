---
name: ESC per-app env pattern
description: New convention for app-specific secrets in Pulumi ESC — separate env per app, imported into platform/clara
type: project
originSessionId: 790c3d6e-12c9-4e75-ae3b-a5b4f28d2bb4
---
App-specific secrets live in their own Pulumi ESC env at `teamclara/platform/app-<app-name>` (e.g., `teamclara/platform/app-linear-agent-bridge`), then imported into `teamclara/platform/clara` so the cluster's ClusterSecretStore (which only reads from `platform/clara`) sees them.

Structure inside the per-app env:
```yaml
values:
  app:
    <app-name>:
      <secret_keys>: ...
  environmentVariables:
    <ENV_VAR_NAME>: ${app.<app-name>.<secret_key>}
    ...flat non-secret config like BASE_URL, DEBUG_PAYLOAD here too
```

ExternalSecret manifests reference values via `remoteRef.key: environmentVariables.<ENV_VAR_NAME>` — flat path, avoids hyphen-in-key issues with the gjson-style lookup in ESO's Pulumi provider.

**Why:** User wanted clear ownership boundaries per app. Single-use creds aren't shared across consumers, so packing everything into `platform/clara` flat became messy. Per-app env makes it obvious what belongs to what and what to delete when an app goes away.

**How to apply:** When adding a new app that needs ESC-backed secrets, create `teamclara/platform/app-<name>` first, populate it, add `imports: [platform/app-<name>]` to `platform/clara`, then write the chart's externalsecret.yaml using `environmentVariables.*` paths. User said (2026-05-02) we should backfill existing apps to this pattern over time.
