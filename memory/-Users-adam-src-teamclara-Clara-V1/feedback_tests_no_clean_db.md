---
name: Tests must not assume a clean DB
description: Backend tests must never rely on a pristine database — scope all assertions to test-owned data
type: feedback
originSessionId: 0d8dbbce-aad1-4c48-91db-728a63da7044
---

Tests must never assume the database is clean. No `Model.objects.count() == N`, no `assert_called_once()` on whole-table scans, no `objects.create()` for shared/seed rows.

**Why:**

- Async ORM writes (`acreate`/`asave`/`AsyncClient`) bypass pytest-django's test transaction (they run on a thread-local connection that isn't enrolled). Those rows commit and persist past the test, across `--reuse-db` sessions, and across xdist workers that share the test DB.
- Migration-seeded rows can be mutated by other tests that don't clean up.
- The async-first design choice (per the user's `feedback_clara_async_first` memory) makes leaked-write contamination structural, not avoidable.

**How to apply:**

- Filter every read-side assertion to the test's own data: `Model.objects.filter(pk=self_created.pk).exists()`, not `Model.objects.count() == 1`. For mock assertions on whole-table-scanning code, filter mock_calls by the test's own row id.
- Use `get_or_create` (not `create`) for shared identifier rows (anything with a UniqueConstraint on natural keys like name+dob). Even sync TestCase tests need this — `setUp` rolls back via savepoint, but async-leaked rows persist outside savepoints.
- Anti-pattern: `Model.objects.all().delete()` at start of test. This violates the same principle (assumes ownership of the table) and can wipe migration-seeded data other tests depend on.
- Anti-pattern: tests that mutate global rows (`SupportedState.objects.filter(code='WA').update(is_enabled=True)`) without restoring on teardown. Wrap such mutations in module/class-scoped fixtures that snapshot+restore.
