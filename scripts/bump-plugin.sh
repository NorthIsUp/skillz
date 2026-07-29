#!/usr/bin/env bash
# Bump a plugin's version in both plugin.json and marketplace.json.
# Usage: bump-plugin.sh <plugin-name> [patch|minor|major]
set -euo pipefail

name=${1:?plugin name required}
level=${2:-patch}

manifest="plugins/${name}/.claude-plugin/plugin.json"
marketplace=".claude-plugin/marketplace.json"

[[ -f "$manifest" ]] || { echo "no such plugin: $manifest" >&2; exit 1; }

case "$level" in patch|minor|major) ;; *) echo "level must be patch|minor|major" >&2; exit 1;; esac

current=$(jq -r '.version' "$manifest")
[[ "$current" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] \
  || { echo "unsupported version format: $current" >&2; exit 1; }
major=${BASH_REMATCH[1]} minor=${BASH_REMATCH[2]} patch=${BASH_REMATCH[3]}

case "$level" in
  major) major=$((major+1)); minor=0; patch=0 ;;
  minor) minor=$((minor+1)); patch=0 ;;
  patch) patch=$((patch+1)) ;;
esac
next="${major}.${minor}.${patch}"

tmp=$(mktemp)
jq --arg v "$next" '.version = $v' "$manifest" >"$tmp" && mv "$tmp" "$manifest"

tmp=$(mktemp)
jq --arg n "$name" --arg v "$next" \
  '.plugins |= map(if .name == $n then .version = $v else . end)' \
  "$marketplace" >"$tmp" && mv "$tmp" "$marketplace"

# jq re-expands short arrays that prettier keeps inline, so the pre-commit
# prettier hook would reject what we just wrote.
prettier --write "$manifest" "$marketplace" >/dev/null

echo "${name}: ${current} -> ${next}"
echo "  ${manifest}"
echo "  ${marketplace}"
