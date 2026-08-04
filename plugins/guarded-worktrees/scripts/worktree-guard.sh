#!/usr/bin/env bash
# PreToolUse gate on worktree creation, for both routes:
#   Bash `git worktree add` — refuse a main/master branch or a local base ref
#   EnterWorktree           — refuse a main/master name (baseRef=fresh already
#                             pins the base to origin/<default>)
# Both fetch origin/<ref> first, at most once per WORKTREE_GUARD_FETCH_TTL.
# Exit 2 blocks the call (stderr goes to the model); exit 1 only warns.
payload=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$payload")
cwd=$(jq -r '.cwd // ""' <<<"$payload")
repo=${cwd:-$PWD}

# Fetch origin/$1 unless this hook already fetched inside the TTL.
# The stamp is ours rather than FETCH_HEAD because git refreshes FETCH_HEAD even
# when the fetch FAILS — one offline blip would otherwise suppress every retry
# for a full TTL. Written only on success. In the common git dir, so all of a
# repo's worktrees share one stamp.
# ponytail: one stamp per repo, not per ref — an hour's horizon doesn't merit
# tracking refs separately.
fetch_if_stale() {
  local stamp age
  stamp=$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/worktree-guard-fetch
  if [[ -f $stamp ]]; then
    age=$(($(date +%s) - $(date -r "$stamp" +%s)))
    ((age < ${WORKTREE_GUARD_FETCH_TTL:-3600})) && return 0
  fi
  git -C "$repo" fetch --quiet origin "$1" && { touch "$stamp"; return 0; }
  echo "warning: git fetch origin $1 failed — worktree may be cut from a stale ref" >&2
  return 1
}

if [[ $tool == EnterWorktree ]]; then
  name=$(jq -r '.tool_input.name // ""' <<<"$payload")
  path=$(jq -r '.tool_input.path // ""' <<<"$payload")
  if [[ $name =~ ^(main|master)$ ]]; then
    echo "worktree named $name blocked — name it after the feature" >&2
    exit 2
  fi
  # `path` enters an existing worktree; nothing is branched, so nothing to refresh.
  [[ -n $path ]] && exit 0
  default=$(git -C "$repo" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)
  fetch_if_stale "${default#origin/}" || exit 1
  exit 0
fi

# Only a real invocation counts: the phrase must start a command, not sit inside
# a quoted string (a grep pattern, an echo, this file).
cmd=$(jq -r '.tool_input.command // ""' <<<"$payload")
invocation="(^|[;&|(]|"$'\n'")[[:space:]]*git[[:space:]]+worktree[[:space:]]+add"
[[ $cmd =~ $invocation ]] || exit 0

# Inspect only that clause's args, so a trailing unrelated command can't trip the rules.
args=${cmd#*git worktree add}
args=${args%%[;&|]*}

if [[ $args =~ (^|[[:space:]])(-b[[:space:]]+)?(main|master)([[:space:]]|$) ]]; then
  echo "worktree on main/master blocked — cut a feature branch from origin/<default>" >&2
  exit 2
fi

if [[ ! $args =~ (^|[[:space:]])origin/([^[:space:]]+) ]]; then
  echo "worktree must be based on a remote ref: git worktree add <path> -b <feature> origin/<default>" >&2
  echo "local refs go stale silently, so a worktree cut from local main can miss landed commits" >&2
  exit 2
fi

fetch_if_stale "${BASH_REMATCH[2]}" || exit 1
exit 0
