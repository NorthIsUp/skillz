# macOS: Mac App Store and Developer ID

From Clip.md, which ships both ways without an Xcode project.

## Mac App Store without Xcode

- App Sandbox is mandatory.
- Entitlements need `com.apple.application-identifier` (`<TEAMID>.<bundle-id>`) and
  `com.apple.developer.team-identifier`, plus the sandbox keys.
- Embed the `MAC_APP_STORE` profile as `Contents/embedded.provisionprofile`.
- Info.plist needs `LSApplicationCategoryType`; the icon is an `.icns`.
- Sign: `codesign --options runtime --timestamp --entitlements … --sign "Apple Distribution: …"`.
- Package: `productbuild --component <App>.app /Applications --sign "3rd Party Mac Developer Installer: …" <App>.pkg`
  (the `MAC_INSTALLER_DISTRIBUTION` cert: `make_cert.sh <dir> MAC_INSTALLER_DISTRIBUTION`).
- Upload: `xcrun altool --upload-app -t macos -f <App>.pkg --apiKey <KEYID> --apiIssuer <ISSUER>`;
  altool finds the key in `~/.appstoreconnect/private_keys/`.
- An App-Store-signed app is SIGKILLed when launched locally. Sign a separate copy to run it.
- No Sparkle: the store updates the app.

## Developer ID, notarized

The Developer ID Application cert is Account Holder only (signing.md, "Certificates, headless").

1. `codesign --options runtime --timestamp --sign "Developer ID Application: …"` the app.
2. `ditto -c -k --keepParent <App>.app <App>.zip`, then
   `xcrun notarytool submit <App>.zip --key <p8> --key-id <KEYID> --issuer <ISSUER> --wait`.
3. `xcrun stapler staple <App>.app`.
4. Build the DMG from the stapled app, sign the DMG, notarize it, staple it.
5. Verify the way a user's Mac will, with quarantine set:

   ```sh
   xattr -w com.apple.quarantine "0081;$(printf %x "$(date +%s)");Safari;" <App>.app
   spctl --assess --type execute -vv <App>.app            # source=Notarized Developer ID
   spctl --assess --type open --context context:primary-signature -vv <App>.dmg
   ```

6. Publish under a fixed asset name so `releases/latest/download/<App>.dmg` is a stable link.
