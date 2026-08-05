#!/usr/bin/env bash
# Self-check plugins/skillz/bin/sync-rules: mirrors rules/, injects only what
# changed, stays silent otherwise.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/plugin/rules" "$tmp/home"

run() {
	echo '{"session_id":"test"}' |
		env CLAUDE_PLUGIN_ROOT="$tmp/plugin" HOME="$tmp/home" TMPDIR="$tmp" \
			"$root/plugins/skillz/bin/sync-rules"
}
fail() {
	echo "FAIL: $1" >&2
	exit 1
}

echo one >"$tmp/plugin/rules/a.md"
echo two >"$tmp/plugin/rules/b.md"

[ -z "$(run)" ] || fail "first run injected instead of just recording"
[ -f "$tmp/home/.claude/rules/skillz-a.md" ] || fail "rules not mirrored"
[ -z "$(run)" ] || fail "unchanged rules injected"

echo changed >"$tmp/plugin/rules/a.md"
rm "$tmp/plugin/rules/b.md"
out=$(run)
[[ $out == *"changed"* ]] || fail "changed rule not injected"
if [[ $out == *"b.md"* ]]; then fail "injected an unchanged rule"; fi
if [ -e "$tmp/home/.claude/rules/skillz-b.md" ]; then fail "deleted rule not pruned"; fi
[ -z "$(run)" ] || fail "re-injected an already-injected change"

echo "sync-rules: ok"
