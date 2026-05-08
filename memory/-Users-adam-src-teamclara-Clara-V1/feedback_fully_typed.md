---
name: Fully typed code - no exceptions
description: Every function, variable, and constant must have type annotations; TypedDict is not enough for external data
type: feedback
---

All code must be fully typed per CLAUDE.md: every function signature, return type, and non-obvious local variable. No `Any` casts, no bare `dict`, no untyped constants.

**Why:** User explicitly corrected two lapses in one session - untyped `dict` return and `report: Any = json.load(f)`. CLAUDE.md says "Fully typed, always — no exceptions".

**How to apply:**
- Constants need types: `CI: bool = ...`, not `CI = ...`
- Use `Literal["a", "b"]` for constrained string types (enables exhaustive match checking)
- `TypedDict` is for describing shapes of existing dicts; use `BaseModel` for data you construct or validate
- External JSON → `TypeAdapter.validate_python()` or `Model.model_validate()`, never `Any`
- `dict` without type args is an error; always specify key/value types: `dict[str, str | int]`
