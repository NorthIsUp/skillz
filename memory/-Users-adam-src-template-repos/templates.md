---
name: project-templates
description: Adam's GitHub template repos for scaffolding new Python and Rust projects, with single-pipeline release CI to PyPI / crates.io
type: reference
originSessionId: 321822de-13b7-4b13-ae3c-6312bfe183ae
---
When scaffolding a new Python or Rust project, use these GitHub template
repos via `gh repo create --template`:

- **Python** → `NorthIsUp/template-python` — mise, uv, ruff (we-love rules),
  pyright, pytest, hk pre-commit, single-pipeline CI that detects version
  bumps in `pyproject.toml` and auto-tags + builds + publishes to PyPI
  via OIDC trusted publishing.

- **Rust** → `NorthIsUp/template-rust` — mise, cargo, clippy
  (pedantic+nursery), rustfmt, hk, single-pipeline CI that detects version
  bumps in `Cargo.toml` and auto-tags + publishes to crates.io
  (`CARGO_REGISTRY_TOKEN` secret).

Source repo for the templates themselves: `/Users/adam/src/template-repos/`
(directories `python-uvx/` and `rust/`).

Version bumping in both: `mise run bump-{patch,minor,major}`. CI compares
the version in `HEAD` vs `HEAD~1` on `main` to decide whether to release —
GitHub Actions can't trigger workflows from `GITHUB_TOKEN`-pushed tags so
it's intentionally one workflow.

The `new-project` skill at `~/.claude/skills/new-project/` walks through
the full scaffolding flow.
