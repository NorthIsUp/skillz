#!/usr/bin/env bash
# Human-run (`! bundle-1password.sh ...`): creates the team's one "API Credential" item in 1Password,
# holding everything set-ci-secrets.sh reads. One op session; nothing sensitive on the command line.
# usage: bundle-1password.sh <vault-id> <title> <app-dir> <profile.mobileprovision>
# env: ASC_KEY_ID, ASC_ISSUER_ID, TEAM_ID; PROFILE_LABEL (default "profile").
# <app-dir> is make_cert.sh's output (dist.p12, dist.id, p12.pass).
# Prints the new item id; save it (it isn't secret) with the team's other ids.
set -euo pipefail

vault=${1:?usage: bundle-1password.sh <vault-id> <title> <app-dir> <profile>}
title=${2:?title}
dir=${3:?app dir}
profile=${4:?profile}
p8=$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID:?}.p8

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
chmod 700 "$tmp"
# Attachment names must match their labels and contain no dots, which op:// would read as section separators.
cp "$p8" "$tmp/p8"
cp "$dir/dist.p12" "$tmp/p12"
label=${PROFILE_LABEL:-profile}
cp "$profile" "$tmp/$label"

# Assignment statements are visible in `ps`, so the password goes in through a template file.
jq -n --arg team "${TEAM_ID:?}" --arg issuer "${ASC_ISSUER_ID:?}" --arg key "$ASC_KEY_ID" \
  --arg cert "$(cat "$dir/dist.id")" --rawfile pass "$dir/p12.pass" --arg title "$title" '{
    title: $title, category: "API_CREDENTIAL",
    fields: [
      {label: "team id", type: "STRING", value: $team},
      {label: "issuer id", type: "STRING", value: $issuer},
      {label: "key id", type: "STRING", value: $key},
      {label: "cert id", type: "STRING", value: $cert},
      {label: "p12 password", type: "CONCEALED", value: ($pass | rtrimstr("\n"))}
    ]}' > "$tmp/item.json"

op item create --vault "$vault" --template "$tmp/item.json" \
  "p8[file]=$tmp/p8" "p12[file]=$tmp/p12" "${label}[file]=$tmp/$label" --format json | jq -r .id
