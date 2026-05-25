# FastAPI

Depth on the FastAPI library default. Read when adding an endpoint,
wiring lifespan resources, designing dependencies, or testing a route.

## Route shape

Endpoints are async, type their inputs, and return pydantic models.
Never `dict[str, Any]`, never bare strings (Rule 3).

```python
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import current_user
from app.models import User
from app.schemas import UserSchema, UserCreate

router = APIRouter(prefix="/users", tags=["users"])

@router.post("", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate) -> User:
    if await User.exists(email=payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "email already in use")
    return await User.create(**payload.model_dump())

@router.get("/{user_id}", response_model=UserSchema)
async def get_user(user_id: int, _: User = Depends(current_user)) -> User:
    user = await User.get_or_none(id=user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return user
```

Notes:

- `response_model=...` is the schema FastAPI uses to serialize the
  return. With Tortoise-derived schemas, this is the same model that
  documents the API.
- Return the ORM model; let `response_model` do the conversion. Don't
  hand-serialize.
- `async def` always. There is no reason to use sync `def` here —
  Rule 7.

## Dependencies (`Depends`)

`Depends` is the only DI surface you need. Use it for: request-scoped
resources (DB session if you weren't on Tortoise's global model),
auth, feature flags, settings, anything cross-cutting.

```python
from fastapi import Depends, Header
from app.settings import Settings, get_settings

async def current_user(
    authorization: str = Header(),
    settings: Settings = Depends(get_settings),
) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    user = await User.get_or_none(api_token=token)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED)
    return user
```

Rules of thumb:

- **Dependencies return models, not dicts.** `current_user` returns
  `User`, not `dict[str, Any]`.
- **One dependency = one responsibility.** Auth is a dep. Settings is
  a dep. A "context bundle" combining ten things is a smell.
- **Use `Annotated[T, Depends(fn)]`** for reusable deps:

  ```python
  from typing import Annotated
  CurrentUser = Annotated[User, Depends(current_user)]

  @router.get("/me", response_model=UserSchema)
  async def me(user: CurrentUser) -> User:
      return user
  ```

## App + lifespan + Tortoise wiring

Use the `lifespan` context manager — not the deprecated `on_event`.
Run a `TaskGroup` inside lifespan for any background work that lives
as long as the app.

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

import anyio
from fastapi import FastAPI
from tortoise import Tortoise

from app.settings import get_settings
from app.routers import users, tickets

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    await Tortoise.init(
        db_url=settings.database_url,
        modules={"models": ["app.models"]},
    )
    try:
        async with anyio.create_task_group() as tg:
            app.state.tasks = tg
            yield
    finally:
        await Tortoise.close_connections()

app = FastAPI(lifespan=lifespan, title="Clara API")
app.include_router(users.router)
app.include_router(tickets.router)
```

The task group on `app.state` is where long-lived background workers
go (queue consumers, schedulers). Don't reach for `asyncio.create_task`
from inside a handler — Rule 7.

## Errors

- **Use `HTTPException`** for expected error paths (404, 409, 401,
  422). FastAPI serializes it correctly and the docs reflect it.
- **Don't catch-and-rewrap your own exceptions** at every layer. Let
  domain exceptions bubble; map them to HTTP at the boundary, once.
- **Validation errors are automatic.** A `UserCreate` with a bad
  field returns 422 with a structured error body — don't try-except
  pydantic `ValidationError` in the handler.

For domain → HTTP mapping, use an exception handler:

```python
from app.errors import DomainError

@app.exception_handler(DomainError)
async def handle_domain_error(_: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"error": exc.code})
```

## Testing

Use `httpx.AsyncClient` with FastAPI's ASGI transport. No
`TestClient`, no sync requests, no event-loop wrangling.

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

@pytest.mark.anyio
async def test_create_user_rejects_duplicate(client: AsyncClient) -> None:
    body = {"email": "a@example.com"}
    assert (await client.post("/users", json=body)).status_code == 201
    assert (await client.post("/users", json=body)).status_code == 409
```

The test mounts the real ASGI app and hits real routes — no mocks,
no half-app. This is how you catch wiring bugs (a router not
registered, a dep that fails to resolve).

## Don't

- Don't define request/response models as standalone `BaseModel`s
  duplicating Tortoise fields. Use `pydantic_model_creator`.
- Don't put business logic in route handlers. The handler validates,
  dispatches to the model (Rule 5: `User.create_with_audit(...)`),
  and returns. If a handler is more than ~10 lines, the logic
  belongs on a model or service.
- Don't accept `dict` or `Any` as a body type. Always a pydantic
  model. If the body is genuinely free-form (rare), model it as
  `RootModel[dict[str, T]]` for a known `T`.
- Don't use FastAPI's sync `def` route shorthand. Stay async-native.
- Don't write a custom dependency injection container. `Depends` is
  enough — if it isn't, you've outgrown FastAPI for the wrong reason.
