# Pydantic

Depth on Rules 4 & 5 of `ruthless-python`. Read when designing a model,
choosing between `BaseModel` and `dataclass`, writing a validator, or
shaping a `pydantic-ai` agent.

## Model design checklist

For every new model, decide:

1. **Mutability.** Default to `model_config = ConfigDict(frozen=True)`
   unless the model represents accumulating state.
2. **Extra fields.** Default to `extra="forbid"`. External input that
   carries unknown keys is a contract violation; surface it.
3. **Strict mode.** Use `strict=True` on validators or per-field
   `Strict[T]` for boundary models that must reject coercion (e.g.,
   `"1"` should not become `1`).
4. **Aliases at boundaries only.** If the wire format differs from
   your Python names (`camelCase` JSON, `snake_case` Python), use
   `Field(alias=...)` + `populate_by_name=True`. Don't sprinkle
   aliases on internal models.
5. **Names express the domain.** `User.email` not `User.email_str`.
   `Order.placed_at` not `Order.timestamp`.

```python
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

class User(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: UserId
    email: EmailStr
    created_at: datetime

    def with_email(self, email: EmailStr) -> "User":
        return self.model_copy(update={"email": email})

    def is_recent(self, *, now: datetime) -> bool:
        return (now - self.created_at).days < 7
```

Note **Rule 5**: `is_recent` and `with_email` are methods on `User`,
not free functions in a `user_utils.py`.

## Validators: when and which

- **`@field_validator("x", mode="before")`** — for coercion /
  normalization (`strip()`, lowercase, parse-from-str). Runs on the
  raw input.
- **`@field_validator("x", mode="after")`** — for per-field invariants
  on the typed value (range, length, regex). Default mode.
- **`@model_validator(mode="after")`** — for cross-field invariants
  ("if `kind == "tagged"`, then `tag` is required").
- **`Annotated[T, AfterValidator(fn)]`** — for reusable validators
  applied across many models. Preferred over class-level validators
  when the rule is reusable.

Don't validate at every layer. Validate at the boundary, then trust
the model internally.

## Discriminated unions

The right tool for tagged sum types. The discriminator lets pydantic
pick the variant in O(1) and gives you a real `match`-able shape:

```python
from typing import Literal, Annotated
from pydantic import BaseModel, Field

class Click(BaseModel):
    kind: Literal["click"] = "click"
    x: int
    y: int

class KeyPress(BaseModel):
    kind: Literal["key"] = "key"
    key: str

class Scroll(BaseModel):
    kind: Literal["scroll"] = "scroll"
    delta: int

Event = Annotated[Click | KeyPress | Scroll, Field(discriminator="kind")]

class EventBatch(BaseModel):
    events: list[Event]
```

Now `match event:` over `Click() | KeyPress() | Scroll()` is
exhaustive (close with `assert_never`).

## Settings (`pydantic-settings`)

```python
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_")

    database_url: str
    api_key: SecretStr
    debug: bool = False
```

Pass the `Settings` instance into your app's entry point; don't read
env vars inside functions. Use `SecretStr` for anything you don't
want logged.

## Test factories

Don't construct full models in every test. Build a factory:

```python
from datetime import datetime, UTC

def make_user(
    *,
    id: UserId | None = None,
    email: EmailStr = "test@example.com",
    created_at: datetime | None = None,
) -> User:
    return User(
        id=id or UserId("u_test"),
        email=email,
        created_at=created_at or datetime.now(UTC),
    )
```

Rules of thumb:

- Keyword-only args.
- Sensible defaults for every field.
- One factory per model. Don't subclass test models — overrides via
  the factory are enough.
- The factory lives in `tests/factories.py` or alongside the model
  if it's broadly useful.

## pydantic-ai agent shape

A pydantic-ai agent is three things: an input model, an output model,
and a set of tools. Keep them tightly typed; that's the whole point.

```python
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext

class TicketRequest(BaseModel):
    customer_id: CustomerId
    summary: str

class TicketResult(BaseModel):
    ticket_id: TicketId
    priority: Literal["low", "med", "high"]
    suggested_owner: UserId | None

class Deps(BaseModel):
    db: Database
    now: datetime

agent = Agent[Deps, TicketResult](
    model="anthropic:claude-sonnet-4-5",
    deps_type=Deps,
    output_type=TicketResult,
    system_prompt="...",
)

@agent.tool
async def lookup_customer(ctx: RunContext[Deps], id: CustomerId) -> Customer:
    return await ctx.deps.db.fetch_customer(id)
```

