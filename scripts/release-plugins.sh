#!/usr/bin/env bash
# Tag and create a GitHub release for any plugin whose marketplace.json
# version is not yet tagged. Run from CI on push to main.
set -euo pipefail

# CI runners have no git identity; annotated tags need one. Set a bot
# identity only when unset so local runs keep the user's own config.
git config user.name >/dev/null 2>&1 || git config user.name "github-actions[bot]"
git config user.email >/dev/null 2>&1 \
  || git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

marketplace=".claude-plugin/marketplace.json"
released_any=0
# One round trip for every remote tag, instead of an ls-remote per plugin.
remote_tags=$'\n'$(git ls-remote --tags --refs origin 2>/dev/null | cut -f2)$'\n'

# Process substitution, not a pipe: the loop must run in this shell so
# released_any survives it.
while read -r name version; do
  if [[ -z "$version" ]]; then
    echo "skip: $name has no version in marketplace.json"
    continue
  fi

  tag="${name}-v${version}"

  if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null \
    || [[ $remote_tags == *$'\n'"refs/tags/${tag}"$'\n'* ]]; then
    echo "skip: ${tag} already exists"
    continue
  fi

  echo "release: ${tag}"
  git tag -a "$tag" -m "${name} v${version}"
  git push origin "refs/tags/${tag}"

  gh release create "$tag" \
    --title "${name} v${version}" \
    --notes "Release of \`${name}\` v${version} from the \`northisup-skillz\` marketplace." \
    --target "$(git rev-parse HEAD)"

  released_any=1
done < <(jq -r '.plugins[] | "\(.name) \(.version // "")"' "$marketplace")

[[ $released_any -eq 0 ]] && echo "no new plugin versions to release" || true
