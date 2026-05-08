---
name: Prefer native anyio over to_thread.run_sync
description: anyio.to_thread.run_sync is an anti-pattern — use anyio.Path, anyio.run_process, etc. instead
type: feedback
---

`anyio.to_thread.run_sync` is a last resort for wrapping external libraries that have no async API. For filesystem ops use `anyio.Path`, for subprocesses use `anyio.run_process`, etc.

**Why:** User considers run_sync an anti-pattern that defeats the purpose of async code.
**How to apply:** When writing async code, always check if anyio has a native async equivalent before falling back to run_sync. Only use run_sync for third-party libraries (like presidio) that are inherently synchronous.
