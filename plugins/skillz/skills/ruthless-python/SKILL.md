---
name: ruthless-python
description: |
  Modern Python best practices for any Python code in this workspace —
  writing, editing, reviewing, or designing. Use this whenever touching
  a `.py` file: it sets the bar for typing (100% typed, no bare `Any`),
  data modeling (pydantic first), control flow (`match` over
  `isinstance`), and concurrency (async-native, `TaskGroup`). Also fires
  for related phrases like "make this more Pythonic", "type this
  properly", "clean up this Python", "add types", "async this", or
  reviewing a pull request that changes Python code.
---

# Ruthless Python

The standing bar for Python in this workspace. Declarative: each rule
states _what_ good code looks like and _why_, so the principle applies
to cases the rule doesn't literally cover.

## The bar

- **Rule 1 — 100% typed.** Every signature, every attribute, every return. No untyped `def`, no implicit `Any` from a missing annotation. Pyright/mypy clean.
- **Rule 2 — `Any` and `object` are last-resort.** If you use one, add a one-line comment above the annotation explaining _why_ a precise type isn't possible (untyped third-party lib, true dynamic dispatch, serialization boundary). No `Any` without that justification.
- **Rule 3 — Never return `list[Any]` or `dict[str, Any]`.** That's a missing type, not a type. Define a `TypedDict`, dataclass, or pydantic model and return that. See `references/typing.md`.
- **Rule 4 — Pydantic first for data with shape or boundaries.** Anything crossing an I/O boundary (HTTP, queue, file, LLM tool call, config) is a `pydantic.BaseModel`. Internal value objects can be `@dataclass` (frozen, slots) or `TypedDict`. Plain dicts are not a data model. See `references/pydantic.md`.
- **Rule 5 — Methods live on the model, not in utility modules.** If a function's first argument is a `User`, it's a method on `User`. Don't write `def _normalize_email(user: User) -> str` in a `helpers.py`; write `User.normalize_email(self) -> str`. Behavior belongs with the data it operates on. Reasons it matters:
  - Discoverability: `user.<TAB>` shows what a `User` can do; grepping `helpers.py` does not.
  - Refactor safety: renaming the field updates call sites via the type checker; loose utility functions silently rot.
  - Polymorphism: subclasses / discriminated unions can override; free functions can't.

  Exceptions (rare, deliberate):
  - The function legitimately operates on two unrelated types at the same level (`def merge(a: A, b: B) -> C`).
  - It's a pure constructor / parser that returns the model from raw input — that's a `@classmethod` (e.g., `User.from_row`), not a free function.
  - It's a cross-cutting concern with no natural owner (logging, tracing). Even then, prefer a method on the cross-cutting object (`tracer.span(...)`) over `do_traced(thing)`.

  Example:

  ```python
  # Bad
  def calculate_total(order: Order) -> Money: ...
  def is_expired(token: Token) -> bool: ...
  def to_row(user: User) -> UserRow: ...

  # Good
  class Order(BaseModel):
      def total(self) -> Money: ...

  class Token(BaseModel):
      def is_expired(self) -> bool: ...

  class User(BaseModel):
      def to_row(self) -> UserRow: ...
  ```

- **Rule 6 —** `match` **over** `isinstance` **chains.** Pattern matching declares the _shape_ of the data; an `isinstance` ladder hides it in imperative branches. Convert any three-arm `isinstance` chain. Use `assert_never(x)` in the catch-all so the type checker flags missing variants.

  ```python
  match event:
      case Click(x=x, y=y):     ...
      case KeyPress(key=key):   ...
      case Scroll(delta=delta): ...
      case _:                   assert_never(event)

  match event.mode:
      case "open": ...
      case "closed":...
      case _: ...

  ```

- **Rule 7 — Async-native. I/O is `async` wherever the library allows it.** Every network call, file read, subprocess, sleep, and DB query is awaited; a sync I/O call in async code is a bug unless a comment names why no async path exists. `TaskGroup` is the default concurrency primitive — never `asyncio.gather`, raw `create_task`, threads, or `concurrent.futures` without a specific reason in a comment.

  **Reach in this order, and stop at the first rung that covers it:**

  1. **Native structured concurrency** — `asyncio.TaskGroup`, `ExceptionGroup` / `except*`, `asyncio.timeout`. Stdlib, no dependency, and what every reader already knows.
  2. **`asyncstdlib`** (`import asyncstdlib as a`) — async `itertools` / `functools` / builtins: `a.map`, `a.filter`, `a.zip`, `a.islice`, `a.cached_property`, `a.lru_cache`. Reads exactly like its sync counterpart, which is the point.
  3. **`anyio`** — when you need what the stdlib lacks: memory object streams, `to_thread` / `from_thread`, cancel-scope nuance, or trio compatibility.
  4. **The rest of `asyncio`** — primitives with no equivalent above (`Queue`, `Semaphore`, `Event`, loop internals).

  Two rungs both work → take the higher one. See `references/async.md`.

  **Paths are `anyio.Path`.** There's no stdlib async `pathlib`, so this is rung 3 by default, not by exception. Same API as `pathlib.Path`, awaitable: `await p.read_text()`, `await p.exists()`, `async for child in p.iterdir()`. Plain `pathlib.Path` is fine for pure path algebra that never touches the disk (`/` joins, `.name`, `.suffix`, `.parent`) and in sync-only code; the moment a path is read, written, stat'd, or globbed from async code, it's `anyio.Path`.

