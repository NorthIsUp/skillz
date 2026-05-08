---
name: lint:bandit mise task
description: Python SAST task at scripts/mise_tasks/lint/bandit - architecture, output format, and CI integration
type: project
---

`mise run lint:bandit` lives at `scripts/mise_tasks/lint/bandit`. It wraps bandit with pydantic validation (`BanditResult`, `BanditReport`) and three output modes.

**Why:** Replaces the CI-only bandit job in `security-checks.yml` with a shared mise task usable locally (via hk pre-commit) and in CI. HIGH issues block, MEDIUM are informational.

**How to apply:** When touching security checks or hk linting, use `mise run lint:bandit`. The hk.pkl `bandit` step calls `mise run lint:bandit -- {{files}}` for per-file pre-commit mode.

## Output modes
- `tui` (default, TTY): Rich rust-style diagnostics - cyan `┌─` header, underlined source line, `▲` pointer at col_offset, continuation lines for multi-line spans
- `plain` (non-TTY / pipe): one-liner `file:line:col: SEVERITY test_id (name) message`
- `github` (set `--format github`): `::error`/`::warning` GitHub Actions annotations

## Key implementation details
- Reads source file directly (`_read_line()`) for accurate indentation - never trust bandit's `code` field for col alignment
- `col = col_offset - indent` (strips leading whitespace like phi-scan does)
- Multi-line spans: `line_range` lists all lines; continuation lines strip only first-line indent to preserve relative indentation
- `highlight=False` on all source lines to prevent Rich auto-syntax-highlighting
- `escape()` on all source text to prevent Rich markup injection
- `end_col_offset < col_offset` means multi-line span → highlight to EOL

## CI
`security-checks.yml` bandit job now just runs `mise run lint:bandit` via `jdx/mise-action`. `deploy.yml` is the only fully redundant workflow (staging job disabled, superseded by ci.yml → ci-deploy.yml).
