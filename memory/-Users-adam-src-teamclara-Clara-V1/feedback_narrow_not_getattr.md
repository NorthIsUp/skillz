---
name: Narrow types with assert/match, not getattr
description: Prefer assert/match/isinstance over getattr/cast/type:ignore when pyright can't see a type
type: feedback
originSessionId: f5a94eb5-9ea9-447f-b06f-e025b9baa64a
---

When pyright can't infer a type, narrow with runtime checks the type-checker actually understands: `assert x is not None`, `if isinstance(x, Foo):`, `match obj: case Foo():`. Avoid `getattr(obj, "name", default)` and `typing.cast(T, x)` and `# type: ignore` - they silence pyright without proving anything to it, hiding typos, renamed attrs, and wrong types.

**Why:** I added `email = getattr(user, "email", None) if user else None` to satisfy pyright when `obj.user` resolved to `OneToOneField` instead of the related model. Adam called it out: getattr defeats type-checking, the whole point of being fully typed. `assert isinstance(user, User)` would have narrowed properly without the lie.

**How to apply:** Reach for `cast` only when integrating with a genuinely untyped third-party API and there is no narrowing path available. For Django ORM relations specifically, the right fix is django-stubs, not getattr workarounds.
