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

say '"nothing to choose here"' >"$tmp/none.jsonl"
expect "$tmp/none.jsonl" A

echo '{}' | "$root/plugins/skillz/bin/next-option-id" >/dev/null || {
	echo "FAIL: missing transcript_path should exit clean" >&2
	exit 1
}

echo "next-option-id: ok"
