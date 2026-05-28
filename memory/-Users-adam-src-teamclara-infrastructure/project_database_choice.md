---
name: Database choice
description: Neon was meant to be primary but Cloud SQL teamclara-pg is the real primary for litellm + dagster + production/staging as of 2026-05-04
type: project
originSessionId: 2ee13ce7-70f3-4f66-8216-233faf25834e
---

As of 2026-05-04, teamclara's database state on the ground:

- **Cloud SQL `teamclara-pg`** (us-central1, db-custom-1-3840, 10 GB, HA off, daily backups) is **actively in use**. It contains four user databases: `production`, `staging`, `shared` (litellm — see `manifests/apps/litellm/values.yaml: db.database: shared`), `dagster`.
- **Neon** (hosted, external) was the _intended_ primary per the original 2026-04-21 design (branching + scale-to-zero), but workloads have since landed on Cloud SQL instead. Whether Neon is still in use at all is unclear — verify before assuming.
- **AlloyDB** still rejected.

**How to apply:**

- Cloud SQL `teamclara-pg` is **on the critical path** — destroying it without a snapshot+export costs production data (litellm config, dagster run history, etc.).
- Any Pulumi change that affects `gcp.sql.DatabaseInstance` identity (region, name, deletion protection off→on transition) needs an explicit data-migration plan first.
- Region migration of the platform stack (e.g. us-central1 → us-east4) requires either: (a) export databases to GCS → restore in new region, OR (b) move workloads off Cloud SQL onto Neon first, OR (c) keep Cloud SQL in us-central1 and split the platform stack so GKE region changes don't drag the DB.
- Don't trust prior "warm standby / not wired to any app" claims — they were aspirational and the apps drifted onto Cloud SQL.
