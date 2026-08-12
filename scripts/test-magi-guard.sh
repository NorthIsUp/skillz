#!/usr/bin/env bash
# Self-check plugins/skillz/bin/magi-guard: blocks a named MAGI spawn, passes
# everything else through.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
guard="$root/plugins/skillz/bin/magi-guard"

# payload <subagent_type> [name]
payload() {
	if [[ $# -eq 2 ]]; then
		printf '{"tool_name":"Agent","tool_input":{"subagent_type":"%s","name":"%s"}}' "$1" "$2"
	else
		printf '{"tool_name":"Agent","tool_input":{"subagent_type":"%s"}}' "$1"
	fi
}

expect() {
	local want=$1 desc=$2 got=0
	shift 2
	payload "$@" | "$guard" >/dev/null 2>&1 || got=$?
	[[ $got == "$want" ]] || {
		echo "FAIL: $desc — expected exit $want, got $got" >&2
		exit 1
	}
}

expect 2 "named magi unit is blocked" skillz:magi-melchior balthasar
expect 2 "bare agent-type name still matches" magi-casper casper-3
expect 0 "unnamed magi unit passes" skillz:magi-balthasar
expect 0 "named non-magi agent passes" general-purpose researcher
expect 0 "empty name is not a name" skillz:magi-casper ""

# A blocked call must tell the model what to do instead.
msg=$(payload skillz:magi-casper casper 2>/dev/null | "$guard" 2>&1 >/dev/null || true)
[[ $msg == *unnamed* ]] || {
	echo "FAIL: block message should say to dispatch unnamed, got: $msg" >&2
	exit 1
}

# Absent subagent_type (e.g. a Task call with no agent type) must not trip it.
echo '{"tool_name":"Agent","tool_input":{"name":"solo"}}' | "$guard" >/dev/null || {
	echo "FAIL: missing subagent_type should exit clean" >&2
	exit 1
}

echo "magi-guard: ok"
