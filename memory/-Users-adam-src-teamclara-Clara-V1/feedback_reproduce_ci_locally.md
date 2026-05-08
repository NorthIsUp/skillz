---
name: Reproduce CI failures locally via mise-only PATH
description: Running lint/test commands with the user's full PATH can mask tool-availability failures in CI where only mise-installed tools are on PATH
type: feedback
originSessionId: d3703023-4730-4581-b065-26406513a4e0
---
When debugging CI failures, running `hk check --pr` or `mise run ci:lint --ci` (which invokes `hk check --pr` under the hood) in a normal shell can silently succeed because globally-installed binaries (via npm, pipx, brew, etc.) are on PATH. CI only has what mise installs.

**Why:** CI runner PATH is `$(mise bin-paths)` plus system essentials. If a tool isn't in `mise.toml` it won't be found in CI — even if the lint rule invokes it by bare name.

**How to apply:** Before claiming "works locally" during CI debugging, run with mise-only PATH. Both `hk check --pr` and `mise run ci:lint --ci` must be tested this way — they use the same hk step config but are the two surfaces people reach for:

```bash
# Minimum: verify tool is mise-resolved, not from global npm/pipx/etc
mise which <tool>
# If it errors, the tool is global only and missing from mise.toml

# Full reproduction: strip PATH to mise + system essentials, run BOTH surfaces
env -i HOME="$HOME" PATH="$(mise bin-paths | tr '\n' ':')/usr/bin:/bin" hk check --pr
env -i HOME="$HOME" PATH="$(mise bin-paths | tr '\n' ':')/usr/bin:/bin" mise run ci:lint --ci
```

The sort-package-json failure in CLA-939 rename PR was this exact pattern: locally it passed because `/Users/adam/.local/share/npm/bin/sort-package-json` existed from a prior `npm install -g`. CI had no such binary. Fix was to add it to `mise.toml` [tools] with `npm:sort-package-json` alias.

Related: rename PRs surface ANY latent lint/check issue that was hiding behind the "only check changed files" gate. Every file becomes "changed" so every rule fires on every file, exposing tool-availability holes, pre-existing whitespace/EOF issues, stale allowlist paths, etc.
