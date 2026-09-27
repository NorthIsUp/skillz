#!/usr/bin/env bash
# Human-run (`! set-ci-secrets.sh ...`): auto mode blocks both 1Password reads and `gh secret set`.
# Reads the team's bundled 1Password item (made by bundle-1password.sh) in one session and sets the repo's
# signing secrets: ASC_KEY_P8, P12_BASE64, P12_PASSWORD, PROFILE_BASE64; and the ids as repo variables.
# usage: set-ci-secrets.sh <vault-id> <item-id> [owner/repo]
# env: PROFILE_LABEL (default "profile"), the attachment holding this app's .mobileprovision.
# Ids, not names: op:// treats dots in a label as section separators and em dashes in names break the lookup.
set -euo pipefail

vault=${1:?usage: set-ci-secrets.sh <vault-id> <item-id> [owner/repo]}
item=${2:?item id}
repo=${3:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
chmod 700 "$tmp"

op item get "$item" --vault "$vault" --reveal --format json > "$tmp/item.json"
field() { jq -er --arg l "$1" '.fields[] | select(.label == $l) | .value' "$tmp/item.json"; }
file_id() { jq -er --arg n "$1" '.files[] | select(.name == $n) | .id' "$tmp/item.json"; }
profile=${PROFILE_LABEL:-profile}
for f in p8 p12 "$profile"; do
  op read --out-file "$tmp/$f" "op://$vault/$item/$(file_id "$f")" >/dev/null
done

gh secret set ASC_KEY_P8 -R "$repo" < "$tmp/p8"
base64 < "$tmp/p12" | tr -d '\n' | gh secret set P12_BASE64 -R "$repo"
printf "%s" "$(field "p12 password")" | gh secret set P12_PASSWORD -R "$repo"
base64 < "$tmp/$profile" | tr -d '\n' | gh secret set PROFILE_BASE64 -R "$repo"
gh variable set ASC_KEY_ID -R "$repo" --body "$(field "key id")"
gh variable set ASC_ISSUER_ID -R "$repo" --body "$(field "issuer id")"
gh variable set TEAM_ID -R "$repo" --body "$(field "team id")"
gh secret list -R "$repo"
