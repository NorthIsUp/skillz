---
name: PHI scan architecture
description: phi-scan now runs in pre-commit (hk) with --fix support, stale lock detection, and trap cleanup
type: project
---

phi-scan (`mise run lint:phi-scan`) runs in hk pre-commit as of 2026-04-08 (PR #665). Previously was pre-push only.

**Why:** Moving to pre-commit lets it use hk's `fix = true` mode, which runs `--fix-accept-all` to auto-ignore findings during commit.

**How to apply:**
- `hk check` runs phi-scan in check mode (fails on findings)
- `hk fix` runs phi-scan with `--fix-accept-all` (auto-ignores all findings)
- Both hk.pkl steps have `trap 'rm -f .baselines/phi.lock' EXIT INT TERM` to clean up locks if shell is killed
- The Python script has stale lock detection: checks if the PID in phi.lock is alive, auto-removes dead locks
- SIGTERM handler added alongside existing SIGINT handler for lock cleanup
- CI still uses the separate `phi-scan.yml` workflow (spaCy model load too slow for ci.yml runners)
