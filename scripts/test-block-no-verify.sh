#!/usr/bin/env bash
# Self-check the never-no-verify PreToolUse gate: every hook-skipping spelling
# of `git commit` is blocked, and similar flags (push -n is a dry run) are not.
set -uo pipefail

hook="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/plugins/skillz/bin/block-no-verify"

fails=0
# check <expected-exit> <label> <command>
check() {
  local want=$1 label=$2 got
  jq -n --arg c "$3" '{tool_name:"Bash",tool_input:{command:$c}}' | "$hook" >/dev/null 2>&1
  got=$?
  if [[ $got == "$want" ]]; then
    printf '  ok   %s\n' "$label"
  else
    printf '  FAIL %s (want exit %s, got %s)\n' "$label" "$want" "$got"
    fails=$((fails + 1))
  fi
}

echo "blocked:"
check 2 "commit --no-verify"         'git commit --no-verify -m wip'
check 2 "push --no-verify"           'git push --no-verify'
check 2 "commit -n"                  'git commit -n -m wip'
check 2 "commit -n after -m"         'git commit -m "wip" -n'
check 2 "clustered -nm"              'git commit -nm wip'
check 2 "clustered -qn"              'git commit -qn -m wip'
check 2 "clustered -an"              'git commit -an -m wip'
check 2 "git -C <dir> commit -n"     'git -C ../wt commit -n -m wip'
check 2 "amend -n"                   'git commit --amend --no-edit -n'
check 2 "chained after cd"           'cd ../wt && git commit -n -m wip'

echo "allowed:"
check 0 "plain commit"               'git commit -m "add -n flag docs"'
check 0 "push -n is a dry run"       'git push -n origin main'
check 0 "commit with -m only"        'git commit -am wip'
check 0 "grant spelled out"          'NO_VERIFY_OK=1 git commit -n -m wip'
check 0 "unrelated -n"               'head -n 5 file && git status'

[[ $fails == 0 ]] && echo "all passed" || { echo "$fails failed"; exit 1; }
