# Typing

Depth on Rules 1–3 of `ruthless-python`. Read when designing a
signature, eliminating an `Any`, or picking a container type.

## Picking a container type

Goal: the type announces what the value _means_, not just its shape.

| Use case                                           | Use                                        |
| -------------------------------------------------- | ------------------------------------------ |
| Data crossing I/O / process boundary               | `pydantic.BaseModel`                       |
| Internal immutable value with behavior             | `@dataclass(frozen=True, slots=True)`      |
| Internal record, no behavior, no validation needed | `TypedDict` (or frozen dataclass)          |
| Tagged variants (sum type)                         | Union of `BaseModel`s with a `Literal`     |
| Fixed-shape heterogeneous record from external lib | `TypedDict`                                |
| Homogeneous sequence                               | `list[T]` / `Sequence[T]` / `tuple[T,...]` |
| Homogeneous mapping with known key set             | `TypedDict`                                |
| Homogeneous mapping with arbitrary string keys     | `dict[str, T]` (T concrete, never `Any`)   |
| Set semantics                                      | `set[T]` / `frozenset[T]`                  |

Rule of thumb: if you'd need a comment to explain what's in the dict,
it's a model.

## Eliminating `Any`

`Any` short-circuits the type checker. Every `Any` is a hole the
checker can't help you with. Strategies in order of preference:

1. **Find the real type.** Most "I need `Any`" cases are "I haven't
   read the docs of the lib I'm calling yet". Read the stubs.
2. **`object` if you genuinely don't care, then narrow.** `object`
   accepts anything but forces you to narrow before use — which is
   the safety `Any` throws away.
3. **`unknown`-style via `object` + `TypeGuard`.** For data you're
   about to validate, type it `object` (or `Mapping[str, object]`)
   and narrow through a `TypeGuard` or pydantic's `model_validate`.
4. **Generics.** If you're tempted to write `Any` because the type
   varies, that's a generic: `def first(xs: list[T]) -> T`.
5. **`Protocol`.** If you want "anything that has a `.read` method",
   that's a `Protocol`, not `Any`.
6. **`Callable[..., T]` with bounded params.** For decorators, use
   `ParamSpec` instead of `Any`.

If you still need `Any`, document why on the line above:

```python
# Any: pyyaml returns a recursive union pyright can't express;
# we validate via pydantic immediately below.
raw: Any = yaml.safe_load(text)
config = Config.model_validate(raw)
```

## Protocols vs ABCs

- **`Protocol` (structural)** when you care that something _has_
  certain methods, not that it inherits a class. Use for shapes that
  cross library boundaries (file-likes, async iterators, anything
  third-party objects might satisfy).
- **`ABC` (nominal)** when you control all implementations and want
  to force `isinstance` checks to pass / `match` patterns to match
  against the base.

Default to `Protocol`. ABCs are for closed hierarchies you own.

## Generics, `Self`, `TypeVar`

```python
from typing import Self

class Builder(BaseModel):
    def with_name(self, name: str) -> Self:
        return self.model_copy(update={"name": name})
```

`Self` is correct for fluent / builder / clone methods — it
propagates the subclass. Don't `TypeVar` what `Self` covers.

For free functions:

```python
def head[T](xs: list[T]) -> T | None: ...
```

(PEP 695 syntax — use it on Python 3.12+.)

## Exhaustive `match` with `assert_never`

```python
from typing import assert_never

def render(event: Event) -> str:
    match event:
        case Click():    return "click"
        case KeyPress(): return "key"
        case Scroll():   return "scroll"
        case _:          assert_never(event)
```

When you add a fourth variant to `Event`, pyright/mypy fails at the
`assert_never` line, pointing you at every site that needs updating.
This is the whole reason to use `match` for sum types.

## `TypeGuard` / `TypeIs`

When you must narrow `object` to a richer type at runtime:

```python
from typing import TypeIs

def is_user_row(row: object) -> TypeIs[UserRow]:
    return isinstance(row, dict) and "id" in row and "email" in row
```

`TypeIs` (3.13+) narrows in both branches; `TypeGuard` only narrows
the `True` branch. Prefer `TypeIs` when available.

## What never to write

- `from typing import Any` without a justification comment on its use.
- `-> dict` (bare) or `-> list` (bare).
- `def f(*args, **kwargs):` without `*args: T, **kwargs: U`.
- `cast(T, x)` as a way to silence the checker. Either narrow
  properly or fix the upstream type.
- `# type: ignore` without a specific error code: `# type: ignore[arg-type]`.
