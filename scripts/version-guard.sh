#!/usr/bin/env bash
# For each plugin whose shipped files changed between BASE_SHA..HEAD_SHA,
# require: (a) plugins/<name>/.claude-plugin/plugin.json version bumped,
# (b) the matching plugin entry in .claude-plugin/marketplace.json bumped.
set -euo pipefail

: "${BASE_SHA:?BASE_SHA required}"
: "${HEAD_SHA:?HEAD_SHA required}"

changed=$(git diff --name-only "$BASE_SHA" "$HEAD_SHA")
if [[ -z "$changed" ]]; then
  echo "no changed files"
  exit 0
fi

echo "changed files:"
printf '%s\n' "$changed"
echo

read_marketplace_version() {
  local ref=$1 name=$2
  git show "${ref}:.claude-plugin/marketplace.json" \
    | jq -r --arg n "$name" '.plugins[] | select(.name==$n) | .version // empty'
}

read_plugin_version() {
  local ref=$1 path=$2
  git show "${ref}:${path}" 2>/dev/null \
    | jq -r '.version // empty' 2>/dev/null || true
}

fail=0
for manifest in plugins/*/.claude-plugin/plugin.json; do
  plugin_dir=$(dirname "$(dirname "$manifest")")
  name=$(jq -r '.name' "$manifest")

  # Only docs files don't count as shipped — match anything under the plugin dir
  # except top-level *.md and LICENSE.
  if ! printf '%s\n' "$changed" \
      | grep -E "^${plugin_dir}/" \
      | grep -Ev "^${plugin_dir}/(README|CHANGELOG|LICENSE)(\.md)?$" \
      | grep -q .; then
    echo "[$name] no shipped changes; skip"
    continue
  fi

  plugin_base=$(read_plugin_version "$BASE_SHA" "$manifest")
  plugin_head=$(read_plugin_version "$HEAD_SHA" "$manifest")
  market_base=$(read_marketplace_version "$BASE_SHA" "$name" || true)
  market_head=$(read_marketplace_version "$HEAD_SHA" "$name" || true)

  echo "[$name] plugin.json: ${plugin_base:-none} -> ${plugin_head:-none}"
  echo "[$name] marketplace: ${market_base:-none} -> ${market_head:-none}"

  if [[ -z "$plugin_head" ]]; then
    echo "[$name] FAIL: plugin.json has no version"
    fail=1
    continue
  fi
  if [[ "$plugin_base" == "$plugin_head" ]]; then
    echo "[$name] FAIL: shipped files changed but plugin.json version not bumped"
    echo "  run: mise run bump $name patch"
    fail=1
  fi
  if [[ "$market_base" == "$market_head" ]]; then
    echo "[$name] FAIL: shipped files changed but marketplace.json version not bumped"
    echo "  run: mise run bump $name patch"
    fail=1
  fi
  if [[ -n "$plugin_head" && -n "$market_head" && "$plugin_head" != "$market_head" ]]; then
    echo "[$name] FAIL: plugin.json ($plugin_head) and marketplace.json ($market_head) versions disagree"
    fail=1
  fi
done

exit "$fail"
