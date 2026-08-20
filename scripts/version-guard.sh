#!/usr/bin/env bash
# Forgetting to bump is no longer a PR failure — auto-bump-plugins.sh patch-bumps
# on main. What CI still can't fix for you is a hand-edited version that agrees
# with neither file: releases are tagged off marketplace.json, so a plugin.json
# that disagrees ships a lie.
set -euo pipefail

marketplace=".claude-plugin/marketplace.json"
fail=0

for manifest in plugins/*/.claude-plugin/plugin.json; do
  name=$(jq -r '.name' "$manifest")
  plugin_version=$(jq -r '.version // empty' "$manifest")
  market_version=$(jq -r --arg n "$name" \
    '.plugins[] | select(.name==$n) | .version // empty' "$marketplace")

  if [[ -z "$plugin_version" ]]; then
    echo "[$name] FAIL: plugin.json has no version"
    fail=1
    continue
  fi
  if [[ -z "$market_version" ]]; then
    echo "[$name] FAIL: no entry in ${marketplace}"
    fail=1
    continue
  fi
  if [[ "$plugin_version" != "$market_version" ]]; then
    echo "[$name] FAIL: plugin.json ($plugin_version) != marketplace.json ($market_version)"
    echo "  run: mise run bump $name patch"
    fail=1
    continue
  fi
  echo "[$name] $plugin_version ok"
done

exit "$fail"