- **Rule 8 — Succinct, low-magic.** Prefer comprehensions, model declarations, and stdlib iter tools over hand-rolled loops. Avoid metaclasses, dynamic class creation, monkeypatching, clever decorators. Some magic (descriptors, `__init_subclass__`, pydantic validators) earns its keep — pick it deliberately, never by default.
- **Rule 9 — Tests are pytest; async tests use anyio.** No bare `asyncio` in tests, no `unittest`. Use `@pytest.mark.anyio` (or set `anyio_mode = "auto"`). Don't mock pydantic models — construct them; that's what they're for. Don't mock async iterators — use `asyncstdlib`. See "Testing" below.

- **Rule 10 — Never `pickle`. Serialize through pydantic.** `pickle.loads` on anything you didn't produce is arbitrary code execution, and even when the input is trusted the format is unversioned: the blob embeds a class path and an instance `__dict__`, so renaming the class, moving the module, or adding a field breaks every stored value with no migration path and no error until load. A pydantic model gives you a validated schema, JSON on the wire, and a place to put a version tag:

  ```python
  class CachedProfile(BaseModel):
      v: Literal[2] = 2          # bump on a breaking change; old readers reject loudly
      user_id: int
      display_name: str

  blob = profile.model_dump_json()
  profile = CachedProfile.model_validate_json(blob)   # rejects a v1 blob instead of silently decoding it wrong
  ```

  Same rule for the calls that pickle without saying so: `shelve`, `dill`, `joblib`, `pandas.to_pickle`, `numpy.load(allow_pickle=True)`, `torch.save` of a whole model. Cross-process handoff is JSON or a real format (Parquet, Arrow, safetensors). What a framework does inside its own storage layer isn't your problem — this is about the serialization _you_ write.

## Library defaults

Reach for these first; don't introduce alternatives without a reason:

