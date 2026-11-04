---
name: ruthless-pypi
description: Publish Python packages to PyPI using API tokens and reusable mise file tasks. Use when setting up or running a PyPI release, debugging upload authentication, or adding package build and publish tasks.
---

# Ruthless PyPI

Use token-authenticated `uv publish` behind executable mise file tasks. Follow
the useful `we-love-*` release pattern: select a package, build its distributions,
upload only those artifacts, and verify the intended version on PyPI.

## The bar

- **Token auth is explicit.** Use `UV_PUBLISH_TOKEN`; accept the existing
  `PYPI_TOKEN` as a fallback. Unset `UV_PUBLISH_USERNAME` and
  `UV_PUBLISH_PASSWORD` in the upload process: stale values caused 403s in
  `we-love`. Pass `--trusted-publishing never` for this token workflow. Do not
  silently switch an existing trusted-publishing workflow to tokens.
- **Secrets come from the environment.** Let mise's configured secret provider
  (fnox where available), the existing login-shell setup, or CI secrets inject
  the token. Never commit it, print it, enable shell tracing, or put it in argv
  with `--token`. Prefer a project-scoped PyPI token; a first upload may need an
  account-scoped token until the project exists. A missing token fails with its
  variable name before any upload.
- **Versions are deliberate.** Check the intended version on PyPI, bump through
  the repo's version task, update affected internal dependency minimums and the
  lockfile, run the repo's checks/tests, and commit release changes. Compare
  versions with PEP 440 semantics, never shell string ordering. Existing `dist/`
  files are not a reason to bump automatically.
- **Build a bounded release set.** Pin uv through mise. Build a selected project
  with `uv build --no-sources` into a new, empty output directory. Inspect wheel
  and sdist metadata, README, dependencies, and included files. Smoke-test the
  wheel outside the source workspace on the declared minimum Python version.
  In a workspace, publish dependency packages first when released metadata
  requires their new versions; local source overrides must not hide missing
  dependencies on PyPI.
- **Upload the reviewed artifacts.** Reuse the build output rather than
  rebuilding after review or on retry. Never use a shared `dist/*` containing
  older versions or unrelated packages. A 403 means investigate token scope,
  project ownership, and conflicting credentials; do not loop retries. After a
  partial upload, use the same artifacts and `--check-url` to skip identical
  files. Different bytes under an existing filename require a new version.
- **Verify publication.** Query `https://pypi.org/pypi/<project>/<version>/json`
  with bounded retries (for example, 12 attempts five seconds apart). Require
  every intended filename and SHA-256 digest to match the local artifacts, then
  install the exact version from PyPI in a clean environment and smoke-test it.
  If visibility times out, report upload status and verification as separate
  facts. A successful build, merge, or upload command alone is not a verified
  release. Do not wait forever or swallow network failures as “not published.”

## Mise task templates

Copy [build](assets/mise-tasks/pypi/build) and
[publish](assets/mise-tasks/pypi/publish) into the target repo's
`mise-tasks/pypi/` directory and keep them executable. These are file tasks,
not `[tasks.*]` entries in `mise.toml`. They use Usage specs and `usage_*`
variables; pin `uv` and `usage` through the repo's mise configuration.

The build task refuses a nonempty output directory. The publish task requires
exactly one wheel and one sdist in that directory (allowing uv's `.gitignore`), supports a metadata dry run,
and pins production PyPI's upload and check URLs. For native wheels or batch
releases, adapt the artifact selection to an explicit reviewed manifest instead
of relaxing it to a broad glob. TestPyPI needs its own URLs and token; do not
send a production token to a different registry.

From the repo root, the sequence is:

```sh
mise run pypi:build --project . --out-dir dist/release
mise run pypi:publish --dist dist/release --dry-run
# After artifact review and authorization to publish:
mise run pypi:publish --dist dist/release
```

For a workspace member, set `--project packages/<distribution>` and give each
release its own output directory. A dry run checks metadata; it does not prove
that PyPI will accept the token or that an upload happened. Keep CI tokens in
secrets mapped to `UV_PUBLISH_TOKEN` and call the same mise tasks as local runs.

## Sources

- [uv publishing](https://docs.astral.sh/uv/guides/package/)
- [uv publish options](https://docs.astral.sh/uv/reference/cli/#uv-publish)
- [mise task arguments](https://mise.jdx.dev/tasks/task-arguments.html)

Adapted from `we-love/mise.toml`'s package publishing tasks and
`we-love/AGENTS.md`'s token-authentication and release-verification rules.
