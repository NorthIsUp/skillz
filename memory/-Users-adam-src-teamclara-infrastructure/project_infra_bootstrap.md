---
name: Infrastructure repo bootstrap
description: teamclara/infrastructure repo structure — uv workspace with Pulumi stacks for dev/prod GKE clusters
type: project
---

The `teamclara/infrastructure` repo has no commits yet as of 2026-04-06. Working on `main`.

**Toolchain:**

- **mise** — tool version management (esc, gcloud, gitleaks, helm, hk, node, pkl, pulumi, python 3.13, ruff, shellcheck, uv, yamlfmt; dev: fnox, claude)
- **fnox** — secret management, 1Password provider, `[leases.pulumi-esc]` in fnox.toml runs `mise_tasks/pulumi-esc.sh`
- **pulumi ESC** — env/secrets via `esc env open "teamclara/development/$USER"`
- **hk** — git hooks (gitleaks, bandit, ruff, pyright, actionlint, shellcheck, hadolint, etc.)
- **uv** — Python dependency management (workspaces)

**Pulumi structure (`infra/`):**

- `core/` — shared package (src layout): `GCPProject` context manager, cluster, namespaces, IAM, ARC modules
- `dev/` — dev stack (Pulumi project `teamclara-dev`): ci + staging namespaces, ARC runners
- `prod/` — prod stack (Pulumi project `teamclara-prod`): production namespace, ARC runners
- `tests/` — pytest with Pulumi mocks, verifies all GCP resources have explicit project scope

**Blockers as of 2026-04-06:**

- No GCP billing account created yet (required for `pulumi up`)
- `gcloud auth` keeps expiring between sessions — re-auth needed each time

**How to apply:** When working in this repo, expect uv workspaces for Python, mise for tooling, Pulumi for infrastructure. The `GCPProject` context manager in `core/` auto-injects provider+project into child resources via `child_opts()`.
