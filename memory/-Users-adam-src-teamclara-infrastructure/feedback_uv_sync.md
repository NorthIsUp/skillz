---
name: Use uv for Python dependency management
description: Always use uv sync instead of pip install for Python dependencies in this project
type: feedback
---

Use `uv sync` instead of `pip install` for installing Python dependencies.

**Why:** User preference — the project uses uv (listed in mise.toml tools) as its Python package manager.

**How to apply:** When adding/installing Python dependencies, use `uv add <package>` and `uv sync` rather than editing requirements.txt manually and running pip install.