Conventions:

- **Output type is always a `BaseModel`**, never `str`. If you need
  prose, wrap it: `class Answer(BaseModel): text: str`.
- **Deps are a model**, not a `dict[str, Any]` and not loose kwargs.
- **Tools return models**, not dicts. The LLM sees the JSON schema
  and uses it.
- Run with `async with anyio.create_task_group()` if you're invoking
  multiple agents concurrently — Rule 7 still applies.

## Tortoise ORM + pydantic (database models)

For persistence, use Tortoise ORM. It's async-native (Rule 7), and its
pydantic integration lets the ORM model be the single source of truth
for both the DB row _and_ the API/tool schema — no hand-written
duplicate `BaseModel`s drifting from the table definition.

```python
from tortoise import Model, fields
from tortoise.contrib.pydantic import pydantic_model_creator

class User(Model):
    id = fields.IntField(pk=True)
    email = fields.CharField(max_length=255, unique=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    is_active = fields.BooleanField(default=True)

    class PydanticMeta:
        # Fields excluded from the *output* schema (e.g., hashes, internal flags).
        exclude = ("password_hash",)

    # Rule 5: behavior lives on the model.
    def is_recent(self, *, now: datetime) -> bool:
        return (now - self.created_at).days < 7

# Derived pydantic schemas — generated once, at module load.
UserSchema   = pydantic_model_creator(User, name="User")
UserCreate   = pydantic_model_creator(User, name="UserCreate", exclude_readonly=True)
```

### Conventions

- **Define the schema next to the model.** Never re-derive
  `pydantic_model_creator(User, ...)` inside a request handler — it's
  not free, and the type checker can't follow it. Module-level only.
- **Two schemas, minimum, per model**: a full read schema
  (`UserSchema`) and an input schema with `exclude_readonly=True`
  (`UserCreate`). Add more (`UserPublic`, `UserAdmin`) when the
  audience genuinely differs.
- **Use `PydanticMeta.exclude`** to keep secrets/internal columns out
  of the generated schema. Don't rely on remembering to strip them at
  the boundary.
- **Pass the schema, not the ORM model, across the boundary.**
  Convert with `await UserSchema.from_tortoise_orm(user)` at the edge
  (API response, queue payload, LLM tool result). Keep the ORM model
  inside the persistence layer.
- **No `dict[str, Any]` for query results.** If you find yourself
  reaching for `.values()` returning untyped dicts, define a
  `TypedDict` for the projection or select a narrower schema.

### Transactions and concurrency

```python
from tortoise.transactions import in_transaction

async def transfer(src_id: int, dst_id: int, amount: Money) -> None:
    async with in_transaction():
        src = await Account.get(id=src_id).select_for_update()
        dst = await Account.get(id=dst_id).select_for_update()
        src.balance -= amount
        dst.balance += amount
        await src.save()
        await dst.save()
```

`in_transaction()` is the only way to get atomicity. Don't lean on
"it's all one request so it'll be fine" — it won't be.

For concurrent reads across unrelated rows, combine with a task group
(Rule 7):

```python
async with anyio.create_task_group() as tg:
    tg.start_soon(lambda: User.get(id=a))
    tg.start_soon(lambda: User.get(id=b))
```

— but for _related_ rows you're going to mutate, do them serially
inside a transaction. Tortoise's connection-per-task model means
parallelism inside a transaction is a footgun.

### Don't

- Don't write a hand-rolled `BaseModel` that mirrors a Tortoise model
  field-for-field. Use `pydantic_model_creator`.
- Don't query with `.values()` returning `dict[str, Any]`. Either use
  the model or a typed projection.
- Don't use the sync ORM bindings or sync DBAPI calls. If a driver
  isn't async, you're on the wrong driver.
- Don't put business logic in repository/manager classes that take
  the model as an argument — those are Rule 5 violations in disguise.
  Put the logic on the model.

## Don't

- Don't subclass `BaseModel` to "add a helper method" that only some
  callers need. Add it to the base if it's universal; otherwise it's
  a separate concern that doesn't belong on the model.
- Don't use `model.dict()` (deprecated). Use `model.model_dump()`.
- Don't `model.json()` to a logger — `SecretStr` and friends round-
  trip safely through `model_dump_json()`, but log the model name +
  id, not the whole payload.
- Don't mock `BaseModel`s in tests. Build them with the factory.
- Don't `Any` your way around a validation problem. Either the input
  has a shape (model it) or it doesn't (it's `object`, narrow it).
