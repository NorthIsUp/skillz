---
name: Clara is async-first
description: Clara backend runs on ASGI/uvicorn; nearly 100% of functionality should be async def. Avoid async_to_sync.
type: feedback
originSessionId: aba3af78-e1bd-4716-90cd-2d7577d04a04
---

Clara V1 backend runs on ASGI (`uvicorn clara_backend.asgi:application`). Nearly 100% of functionality should be `async def` — views, services, ORM access, HTTP clients. Avoid `asgiref.sync.async_to_sync` except at true sync boundaries (Celery task entry points, management commands, signal handlers).

**Why:** The runtime is already an event loop. Wrapping async code in `async_to_sync` throws away the concurrency benefit and blocks a worker thread. User explicitly pushed back on a PR that exposed a sync batch helper backed by `async_to_sync` — the right shape is `async def ...` all the way through.

**Rule of thumb:** if the function touches I/O (DB, HTTP, disk, cache, queue), it should be `async def`. Sync is for pure CPU work.

**How to apply:**

- New views: `async def get/post(...)` on DRF/Django class-based views (Django 6 + DRF support it).
- ORM: use async QuerySet API — `.afirst()`, `.aget()`, `.aexists()`, `.acount()`, `.acreate()`, `.aupdate_or_create()`, `async for ... in qs`, `.aiterator()`.
- HTTP: `httpx.AsyncClient`, `asyncio.TaskGroup` for concurrent fan-out.
- Fall back to `sync_to_async(..., thread_sensitive=True)` only inside `transaction.atomic()` blocks or where a sync-only library is unavoidable.
- Celery tasks are the right place for `asyncio.run(coro)` to bridge back to async helpers.
- Services called from both web and Celery: prefer the async version as the primary; expose a thin `asyncio.run` wrapper for the Celery side, not `async_to_sync`.
