---
description: Django architecture — fat models and managers, thin handlers, layered validation, django-ninja schemas, ORM query discipline
alwaysApply: true
---

# Ruthless Django

Django-ninja is the API layer. Not DRF — no `ModelSerializer`, no
`APIView`, no `ViewSet`. Ninja schemas are pydantic models, so the
`ruthless-python` skill's typing bar applies to them unchanged.

## Layout

```text
project/
  config/settings/{base,local,production}.py, urls.py, asgi.py
  apps/orders/
    models/{__init__,order,line_item}.py   # each model + its QuerySet/Manager together
    api.py                                  # ninja Router
    schemas.py
    services.py                             # cross-model orchestration; often absent
    tests/
  common/{models,permissions,pagination}.py
```

**Code goes where its dependencies are**, not by read-vs-write. Three
homes, and the question that picks one:

| Depends on                                    | Lives on              |
| --------------------------------------------- | --------------------- |
| One instance's own fields                     | model method/property |
| A query shape over one model                  | queryset / manager    |
| Multiple models, external calls, transactions | `services.py`         |

Reads and writes both occur at all three levels, which is why there's no
`selectors.py`: a read over one model is a queryset method, and a read
spanning models is a service. A selector module is a queryset method with
the chaining removed.

Route handlers stay thin — a handler that does more than call one of the
three and return its result has business logic in the wrong file.

## Fat models, fat managers

Behavior lives with the data. A model owns the logic about one instance;
its manager owns the _query vocabulary_ for the set.

```python
class OrderQuerySet(QuerySet[Order]):
    def open(self) -> Self:
        return self.filter(status=Order.Status.OPEN)

    def with_totals(self) -> Self:
        return self.annotate(total=Sum(F("items__price") * F("items__quantity")))

class Order(Model):
    objects = OrderManager.from_queryset(OrderQuerySet)()

    @cached_property
    def total(self) -> Decimal: ...

    @asyncstdlib.cached_property
    async def customer_standing(self) -> Standing: ...

    def can_cancel(self, by: User) -> bool: ...
    async def cancel(self, *, by: User, reason: str) -> None: ...
```

Chainable querysets, not `Order.objects.filter(status=...)` copied across
call sites — the second copy of a filter is a queryset method.
`Order.objects.open().with_totals()` composes; an `order_list(filters=...)`
function does not.

**Managers get fat with queries, never with flows.** A method that
reserves stock, charges a card, and emails a receipt is not an `Order`
method just because it happens to create one — it touches three models
and an external service, and putting it on `OrderManager` picks an owner
by accident. That's `services.py`. The tell: the method's body names a
model the manager doesn't manage.

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

**One `model_id` as the first parameter is the tell.** `def
cancel_order(order_id, ...)` is a manager method or a classmethod; `def
cancel(order: Order, ...)` is a method on `Order`. Same rule as
ruthless-python Rule 5, one level down. But count the models first — a
function taking `order_id` _and_ `warehouse_id` is correctly a service;
the heuristic only fires when a single model owns every argument.

Services own what no single model can: work spanning models or apps, an
external call, a `transaction.atomic` block, anything the domain names
but the schema doesn't. A `services.py` full of one-model functions is a
fat model turned inside out; a `services.py` that's empty because the app
really is one model is a healthy outcome, not a missing file.

## Validation

Three layers, innermost first — push each rule as far down as it goes.

```python
class Course(BaseModel):
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                name="start_date_before_end_date",
                check=Q(start_date__lt=F("end_date")),
            )
        ]

    def clean(self) -> None:
        if self.start_date >= self.end_date:
            raise ValidationError("end_date must be after start_date")
```

1. **`Meta.constraints`** — the database enforces it on every write path,
   including bulk operations, `update()`, migrations, and psql. A rule
   that can be a `CheckConstraint` or `UniqueConstraint` is one.
2. **`clean()`** — multi-field checks over the instance's own fields, when
   the rule is simple and needs no query. Since Django 4.1 `full_clean()`
   also runs constraints, so you get one `ValidationError` for both.
3. **The service** — anything spanning relations, fetching data, or
   calling out. Call `full_clean()` before `save()`; it's the only thing
   that runs layer 2.

Schema validators are a fourth, outermost layer, and they belong to the
wire contract, not the domain — see below.

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
| Manager method touching a model it doesn't own | A service                                              |
| The same `.filter(...)` at two call sites      | A queryset method on the manager                       |
| Business logic in `save()`                     | A service — bulk paths skip `save()` entirely          |
| Validation only in `clean()`                   | A `CheckConstraint` too, if the DB can express it      |
| `.save()` in a service with no `full_clean()`  | `obj.full_clean()` first — it's what runs `clean()`    |
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
