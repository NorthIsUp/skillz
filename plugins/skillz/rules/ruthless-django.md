---
description: Django architecture — thin views, services/selectors, django-ninja schemas, ORM query discipline
alwaysApply: true
---

# Ruthless Django

Django-ninja is the API layer. Not DRF — no `ModelSerializer`, no
`APIView`, no `ViewSet`. Ninja schemas are pydantic models, so the
`ruthless-python` skill's typing bar applies to them unchanged.

## Layout

```text
project/
  config/settings/{base,local,production}.py, urls.py, wsgi.py
  apps/users/{models,schemas,api,services,selectors,urls}.py, tests/
  common/{models,permissions,pagination}.py
```

Writes go in `services.py`, reads in `selectors.py`. Views and route
handlers stay thin — a handler that does more than call one service or
selector and return its result has business logic in the wrong file.

## Fat models, fat managers

Behavior lives with the data. A model owns the logic about one instance;
its manager owns the logic about the set.

```python
class OrderQuerySet(QuerySet[Order]):
    def open(self) -> Self:
        return self.filter(status=Order.Status.OPEN)

    def with_totals(self) -> Self:
        return self.annotate(total=Sum(F("items__price") * F("items__quantity")))

class OrderManager(Manager.from_queryset(OrderQuerySet)):
    async def place(self, *, customer: Customer, items: list[LineItem]) -> Order:
        """Create the order, reserve stock, and emit confirmation — one transaction."""

class Order(Model):
    objects = OrderManager()

    @cached_property
    def total(self) -> Decimal: ...

    @asyncstdlib.cached_property
    async def customer_standing(self) -> Standing: ...

    def can_cancel(self, by: User) -> bool: ...
    async def cancel(self, *, by: User, reason: str) -> None: ...
```

Chainable querysets on the manager, not `Order.objects.filter(status=...)`
repeated across selectors — the second copy of a filter is a queryset
method.

**Async-first.** Anything touching the database is `async def` — `aget`,
`acreate`, `asave`, `adelete`, `aupdate_or_create`, `async for` over a
queryset, `sync_to_async` only at a boundary you can name in a comment.
Sync model methods are for pure computation over already-loaded fields.

**Cache liberally.** A model instance lives for one request and dies, so
per-instance caching is free correctness-wise — no invalidation problem
exists when the cache outlives nothing. `functools.cached_property` for
computed values, `asyncstdlib.functools.cached_property` for the async
ones. Reach for them by default, not as an optimization. The one place to
stop and think: an instance deliberately held across an
`await`-and-mutate cycle, or a long-lived object in a management command
or worker loop — there, cache what the DB can't change under you.

**`model_id` as the first parameter is the tell.** `def cancel_order(order_id,
...)` is a manager method (`Order.objects.cancel(pk, ...)`) or a classmethod;
`def cancel(order: Order, ...)` is a method on `Order`. Same rule as
ruthless-python Rule 5, one level down: if it takes the model, it belongs
on the model.

Services and selectors coordinate — across models, across apps, across
transactions and external calls. They are not a place to keep logic that
concerns a single model; that's the model's job, and a `services.py` full
of one-model functions is a fat model turned inside out.

## ORM

```python
Order.objects.select_related("customer", "customer__profile")          # FK / O2O: JOIN
Author.objects.prefetch_related(
    Prefetch("books", queryset=Book.objects.filter(published=True)))   # M2M / reverse FK
Post.objects.defer("body", "metadata")                                 # skip fat columns
User.objects.only("id", "email")                                       # or name the few you need
Product.objects.bulk_create(products, batch_size=1000)
Product.objects.bulk_update(products, ["price", "stock"], batch_size=1000)
```

Every list endpoint is paginated and has its query count asserted in a
test — `django-debug-toolbar` locally, `assertNumQueries` in CI. An N+1
that no test pins comes back.

## Schemas and routes

There is no serializer layer. `ninja.Schema` subclasses
`pydantic.BaseModel`, so serialization is pydantic and every pydantic
tool is available and expected: `Field` constraints, `field_validator` /
`model_validator`, `model_config`, discriminated unions, `Annotated`
types, nested models. Anything you would have written as a DRF
`SerializerMethodField`, `to_representation`, or a `validate_<field>`
hook has a pydantic form — use it.

```python
class OrderItemOut(ModelSchema):
    class Meta:
        model = OrderItem
        fields = ["id", "price", "quantity"]

class OrderOut(ModelSchema):
    customer_name: str
    items: list[OrderItemOut]
    total: Decimal

    class Meta:
        model = Order
        fields = ["id", "created_at"]

class OrderIn(Schema):
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def dates_ordered(self) -> Self:
        if self.start_date >= self.end_date:
            raise ValueError("end_date must be after start_date")
        return self

@router.get("/orders", response=list[OrderOut])
@paginate
def list_orders(request) -> QuerySet[Order]:
    return selectors.orders_for(request.user)
```

Derive from the model with `ModelSchema` rather than restating fields;
hand-written `Schema` is for input shapes the model doesn't have.
Computed values (`total` above) resolve from a model property or an
annotated queryset — never a per-row loop in serialization.

A schema is the wire contract, nothing more. Business rules ride on the
model or the service; validators enforce shape (ranges, formats, field
interdependence), not policy that needs a database read.

## Signals

Cross-app side effects only, and the handler dispatches rather than works:

```python
@receiver(post_save, sender=Order)
def order_created(sender, instance, created, **kwargs):
    if created:
        send_order_confirmation.delay(instance.id)
```

Same-app logic calls the service directly. A signal firing another app's
signal is untraceable at 3am.

## Reject on sight

| Smell                                          | Replace with                                           |
| ---------------------------------------------- | ------------------------------------------------------ |
| Logic in a view, handler, or schema            | A model method, manager method, or service             |
| `def f(order_id, ...)` in a service module     | `Order.objects.f(...)` or an `Order` method            |
| The same `.filter(...)` in two selectors       | A queryset method on the manager                       |
| Sync `.get()` / `.save()` in a request path    | `await obj.arefresh_from_db()`, `aget`, `asave`        |
| `sync_to_async` with no comment justifying it  | The `a`-prefixed ORM method                            |
| Recomputing a derived value twice per instance | `cached_property` (or the asyncstdlib one)             |
| `Model.objects.all()` in a list route          | A paginated selector                                   |
| Missing `select_related` / `prefetch_related`  | The right one, plus `assertNumQueries`                 |
| Signal for same-app logic                      | Direct service call                                    |
| Secret in `settings.py`                        | Environment variable read in `settings/base.py`        |
| Raw SQL with f-string interpolation            | Parameterized `.raw()` / `cursor.execute(sql, params)` |
| DRF serializer or `ViewSet`                    | `ninja.Schema` / `ModelSchema` + a `Router`            |
| `SerializerMethodField`, `to_representation`   | A pydantic computed field or model property            |
| Hand-rolled dict building in a handler         | A `Schema` — it's a pydantic model, let it serialize   |

Migrations get read before merge — a migration is a production
statement, not a generated artifact.
