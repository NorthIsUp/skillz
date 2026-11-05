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

# Secret values go into the 700 tmp dir, never onto a command line where `ps`
# would show them; each `gh` reads its value from a file on stdin.
base64 < "$tmp/p12" | tr -d '\n' > "$tmp/p12.b64"
base64 < "$tmp/$profile" | tr -d '\n' > "$tmp/profile.b64"
printf "%s" "$(field "p12 password")" > "$tmp/p12.pass"

# The seven sets are independent API calls: run them together, then wait on
# each so any failure still fails the script and names what it was setting.
pids=() names=()
secret() { names+=("$1"); gh secret set "$1" -R "$repo" < "$2" & pids+=($!); }
variable() { names+=("$1"); gh variable set "$1" -R "$repo" --body "$2" & pids+=($!); }
secret ASC_KEY_P8 "$tmp/p8"
secret P12_BASE64 "$tmp/p12.b64"
secret P12_PASSWORD "$tmp/p12.pass"
secret PROFILE_BASE64 "$tmp/profile.b64"
variable ASC_KEY_ID "$(field "key id")"
variable ASC_ISSUER_ID "$(field "issuer id")"
variable TEAM_ID "$(field "team id")"
failed=()
for i in "${!pids[@]}"; do wait "${pids[$i]}" || failed+=("${names[$i]}"); done
((${#failed[@]} == 0)) || { echo "failed to set: ${failed[*]}" >&2; exit 1; }
gh secret list -R "$repo"
