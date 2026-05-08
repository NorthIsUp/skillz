---
name: Validate external data with pydantic, never cast as Any
description: When loading JSON or external data, validate with a pydantic model instead of force-casting as Any
type: feedback
---

Validate external data (JSON, API responses, file reads) through a pydantic model, not `Any` casts or bare `TypedDict`.

**Why:** `report: Any = json.load(f)` bypasses all type safety - it silently accepts malformed data and propagates unknown types. Pydantic catches structural mismatches at the boundary.

**How to apply:** When parsing JSON or external data into a typed structure, use `TypeAdapter.validate_python()` or `Model.model_validate()` instead of assigning to `Any`. Define the shape as a `BaseModel`, not a `TypedDict`. This rule is also documented in the toolchain skill's Rules section.