- `pydantic` — data models, settings, validation.
- `pydantic-ai` — LLM agents, tool calls, structured outputs.
- `fastapi` — HTTP API. Async-native, pydantic-native. Routes take and return pydantic models; the OpenAPI schema in the docs _is_ the schema in the code. Pair with the Tortoise-derived schemas below — never hand-write a parallel `BaseModel` for an endpoint that returns a DB row. See `references/fastapi.md`.
- `tortoise-orm` — async ORM. Use `tortoise.contrib.pydantic.pydantic_model_creator` to derive pydantic schemas straight from the ORM models, so the same source of truth covers both the DB row and the API/tool schema. See `references/pydantic.md`.
- `asyncstdlib` (as `a`) — async equivalents of `itertools` / `functools` / `builtins` (`a.map`, `a.filter`, `a.zip`, `a.cached_property`). Rung 2 of Rule 7.
- `anyio` — memory object streams, thread bridging, cancel scopes, `anyio.Path`, trio compatibility. Rung 3: what the stdlib doesn't cover.
- `pytest` (+ anyio's pytest plugin) — tests.

Before adding a new dependency, check whether `anyio` or `asyncstdlib` already covers it.

## Tooling

- **Ruff is the formatter and the linter.** `ruff format` for formatting, `ruff check` for linting — one tool, one config. Not `black`, not `flake8`, not `isort`, not `pylint`. No formatting or style opinions in this skill or in code review; ruff decides. Configure rules in `[tool.ruff.lint]` in `pyproject.toml`; don't ship `# noqa` lines without an inline reason.
- **Pyright is the type-checker.** Not mypy, not pytype. Pyright enforces Rules 1, 2, 3, and the exhaustiveness of Rule 6. Configure `typeCheckingMode = "strict"` in `[tool.pyright]` (or `pyrightconfig.json`) and treat warnings as errors. The checks that matter most: `reportUnusedCoroutine`, `reportMissingTypeStubs`, `reportUnknownArgumentType`, `reportUnknownMemberType`, `reportImplicitOverride`.
- **Pre-push pipeline: `ruff format && ruff check --fix && pyright`.** Ruff does formatting + style; pyright does correctness. If `hk` / `pre-commit` is wired up, that's the canonical entry point.

## When you're editing Python

- **Read the surrounding module.** Match its existing patterns where they agree with this skill; flag (don't silently rewrite) places where the existing code violates it but isn't in scope.
- **Type as you go.** Don't leave a function half-typed for "later".
- **Model the data once.** If a dict is passed between three functions, it should be a pydantic model or `TypedDict` before the third — not a fourth.
- **Co-locate behavior with data.** When you find yourself writing the second utility function that takes the same model as its first argument, stop and make both into methods on the model.
- **Replace `isinstance` chains with `match**` at three arms or any tagged union.
- **Audit concurrency.** Loose `create_task` calls or bare `gather(..., return_exceptions=True)` are usually bugs in waiting — convert to a `TaskGroup`.

## Testing (the short version)

- Layout: tests live next to source as `test_*.py`, or in a parallel `tests/` tree mirroring the package.
- One behavior per test. The name says what it asserts: `test_user_create_rejects_empty_email`.
- Async: `@pytest.mark.anyio` on async tests; parametrize the backend if the code is supposed to work under both asyncio and trio.
- Fixtures: a test-file helper that builds and returns a domain object is a fixture, not a private function. `_make_user(...) -> User` becomes a `@pytest.fixture` returning the factory, so it composes with the fixtures it needs (`db`, `settings`, a stub clock) and a `conftest.py` can override it per package:

  ```python
  @pytest.fixture
  def make_user(db: None) -> Callable[..., User]:
      """Unique username/email per call, so assertions never collide with existing rows."""

      def _make(prefix: str, *, is_active: bool = True) -> User:
          suffix = uuid.uuid4().hex[:12]
          return User.objects.create(username=f"{prefix}-{suffix}", email=f"{prefix}-{suffix}@example.com", is_active=is_active)

      return _make
  ```

  A `Protocol` types the keyword arguments when `Callable[..., User]` is too loose. Prefer several small factory fixtures over one giant shared fixture.

- Don't mock what you own. Construct real pydantic models. Mock only at I/O boundaries (HTTP, DB, time, randomness).
- Property-based tests (`hypothesis`) earn their keep for parsers, validators, serializers.

See `references/pydantic.md` for model factory patterns.

## Anti-patterns (reject on sight)

| Smell                                          | Replace with                                      |
| ---------------------------------------------- | ------------------------------------------------- |
| `def f(x):` (no annotations)                   | Full signature with types                         |
| `-> dict[str, Any]` / `-> list[dict]`          | `TypedDict` or pydantic model                     |
| `def helper(model: M, ...)` in a utils module  | A method on `M`                                   |
| `def _make_user(...) -> User` in a test file   | `@pytest.fixture` returning the factory           |
| Three-arm `if isinstance(x, A): ... elif ...`  | `match x: case A(): ...`                          |
| `asyncio.gather(*tasks)` for fan-out           | `async with asyncio.TaskGroup() as tg:`           |
| `asyncio.create_task(f())` then forgetting it  | `tg.create_task(f())` inside a task group         |
| `asyncio.wait_for(...)` for a deadline         | `async with asyncio.timeout(...):`                |
| `threading.Thread` for I/O concurrency         | async + task group                                |
| `time.sleep` in async code                     | `await asyncio.sleep(...)`                        |
| `open(...)` / `Path.read_text()` in async code | `await anyio.Path(p).read_text()`                 |
| `os.path` / `pathlib` for disk access          | `anyio.Path` (plain `Path` for path algebra only) |
| Hand-rolled `async for` accumulation loop      | `import asyncstdlib as a` → `a.map` / `a.filter`  |
| `for x in await collect_all(): ...`            | `async for x in stream: ...` (via `asyncstdlib`)  |
| Plain dict as a data carrier across modules    | pydantic model (or `TypedDict` if internal-only)  |
| `**kwargs: Any` for config                     | A `BaseModel` for config; pass the model          |
| `@property` doing real I/O                     | Make it an explicit `async def` method            |
| `cast(T, x)` to silence pyright                | Fix the type at the source, or `TypeGuard`        |
| `pickle` / `shelve` / `dill` for persistence   | `model_dump_json()` + `model_validate_json()`     |
| `pandas.to_pickle`, `numpy` `allow_pickle`     | Parquet / Arrow / `npz` without pickle            |
| A model instance as a cache or queue payload   | A versioned pydantic schema, dumped to JSON       |
| Stored blob with no version field              | A `v: Literal[N]` on the model                    |

## Reviewing Python (PRs, diffs)

Walk the diff against the bar. For each violation, quote the line and propose the replacement. Lead with the rule number ("Rule 3: `dict[str, Any]` return — model as `UserRecord` (TypedDict)") so the author can map feedback back to the standard.

## Reference files (load on demand)

- `references/typing.md` — eliminating `Any`, when each container type fits, `Protocol` vs `ABC`, generics, `Self`, `TypeGuard`, `assert_never` for exhaustiveness.
- `references/async.md` — the four-rung library ladder, `TaskGroup` patterns, `asyncio.timeout`, `asyncstdlib` recipes, `anyio.Path`, memory streams.
- `references/pydantic.md` — model design, validators, settings, discriminated unions, model factories for tests, `pydantic-ai` agent shape, Tortoise ORM + `pydantic_model_creator`.
- `references/fastapi.md` — router and endpoint shape, dependency injection (`Depends`), lifespan + Tortoise wiring, error responses, testing with `httpx.AsyncClient`.
