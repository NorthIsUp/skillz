#!/usr/bin/env bash
# Self-check for bump-plugin.sh. Run: mise run test-bump
set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
bump="${repo}/scripts/bump-plugin.sh"
pass=0 fail=0

check() { # check <label> <expected> <actual>
  if [[ "$2" == "$3" ]]; then
    pass=$((pass + 1)); echo "  ok   $1"
  else
    fail=$((fail + 1)); echo "  FAIL $1: expected '$2', got '$3'"
  fi
}

setup() { # setup -> echoes a fresh temp repo dir
  local d
  d=$(mktemp -d)
  mkdir -p "$d/plugins/demo/.claude-plugin" "$d/.claude-plugin"
  cp "${repo}/.prettierrc.json" "$d/.prettierrc.json"
  echo '{"name":"demo","version":"0.1.16"}' >"$d/plugins/demo/.claude-plugin/plugin.json"
  cat >"$d/.claude-plugin/marketplace.json" <<'JSON'
{
  "plugins": [
    { "name": "demo", "version": "0.1.16", "tags": ["personal", "skills"] },
    { "name": "other", "version": "9.9.9", "tags": ["keep", "me"] }
  ]
}
JSON
  # normalize fixtures to prettier's own output so drift is the script's fault, not ours
  prettier --write "$d/plugins/demo/.claude-plugin/plugin.json" "$d/.claude-plugin/marketplace.json" >/dev/null
  echo "$d"
}

ver_manifest() { jq -r '.version' "$1/plugins/demo/.claude-plugin/plugin.json"; }
ver_market() { jq -r --arg n "$2" '.plugins[]|select(.name==$n)|.version' "$1/.claude-plugin/marketplace.json"; }

echo "bump-plugin.sh"

for case in "patch 0.1.17" "minor 0.2.0" "major 1.0.0"; do
  set -- $case
  d=$(setup)
  (cd "$d" && "$bump" demo "$1" >/dev/null)
  check "$1 bumps plugin.json to $2" "$2" "$(ver_manifest "$d")"
  check "$1 bumps marketplace.json to $2" "$2" "$(ver_market "$d" demo)"
  rm -rf "$d"
done

# the regression this script exists for: jq expands arrays prettier keeps inline
d=$(setup)
(cd "$d" && "$bump" demo patch >/dev/null)
if (cd "$d" && prettier --check .claude-plugin/marketplace.json plugins/demo/.claude-plugin/plugin.json >/dev/null 2>&1); then
  pass=$((pass + 1)); echo "  ok   output is prettier-clean"
else
  fail=$((fail + 1)); echo "  FAIL output is not prettier-clean"
fi
check "other plugins untouched" "9.9.9" "$(ver_market "$d" other)"
rm -rf "$d"

# rejects bad input
d=$(setup)
(cd "$d" && "$bump" demo sideways >/dev/null 2>&1) && rc=0 || rc=1
check "rejects invalid level" "1" "$rc"
(cd "$d" && "$bump" nope patch >/dev/null 2>&1) && rc=0 || rc=1
check "rejects unknown plugin" "1" "$rc"
rm -rf "$d"

echo "${pass} passed, ${fail} failed"
[[ $fail -eq 0 ]]
