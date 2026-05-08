---
name: CLA-820 GKE Actions Runners
description: GKE Standard cluster via Pulumi for self-hosted GitHub Actions runners using ARC (Actions Runner Controller)
type: project
---

Set up GKE Standard cluster on GCP using Pulumi to host self-hosted GitHub Actions runners via Actions Runner Controller (ARC).

**Why:** CI currently runs on GitHub-hosted runners. Self-hosted runners on GKE give autoscaling, ephemeral pods, and cost efficiency. Part of broader Pulumi adoption (CLA-786).

**How to apply:** 9-step plan — scaffold Pulumi infra/ project (Python), provision GKE cluster with Workload Identity + custom VPC + autoscaling node pool (n2-standard-4, 1-10), create 4 namespaces (ci, staging, production, arc-system), deploy ARC via Helm, configure RunnerScaleSets per namespace, GitHub App auth stored in Pulumi ESC, update CI to target self-hosted runners.

**Key decisions:**
- GKE Standard over Autopilot (Autopilot blocks privileged pods ARC needs)
- ARC over bare VM runners (autoscaling, ephemeral, cost-efficient)
- GitHub App over PAT for ARC auth (more secure, org-level)
- Python for Pulumi (matches backend language)

**Key files:** infra/Pulumi.yaml, infra/__main__.py, infra/cluster.py, infra/namespaces.py, infra/arc.py, infra/iam.py, .github/workflows/ci.yml

**Parent ticket:** CLA-729 (Infrastructure)
**Linear:** CLA-820
