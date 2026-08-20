#!/usr/bin/env bash
# Self-check for auto-bump-plugins.sh. Run: mise run test-auto-bump
set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
pass=0 fail=0

check() { # check <label> <expected> <actual>
  if [[ "$2" == "$3" ]]; then
    pass=$((pass + 1)); echo "  ok   $1"
  else
    fail=$((fail + 1)); echo "  FAIL $1: expected '$2', got '$3'"
  fi
}

setup() { # setup -> echoes a temp repo with demo v0.1.0 tagged, other v9.9.9 tagged
  local d
  d=$(mktemp -d)
  mkdir -p "$d/scripts" "$d/.claude-plugin" \
    "$d/plugins/demo/.claude-plugin" "$d/plugins/other/.claude-plugin"
  cp "${repo}/scripts/bump-plugin.sh" "${repo}/scripts/auto-bump-plugins.sh" "$d/scripts/"
  cp "${repo}/.prettierrc.json" "$d/.prettierrc.json"
  echo '{"name":"demo","version":"0.1.0"}' >"$d/plugins/demo/.claude-plugin/plugin.json"
  echo '{"name":"other","version":"9.9.9"}' >"$d/plugins/other/.claude-plugin/plugin.json"
  cat >"$d/.claude-plugin/marketplace.json" <<'JSON'
{
  "plugins": [
    { "name": "demo", "version": "0.1.0", "tags": ["personal"] },
    { "name": "other", "version": "9.9.9", "tags": ["keep"] }
  ]
}
JSON
  echo hi >"$d/plugins/demo/rules.md"
  echo hi >"$d/plugins/other/rules.md"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  git -C "$d" add -A
  git -C "$d" commit -qm init
  git -C "$d" tag -a demo-v0.1.0 -m demo
  git -C "$d" tag -a other-v9.9.9 -m other
  # a bare remote so the script's push has somewhere to go
  git init -q --bare "$d.git"
  git -C "$d" remote add origin "$d.git"
  git -C "$d" push -q origin HEAD:main
  echo "$d"
}

ver() { jq -r '.version' "$1/plugins/$2/.claude-plugin/plugin.json"; }
market() { jq -r --arg n "$2" '.plugins[]|select(.name==$n)|.version' "$1/.claude-plugin/marketplace.json"; }

echo "auto-bump-plugins.sh"

# a changed plugin bumps; an untouched one does not
d=$(setup)
echo change >>"$d/plugins/demo/rules.md"
git -C "$d" commit -qam "touch demo"
(cd "$d" && GITHUB_REF_NAME=main scripts/auto-bump-plugins.sh >/dev/null)
check "changed plugin patch-bumps" "0.1.1" "$(ver "$d" demo)"
check "marketplace follows" "0.1.1" "$(market "$d" demo)"
check "untouched plugin left alone" "9.9.9" "$(ver "$d" other)"
check "bump is committed" "" "$(git -C "$d" status --porcelain)"
check "bump is pushed" "$(git -C "$d" rev-parse HEAD)" "$(git -C "$d" rev-parse origin/main)"
rm -rf "$d" "$d.git"

# docs-only counts too: 100% of changes under the plugin tree must bump
d=$(setup)
echo doc >"$d/plugins/demo/README.md"
git -C "$d" add -A && git -C "$d" commit -qm "docs"
(cd "$d" && GITHUB_REF_NAME=main scripts/auto-bump-plugins.sh >/dev/null)
check "docs-only change bumps" "0.1.1" "$(ver "$d" demo)"
rm -rf "$d" "$d.git"

# a hand-made minor bump wins: its version has no tag, so we leave it alone
d=$(setup)
echo change >>"$d/plugins/demo/rules.md"
(cd "$d" && scripts/bump-plugin.sh demo minor >/dev/null)
git -C "$d" commit -qam "feature + minor bump"
(cd "$d" && GITHUB_REF_NAME=main scripts/auto-bump-plugins.sh >/dev/null)
check "hand-bumped version untouched" "0.2.0" "$(ver "$d" demo)"
rm -rf "$d" "$d.git"

# nothing changed -> no commit at all
d=$(setup)
before=$(git -C "$d" rev-parse HEAD)
(cd "$d" && GITHUB_REF_NAME=main scripts/auto-bump-plugins.sh >/dev/null)
check "no changes, no commit" "$before" "$(git -C "$d" rev-parse HEAD)"
rm -rf "$d" "$d.git"

echo "  ${pass} passed, ${fail} failed"
[[ $fail -eq 0 ]]
