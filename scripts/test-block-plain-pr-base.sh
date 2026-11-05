#!/usr/bin/env bash
# Self-check the ruthless-stacks PreToolUse gate: every hand-set non-default PR
# base is blocked; the default branch, `gh stack`, quoted mentions and the
# PLAIN_BASE_OK=1 grant are not.
set -uo pipefail

hook="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/plugins/skillz/bin/block-plain-pr-base"

# A repo whose default branch is `trunk`, so "default" is read, not assumed.
repo=$(mktemp -d)
trap 'rm -rf "$repo"' EXIT
git -C "$repo" init -q
git -C "$repo" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/trunk

fails=0
# check <expected-exit> <label> <command> [cwd]
# JSON-encode a command with builtins: a jq per case was most of the test's runtime.
payload() {
	local c=${1//\\/\\\\}
	c=${c//\"/\\\"}
	c=${c//$'\n'/\\n}
	c=${c//$'\t'/\\t}
	c=${c//$'\r'/\\r}
	printf '{"tool_name":"Bash","tool_input":{"command":"%s"}}' "$c"
}
check() {
  local want=$1 label=$2 got
  (cd "${4:-$repo}" && payload "$3" | "$hook" >/dev/null 2>&1)
  got=$?
  if [[ $got == "$want" ]]; then
    printf '  ok   %s\n' "$label"
  else
    printf '  FAIL %s (want exit %s, got %s)\n' "$label" "$want" "$got"
    fails=$((fails + 1))
  fi
}

echo "blocked:"
check 2 "create --base"              'gh pr create --base adam/x --fill'
check 2 "create -B"                  'gh pr create -B adam/x --fill'
check 2 "create -Bvalue"             'gh pr create -Badam/x --fill'
check 2 "create --base="             'gh pr create --base=adam/x --fill'
check 2 "quoted value"               'gh pr create --title "x" --base "adam/x"'
check 2 "edit -B quoted"             "gh pr edit 12 -B 'adam/x'"
check 2 "gh -R before pr"            'gh -R o/r pr create --base adam/x'
check 2 "chained after push"         'git push && gh pr edit --base adam/x'
check 2 "| inside a quoted title"    'gh pr create --title "a | b" --base adam/x'
check 2 "main is not the default"    'gh pr create --base main --fill'
check 2 "api -f base="               'gh api repos/o/r/pulls/9 -X PATCH -f base=adam/x'
check 2 "api --field base="          'gh api -X PATCH repos/o/r/pulls/9 --field base=adam/x'
check 2 "api create pull -F base="   'gh api repos/o/r/pulls -f title=t -F base=adam/x -f head=y'
check 2 "api quoted base value"      "gh api repos/o/r/pulls/9 -X PATCH -f base='adam/x'"
check 2 "api quoted base field"      "gh api repos/o/r/pulls/9 -X PATCH --raw-field 'base=adam/x'"
check 2 "grant only in an echo"      'echo PLAIN_BASE_OK=1; gh pr create --base adam/x'
check 2 "grant only in a message"    'git commit -m "PLAIN_BASE_OK=1" && gh pr create --base adam/x'
check 2 "grant only in a comment"    'gh pr create --base adam/x # PLAIN_BASE_OK=1'
check 2 "line continuation"          $'gh pr create --title t \\\n  --base adam/x'
check 2 "in \$(...)"                 'url=$(gh pr create --base adam/x --fill)'
check 2 "in backticks"               'url=`gh pr create --base adam/x --fill`'
check 2 "in a subshell"              '(gh pr create --base adam/x)'

echo "allowed:"
check 0 "default branch"             'gh pr create --base trunk --fill'
check 0 "default branch, -B quoted"  'gh pr edit 12 -B "trunk"'
check 0 "api base = default"         'gh api repos/o/r/pulls/9 -X PATCH -f base=trunk'
check 0 "main outside a git repo"    'gh pr create --base main --fill' /
check 0 "no --base"                  'gh pr create --fill'
check 0 "edit without --base"        'gh pr edit 12 --title t'
check 0 "api without base"           'gh api repos/o/r/pulls/9 -X PATCH -f title=t'
check 0 "gh stack submit"            'gh stack submit'
check 0 "gh stack add"               'gh stack add adam/x-2'
check 0 "git checkout -B"            'git checkout -B adam/x origin/trunk'
check 0 "grant"                      'PLAIN_BASE_OK=1 gh pr create --base adam/x --fill'
check 0 "grant after another env"    'GH_REPO=o/r PLAIN_BASE_OK=1 gh api repos/o/r/pulls/9 -X PATCH -f base=adam/x'
check 0 "mention in a commit msg"    'git commit -m "docs: gh pr create --base adam/x example"'
check 0 "mention in a grep"          'rg "gh pr create --base foo" .'
check 0 "-B inside a body"           'gh pr create --body "use -B adam/x" --fill'
check 0 "quoted flag-like title"     'gh pr create --title "-Bx" --fill'
check 0 "default in a subshell"      '(gh pr create --base trunk)'

[[ $fails == 0 ]] && echo "all passed" || { echo "$fails failed"; exit 1; }
