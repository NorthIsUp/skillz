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

# periodic reminder: fires once per SKILLZ_REMINDER_TOKENS of context growth
echo "VISUAL RULE" >"$tmp/plugin/rules/visual-formatting.md"
run >/dev/null # absorb the changed-rule injection for the new file

at() { # at <tokens> -> run with a transcript claiming that much context
	printf '{"usage":{"cache_read_input_tokens":%s}}\n' "$1" >"$tmp/transcript.jsonl"
	echo "{\"session_id\":\"test\",\"transcript_path\":\"$tmp/transcript.jsonl\"}" |
		env CLAUDE_PLUGIN_ROOT="$tmp/plugin" HOME="$tmp/home" TMPDIR="$tmp" \
			SKILLZ_REMINDER_TOKENS=1000 "$root/plugins/skillz/bin/sync-rules"
}

[ -z "$(at 5000)" ] || fail "reminded on the first transcript reading"
[ -z "$(at 5500)" ] || fail "reminded before a full step of growth"
out=$(at 6100)
[[ $out == *"VISUAL RULE"* ]] || fail "no reminder after a step of growth"
[ -z "$(at 6200)" ] || fail "reminded twice within one step"
[ -z "$(at 2000)" ] || fail "reminded on a compacted (shrunken) context"
[[ "$(at 3100)" == *"VISUAL RULE"* ]] || fail "no reminder after regrowth past the new baseline"

echo "sync-rules: ok"
