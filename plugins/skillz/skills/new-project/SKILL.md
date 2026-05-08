---
name: new-project
version: 0.1.0
description: |
  Scaffold a new Python or Rust project from Adam's GitHub template repos.
  Uses gh repo create --template to start from a fully-configured template
  (mise + hk + ruff/pyright/pytest or clippy/rustfmt + semver release CI
  that auto-publishes to PyPI/crates on version bump).
  Use when asked to "create a new project", "scaffold a repo", "start a new
  python/rust project", "new repo", or "bootstrap a project".
triggers:
  - new python project
  - new rust project
  - scaffold a repo
  - bootstrap a project
  - start a new repo
---

# new-project

When the user wants to start a new Python or Rust project/repo, use Adam's
existing GitHub template repos rather than hand-rolling config files.

## Templates

| Language | Template repo | What it includes |
|----------|--------------|------------------|
| Python | `NorthIsUp/template-python` | mise · uv · ruff (we-love rules) · pyright · pytest · hk · single-pipeline release CI → PyPI (OIDC trusted publishing) |
| Rust | `NorthIsUp/template-rust` | mise · cargo · clippy (pedantic+nursery) · rustfmt · hk · single-pipeline release CI → crates.io (`CARGO_REGISTRY_TOKEN` secret) |

Both share the same release model: one CI workflow runs tests on every push;
on `main` it diffs the version field vs `HEAD~1` and, if bumped, tags
`v<version>`, builds, publishes, and creates a GitHub release. GitHub Actions
can't trigger workflows from `GITHUB_TOKEN`-pushed tags, so it's intentionally
one pipeline.

Bump versions with `mise run bump-{patch,minor,major}` — then commit and push.

## How to scaffold

1. Confirm the language and the new repo name with the user.
2. Pick the owner: default to `NorthIsUp` for personal projects; ask if it's
   a Clara project (could be `clara-health` or similar org).
3. Run:

   ```sh
   gh repo create <owner>/<name> \
       --template NorthIsUp/template-python \   # or template-rust
       --public \                                # or --private
       --clone
   ```

4. `cd <name>` and rename the package:
   - **Python**: edit `pyproject.toml` `name` + `[project.scripts]` entry,
     rename `src/my_package/` to `src/<new_name>/`, update `tests/`.
   - **Rust**: edit `Cargo.toml` `name` + `repository` URL.
5. Update README title/description.
6. Run `mise install && mise run sync` (Python) or `mise install` (Rust).
7. For Python publishing: remind the user to configure PyPI trusted
   publishing (Owner: `<owner>`, Repo: `<name>`, Workflow: `ci.yml`,
   Environment: `pypi`).
8. For Rust publishing: remind the user to add `CARGO_REGISTRY_TOKEN` as
   a repo secret.

## When NOT to use

- Project needs a framework-specific scaffold (Django, Next.js, Tauri, etc.)
  — use that framework's `create-*` tool instead.
- Working inside an existing repo — these are repo-level templates only.
- User explicitly wants to hand-roll config.
