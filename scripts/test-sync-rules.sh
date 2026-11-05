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

# Steady state leaves the mirror alone: rewriting every rule on every prompt
# churns ~/.claude/rules and spawns a cp per file.
# Both files back-dated, so a rewrite lands decades past the marker whatever
# the filesystem's mtime resolution.
touch -t 200001010000 "$tmp/home/.claude/rules/skillz-a.md"
touch -t 200001010001 "$tmp/marker"
run >/dev/null
if [ "$tmp/home/.claude/rules/skillz-a.md" -nt "$tmp/marker" ]; then fail "unchanged rule rewritten"; fi

# A plugin upgrade moves CLAUDE_PLUGIN_ROOT; identical rules are not news.
cp -R "$tmp/plugin" "$tmp/plugin2"
out=$(echo '{"session_id":"test"}' | env CLAUDE_PLUGIN_ROOT="$tmp/plugin2" HOME="$tmp/home" TMPDIR="$tmp" "$root/plugins/skillz/bin/sync-rules")
[ -z "$out" ] || fail "plugin move re-injected unchanged rules"

echo changed >"$tmp/plugin/rules/a.md"
rm "$tmp/plugin/rules/b.md"
out=$(run)
[[ $out == *"changed"* ]] || fail "changed rule not injected"
if [[ $out == *"b.md"* ]]; then fail "injected an unchanged rule"; fi
if [ -e "$tmp/home/.claude/rules/skillz-b.md" ]; then fail "deleted rule not pruned"; fi
[ -z "$(run)" ] || fail "re-injected an already-injected change"

echo "sync-rules: ok"
