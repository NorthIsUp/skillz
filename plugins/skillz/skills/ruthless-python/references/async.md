# Async

Depth on Rule 7 of `ruthless-python`. Read when designing concurrent
work, choosing between `gather` / task groups / threads, or debugging
a "task was never awaited" / orphaned-task issue.

## Why `TaskGroup` is the default

Structured concurrency. Three guarantees you get for free:

1. **No orphaned tasks.** When the `async with` block exits, every
   task inside it is finished (success, failure, or cancellation).
2. **Errors propagate.** One task raising cancels the siblings and
   re-raises through the `async with` as an `ExceptionGroup`. No
   silent swallowing.
3. **Cancellation is hierarchical.** Cancelling the group cancels
   the children. Cancelling a parent cancels nested groups.

`asyncio.gather(*tasks, return_exceptions=True)` violates all three:
errors get hidden in the returned list, tasks outlive failures, and
cancellation is on you.

## The canonical pattern

```python
import anyio

async def fetch_all(urls: list[str]) -> list[Response]:
    results: list[Response] = []

    async def fetch(url: str) -> None:
        results.append(await client.get(url))

    async with anyio.create_task_group() as tg:
        for url in urls:
            tg.start_soon(fetch, url)

    return results
```

Notes:

- `tg.start_soon(fn, arg1, arg2, ...)` — args are passed positionally,
  not as a coroutine. Don't write `tg.start_soon(fn(arg))`.
- Mutating a shared list from concurrent tasks is fine _because_ the
  asyncio scheduler is cooperative — but prefer collecting into per-
  task locals and assembling at the end when results are ordered.

For ordered results, use a memory stream or pre-sized list:

```python
async def fetch_all(urls: list[str]) -> list[Response]:
    results: list[Response | None] = [None] * len(urls)

    async def fetch(i: int, url: str) -> None:
        results[i] = await client.get(url)

    async with anyio.create_task_group() as tg:
        for i, url in enumerate(urls):
            tg.start_soon(fetch, i, url)

    return [r for r in results if r is not None]
```

## Cancellation & timeouts

```python
with anyio.move_on_after(5.0):
    await slow_thing()

with anyio.fail_after(5.0):  # raises TimeoutError on expiry
    await slow_thing()
```

Cancellation propagates _into_ task groups. A `fail_after` around a
task group cancels every child when it fires.

When writing code that _handles_ cancellation:

```python
try:
    await long_running()
except BaseException:
    # Cleanup that MUST happen — but don't swallow.
    await cleanup()
    raise
```

Use `BaseException` (not `Exception`) so `CancelledError` is caught
for cleanup, then re-raised. Never `except CancelledError: pass`.

## Async iteration: prefer `asyncstdlib`

```python
import asyncstdlib as a

async def first_three_active(users: AsyncIterator[User]) -> list[User]:
    return await a.list(a.islice(a.filter(lambda u: u.active, users), 3))
```

Recipes:

| Sync                            | Async (with `asyncstdlib as a`)  |
| ------------------------------- | -------------------------------- |
| `[f(x) for x in xs]`            | `[await f(x) async for x in xs]` |
| `list(map(f, xs))`              | `await a.list(a.map(f, xs))`     |
| `next(filter(p, xs))`           | `await a.anext(a.filter(p, xs))` |
| `zip(a, b)`                     | `a.zip(a_iter, b_iter)`          |
| `functools.reduce(f, xs, init)` | `await a.reduce(f, xs, init)`    |
| `itertools.chain(a, b)`         | `a.chain(a_iter, b_iter)`        |
| `@functools.cached_property`    | `@a.cached_property`             |

`asyncstdlib` handles cleanup of async iterators correctly — hand-
rolled `async for` + early `break` can leak.

## Streams (anyio memory channels)

For producer/consumer fan-out where order doesn't matter and you
want backpressure:

```python
send, recv = anyio.create_memory_object_stream[Item](max_buffer_size=32)

async def producer() -> None:
    async with send:
        async for item in source:
            await send.send(item)

async def consumer() -> None:
    async with recv:
        async for item in recv:
            await handle(item)

async with anyio.create_task_group() as tg:
    tg.start_soon(producer)
    for _ in range(4):
        tg.start_soon(consumer)
```

Closing the send end signals all consumers to finish their iteration
cleanly. No sentinel values, no None-checks.

## When to break the rules

You may reach past `TaskGroup` if (and only if):

- **CPU-bound work**: use `anyio.to_thread.run_sync` or a process
  pool. Document why the work can't be async (it's truly CPU-bound).
- **Fire-and-forget background work that outlives the request**: a
  long-lived task group on a service-level object (e.g., the app),
  _not_ a loose `create_task`.
- **Sync API surface**: `anyio.from_thread.run` to call async from
  sync code. Limit the surface; don't sprinkle this everywhere.

If you write `asyncio.create_task` directly, add a comment on the
line above explaining why a task group doesn't fit.

## Common bugs

- **Forgetting `await`.** Pyright catches most; configure
  `reportUnusedCoroutine = "error"`.
- **`time.sleep` in async code.** Blocks the loop. Use
  `await anyio.sleep(...)`.
- **`requests` / sync HTTP in async code.** Blocks the loop. Use
  `httpx.AsyncClient`.
- **`gather(..., return_exceptions=True)` "to be safe".** This
  silences errors. Use a task group; if you genuinely want
  per-task results-or-errors, model it explicitly with
  `Result[T, E]` or `tuple[T | None, Exception | None]`.
- **Cancellation eaten by bare `except`.** Always re-raise
  `CancelledError`.
