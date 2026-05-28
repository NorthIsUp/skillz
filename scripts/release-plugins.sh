#!/usr/bin/env bash
# Tag and create a GitHub release for any plugin whose marketplace.json
# version is not yet tagged. Run from CI on push to main.
set -euo pipefail

marketplace=".claude-plugin/marketplace.json"
released_any=0

jq -r '.plugins[] | "\(.name) \(.version // "")"' "$marketplace" | while read -r name version; do
  if [[ -z "$version" ]]; then
    echo "skip: $name has no version in marketplace.json"
    continue
  fi

  tag="${name}-v${version}"

  if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null \
    || git ls-remote --exit-code --tags origin "refs/tags/${tag}" >/dev/null 2>&1; then
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
done

[[ $released_any -eq 0 ]] && echo "no new plugin versions to release" || true
