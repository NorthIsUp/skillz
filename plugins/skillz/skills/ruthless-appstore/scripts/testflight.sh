#!/bin/sh
# Archive, sign and export (or upload) an iOS app for TestFlight, on a build Mac or in CI.
# usage: testflight.sh [--no-upload]
#   --no-upload: export the .ipa (+ AppStoreInfo.plist for Linux Transporter) and stop. PRs and CI use this.
# env (none are secret): SCHEME, BUNDLE_ID, TEAM_ID, ASC_KEY_ID, ASC_ISSUER_ID
#   optional: PROJECT ($SCHEME.xcodeproj), PROFILE_NAME ("$SCHEME App Store"), CI_KEYCHAIN (ci.keychain-db),
#   INTERNAL_ONLY (1), OUT (build/testflight), XCODEGEN_VERSION (2.44.1)
# Needs the ASC key file and the keychain from ci-keychain.sh.
set -eu

DESTINATION=upload
[ "${1:-}" = --no-upload ] && DESTINATION="export"
: "${SCHEME:?}" "${BUNDLE_ID:?}" "${TEAM_ID:?}" "${ASC_KEY_ID:?}" "${ASC_ISSUER_ID:?}"
PROJECT=${PROJECT:-$SCHEME.xcodeproj}
PROFILE_NAME=${PROFILE_NAME:-$SCHEME App Store}
KC=${CI_KEYCHAIN:-ci.keychain-db}
OUT=${OUT:-build/testflight}
KEY=${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_$ASC_KEY_ID.p8}
AUTH="-allowProvisioningUpdates -authenticationKeyPath $KEY -authenticationKeyID $ASC_KEY_ID -authenticationKeyIssuerID $ASC_ISSUER_ID"
# Linux Transporter can't analyze an .ipa itself and needs this plist beside it.
APPSTOREINFO=$([ "$DESTINATION" = export ] && echo true || echo false)
# Internal-only builds skip Beta App Review and can never be offered to external testers.
INTERNAL=$([ "${INTERNAL_ONLY:-1}" = 1 ] && echo true || echo false)

rm -rf "$OUT" && mkdir -p "$OUT"
security unlock-keychain -p "$(cat "$HOME/.appstoreconnect/${KC%.keychain-db}.pass")" "$KC"
if [ -f project.yml ]; then
  if command -v xcodegen >/dev/null 2>&1; then xcodegen -q; else mise x "aqua:yonaskolb/XcodeGen@${XCODEGEN_VERSION:-2.44.1}" -- xcodegen -q; fi
fi

# A UTC timestamp build number never collides with an earlier upload, from any machine.
# shellcheck disable=SC2086 # $AUTH is a flag list
xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Release \
  -destination generic/platform=iOS -archivePath "$OUT/$SCHEME.xcarchive" \
  CURRENT_PROJECT_VERSION="$(date -u +%Y%m%d%H%M)" $AUTH archive -quiet

cat > "$OUT/export.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$DESTINATION</string>
  <key>generateAppStoreInformation</key><$APPSTOREINFO/>
  <key>testFlightInternalTestingOnly</key><$INTERNAL/>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key><dict><key>$BUNDLE_ID</key><string>$PROFILE_NAME</string></dict>
</dict></plist>
EOF
# shellcheck disable=SC2086
xcodebuild -exportArchive -archivePath "$OUT/$SCHEME.xcarchive" \
  -exportOptionsPlist "$OUT/export.plist" -exportPath "$OUT" $AUTH
