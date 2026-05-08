---
name: Fly registry image cleanup
description: Plan to add periodic cleanup of old images from Fly.io's built-in registry (registry.fly.io)
type: project
---

Fly.io's built-in registry (registry.fly.io) has no TTL support. Plan to add a scheduled mise task or CI cron to clean up old images.

**Why:** Reduce stale image accumulation — Fly registry doesn't auto-expire.
**How to apply:** When building CI improvements, include a `ci:registry-cleanup` task or cron job that lists and deletes old images via flyctl.
