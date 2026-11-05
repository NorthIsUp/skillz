#!/usr/bin/env bash
# Self-check plugins/skillz/bin/next-option-id: reads model prose only, skips
# tool calls and user turns, rolls Z over to AA.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

say() { printf '{"type":"assistant","message":{"content":[{"type":"text","text":%s}]}}\n' "$1"; }

run() {
	echo "{\"transcript_path\":\"$1\"}" | "$root/plugins/skillz/bin/next-option-id"
}
expect() {
	local got
	got=$(run "$1")
	[[ $got == "Next option-group prefix: $2."* ]] || {
		echo "FAIL: expected $2, got: $got" >&2
		exit 1
	}
}

{
	say '"say **C1** or **C2**"'
	say '"── B1 · an example"'
	say '"| D2 | backfill 90d |"'
	say '"upload to S3 with H100 nodes, see PR #24"'
	printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"echo **Z9**"}}]}}\n'
	printf '{"type":"user","message":{"content":[{"type":"text","text":"pick **Y1**"}]}}\n'
} >"$tmp/mixed.jsonl"
expect "$tmp/mixed.jsonl" E

say '"pick **Z4**"' >"$tmp/z.jsonl"
expect "$tmp/z.jsonl" AA

say '"pick **AZ1**"' >"$tmp/az.jsonl"
expect "$tmp/az.jsonl" BA

say '"pick **ZZ4**"' >"$tmp/zz.jsonl"
expect "$tmp/zz.jsonl" AAA

say '"pick **AAZ1**"' >"$tmp/aaz.jsonl"
expect "$tmp/aaz.jsonl" ABA

hooked() { printf '{"type":"attachment","attachment":{"type":"hook_success","hookEvent":"UserPromptSubmit","content":"Next option-group prefix: %s. Any options, choices, or examples you present this turn are %s1, %s2"}}\n' "$1" "$1" "$1"; }

# The newest hook output is a checkpoint: lines before it are never read
# (the Z9 would win otherwise), a recap of an older ID after it changes nothing,
# and a new group after it advances past it.
{
	say '"pick **Z9**"'
	hooked M
	say '"still open: **C1** or **C2**"'
} >"$tmp/checkpoint.jsonl"
expect "$tmp/checkpoint.jsonl" M

{
	hooked M
	say '"say **M1** or **M2**"'
} >"$tmp/after.jsonl"
expect "$tmp/after.jsonl" N

say '"nothing to choose here"' >"$tmp/none.jsonl"
expect "$tmp/none.jsonl" A

echo '{}' | "$root/plugins/skillz/bin/next-option-id" >/dev/null || {
	echo "FAIL: missing transcript_path should exit clean" >&2
	exit 1
}

echo "next-option-id: ok"
