---
name: Use ruff for Python linting
description: Run ruff check on Python files before claiming they work
type: feedback
---

Run `uvx ruff check <file>` on Python scripts before finishing. It catches issues like undefined names, positional args to BaseModel, etc.

**Why:** User pointed out ruff would have caught a pydantic BaseModel positional arg error.
**How to apply:** After editing Python files, run ruff as a quick sanity check.
