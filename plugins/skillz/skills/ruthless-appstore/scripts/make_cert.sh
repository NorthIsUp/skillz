#!/usr/bin/env bash
# Headless signing certificate: private key + CSR -> POST /v1/certificates -> .cer -> .p12.
# usage: make_cert.sh <app-dir> [DISTRIBUTION|DEVELOPMENT|MAC_INSTALLER_DISTRIBUTION]
# env: ASC_KEY_ID, ASC_ISSUER_ID. Writes <app-dir>/<prefix>.{key,csr,cer,p12,id} and p12.pass, all mode 600.
# Developer ID certs are Account Holder only (403 for Admin keys): run with CSR_ONLY=1, upload the
# .csr at developer.apple.com, then check the downloaded .cer against the .key (see references/signing.md).
set -euo pipefail

dir=${1:?usage: make_cert.sh <app-dir> [cert-type]}
type=${2:-DISTRIBUTION}
case $type in
  DISTRIBUTION) prefix=dist ;;
  DEVELOPMENT) prefix=dev ;;
  MAC_INSTALLER_DISTRIBUTION) prefix=installer ;;
  *) echo "unknown cert type $type" >&2; exit 2 ;;
esac
here=$(cd "$(dirname "$0")" && pwd)

umask 077
mkdir -p "$dir"
base="$dir/$prefix"
[ -e "$base.key" ] && { echo "$base.key exists; move it aside to mint a new cert" >&2; exit 1; }

openssl req -new -newkey rsa:2048 -nodes -keyout "$base.key" -out "$base.csr" -subj "/CN=$prefix/C=US" 2>/dev/null
[ "${CSR_ONLY:-}" = 1 ] && { echo "$base.csr ready for developer.apple.com"; exit 0; }

token=$(uv run -q "$here/asc.py")
jq -n --arg t "$type" --rawfile csr "$base.csr" \
  '{data: {type: "certificates", attributes: {certificateType: $t, csrContent: $csr}}}' \
  | curl -fsS -X POST https://api.appstoreconnect.apple.com/v1/certificates \
      -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data-binary @- > "$base.json"
jq -r .data.id "$base.json" > "$base.id"
jq -r .data.attributes.certificateContent "$base.json" | base64 -d > "$base.cer"
rm "$base.json"

[ -f "$dir/p12.pass" ] || openssl rand -hex 24 > "$dir/p12.pass"
# OpenSSL 3's default p12 cipher is one `security import` rejects; LibreSSL has no -legacy flag and doesn't need it.
legacy=
openssl version | grep -q '^OpenSSL 3' && legacy=-legacy
openssl x509 -inform DER -in "$base.cer" -out "$base.pem"
openssl pkcs12 -export $legacy -inkey "$base.key" -in "$base.pem" -out "$base.p12" -passout "file:$dir/p12.pass"
rm "$base.pem"
echo "$type cert $(cat "$base.id") -> $base.p12"
