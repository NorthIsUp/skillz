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

## Which library

Stop at the first rung that covers the job (Rule 7):

1. Native — `asyncio.TaskGroup`, `ExceptionGroup` / `except*`, `asyncio.timeout`.
2. `asyncstdlib as a` — async `itertools` / `functools` / builtins.
3. `anyio` — memory streams, `to_thread` / `from_thread`, cancel scopes, `anyio.Path`, trio support.
4. Remaining `asyncio` primitives — `Queue`, `Semaphore`, `Event`.

The examples below use the highest rung that does the job; the `anyio`
ones are there because the stdlib has no equivalent, not by preference.

## The canonical pattern

```python
async def fetch_all(urls: list[str]) -> list[Response]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(client.get(url)) for url in urls]

    return [t.result() for t in tasks]
```

Notes:

- `tg.create_task(coro())` takes a coroutine — unlike anyio's
  `tg.start_soon(fn, *args)`, which takes the function and its args.
- Results are ordered because the task list is. Read `.result()` after
  the block exits, never inside it.
- A failing task cancels its siblings and surfaces as an
  `ExceptionGroup`; handle it with `except*`.

```python
try:
    await fetch_all(urls)
except* httpx.HTTPError as eg:
    log.warning("%d fetches failed", len(eg.exceptions))
```

## Cancellation & timeouts

```python
async with asyncio.timeout(5.0):       # raises TimeoutError on expiry
    await slow_thing()

with contextlib.suppress(TimeoutError):  # the "move on" form
    async with asyncio.timeout(5.0):
        await slow_thing()
```

Cancellation propagates _into_ task groups: a timeout around a task
group cancels every child when it fires. Reach for `anyio`'s cancel
scopes only when you need a shielded scope or a deadline you reset
mid-flight.

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

## Filesystem: `anyio.Path`

```python
p = anyio.Path(root) / "config.toml"

if await p.exists():
    text = await p.read_text()

async for entry in (anyio.Path(root) / "logs").iterdir():
    ...
```

Same API as `pathlib.Path`, awaitable where it hits the disk. Keep
plain `pathlib.Path` for path algebra that never touches the
filesystem — joins, `.name`, `.suffix`, `.parent`, `.relative_to` — and
convert at the point of I/O. `open()`, `Path.read_text()`, `os.listdir`,
and `glob` in async code all block the loop.

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
  `await asyncio.sleep(...)`.
- **`requests` / sync HTTP in async code.** Blocks the loop. Use
  `httpx.AsyncClient`.
- **Sync file I/O in async code.** `open()`, `Path.read_text()`,
  `glob`, `os.stat` all block. Use `anyio.Path`.
- **`gather(..., return_exceptions=True)` "to be safe".** This
  silences errors. Use a task group; if you genuinely want
  per-task results-or-errors, model it explicitly with
  `Result[T, E]` or `tuple[T | None, Exception | None]`.
- **Cancellation eaten by bare `except`.** Always re-raise
  `CancelledError`.
