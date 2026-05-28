---
name: Celery SIGKILL bug (resolved)
description: Celery workers were getting SIGKILL on Fly.io production - fixed in PR #620 on 2026-04-02, removed Better Stack, added Datadog monitors
type: project
---

Celery workers on Fly.io production were getting SIGKILL (signal 9). Investigated 2026-04-02, fixed and merged same day as PR #620.

**Resolution:** PR #620 "fix: resolve Celery worker SIGKILL loop, remove Better Stack, add Datadog monitors admin". Key changes:

- Fixed the SIGKILL loop in heartbeat/healthcheck logic
- Removed Better Stack monitoring
- Added Datadog monitors admin for observability
- Branch was `adam/cla-666-celery-sigkill-9-bug-next`

**Why keep this memory:** Context for future Celery/worker issues. The fix is in `backend/clara_backend/heartbeat.py` and `backend/clara_backend/worker_healthcheck.py`. Monitoring moved from Better Stack to Datadog.

**How to apply:** If Celery worker issues resurface, start from PR #620's changes. Monitoring is now Datadog-based, not Better Stack. The old Better Stack docs in `documentation/infrastructure management.md` may be outdated.
