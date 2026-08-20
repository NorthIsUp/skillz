#!/usr/bin/env bash
# Any change under plugins/<name>/ must ship a new version. On main we patch-bump
# automatically instead of nagging: a plugin still sitting on its released
# version with file changes since that tag gets bumped, committed, and pushed.
# A minor/major bump made by hand wins — its version has no tag yet, so we skip.
# Run from CI on push to main, before release-plugins.sh.
set -euo pipefail

marketplace=".claude-plugin/marketplace.json"
bumped=()

while read -r name version; do
  [[ -n "$version" ]] || { echo "[$name] no version in ${marketplace}; skip"; continue; }
  tag="${name}-v${version}"

  if ! git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    echo "[$name] ${version} not released yet; skip"
    continue
  fi

  if git diff --quiet "$tag" HEAD -- "plugins/${name}/"; then
    echo "[$name] no changes since ${tag}"
    continue
  fi

  scripts/bump-plugin.sh "$name" patch
  bumped+=("$name")
done < <(jq -r '.plugins[] | "\(.name) \(.version // "")"' "$marketplace")

if [[ ${#bumped[@]} -eq 0 ]]; then
  echo "nothing to bump"
  exit 0
fi

# CI runners have no git identity.
git config user.name >/dev/null 2>&1 || git config user.name "github-actions[bot]"
git config user.email >/dev/null 2>&1 \
  || git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git add -A "$marketplace" plugins/*/.claude-plugin/plugin.json
git commit -m "chore(release): auto-bump ${bumped[*]}"
git push origin "HEAD:${GITHUB_REF_NAME:-main}"
