---
name: Use hk for linting and validation
description: Use `hk check` and `hk fix` for linting/validation instead of manual tools like pyyaml or custom validation scripts
type: feedback
---

Use `hk check` to lint/validate files and `hk fix` to auto-fix issues, instead of ad-hoc validation like `python -c "import yaml; yaml.safe_load(...)"`.

**Why:** The project uses `hk` as its pre-commit/linting tool. It runs yamlfmt, detect-secrets, trailing-whitespace, end-of-file-fixer, and other checks. Using it ensures the same validation that CI and pre-commit hooks use.

**How to apply:** After editing any file, run `hk check` to validate. If issues are found, run `hk fix` to auto-fix. Don't install or use separate linting tools.
