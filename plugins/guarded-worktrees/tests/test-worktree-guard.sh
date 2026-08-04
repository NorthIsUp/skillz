#!/usr/bin/env bash
# Exercises both hook routes against a throwaway repo whose origin never
# resolves, so "did it try to fetch?" is visible as exit 1 rather than mocked.
set -uo pipefail

guard="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/worktree-guard.sh"
repo=$(mktemp -d)
trap 'rm -rf "$repo"' EXIT
git -C "$repo" init -q
git -C "$repo" remote add origin https://example.invalid/nope.git
git -C "$repo" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
stamp="$repo/.git/worktree-guard-fetch"

fails=0
# check <expected-exit> <label> <hook-payload-json>
check() {
  local want=$1 label=$2 got
  "$guard" <<<"$3" >/dev/null 2>&1
  got=$?
  if [[ $got == "$want" ]]; then
    printf '  ok   %s\n' "$label"
  else
    printf '  FAIL %s (want exit %s, got %s)\n' "$label" "$want" "$got"
    fails=$((fails + 1))
  fi
}
bash_payload() { jq -Rn --arg c "$1" --arg d "$repo" '{tool_name:"Bash",cwd:$d,tool_input:{command:$c}}'; }
wt_payload() { jq -Rn --argjson i "$1" --arg d "$repo" '{tool_name:"EnterWorktree",cwd:$d,tool_input:$i}'; }

# 2 = blocked, 1 = allowed but the fetch failed (bogus remote), 0 = allowed, no fetch attempted
echo "git worktree add:"
check 2 "branch is main"            "$(bash_payload 'git worktree add ../wt -b main origin/main')"
check 2 "bare main as base"         "$(bash_payload 'git worktree add ../wt main')"
check 2 "local ref as base"         "$(bash_payload 'git worktree add ../wt -b feat main')"
check 2 "no base ref at all"        "$(bash_payload 'git worktree add ../wt -b feat')"
check 1 "origin base fetches"       "$(bash_payload 'git worktree add ../wt -b feat origin/main')"
check 1 "non-default origin ref ok" "$(bash_payload 'git worktree add ../wt -b fix origin/release-2')"
check 1 "main only as a substring"  "$(bash_payload 'git worktree add ../m -b maintenance origin/main')"
check 0 "unrelated command"         "$(bash_payload 'git status')"
check 0 "phrase quoted in a grep"   "$(bash_payload "grep -rn 'git worktree add' docs/")"
check 1 "phrase after a separator"  "$(bash_payload 'echo hi; git worktree add ../wt -b feat origin/main')"

echo "EnterWorktree:"
check 2 "name is main"              "$(wt_payload '{"name":"main"}')"
check 2 "name is master"            "$(wt_payload '{"name":"master"}')"
check 1 "named worktree fetches"    "$(wt_payload '{"name":"feat-x"}')"
check 1 "auto-named worktree too"   "$(wt_payload '{}')"
check 0 "entering an existing one"  "$(wt_payload '{"path":"/somewhere/.claude/worktrees/wt"}')"

echo "fetch TTL:"
check 1 "a failed fetch leaves no stamp, so it retries" "$(wt_payload '{"name":"feat-y"}')"
touch "$stamp"
check 0 "fresh stamp skips the fetch"                   "$(wt_payload '{"name":"feat-y"}')"
check 0 "fresh stamp skips it on the Bash route too"    "$(bash_payload 'git worktree add ../wt -b feat origin/main')"
touch -t "$(date -v-2H +%Y%m%d%H%M 2>/dev/null || date -d '2 hours ago' +%Y%m%d%H%M)" "$stamp"
check 1 "a stamp past the TTL refetches"                "$(wt_payload '{"name":"feat-y"}')"
touch "$stamp"
WORKTREE_GUARD_FETCH_TTL=0 check 1 "TTL override is honoured" "$(wt_payload '{"name":"feat-y"}')"

((fails == 0)) && { echo "all checks passed"; exit 0; }
echo "$fails check(s) failed"
exit 1
